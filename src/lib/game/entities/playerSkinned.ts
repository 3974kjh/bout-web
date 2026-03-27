import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MechParts3D } from './MechModel';

export type SkinnedGltfLoadOptions = {
	/** 기본 π — 게임 전방 -Z에 맞춤 */
	modelRotationY?: number;
	/** 월드 기준 목표 키(발~머리) */
	targetHeight?: number;
};

export type SkinnedPlayerPayload = {
	root: THREE.Group;
	mixer: THREE.AnimationMixer;
	actions: Record<string, THREE.AnimationAction>;
	parts: MechParts3D;
	bodyTargetY: number;
	dispose: () => void;
};

export function deepDisposePlayerGraph(root: THREE.Object3D): void {
	root.traverse((c) => {
		if (c instanceof THREE.Mesh || c instanceof THREE.SkinnedMesh) {
			c.geometry?.dispose();
			const m = c.material;
			if (Array.isArray(m)) m.forEach((x) => x.dispose());
			else m?.dispose();
		}
	});
}

/** GLTF Phong → HUD용 Standard 변환 (Soldier.glb 등) */
function phongMaterialToStandard(phong: THREE.Material): THREE.MeshStandardMaterial {
	const p = phong as THREE.MeshPhongMaterial;
	return new THREE.MeshStandardMaterial({
		color: p.color.clone(),
		map: p.map,
		normalMap: p.normalMap,
		roughness: 0.55,
		metalness: 0.35,
		emissive: p.emissive.clone(),
		emissiveMap: p.emissiveMap,
		emissiveIntensity: p.emissiveIntensity
	});
}

function firstStandardMaterial(root: THREE.Object3D): THREE.MeshStandardMaterial {
	let foundStd: THREE.MeshStandardMaterial | null = null;
	let foundPhong: THREE.Material | null = null;
	root.traverse((o) => {
		if (foundStd) return;
		if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.SkinnedMesh)) return;
		const raw = o.material;
		const mats = Array.isArray(raw) ? raw : [raw];
		for (const m of mats) {
			if (m instanceof THREE.MeshStandardMaterial) {
				foundStd = m;
				return;
			}
			if (m.type === 'MeshPhongMaterial' && !foundPhong) foundPhong = m;
		}
	});
	if (foundStd) return foundStd;
	if (foundPhong) return phongMaterialToStandard(foundPhong);
	return new THREE.MeshStandardMaterial({ color: 0x8899aa });
}

export function pickSkinnedAction(
	actions: Record<string, THREE.AnimationAction>,
	candidates: string[]
): THREE.AnimationAction | null {
	for (const name of candidates) {
		if (actions[name]) return actions[name];
		const hit = Object.keys(actions).find((k) => k.toLowerCase() === name.toLowerCase());
		if (hit) return actions[hit];
	}
	return null;
}

/** 클립 이름 부분 일치 (Mixamo / three.js 예제 Soldier 등) */
export function pickSkinnedActionBySubstring(
	actions: Record<string, THREE.AnimationAction>,
	substrings: string[]
): THREE.AnimationAction | null {
	const keys = Object.keys(actions);
	for (const sub of substrings) {
		const low = sub.toLowerCase();
		const hit = keys.find((k) => k.toLowerCase().includes(low));
		if (hit) return actions[hit];
	}
	return null;
}

export function pickSkinnedClip(
	actions: Record<string, THREE.AnimationAction>,
	exact: string[],
	fuzzy: string[]
): THREE.AnimationAction | null {
	return pickSkinnedAction(actions, exact) ?? pickSkinnedActionBySubstring(actions, fuzzy);
}

/** 걷기→대기는 짧게, 나머지는 부드럽게 */
export function skinnedFadeCrossDuration(
	prev: THREE.AnimationAction | null,
	next: THREE.AnimationAction | null
): number {
	if (!prev || !next) return 0.16;
	const pn = prev.getClip().name.toLowerCase();
	const nn = next.getClip().name.toLowerCase();
	const prevLoco = /walk|run|jog/.test(pn);
	const nextLoco = /walk|run|jog/.test(nn);
	const nextIdle = /idle|stand|tpose/.test(nn) || nn.includes('idle');
	const prevIdle = /idle|stand|tpose/.test(pn) || pn.includes('idle');
	if (prevLoco && nextIdle) return 0.06;
	if (prevIdle && nextLoco) return 0.14;
	if (prevLoco && nextLoco) return 0.14;
	return 0.2;
}

