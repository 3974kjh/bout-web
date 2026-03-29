import * as THREE from 'three';
import type { MechBase } from '$lib/domain/types';
import { formEvolutionEmissive, formStyleColors } from './MechModel';
import { deepDisposePlayerGraph } from './playerSkinned';

/** 과거 버전이 붙인 장식 루트 — 제거 전용 */
const SKINNED_EVO_DECO = 'skinnedEvoDeco';

type EvoMatKind = 'pbr' | 'phong' | 'lambert' | 'toon' | 'basic';

type EvoDiffuseBase = { color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number };

/** 기존: 레벨·폼을 함께 섞음 — 보수적 */
function evolutionBlendT(form: number, level: number): number {
	const f = Math.min(Math.max(form, 0), 8);
	const lv = Math.min(Math.max(level, 1), 30);
	const tLv = (lv - 1) / 19;
	const tForm = f / 8;
	return Math.min(1, tLv * 0.52 + tForm * 0.48);
}

/**
 * cyberpunk / neon GLB: **F 단계가 거의 전부** 보이도록(0→8에서 색이 확 튀게).
 * 레벨은 소량만 가산.
 */
function paintStrengthForMech(form: number, level: number, mechBase?: MechBase): number {
	const f = Math.min(Math.max(Math.floor(form), 0), 8);
	const lv = Math.min(Math.max(level, 1), 30);
	const humanGlb = mechBase === 'cyberpunk-human' || mechBase === 'neon-human';
	if (humanGlb) {
		const tForm = f / 8;
		const tLv = ((lv - 1) / 29) * 0.1;
		return Math.min(1, tForm * 0.97 + tLv);
	}
	return evolutionBlendT(f, lv);
}

function forEachMeshMaterial(
	obj: THREE.Object3D,
	fn: (mat: THREE.Material) => void
): void {
	obj.traverse((o) => {
		if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.SkinnedMesh)) return;
		const raw = o.material;
		const mats = Array.isArray(raw) ? raw : [raw];
		for (const mat of mats) {
			if (mat) fn(mat);
		}
	});
}

function classifyAndCaptureBaseline(mat: THREE.Material): void {
	if (mat.userData._evoBaseCaptured) return;

	if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'pbr' satisfies EvoMatKind;
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity,
			metalness: mat.metalness,
			roughness: mat.roughness
		};
		return;
	}
	if (mat instanceof THREE.MeshPhongMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'phong';
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity
		};
		return;
	}
	if (mat instanceof THREE.MeshLambertMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'lambert';
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity
		};
		return;
	}
	if (mat instanceof THREE.MeshToonMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'toon';
		mat.userData._evoBase = {
			color: mat.color.clone(),
			emissive: mat.emissive.clone(),
			emissiveIntensity: mat.emissiveIntensity
		};
		return;
	}
	if (mat instanceof THREE.MeshBasicMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'basic';
		mat.userData._evoBase = {
			color: mat.color.clone()
		};
		return;
	}
	if (mat instanceof THREE.MeshMatcapMaterial) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'basic';
		mat.userData._evoBase = { color: mat.color.clone() };
		return;
	}
	/** 알 수 없는 재질이라도 `color`가 있으면 Form 틴트 (커스텀/확장 glTF) */
	const mc = (mat as { color?: unknown }).color;
	if (mc instanceof THREE.Color) {
		mat.userData._evoBaseCaptured = true;
		mat.userData._evoMatKind = 'basic';
		mat.userData._evoBase = { color: mc.clone() };
	}
}

export function captureSkinnedMaterialBaselines(model: THREE.Object3D): void {
	forEachMeshMaterial(model, classifyAndCaptureBaseline);
}

function applyDiffuseLike(
	mat: THREE.MeshPhongMaterial | THREE.MeshLambertMaterial | THREE.MeshToonMaterial,
	base: EvoDiffuseBase,
	tPaint: number,
	cBody: THREE.Color,
	cAccent: THREE.Color,
	accentGlow: number,
	humanGlb: boolean
): void {
	const coat = cBody.clone().lerp(cAccent, humanGlb ? 0.45 : 0.35);
	const kColor = humanGlb ? 0.94 : 0.5;
	const kEmi = humanGlb ? 0.88 : 0.4;
	mat.color.copy(base.color).lerp(coat, tPaint * kColor);
	mat.emissive.copy(base.emissive).lerp(cAccent, tPaint * kEmi);
	const emiTarget = Math.min(
		humanGlb ? 1.4 : 0.95,
		base.emissiveIntensity * (1 - tPaint * (humanGlb ? 0.35 : 0.22)) +
			(humanGlb ? 0.22 : 0.05) +
			tPaint * (humanGlb ? 0.55 : 0.24) +
			accentGlow * (humanGlb ? 0.08 : 0.045) * tPaint
	);
	mat.emissiveIntensity = THREE.MathUtils.lerp(base.emissiveIntensity, emiTarget, tPaint);
}

