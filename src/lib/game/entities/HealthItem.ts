import * as THREE from 'three';

const COLLECT_RADIUS = 1.8;
const ITEM_LIFESPAN_MS = 20000;

export class HealthItem {
	mesh: THREE.Group;
	collected = false;

	private age = 0;
	private readonly scene: THREE.Scene;

	constructor(scene: THREE.Scene, pos: THREE.Vector3) {
		this.scene = scene;
		this.mesh = new THREE.Group();

		// Main orb
		const orbMat = new THREE.MeshStandardMaterial({
			color: 0x44ff88,
			emissive: new THREE.Color(0x22bb55),
			emissiveIntensity: 0.9,
			roughness: 0.25,
			metalness: 0.5
		});
		const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), orbMat);
		this.mesh.add(orb);

		// Cross symbols (H and V bars)
		const crossMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			emissive: new THREE.Color(0xaaffcc),
			emissiveIntensity: 1.5
		});
		const barH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.1), crossMat);
		const barV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), crossMat);
		barH.position.y = 0.52;
		barV.position.y = 0.52;
		this.mesh.add(barH, barV);

		// Outer glow ring on ground
		const ringGeo = new THREE.RingGeometry(0.6, 0.85, 24);
		const ringMat = new THREE.MeshBasicMaterial({
			color: 0x44ff88,
			transparent: true,
			opacity: 0.35,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const ring = new THREE.Mesh(ringGeo, ringMat);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.02;
		this.mesh.add(ring);

		this.mesh.position.copy(pos);
		this.mesh.position.y = 0.45;
		scene.add(this.mesh);
	}

	/** Returns true while the item is still alive (not collected, not expired). */
	update(dt: number): boolean {
		this.age += dt * 1000;
		// Bob up and down
		this.mesh.position.y = 0.45 + Math.sin(this.age * 0.0025) * 0.2;
		// Rotate
		this.mesh.rotation.y += dt * 1.8;
		return !this.collected && this.age < ITEM_LIFESPAN_MS;
	}

	/** Returns true if the player is close enough to collect. */
	tryCollect(playerPos: THREE.Vector3): boolean {
		if (this.collected) return false;
		const dx = this.mesh.position.x - playerPos.x;
		const dz = this.mesh.position.z - playerPos.z;
		if (dx * dx + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS) {
			this.collected = true;
			return true;
		}
		return false;
	}

	dispose(): void {
		this.scene.remove(this.mesh);
	}
}
