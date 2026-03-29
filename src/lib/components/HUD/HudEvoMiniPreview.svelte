<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { MechBase } from '$lib/domain/types';
	import { createEvolvedModel, formForLevel } from '$lib/game/entities/MechModel';
	import { applyMechBaseTint } from '$lib/game/entities/mechShopTint';
	import {
		playerGltfUrlListForBase,
		skinnedGltfLoadOptionsForBase,
		playerUsesSkinnedGltfForBase
	} from '$lib/game/constants/GameConfig';
	import {
		loadSkinnedPlayerWithFallback,
		pickSkinnedClip
	} from '$lib/game/entities/playerSkinned';
	import { updateSkinnedPlayerEvolution } from '$lib/game/entities/playerSkinnedEvolution';

	type Props = { mechBase: MechBase; level: number };
	let { mechBase, level }: Props = $props();

	let host: HTMLDivElement | undefined = $state();
	let loadComplete = $state(false);

	const form = $derived(formForLevel(level));

	const MODEL_SCALE_DEFAULT = 0.92;
	/** 익스프레시브·솔저 GLTF는 동일 스케일에서 상대적으로 큼 → HUD에서만 약간 축소 */
	function hudModelScaleFor(mb: MechBase): number {
		return playerUsesSkinnedGltfForBase(mb) ? MODEL_SCALE_DEFAULT * 0.78 : MODEL_SCALE_DEFAULT;
	}
	/** HUD: 카메라(+Z) 반대 방향을 바라보도록 Y 회전 (기존 정면 보정 0.08을 180° 뒤집음) */
	const FACE_Y = Math.PI + 0.08;

	/**
	 * 미니 프리뷰 카메라 — 절차 메쉬(하이퍼슈트 등)와 GLTF 스키닝(익스프레시브/솔저) 바운딩이 달라 분리.
	 * `forSkinned === false`: 절차 메쉬 기준(기존 값).
	 * GLTF 로드 실패 후 절차 폴백 시에는 반드시 `forSkinned: false`로 다시 호출.
	 */
	function setHudEvoCameraView(camera: THREE.PerspectiveCamera, forSkinned: boolean): void {
		if (forSkinned) {
			camera.position.set(0, 1.52, 3.65);
			camera.lookAt(0, 1.28, 0);
		} else {
			camera.position.set(0, 1.72, 4.55);
			camera.lookAt(0, 1.68, 0);
		}
	}

	const ctx: {
		scene: THREE.Scene | null;
		kind: 'none' | 'skinned' | 'procedural';
		root: THREE.Object3D | null;
		proceduralRoot: THREE.Group | null;
		disposeSkinned: (() => void) | null;
		mixer: THREE.AnimationMixer | null;
	} = {
		scene: null,
		kind: 'none',
		root: null,
		proceduralRoot: null,
		disposeSkinned: null,
		mixer: null
	};

	function disposeProceduralTree(root: THREE.Object3D): void {
		root.traverse((o) => {
			if (o instanceof THREE.Mesh) {
				o.geometry?.dispose();
				const mat = o.material;
				if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
				else mat?.dispose();
			}
		});
	}

	function applyProcedural(formIdx: number, mb: MechBase, scene: THREE.Scene): void {
		if (ctx.proceduralRoot) {
			scene.remove(ctx.proceduralRoot);
			disposeProceduralTree(ctx.proceduralRoot);
			ctx.proceduralRoot = null;
		}
		const { group } = createEvolvedModel(formIdx, hudModelScaleFor(mb), mb);
		applyMechBaseTint(group, mb);
		group.rotation.y = FACE_Y;
		scene.add(group);
		ctx.proceduralRoot = group;
		ctx.root = group;
		ctx.kind = 'procedural';
	}

	function syncVisual(f: number, lv: number, mb: MechBase): void {
		if (!ctx.scene) return;
		if (ctx.kind === 'skinned' && ctx.root) {
			updateSkinnedPlayerEvolution(ctx.root as THREE.Group, f, mb, lv);
			ctx.root.rotation.y = FACE_Y;
			ctx.root.scale.setScalar(hudModelScaleFor(mb));
			return;
		}
		if (ctx.kind === 'procedural') {
			applyProcedural(f, mb, ctx.scene);
		}
	}

	$effect(() => {
		const f = form;
		const lv = level;
		const mb = mechBase;
		if (!loadComplete) return;
		syncVisual(f, lv, mb);
	});

	onMount(() => {
		if (!host) return;

		let alive = true;
		const clock = new THREE.Clock();
		const scene = new THREE.Scene();
		ctx.scene = scene;
		scene.background = new THREE.Color(0x050a14);

		const w = host.clientWidth || 88;
		const h = host.clientHeight || 110;
		const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 60);
		const mbPreview = mechBase;
		setHudEvoCameraView(camera, playerUsesSkinnedGltfForBase(mbPreview));

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(renderer.domElement);

		const hemi = new THREE.HemisphereLight(0xb8c8e8, 0x304050, 1);
		scene.add(hemi);
		const key = new THREE.DirectionalLight(0xffffff, 1.05);
		key.position.set(3.5, 8, 5);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0x88aacc, 0.38);
		fill.position.set(-4, 2, -3);
		scene.add(fill);

		let raf = 0;
		const ro = new ResizeObserver(() => {
			if (!host) return;
			const cw = host.clientWidth;
			const ch = host.clientHeight;
			if (cw < 10 || ch < 10) return;
			camera.aspect = cw / ch;
			camera.updateProjectionMatrix();
			renderer.setSize(cw, ch);
		});
		ro.observe(host);

		const tick = (): void => {
			if (!alive) return;
			const dt = clock.getDelta();
			if (ctx.mixer) ctx.mixer.update(dt);
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};

		const mb0 = mbPreview;
		const f0 = formForLevel(level);

		if (playerUsesSkinnedGltfForBase(mb0)) {
			const urls = playerGltfUrlListForBase(mb0);
			const gltfOpts = skinnedGltfLoadOptionsForBase(mb0, 'preview');
			void loadSkinnedPlayerWithFallback(urls, gltfOpts)
				.then((payload) => {
					if (!alive || !host) {
						payload.dispose();
						return;
					}
					ctx.kind = 'skinned';
					ctx.root = payload.root;
					ctx.disposeSkinned = payload.dispose;
					ctx.mixer = payload.mixer;
					updateSkinnedPlayerEvolution(payload.root, f0, mb0, level);
					payload.root.rotation.y = FACE_Y;
					payload.root.scale.setScalar(hudModelScaleFor(mb0));
					scene.add(payload.root);
					const idle = pickSkinnedClip(payload.actions, ['Idle', 'Standing', 'idle'], [
						'idle',
						'stand',
						'tpose'
					]);
					idle?.reset().play();
					loadComplete = true;
					tick();
				})
				.catch(() => {
					if (!alive || !host) return;
					setHudEvoCameraView(camera, false);
					applyProcedural(f0, mb0, scene);
					ctx.mixer = null;
					loadComplete = true;
					tick();
				});
		} else {
			applyProcedural(f0, mb0, scene);
			ctx.mixer = null;
			loadComplete = true;
			tick();
		}

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			if (ctx.disposeSkinned) ctx.disposeSkinned();
			else if (ctx.proceduralRoot) disposeProceduralTree(ctx.proceduralRoot);
			ctx.disposeSkinned = null;
			ctx.proceduralRoot = null;
			ctx.root = null;
			ctx.scene = null;
			ctx.kind = 'none';
			ctx.mixer = null;
			scene.clear();
			renderer.dispose();
			if (host && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
		};
	});
</script>

<div class="hud-evo-host" bind:this={host}></div>

<style>
	.hud-evo-host {
		width: 88px;
		height: 110px;
		margin: 0 auto;
		border-radius: 2px;
		overflow: hidden;
	}
	.hud-evo-host :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}
</style>
