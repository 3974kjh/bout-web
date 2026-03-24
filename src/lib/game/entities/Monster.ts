import * as THREE from 'three';
import { createMechModel, type MechParts3D } from './MechModel';
import type { MonsterAIState, MonsterConfig, StageQuery } from '$lib/domain/types';
import { GRAVITY } from '../constants/GameConfig';
import { EventBus } from '../bridge/EventBus';

export class Monster {
	group: THREE.Group;
	parts: MechParts3D;
	config: MonsterConfig;
	hp: number;
	maxHp: number;
	aiState: MonsterAIState = 'idle';
	id: string;

	private velocityY = 0;
	private isOnGround = true;
	private stateTimer = 0;
	private idleWait: number;
	private hitActive = false;
	private flashTimer = 0;
	private shootTimer = 0;
	wasHitThisSwing = false;

	private hpBg: THREE.Sprite;
	private hpBar: THREE.Sprite;
	private hpBarWidth: number;
	private dangerRing!: THREE.Mesh;

	constructor(scene: THREE.Scene, pos: THREE.Vector3, config: MonsterConfig) {
		this.config = config;
		this.hp = config.hp;
		this.maxHp = config.hp;
		this.id = `${config.name}_${Math.random().toString(36).slice(2, 8)}`;
		this.idleWait = 800 + Math.random() * 2000;

		const m = createMechModel(config.bodyColor, config.accentColor, config.scale);
		this.group = m.group;
		this.parts = m.parts;
		this.group.position.copy(pos);
		scene.add(this.group);

		// Danger ring on the ground
		const ringRadius = config.isRanged ? 3.2 : config.attackRange;
		const ringGeo = new THREE.RingGeometry(ringRadius * 0.86, ringRadius, 28);
		const ringMat = new THREE.MeshBasicMaterial({
			color: config.isRanged ? 0xff6600 : 0xff2200,
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		this.dangerRing = new THREE.Mesh(ringGeo, ringMat);
		this.dangerRing.rotation.x = -Math.PI / 2;
		this.dangerRing.position.y = 0.04;
		this.group.add(this.dangerRing);

		// HP bar sprites
		this.hpBarWidth = 1.2 * config.scale;
		const bgCanvas = this.makeCanvas(48, 6, '#222222');
		this.hpBg = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(bgCanvas), depthTest: false })
		);
		this.hpBg.scale.set(this.hpBarWidth + 0.15, 0.14, 1);
		this.hpBg.position.y = 2.3 * config.scale;
		this.hpBg.renderOrder = 100;
		this.group.add(this.hpBg);

