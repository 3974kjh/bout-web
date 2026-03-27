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
	import type { RankRunRecord } from '$lib/storage/rankIndexedDb';

	type Props = {
		/** [2등, 1등, 3등] — 화면 좌→중→우 */
		podiumRecords: [RankRunRecord | null, RankRunRecord | null, RankRunRecord | null];
	};
	let { podiumRecords }: Props = $props();

	let host: HTMLDivElement | undefined = $state();

	const PREVIEW_FORM = 4;
	const PREVIEW_LEVEL = 10;

	onMount(() => {
		if (!host) return;

		let alive = true;
		const clock = new THREE.Clock();
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0c1424);
		scene.fog = new THREE.Fog(0x0c1424, 8, 22);

		const w = host.clientWidth || 640;
		const h = host.clientHeight || 280;
		const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 80);
		camera.position.set(0, 2.35, 7.2);
		camera.lookAt(0, 1.05, 0);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(renderer.domElement);

		const hemi = new THREE.HemisphereLight(0xd8e8fc, 0x304060, 1.05);
		scene.add(hemi);
		const key = new THREE.DirectionalLight(0xffffff, 1.2);
		key.position.set(3.5, 9, 5);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0x88ccff, 0.45);
		rim.position.set(-4, 3, -5);
		scene.add(rim);

		const mixers: THREE.AnimationMixer[] = [];
		const disposers: (() => void)[] = [];
		const proceduralRoots: THREE.Object3D[] = [];
		const staticMeshes: THREE.Mesh[] = [];
		let raf = 0;

		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(40, 16),
			new THREE.MeshStandardMaterial({ color: 0x1a2438, metalness: 0.15, roughness: 0.85 })
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0;
		staticMeshes.push(floor);
		scene.add(floor);

		const disposeProceduralTree = (root: THREE.Object3D): void => {
			root.traverse((o) => {
				if (o instanceof THREE.Mesh) {
					o.geometry?.dispose();
					const mat = o.material;
					if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
					else mat?.dispose();
				}
			});
		};

		const disposeMesh = (mesh: THREE.Mesh): void => {
			mesh.geometry?.dispose();
			const mat = mesh.material;
			if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
			else mat?.dispose();
		};

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
			for (const m of mixers) m.update(dt);
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};

		type SlotSpec = { x: number; pedH: number; rank: 1 | 2 | 3; rec: RankRunRecord | null };
		const slots: SlotSpec[] = [
			{ x: -2.45, pedH: 0.58, rank: 2, rec: podiumRecords[0] },
			{ x: 0, pedH: 0.95, rank: 1, rec: podiumRecords[1] },
			{ x: 2.45, pedH: 0.52, rank: 3, rec: podiumRecords[2] }
		];

		const pedColor = (r: 1 | 2 | 3): number =>
			r === 1 ? 0xc9a450 : r === 2 ? 0x8899b8 : 0xb8734a;

		for (const s of slots) {
			const ped = new THREE.Mesh(
				new THREE.BoxGeometry(1.38, s.pedH, 1.12),
				new THREE.MeshStandardMaterial({
					color: pedColor(s.rank),
					metalness: 0.4,
					roughness: 0.45
				})
			);
			ped.position.set(s.x, s.pedH / 2, 0);
			staticMeshes.push(ped);
			scene.add(ped);
			const cap = new THREE.Mesh(
				new THREE.BoxGeometry(1.48, 0.07, 1.22),
				new THREE.MeshStandardMaterial({ color: 0x2a3344, metalness: 0.25, roughness: 0.7 })
			);
			cap.position.set(s.x, s.pedH + 0.035, 0);
			staticMeshes.push(cap);
			scene.add(cap);
		}

		const loadSlot = (s: SlotSpec): Promise<void> => {
			if (!s.rec) return Promise.resolve();
			const mechBase = s.rec.mechBase;
			const scale = s.rank === 1 ? 1.02 : 0.9;
			const y = s.pedH + 0.12;

			if (mechBase === 'expressive' || mechBase === 'soldier') {
				const urls = playerGltfUrlListForBase(mechBase);
				const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase);
				return loadSkinnedPlayerWithFallback(urls, gltfOpts).then((payload) => {
					if (!alive) {
						payload.dispose();
						return;
					}
					disposers.push(() => payload.dispose());
					payload.root.scale.setScalar(scale);
					payload.root.position.set(s.x, y, 0);
					payload.root.rotation.y = 0.32;
					updateSkinnedPlayerEvolution(payload.root, PREVIEW_FORM, mechBase, PREVIEW_LEVEL);
					scene.add(payload.root);
					mixers.push(payload.mixer);
					const idle = pickSkinnedClip(payload.actions, ['Idle', 'Standing', 'idle'], [
						'idle',
						'stand',
						'tpose'
					]);
					idle?.reset().play();
				}).catch(() => {
					if (!alive) return;
					const { group } = createEvolvedModel(PREVIEW_FORM, scale, mechBase);
					applyMechBaseTint(group, mechBase);
					group.position.set(s.x, y, 0);
					group.rotation.y = 0.32;
					proceduralRoots.push(group);
					scene.add(group);
				});
			}
			const { group } = createEvolvedModel(PREVIEW_FORM, scale, mechBase);
			applyMechBaseTint(group, mechBase);
			group.position.set(s.x, y, 0);
			group.rotation.y = 0.32;
			proceduralRoots.push(group);
			scene.add(group);
			return Promise.resolve();
		};

		void Promise.all(slots.map((s) => loadSlot(s))).then(() => {
			if (alive) tick();
		});

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			for (const d of disposers) d();
			for (const g of proceduralRoots) disposeProceduralTree(g);
			for (const m of staticMeshes) disposeMesh(m);
			scene.clear();
			renderer.dispose();
			if (host && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
		};
	});
</script>

<div class="podium-host" bind:this={host}></div>

<style>
	.podium-host {
		width: 100%;
		min-height: min(38vh, 300px);
		aspect-ratio: 16 / 7;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(0, 160, 220, 0.28);
		box-shadow:
			inset 0 0 32px rgba(0, 80, 140, 0.25),
			0 4px 24px rgba(0, 0, 0, 0.45);
		background: linear-gradient(180deg, #0a101c 0%, #121a2a 100%);
	}
	.podium-host :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}
</style>