/**
 * GLTF에 점프 클립이 없을 때 Idle을 복제해 `jump` 클립을 만든다.
 * 척추·가슴 뒤로, 무릎 접기, **양팔은 뒤가 아니라 위로(만세 느낌)**.
 */
function appendSyntheticJumpClipIfMissing(
	animations: THREE.AnimationClip[],
	mixer: THREE.AnimationMixer,
	actions: Record<string, THREE.AnimationAction>
): void {
	if (animations.some((c) => /jump|fall|air/i.test(c.name))) return;
	const idleClip =
		animations.find((c) => /idle|stand|tpose/i.test(c.name)) ?? animations[0];
	if (!idleClip) return;

	const jumpClip = idleClip.clone();
	jumpClip.name = 'jump';
	const axisX = new THREE.Vector3(1, 0, 0);
	const axisY = new THREE.Vector3(0, 1, 0);
	const axisZ = new THREE.Vector3(0, 0, 1);

	/**
	 * 로컬 X 피치 × sin(πt). 척추 음의 X = 상체 뒤로, 무릎 양의 X = 굽힘,
	 * 팔·어깨는 **음의 X**로 어깨 굽혀 위로 듦(만세 — 앞으로 꺾이면 부호 반전).
	 */
	function jumpPitchScaleForBone(trackName: string): number {
		const tn = trackName.toLowerCase();
		if (tn.includes('hips')) return 0;
		if (tn.includes('spine') || tn.includes('chest')) return -0.2;
		if (tn.includes('neck')) return -0.06;
		if (tn.includes('head')) return -0.04;
		if (tn.includes('upleg') || tn.includes('thigh')) return 0;
		// 팔: 만세 — 어깨·상완·전완 (forearm 먼저 분기)
		if (tn.includes('shoulder') && !tn.includes('blade')) return -0.52;
		if (tn.includes('forearm')) return -0.32;
		if ((tn.includes('leftarm') || tn.includes('rightarm')) && !tn.includes('fore')) return -1.02;
		// 정강이(무릎) — 더 깊게 접음
		if ((tn.includes('leftleg') || tn.includes('rightleg')) && !tn.includes('upleg')) return 1.05;
		if (tn.includes('calf') || tn.includes('shin')) return 0.3;
		if (tn.includes('foot') && !tn.includes('football')) return -0.14;
		return 0;
	}

	/** 로컬 Z 롤 × sin(πt) — 양팔을 머리 쪽으로 모아 만세 실루엣 */
	function jumpArmRollZForBone(trackName: string): number {
		const tn = trackName.toLowerCase();
		if (tn.includes('forearm')) return tn.includes('left') ? 0.18 : -0.18;
		if ((tn.includes('leftarm') || tn.includes('rightarm')) && !tn.includes('fore')) {
			return tn.includes('left') ? 0.42 : -0.42;
		}
		if (tn.includes('shoulder') && !tn.includes('blade')) {
			return tn.includes('left') ? 0.22 : -0.22;
		}
		return 0;
	}

	/** 로컬 Y 요 × sin(πt) — 허벅지~발까지 내전해 나란히 선 자세에 가깝게 */
	function jumpYawAdductionForBone(trackName: string): number {
		const tn = trackName.toLowerCase();
		if (tn.includes('leftupleg')) return 0.48;
		if (tn.includes('rightupleg')) return -0.48;
		if ((tn.includes('leftleg') || tn.includes('rightleg')) && !tn.includes('upleg')) {
			return tn.includes('left') ? 0.18 : -0.18;
		}
		if (tn.includes('calf') || tn.includes('shin')) {
			return tn.includes('left') ? 0.1 : -0.1;
		}
		if (tn.includes('leftfoot')) return 0.12;
		if (tn.includes('rightfoot')) return -0.12;
		if (tn.includes('foot') && !tn.includes('football')) {
			if (tn.includes('left')) return 0.1;
			if (tn.includes('right')) return -0.1;
		}
		return 0;
	}

	for (const track of jumpClip.tracks) {
		if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
		const scale = jumpPitchScaleForBone(track.name);
		const yawLeg = jumpYawAdductionForBone(track.name);
		const rollZ = jumpArmRollZForBone(track.name);
		if (scale === 0 && yawLeg === 0 && rollZ === 0) continue;
		const vals = track.values;
		const nK = vals.length / 4;
		for (let k = 0; k < nK; k++) {
			const q = new THREE.Quaternion(vals[k * 4], vals[k * 4 + 1], vals[k * 4 + 2], vals[k * 4 + 3]);
			const t = nK <= 1 ? 1 : k / (nK - 1);
			const env = Math.sin(t * Math.PI);
			if (scale !== 0) {
				const pitch = scale * env;
				q.multiply(new THREE.Quaternion().setFromAxisAngle(axisX, pitch));
			}
			if (yawLeg !== 0) {
				const yaw = yawLeg * env;
				q.multiply(new THREE.Quaternion().setFromAxisAngle(axisY, yaw));
			}
			if (rollZ !== 0) {
				const rz = rollZ * env;
				q.multiply(new THREE.Quaternion().setFromAxisAngle(axisZ, rz));
			}
			q.toArray(vals, k * 4);
		}
	}
	jumpClip.resetDuration();

	const action = mixer.clipAction(jumpClip);
	action.setLoop(THREE.LoopOnce, 1);
	action.clampWhenFinished = true;
	actions[jumpClip.name] = action;
}

