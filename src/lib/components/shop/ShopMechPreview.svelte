<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { createEvolvedModel } from '$lib/game/entities/MechModel';
	import { applyMechBaseTint } from '$lib/game/entities/mechShopTint';
	import {
		playerGltfUrlListForBase,
		skinnedGltfLoadOptionsForBase
	} from '$lib/game/constants/GameConfig';
	import {
		loadSkinnedPlayerWithFallback,
		pickSkinnedClip
	} from '$lib/game/entities/playerSkinned';
	import { updateSkinnedPlayerEvolution } from '$lib/game/entities/playerSkinnedEvolution';
	import type { MechBase } from '$lib/domain/types';

	type Props = { mechBase: MechBase };
	let { mechBase }: Props = $props();

	let host: HTMLDivElement | undefined = $state();

	/** 정비소 미리보기: 중간 진화 단계(form 4) — 실루엣이 읽기 쉬움 */
	const PREVIEW_FORM = 4;
	const MODEL_SCALE = 1.35;
	const PREVIEW_LEVEL_FOR_FORM4 = 10;

	onMount(() => {
		if (!host) return;

		let alive = true;
		const clock = new THREE.Clock();
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0xdce8f4);

		const w = host.clientWidth || 320;
		const h = host.clientHeight || 280;
		const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 80);
		camera.position.set(0, 2.1, 5.8);
		camera.lookAt(0, 1.15, 0);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(renderer.domElement);

		const hemi = new THREE.HemisphereLight(0xf0f6fc, 0xb8c8d8, 1);
		scene.add(hemi);
		const key = new THREE.DirectionalLight(0xffffff, 1.15);
		key.position.set(4, 10, 6);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xaaccff, 0.42);
		fill.position.set(-5, 4, -4);
		scene.add(fill);

		let rootGroup: THREE.Object3D | null = null;
		let mixer: THREE.AnimationMixer | null = null;
		let disposeSkinned: (() => void) | null = null;
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
			if (mixer) mixer.update(dt);
			if (rootGroup) rootGroup.rotation.y += 0.014;
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};

		const disposeProceduralMeshes = (): void => {
			scene.traverse((o) => {
				if (o instanceof THREE.Mesh) {
					o.geometry?.dispose();
					const m = o.material;
					if (Array.isArray(m)) m.forEach((x) => x.dispose());
					else m?.dispose();
				}
			});
		};

		if (mechBase === 'expressive' || mechBase === 'soldier') {
			const urls = playerGltfUrlListForBase(mechBase);
			const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase);
			void loadSkinnedPlayerWithFallback(urls, gltfOpts)
				.then((payload) => {
					if (!alive || !host) {
						payload.dispose();
						return;
					}
					rootGroup = payload.root;
					mixer = payload.mixer;
					disposeSkinned = payload.dispose;
					updateSkinnedPlayerEvolution(
						payload.root,
						PREVIEW_FORM,
						mechBase,
						PREVIEW_LEVEL_FOR_FORM4
					);
					payload.root.rotation.y = 0.35;
					scene.add(payload.root);
					const idle = pickSkinnedClip(payload.actions, ['Idle', 'Standing', 'idle'], [
						'idle',
						'stand',
						'tpose'
					]);
					idle?.reset().play();
					tick();
				})
				.catch(() => {
					if (!alive || !host) return;
					const { group } = createEvolvedModel(PREVIEW_FORM, MODEL_SCALE, mechBase);
					applyMechBaseTint(group, mechBase);
					group.rotation.y = 0.35;
					rootGroup = group;
					scene.add(group);
					tick();
				});
		} else {
			const { group } = createEvolvedModel(PREVIEW_FORM, MODEL_SCALE, mechBase);
			applyMechBaseTint(group, mechBase);
			group.rotation.y = 0.35;
			rootGroup = group;
			scene.add(group);
			tick();
		}

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			if (disposeSkinned) disposeSkinned();
			else disposeProceduralMeshes();
			scene.clear();
			renderer.dispose();
			if (host && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
		};
	});
</script>

<!-- mechBase 변경 시 전체 리마운트 — 부모에서 {#key mechBase} 권장 -->
<div class="preview-host" bind:this={host}></div>
<p class="preview-caption">
	{#if mechBase === 'expressive' || mechBase === 'soldier'}
		Form {PREVIEW_FORM} · GLTF + 링·부스터·날개 · 애니메이션 미리보기
	{:else}
		Form {PREVIEW_FORM} · 기체별 전용 메쉬(네모·세모·원) · 레벨에 따라 0~8 진화
	{/if}
</p>

<style>
	.preview-host {
		width: 100%;
		min-height: min(42vh, 320px);
		aspect-ratio: 4 / 3;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(0, 140, 200, 0.25);
		box-shadow:
			inset 0 0 24px rgba(255, 255, 255, 0.5),
			0 2px 12px rgba(20, 60, 100, 0.1);
		background: linear-gradient(180deg, #e8f0f8 0%, #dce8f4 100%);
	}
	.preview-host :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}
	.preview-caption {
		margin: 0.45rem 0 0;
		font-size: 0.62rem;
		line-height: 1.35;
		color: rgba(50, 85, 115, 0.82);
		text-align: center;
	}
</style>
