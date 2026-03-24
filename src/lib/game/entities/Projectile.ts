import * as THREE from 'three';

export class Projectile {
	mesh: THREE.Mesh;
	damage: number;
	alive = true;

	private velocity: THREE.Vector3;
	private life = 0;
	private readonly maxLife = 4000;

	constructor(
		scene: THREE.Scene,
		pos: THREE.Vector3,
		direction: THREE.Vector3,
		speed: number,
		damage: number,
		color: number
	) {
		this.damage = damage;
		this.velocity = direction.clone().normalize().multiplyScalar(speed);

		const geo = new THREE.SphereGeometry(0.18, 8, 6);
		const mat = new THREE.MeshStandardMaterial({
			color,
			emissive: new THREE.Color(color),
			emissiveIntensity: 1.5,
			roughness: 0.2,
			metalness: 0.4
		});
		this.mesh = new THREE.Mesh(geo, mat);
		this.mesh.position.copy(pos);
		scene.add(this.mesh);
	}

	update(dt: number): void {
		this.life += dt * 1000;
		this.mesh.position.addScaledVector(this.velocity, dt);
		if (this.life >= this.maxLife) this.alive = false;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.mesh);
		(this.mesh.material as THREE.Material).dispose();
		this.mesh.geometry.dispose();
	}
}