export function loadSkinnedPlayerGltf(
	url: string,
	options?: SkinnedGltfLoadOptions
): Promise<SkinnedPlayerPayload> {
	const rotY = options?.modelRotationY ?? Math.PI;
	const targetH = options?.targetHeight ?? 2.85;

	const loader = new GLTFLoader();
	return new Promise((resolve, reject) => {
		loader.load(
			url,
			(gltf) => {
				const model = gltf.scene;
				model.name = 'skinnedGltfModel';
				model.rotation.y = rotY;
				model.updateMatrixWorld(true);
				const box = new THREE.Box3().setFromObject(model);
				model.position.y -= box.min.y;
				model.updateMatrixWorld(true);
				const box2 = new THREE.Box3().setFromObject(model);
				const h = Math.max(0.01, box2.max.y - box2.min.y);
				model.scale.setScalar(targetH / h);

				const root = new THREE.Group();
				root.add(model);
				model.traverse((o) => {
					if (o instanceof THREE.Mesh || o instanceof THREE.SkinnedMesh) {
						o.castShadow = true;
						o.frustumCulled = false;
					}
				});
				root.updateMatrixWorld(true);
				const box3 = new THREE.Box3().setFromObject(root);
				const bodyTargetY = Math.min(box3.max.y * 0.62, box3.max.y - 0.15);

				const mixer = new THREE.AnimationMixer(model);
				const actions: Record<string, THREE.AnimationAction> = {};
				for (const clip of gltf.animations) {
					actions[clip.name] = mixer.clipAction(clip);
				}
				appendSyntheticJumpClipIfMissing(gltf.animations, mixer, actions);
				for (const a of Object.values(actions)) a.stop();

				const idle =
					pickSkinnedClip(actions, ['Idle', 'Standing', 'idle'], ['idle', 'stand', 'tpose']) ??
					Object.values(actions)[0];
				if (idle) idle.reset().setEffectiveWeight(1).play();

				const bodyMat = firstStandardMaterial(root);
				const accentMat = bodyMat.clone();
				const dummy = new THREE.Object3D();
				const parts: MechParts3D = {
					head: dummy,
					body: dummy,
					leftArm: dummy,
					rightArm: dummy,
					leftLeg: dummy,
					rightLeg: dummy,
					bodyMat,
					accentMat,
					bodyTargetY
				};

				const dispose = (): void => {
					mixer.stopAllAction();
					deepDisposePlayerGraph(root);
				};

				resolve({ root, mixer, actions, parts, bodyTargetY, dispose });
			},
			undefined,
			(err) => reject(err instanceof Error ? err : new Error(String(err)))
		);
	});
}

export async function loadSkinnedPlayerWithFallback(
	urls: string[],
	options?: SkinnedGltfLoadOptions
): Promise<SkinnedPlayerPayload> {
	let lastErr: Error | null = null;
	for (const url of urls) {
		try {
			return await loadSkinnedPlayerGltf(url, options);
		} catch (e) {
			lastErr = e instanceof Error ? e : new Error(String(e));
		}
	}
	throw lastErr ?? new Error('GLTF load failed');
}

export function fadeSkinnedBaseClip(
	prev: THREE.AnimationAction | null,
	next: THREE.AnimationAction | null,
	duration: number
): void {
	if (prev && prev !== next) prev.fadeOut(duration);
	if (next) next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
}
