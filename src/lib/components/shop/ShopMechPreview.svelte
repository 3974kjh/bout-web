<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { createEvolvedModel } from '$lib/game/entities/MechModel';
	import { applyMechBaseTint } from '$lib/game/entities/mechShopTint';
	import {
		playerGltfUrlListForBase,
		playerUsesSkinnedGltfForBase,
		skinnedGltfLoadOptionsForBase
	} from '$lib/game/constants/GameConfig';
	import {
		loadSkinnedPlayerWithFallback,
		pickSkinnedClip
	} from '$lib/game/entities/playerSkinned';
	import { updateSkinnedPlayerEvolution } from '$lib/game/entities/playerSkinnedEvolution';
	import type { MechBase } from '$lib/domain/types';
	import { locale, translate as tr } from '$lib/i18n';

	type Props = { mechBase: MechBase };
	let { mechBase }: Props = $props();

	let host: HTMLDivElement | undefined = $state();
	/** GLTF 스키닝은 네트워크·파싱 지연이 있어 로드 완료 전까지 오버레이 표시 */
	let previewBusy = $state(mechBase === 'expressive' || mechBase === 'soldier');

	/** 정비소 미리보기: 최종 진화 단계(form 8) — `formForLevel(20)`과 동일 */
	const PREVIEW_FORM = 8;
	const MODEL_SCALE = 1.35;
	const PREVIEW_LEVEL = 20;
	/** 카메라(+Z) 반대를 기본 시선으로 (기존 0.35를 180° 뒤짐) */
	const FACE_Y = Math.PI + 0.35;
	/** `camera.lookAt`과 맞춰 바운딩 박스 중심을 화면 중앙에 둠 */
	const FRAME_TARGET_Y = 1.15;

	/**
	 * 절차 메쉬(F8)와 GLTF 스키닝(익스프레시브/솔저) 바운딩·스케일이 달라 카메라 분리.
	 * `forSkinned === false`: 기존 절차 기준. GLTF 실패 후 절차 폴백 시 `false`로 재적용.
	 */
	function setShopPreviewCamera(camera: THREE.PerspectiveCamera, forSkinned: boolean): void {
		const ty = FRAME_TARGET_Y;
		if (forSkinned) {
			camera.position.set(0, ty + 0.78, 4.95);
			camera.lookAt(0, ty + 0.06, 0);
		} else {
			camera.position.set(0, ty + 0.9, 6.8);
			camera.lookAt(0, ty, 0);
		}
	}

	function centerModelAtLookAt(root: THREE.Object3D): void {
		root.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(root);
		if (box.isEmpty()) return;
		const c = new THREE.Vector3();
		box.getCenter(c);
		root.position.sub(c);
		root.position.y += FRAME_TARGET_Y;
	}

	onMount(() => {
		if (!host) return;

		let alive = true;
		const clock = new THREE.Clock();
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0xccccd0);

		const w = host.clientWidth || 320;
		const h = host.clientHeight || 280;
		const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 80);
		setShopPreviewCamera(camera, playerUsesSkinnedGltfForBase(mechBase));

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
			const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase, 'preview');
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
						PREVIEW_LEVEL
					);
					payload.root.rotation.y = FACE_Y;
					scene.add(payload.root);
					centerModelAtLookAt(payload.root);
					const idle = pickSkinnedClip(payload.actions, ['Idle', 'Standing', 'idle'], [
						'idle',
						'stand',
						'tpose'
					]);
					idle?.reset().play();
					previewBusy = false;
					tick();
				})
				.catch(() => {
					if (!alive || !host) return;
					setShopPreviewCamera(camera, false);
					const { group } = createEvolvedModel(PREVIEW_FORM, MODEL_SCALE, mechBase);
					applyMechBaseTint(group, mechBase);
					group.rotation.y = FACE_Y;
					rootGroup = group;
					scene.add(group);
					centerModelAtLookAt(group);
					previewBusy = false;
					tick();
				});
		} else {
			const { group } = createEvolvedModel(PREVIEW_FORM, MODEL_SCALE, mechBase);
			applyMechBaseTint(group, mechBase);
			group.rotation.y = FACE_Y;
			rootGroup = group;
			scene.add(group);
			centerModelAtLookAt(group);
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
<div class="preview-shell">
	<div class="preview-host" bind:this={host}></div>
	{#if previewBusy}
		<div class="preview-loading" role="status" aria-live="polite" aria-busy="true">
			<div class="progress-circle-wrap" aria-hidden="true">
				<svg class="progress-circle" viewBox="0 0 44 44" width="44" height="44">
					<circle class="progress-circle__track" cx="22" cy="22" r="18" />
					<circle class="progress-circle__arc" cx="22" cy="22" r="18" />
				</svg>
			</div>
			<span class="preview-loading__text">{tr($locale, 'shop.previewLoading')}</span>
		</div>
	{/if}
</div>
<p class="preview-caption">
	{#if mechBase === 'expressive' || mechBase === 'soldier'}
		{tr($locale, 'shop.previewCaptionSkinnedHtml', { form: String(PREVIEW_FORM) })}
	{:else}
		{tr($locale, 'shop.previewCaptionProcHtml', { form: String(PREVIEW_FORM) })}
	{/if}
</p>

<style>
	.preview-shell {
		position: relative;
		width: 100%;
	}
	.preview-host {
		width: 100%;
		min-height: min(42vh, 320px);
		aspect-ratio: 4 / 3;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
		box-shadow:
			inset 0 0 20px rgba(255, 255, 255, 0.65),
			0 2px 10px rgba(0, 0, 0, 0.06);
		background: linear-gradient(180deg, #d8d8dc 0%, #c4c4ca 100%);
	}
	.preview-loading {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		border-radius: 10px;
		background: linear-gradient(180deg, #d8d8dc 0%, #c4c4ca 100%);
		box-shadow: inset 0 0 24px rgba(255, 255, 255, 0.5);
	}
	.progress-circle-wrap {
		animation: preview-spin 0.85s linear infinite;
		color: rgba(28, 78, 128, 0.92);
		filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.6));
	}
	.progress-circle {
		display: block;
	}
	.progress-circle__track {
		fill: none;
		stroke: rgba(0, 0, 0, 0.07);
		stroke-width: 3.2;
	}
	.progress-circle__arc {
		fill: none;
		stroke: currentColor;
		stroke-width: 3.2;
		stroke-linecap: round;
		stroke-dasharray: 30 83;
	}
	@keyframes preview-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.preview-loading__text {
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: rgba(45, 75, 108, 0.88);
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