		const fgCanvas = this.makeCanvas(46, 4, config.isBoss ? '#ff9900' : '#ff3333');
		this.hpBar = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fgCanvas), depthTest: false })
		);
		this.hpBar.scale.set(this.hpBarWidth, 0.1, 1);
		this.hpBar.position.y = 2.3 * config.scale;
		this.hpBar.renderOrder = 101;
		this.group.add(this.hpBar);
	}

	private makeCanvas(w: number, h: number, color: string): HTMLCanvasElement {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, w, h);
		return c;
	}

	update(dt: number, targetPos: THREE.Vector3, stage: StageQuery): void {
		if (this.hp <= 0) return;
		const ms = dt * 1000;
		this.stateTimer += ms;

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

		switch (this.aiState) {
			case 'idle':
				if (dist < this.config.detectionRange && this.stateTimer > this.idleWait)
					this.changeState('chase');
				break;

			case 'chase':
				if (dist < this.config.attackRange) {
					this.changeState(this.config.isRanged ? 'rangedAttack' : 'attack');
				} else if (dist > this.config.detectionRange * 1.6) {
					this.changeState('idle');
				} else {
					const dir = new THREE.Vector3(dx, 0, dz).normalize();
					moveX = dir.x * this.config.speed * dt;
					moveZ = dir.z * this.config.speed * dt;
					this.group.lookAt(targetPos.x, this.group.position.y, targetPos.z);
				}
				break;

			case 'attack':
				this.hitActive = this.stateTimer > 200 && this.stateTimer < 400;
				if (this.stateTimer > 700) {
					this.hitActive = false;
					this.changeState('chase');
				}
				this.group.lookAt(targetPos.x, this.group.position.y, targetPos.z);
				break;

			case 'rangedAttack': {
				this.group.lookAt(targetPos.x, this.group.position.y, targetPos.z);
				// If player is too close, back away via stun
				if (dist < 2.8) {
					this.changeState('stun');
				} else if (dist > this.config.detectionRange * 1.4) {
					this.changeState('idle');
				} else if (dist > this.config.attackRange * 1.1) {
					// Player escaped fire range — chase again
					this.changeState('chase');
				}
				// Fire at interval
				this.shootTimer += ms;
				const rate = this.config.fireRateMs ?? 2200;
				if (this.shootTimer >= rate) {
					this.shootTimer -= rate;
					const dir = new THREE.Vector3(dx, 0, dz).normalize();
					EventBus.emit('enemy-projectile', {
						pos: this.group.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
						dir,
						damage: Math.max(1, Math.floor(this.config.attack * 0.8)),
						speed: this.config.projectileSpeed ?? 9
					});
				}
				break;
			}

			case 'stun':
				if (this.stateTimer > 500) this.changeState('idle');
				break;
		}

		this.group.position.x += moveX;
		this.group.position.z += moveZ;

		if (!this.isOnGround) this.velocityY += GRAVITY * dt;
		this.group.position.y += this.velocityY * dt;
		const gy = stage.getGroundHeight(this.group.position.x, this.group.position.z, this.group.position.y + 2);
		if (this.group.position.y <= gy) {
			this.group.position.y = gy;
			this.velocityY = 0;
			this.isOnGround = true;
		} else {
			this.isOnGround = false;
		}

		const b = stage.bounds;
		this.group.position.x = Math.max(b.minX, Math.min(b.maxX, this.group.position.x));
		this.group.position.z = Math.max(b.minZ, Math.min(b.maxZ, this.group.position.z));

		this.animateMonster(dt);
		this.updateHPBar();
		this.updateDangerRing();
	}

	private changeState(s: MonsterAIState): void {
		this.aiState = s;
		this.stateTimer = 0;
		this.hitActive = false;
		if (s === 'idle') this.idleWait = 500 + Math.random() * 1500;
		if (s === 'rangedAttack') this.shootTimer = (this.config.fireRateMs ?? 2200) * 0.55;
	}

	takeDamage(damage: number, knockDir?: THREE.Vector3): void {
		this.hp = Math.max(0, this.hp - damage);
		this.changeState('stun');
		if (knockDir) this.group.position.addScaledVector(knockDir, 0.6);
		this.parts.bodyMat.emissive.setHex(0xff0000);
		this.parts.bodyMat.emissiveIntensity = 0.8;
		this.flashTimer = 200;
	}

	isInAttackState(): boolean {
		return this.hitActive;
	}

	isDead(): boolean {
		return this.hp <= 0;
	}

	private animateMonster(dt: number): void {
		if (this.aiState === 'chase') {
			const s = Math.sin(this.stateTimer * 0.008);
			this.parts.leftLeg.rotation.x = s * 0.4;
			this.parts.rightLeg.rotation.x = -s * 0.4;
		} else if (this.aiState === 'attack') {
			const prog = Math.min(1, this.stateTimer / 400);
			const swing = Math.sin(prog * Math.PI);
			this.parts.rightArm.rotation.x = -swing * 1.5;
			this.parts.leftArm.rotation.x = -swing * 0.5;
		} else if (this.aiState === 'rangedAttack') {
			// Slight arm raise for shooting pose
			this.parts.rightArm.rotation.x += (-0.6 - this.parts.rightArm.rotation.x) * 0.15;
			this.parts.leftArm.rotation.x += (-0.6 - this.parts.leftArm.rotation.x) * 0.15;
		} else {
			this.parts.leftLeg.rotation.x *= 0.85;
			this.parts.rightLeg.rotation.x *= 0.85;
			this.parts.rightArm.rotation.x *= 0.85;
			this.parts.leftArm.rotation.x *= 0.85;
		}
	}

	private updateHPBar(): void {
		const ratio = Math.max(0, this.hp / this.maxHp);
		this.hpBar.scale.x = this.hpBarWidth * ratio;
	}

	private updateDangerRing(): void {
		const isAttacking = this.aiState === 'attack' || this.aiState === 'rangedAttack';
		const targetOpacity = isAttacking ? 0.7 : this.aiState === 'chase' ? 0.18 : 0;
		const mat = this.dangerRing.material as THREE.MeshBasicMaterial;
		mat.opacity += (targetOpacity - mat.opacity) * 0.12;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.group);
	}
}
