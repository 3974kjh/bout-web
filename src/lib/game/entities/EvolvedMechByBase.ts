/**
 * 진화 메카 form 0~8 — 기체별로 완전히 다른 기하 언어
 * - hypersuit: 직육면체(Box) 위주
 * - azonas-v: 정팔면체(Octahedron) 몸통 + 삼각·원뿔 부착
 * - geren: 구·타원체·부드러운 원통(Sphere / 고분할 Cylinder) 위주
 */
import * as THREE from 'three';
import type { MechBase } from '$lib/domain/types';
import { formStyleRow, type MechParts3D } from './MechModel';

/** Player.ts 애니메이션과 동일 — MechModel.MECH_BODY_Y 와 맞출 것 */
const MECH_BODY_Y = 1.72;

function normalizeMechGroupGround(group: THREE.Object3D): void {
	group.updateMatrixWorld(true);
	const bbox = new THREE.Box3().setFromObject(group);
	const minY = bbox.min.y;
	if (Math.abs(minY) > 0.01) {
		for (const child of [...group.children]) {
			child.position.y -= minY;
		}
	}
}

/** 몸통 메쉬 하단과 고관절이 맞닿도록 (절차형 진화 전용) */
function hipAttachHypersuit(s: number): number {
	return MECH_BODY_Y * s - 0.3 * s;
}
function hipAttachAzonas(s: number): number {
	return MECH_BODY_Y * s - 0.44 * s;
}
function hipAttachGeren(s: number): number {
	return MECH_BODY_Y * s - 0.38 * s * 0.88;
}

/** Form별 허벅지 세그먼트 길이 — 고관절 정렬 이전 대비 다리를 더 길게 */
function legLenForForm(f: number): number {
	const base = f === 3 ? 0.28 : f === 4 ? 0.55 : f <= 6 ? 0.8 : 0.92;
	return base * 1.8;
}

function makeMats(f: number): {
	st: ReturnType<typeof formStyleRow>;
	bodyMat: THREE.MeshStandardMaterial;
	accentMat: THREE.MeshStandardMaterial;
} {
	const st = formStyleRow(f);
	const bodyMat = new THREE.MeshStandardMaterial({
		color: st.body,
		roughness: 0.5,
		metalness: 0.65,
		emissive: new THREE.Color(st.body),
		emissiveIntensity: st.emissive
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: st.accent,
		roughness: 0.25,
		metalness: 0.8,
		emissive: new THREE.Color(st.accent),
		emissiveIntensity: st.glowInt
	});
	return { st, bodyMat, accentMat };
}

