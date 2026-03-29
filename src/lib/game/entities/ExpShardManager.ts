import * as THREE from 'three';

const MAX_INSTANCES = 420;

type Slot = {
	active: boolean;
	value: number;
	bobTime: number;
	x: number;
	z: number;
	rotY: number;
};

/**
 * 경험치 조각 — 단일 InstancedMesh로 드로우콜·머티리얼 공유.
 * 슬롯이 가득 차면 spawn 실패 → GameEngine에서 즉시 경험치로 보상.
 */
export class ExpShardManager {
	readonly mesh: THREE.InstancedMesh;
	private readonly slots: Slot[];
	private readonly free: number[] = [];
	private readonly active: number[] = [];
	private readonly _matrix = new THREE.Matrix4();
	private readonly _pos = new THREE.Vector3();
	private readonly _quat = new THREE.Quaternion();
	private readonly _scale = new THREE.Vector3(1, 1, 1);
	private readonly _axisY = new THREE.Vector3(0, 1, 0);
	private readonly _hidden = new THREE.Matrix4().makeScale(0, 0, 0);

	constructor(scene: THREE.Scene) {
		const geo = new THREE.CylinderGeometry(0.06, 0.14, 0.38, 6);
		const mat = new THREE.MeshStandardMaterial({
			color: 0x44ffee,
			emissive: new THREE.Color(0x00ddaa),
			emissiveIntensity: 2.4,
			roughness: 0.12,
			metalness: 0.9
		});
		this.mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
		this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);

		this.slots = Array.from({ length: MAX_INSTANCES }, () => ({
			active: false,
			value: 0,
			bobTime: 0,
			x: 0,
			z: 0,
			rotY: 0
		}));
		for (let i = 0; i < MAX_INSTANCES; i++) {
			this.mesh.setMatrixAt(i, this._hidden);
			this.free.push(i);
		}
		this.mesh.instanceMatrix.needsUpdate = true;
	}

	/** @returns false if pool full — 호출부에서 value만큼 즉시 지급 */
	spawn(x: number, z: number, value: number): boolean {
		if (this.free.length === 0) return false;
		const i = this.free.pop()!;
		const s = this.slots[i];
		s.active = true;
		s.value = value;
		s.bobTime = Math.random() * Math.PI * 2;
		s.x = x;
		s.z = z;
		s.rotY = 0;
		this.active.push(i);
		this.writeMatrix(i);
		return true;
	}

	private writeMatrix(i: number): void {
		const s = this.slots[i];
		if (!s.active) {
			this.mesh.setMatrixAt(i, this._hidden);
			return;
		}
		const y = 0.4 + Math.sin(s.bobTime) * 0.12;
		this._pos.set(s.x, y, s.z);
		this._quat.setFromAxisAngle(this._axisY, s.rotY);
		this._matrix.compose(this._pos, this._quat, this._scale);
		this.mesh.setMatrixAt(i, this._matrix);
	}

	private freeIndex(i: number): void {
		const s = this.slots[i];
		s.active = false;
		this.mesh.setMatrixAt(i, this._hidden);
		this.free.push(i);
		const ai = this.active.indexOf(i);
		if (ai >= 0) this.active.splice(ai, 1);
	}

	update(
		dt: number,
		playerPos: THREE.Vector3,
		collectRange: number,
		magnetRange: number,
		onCollect: (value: number) => void
	): void {
		const cr2 = collectRange * collectRange;
		const mr2 = magnetRange * magnetRange;

		for (let a = this.active.length - 1; a >= 0; a--) {
			const i = this.active[a];
			const s = this.slots[i];
			s.bobTime += dt * 3.5;
			s.rotY += dt * 2.2;

			const dx = playerPos.x - s.x;
			const dz = playerPos.z - s.z;
			const distSq = dx * dx + dz * dz;

			if (distSq < cr2) {
				onCollect(s.value);
				this.freeIndex(i);
				continue;
			}

			if (distSq < mr2 && distSq > 1e-8) {
				const dist = Math.sqrt(distSq);
				const speed = 10 * (1 - dist / magnetRange);
				s.x += (dx / dist) * speed * dt;
				s.z += (dz / dist) * speed * dt;
			}

			this.writeMatrix(i);
		}
		this.mesh.instanceMatrix.needsUpdate = true;
	}

	dispose(scene: THREE.Scene): void {
		scene.remove(this.mesh);
		this.mesh.geometry.dispose();
		(this.mesh.material as THREE.Material).dispose();
		this.active.length = 0;
		this.free.length = 0;
	}
}
