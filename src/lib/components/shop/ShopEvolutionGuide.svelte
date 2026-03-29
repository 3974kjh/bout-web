<script lang="ts">
	import { onMount } from 'svelte';
	import { locale, translate as tr, mechShopLine } from '$lib/i18n';
	import * as THREE from 'three';
	import type { MechBase } from '$lib/domain/types';
	import { createEvolvedModel, formForLevel, formStyleColors } from '$lib/game/entities/MechModel';
	import { applyMechBaseTint } from '$lib/game/entities/mechShopTint';
	import {
		playerGltfUrlListForBase,
		playerUsesSkinnedGltfForBase,
		skinnedGltfLoadOptionsForBase
	} from '$lib/game/constants/GameConfig';
	import { loadSkinnedPlayerWithFallback } from '$lib/game/entities/playerSkinned';
	import { updateSkinnedPlayerEvolution } from '$lib/game/entities/playerSkinnedEvolution';
	import { FORM_LEVEL_BRACKETS } from '$lib/game/mechEvolutionDoc';

	type Props = { mechBase: MechBase };
	let { mechBase }: Props = $props();

	/** 절차 메쉬(하이퍼슈트·아조나스·게렌) — 시뮬레이션에서 한 단계 더 크게 표시 */
	const MINI_SCALE = 0.92;
	/** 카메라(+Z) 반대를 기준 시선으로, Form별 미세 각도는 그대로 유지 */
	const FACE_Y_BASE = Math.PI;
	const WORLD_SPAN_X = 32;
	/** 아래 `evo-form-labels` 9열 그리드와 동일 — 각 열 가로 중앙의 월드 X */
	const FORM_STRIP_COLS = 9;
	function formStripCenterX(form: number): number {
		return WORLD_SPAN_X * ((form + 0.5) / FORM_STRIP_COLS - 0.5);
	}
	const LEVEL_MAX = 20;
	/** 각 Form 구간 대표 레벨(외장 스케일·게임 대응) */
	const FORM_MID_LEVEL = [1, 3, 5, 7, 9, 12, 15, 18, 20];

	const levelRows = Array.from({ length: LEVEL_MAX }, (_, i) => {
		const level = i + 1;
		return { level, form: formForLevel(level) };
	});

	let host: HTMLDivElement | undefined = $state();
	/** 스키닝: GLTF 9회 로드 완료 전 캔버스 구간 로딩 표시 */
	let evoStripBusy = $state(playerUsesSkinnedGltfForBase(mechBase));

	onMount(() => {
		if (!host) return;

		let alive = true;
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0xccccd0);

		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 220);
		camera.position.set(0, 1.22, 22);
		camera.lookAt(0, 1.22, 0);

		const w = host.clientWidth || 640;
		const h = host.clientHeight || 220;
		const setOrtho = (): void => {
			const cw = host?.clientWidth ?? w;
			const ch = host?.clientHeight ?? h;
			const aspect = cw / ch;
			const spanY = WORLD_SPAN_X / aspect;
			camera.left = -WORLD_SPAN_X / 2;
			camera.right = WORLD_SPAN_X / 2;
			camera.top = spanY / 2;
			camera.bottom = -spanY / 2;
			camera.updateProjectionMatrix();
		};
		setOrtho();

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(renderer.domElement);

		const hemi = new THREE.HemisphereLight(0xf0f6fc, 0xb8c8d8, 1.05);
		scene.add(hemi);
		const key = new THREE.DirectionalLight(0xffffff, 1.05);
		key.position.set(4, 14, 10);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xaaccff, 0.45);
		fill.position.set(-8, 6, -4);
		scene.add(fill);
		const bounce = new THREE.DirectionalLight(0xffeedd, 0.28);
		bounce.position.set(0, -2, 6);
		scene.add(bounce);

		const groups: THREE.Group[] = [];
		const disposers: (() => void)[] = [];
		let raf = 0;

		const ro = new ResizeObserver(() => {
			if (!host) return;
			const cw = host.clientWidth;
			const ch = host.clientHeight;
			if (cw < 10 || ch < 10) return;
			setOrtho();
			renderer.setSize(cw, ch);
		});
		ro.observe(host);

		const tick = (): void => {
			if (!alive) return;
			for (const g of groups) g.rotation.y += 0.011;
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

		const startLoop = (): void => {
			tick();
		};

		if (playerUsesSkinnedGltfForBase(mechBase)) {
			const gltfUrls = playerGltfUrlListForBase(mechBase);
			const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase, 'preview');
			void (async () => {
				try {
					const payloads = await Promise.all(
						Array.from({ length: 9 }, () => loadSkinnedPlayerWithFallback(gltfUrls, gltfOpts))
					);
					if (!alive || !host) {
						for (const p of payloads) p.dispose();
						return;
					}
					for (let form = 0; form <= 8; form++) {
						const p = payloads[form];
						const g = p.root;
						g.position.x = formStripCenterX(form);
						g.rotation.y = FACE_Y_BASE + form * 0.06;
						updateSkinnedPlayerEvolution(g, form, mechBase, FORM_MID_LEVEL[form]);
						scene.add(g);
						groups.push(g);
						disposers.push(p.dispose);
					}
					evoStripBusy = false;
					startLoop();
				} catch {
					if (!alive || !host) return;
					for (let form = 0; form <= 8; form++) {
						const { group } = createEvolvedModel(form, MINI_SCALE, 'geren');
						applyMechBaseTint(group, mechBase);
						group.position.x = formStripCenterX(form);
						group.rotation.y = FACE_Y_BASE + form * 0.06;
						scene.add(group);
						groups.push(group);
					}
					evoStripBusy = false;
					startLoop();
				}
			})();
		} else {
			for (let form = 0; form <= 8; form++) {
				const { group } = createEvolvedModel(form, MINI_SCALE, mechBase);
				applyMechBaseTint(group, mechBase);
				group.position.x = formStripCenterX(form);
				group.rotation.y = FACE_Y_BASE + form * 0.06;
				scene.add(group);
				groups.push(group);
			}
			startLoop();
		}

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			for (const d of disposers) d();
			if (disposers.length === 0) disposeProceduralMeshes();
			scene.clear();
			renderer.dispose();
			if (host && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
		};
	});
