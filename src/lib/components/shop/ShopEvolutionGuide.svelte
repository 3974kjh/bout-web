<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { MechBase } from '$lib/domain/types';
	import { createEvolvedModel, formForLevel, formStyleColors } from '$lib/game/entities/MechModel';
	import { applyMechBaseTint } from '$lib/game/entities/mechShopTint';
	import {
		playerGltfUrlListForBase,
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

		if (mechBase === 'expressive' || mechBase === 'soldier') {
			const gltfUrls = playerGltfUrlListForBase(mechBase);
			const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase);
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
	<h3 id="evo-guide-title" class="evo-h3">레벨 → Form 진화 (시뮬레이션)</h3>
	<p class="evo-lead">
		{#if mechBase === 'expressive' || mechBase === 'soldier'}
			<strong>{mechBase === 'soldier' ? '솔저' : '익스프레시브'}</strong>는 GLTF 본체에 <strong>재질 그레이딩</strong>과 함께,
			레벨·Form에 따라 <strong>팔·다리·머리 부착 모듈</strong>·<strong>백 부스터</strong>·<strong>날개</strong>가 늘어납니다. 솔저는 three.js
			<strong>Idle / Walk / Run</strong> 클립을 사용합니다. 다른 기체는 절차 메쉬 파이프라인이 서로 다릅니다.
		{:else}
			기체마다 <strong>완전히 다른 3D 파이프라인</strong>(네모 / 세모 / 원형)으로 Form이 쌓입니다. 아래
			<strong>Form 0~8</strong> 열과 라벨이 같은 순서입니다.
		{/if}
	</p>

	<div class="evo-strip-wrap">
		<div class="evo-canvas-host" bind:this={host}></div>
		<div class="evo-form-labels" aria-hidden="true">
			{#each FORM_LEVEL_BRACKETS as b (b.form)}
				<div class="efl-cell">
					<span class="efl-f">F{b.form}</span>
					<span class="efl-lv">{b.levels}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="lv-matrix" role="list" aria-label="레벨 1부터 20까지 Form">
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
	<p class="evo-foot">Lv 21 이상은 Lv 20과 같이 <strong>Form 8</strong>입니다.</p>
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
