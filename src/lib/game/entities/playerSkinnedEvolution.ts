import * as THREE from 'three';
import type { MechBase } from '$lib/domain/types';
import { formEvolutionEmissive, formStyleColors } from './MechModel';
import { deepDisposePlayerGraph } from './playerSkinned';
import { WING_GLIDE_MIN_FORM } from '../constants/GameConfig';

/** Player.group 직하위 — GLTF와 형제 (링·부스터·날개) */
export const SKINNED_EVO_DECO = 'skinnedEvoDeco';

const RINGS_SUBGROUP = 'skinnedEvoRings';
const BOOST_SUBGROUP = 'skinnedEvoBoosters';
const WING_SUBGROUP = 'skinnedEvoWings';

function evolutionBlendT(form: number, level: number): number {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.min(Math.max(level, 1), 30);
	const tLv = (lv - 1) / 19;
	const tForm = f / 8;
	return Math.min(1, tLv * 0.52 + tForm * 0.48);
}

/** 레벨·Form에 따라 켜지는 링 슬롯 (위치·자세는 휴머노이드 ~2.85m 기준, 전방 -Z) */
const RING_SLOTS: ReadonlyArray<{
	pos: [number, number, number];
	rot: [number, number, number];
	R: number;
	tube: number;
	minForm: number;
	minLevel: number;
}> = [
	{ pos: [0, 1.04, 0], rot: [Math.PI / 2, 0, 0], R: 0.37, tube: 0.011, minForm: 1, minLevel: 2 },
	{ pos: [0, 1.38, -0.05], rot: [Math.PI / 2, 0.12, 0], R: 0.34, tube: 0.01, minForm: 1, minLevel: 4 },
	{ pos: [0, 1.62, 0.02], rot: [Math.PI / 2, -0.08, 0], R: 0.32, tube: 0.009, minForm: 2, minLevel: 5 },
	{ pos: [-0.44, 1.9, 0.02], rot: [0, 0, Math.PI / 2], R: 0.1, tube: 0.007, minForm: 2, minLevel: 6 },
	{ pos: [0.44, 1.9, 0.02], rot: [0, 0, Math.PI / 2], R: 0.1, tube: 0.007, minForm: 2, minLevel: 6 },
	{ pos: [0, 1.78, -0.18], rot: [Math.PI / 2, 0.35, 0], R: 0.22, tube: 0.008, minForm: 3, minLevel: 7 },
	{ pos: [-0.58, 1.28, -0.06], rot: [0.25, 0, Math.PI / 2], R: 0.062, tube: 0.0055, minForm: 3, minLevel: 8 },
	{ pos: [0.58, 1.28, -0.06], rot: [0.25, 0, Math.PI / 2], R: 0.062, tube: 0.0055, minForm: 3, minLevel: 8 },
	{ pos: [-0.2, 0.76, 0.04], rot: [Math.PI / 2, 0, 0.22], R: 0.13, tube: 0.0065, minForm: 4, minLevel: 9 },
	{ pos: [0.2, 0.76, 0.04], rot: [Math.PI / 2, 0, -0.22], R: 0.13, tube: 0.0065, minForm: 4, minLevel: 9 },
	{ pos: [-0.14, 0.14, 0.05], rot: [Math.PI / 2, 0.35, 0], R: 0.075, tube: 0.0045, minForm: 4, minLevel: 11 },
	{ pos: [0.14, 0.14, 0.05], rot: [Math.PI / 2, -0.35, 0], R: 0.075, tube: 0.0045, minForm: 4, minLevel: 11 },
	{ pos: [0, 2.12, -0.08], rot: [Math.PI / 2, 0, 0], R: 0.14, tube: 0.006, minForm: 5, minLevel: 12 },
	{ pos: [0, 2.42, -0.04], rot: [Math.PI / 2, 0.2, 0], R: 0.18, tube: 0.0065, minForm: 5, minLevel: 14 },
	{ pos: [0, 2.72, 0], rot: [Math.PI / 2, 0, 0], R: 0.4, tube: 0.009, minForm: 6, minLevel: 15 },
	{ pos: [0, 0.92, 0.22], rot: [0.85, 0, 0], R: 0.28, tube: 0.007, minForm: 6, minLevel: 16 },
	{ pos: [-0.32, 1.55, 0.12], rot: [0.5, 0.4, 0.5], R: 0.16, tube: 0.006, minForm: 7, minLevel: 17 },
	{ pos: [0.32, 1.55, 0.12], rot: [0.5, -0.4, -0.5], R: 0.16, tube: 0.006, minForm: 7, minLevel: 17 },
	{ pos: [0, 1.22, 0.18], rot: [0.65, 0, 0], R: 0.31, tube: 0.008, minForm: 8, minLevel: 19 }
];