/** ── 하이퍼슈트: 박스 전용 ───────────────────────────────────────────────── */
function buildEvolvedHypersuit(f: number, s: number): { group: THREE.Group; parts: MechParts3D } {
	const st = formStyleRow(f);
	const group = new THREE.Group();
	const bodyMat = new THREE.MeshStandardMaterial({
		color: st.body,
		roughness: 0.5,
		metalness: 0.65,
		emissive: new THREE.Color(st.body),
		emissiveIntensity: st.emissive
	});
	const accentMat = new THREE.MeshStandardMaterial({
		color: st.accent,
		roughness: 0.25,
		metalness: 0.8,
		emissive: new THREE.Color(st.accent),
		emissiveIntensity: st.glowInt
	});
	const head = new THREE.Group();
	const leftArm = new THREE.Group();
	const rightArm = new THREE.Group();
	const leftLeg = new THREE.Group();
	const rightLeg = new THREE.Group();

	if (f === 0) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 1.0 * s, 0.8 * s), bodyMat);
		cube.position.y = 0.5 * s;
		cube.castShadow = true;
		group.add(cube);
		[head, leftArm, rightArm, leftLeg, rightLeg].forEach((g) => group.add(g));
		return {
			group,
			parts: { head, body: cube, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: 0.5 * s }
		};
	}

	if (f === 1) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.9 * s, 0.8 * s), bodyMat);
		cube.position.y = 0.55 * s;
		cube.castShadow = true;
		group.add(cube);
		const hm = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.22 * s, 0.3 * s), bodyMat.clone());
		head.position.y = 1.06 * s;
		head.add(hm);
		group.add(head);
		for (const [side, ag] of [
			[-1, leftArm],
			[1, rightArm]
		] as [number, THREE.Group][]) {
			ag.position.set(side * 0.45 * s, 0.68 * s, 0);
			const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.18 * s, 0.18 * s), bodyMat.clone());
			st2.castShadow = true;
			ag.add(st2);
			group.add(ag);
		}
		group.add(leftLeg);
		group.add(rightLeg);
		return {
			group,
			parts: { head, body: cube, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: 0.55 * s }
		};
	}

	const body = new THREE.Mesh(new THREE.BoxGeometry(0.78 * s, 0.6 * s, 0.5 * s), bodyMat);
	body.position.y = MECH_BODY_Y * s;
	body.castShadow = true;
	group.add(body);

	head.position.y = 2.4 * s;
	group.add(head);
	const hW = f >= 4 ? 0.4 * s : 0.32 * s;
	const helm2 = new THREE.Mesh(new THREE.BoxGeometry(hW, hW * 0.95, hW * 0.95), bodyMat.clone());
	helm2.castShadow = true;
	head.add(helm2);
	if (f >= 3) {
		const vm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: Math.max(1.5, st.glowInt * 0.55),
			roughness: 0.04
		});
		const vi = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.07 * s, 0.06 * s), vm);
		vi.position.set(0, -0.02 * s, -hW * 0.52);
		head.add(vi);
	}
	if (f >= 6) {
		const gm = new THREE.MeshStandardMaterial({
			color: 0xffdd00,
			emissive: new THREE.Color(0xffcc00),
			emissiveIntensity: 0.7,
			roughness: 0.2,
			metalness: 0.85
		});
		for (const sx of [-1, 1]) {
			const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.36 * s, 0.04 * s), gm.clone());
			fin.position.set(sx * 0.1 * s, 0.3 * s, -hW * 0.42);
			fin.rotation.z = sx * 0.4;
			head.add(fin);
		}
	}
	if (f >= 4) {
		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.24 * s, 4), bodyMat.clone());
		neck.position.y = 2.1 * s;
		group.add(neck);
	}
	if (f >= 4) {
		const hipY = hipAttachHypersuit(s);
		const waistH = 0.18 * s;
		const waist = new THREE.Mesh(new THREE.BoxGeometry(0.58 * s, waistH, 0.44 * s), bodyMat.clone());
		waist.position.y = hipY - waistH / 2;
		group.add(waist);
	}
	if (f >= 5) {
		const wm = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.42, metalness: 0.52 });
		const cp = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.08 * s), wm);
		cp.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.27 * s);
		group.add(cp);
		const ht = new THREE.Mesh(
			new THREE.BoxGeometry(0.18 * s, 0.16 * s, 0.04 * s),
			new THREE.MeshStandardMaterial({
				color: st.accent,
				emissive: new THREE.Color(st.accent),
				emissiveIntensity: 0.9,
				roughness: 0.12
			})
		);
		ht.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.29 * s);
		group.add(ht);
	}

	const aLen = f <= 3 ? 0.4 : f <= 5 ? 0.58 : 0.72;
	const aW = f <= 3 ? 0.14 : 0.18;
	for (const [side, ag] of [
		[-1, leftArm],
		[1, rightArm]
	] as [number, THREE.Group][]) {
		ag.position.set(side * 0.46 * s, MECH_BODY_Y * s, 0);
		group.add(ag);
		const up = new THREE.Mesh(new THREE.BoxGeometry(aW * s, aLen * s, aW * s), bodyMat.clone());
		up.position.y = -(aLen / 2) * s;
		up.castShadow = true;
		ag.add(up);
		if (f >= 5) {
			const sp = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.22 * s, 0.26 * s), accentMat.clone());
			sp.position.y = -0.06 * s;
			ag.add(sp);
		}
		if (f >= 4) {
			const fr = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.26 * s, 0.14 * s), bodyMat.clone());
			fr.position.y = -(aLen + 0.13) * s;
			ag.add(fr);
			if (f >= 5) {
				const fist2 = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.16 * s, 0.2 * s), accentMat.clone());
				fist2.position.set(0, -(aLen + 0.29) * s, -0.02 * s);
				ag.add(fist2);
			}
		}
	}

	if (f >= 3) {
		const lLen = legLenForForm(f);
		const hipY = hipAttachHypersuit(s);
		const thW = 0.23 * s;
		for (const [side, lg] of [
			[-1, leftLeg],
			[1, rightLeg]
		] as [number, THREE.Group][]) {
			lg.position.set(side * 0.18 * s, hipY, 0);
			group.add(lg);
			const th = new THREE.Mesh(new THREE.BoxGeometry(thW, lLen * s, thW), bodyMat.clone());
			th.position.y = -(lLen / 2) * s;
			th.castShadow = true;
			lg.add(th);
			if (f >= 6) {
				const kn = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.15 * s, 0.24 * s), accentMat.clone());
				kn.position.set(0, -(lLen * 0.38) * s, -0.06 * s);
				lg.add(kn);
			}
			if (f >= 5) {
				const ft = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.13 * s, 0.3 * s), bodyMat.clone());
				ft.position.set(0, -(lLen + 0.04) * s, -0.04 * s);
				lg.add(ft);
			}
		}
	} else {
		group.add(leftLeg);
		group.add(rightLeg);
	}

	if (f >= 7) {
		const wm2 = new THREE.MeshStandardMaterial({
			color: st.accent,
			roughness: 0.25,
			metalness: 0.88,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 0.55
		});
		for (const sx of [-1, 1]) {
			for (let wi = 0; wi < 2; wi++) {
				const wing = new THREE.Mesh(
					new THREE.BoxGeometry(0.09 * s, (0.85 - wi * 0.2) * s, (0.55 + wi * 0.1) * s),
					wm2.clone()
				);
				wing.position.set(
					sx * (0.52 + wi * 0.12) * s,
					(MECH_BODY_Y + 0.1 - wi * 0.25) * s,
					(0.22 + wi * 0.08) * s
				);
				wing.rotation.z = sx * (0.32 + wi * 0.18);
				group.add(wing);
			}
		}
	}

	if (f >= 8) {
		const dm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.85 });
		const bm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 2.5,
			roughness: 0.06
		});
		for (const sx of [-1, 1]) {
			const mn = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.14 * s, 0.4 * s), dm.clone());
			mn.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.05 * s);
			group.add(mn);
			const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.5 * s, 4), bm.clone());
			br.rotation.x = -Math.PI / 2;
			br.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.3 * s);
			group.add(br);
		}
	}

	normalizeMechGroupGround(group);
	return {
		group,
		parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: body.position.y }
	};
}

