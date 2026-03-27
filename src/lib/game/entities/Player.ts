import * as THREE from 'three';
import type { MechBase } from '$lib/domain/types';
import { type MechParts3D, createEvolvedModel, formForLevel } from './MechModel';
import {
	deepDisposePlayerGraph,
	fadeSkinnedBaseClip,
	loadSkinnedPlayerWithFallback,
	pickSkinnedClip,
	skinnedFadeCrossDuration
} from './playerSkinned';
import { updateSkinnedPlayerEvolution } from './playerSkinnedEvolution';
import { EventBus } from '../bridge/EventBus';
import type { InputManager } from '../core/InputManager';
import type { MechStats, PlayerState, StageQuery, PlayerUpgrades } from '$lib/domain/types';
import {
	GRAVITY,
	JUMP_FORCE,
	STUN_MS,
	DASH_COOLDOWN,
	DASH_SPEED,
	DASH_DECEL,
	DOUBLE_JUMP_MIN_LEVEL,
	DOUBLE_JUMP_FORCE_MULT,
	playerGltfUrlListForBase,
	playerUsesSkinnedGltfForBase,
	skinnedGltfLoadOptionsForBase
} from '../constants/GameConfig';

/** 기본 진화 모델 스케일 */
const MODEL_SCALE = 1.5;

/** 레벨에 따른 그룹 스케일 — 크기는 최소화, 디자인 진화에 집중 */
function scaleForLevel(lv: number): number {
	return 0.82 + lv * 0.020; // Lv1: 0.84, Lv20: 1.22
}

export class Player {
	group: THREE.Group;
	parts: MechParts3D;
	stats: MechStats;
	state: PlayerState = 'idle';

	velocityY = 0;
	isOnGround = true;
	facing = new THREE.Vector3(0, 0, -1);

	stunTimer = 0;

	upgrades: PlayerUpgrades = {
		missileDamage: 8,
		missileSpeed: 14,
		fireRateMs: 1500,
		missileCount: 1,
		piercingCount: 0,
		isHoming: false,
		isExplosive: false,
		explosionRadius: 3.0,
		missileScale: 1.0,
		spreadShot: false,
		collectRange: 1.8,
		magnetRange: 5.0,
		moveSpeedMult: 1.0,
		maxHpMult: 1.0,
		pendingHealPct: 0,
		dashCooldownMult: 1.0
	};

	// 대쉬
	dashCooldown = 0;     // 현재 남은 쿨타임 (초)
	dashCooldownMax = DASH_COOLDOWN; // 현재 최대 쿨타임 (초)

	private walkCycle = 0;
	private scene: THREE.Scene;
	private flashTimer = 0;
	private hitFlashTimer = 0;
	private currentForm = -1;
	private currentLevel = 1;
	private hitCircle!: THREE.Mesh;
	private headHud!: THREE.Sprite;
	private headHudTex!: THREE.CanvasTexture;
	private headHudCanvas!: HTMLCanvasElement;
	private moveVelocity = new THREE.Vector3();
	private dashVelocity = new THREE.Vector3(); // 대쉬 속도 벡터 (감속하며 소멸)
	/** WASD 입력 여부 — 관성 이동과 무관하게 걷기 애니 on/off */
	private moveIntent = false;

	private jumpsUsed = 0;
	/** 2단 점프 시 남은 회전 라디안 */
	private doubleJumpSpinLeft = 0;
	/** 2단 점프 중 누적 Y 회전 (lookAt 대신 baseYaw+이 값으로 적용) */
	private doubleJumpSpinApplied = 0;

	private readonly mechBase: MechBase;

	/** GLTF 스키닝 모드 — 성공 시 Form별 절차 메쉬 스왑 생략 */
	private skinned: {
		mixer: THREE.AnimationMixer;
		actions: Record<string, THREE.AnimationAction>;
		baseClip: THREE.AnimationAction | null;
		disposePayload: () => void;
	} | null = null;
	private gltfLoadEpoch = 0;

