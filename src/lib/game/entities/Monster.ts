import * as THREE from 'three';
import { playEnemyDamage, playEnemyDeath } from '$lib/audio/sfx';
import { createAnimalRobotModel, createBossAnimalModel, type MechParts3D } from './MechModel';
import type { MonsterAIState, MonsterConfig, StageQuery } from '$lib/domain/types';
import { GRAVITY, KNOCKDOWN_THRESHOLD, KNOCKDOWN_MS } from '../constants/GameConfig';
import { EventBus } from '../bridge/EventBus';

export class Monster {
	group: THREE.Group;
	parts: MechParts3D;
	config: MonsterConfig;
	hp: number;
	maxHp: number;
	aiState: MonsterAIState = 'chase'; // start chasing immediately
	id: string;

	private velocityY = 0;
	private isOnGround = true;
	private stateTimer = 0;
	private idleWait = 0;
	private hitActive = false;
	private flashTimer = 0;
	private shootTimer = 0;
	wasHitThisSwing = false;

	hitCounter = 0;
	private knockdownGroupRotX = 0;

	private hpBar: THREE.Sprite;
	private hpBarCanvas!: HTMLCanvasElement;
	private hpBarCtx!: CanvasRenderingContext2D;
	private hpBarTex!: THREE.CanvasTexture;
	private hpBarWidth: number;
	private lastHpRatio = -1;
	private moveVel = new THREE.Vector3();
	private dangerRing!: THREE.Mesh;
	/** 링 기본 로컬 Y (발밑 기준) — surface 보정은 매 프레임 더함 */
	private dangerRingBaseY = 0;

	// 끼임 탈출 로직
	private stuckPos    = new THREE.Vector3();
	private stuckTimer  = 0;   // 체크 간격 (ms)
	private stuckCount  = 0;
	private escapeAngle = 0;
	private escapeMsLeft = 0;

	// 보스 AOE 쿨타임
	private aoeTimer    = 0;
	private proxAoeTimer = 0; // 근접 AOE (공격 범위 내 진입 시)

	/** 장애물 넘기 점프 연타 방지 (ms) */
	private obstacleJumpCooldownMs = 0;