function activeRingSlotIndices(form: number, level: number): number[] {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.max(1, Math.floor(level));
	const idx: number[] = [];
	for (let i = 0; i < RING_SLOTS.length; i++) {
		const s = RING_SLOTS[i];
		if (f >= s.minForm && lv >= s.minLevel) idx.push(i);
	}
	return idx;
}

function boosterCountFor(form: number, level: number): number {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.max(1, Math.floor(level));
	if (f < 2 || lv < 5) return 0;
	let c = 1;
	if (lv >= 9 || f >= 4) c = 2;
	if (lv >= 14 || f >= 6) c = 4;
	if (lv >= 20 && f >= 7) c = 6;
	return c;
}

function wingStageFor(form: number, level: number): 0 | 1 | 2 | 3 {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.max(1, Math.floor(level));
	if (f < 5) return 0;
	if (f < WING_GLIDE_MIN_FORM) return lv >= 9 ? 1 : 0;
	if (f < 8) return 2;
	return lv >= 18 ? 3 : 2;
}

function forEachStandardLikeMaterial(
	obj: THREE.Object3D,
	fn: (mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) => void
): void {
	obj.traverse((o) => {
		if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.SkinnedMesh)) return;
		const raw = o.material;
		const mats = Array.isArray(raw) ? raw : [raw];
		for (const mat of mats) {
			if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
				fn(mat);
			}
		}
	});
}

function forEachPhongLikeMaterial(obj: THREE.Object3D, fn: (mat: THREE.MeshPhongMaterial) => void): void {
	obj.traverse((o) => {
		if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.SkinnedMesh)) return;
		const raw = o.material;
		const mats = Array.isArray(raw) ? raw : [raw];
		for (const mat of mats) {
			if (mat instanceof THREE.MeshPhongMaterial) fn(mat);
		}
	});
}

export function captureSkinnedMaterialBaselines(model: THREE.Object3D): void {
	forEachStandardLikeMaterial(model, (mat) => {
		if (mat.userData._evoBaseCaptured) return;
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity,
			metalness: mat.metalness,
			roughness: mat.roughness
		};
	});
	forEachPhongLikeMaterial(model, (mat) => {
		if (mat.userData._evoBaseCaptured) return;
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoBasePhong = true;
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity
		};
	});
}

export function applySkinnedEvolutionMaterials(
	model: THREE.Object3D,
	form: number,
	level: number
): void {
	const f = Math.min(Math.max(Math.floor(form), 0), 8);
	const t = evolutionBlendT(f, level);
	const { body, accent } = formStyleColors(f);
	const { accentGlow } = formEvolutionEmissive(f);
	const cBody = new THREE.Color(body);
	const cAccent = new THREE.Color(accent);

	forEachStandardLikeMaterial(model, (mat) => {
		if (mat.userData._evoBasePhong) return;
		const base = mat.userData._evoBase as
			| {
					color: THREE.Color;
					emissive: THREE.Color;
					emissiveIntensity: number;
					metalness: number;
					roughness: number;
			  }
			| undefined;
		if (!base) return;

		mat.color.copy(base.color).lerp(cBody, t * 0.55);
		mat.emissive.copy(base.emissive).lerp(cAccent, t * 0.42);
		const targetEmissiveI = Math.min(
			1.15,
			base.emissiveIntensity * (1 - t * 0.35) + (0.06 + t * 0.28 + accentGlow * 0.045) * t
		);
		mat.emissiveIntensity = THREE.MathUtils.lerp(base.emissiveIntensity, targetEmissiveI, t);
		mat.metalness = THREE.MathUtils.lerp(base.metalness, 0.82, t * 0.38);
		mat.roughness = THREE.MathUtils.lerp(base.roughness, 0.36, t * 0.42);
	});
	forEachPhongLikeMaterial(model, (mat) => {
		const base = mat.userData._evoBase as
			| { color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number }
			| undefined;
		if (!base || !mat.userData._evoBasePhong) return;
		mat.color.copy(base.color).lerp(cBody, t * 0.5);
		mat.emissive.copy(base.emissive).lerp(cAccent, t * 0.38);
		const targetEmissiveI = Math.min(
			0.85,
			base.emissiveIntensity * (1 - t * 0.25) + (0.04 + t * 0.22 + accentGlow * 0.04) * t
		);
		mat.emissiveIntensity = THREE.MathUtils.lerp(base.emissiveIntensity, targetEmissiveI, t);
	});
}

