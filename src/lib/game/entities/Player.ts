import * as THREE from 'three';
import { createMechModel, createTransformedMechModel, type MechParts3D } from './MechModel';
import { EventBus } from '../bridge/EventBus';
import type { InputManager } from '../core/InputManager';
import type { MechStats, TransformState, PlayerState, StageQuery } from '$lib/domain/types';
import {
	GRAVITY,
	JUMP_FORCE,
	COMBO_WINDOW_MS,
	ATTACK_DURATIONS_MS,
	ATTACK_COOLDOWN_MS,
	STUN_MS,
	IFRAME_MS,
	MELEE_RANGE
} from '../constants/GameConfig';

// Visual scale for the player mesh (does not affect physics/collision)
const MODEL_SCALE = 1.5;

export class Player {
	group: THREE.Group;
	parts: MechParts3D;
	stats: MechStats;
	state: PlayerState = 'idle';
	transformState: TransformState = 'normal';

	velocityY = 0;
	isOnGround = true;
	facing = new THREE.Vector3(0, 0, -1);

	comboIndex = 0;
	activeAttack = -1;
	attackTimer = 0;
	comboTimer = 0;
	cooldownTimer = 0;
	stunTimer = 0;
	iFrameTimer = 0;

	private walkCycle = 0;
	private scene: THREE.Scene;

	// Attack effect (direct mesh refs for performance — no traverse)
	private attackEffectGroup: THREE.Group | null = null;
	private attackSweepGroup: THREE.Group | null = null;
	private attackRingMesh: THREE.Mesh | null = null;
	private attackSweepMeshes: THREE.Mesh[] = [];
	private attackEffectLife = 0;
	private attackEffectMaxLife = 0;
	private flashActive = false;

	constructor(scene: THREE.Scene, pos: THREE.Vector3, stats: MechStats) {
		this.scene = scene;
		this.stats = { ...stats };
		const m = createMechModel(0x3366ff, 0x5588ff, MODEL_SCALE);
		this.group = m.group;
		this.parts = m.parts;
		this.group.position.copy(pos);
		scene.add(this.group);
	}

	update(dt: number, input: InputManager, stage: StageQuery): void {
		if (this.state === 'dead') return;
		const ms = dt * 1000;

		this.tickTimers(ms);

		if (this.state !== 'stunned' && this.state !== 'attacking') {
			this.move(dt, input, stage);
		}
		if (this.state !== 'stunned') {
			this.jump(input);
			this.attack(input);
			this.guard(input);
		}
		this.applyGravity(dt, stage);
		this.clampBounds(stage);
		this.animate(dt);
		this.emitHud();
	}

	/* ── timers ── */

	private tickTimers(ms: number): void {
		if (this.cooldownTimer > 0) this.cooldownTimer -= ms;
		if (this.iFrameTimer > 0) {
			this.iFrameTimer -= ms;
			this.group.visible = Math.sin(this.iFrameTimer * 0.02) > 0;
			if (this.iFrameTimer <= 0) this.group.visible = true;
		}
		if (this.stunTimer > 0) {
			this.stunTimer -= ms;
			if (this.stunTimer <= 0) this.state = 'idle';
		}
		if (this.state === 'attacking') {
			this.attackTimer -= ms;
			if (this.attackTimer <= 0) {
				if (this.comboIndex >= 4) {
					this.comboIndex = 0;
					this.cooldownTimer = ATTACK_COOLDOWN_MS;
					this.state = 'idle';
				} else {
					this.comboTimer = COMBO_WINDOW_MS;
					this.state = 'idle';
				}
				this.activeAttack = -1;
			}
		}
		if (this.comboTimer > 0) {
			this.comboTimer -= ms;
			if (this.comboTimer <= 0 && this.comboIndex > 0) this.comboIndex = 0;
		}
	}

	/* ── movement ── */

	private move(dt: number, input: InputManager, stage: StageQuery): void {
		if (this.state === 'guarding') return;

		let dx = 0,
			dz = 0;
		if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz = -1;
		if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz = 1;
		if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx = -1;
		if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx = 1;

		if (dx !== 0 || dz !== 0) {
			const dir = new THREE.Vector3(dx, 0, dz).normalize();
			const spd = this.stats.speed * dt;
			const fromX = this.group.position.x;
			const fromZ = this.group.position.z;
			const resolved = stage.resolveMovement(
				fromX,
				fromZ,
				fromX + dir.x * spd,
				fromZ + dir.z * spd,
				this.group.position.y
			);
			this.group.position.x = resolved.x;
			this.group.position.z = resolved.z;
			this.facing.copy(dir);
			this.group.lookAt(
				this.group.position.x + dir.x,
				this.group.position.y,
				this.group.position.z + dir.z
			);
			if (this.state !== 'jumping') this.state = 'walking';
		} else {
			if (this.state === 'walking') this.state = 'idle';
		}
	}