	constructor(scene: THREE.Scene, pos: THREE.Vector3, config: MonsterConfig) {
		this.config = config;
		this.hp = config.hp;
		this.maxHp = config.hp;
		this.id = `${config.name}_${Math.random().toString(36).slice(2, 8)}`;

		const m = config.bossAnimalType
			? createBossAnimalModel(config.bossAnimalType, config.bodyColor, config.accentColor, config.scale)
			: createAnimalRobotModel(config.bodyColor, config.accentColor, config.scale);
		this.group = m.group;
		this.parts = m.parts;
		this.group.position.copy(pos);
		scene.add(this.group);

		// Only bosses cast shadows — perf optimization
		if (!config.isBoss) {
			this.group.traverse((child) => {
				if (child instanceof THREE.Mesh) child.castShadow = false;
			});
		}

		const ringRadius = config.isRanged ? 3.2 : config.attackRange;
		const ringGeo = new THREE.RingGeometry(ringRadius * 0.86, ringRadius, 28);
		const ringMat = new THREE.MeshBasicMaterial({
			color: config.isRanged ? 0xff6600 : 0xff2200,
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -3
		});
		this.dangerRing = new THREE.Mesh(ringGeo, ringMat);
		this.dangerRing.rotation.x = -Math.PI / 2;
		this.dangerRing.renderOrder = 5;
		this.dangerRingBaseY = 0.03 + 0.02 * config.scale;
		this.dangerRing.position.y = this.dangerRingBaseY;
		this.group.add(this.dangerRing);

		// 단일 캔버스 HP 스프라이트 (배경 + 채움 한 번에 렌더링)
		this.hpBarWidth = 1.4 * config.scale;
		const barCv = document.createElement('canvas');
		barCv.width = 64; barCv.height = 10;
		this.hpBarCanvas = barCv;
		this.hpBarCtx = barCv.getContext('2d')!;
		this.hpBarTex = new THREE.CanvasTexture(barCv);
		this.hpBar = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: this.hpBarTex, depthTest: false, transparent: true })
		);
		this.hpBar.scale.set(this.hpBarWidth, this.hpBarWidth * 0.12, 1);
		this.hpBar.position.y = 2.4 * config.scale;
		this.hpBar.renderOrder = 101;
		this.group.add(this.hpBar);
		this.drawHpBar(1.0);
	}

	private drawHpBar(ratio: number): void {
		const ctx = this.hpBarCtx;
		const W = this.hpBarCanvas.width, H = this.hpBarCanvas.height;
		ctx.clearRect(0, 0, W, H);
		// 배경
		ctx.fillStyle = 'rgba(10,10,10,0.85)';
		ctx.fillRect(0, 0, W, H);
		// 채움 (왼쪽 → 오른쪽 방향)
		const fillW = Math.max(0, ratio * (W - 2));
		ctx.fillStyle = this.config.isBoss
			? (ratio > 0.5 ? '#ff9900' : '#ff4400')
			: (ratio > 0.55 ? '#33dd55' : ratio > 0.25 ? '#ffcc00' : '#ff3333');
		ctx.fillRect(1, 1, fillW, H - 2);
		// 테두리
		ctx.strokeStyle = this.config.isBoss ? '#ffaa00' : 'rgba(200,200,200,0.5)';
		ctx.lineWidth = 0.8;
		ctx.strokeRect(0, 0, W, H);
		this.hpBarTex.needsUpdate = true;
	}

	update(dt: number, targetPos: THREE.Vector3, stage: StageQuery): void {
		if (this.hp <= 0) return;
		const ms = dt * 1000;
		this.stateTimer += ms;
		if (this.obstacleJumpCooldownMs > 0) {
			this.obstacleJumpCooldownMs = Math.max(0, this.obstacleJumpCooldownMs - ms);
		}

		if (this.flashTimer > 0) {
			this.flashTimer -= ms;
			if (this.flashTimer <= 0) {
				this.parts.bodyMat.emissive.setHex(0x000000);
				this.parts.bodyMat.emissiveIntensity = 0;
			}
		}

		const dx = targetPos.x - this.group.position.x;
		const dz = targetPos.z - this.group.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);

		let moveX = 0,
			moveZ = 0;

		// 공격 스타일 분류 (MonsterConfig 확장 없이 기존 스탯으로 판별)
		const isQuickAttacker = this.config.speed >= 5.0;   // 알파 머신 계열
		const isHeavyAttacker = this.config.scale >= 1.7;   // 터프가이 Z 계열

		switch (this.aiState) {
			case 'idle':
				if (dist < this.config.detectionRange && this.stateTimer > this.idleWait)
					this.changeState('chase');
				break;

		case 'chase': {
			if (dist < this.config.attackRange) {
				// 보스는 근접 공격 없이 AOE만 — attack 상태 전환 건너뜀
				if (!this.config.isBoss) {
					this.moveVel.set(0, 0, 0);
					this.changeState(this.config.isRanged ? 'rangedAttack' : 'attack');
					break;
				}
			}
		{
			// 끼임 감지: 0.5초마다 이동 거리 체크
			this.stuckTimer += ms;
			if (this.stuckTimer >= 500) {
				this.stuckTimer = 0;
				const moved = this.group.position.distanceTo(this.stuckPos);
				if (moved < 0.3) {
					this.stuckCount++;
					if (this.stuckCount >= 3) {
						// 3회 연속 끼임 → 플레이어 주변 안전 위치로 텔레포트
						const tpAngle = Math.random() * Math.PI * 2;
						const tpDist  = this.config.attackRange * 1.5 + Math.random() * 6;
						this.group.position.set(
							targetPos.x + Math.cos(tpAngle) * tpDist,
							0,
							targetPos.z + Math.sin(tpAngle) * tpDist
						);
						this.stuckCount = 0;
						this.escapeMsLeft = 0;
					} else {
						// 8방향 중 가장 이동 가능한 방향 선택
						const toPlayer = Math.atan2(dz, dx);
						let bestAngle = toPlayer;
						let bestFreedom = -1;
						for (let k = 0; k < 8; k++) {
							const testAngle = toPlayer + (k * Math.PI / 4);
							const testX = this.group.position.x + Math.cos(testAngle) * 0.8;
							const testZ = this.group.position.z + Math.sin(testAngle) * 0.8;
							const resolved = stage.resolveMovement(
								this.group.position.x, this.group.position.z,
								testX, testZ, this.group.position.y
							);
							const freedom = Math.abs(resolved.x - this.group.position.x) + Math.abs(resolved.z - this.group.position.z);
							if (freedom > bestFreedom) {
								bestFreedom = freedom;
								bestAngle = testAngle;
							}
						}
						this.escapeAngle = bestAngle;
						this.escapeMsLeft = 400 + Math.random() * 400;
					}
				} else {
					this.stuckCount = Math.max(0, this.stuckCount - 1);
				}
				this.stuckPos.copy(this.group.position);
			}

			let moveDir: THREE.Vector3;
			if (this.escapeMsLeft > 0) {
				// 탈출 방향으로 이동
				this.escapeMsLeft -= ms;
				moveDir = new THREE.Vector3(Math.cos(this.escapeAngle), 0, Math.sin(this.escapeAngle));
			} else {
				moveDir = new THREE.Vector3(dx, 0, dz).normalize();
			}
			const targetVel = moveDir.clone().multiplyScalar(this.config.speed);
			this.moveVel.lerp(targetVel, 0.14);
			moveX = this.moveVel.x * dt;
			moveZ = this.moveVel.z * dt;
			this.lookAtTarget(targetPos);
		}
			break;
		}

			case 'attack': {
				// 공격 타이밍 설정 (타입별 상이)
				const chargeEnd    = isHeavyAttacker ? 480 : isQuickAttacker ? 220 : 340;
				const strike1Start = chargeEnd;
				const strike1End   = chargeEnd + (isHeavyAttacker ? 240 : isQuickAttacker ? 150 : 190);
				// 알파 머신 2타 콤보
				const strike2Start = isQuickAttacker ? strike1End + 90 : -1;
				const strike2End   = isQuickAttacker ? strike2Start + 150 : -1;
				const totalMs      = isHeavyAttacker ? 1200 : isQuickAttacker ? 900 : 1000;

				this.lookAtTarget(targetPos);

				if (this.stateTimer < chargeEnd) {
					// 돌진 단계: 플레이어 쪽으로 빠르게 이동
					if (dist > 1.2) {
						const chargeSpd = this.config.speed * (isHeavyAttacker ? 2.2 : 2.8);
						const dir = new THREE.Vector3(dx, 0, dz).normalize();
						moveX = dir.x * chargeSpd * dt;
						moveZ = dir.z * chargeSpd * dt;
					}
					this.hitActive = false;
				} else if (
					(this.stateTimer >= strike1Start && this.stateTimer < strike1End) ||
					(strike2Start > 0 && this.stateTimer >= strike2Start && this.stateTimer < strike2End)
				) {
					this.hitActive = true;
				} else {
					this.hitActive = false;
					if (this.stateTimer > totalMs) this.changeState('chase');
				}
				break;
			}

			case 'rangedAttack': {
				this.lookAtTarget(targetPos);
			if (dist < 2.8) {
				this.changeState('chase');
			} else if (dist > this.config.detectionRange * 1.4) {
					this.changeState('idle');
				} else if (dist > this.config.attackRange * 1.1) {
					this.changeState('chase');
				}
				this.shootTimer += ms;
				const rate = this.config.fireRateMs ?? 2200;
				if (this.shootTimer >= rate) {
					this.shootTimer -= rate;
					const dir = new THREE.Vector3(dx, 0, dz).normalize();
					EventBus.emit('enemy-projectile', {
						pos: this.group.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
						dir,
						damage: Math.max(1, Math.floor(this.config.attack * 0.8)),
						speed: this.config.projectileSpeed ?? 12
					});
				}
				break;
			}

			case 'stun':
				if (this.stateTimer > 500) this.changeState('chase');
				break;

			case 'knockdown':
				if (this.stateTimer > KNOCKDOWN_MS) {
					this.knockdownGroupRotX = 0;
					this.group.rotation.x = 0;
					this.changeState('chase');
				}
				break;
		}

		// 플랫폼 충돌 해결 (장애물 이동 제한 + 점프 돌파)
		if (moveX !== 0 || moveZ !== 0) {
			const fromX = this.group.position.x;
			const fromZ = this.group.position.z;
			const toX   = fromX + moveX;
			const toZ   = fromZ + moveZ;
			const feetY = this.group.position.y;
			const probeY = 14;

			// 1) 이동 방향 앞쪽에 더 높은 발판이 있으면 먼저 점프 (벽에 닿기 전에 넘기)
			if (this.isOnGround && this.obstacleJumpCooldownMs <= 0) {
				const mlen = Math.hypot(moveX, moveZ);
				if (mlen > 1e-6) {
					const nx = moveX / mlen;
					const nz = moveZ / mlen;
					let maxStep = 0;
					for (const dist of [0.32, 0.55, 0.85, 1.15, 1.45]) {
						const px = fromX + nx * dist;
						const pz = fromZ + nz * dist;
						const top = stage.getGroundHeight(px, pz, probeY);
						const d = top - feetY;
						if (d > maxStep && d > 0.26 && d < 5.9) maxStep = d;
					}
					if (maxStep > 0.26) {
						this.velocityY = this.jumpVelForObstacleClear(maxStep);
						this.isOnGround = false;
						this.obstacleJumpCooldownMs = 380;
					}
				}
			}

			const resolved = stage.resolveMovement(fromX, fromZ, toX, toZ, this.group.position.y);

			// 2) 막힌 뒤 보조 점프 (미끄러짐·모서리에서도 감지)
			if (this.isOnGround && this.obstacleJumpCooldownMs <= 0) {
				const obstH = stage.getGroundHeight(toX, toZ, probeY);
				const stuck = Math.hypot(resolved.x - fromX, resolved.z - fromZ) < 0.018;
				const fellShort = Math.hypot(resolved.x - toX, resolved.z - toZ) > 0.03;
				const moving = Math.hypot(moveX, moveZ) > 1e-5;
				const heightDiff = obstH - feetY;
				const needJump =
					heightDiff > 0.26 &&
					heightDiff < 5.9 &&
					((stuck && moving) || (fellShort && heightDiff > 0.38));
				if (needJump) {
					this.velocityY = this.jumpVelForObstacleClear(heightDiff);
					this.isOnGround = false;
					this.obstacleJumpCooldownMs = 400;
				}
			}

			this.group.position.x = resolved.x;
			this.group.position.z = resolved.z;
		}

		if (!this.isOnGround) this.velocityY += GRAVITY * dt;
		this.group.position.y += this.velocityY * dt;
		let gy = stage.getGroundHeight(
			this.group.position.x,
			this.group.position.z,
			this.group.position.y + 2
		);
		if (this.group.position.y <= gy) {
			this.group.position.y = gy;
			this.velocityY = 0;
			this.isOnGround = true;
		} else {
			this.isOnGround = false;
		}

		const po = stage.pushOutOfObstacles(
			this.group.position.x,
			this.group.position.z,
			this.group.position.y,
			0.45
		);
		this.group.position.x = po.x;
		this.group.position.z = po.z;
		if (this.velocityY <= 0.38) {
			gy = stage.getGroundHeight(
				this.group.position.x,
				this.group.position.z,
				this.group.position.y + 2
			);
			if (this.group.position.y <= gy + 0.1) {
				this.group.position.y = gy;
				this.velocityY = 0;
				this.isOnGround = true;
			} else {
				this.isOnGround = false;
			}
		} else {
			gy = stage.getGroundHeight(
				this.group.position.x,
				this.group.position.z,
				this.group.position.y + 2
			);
			if (this.group.position.y > gy + 0.14) this.isOnGround = false;
		}

		// 발 좌표 = group.y(발밑). 링/시각과 동일하게 발판 상면에 맞춤 (점프 착지 후에도 플레이어 링 로직과 일치)
		this.alignFeetToGroundSurface(stage);

		const b = stage.bounds;
		this.group.position.x = Math.max(b.minX, Math.min(b.maxX, this.group.position.x));
		this.group.position.z = Math.max(b.minZ, Math.min(b.maxZ, this.group.position.z));

		// 보스 AOE 공격 (정기 + 근접 AOE)
		if (this.config.isBoss && this.config.aoeRadius) {
			// 1) 정기 AOE — 고정 쿨다운
			this.aoeTimer += ms;
			const coolMs = this.config.aoeCooldownMs ?? 7000;
			if (this.aoeTimer >= coolMs) {
				this.aoeTimer = 0;
				this.fireAoeAtRandom(targetPos, 1.0);
			}
			// 2) 근접 AOE — 공격 범위 내 진입 시 더 빠른 주기
			if (dist < this.config.attackRange) {
				this.proxAoeTimer += ms;
				const proxCool = coolMs * 0.40;
				if (this.proxAoeTimer >= proxCool) {
					this.proxAoeTimer = 0;
					// 작고 빠른 AOE를 2~3개 연속 배치
					const count = 1 + Math.floor(Math.random() * 2);
					for (let k = 0; k < count; k++) {
						this.fireAoeAtRandom(targetPos, 0.65);
					}
				}
			} else {
				this.proxAoeTimer = Math.min(this.proxAoeTimer, (coolMs * 0.40) * 0.8);
			}
		}

		if (dist < 30) {
			this.animateMonster(isQuickAttacker, isHeavyAttacker);
		}
		this.updateHPBar();
		this.updateDangerRing(stage);
	}

	/** 타겟 근처 랜덤 위치에 AOE 발사 (scaleMult: 반경/속도 배율) */
	private fireAoeAtRandom(targetPos: THREE.Vector3, scaleMult: number): void {
		const r   = (this.config.aoeRadius ?? 7) * scaleMult;
		const fms = (this.config.aoeFillMs  ?? 2200) * (0.75 + scaleMult * 0.25);
		const dmg = Math.floor(this.config.attack * 2.0);
		// 플레이어 중심 반경 0~attackRange*0.5 이내 랜덤 위치
		const spread = (this.config.attackRange ?? 12) * 0.55;
		const angle  = Math.random() * Math.PI * 2;
		const d      = Math.random() * spread;
		EventBus.emit('boss-aoe-request', {
			x:      targetPos.x + Math.cos(angle) * d,
			y:      this.group.position.y,
			z:      targetPos.z + Math.sin(angle) * d,
			radius: r,
			fillMs: fms,
			damage: dmg,
			aoeKind: this.config.bossAnimalType ?? 'bear'
		});
	}

	/** 낮은 장애물·발판을 넘기 위한 초기 상승 속도 (물리 상 한계 내에서 높이에 맞춤) */
	private jumpVelForObstacleClear(deltaH: number): number {
		const g = Math.abs(GRAVITY);
		const h = THREE.MathUtils.clamp(deltaH, 0.3, 5.6);
		return Math.min(26, Math.sqrt(2 * g * h) * 1.1);
	}

	/**
	 * group.origin y = 발밑(MechModel 기준). getGroundHeight만 쓰면 발판 모서리에서 발과 링이 어긋날 수 있어
	 * Player의 링과 동일하게 getGroundHeightForRing으로 상면을 맞춤.
	 */
	private alignFeetToGroundSurface(stage: StageQuery): void {
		if (this.velocityY > 0.48) return;
		const x = this.group.position.x;
		const z = this.group.position.z;
		const fy = this.group.position.y;
		const yRing = stage.getGroundHeightForRing(x, z, fy);
		const yStd = stage.getGroundHeight(x, z, fy + 2);
		const ySurface = Math.max(yRing, yStd);
		if (fy <= ySurface + 0.12) {
			this.group.position.y = ySurface;
			this.velocityY = 0;
			this.isOnGround = true;
		}
	}

	/** -Z 축이 타겟을 향하도록 회전 (Three.js lookAt은 +Z가 향하므로 반전 필요) */
	private lookAtTarget(targetPos: THREE.Vector3): void {
		const px = this.group.position.x;
		const pz = this.group.position.z;
		this.group.lookAt(2 * px - targetPos.x, this.group.position.y, 2 * pz - targetPos.z);
	}

	private changeState(s: MonsterAIState): void {
		this.aiState = s;
		this.stateTimer = 0;
		this.hitActive = false;
		if (s === 'idle') this.idleWait = 500 + Math.random() * 1500;
		if (s === 'rangedAttack') this.shootTimer = (this.config.fireRateMs ?? 2200) * 0.55;
		// 공격 개시 시 히트 카운터 리셋 (플레이어를 넘어뜨리기 직전)
		if (s === 'attack') this.hitCounter = 0;
	}

	takeDamage(damage: number, knockDir?: THREE.Vector3, _forceKnockdown = false): void {
		this.hp = Math.max(0, this.hp - damage);
		if (this.hp <= 0) playEnemyDeath();
		else playEnemyDamage();

		// 피격 붉은 flash
		this.parts.bodyMat.emissive.setHex(0xff0000);
		this.parts.bodyMat.emissiveIntensity = 0.9;
		this.flashTimer = 160;

		// 단순 넉백: 위치만 뒤로 밀림
		if (knockDir) this.group.position.addScaledVector(knockDir, 0.8);
	}

	isInAttackState(): boolean {
		return this.hitActive;
	}

	isDead(): boolean {
		return this.hp <= 0;
	}

	private animateMonster(isQuick: boolean, isHeavy: boolean): void {
		if (this.aiState === 'chase') {
			const s = Math.sin(this.stateTimer * 0.008);
			this.parts.leftLeg.rotation.x = -s * 0.45;
			this.parts.rightLeg.rotation.x = s * 0.45;
			this.parts.leftArm.rotation.x = s * 0.3;
			this.parts.rightArm.rotation.x = -s * 0.3;
		} else if (this.aiState === 'attack') {
			const chargeEnd = isHeavy ? 480 : isQuick ? 220 : 340;
			if (this.stateTimer < chargeEnd) {
				// 돌진 달리기 모션
				const s = Math.sin(this.stateTimer * 0.02);
				this.parts.leftLeg.rotation.x = -s * 0.65;
				this.parts.rightLeg.rotation.x = s * 0.65;
				this.parts.leftArm.rotation.x = s * 0.55;
				this.parts.rightArm.rotation.x = -s * 0.55;
			} else {
				// 공격 스윙 모션
				const prog = Math.min(1, (this.stateTimer - chargeEnd) / 250);
				const swing = Math.sin(prog * Math.PI);
				if (isHeavy) {
					// 헤비: 양팔 내려찍기 (스매시)
					this.parts.rightArm.rotation.x = swing * 2.2;
					this.parts.leftArm.rotation.x = swing * 2.2;
					this.parts.leftLeg.rotation.x = -swing * 0.4;
					this.parts.rightLeg.rotation.x = -swing * 0.4;
				} else if (isQuick) {
					// 퀵: 빠른 2타 콤보
					const isSecondHit = this.stateTimer > (chargeEnd + 240);
					this.parts.rightArm.rotation.x = swing * (isSecondHit ? 1.6 : 1.8);
					this.parts.leftArm.rotation.x = swing * (isSecondHit ? 1.8 : 0.4);
				} else {
					// 기본: 오른팔 강타
					this.parts.rightArm.rotation.x = swing * 1.9;
					this.parts.leftArm.rotation.x = swing * 0.6;
				}
			}
		} else if (this.aiState === 'rangedAttack') {
			this.parts.rightArm.rotation.x += (0.55 - this.parts.rightArm.rotation.x) * 0.15;
			this.parts.leftArm.rotation.x += (0.55 - this.parts.leftArm.rotation.x) * 0.15;
		} else if (this.aiState === 'knockdown') {
			// 그냥 약간 비틀거리는 효과만 (회전 없음)
			this.parts.leftArm.rotation.x  *= 0.88;
			this.parts.rightArm.rotation.x *= 0.88;
		} else {
			this.group.rotation.x += (0 - this.group.rotation.x) * 0.25;
			this.parts.leftLeg.rotation.x *= 0.85;
			this.parts.rightLeg.rotation.x *= 0.85;
			this.parts.rightArm.rotation.x *= 0.85;
			this.parts.leftArm.rotation.x *= 0.85;
		}
	}

	private updateHPBar(): void {
		const ratio = Math.max(0, this.hp / this.maxHp);
		if (Math.abs(ratio - this.lastHpRatio) < 0.006) return;
		this.lastHpRatio = ratio;
		this.drawHpBar(ratio);
	}

	private updateDangerRing(stage: StageQuery): void {
		// 발판 상면과 발 좌표가 소수 프레임 어긋나도, 월드에서 링이 항상 지면·발판 위에 깔리도록 보정
		const footY = this.group.position.y;
		const sx = this.group.position.x;
		const sz = this.group.position.z;
		const yRing = stage.getGroundHeightForRing(sx, sz, footY);
		const yStd = stage.getGroundHeight(sx, sz, footY + 2);
		const surfaceY = Math.max(yRing, yStd);
		const lift = Math.max(0, surfaceY - footY);
		this.dangerRing.position.y = this.dangerRingBaseY + lift + 0.012;

		const isAttacking = this.aiState === 'attack' || this.aiState === 'rangedAttack';
		const targetOpacity = isAttacking ? 0.7 : this.aiState === 'chase' ? 0.18 : 0;
		const mat = this.dangerRing.material as THREE.MeshBasicMaterial;
		mat.opacity += (targetOpacity - mat.opacity) * 0.12;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.group);
	}
}
