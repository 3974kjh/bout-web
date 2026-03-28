<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { createEvolvedModel, formForLevel } from '$lib/game/entities/MechModel';
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

	onMount(() => {
		if (!host) return;

		let alive = true;
		const clock = new THREE.Clock();
		const scene = new THREE.Scene();
		const BG = 0x141c2e;
		scene.background = new THREE.Color(BG);
		scene.fog = new THREE.Fog(BG, 22, 52);

		const w = host.clientWidth || 640;
		const h = host.clientHeight || 280;
		const camera = new THREE.PerspectiveCamera(41, w / h, 0.1, 100);
		camera.position.set(0, 2.65, 11.65);
		camera.lookAt(0, 1.12, 0);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.14;
		host.appendChild(renderer.domElement);

		/** 무대 상단: 따뜻한 키, 하단: 밝은 필 — 뒤쪽도 은은히 밝힘 */
		const hemi = new THREE.HemisphereLight(0xfff8f0, 0x3a4560, 0.72);
		scene.add(hemi);
		const amb = new THREE.AmbientLight(0x8a9cc0, 0.42);
		scene.add(amb);
		const key = new THREE.DirectionalLight(0xfff5e8, 1.18);
		key.position.set(2.8, 11, 6.5);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xc8d8f0, 0.48);
		fill.position.set(-5, 5, -4);
		scene.add(fill);
		const rim = new THREE.DirectionalLight(0x8899cc, 0.4);
		rim.position.set(5, 4, -6);
		scene.add(rim);
		const backWash = new THREE.DirectionalLight(0xb8cce8, 0.62);
		backWash.position.set(0, 6, -14);
		scene.add(backWash);

		const mixers: THREE.AnimationMixer[] = [];
		const disposers: (() => void)[] = [];
		const proceduralRoots: THREE.Object3D[] = [];
		const staticMeshes: THREE.Mesh[] = [];
		const rankPlates: THREE.Mesh[] = [];
		let raf = 0;

		const STAGE_H = 0.1;

		function podiumMaterials(rank: 1 | 2 | 3): THREE.MeshStandardMaterial {
			if (rank === 1) {
				return new THREE.MeshStandardMaterial({
					color: 0xe8c84a,
					metalness: 0.72,
					roughness: 0.24,
					emissive: 0x6a4810,
					emissiveIntensity: 0.08
				});
			}
			if (rank === 2) {
				return new THREE.MeshStandardMaterial({
					color: 0xe8eef5,
					metalness: 0.78,
					roughness: 0.2,
					emissive: 0x3d4a5c,
					emissiveIntensity: 0.06
				});
			}
			return new THREE.MeshStandardMaterial({
				color: 0xe0a060,
				metalness: 0.62,
				roughness: 0.28,
				emissive: 0x5c3018,
				emissiveIntensity: 0.07
			});
		}

		function capMaterial(): THREE.MeshStandardMaterial {
			return new THREE.MeshStandardMaterial({
				color: 0x2a3344,
				metalness: 0.48,
				roughness: 0.3,
				emissive: 0x101820,
				emissiveIntensity: 0.05
			});
		}

		function createCeremonyBackdrop(): THREE.Mesh {
			const canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 512;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				const g = new THREE.PlaneGeometry(28, 18);
				return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: BG }));
			}
			const lg = ctx.createLinearGradient(0, 0, 0, 512);
			lg.addColorStop(0, '#283a5c');
			lg.addColorStop(0.35, '#1e2d48');
			lg.addColorStop(0.65, '#152038');
			lg.addColorStop(1, '#0e1420');
			ctx.fillStyle = lg;
			ctx.fillRect(0, 0, 256, 512);
			const rg = ctx.createRadialGradient(128, 240, 80, 128, 260, 220);
			rg.addColorStop(0, 'rgba(255, 235, 200, 0.14)');
			rg.addColorStop(0.4, 'rgba(120, 150, 200, 0.08)');
			rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
			ctx.fillStyle = rg;
			ctx.fillRect(0, 0, 256, 512);
			const tex = new THREE.CanvasTexture(canvas);
			tex.colorSpace = THREE.SRGBColorSpace;
			const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
			const mesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), mat);
			mesh.position.set(0, 9.2, -8.2);
			return mesh;
		}

		/** 받침 앞면(+Z) — 숫자 + 은은한 등급 그라데이션 */
		function createRankPlate(rank: 1 | 2 | 3): THREE.Mesh {
			const canvas = document.createElement('canvas');
			canvas.width = 192;
			canvas.height = 192;
			const ctx = canvas.getContext('2d', { alpha: true });
			if (!ctx) {
				const g = new THREE.PlaneGeometry(1, 1);
				return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }));
			}
			ctx.clearRect(0, 0, 192, 192);
			ctx.font = 'bold 140px Segoe UI, system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			// 글리프에만 보이도록 fillStyle에 그라데이션만 사용 (배경 사각형 없음)
			let grad: CanvasGradient;
			if (rank === 1) {
				grad = ctx.createLinearGradient(96, 32, 96, 168);
				grad.addColorStop(0, '#fff8e0');
				grad.addColorStop(0.42, '#ffe066');
				grad.addColorStop(0.72, '#f0b820');
				grad.addColorStop(1, '#d49818');
			} else if (rank === 2) {
				grad = ctx.createLinearGradient(96, 32, 96, 168);
				grad.addColorStop(0, '#ffffff');
				grad.addColorStop(0.4, '#e8eef8');
				grad.addColorStop(0.7, '#b8c8e0');
				grad.addColorStop(1, '#8fa0b8');
			} else {
				grad = ctx.createLinearGradient(96, 32, 96, 168);
				grad.addColorStop(0, '#fff0e0');
				grad.addColorStop(0.45, '#ffc090');
				grad.addColorStop(0.75, '#e88850');
				grad.addColorStop(1, '#c06030');
			}
			ctx.fillStyle = grad;
			ctx.fillText(String(rank), 96, 98);

			const tex = new THREE.CanvasTexture(canvas);
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.needsUpdate = true;
			const mat = new THREE.MeshBasicMaterial({
				map: tex,
				transparent: true,
				alphaTest: 0.02,
				depthTest: true,
				depthWrite: false,
				side: THREE.DoubleSide
			});
			const geom = new THREE.PlaneGeometry(0.82, 0.82);
			return new THREE.Mesh(geom, mat);
		}

		function disposeRankPlate(mesh: THREE.Mesh): void {
			mesh.geometry.dispose();
			const m = mesh.material as THREE.MeshBasicMaterial;
			m.map?.dispose();
			m.dispose();
		}

		const floorMat = new THREE.MeshStandardMaterial({
			color: 0x1a2438,
			metalness: 0.38,
			roughness: 0.4,
			emissive: 0x080c18,
			emissiveIntensity: 0.04
		});
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(72, 34), floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0;
		staticMeshes.push(floor);
		scene.add(floor);

		const stageMat = new THREE.MeshStandardMaterial({
			color: 0x222030,
			metalness: 0.32,
			roughness: 0.45,
			emissive: 0x121018,
			emissiveIntensity: 0.06
		});
		const stage = new THREE.Mesh(new THREE.BoxGeometry(19.5, STAGE_H, 6.2), stageMat);
		stage.position.set(0, STAGE_H / 2, 0);
		staticMeshes.push(stage);
		scene.add(stage);

		const backdrop = createCeremonyBackdrop();
		staticMeshes.push(backdrop);
		scene.add(backdrop);

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
			const disposeOne = (m: THREE.Material): void => {
				const mm = m as THREE.MeshBasicMaterial & { map?: THREE.Texture };
				mm.map?.dispose();
				m.dispose();
			};
			if (Array.isArray(mat)) mat.forEach(disposeOne);
			else if (mat) disposeOne(mat);
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
			{ x: -3.68, pedH: 1.02, rank: 2, rec: podiumRecords[0] },
			{ x: 0, pedH: 1.58, rank: 1, rec: podiumRecords[1] },
			{ x: 3.68, pedH: 0.9, rank: 3, rec: podiumRecords[2] }
		];

		const PED_W = 2.2;
		const PED_D = 1.76;

		const spotColor = (r: 1 | 2 | 3): number =>
			r === 1 ? 0xffeedd : r === 2 ? 0xd8e8ff : 0xffddc8;

		for (const s of slots) {
			const pedCy = STAGE_H + s.pedH / 2;
			const ped = new THREE.Mesh(
				new THREE.BoxGeometry(PED_W, s.pedH, PED_D),
				podiumMaterials(s.rank)
			);
			ped.position.set(s.x, pedCy, 0);
			staticMeshes.push(ped);
			scene.add(ped);

			const cap = new THREE.Mesh(
				new THREE.BoxGeometry(PED_W + 0.1, 0.09, PED_D + 0.1),
				capMaterial()
			);
			cap.position.set(s.x, STAGE_H + s.pedH + 0.045, 0);
			staticMeshes.push(cap);
			scene.add(cap);

			const plate = createRankPlate(s.rank);
			const zFront = PED_D * 0.5 + 0.022;
			plate.position.set(s.x, STAGE_H + s.pedH * 0.52, zFront);
			scene.add(plate);
			rankPlates.push(plate);

			const aim = new THREE.Object3D();
			aim.position.set(s.x, STAGE_H + s.pedH * 0.45, 0);
			scene.add(aim);

			const spot = new THREE.SpotLight(spotColor(s.rank), 1.45, 38, 0.5, 0.48, 1);
			spot.position.set(s.x, 9.4, 5.4);
			spot.target = aim;
			spot.decay = 2;
			scene.add(spot);
		}

		const loadSlot = (s: SlotSpec): Promise<void> => {
			if (!s.rec) return Promise.resolve();
			const mechBase = s.rec.mechBase;
			const form = formForLevel(s.rec.level);
			const lv = s.rec.level;
			/** 시상대에 전신이 들어오도록 축소 */
			const scale = 0.8;
			const y = STAGE_H + s.pedH;

			if (mechBase === 'expressive' || mechBase === 'soldier') {
				const urls = playerGltfUrlListForBase(mechBase);
				const gltfOpts = skinnedGltfLoadOptionsForBase(mechBase, 'preview');
				return loadSkinnedPlayerWithFallback(urls, gltfOpts).then((payload) => {
					if (!alive) {
						payload.dispose();
						return;
					}
					disposers.push(() => payload.dispose());
					payload.root.scale.setScalar(scale);
					payload.root.position.set(s.x, y, 0);
					payload.root.rotation.y = Math.PI;
					updateSkinnedPlayerEvolution(payload.root, form, mechBase, lv);
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
					const { group } = createEvolvedModel(form, scale, mechBase);
					applyMechBaseTint(group, mechBase);
					group.position.set(s.x, y, 0);
					group.rotation.y = Math.PI;
					proceduralRoots.push(group);
					scene.add(group);
				});
			}
			const { group } = createEvolvedModel(form, scale, mechBase);
			applyMechBaseTint(group, mechBase);
			group.position.set(s.x, y, 0);
			group.rotation.y = Math.PI;
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
			for (const pl of rankPlates) disposeRankPlate(pl);
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
		min-height: min(38vh, 320px);
		aspect-ratio: 16 / 4.9;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(180, 155, 95, 0.35);
		box-shadow:
			inset 0 0 48px rgba(20, 35, 55, 0.55),
			0 0 0 1px rgba(255, 240, 200, 0.06),
			0 8px 40px rgba(0, 0, 0, 0.55),
			0 0 80px rgba(80, 60, 30, 0.12);
		background: linear-gradient(165deg, #0a0e18 0%, #060912 40%, #0c1424 100%);
	}
	.podium-host :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}
</style>