	/* ── jump ── */

	private jump(input: InputManager): void {
		const jp = input.justDown('KeyC') || input.justDown('Space');
		if (jp && this.isOnGround) {
			this.velocityY = JUMP_FORCE;
			this.isOnGround = false;
			this.state = 'jumping';
		}
	}

	/* ── attack ── */

	private attack(input: InputManager): void {
		if (this.state === 'guarding' || this.cooldownTimer > 0) return;
		if (!input.justDown('KeyV')) return;
		if (this.state === 'attacking') return;

		if (this.comboTimer > 0 || this.comboIndex === 0) {
			this.activeAttack = this.comboIndex;
			this.attackTimer = ATTACK_DURATIONS_MS[this.activeAttack];
			this.comboIndex++;
			this.comboTimer = 0;
			this.state = 'attacking';
			this.flashAttack();
			this.spawnAttackEffect();
		}
	}

	private flashAttack(): void {
		const color = this.transformState === 'transformed' ? 0xff8800 : 0x2266cc;
		this.parts.accentMat.emissive.setHex(color);
		this.parts.accentMat.emissiveIntensity = 1.0;
		this.flashActive = true;
		setTimeout(() => {
			if (!this.flashActive) return;
			this.flashActive = false;
			if (this.transformState !== 'transformed') {
				this.parts.accentMat.emissive.setHex(0x000000);
				this.parts.accentMat.emissiveIntensity = 0;
			}
		}, 220);
	}

