import * as THREE from 'three';
import type { MechBase } from '$lib/domain/types';

const TINT: Record<MechBase, { body: THREE.Color; accent: THREE.Color }> = {
	hypersuit: {
		body: new THREE.Color(0x4a6a8a),
		accent: new THREE.Color(0x66ccff)
	},
	'azonas-v': {
		body: new THREE.Color(0x5a4a7a),
		accent: new THREE.Color(0xaa77ff)
	},
	geren: {
		body: new THREE.Color(0x3a5a4a),
		accent: new THREE.Color(0x66dd99)
	},
	expressive: {
		body: new THREE.Color(0x5a6888),
		accent: new THREE.Color(0x44ccff)
	},
	soldier: {
		body: new THREE.Color(0x4a5c3e),
		accent: new THREE.Color(0xc4b896)
	}
};

/** 정비소 미리보기: 게임 공통 메쉬에 기체별 색감만 입힘 */
export function applyMechBaseTint(root: THREE.Group, base: MechBase): void {
	const t = TINT[base];
	root.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh)) return;
		const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
		for (const raw of mats) {
			if (!(raw instanceof THREE.MeshStandardMaterial)) continue;
			const m = raw;
			const isBodyLike = m.metalness < 0.7 || m.color.getHex() !== m.emissive.getHex();
			const target = isBodyLike ? t.body : t.accent;
			m.color.lerp(target, 0.38);
			if (m.emissiveIntensity > 0.1) {
				m.emissive.lerp(target, 0.35);
			}
		}
	});
}
