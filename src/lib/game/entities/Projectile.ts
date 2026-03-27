import * as THREE from 'three';

export class Projectile {
	mesh: THREE.Mesh;
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

		// 플레이어 미사일: 길쭉한 캡슐 모양
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
		this.mesh.position.copy(pos);

		// 플레이어 미사일: 실린더를 속도 방향으로 정렬
		if (isPlayer) {
			const dir = direction.clone().normalize();
			const axis = new THREE.Vector3(0, 1, 0);
			const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
			this.mesh.quaternion.copy(quaternion);
		}

		scene.add(this.mesh);
	}

	update(dt: number): void {
		this.life += dt * 1000;

		// 유도 미사일: 타겟 방향으로 속도 조정
		if (this.homingTarget && this.homingTarget.visible) {
			const toTarget = new THREE.Vector3()
				.subVectors(this.homingTarget.position, this.mesh.position)
				.normalize();
			this.velocity.lerp(toTarget.multiplyScalar(this.velocity.length()), dt * this.homingStrength);
		}

		this.mesh.position.addScaledVector(this.velocity, dt);
		if (this.life >= this.maxLife) this.alive = false;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.mesh);
		(this.mesh.material as THREE.Material).dispose();
		this.mesh.geometry.dispose();
	}
}