function makeRingMaterial(accent: number, opacity: number): THREE.MeshBasicMaterial {
	return new THREE.MeshBasicMaterial({
		color: accent,
		transparent: true,
		opacity,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
}

function buildRingsSubgroup(
	parent: THREE.Group,
	form: number,
	level: number,
	accent: number,
	t: number
): void {
	const g = new THREE.Group();
	g.name = RINGS_SUBGROUP;
	const indices = activeRingSlotIndices(form, level);
	const op = 0.07 + t * 0.22;
	for (let j = 0; j < indices.length; j++) {
		const i = indices[j];
		const s = RING_SLOTS[i];
		const geo = new THREE.TorusGeometry(s.R, s.tube, 7, 40);
		const mat = makeRingMaterial(accent, op + (j % 3) * 0.02);
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
		mesh.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
		mesh.renderOrder = 2;
		g.add(mesh);
	}
	parent.add(g);
}

/** 단일 추진기 — 마운트·하우징·플랜지·노즐·다층 플라즈마 */
function addVolumetricBooster(
	parent: THREE.Group,
	x: number,
	y: number,
	z: number,
	bodyMat: THREE.MeshStandardMaterial,
	glowMat: THREE.MeshBasicMaterial,
	darkMat: THREE.MeshStandardMaterial
): void {
	const pod = new THREE.Group();
	pod.position.set(x, y, z);
	pod.rotation.x = Math.PI / 2 + 0.14;

	const mount = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 0.08), darkMat.clone());
	mount.position.set(0, 0, -0.06);
	mount.castShadow = true;
	pod.add(mount);

	const housingLo = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.1, 12), bodyMat.clone());
	housingLo.position.set(0, 0, 0.02);
	housingLo.castShadow = true;
	pod.add(housingLo);

	const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.076, 0.035, 12), bodyMat.clone());
	flange.position.set(0, 0, 0.1);
	flange.castShadow = true;
	pod.add(flange);

	const housingHi = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.09, 12), bodyMat.clone());
	housingHi.position.set(0, 0, 0.17);
	housingHi.castShadow = true;
	pod.add(housingHi);

	for (const sx of [-1, 1] as const) {
		const strut = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.04), darkMat.clone());
		strut.position.set(sx * 0.07, 0, -0.01);
		strut.rotation.z = sx * 0.25;
		pod.add(strut);
	}

	const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.11, 10), darkMat.clone());
	nozzle.position.set(0, 0, 0.26);
	nozzle.castShadow = true;
	pod.add(nozzle);

	const nozzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 16), bodyMat.clone());
	nozzleRing.position.set(0, 0, 0.3);
	nozzleRing.rotation.x = Math.PI / 2;
	pod.add(nozzleRing);

	const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.028, 0.06, 10), darkMat.clone());
	bell.position.set(0, 0, 0.36);
	pod.add(bell);

	const plumeOuter = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.2, 8), glowMat.clone());
	plumeOuter.position.set(0, 0, 0.48);
	plumeOuter.rotation.x = Math.PI;
	pod.add(plumeOuter);

	const plumeInner = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), glowMat.clone());
	plumeInner.position.set(0, 0, 0.46);
	plumeInner.rotation.x = Math.PI;
	;(plumeInner.material as THREE.MeshBasicMaterial).opacity *= 1.15;
	pod.add(plumeInner);

	const core = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), glowMat.clone());
	core.position.set(0, 0, 0.4);
	pod.add(core);

	const heat = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMat.clone());
	heat.position.set(0, 0, 0.34);
	;(heat.material as THREE.MeshBasicMaterial).opacity *= 0.65;
	pod.add(heat);

	parent.add(pod);
}