export function applySkinnedEvolutionMaterials(
	model: THREE.Object3D,
	form: number,
	level: number,
	mechBase?: MechBase
): void {
	const f = Math.min(Math.max(Math.floor(form), 0), 8);
	const tPaint = paintStrengthForMech(f, level, mechBase);
	const { body, accent } = formStyleColors(f);
	const { accentGlow } = formEvolutionEmissive(f);
	const cBody = new THREE.Color(body);
	const cAccent = new THREE.Color(accent);
	const humanGlb = mechBase === 'cyberpunk-human' || mechBase === 'neon-human';

	const coat = cBody.clone().lerp(cAccent, humanGlb ? 0.42 : 0.32);
	const tSoft = evolutionBlendT(f, level);
	const kPbrColor = humanGlb ? 0.92 : 0.55;
	const kPbrEmi = humanGlb ? 0.82 : 0.42;

	forEachMeshMaterial(model, (mat) => {
		const kind = mat.userData._evoMatKind as EvoMatKind | undefined;
		const base = mat.userData._evoBase as Record<string, unknown> | undefined;
		if (!kind || !base) return;

		if (kind === 'pbr' && (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial)) {
			const b = base as {
				color: THREE.Color;
				emissive: THREE.Color;
				emissiveIntensity: number;
				metalness: number;
				roughness: number;
			};
			const tp = humanGlb ? tPaint : tSoft;
			mat.color.copy(b.color).lerp(coat, tp * kPbrColor);
			mat.emissive.copy(b.emissive).lerp(cAccent, tp * kPbrEmi);
			const targetEmissiveI = Math.min(
				humanGlb ? 1.55 : 1.15,
				b.emissiveIntensity * (1 - tp * (humanGlb ? 0.4 : 0.35)) +
					(humanGlb ? 0.12 + tp * 0.5 : 0) +
					(humanGlb ? accentGlow * 0.09 : accentGlow * 0.045) * tp
			);
			mat.emissiveIntensity = THREE.MathUtils.lerp(b.emissiveIntensity, targetEmissiveI, tp);
			mat.metalness = THREE.MathUtils.lerp(b.metalness, humanGlb ? 0.78 : 0.82, tp * (humanGlb ? 0.45 : 0.38));
			mat.roughness = THREE.MathUtils.lerp(b.roughness, humanGlb ? 0.42 : 0.36, tp * (humanGlb ? 0.4 : 0.42));
			return;
		}

		if (kind === 'phong' && mat instanceof THREE.MeshPhongMaterial) {
			applyDiffuseLike(mat, base as EvoDiffuseBase, humanGlb ? tPaint : tSoft, cBody, cAccent, accentGlow, humanGlb);
			return;
		}
		if (kind === 'lambert' && mat instanceof THREE.MeshLambertMaterial) {
			applyDiffuseLike(mat, base as EvoDiffuseBase, humanGlb ? tPaint : tSoft, cBody, cAccent, accentGlow, humanGlb);
			return;
		}
		if (kind === 'toon' && mat instanceof THREE.MeshToonMaterial) {
			applyDiffuseLike(mat, base as EvoDiffuseBase, humanGlb ? tPaint : tSoft, cBody, cAccent, accentGlow, humanGlb);
			return;
		}

		if (kind === 'basic') {
			const b = base as { color: THREE.Color };
			const tp = humanGlb ? tPaint : tSoft;
			const kMain = humanGlb ? 0.96 : 0.58;
			const kMatcap = humanGlb ? 0.9 : 0.5;
			if (mat instanceof THREE.MeshBasicMaterial) {
				mat.color.copy(b.color).lerp(coat, tp * kMain);
			} else if (mat instanceof THREE.MeshMatcapMaterial) {
				mat.color.copy(b.color).lerp(coat, tp * kMatcap);
			} else {
				const col = (mat as { color?: THREE.Color }).color;
				if (col instanceof THREE.Color) col.copy(b.color).lerp(coat, tp * kMain);
			}
		}
	});
}

export function removeSkinnedEvolutionDeco(root: THREE.Object3D): void {
	const prev = root.getObjectByName(SKINNED_EVO_DECO);
	if (!prev) return;
	root.remove(prev);
	deepDisposePlayerGraph(prev);
}

/**
 * 스키닝 GLTF: Form·레벨에 따른 재질 보정.
 * cyberpunk / neon 은 F 단계 비중을 높여 색 변화가 확실히 보이게 한다.
 */
export function updateSkinnedPlayerEvolution(
	root: THREE.Group,
	form: number,
	mechBase: MechBase,
	level: number
): void {
	removeSkinnedEvolutionDeco(root);
	delete root.userData._skinnedDecoSig;

	const model = root.getObjectByName('skinnedGltfModel');
	if (!model) return;

	captureSkinnedMaterialBaselines(model);
	applySkinnedEvolutionMaterials(model, form, level, mechBase);
}