</script>

<section class="evo-guide" aria-labelledby="evo-guide-title">
	<h3 id="evo-guide-title" class="evo-h3">{tr($locale, 'shop.evoTitle')}</h3>
	<p class="evo-lead">
		{#if playerUsesSkinnedGltfForBase(mechBase)}
			{@html tr($locale, 'shop.evoLeadSkinnedHtml', {
				name: mechShopLine($locale, mechBase, 'name')
			})}
		{:else}
			{@html tr($locale, 'shop.evoLeadProcHtml')}
		{/if}
	</p>

	<div class="evo-strip-wrap">
		<div class="evo-canvas-shell">
			<div class="evo-canvas-host" bind:this={host}></div>
			{#if evoStripBusy}
				<div class="evo-strip-loading" role="status" aria-live="polite" aria-busy="true">
					<div class="evo-progress-circle-wrap" aria-hidden="true">
						<svg class="evo-progress-circle" viewBox="0 0 44 44" width="40" height="40">
							<circle class="evo-progress-circle__track" cx="22" cy="22" r="18" />
							<circle class="evo-progress-circle__arc" cx="22" cy="22" r="18" />
						</svg>
					</div>
					<span class="evo-strip-loading__text">{tr($locale, 'shop.previewLoading')}</span>
				</div>
			{/if}
		</div>
		<div class="evo-form-labels" aria-hidden="true">
			{#each FORM_LEVEL_BRACKETS as b (b.form)}
				<div class="efl-cell">
					<span class="efl-f">F{b.form}</span>
					<span class="efl-lv">{b.levels}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="lv-matrix" role="list" aria-label={tr($locale, 'shop.evoMatrixAria')}>
		{#each levelRows as row (row.level)}
			<div
				class="lv-cell"
				role="listitem"
				style:--accent="#{formStyleColors(row.form).accent.toString(16).padStart(6, '0')}"
			>
				<span class="lv-n">Lv {row.level}</span>
				<span class="lv-f">F{row.form}</span>
			</div>
		{/each}
	</div>
	<p class="evo-foot">
		{@html tr($locale, 'shop.evoFootHtml')}
	</p>
</section>

<style>
	.evo-guide {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(0, 120, 180, 0.18);
	}

	.evo-h3 {
		margin: 0 0 0.35rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(0, 100, 140, 0.9);
	}

	.evo-lead {
		margin: 0 0 0.65rem;
		font-size: 0.7rem;
		line-height: 1.5;
		color: rgba(40, 70, 95, 0.92);
	}

	.evo-strip-wrap {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: linear-gradient(180deg, #dcdce0 0%, #ceced4 55%, #c2c2c8 100%);
		margin-bottom: 0.65rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
	}

	.evo-canvas-shell {
		position: relative;
		width: 100%;
	}

	.evo-strip-loading {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: linear-gradient(180deg, #d8d8dc 0%, #c4c4ca 100%);
		box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.5);
	}

	.evo-progress-circle-wrap {
		animation: evo-preview-spin 0.85s linear infinite;
		color: rgba(28, 78, 128, 0.92);
		filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.6));
	}

	.evo-progress-circle {
		display: block;
	}

	.evo-progress-circle__track {
		fill: none;
		stroke: rgba(0, 0, 0, 0.07);
		stroke-width: 3.2;
	}

	.evo-progress-circle__arc {
		fill: none;
		stroke: currentColor;
		stroke-width: 3.2;
		stroke-linecap: round;
		stroke-dasharray: 30 83;
	}

	@keyframes evo-preview-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.evo-strip-loading__text {
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: rgba(45, 75, 108, 0.88);
	}

	.evo-canvas-host {
		width: 100%;
		min-height: 148px;
		aspect-ratio: 21 / 4;
		background: linear-gradient(180deg, #d8d8dc 0%, #c4c4ca 100%);
	}

	.evo-canvas-host :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}

	.evo-form-labels {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: 0;
		padding: 0.28rem 0.15rem 0.38rem;
		background: rgba(228, 228, 230, 0.96);
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		font-size: 0.52rem;
		line-height: 1.3;
		align-items: start;
	}

	.efl-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.1rem;
		text-align: center;
		padding: 0.15rem 0.08rem;
		border-right: 1px solid rgba(0, 80, 140, 0.1);
		min-height: 2.6rem;
	}

	.efl-cell:last-child {
		border-right: none;
	}

	.efl-f {
		font-weight: 900;
		color: #0a5a8a;
		font-variant-numeric: tabular-nums;
		font-size: 0.58rem;
	}

	.efl-lv {
		color: rgba(60, 90, 120, 0.88);
		font-variant-numeric: tabular-nums;
	}

	.lv-matrix {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 0.32rem;
	}

	@media (max-width: 520px) {
		.lv-matrix {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.lv-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.18rem;
		min-height: 2.85rem;
		padding: 0.32rem 0.2rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 120, 180, 0.2);
		background: rgba(255, 255, 255, 0.88);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.9) inset,
			0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.lv-n {
		font-size: 0.56rem;
		font-weight: 800;
		color: #2a4560;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.lv-f {
		font-size: 0.78rem;
		font-weight: 900;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.evo-foot {
		margin: 0.55rem 0 0;
		font-size: 0.58rem;
		line-height: 1.45;
		color: rgba(50, 80, 110, 0.75);
	}
</style>
