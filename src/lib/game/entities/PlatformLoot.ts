import * as THREE from 'three';

const COLLECT_R = 2.0;
const VERTICAL_REACH = 2.8;

function disposeObject3D(root: THREE.Object3D): void {
	root.traverse((o) => {
		if (o instanceof THREE.Mesh) {
			o.geometry.dispose();
			const m = o.material;
			if (Array.isArray(m)) m.forEach((x) => x.dispose());
			else m.dispose();
		}
	});
}

/** 발판 위 체력 포션 */
export class PlatformHealthPotion {
	group: THREE.Group;
	collected = false;
	private age = 0;
	private readonly lifeMs = 40000;
	private readonly scene: THREE.Scene;
	private baseY: number;
	private floorY: number;
	private ring!: THREE.Mesh;

	constructor(scene: THREE.Scene, pos: THREE.Vector3) {
		this.scene = scene;
		this.group = new THREE.Group();
		this.floorY = pos.y;
		this.baseY = pos.y + 0.42;
		this.group.position.set(pos.x, this.baseY, pos.z);

		const liq = new THREE.MeshStandardMaterial({
			color: 0x33ff99,
			emissive: new THREE.Color(0x00aa55),
			emissiveIntensity: 1.1,
			roughness: 0.2,
			metalness: 0.45,
			transparent: true,
			opacity: 0.92
		});
		const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.52, 12), liq);
		bottle.position.y = 0.1;
		this.group.add(bottle);

		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.14, 8), liq.clone());
		neck.position.y = 0.42;
		this.group.add(neck);

		const crossM = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide
		});
		const barH = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.08), crossM);
		barH.position.set(0, 0.5, 0.31);
		const barV = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.36), crossM);
		barV.position.set(0, 0.5, 0.31);
		this.group.add(barH, barV);

		this.ring = new THREE.Mesh(
			new THREE.RingGeometry(0.35, 0.52, 28),
			new THREE.MeshBasicMaterial({
				color: 0x44ffaa,
				transparent: true,
				opacity: 0.28,
				side: THREE.DoubleSide,
				depthWrite: false
			})
		);
		this.ring.rotation.x = -Math.PI / 2;
		this.ring.position.y = this.floorY + 0.04 - this.baseY;
		this.group.add(this.ring);

		scene.add(this.group);
	}

	update(dt: number): boolean {
		this.age += dt * 1000;
		const bob = Math.sin(this.age * 0.0028) * 0.12;
		this.group.position.y = this.baseY + bob;
		this.ring.position.y = this.floorY + 0.04 - (this.baseY + bob);
		this.group.rotation.y += dt * 1.4;
		return !this.collected && this.age < this.lifeMs;
	}

	tryCollect(playerPos: THREE.Vector3): boolean {
		if (this.collected) return false;
		const dx = this.group.position.x - playerPos.x;
		const dz = this.group.position.z - playerPos.z;
		const dy = Math.abs(this.group.position.y - playerPos.y);
		if (dx * dx + dz * dz < COLLECT_R * COLLECT_R && dy < VERTICAL_REACH) {
			this.collected = true;
			return true;
		}
		return false;
	}

	dispose(): void {
		this.scene.remove(this.group);
		disposeObject3D(this.group);
	}
}

/** 발판 위 카드 보급 (수집 시 3장 중 1택) */
export class PlatformCardCache {
	group: THREE.Group;
	collected = false;
	private age = 0;
	private readonly lifeMs = 52000;
	private readonly scene: THREE.Scene;
	private baseY: number;
	private floorY: number;
	private ring!: THREE.Mesh;

	constructor(scene: THREE.Scene, pos: THREE.Vector3) {
		this.scene = scene;
		this.group = new THREE.Group();
		this.floorY = pos.y;
		this.baseY = pos.y + 0.55;
		this.group.position.set(pos.x, this.baseY, pos.z);

		const frame = new THREE.MeshStandardMaterial({
			color: 0x2a1848,
			emissive: new THREE.Color(0x8844ff),
			emissiveIntensity: 0.85,
			roughness: 0.35,
			metalness: 0.6
		});
		const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), frame);
		this.group.add(card);

		const gem = new THREE.Mesh(
			new THREE.OctahedronGeometry(0.16, 0),
			new THREE.MeshStandardMaterial({
				color: 0xffdd66,
				emissive: new THREE.Color(0xffaa00),
				emissiveIntensity: 1.4,
				roughness: 0.15,
				metalness: 0.85
			})
		);
		gem.position.set(0, 0, 0.06);
		this.group.add(gem);

		this.ring = new THREE.Mesh(
			new THREE.RingGeometry(0.45, 0.62, 32),
			new THREE.MeshBasicMaterial({
				color: 0xaa66ff,
				transparent: true,
				opacity: 0.35,
				side: THREE.DoubleSide,
				depthWrite: false
			})
		);
		this.ring.rotation.x = -Math.PI / 2;
		this.ring.position.y = this.floorY + 0.04 - this.baseY;
		this.group.add(this.ring);

		scene.add(this.group);
	}

	update(dt: number): boolean {
		this.age += dt * 1000;
		const bob = Math.sin(this.age * 0.0022) * 0.1;
		this.group.position.y = this.baseY + bob;
		this.ring.position.y = this.floorY + 0.04 - (this.baseY + bob);
		this.group.rotation.y += dt * 0.9;
		return !this.collected && this.age < this.lifeMs;
	}

	tryCollect(playerPos: THREE.Vector3): boolean {
		if (this.collected) return false;
		const dx = this.group.position.x - playerPos.x;
		const dz = this.group.position.z - playerPos.z;
		const dy = Math.abs(this.group.position.y - playerPos.y);
		if (dx * dx + dz * dz < COLLECT_R * COLLECT_R && dy < VERTICAL_REACH) {
			this.collected = true;
			return true;
		}
		return false;
	}

	dispose(): void {
		this.scene.remove(this.group);
		disposeObject3D(this.group);
	}
}