const TRI = 3;
const SMO = 16;

/** ── 아조나스 V: 삼각·원뿔 파이프라인 ─────────────────────────────────────── */
function buildEvolvedAzonas(f: number, s: number): { group: THREE.Group; parts: MechParts3D } {
	const { st, bodyMat, accentMat } = makeMats(f);
	const group = new THREE.Group();
	const head = new THREE.Group();
	const leftArm = new THREE.Group();
	const rightArm = new THREE.Group();
	const leftLeg = new THREE.Group();
	const rightLeg = new THREE.Group();

	if (f === 0) {
		const r = 0.36 * s;
		const torso = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), bodyMat);
		torso.position.y = r;
		torso.castShadow = true;
		group.add(torso);
		[head, leftArm, rightArm, leftLeg, rightLeg].forEach((gch) => group.add(gch));
		return {
			group,
			parts: {
				head,
				body: torso,
				leftArm,
				rightArm,
				leftLeg,
				rightLeg,
				bodyMat,
				accentMat,
				bodyTargetY: torso.position.y
			}
		};
	}

	if (f === 1) {
		const r = 0.4 * s;
		const torso = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), bodyMat);
		torso.position.y = r;
		torso.castShadow = true;
		group.add(torso);
		const hm = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 0.26 * s, TRI), bodyMat.clone());
		hm.position.y = 0.13 * s;
		head.position.y = 0.92 * s;
		head.add(hm);
		group.add(head);
		for (const [side, ag] of [
			[-1, leftArm],
			[1, rightArm]
		] as [number, THREE.Group][]) {
			ag.position.set(side * 0.4 * s, 0.62 * s, 0);
			const c = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.22 * s, TRI), bodyMat.clone());
			c.position.y = -0.11 * s;
			ag.add(c);
			group.add(ag);
		}
		group.add(leftLeg);
		group.add(rightLeg);
		return {
			group,
			parts: {
				head,
				body: torso,
				leftArm,
				rightArm,
				leftLeg,
				rightLeg,
				bodyMat,
				accentMat,
				bodyTargetY: torso.position.y
			}
		};
	}

	// 정팔면체 꼭짓점 (±r,0,0) = 팔 X(±0.44s)
	const r = 0.44 * s;
	const torso = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), bodyMat);
	torso.position.y = MECH_BODY_Y * s;
	torso.castShadow = true;
	group.add(torso);
	const body = torso;

	head.position.y = 2.38 * s;
	group.add(head);
	const hR = f >= 4 ? 0.22 * s : 0.18 * s;
	const helm = new THREE.Mesh(new THREE.ConeGeometry(hR, 0.44 * s, TRI), bodyMat.clone());
	helm.position.y = -0.05 * s;
	head.add(helm);
	if (f >= 3) {
		const vm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: Math.max(1.4, st.glowInt * 0.5),
			roughness: 0.04
		});
		const vi = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.06 * s, TRI), vm);
		vi.rotation.x = Math.PI / 2;
		vi.position.set(0, -0.08 * s, -hR * 0.9);
		head.add(vi);
	}
	if (f >= 6) {
		const gm = new THREE.MeshStandardMaterial({
			color: 0xffdd00,
			emissive: new THREE.Color(0xffcc00),
			emissiveIntensity: 0.75,
			roughness: 0.18,
			metalness: 0.88
		});
		for (const sx of [-1, 1]) {
			const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.34 * s, TRI), gm.clone());
			fin.position.set(sx * 0.12 * s, 0.22 * s, -0.08 * s);
			fin.rotation.z = sx * 0.35;
			head.add(fin);
		}
	}
	if (f >= 4) {
		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.24 * s, TRI), bodyMat.clone());
		neck.position.y = 2.1 * s;
		group.add(neck);
	}
	if (f >= 4) {
		const hipY = hipAttachAzonas(s);
		const waistH = 0.16 * s;
		const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.34 * s, waistH, TRI), bodyMat.clone());
		waist.position.y = hipY - waistH / 2;
		group.add(waist);
	}
	if (f >= 5) {
		const wm = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.38, metalness: 0.55 });
		const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.28 * s, 0.08 * s, TRI), wm);
		cp.rotation.x = Math.PI / 2;
		cp.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.26 * s);
		group.add(cp);
		const ht = new THREE.Mesh(
			new THREE.TetrahedronGeometry(0.12 * s, 0),
			new THREE.MeshStandardMaterial({
				color: st.accent,
				emissive: new THREE.Color(st.accent),
				emissiveIntensity: 0.95,
				roughness: 0.1
			})
		);
		ht.position.set(0, MECH_BODY_Y * s + 0.06 * s, -0.3 * s);
		group.add(ht);
	}

	const aLen = f <= 3 ? 0.4 : f <= 5 ? 0.58 : 0.72;
	const aR = f <= 3 ? 0.09 * s : 0.11 * s;
	for (const [side, ag] of [
		[-1, leftArm],
		[1, rightArm]
	] as [number, THREE.Group][]) {
		ag.position.set(side * 0.44 * s, MECH_BODY_Y * s, 0);
		group.add(ag);
		const up = new THREE.Mesh(new THREE.ConeGeometry(aR, aLen * s, TRI), bodyMat.clone());
		up.position.y = -(aLen / 2) * s;
		up.castShadow = true;
		ag.add(up);
		if (f >= 5) {
			const sp = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16 * s, 0), accentMat.clone());
			sp.position.y = -0.05 * s;
			ag.add(sp);
		}
		if (f >= 4) {
			const fr = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.28 * s, TRI), bodyMat.clone());
			fr.position.y = -(aLen + 0.14) * s;
			ag.add(fr);
			if (f >= 5) {
				const fist2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s, 0), accentMat.clone());
				fist2.position.set(0, -(aLen + 0.3) * s, -0.02 * s);
				ag.add(fist2);
			}
		}
	}

	if (f >= 3) {
		const lLen = legLenForForm(f);
		const hipY = hipAttachAzonas(s);
		const aR = 0.125 * s;
		for (const [side, lg] of [
			[-1, leftLeg],
			[1, rightLeg]
		] as [number, THREE.Group][]) {
			lg.position.set(side * 0.17 * s, hipY, 0);
			group.add(lg);
			const th = new THREE.Mesh(new THREE.ConeGeometry(aR, lLen * s, TRI), bodyMat.clone());
			th.position.y = -(lLen / 2) * s;
			th.castShadow = true;
			lg.add(th);
			if (f >= 6) {
				const kn = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.17 * s, TRI), accentMat.clone());
				kn.position.set(0, -(lLen * 0.38) * s, -0.05 * s);
				lg.add(kn);
			}
			if (f >= 5) {
				const ft = new THREE.Mesh(new THREE.ConeGeometry(0.13 * s, 0.15 * s, TRI), bodyMat.clone());
				ft.position.set(0, -(lLen + 0.04) * s, -0.04 * s);
				ft.rotation.x = Math.PI / 2;
				lg.add(ft);
			}
		}
	} else {
		group.add(leftLeg);
		group.add(rightLeg);
	}

	if (f >= 7) {
		const wm2 = new THREE.MeshStandardMaterial({
			color: st.accent,
			roughness: 0.22,
			metalness: 0.9,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 0.55
		});
		for (const sx of [-1, 1]) {
			for (let wi = 0; wi < 2; wi++) {
				const wing = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, (0.82 - wi * 0.18) * s, TRI), wm2.clone());
				wing.scale.set(1, 1, 0.35);
				wing.position.set(
					sx * (0.5 + wi * 0.14) * s,
					(MECH_BODY_Y + 0.08 - wi * 0.24) * s,
					(0.2 + wi * 0.08) * s
				);
				wing.rotation.z = sx * (0.38 + wi * 0.15);
				wing.rotation.x = 0.2;
				group.add(wing);
			}
		}
	}

	if (f >= 8) {
		const dm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.88 });
		const bm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 2.6,
			roughness: 0.05
		});
		for (const sx of [-1, 1]) {
			const mn = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.36 * s, TRI), dm.clone());
			mn.rotation.z = Math.PI / 2;
			mn.position.set(sx * 0.6 * s, (MECH_BODY_Y + 0.24) * s, -0.04 * s);
			group.add(mn);
			const br = new THREE.Mesh(new THREE.ConeGeometry(0.055 * s, 0.52 * s, TRI), bm.clone());
			br.rotation.x = -Math.PI / 2;
			br.position.set(sx * 0.6 * s, (MECH_BODY_Y + 0.24) * s, -0.32 * s);
			group.add(br);
		}
	}

	normalizeMechGroupGround(group);
	return {
		group,
		parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: body.position.y }
	};
}

