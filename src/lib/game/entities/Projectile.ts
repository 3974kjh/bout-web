import * as THREE from 'three';
import {
	getPlayerMissileSheetTexture,
	PLAYER_MISSILE_FRAME_COUNT,
	setMissileSpriteFrame
} from './playerMissileSheet';

export class Projectile {
	/** Mesh 또는 스프라이트 십자( Group ) */
	mesh: THREE.Object3D;
	damage: number;
	alive = true;

	/** 플레이어 미사일 전용 */
	isPlayer: boolean;
	pierceLeft: number;
	hitIds = new Set<string>();

	private velocity: THREE.Vector3;
	/** 유도 미사일일 때 타겟 위치 참조 (null이면 직선) */
	private homingTarget: THREE.Object3D | null;
	private readonly homingStrength: number;
	private life = 0;
	private readonly maxLife = 5000;

	private useSpriteMissile = false;
	private missileMap: THREE.Texture | null = null;
	private animTime = 0;

	constructor(
		scene: THREE.Scene,
		pos: THREE.Vector3,
		direction: THREE.Vector3,
		speed: number,
		damage: number,
		color: number,
		isPlayer = false,
		pierceLeft = 0,
		scale = 1,
		homingTarget: THREE.Object3D | null = null
	) {
		this.damage = damage;
		this.isPlayer = isPlayer;
		this.pierceLeft = pierceLeft;
		this.homingTarget = homingTarget;
		this.homingStrength = 4.5;
		this.velocity = direction.clone().normalize().multiplyScalar(speed);

		const sheet = isPlayer ? getPlayerMissileSheetTexture() : null;

		if (isPlayer && sheet) {
			this.useSpriteMissile = true;
			const map = sheet.clone();
			map.repeat.set(1 / PLAYER_MISSILE_FRAME_COUNT, 1);
			map.offset.set(0, 0);
			this.missileMap = map;

			// 단일 평면은 비행축이 카메라 시선과 평행할 때(특히 순수 ±Y) 옆면으로만 보여 사라짐.
			// 같은 지오/재질로 XY·XZ 두 장을 십자 배치해 모든 방향에서 단면 두께가 일치하도록 함.
			const w = 0.88 * scale;
			const h = w * (28 / 40);
			const geo = new THREE.PlaneGeometry(w, h);
			const mat = new THREE.MeshBasicMaterial({
				map,
				color: new THREE.Color(color),
				transparent: true,
				opacity: 1,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide,
				fog: true
			});
			const cross = new THREE.Group();
			const planeA = new THREE.Mesh(geo, mat);
			const planeB = new THREE.Mesh(geo, mat);
			planeB.rotation.x = Math.PI / 2;
			planeA.renderOrder = 2;
			planeB.renderOrder = 2;
			cross.add(planeA, planeB);
			this.mesh = cross;
		} else {
			const geo = isPlayer
				? new THREE.CylinderGeometry(0.08 * scale, 0.13 * scale, 0.65 * scale, 6)
				: new THREE.SphereGeometry(0.18 * scale, 8, 6);
			const mat = new THREE.MeshStandardMaterial({
				color,
				emissive: new THREE.Color(color),
				emissiveIntensity: isPlayer ? 2.8 : 1.5,
				roughness: 0.12,
				metalness: 0.6
			});
			this.mesh = new THREE.Mesh(geo, mat);
			if (isPlayer) {
				const dir = direction.clone().normalize();
				const axis = new THREE.Vector3(0, 1, 0);
				const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
				this.mesh.quaternion.copy(quaternion);
			}
		}

		this.mesh.position.copy(pos);

		scene.add(this.mesh);
	}

	update(dt: number): void {
		this.life += dt * 1000;

		if (this.homingTarget && this.homingTarget.visible) {
			const toTarget = new THREE.Vector3()
				.subVectors(this.homingTarget.position, this.mesh.position)
				.normalize();
			this.velocity.lerp(toTarget.multiplyScalar(this.velocity.length()), dt * this.homingStrength);
		}

		this.mesh.position.addScaledVector(this.velocity, dt);

		// 스프라이트 미사일: 캔버스 상 +X가 탄두 방향 → 비행 속도와 정렬
		if (this.isPlayer && this.useSpriteMissile && this.missileMap) {
			this.animTime += dt;
			const frame = Math.floor(this.animTime * 20) % PLAYER_MISSILE_FRAME_COUNT;
			setMissileSpriteFrame(this.missileMap, frame);
			const pulse = 1 + 0.09 * Math.sin(this.animTime * 26);
			this.mesh.scale.setScalar(pulse);
			const dir = this.velocity.clone();
			if (dir.lengthSq() > 1e-10) {
				dir.normalize();
				this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
			}
		}

		if (this.life >= this.maxLife) this.alive = false;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.mesh);
		if (this.missileMap) {
			this.missileMap.dispose();
			this.missileMap = null;
		}
		if (this.useSpriteMissile && this.mesh instanceof THREE.Group) {
			const first = this.mesh.children[0] as THREE.Mesh | undefined;
			if (first) {
				first.geometry.dispose();
				const mat = first.material as THREE.MeshBasicMaterial;
				mat.map = null;
				mat.dispose();
			}
		} else {
			const m = this.mesh as THREE.Mesh;
			const mat = m.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
			if (mat instanceof THREE.MeshBasicMaterial) mat.map = null;
			mat.dispose();
			m.geometry.dispose();
		}
	}
}