function buildBoostersSubgroup(
	parent: THREE.Group,
	form: number,
	level: number,
	accent: number,
	bodyTint: number,
	t: number
): void {
	const count = boosterCountFor(form, level);
	if (count === 0) return;

	const g = new THREE.Group();
	g.name = BOOST_SUBGROUP;
	const bodyCol = new THREE.Color(bodyTint);

	const bodyMat = new THREE.MeshStandardMaterial({
		color: bodyCol,
		metalness: 0.82,
		roughness: 0.28
	});
	const darkMat = new THREE.MeshStandardMaterial({
		color: bodyCol.clone().multiplyScalar(0.45),
		metalness: 0.88,
		roughness: 0.42
	});
	const glowMat = new THREE.MeshBasicMaterial({
		color: accent,
		transparent: true,
		opacity: 0.5 + t * 0.28,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});

	const baseY = 1.48;
	const baseZ = 0.26;
	const spreadX = 0.11;

	for (let i = 0; i < count; i++) {
		const row = Math.floor(i / 2);
		const side = i % 2 === 0 ? -1 : 1;
		const x = side * (spreadX + row * 0.15);
		const y = baseY + row * 0.11;
		const z = baseZ + row * 0.045;
		addVolumetricBooster(g, x, y, z, bodyMat, glowMat, darkMat);
	}

	parent.add(g);
}

function buildWingsSubgroup(
	parent: THREE.Group,
	form: number,
	level: number,
	accent: number,
	bodyTint: number,
	t: number
): void {
	const stage = wingStageFor(form, level);
	if (stage === 0) return;

	const g = new THREE.Group();
	g.name = WING_SUBGROUP;

	const wingMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(bodyTint),
		metalness: 0.82,
		roughness: 0.26,
		emissive: new THREE.Color(accent),
		emissiveIntensity: 0.14 + t * 0.38
	});
	const wingDark = new THREE.MeshStandardMaterial({
		color: new THREE.Color(bodyTint).multiplyScalar(0.55),
		metalness: 0.8,
		roughness: 0.38
	});
	const edgeMat = new THREE.MeshBasicMaterial({
		color: accent,
		transparent: true,
		opacity: 0.32 + t * 0.32,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});

	const spanL = stage === 1 ? 0.42 : stage === 2 ? 0.62 : 0.78;
	const spanH = stage === 1 ? 0.22 : stage === 2 ? 0.32 : 0.4;
	const baseY = 1.62;
	const pivotZ = 0.14;
	const wMain = Math.abs(spanL);
	const thick = stage >= 2 ? 0.095 : 0.072;

	for (const side of [-1, 1] as const) {
		const wing = new THREE.Group();
		wing.position.set(side * 0.22, baseY, pivotZ);
		const rz = side * (stage >= 2 ? 0.38 : 0.28);
		const ry = side * 0.12;

		const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, wMain * 0.95, 8), wingDark.clone());
		spar.position.set(side * wMain * 0.46, 0.05, -0.06);
		spar.rotation.z = Math.PI / 2 + rz;
		spar.rotation.y = ry;
		spar.castShadow = true;
		wing.add(spar);

		const mainUpper = new THREE.Mesh(
			new THREE.BoxGeometry(wMain, spanH * 0.32, thick * 0.45),
			wingMat.clone()
		);
		mainUpper.position.set(side * wMain * 0.45, 0.1, -0.05);
		mainUpper.rotation.z = rz;
		mainUpper.rotation.y = ry;
		mainUpper.castShadow = true;
		wing.add(mainUpper);

		const mainLower = new THREE.Mesh(
			new THREE.BoxGeometry(wMain * 0.96, spanH * 0.26, thick * 0.5),
			wingMat.clone()
		);
		mainLower.position.set(side * wMain * 0.44, -0.02, -0.12);
		mainLower.rotation.z = rz + side * 0.06;
		mainLower.rotation.y = ry;
		mainLower.castShadow = true;
		wing.add(mainLower);

		const edge = new THREE.Mesh(
			new THREE.BoxGeometry(wMain * 0.94, 0.028, thick * 0.55),
			edgeMat.clone()
		);
		edge.position.set(side * wMain * 0.45, 0.12, -0.05);
		edge.rotation.z = rz;
		edge.rotation.y = ry;
		wing.add(edge);

		const rootFair = new THREE.Mesh(new THREE.BoxGeometry(0.12, spanH * 0.45, thick * 1.1), wingDark.clone());
		rootFair.position.set(side * 0.06, 0, -0.02);
		rootFair.rotation.y = ry;
		wing.add(rootFair);

		if (stage >= 2) {
			const inner = new THREE.Mesh(
				new THREE.BoxGeometry(wMain * 0.52, spanH * 0.2, thick * 0.4),
				wingMat.clone()
			);
			inner.position.set(side * wMain * 0.3, -0.1, -0.18);
			inner.rotation.z = rz + side * 0.18;
			inner.rotation.y = ry;
			inner.castShadow = true;
			wing.add(inner);

			const ribN = stage >= 3 ? 4 : 2;
			for (let r = 0; r < ribN; r++) {
				const u = (r + 1) / (ribN + 1);
				const rib = new THREE.Mesh(
					new THREE.BoxGeometry(0.04, spanH * 0.38, thick * 0.65),
					wingDark.clone()
				);
				rib.position.set(side * wMain * u * 0.85, 0.02, -0.08 - u * 0.04);
				rib.rotation.z = rz;
				rib.rotation.y = ry;
				wing.add(rib);
			}
		}

		if (stage >= 3) {
			const tipJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 8), wingMat.clone());
			tipJoint.position.set(side * wMain * 0.82, 0.02, -0.09);
			tipJoint.rotation.z = rz;
			tipJoint.rotation.y = ry;
			wing.add(tipJoint);

			const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 6), wingMat.clone());
			tip.position.set(side * wMain * 0.94, 0.02, -0.11);
			tip.rotation.z = side * Math.PI / 2 + rz * 0.3;
			tip.rotation.x = 0.35;
			tip.castShadow = true;
			wing.add(tip);

			const tipGlow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), edgeMat.clone());
			tipGlow.position.copy(tip.position);
			tipGlow.rotation.copy(tip.rotation);
			tipGlow.position.z -= 0.02;
			wing.add(tipGlow);
		}

		g.add(wing);
	}

	parent.add(g);
}