	private spawnAttackEffect(): void {
		if (this.attackEffectGroup) {
			this.group.remove(this.attackEffectGroup);
		}

		const color = this.transformState === 'transformed' ? 0xffcc00 : 0x66bbff;
		this.attackEffectMaxLife = ATTACK_DURATIONS_MS[this.activeAttack] || 250;
		this.attackEffectLife = 0;

		const effGroup = new THREE.Group();

		// Ground range ring
		const ringGeo = new THREE.RingGeometry(MELEE_RANGE * 0.88, MELEE_RANGE, 32);
		const ringMat = new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: 0.25,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		this.attackRingMesh = new THREE.Mesh(ringGeo, ringMat);
		this.attackRingMesh.rotation.x = -Math.PI / 2;
		this.attackRingMesh.position.y = 0.04;
		effGroup.add(this.attackRingMesh);

		// Sweep planes group (direct refs stored for perf)
		const sweepGroup = new THREE.Group();
		sweepGroup.rotation.y = -0.8;
		this.attackSweepMeshes = [];
		const fanAngles = [-0.5, -0.25, 0, 0.25, 0.5];
		for (const angle of fanAngles) {
			const geo = new THREE.PlaneGeometry(0.24, 2.5);
			const mat = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0.6,
				side: THREE.DoubleSide,
				depthWrite: false
			});
			const plane = new THREE.Mesh(geo, mat);
			plane.position.set(
				Math.sin(angle) * MELEE_RANGE * 0.5,
				1.25,
				-Math.cos(angle) * MELEE_RANGE * 0.5
			);
			plane.rotation.y = angle;
			sweepGroup.add(plane);
			this.attackSweepMeshes.push(plane);
		}

		effGroup.add(sweepGroup);
		this.attackSweepGroup = sweepGroup;
		this.attackEffectGroup = effGroup;
		this.group.add(effGroup);
	}

	isAttackHitFrame(): boolean {
		if (this.state !== 'attacking' || this.activeAttack < 0) return false;
		const elapsed = ATTACK_DURATIONS_MS[this.activeAttack] - this.attackTimer;
		return elapsed > 60 && elapsed < 180;
	}

	/* ── guard ── */

	private guard(input: InputManager): void {
		if (this.state === 'attacking') return;
		if (input.isDown('KeyX')) {
			this.state = 'guarding';
		} else if (this.state === 'guarding') {
			this.state = 'idle';
		}
	}

	/* ── damage ── */

	takeDamage(amount: number, knockDir?: THREE.Vector3): boolean {
		if (this.iFrameTimer > 0 || this.state === 'dead') return false;
		this.stats.hp = Math.max(0, this.stats.hp - amount);
		this.iFrameTimer = IFRAME_MS;

		if (this.state !== 'guarding' && knockDir) {
			this.group.position.addScaledVector(knockDir, 1.2);
			this.state = 'stunned';
			this.stunTimer = STUN_MS;
			this.comboIndex = 0;
			this.activeAttack = -1;
		}
		if (this.stats.hp <= 0) {
			this.state = 'dead';
			EventBus.emit('game-over');
		}
		return true;
	}

	/* ── physics ── */

	private applyGravity(dt: number, stage: StageQuery): void {
		if (!this.isOnGround) this.velocityY += GRAVITY * dt;
		this.group.position.y += this.velocityY * dt;

		const gy = stage.getGroundHeight(
			this.group.position.x,
			this.group.position.z,
			this.group.position.y + 2
		);
		if (this.group.position.y <= gy) {
			this.group.position.y = gy;
			this.velocityY = 0;
			if (!this.isOnGround) {
				this.isOnGround = true;
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

	/* ── animation ── */

	private animate(dt: number): void {
		const p = this.parts;

		if (this.state === 'walking') {
			this.walkCycle += dt * 10;
			const s = Math.sin(this.walkCycle);
			// FIXED: negated signs so legs step forward (same as movement dir)
			p.leftLeg.rotation.x = -s * 0.5;
			p.rightLeg.rotation.x = s * 0.5;
			p.leftArm.rotation.x = s * 0.35;
			p.rightArm.rotation.x = -s * 0.35;
		} else if (this.state === 'attacking' && this.activeAttack >= 0) {
			const dur = ATTACK_DURATIONS_MS[this.activeAttack];
			const prog = 1 - this.attackTimer / dur;
			const swing = Math.sin(prog * Math.PI);
			p.leftLeg.rotation.x = 0;
			p.rightLeg.rotation.x = 0;
			// FIXED: positive rotation → hand swings forward toward enemy
			if (this.activeAttack === 0) {
				p.rightArm.rotation.x = swing * 1.6;
				p.leftArm.rotation.x = 0;
			} else if (this.activeAttack === 1) {
				p.leftArm.rotation.x = swing * 1.6;
				p.rightArm.rotation.x = 0;
			} else if (this.activeAttack === 2) {
				p.rightArm.rotation.x = swing * 1.8;
				p.leftArm.rotation.x = swing * 1.8;
			} else {
				// Combo finisher: wide upward arc
				p.rightArm.rotation.x = swing * 2.0;
				p.leftArm.rotation.x = swing * 2.0;
				p.body.position.y = 1.0 * MODEL_SCALE + swing * 0.3;
			}
		} else if (this.state === 'guarding') {
			p.leftArm.rotation.x = 1.2;
			p.rightArm.rotation.x = 1.2;
			p.leftLeg.rotation.x = 0;
			p.rightLeg.rotation.x = 0;
		} else {
			p.leftArm.rotation.x *= 0.85;
			p.rightArm.rotation.x *= 0.85;
			p.leftLeg.rotation.x *= 0.85;
			p.rightLeg.rotation.x *= 0.85;
			p.body.position.y += (1.0 * MODEL_SCALE - p.body.position.y) * 0.15;
		}

		// Animate attack effect (direct refs, no traverse)
		if (this.attackEffectGroup) {
			this.attackEffectLife += dt * 1000;
			const t = Math.min(1, this.attackEffectLife / this.attackEffectMaxLife);

			if (this.attackSweepGroup) {
				this.attackSweepGroup.rotation.y = -0.8 + t * 1.6;
			}

			const fade = Math.max(0, 1 - t * 1.4);
			const sweepOpacity = fade * 0.6;
			const ringOpacity = fade * 0.25;

			for (const m of this.attackSweepMeshes) {
				(m.material as THREE.MeshBasicMaterial).opacity = sweepOpacity;
			}
			if (this.attackRingMesh) {
				(this.attackRingMesh.material as THREE.MeshBasicMaterial).opacity = ringOpacity;
			}

			if (t >= 1) {
				this.group.remove(this.attackEffectGroup);
				this.attackEffectGroup = null;
				this.attackSweepGroup = null;
				this.attackRingMesh = null;
				this.attackSweepMeshes = [];
			}
		}
	}

	/* ── transform ── */

	setTransformed(on: boolean): void {
		this.transformState = on ? 'transformed' : 'normal';
		this.flashActive = false;

		// Clear attack effect refs before clearing group children
		this.attackEffectGroup = null;
		this.attackSweepGroup = null;
		this.attackRingMesh = null;
		this.attackSweepMeshes = [];

		while (this.group.children.length > 0) {
			this.group.remove(this.group.children[0]);
		}

		const { group: newGroup, parts } = on
			? createTransformedMechModel()
			: createMechModel(0x3366ff, 0x5588ff, MODEL_SCALE);

		const children = [...newGroup.children];
		for (const child of children) {
			this.group.add(child);
		}
		this.parts = parts;

		EventBus.emit('transform-state-change', { state: this.transformState });
	}

	/* ── hud ── */

	private emitHud(): void {
		EventBus.emit('hp-update', { hp: this.stats.hp, maxHp: this.stats.maxHp });
		EventBus.emit('gauge-update', {
			gauge: this.stats.transformGauge,
			maxGauge: this.stats.maxTransformGauge
		});
	}
}
