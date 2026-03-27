import * as THREE from 'three';

/** 경험치 조각 — 적 처치 시 드롭, 근접 시 자동 수집 */
export class ExpShard {
	mesh: THREE.Mesh;
	value: number;
	alive = true;

	private bobTime: number;

	constructor(scene: THREE.Scene, pos: THREE.Vector3, value: number) {
		this.value = value;
		this.bobTime = Math.random() * Math.PI * 2; // 제각기 다른 위상

		const mat = new THREE.MeshStandardMaterial({
			color: 0x44ffee,
			emissive: new THREE.Color(0x00ddaa),
			emissiveIntensity: 2.4,
			roughness: 0.12,
			metalness: 0.9
		});
		// 바닥 소품(옥타헤드론)과 구분 — 위를 향한 결정 기둥 형태
		const geo = new THREE.CylinderGeometry(0.06, 0.14, 0.38, 6);
		this.mesh = new THREE.Mesh(geo, mat);
		this.mesh.position.set(pos.x, 0.4, pos.z);
		scene.add(this.mesh);
	}

	/**
	 * @returns true if collected by player
	 */
	update(dt: number, playerPos: THREE.Vector3, collectRange: number, magnetRange: number): boolean {
		this.bobTime += dt * 3.5;
		this.mesh.position.y = 0.4 + Math.sin(this.bobTime) * 0.12;
		this.mesh.rotation.y += dt * 2.2;

		const dx = playerPos.x - this.mesh.position.x;
		const dz = playerPos.z - this.mesh.position.z;
		const distSq = dx * dx + dz * dz;

		if (distSq < collectRange * collectRange) return true;

		// 자석 인력 — magnetRange 이내에서 플레이어 쪽으로 당겨짐
		if (distSq < magnetRange * magnetRange) {
			const dist = Math.sqrt(distSq);
			const speed = 10 * (1 - dist / magnetRange); // 가까울수록 빠름
			this.mesh.position.x += (dx / dist) * speed * dt;
			this.mesh.position.z += (dz / dist) * speed * dt;
		}

		return false;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.mesh);
		this.mesh.geometry.dispose();
		(this.mesh.material as THREE.Material).dispose();
	}
}