function clearDecoChildren(deco: THREE.Group): void {
	const ch = [...deco.children];
	for (const c of ch) {
		deco.remove(c);
		deepDisposePlayerGraph(c);
	}
}

function rebuildSkinnedDecoAttachments(root: THREE.Group, form: number, level: number): void {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.max(1, Math.floor(level));
	const t = evolutionBlendT(f, lv);
	const { accent, body } = formStyleColors(f);

	let deco = root.getObjectByName(SKINNED_EVO_DECO) as THREE.Group | null;
	if (!deco) {
		deco = new THREE.Group();
		deco.name = SKINNED_EVO_DECO;
		root.add(deco);
	} else {
		clearDecoChildren(deco);
	}

	buildRingsSubgroup(deco, f, lv, accent, t);
	buildBoostersSubgroup(deco, f, lv, accent, body, t);
	buildWingsSubgroup(deco, f, lv, accent, body, t);

	root.userData._skinnedDecoSig = `${f}:${lv}`;
}

export function removeSkinnedEvolutionDeco(root: THREE.Object3D): void {
	const prev = root.getObjectByName(SKINNED_EVO_DECO);
	if (!prev) return;
	root.remove(prev);
	deepDisposePlayerGraph(prev);
}

/**
 * 스키닝 캐릭터: 재질 그레이딩 + 링(개수 증가) · 백 부스터 · 날개(단계).
 */
export function updateSkinnedPlayerEvolution(
	root: THREE.Group,
	form: number,
	_mechBase: MechBase,
	level: number
): void {
	const model = root.getObjectByName('skinnedGltfModel');
	if (!model) return;

	captureSkinnedMaterialBaselines(model);
	applySkinnedEvolutionMaterials(model, form, level);

	const f = Math.min(Math.max(Math.floor(form), 0), 8);
	const lv = Math.max(1, Math.floor(level));
	const sig = `${f}:${lv}`;
	if (root.userData._skinnedDecoSig !== sig) {
		rebuildSkinnedDecoAttachments(root, f, lv);
	}

	const deco = root.getObjectByName(SKINNED_EVO_DECO) as THREE.Group | undefined;
	if (deco) deco.scale.setScalar(1 + (lv - 1) * 0.0028 + f * 0.0035);
}