/** ── 게렌: 구·타원·부드러운 원통 ─────────────────────────────────────────── */
function buildEvolvedGeren(f: number, s: number): { group: THREE.Group; parts: MechParts3D } {
	const { st, bodyMat, accentMat } = makeMats(f);
	const group = new THREE.Group();
	const head = new THREE.Group();
	const leftArm = new THREE.Group();
	const rightArm = new THREE.Group();
	const leftLeg = new THREE.Group();
	const rightLeg = new THREE.Group();

	if (f === 0) {
		const r = 0.42 * s;
		const sp = new THREE.Mesh(new THREE.SphereGeometry(r, SMO, SMO - 2), bodyMat);
		sp.position.y = r;
		sp.castShadow = true;
		group.add(sp);
		[head, leftArm, rightArm, leftLeg, rightLeg].forEach((g) => group.add(g));
		return {
			group,
			parts: { head, body: sp, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: r }
		};
	}

	if (f === 1) {
		const rB = 0.38 * s;
		const bodyS = new THREE.Mesh(new THREE.SphereGeometry(rB, SMO, SMO - 2), bodyMat);
		bodyS.position.y = rB;
		bodyS.castShadow = true;
		group.add(bodyS);
		const hm = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 12, 10), bodyMat.clone());
		head.position.y = 1.02 * s;
		head.add(hm);
		group.add(head);
		for (const [side, ag] of [
			[-1, leftArm],
			[1, rightArm]
		] as [number, THREE.Group][]) {
			ag.position.set(side * 0.42 * s, 0.62 * s, 0);
			const sph = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 10, 8), bodyMat.clone());
			ag.add(sph);
			group.add(ag);
		}
		group.add(leftLeg);
		group.add(rightLeg);
		return {
			group,
			parts: { head, body: bodyS, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: rB }
		};
	}

	const torso = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, SMO, SMO - 2), bodyMat);
	torso.position.y = MECH_BODY_Y * s;
	torso.scale.set(1.05, 0.88, 0.82);
	torso.castShadow = true;
	group.add(torso);
	const body = torso;

	head.position.y = 2.38 * s;
	group.add(head);
	const hR = f >= 4 ? 0.22 * s : 0.18 * s;
	const helm = new THREE.Mesh(new THREE.SphereGeometry(hR, SMO, SMO - 2), bodyMat.clone());
	helm.scale.set(1, 1.05, 0.92);
	head.add(helm);
	if (f >= 3) {
		const vm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: Math.max(1.5, st.glowInt * 0.52),
			roughness: 0.04
		});
		const vi = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 8), vm);
		vi.scale.set(1.4, 0.35, 0.5);
		vi.position.set(0, -0.04 * s, -hR * 0.85);
		head.add(vi);
	}
	if (f >= 6) {
		const gm = new THREE.MeshStandardMaterial({
			color: 0xffdd00,
			emissive: new THREE.Color(0xffcc00),
			emissiveIntensity: 0.72,
			roughness: 0.2,
			metalness: 0.85
		});
		for (const sx of [-1, 1]) {
			const fin = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 6), gm.clone());
			fin.scale.set(0.5, 1.2, 0.4);
			fin.position.set(sx * 0.14 * s, 0.18 * s, -hR * 0.5);
			head.add(fin);
		}
	}
	if (f >= 4) {
		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 0.24 * s, SMO), bodyMat.clone());
		neck.position.y = 2.1 * s;
		group.add(neck);
	}
	if (f >= 4) {
		const hipY = hipAttachGeren(s);
		const waist = new THREE.Mesh(new THREE.TorusGeometry(0.32 * s, 0.07 * s, 10, SMO), bodyMat.clone());
		waist.rotation.x = Math.PI / 2;
		waist.position.y = hipY - 0.06 * s;
		group.add(waist);
	}
	if (f >= 5) {
		const wm = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.4, metalness: 0.52 });
		const cp = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 14, 12), wm);
		cp.scale.set(1, 1, 0.45);
		cp.position.set(0, MECH_BODY_Y * s + 0.02 * s, -0.24 * s);
		group.add(cp);
		const ht = new THREE.Mesh(
			new THREE.SphereGeometry(0.1 * s, 10, 8),
			new THREE.MeshStandardMaterial({
				color: st.accent,
				emissive: new THREE.Color(st.accent),
				emissiveIntensity: 0.92,
				roughness: 0.12
			})
		);
		ht.position.set(0, MECH_BODY_Y * s + 0.04 * s, -0.32 * s);
		group.add(ht);
	}

	const aLen = f <= 3 ? 0.4 : f <= 5 ? 0.58 : 0.72;
	const aRad = f <= 3 ? 0.09 * s : 0.11 * s;
	for (const [side, ag] of [
		[-1, leftArm],
		[1, rightArm]
	] as [number, THREE.Group][]) {
		ag.position.set(side * 0.45 * s, MECH_BODY_Y * s, 0);
		group.add(ag);
		const up = new THREE.Mesh(new THREE.CylinderGeometry(aRad, aRad * 0.92, aLen * s, SMO), bodyMat.clone());
		up.position.y = -(aLen / 2) * s;
		up.castShadow = true;
		ag.add(up);
		if (f >= 5) {
			const sp = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 12, 10), accentMat.clone());
			sp.position.y = -0.05 * s;
			ag.add(sp);
		}
		if (f >= 4) {
			const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.08 * s, 0.28 * s, SMO), bodyMat.clone());
			fr.position.y = -(aLen + 0.14) * s;
			ag.add(fr);
			if (f >= 5) {
				const fist2 = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 10, 8), accentMat.clone());
				fist2.position.set(0, -(aLen + 0.29) * s, -0.02 * s);
				ag.add(fist2);
			}
		}
	}

	if (f >= 3) {
		const lLen = legLenForForm(f);
		const hipY = hipAttachGeren(s);
		const lr = 0.125 * s;
		const lrLo = 0.115 * s;
		for (const [side, lg] of [
			[-1, leftLeg],
			[1, rightLeg]
		] as [number, THREE.Group][]) {
			lg.position.set(side * 0.18 * s, hipY, 0);
			group.add(lg);
			const th = new THREE.Mesh(new THREE.CylinderGeometry(lr, lrLo, lLen * s, SMO), bodyMat.clone());
			th.position.y = -(lLen / 2) * s;
			th.castShadow = true;
			lg.add(th);
			if (f >= 6) {
				const kn = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 10, 8), accentMat.clone());
				kn.position.set(0, -(lLen * 0.38) * s, -0.05 * s);
				lg.add(kn);
			}
			if (f >= 5) {
				const ft = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 10, 8), bodyMat.clone());
				ft.scale.set(1.12, 0.58, 1.22);
				ft.position.set(0, -(lLen + 0.04) * s, -0.04 * s);
				lg.add(ft);
			}
		}
	} else {
		group.add(leftLeg);
		group.add(rightLeg);
	}

	if (f >= 7) {
		const wm2 = new THREE.MeshStandardMaterial({
			color: st.accent,
			roughness: 0.22,
			metalness: 0.9,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 0.55
		});
		for (const sx of [-1, 1]) {
			for (let wi = 0; wi < 2; wi++) {
				const wing = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 10, 8), wm2.clone());
				wing.scale.set(0.35, 1.1, 0.85);
				wing.position.set(
					sx * (0.52 + wi * 0.12) * s,
					(MECH_BODY_Y + 0.1 - wi * 0.25) * s,
					(0.22 + wi * 0.08) * s
				);
				wing.rotation.z = sx * (0.4 + wi * 0.16);
				group.add(wing);
			}
		}
	}

	if (f >= 8) {
		const dm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.52, metalness: 0.88 });
		const bm = new THREE.MeshStandardMaterial({
			color: st.accent,
			emissive: new THREE.Color(st.accent),
			emissiveIntensity: 2.5,
			roughness: 0.06
		});
		for (const sx of [-1, 1]) {
			const mn = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.1 * s, 0.38 * s, SMO), dm.clone());
			mn.rotation.z = Math.PI / 2;
			mn.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.05 * s);
			group.add(mn);
			const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.055 * s, 0.52 * s, SMO), bm.clone());
			br.rotation.x = -Math.PI / 2;
			br.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.32 * s);
			group.add(br);
			const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 6), bm.clone());
			tip.position.set(sx * 0.62 * s, (MECH_BODY_Y + 0.25) * s, -0.58 * s);
			group.add(tip);
		}
	}

	normalizeMechGroupGround(group);
	return {
		group,
		parts: { head, body, leftArm, rightArm, leftLeg, rightLeg, bodyMat, accentMat, bodyTargetY: body.position.y }
	};
}

export function createEvolvedModel(
	form: number,
	s: number,
	base: MechBase = 'hypersuit'
): { group: THREE.Group; parts: MechParts3D } {
	const f = Math.min(form, 8);
	switch (base) {
		case 'hypersuit':
			return buildEvolvedHypersuit(f, s);
		case 'azonas-v':
			return buildEvolvedAzonas(f, s);
		case 'geren':
			return buildEvolvedGeren(f, s);
		case 'expressive':
			return buildEvolvedHypersuit(f, s);
		case 'soldier':
			return buildEvolvedHypersuit(f, s);
		default:
			return buildEvolvedHypersuit(f, s);
	}
}