	constructor(scene: THREE.Scene, pos: THREE.Vector3, stats: MechStats, mechBase: MechBase) {
		this.scene = scene;
		this.stats = { ...stats };
		this.mechBase = mechBase;
		const m = createEvolvedModel(0, MODEL_SCALE, mechBase);
		this.group = m.group;
		this.parts = m.parts;
		this.group.position.copy(pos);
		this.group.scale.setScalar(scaleForLevel(1));
		this.group.frustumCulled = false;
		scene.add(this.group);
		this.currentForm = 0;
		this.createHitCircle(scene, pos);
		this.createHeadHud(scene, pos);
		if (playerUsesSkinnedGltfForBase(this.mechBase)) void this.beginSkinnedLoad();
	}

	private createHeadHud(scene: THREE.Scene, pos: THREE.Vector3): void {
		const canvas = document.createElement('canvas');
		canvas.width = 122; canvas.height = 18;
		this.headHudCanvas = canvas;
		this.headHudTex = new THREE.CanvasTexture(canvas);
		const mat = new THREE.SpriteMaterial({ map: this.headHudTex, depthTest: false, transparent: true });
		this.headHud = new THREE.Sprite(mat);
		this.headHud.scale.set(4.9, 0.62, 1);
		this.headHud.renderOrder = 200;
		this.headHud.position.set(pos.x, pos.y + 3.5, pos.z);
		scene.add(this.headHud);
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, 1);
	}

	drawHeadHud(hp: number, maxHp: number, level: number): void {
		const ctx = this.headHudCanvas.getContext('2d');
		if (!ctx) return;
		const W = 122, H = 18;
		ctx.clearRect(0, 0, W, H);

		// 대쉬 배지 (레벨 왼쪽)
		const dashReady = this.dashCooldown <= 0;
		const dashPct = this.dashCooldownMax > 0 ? Math.max(0, 1 - this.dashCooldown / this.dashCooldownMax) : 1;
		ctx.fillStyle = 'rgba(0,30,60,0.88)';
		ctx.fillRect(0, 0, 20, H);
		ctx.strokeStyle = 'rgba(0,200,255,0.8)';
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, 0.5, 19, H - 1);
		ctx.beginPath();
		ctx.arc(10, H / 2, 5.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashPct);
		ctx.strokeStyle = dashReady ? '#00eeff' : '#0077cc';
		ctx.lineWidth = 1.7;
		ctx.stroke();
		ctx.fillStyle = dashReady ? '#00eeff' : '#8aa7c7';
		ctx.font = 'bold 8px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(dashReady ? 'D' : String(Math.ceil(this.dashCooldown)), 10, H / 2 + 0.3);

		// 레벨 배지
		ctx.fillStyle = 'rgba(0,30,60,0.88)';
		ctx.fillRect(22, 0, 22, H);
		ctx.strokeStyle = '#00ccff';
		ctx.lineWidth = 1;
		ctx.strokeRect(22.5, 0.5, 21, H - 1);
		ctx.fillStyle = '#00eeff';
		ctx.font = 'bold 11px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(level), 33, H / 2 + 0.3);

		// HP 바 배경
		ctx.fillStyle = 'rgba(0,0,0,0.75)';
		ctx.fillRect(46, 2, W - 48, H - 4);
		// HP 바 채움 (오른쪽에서 왼쪽으로 감소)
		const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
		const fillW = Math.max(0, ratio * (W - 50));
		const fillColor = ratio > 0.5 ? '#33dd66' : ratio > 0.25 ? '#ffcc00' : '#ff4444';
		ctx.fillStyle = fillColor;
		ctx.fillRect(47, 3, fillW, H - 6);
		// 테두리
		ctx.strokeStyle = 'rgba(0,200,255,0.6)';
		ctx.lineWidth = 0.8;
		ctx.strokeRect(46, 2, W - 48, H - 4);
		this.headHudTex.needsUpdate = true;
	}

	private createHitCircle(scene: THREE.Scene, pos: THREE.Vector3): void {
		const geo = new THREE.RingGeometry(1.3, 1.52, 40);
		const mat = new THREE.MeshBasicMaterial({
			color: 0x00ccff,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide,
			depthWrite: false,
			depthTest: true,
			polygonOffset: true,
			polygonOffsetFactor: -1.5,
			polygonOffsetUnits: -2
		});
		this.hitCircle = new THREE.Mesh(geo, mat);
		this.hitCircle.rotation.x = -Math.PI / 2;
		this.hitCircle.renderOrder = 2;
		this.hitCircle.position.set(pos.x, 0.03, pos.z);
		scene.add(this.hitCircle);
	}

	private beginSkinnedLoad(): void {
		const epoch = ++this.gltfLoadEpoch;
		const urls = playerGltfUrlListForBase(this.mechBase);
		const gltfOpts = skinnedGltfLoadOptionsForBase(this.mechBase, 'gameplay');
		void loadSkinnedPlayerWithFallback(urls, gltfOpts)
			.then((payload) => {
				if (epoch !== this.gltfLoadEpoch) {
					payload.dispose();
					return;
				}
				const pos = this.group.position.clone();
				const scl = this.group.scale.clone();
				this.scene.remove(this.group);
				if (this.skinned) {
					this.skinned.disposePayload();
					this.skinned = null;
				} else {
					deepDisposePlayerGraph(this.group);
				}
				this.group = payload.root;
				this.parts = payload.parts;
				this.group.position.copy(pos);
				this.group.scale.copy(scl);
				this.group.frustumCulled = false;
				this.scene.add(this.group);
				const idle = pickSkinnedClip(payload.actions, ['Idle', 'Standing', 'idle'], [
					'idle',
					'stand',
					'tpose'
				]);
				this.skinned = {
					mixer: payload.mixer,
					actions: payload.actions,
					baseClip: idle ?? null,
					disposePayload: payload.dispose
				};
				updateSkinnedPlayerEvolution(this.group, this.currentForm, this.mechBase, this.currentLevel);
			})
			.catch(() => { /* 절차 메쉬 유지 */ });
	}

	private syncSkinnedBaseClip(): void {
		if (!this.skinned) return;
		if (this.flashTimer > 0) return;

		const { actions } = this.skinned;
		let next = pickSkinnedClip(actions, ['Idle', 'Standing', 'idle'], ['idle', 'stand', 'tpose']);

		if (!this.isOnGround) {
			if (this.velocityY > 0.35) {
				next =
					pickSkinnedClip(actions, ['Jump'], ['jump', 'fall', 'air']) ??
					pickSkinnedClip(actions, ['Run'], ['run']) ??
					next;
			} else {
				next =
					pickSkinnedClip(actions, ['Fall', 'Run'], ['fall', 'falling', 'run', 'air']) ??
					pickSkinnedClip(actions, ['Run', 'Walking'], ['run', 'walk']) ??
					next;
			}
		} else if (this.moveIntent && this.isOnGround && this.state !== 'jumping') {
			next =
				pickSkinnedClip(actions, ['Walking', 'Running', 'Run'], ['walk', 'jog', 'run']) ?? next;
		}

		const prev = this.skinned.baseClip;
		if (prev !== next) {
			const dur = skinnedFadeCrossDuration(prev, next);
			fadeSkinnedBaseClip(prev, next, dur, { reverseLocomotion: true });
			this.skinned.baseClip = next;
		}
	}

	// ── 레벨 진화: form이 바뀌면 모델 전체 교체 ──────────────────────────────

	getCurrentLevel(): number { return this.currentLevel; }

	setLevel(level: number): void {
		const prevLv = this.currentLevel;
		this.currentLevel = level;
		if (level > prevLv) {
			for (let i = prevLv; i < level; i++) {
				this.applyLevelMaxHpGrowth();
			}
		}
		const newForm  = formForLevel(level);
		const newScale = scaleForLevel(level);
		this.group.scale.setScalar(newScale);
		// 즉시 머리 위 HUD 레벨 반영
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);

		if (newForm !== this.currentForm) {
			this.currentForm = newForm;
			this.rebuildModel(newForm);
			this.hitFlashTimer = -200; // 하얀 플래시
		}
		if (this.skinned) {
			updateSkinnedPlayerEvolution(this.group, this.currentForm, this.mechBase, this.currentLevel);
		}
	}

	/** 레벨업 1회당 최대 HP 소폭 증가 + 증가분만큼 현재 HP 보정 */
	private applyLevelMaxHpGrowth(): void {
		const oldMax = this.stats.maxHp;
		this.stats.maxHp = Math.max(oldMax + 2, Math.floor(oldMax * 1.035));
		const gain = this.stats.maxHp - oldMax;
		this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + gain);
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);
		EventBus.emit('hp-update', { hp: this.stats.hp, maxHp: this.stats.maxHp });
	}

	private rebuildModel(form: number): void {
		if (this.skinned) return;
		const pos = this.group.position.clone();
		const scl = this.group.scale.clone();
		this.scene.remove(this.group);
		deepDisposePlayerGraph(this.group);
		const m = createEvolvedModel(form, MODEL_SCALE, this.mechBase);
		this.group = m.group;
		this.parts = m.parts;
		this.group.position.copy(pos);
		this.group.scale.copy(scl);
		this.group.frustumCulled = false;
		this.scene.add(this.group);
	}

	// ── 외부 API ──────────────────────────────────────────────────────────────

	applyMaxHpUpgrade(): void {
		const prev = this.stats.maxHp;
		this.stats.maxHp = Math.floor(this.stats.maxHp * this.upgrades.maxHpMult);
		this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + (this.stats.maxHp - prev));
		this.upgrades.maxHpMult = 1.0;
	}

	applyPendingHeal(): void {
		if (this.upgrades.pendingHealPct > 0) {
			this.stats.hp = Math.min(
				this.stats.maxHp,
				this.stats.hp + Math.floor(this.stats.maxHp * this.upgrades.pendingHealPct)
			);
			this.upgrades.pendingHealPct = 0;
			this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);
		}
	}

	/** 발판 포션 등 즉시 회복 (maxHp 비율) */
	healByMaxHpFraction(pct: number): void {
		if (this.state === 'dead') return;
		const add = Math.max(1, Math.floor(this.stats.maxHp * pct));
		this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + add);
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);
		EventBus.emit('hp-update', { hp: this.stats.hp, maxHp: this.stats.maxHp });
	}

	takeDamage(amount: number, knockDir?: THREE.Vector3): boolean {
		if (this.state === 'dead') return false;
		this.stats.hp = Math.max(0, this.stats.hp - amount);
		this.hitFlashTimer = 200;
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);

		if (knockDir) {
			this.group.position.addScaledVector(knockDir, 1.4);
		}
		if (this.stats.hp <= 0) {
			this.state = 'dead';
			// game-over 페이로드는 GameEngine.checkEnd에서 일괄 전송
		}
		return true;
	}

	/** 미사일 발사 플래시 (총 쏘는 포즈 트리거) */
	triggerFireFlash(): void {
		this.flashTimer = 140;
		if (this.skinned) {
			const punch = pickSkinnedClip(this.skinned.actions, ['Punch', 'Shoot', 'Wave'], [
				'shoot',
				'fire',
				'punch',
				'aim',
				'attack'
			]);
			if (punch) {
				punch.stop();
				punch.setLoop(THREE.LoopOnce, 1);
				punch.clampWhenFinished = true;
				punch.reset().setEffectiveWeight(1).fadeIn(0.1).play();
			}
		}
	}

	// ── 메인 업데이트 ─────────────────────────────────────────────────────────

	update(dt: number, input: InputManager, stage: StageQuery): void {
		if (this.state === 'dead') return;
		const ms = dt * 1000;

		this.tickTimers(ms);

		if (this.state !== 'stunned') {
			this.move(dt, input, stage);
			this.jump(input);
			this.tryDash(input, stage);
		}

		this.applyGravity(dt, stage, input);
		this.clampBounds(stage);
		this.animate(dt);
		this.emitHud();
		// 피격 범위 링 — 발이 발판 위에 있을 때만 발판 높이 (수평만 겹칠 때는 지면)
		if (this.hitCircle) {
			const gy = stage.getGroundHeightForRing(
				this.group.position.x,
				this.group.position.z,
				this.group.position.y
			);
			this.hitCircle.position.x = this.group.position.x;
			this.hitCircle.position.y = gy + 0.065;
			this.hitCircle.position.z = this.group.position.z;
		}
		// 머리 위 HUD 위치 동기화
		if (this.headHud) {
			const hudY = this.group.position.y + (this.parts.bodyTargetY + 1.2) * this.group.scale.x;
			this.headHud.position.set(this.group.position.x, hudY, this.group.position.z);
		}
	}

	// ── 타이머 ────────────────────────────────────────────────────────────────

	private tickTimers(ms: number): void {
		if (this.stunTimer > 0) {
			this.stunTimer -= ms;
			if (this.stunTimer <= 0) this.state = 'idle';
		}

		// 대쉬 쿨타임 감소
		if (this.dashCooldown > 0) {
			this.dashCooldown = Math.max(0, this.dashCooldown - ms / 1000);
			EventBus.emit('dash-update', {
				cooldown: this.dashCooldown,
				maxCooldown: this.dashCooldownMax
			});
			this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);
		}

		if (this.flashTimer > 0) {
			this.flashTimer -= ms;
			if (this.flashTimer <= 0 && !this.skinned) {
				this.parts.accentMat.emissive.setHex(0x000000);
				this.parts.accentMat.emissiveIntensity = 0;
			}
		}

		// 피격 발광 (빨간 → 정상)
		if (this.hitFlashTimer > 0) {
			const prevHit = this.hitFlashTimer;
			this.hitFlashTimer -= ms;
			const t = Math.max(0, this.hitFlashTimer / 300);
			this.group.traverse((obj) => {
				if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.SkinnedMesh)) return;
				const raw = obj.material;
				const mats = Array.isArray(raw) ? raw : [raw];
				for (const mat of mats) {
					if (
						mat instanceof THREE.MeshStandardMaterial ||
						mat instanceof THREE.MeshPhysicalMaterial ||
						mat instanceof THREE.MeshPhongMaterial
					) {
						mat.emissive.setRGB(t * 0.9, 0, 0);
					}
				}
			});
			if (prevHit > 0 && this.hitFlashTimer <= 0 && this.skinned) {
				updateSkinnedPlayerEvolution(this.group, this.currentForm, this.mechBase, this.currentLevel);
			}
		}

		// 티어업 하얀 플래시 (hitFlashTimer 음수 구간)
		if (this.hitFlashTimer < 0) {
			this.hitFlashTimer += ms;
			const t = Math.min(1, Math.abs(this.hitFlashTimer) / 200);
			this.group.traverse((obj) => {
				if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.SkinnedMesh)) return;
				const raw = obj.material;
				const mats = Array.isArray(raw) ? raw : [raw];
				for (const mat of mats) {
					if (
						mat instanceof THREE.MeshStandardMaterial ||
						mat instanceof THREE.MeshPhysicalMaterial ||
						mat instanceof THREE.MeshPhongMaterial
					) {
						mat.emissive.setRGB(t * 1.5, t * 1.5, t * 1.5);
					}
				}
			});
			if (this.hitFlashTimer >= 0) {
				this.hitFlashTimer = 0;
				if (this.skinned) {
					updateSkinnedPlayerEvolution(this.group, this.currentForm, this.mechBase, this.currentLevel);
				}
			}
		}
	}

	// ── 이동 ──────────────────────────────────────────────────────────────────

	private move(dt: number, input: InputManager, stage: StageQuery): void {
		let dx = 0, dz = 0;
		if (input.isDown('KeyW') || input.isDown('ArrowUp'))    dz = -1;
		if (input.isDown('KeyS') || input.isDown('ArrowDown'))  dz = 1;
		if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  dx = -1;
		if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx = 1;

		const moving = dx !== 0 || dz !== 0;
		this.moveIntent = moving;
		const targetSpd = this.stats.speed * this.upgrades.moveSpeedMult;
		const targetDir = moving ? new THREE.Vector3(dx, 0, dz).normalize() : new THREE.Vector3();
		const targetVel = targetDir.clone().multiplyScalar(targetSpd);

		// 스무스 가속/감속 (lerp)
		const lerpAlpha = moving ? 0.20 : 0.14;
		this.moveVelocity.lerp(targetVel, lerpAlpha);

		if (moving) {
			if (this.state !== 'jumping') this.state = 'walking';
		} else if (this.state === 'walking' && this.isOnGround) {
			this.state = 'idle';
		}

		if (this.moveVelocity.lengthSq() > 0.01) {
			const from = this.group.position;
			const resolved = stage.resolveMovement(
				from.x, from.z,
				from.x + this.moveVelocity.x * dt,
				from.z + this.moveVelocity.z * dt,
				from.y
			);
			this.group.position.x = resolved.x;
			this.group.position.z = resolved.z;
			const facing = this.moveVelocity.clone().setY(0).normalize();
			this.facing.copy(facing);
		}

		// 2단 점프 회전 누적 (lookAt은 매 프레임 회전을 덮어쓰므로 baseYaw + spin으로만 적용)
		if (this.doubleJumpSpinLeft > 0) {
			const rate = Math.PI * 2.4;
			const step = Math.min(this.doubleJumpSpinLeft, rate * dt);
			this.doubleJumpSpinApplied += step;
			this.doubleJumpSpinLeft -= step;
		}

		const baseYaw = Math.atan2(this.facing.x, this.facing.z);
		this.group.rotation.order = 'YXZ';
		this.group.rotation.x = 0;
		this.group.rotation.z = 0;
		this.group.rotation.y = baseYaw + this.doubleJumpSpinApplied;

		// ── 대쉬 속도 적용 (감속하며 소멸) ────────────────────────────────────
		if (this.dashVelocity.lengthSq() > 0.04) {
			const spd = this.dashVelocity.length();
			const newSpd = Math.max(0, spd - DASH_DECEL * dt);
			if (newSpd > 0) {
				this.dashVelocity.normalize().multiplyScalar(newSpd);
			} else {
				this.dashVelocity.set(0, 0, 0);
			}
			const from = this.group.position;
			const resolved = stage.resolveMovement(
				from.x, from.z,
				from.x + this.dashVelocity.x * dt,
				from.z + this.dashVelocity.z * dt,
				from.y
			);
			this.group.position.x = resolved.x;
			this.group.position.z = resolved.z;
		}
	}

	// ── 대쉬 ──────────────────────────────────────────────────────────────────

	private tryDash(input: InputManager, _stage: StageQuery): void {
		if (this.dashCooldown > 0 || this.state === 'dead') return;
		if (!input.justDown('ShiftLeft') && !input.justDown('ShiftRight')) return;

		// 대쉬 방향: 이동 방향 우선, 없으면 바라보는 방향
		let dir = this.moveVelocity.clone().setY(0);
		if (dir.lengthSq() < 0.1) dir = this.facing.clone();
		if (dir.lengthSq() < 0.01) return;
		dir.normalize();

		// 속도 벡터 설정 — move()에서 매 프레임 감속 적용하며 실제 이동
		this.dashVelocity.copy(dir).multiplyScalar(DASH_SPEED);

		this.dashCooldownMax = DASH_COOLDOWN * this.upgrades.dashCooldownMult;
		this.dashCooldown = this.dashCooldownMax;
		// 대쉬 시 전신 하얀 플래시(hitFlashTimer 음수)는 점프 직후 그림자/재질 대비를 망가뜨릴 수 있어 생략
		EventBus.emit('dash-update', { cooldown: this.dashCooldown, maxCooldown: this.dashCooldownMax });
		this.drawHeadHud(this.stats.hp, this.stats.maxHp, this.currentLevel);
	}

	// ── 점프 ──────────────────────────────────────────────────────────────────

	private jump(input: InputManager): void {
		const wantJump = input.justDown('KeyC') || input.justDown('Space');
		if (!wantJump) return;

		if (this.isOnGround) {
			this.velocityY = JUMP_FORCE;
			this.isOnGround = false;
			this.state = 'jumping';
			this.jumpsUsed = 1;
			this.doubleJumpSpinLeft = 0;
			this.doubleJumpSpinApplied = 0;
			return;
		}
		if (this.currentLevel >= DOUBLE_JUMP_MIN_LEVEL && this.jumpsUsed === 1) {
			this.velocityY = JUMP_FORCE * DOUBLE_JUMP_FORCE_MULT;
			this.jumpsUsed = 2;
			this.state = 'jumping';
			this.doubleJumpSpinLeft = Math.PI * 2;
			this.doubleJumpSpinApplied = 0;
		}
	}

	// ── 중력 ──────────────────────────────────────────────────────────────────

	private applyGravity(dt: number, stage: StageQuery, _input: InputManager): void {
		const gyProbe = this.group.position.y + 2;

		if (!this.isOnGround) this.velocityY += GRAVITY * dt;
		this.group.position.y += this.velocityY * dt;

		const gy = stage.getGroundHeight(this.group.position.x, this.group.position.z, gyProbe);
		if (this.group.position.y <= gy) {
			this.group.position.y = gy;
			this.velocityY = 0;
			if (!this.isOnGround) {
				this.isOnGround = true;
				this.jumpsUsed = 0;
				this.doubleJumpSpinLeft = 0;
				this.doubleJumpSpinApplied = 0;
				if (this.state === 'jumping') this.state = 'idle';
			}
		} else {
			this.isOnGround = false;
		}
	}

	private clampBounds(stage: StageQuery): void {
		const b = stage.bounds;
		this.group.position.x = Math.max(b.minX, Math.min(b.maxX, this.group.position.x));
		this.group.position.z = Math.max(b.minZ, Math.min(b.maxZ, this.group.position.z));
	}

	// ── 애니메이션 ────────────────────────────────────────────────────────────

	private animate(dt: number): void {
		if (this.skinned) {
			this.skinned.mixer.update(dt);
			this.syncSkinnedBaseClip();
			return;
		}

		const p = this.parts;

		if (this.moveIntent && this.isOnGround && this.state !== 'jumping') {
			const cycleSpeed = 10;
			this.walkCycle += dt * cycleSpeed;
			const s = Math.sin(this.walkCycle);
			p.leftLeg.rotation.x  = -s * 0.5;
			p.rightLeg.rotation.x =  s * 0.5;
			p.leftArm.rotation.x  =  s * 0.35;
			p.rightArm.rotation.x = -s * 0.35;
			p.leftArm.rotation.z  += (0 - p.leftArm.rotation.z)  * 0.15;
			p.rightArm.rotation.z += (0 - p.rightArm.rotation.z) * 0.15;
			p.leftLeg.rotation.z  += (0 - p.leftLeg.rotation.z)  * 0.15;
			p.rightLeg.rotation.z += (0 - p.rightLeg.rotation.z) * 0.15;
		} else if (this.state === 'jumping' && this.jumpsUsed === 2 && !this.isOnGround) {
			// 2단 점프: 팔 벌림(회전은 group.rotation.y)
			p.leftLeg.rotation.x  += (-0.55 - p.leftLeg.rotation.x)  * 0.18;
			p.rightLeg.rotation.x += (-0.55 - p.rightLeg.rotation.x) * 0.18;
			p.leftArm.rotation.x  += (0.35 - p.leftArm.rotation.x)  * 0.18;
			p.rightArm.rotation.x += (0.35 - p.rightArm.rotation.x) * 0.18;
			p.leftArm.rotation.z  += (-1.15 - p.leftArm.rotation.z)  * 0.2;
			p.rightArm.rotation.z += ( 1.15 - p.rightArm.rotation.z) * 0.2;
		} else if (this.state === 'jumping') {
			p.leftLeg.rotation.x  += (-0.4 - p.leftLeg.rotation.x)  * 0.15;
			p.rightLeg.rotation.x += (-0.4 - p.rightLeg.rotation.x) * 0.15;
			p.leftArm.rotation.x  += (0.5 - p.leftArm.rotation.x)   * 0.15;
			p.rightArm.rotation.x += (0.5 - p.rightArm.rotation.x)  * 0.15;
		} else {
			// ── 총 발사 포즈 ──────────────────────────────────────────────────
			if (this.flashTimer > 0) {
				// 발사 순간 (~140ms): 오른팔을 앞으로 완전히 뻗어 총 발사 포즈
				const phase = this.flashTimer / 140; // 1 → 0
				const stretch = phase > 0.55 ? 1.0 : (phase / 0.55); // 빠르게 뻗기 → 천천히 복귀

				p.rightArm.rotation.x += (1.65 * stretch - p.rightArm.rotation.x) * 0.65;
				p.leftArm.rotation.x  += (0.7  * stretch - p.leftArm.rotation.x)  * 0.50;
				p.rightArm.rotation.z += (-0.15 * stretch - p.rightArm.rotation.z) * 0.50;
				p.leftArm.rotation.z  += (0.15  * stretch - p.leftArm.rotation.z)  * 0.50;
			p.body.position.y += ((p.bodyTargetY - 0.06 * stretch) - p.body.position.y) * 0.4;
				// 다리는 발사 자세 (약간 벌림)
				p.leftLeg.rotation.x  += (0.15 * stretch - p.leftLeg.rotation.x)  * 0.35;
				p.rightLeg.rotation.x += (-0.1 * stretch - p.rightLeg.rotation.x) * 0.35;
			} else {
				// 대기 포즈로 부드럽게 복귀
				p.leftArm.rotation.x  += (0 - p.leftArm.rotation.x)  * 0.22;
				p.rightArm.rotation.x += (0 - p.rightArm.rotation.x) * 0.22;
				p.leftArm.rotation.z  += (0 - p.leftArm.rotation.z)  * 0.22;
				p.rightArm.rotation.z += (0 - p.rightArm.rotation.z) * 0.22;
				p.leftLeg.rotation.x  *= 0.80;
				p.rightLeg.rotation.x *= 0.80;
			}
		}

		p.body.position.y += (p.bodyTargetY - p.body.position.y) * 0.18;
	}

	// ── HUD ──────────────────────────────────────────────────────────────────

	private emitHud(): void {
		EventBus.emit('hp-update', { hp: this.stats.hp, maxHp: this.stats.maxHp });
	}

	dispose(): void {
		this.gltfLoadEpoch++;
		this.scene.remove(this.group);
		if (this.skinned) {
			this.skinned.disposePayload();
			this.skinned = null;
		} else {
			deepDisposePlayerGraph(this.group);
		}
		if (this.hitCircle) this.scene.remove(this.hitCircle);
		if (this.headHud) this.scene.remove(this.headHud);
	}

	reset(pos: THREE.Vector3, stats: MechStats): void {
		this.stats = { ...stats };
		this.state = 'idle';
		this.velocityY = 0;
		this.isOnGround = true;
		this.jumpsUsed = 0;
		this.doubleJumpSpinLeft = 0;
		this.doubleJumpSpinApplied = 0;
		this.stunTimer = 0;
		this.flashTimer = 0;
		this.hitFlashTimer = 0;
		this.currentForm = -1;
		this.currentLevel = 1;
		this.moveVelocity.set(0, 0, 0);
		if (this.hitCircle) this.scene.remove(this.hitCircle);
		if (this.headHud) this.scene.remove(this.headHud);
		this.gltfLoadEpoch++;
		this.scene.remove(this.group);
		if (this.skinned) {
			this.skinned.disposePayload();
			this.skinned = null;
		} else {
			deepDisposePlayerGraph(this.group);
		}
		const m0 = createEvolvedModel(0, MODEL_SCALE, this.mechBase);
		this.group = m0.group;
		this.parts = m0.parts;
		this.currentForm = 0;
		this.scene.add(this.group);
		this.group.position.copy(pos);
		this.group.scale.setScalar(scaleForLevel(1));
		this.createHitCircle(this.scene, pos);
		this.createHeadHud(this.scene, pos);
		this.upgrades = {
			missileDamage: 8, missileSpeed: 14, fireRateMs: 1500,
			missileCount: 1, piercingCount: 0, isHoming: false,
			isExplosive: false, explosionRadius: 3.0, missileScale: 1.0,
			spreadShot: false, collectRange: 1.8, magnetRange: 5.0,
			moveSpeedMult: 1.0, maxHpMult: 1.0, pendingHealPct: 0,
			dashCooldownMult: 1.0
		};
		if (playerUsesSkinnedGltfForBase(this.mechBase)) void this.beginSkinnedLoad();
	}
}
