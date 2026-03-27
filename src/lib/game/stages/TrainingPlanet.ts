import * as THREE from 'three';
import type { StageQuery } from '$lib/domain/types';

/**
 * 오픈 월드 배틀필드.
 * 220×220 대형 맵, 다양한 구조물과 웨이브 테마 전환.
 */

interface Platform {
	box: THREE.Box3;
	topY: number;
}

export const WORLD_W = 180;
export const WORLD_D = 180;
const STEP_UP = 0.4;

// 웨이브 티어별 테마 (bg: 배경색, ground: 바닥색, accent: 구조물 테두리색, emissiveHex: 발광색)
// 배경이 어두울수록 바닥/구조물은 상대적으로 밝게 설정
const WAVE_THEMES = [
	{ bg: 0x8fb0cc, ground: 0x3a3428, accent: 0x5a5040, emissiveHex: 0x241800, groundEmissive: 0.0, glowMult: 1.0 }, // tier 0: 낮
	{ bg: 0x9a5535, ground: 0x5a3018, accent: 0x8a4420, emissiveHex: 0x703000, groundEmissive: 0.06, glowMult: 1.4 }, // tier 1: 황혼
	{ bg: 0x1a3a5a, ground: 0x283858, accent: 0x3a5890, emissiveHex: 0x1040a0, groundEmissive: 0.10, glowMult: 2.0 }, // tier 2: 심야/블루
	{ bg: 0x5a1020, ground: 0x503030, accent: 0x882020, emissiveHex: 0xaa0020, groundEmissive: 0.14, glowMult: 2.6 }, // tier 3: 지옥
	{ bg: 0x180828, ground: 0x3a2050, accent: 0x6020a0, emissiveHex: 0x8800cc, groundEmissive: 0.18, glowMult: 3.2 }, // tier 4: 어둠/보라
];

export class TrainingPlanet implements StageQuery {
	bounds = { minX: -WORLD_W / 2, maxX: WORLD_W / 2, minZ: -WORLD_D / 2, maxZ: WORLD_D / 2 };
	private platforms: Platform[] = [];
	private groundMesh!: THREE.Mesh;
	private obstacleEdgeMats: THREE.MeshStandardMaterial[] = [];
	private glowMeshes: THREE.Mesh[] = [];
	/** 미사일 충돌 판정용 장애물 Box3 목록 (platforms와 동일 set) */
	private obstacleBoxes: THREE.Box3[] = [];

	/** 두 점 사이에 장애물이 있는지 검사 (미사일 관통 차단용) */
	checkLineObstacle(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): boolean {
		const from = new THREE.Vector3(fx, fy, fz);
		const to   = new THREE.Vector3(tx, ty, tz);
		const dir  = new THREE.Vector3().subVectors(to, from);
		const len  = dir.length();
		if (len < 0.05) return false;
		dir.divideScalar(len);
		const ray = new THREE.Ray(from, dir);
		const tgt = new THREE.Vector3();
		for (const box of this.obstacleBoxes) {
			const hit = ray.intersectBox(box, tgt);
			if (hit !== null && from.distanceTo(tgt) <= len + 0.1) return true;
		}
		return false;
	}

	constructor(scene: THREE.Scene) {
		this.createGround(scene);
		this.createObstacles(scene);
		this.createAmbientProps(scene);
	}

	getGroundHeight(x: number, z: number, currentY: number, xzMargin = 0): number {
		let best = 0;
		const m = xzMargin;
		for (const p of this.platforms) {
			if (
				x >= p.box.min.x - m &&
				x <= p.box.max.x + m &&
				z >= p.box.min.z - m &&
				z <= p.box.max.z + m &&
				p.topY <= currentY + STEP_UP
			) {
				best = Math.max(best, p.topY);
			}
		}
		return best;
	}

	getGroundHeightForRing(x: number, z: number, footY: number): number {
		const footTol = 0.42;
		const edge = 0.12;
		/** 발이 상면 위로 충분히 떠 있을 때만 "위를 지나감"으로 링 투영 (다리 밑 통과 시 제외) */
		const overTol = 0.14;
		let best = 0;
		for (const p of this.platforms) {
			if (
				x < p.box.min.x - edge ||
				x > p.box.max.x + edge ||
				z < p.box.min.z - edge ||
				z > p.box.max.z + edge
			) {
				continue;
			}
			const onFeet =
				p.topY <= footY + footTol && p.topY >= footY - 0.38;
			const passingOver = footY > p.topY + overTol;
			if (onFeet || passingOver) {
				best = Math.max(best, p.topY);
			}
		}
		return best;
	}

	/**
	 * 점프·발판으로 올라갈 수 있는 낮은 플랫폼 위 랜덤 스폰 위치.
	 * @param mode health: 비교적 쉬운 곳, card: 높거나 맵 외곽이라 접근이 어려운 곳
	 */
	getPlatformLootPoint(mode: 'health' | 'card'): THREE.Vector3 | null {
		type Cand = { box: THREE.Box3; topY: number; score: number };
		const cands: Cand[] = [];
		for (const p of this.platforms) {
			if (p.topY < 0.85 || p.topY > 3.05) continue;
			const bw = p.box.max.x - p.box.min.x;
			const bd = p.box.max.z - p.box.min.z;
			if (bw < 2.2 || bd < 2.2) continue;
			const cx = (p.box.min.x + p.box.max.x) * 0.5;
			const cz = (p.box.min.z + p.box.max.z) * 0.5;
			const dist = Math.hypot(cx, cz);
			const score = p.topY * 3.4 + dist * 0.09;
			cands.push({ box: p.box, topY: p.topY, score });
		}
		if (!cands.length) return null;

		const easy   = cands.filter((c) => c.score < 10.2);
		const hard   = cands.filter((c) => c.score >= 10.0);
		const hard2  = cands.filter((c) => c.score >= 8.5);

		const pool =
			mode === 'health'
				? (easy.length ? easy : cands)
				: (hard.length ? hard : hard2.length ? hard2 : cands.filter((c) => c.score >= 7.5));
		if (!pool.length) return null;

		const pick = pool[Math.floor(Math.random() * pool.length)];
		const m = 0.55;
		const x = THREE.MathUtils.lerp(pick.box.min.x + m, pick.box.max.x - m, Math.random());
		const z = THREE.MathUtils.lerp(pick.box.min.z + m, pick.box.max.z - m, Math.random());
		return new THREE.Vector3(x, pick.topY + 0.02, z);
	}

	resolveMovement(
		fromX: number, fromZ: number,
		toX: number, toZ: number,
		y: number, radius = 0.45
	): { x: number; z: number } {
		let rx = toX, rz = toZ;
		for (const p of this.platforms) {
			if (p.topY <= y + STEP_UP) continue;
			if (y >= p.topY) continue;
			const ex0 = p.box.min.x - radius, ex1 = p.box.max.x + radius;
			const ez0 = p.box.min.z - radius, ez1 = p.box.max.z + radius;
			if (rx > ex0 && rx < ex1 && rz > ez0 && rz < ez1) {
				const fromXIn = fromX > ex0 && fromX < ex1;
				const fromZIn = fromZ > ez0 && fromZ < ez1;
				if (!fromXIn) rx = fromX;
				if (!fromZIn) rz = fromZ;
				if (rx > ex0 && rx < ex1 && rz > ez0 && rz < ez1) { rx = fromX; rz = fromZ; }
			}
		}
		return { x: rx, z: rz };
	}

	// ── GROUND ─────────────────────────────────────────────────────────────────

	private createGround(scene: THREE.Scene): void {
		const floorMat = new THREE.MeshStandardMaterial({ color: 0x242018, roughness: 0.95, metalness: 0.04 });
		this.groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_D, 1, 1), floorMat);
		this.groundMesh.rotation.x = -Math.PI / 2;
		this.groundMesh.receiveShadow = true;
		scene.add(this.groundMesh);

		const grid = new THREE.GridHelper(WORLD_W, 60, 0x3a3020, 0x2a2216);
		(grid.material as THREE.Material).opacity = 0.18;
		(grid.material as THREE.Material).transparent = true;
		scene.add(grid);
	}

	// ── OBSTACLES ──────────────────────────────────────────────────────────────

	private createObstacles(scene: THREE.Scene): void {
		// [x, z, width, topY, depth, colorHex]  topY ≤ 2.5 → 점프 가능
		const platforms: [number, number, number, number, number, number][] = [
			// 중앙 근처
			[-5, -35, 7, 1.8, 5, 0x3a3020], [8, -28, 5, 2.2, 5, 0x443822],
			[-10, 30, 6, 1.5, 6, 0x3a2e18], [12, 22, 5, 2.0, 5, 0x2a2018],
			[30, 0, 5, 2.0, 5, 0x3a2e18], [-35, -5, 6, 1.8, 5, 0x2e3018],
			[0, -55, 7, 2.5, 5, 0x3a2818], [-25, 50, 5, 2.0, 6, 0x282e18],
			// 북동
			[55, -75, 7, 2.2, 5, 0x553318], [70, -55, 5, 1.8, 6, 0x443818],
			[80, -85, 6, 2.5, 4, 0x4a3020], [40, -65, 4, 1.5, 7, 0x553322],
			[65, -30, 5, 2.0, 5, 0x3a2e18],
			// 북서
			[-65, -70, 6, 2.3, 5, 0x1e3820], [-80, -50, 7, 1.8, 6, 0x223318],
			[-50, -85, 5, 2.0, 5, 0x2a3018], [-70, -30, 5, 2.5, 4, 0x1a2e18],
			[-45, -45, 6, 1.5, 6, 0x2e3818],
			// 동쪽
			[85, 10, 6, 2.0, 5, 0x443020], [75, 35, 5, 1.8, 7, 0x3a2818],
			[90, 55, 7, 2.4, 5, 0x4a3020], [60, 65, 5, 2.0, 5, 0x3a2e18],
			// 서쪽
			[-85, 15, 7, 2.2, 5, 0x182838], [-70, 45, 6, 2.0, 5, 0x1a3028],
			[-90, 70, 5, 1.8, 7, 0x183038], [-55, 55, 5, 2.5, 5, 0x1e2a30],
			// 남쪽
			[-20, 75, 6, 1.8, 6, 0x2a2418], [25, 80, 7, 2.3, 5, 0x332818],
			[0, 90, 5, 2.0, 7, 0x2e2418], [55, 88, 5, 2.2, 6, 0x332818],
			// 추가 플랫폼
			[-15, -60, 8, 1.6, 4, 0x2e2818], [45, 15, 5, 2.4, 5, 0x382818],
			[-40, 75, 6, 2.0, 5, 0x283018], [20, -75, 5, 1.8, 6, 0x342018],
			[70, 20, 5, 2.2, 5, 0x3a2c18], [-20, -80, 6, 1.5, 5, 0x2c3018],
		];

		const edgeMat = new THREE.MeshStandardMaterial({
			color: 0xaa8822, roughness: 0.50, metalness: 0.55,
			emissive: new THREE.Color(0x241800), emissiveIntensity: 0.35
		});

		for (const [px, pz, pw, topY, pd, col] of platforms) {
			const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.88, metalness: 0.35 });
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, topY, pd), mat);
			mesh.position.set(px, topY / 2, pz);
			mesh.castShadow = true; mesh.receiveShadow = true;
			scene.add(mesh);

			const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.05, 0.05, pd + 0.05), edgeMat.clone());
			// 본체 상면(y=topY)과 겹치면 그림자 z-fighting — 테두리만 살짝 위로
			edgeMesh.position.set(px, topY + 0.028, pz);
			edgeMesh.castShadow = true;
			edgeMesh.receiveShadow = true;
			scene.add(edgeMesh);
			this.obstacleEdgeMats.push(edgeMesh.material as THREE.MeshStandardMaterial);

			const box = new THREE.Box3().setFromObject(mesh);
			this.platforms.push({ box, topY });
			this.obstacleBoxes.push(box);
		}

		// ── 고층 장벽 (이동 차단, 점프로 못 넘음) ──────────────────────────────
		// [x, z, w, h, d, color]
		const walls: [number, number, number, number, number, number][] = [
			// 산업 파이프 클러스터
			[-38, -18, 1.8, 8, 1.8, 0x2a2a35], [-36, -18, 1.6, 6, 1.6, 0x303040],
			[38, 18, 1.8, 8, 1.8, 0x2a2a35],   [36, 18, 1.6, 6, 1.6, 0x303040],
			// 높은 컨테이너 (폐기된 거대 상자)
			[-60, -20, 8, 4.5, 4, 0x1e3318], [-50, -22, 6, 5.0, 3.5, 0x152a12],
			[60, 22, 8, 4.5, 4, 0x331818],   [50, 20, 6, 5.0, 3.5, 0x2a1212],
			// 폐허 콘크리트 벽
			[0, -40, 18, 3.5, 1.5, 0x282018], [0, 40, 18, 3.5, 1.5, 0x282018],
			[-40, 0, 1.5, 3.5, 18, 0x1e2428], [40, 0, 1.5, 3.5, 18, 0x242218],
			// 타워 구조물
			[-88, -45, 2.5, 10, 2.5, 0x1a2030], [88, 45, 2.5, 10, 2.5, 0x1a2030],
			[-88, 45, 2.5, 9, 2.5, 0x201a30],   [88, -45, 2.5, 9, 2.5, 0x201a30],
			// 맵 경계 마커 타워
			[-100, -100, 3, 12, 3, 0x222028], [100, -100, 3, 12, 3, 0x222028],
			[-100, 100, 3, 12, 3, 0x222028],  [100, 100, 3, 12, 3, 0x222028],
		];

		const wallGlowMat = new THREE.MeshStandardMaterial({
			color: 0x00aaff, emissive: new THREE.Color(0x003366),
			emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.85
		});
		for (const [wx, wz, ww, wh, wd, wcol] of walls) {
			const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd),
				new THREE.MeshStandardMaterial({ color: wcol, roughness: 0.80, metalness: 0.5 }));
			m.position.set(wx, wh / 2, wz);
			m.castShadow = true; m.receiveShadow = true;
			scene.add(m);
			if (wh >= 8) {
				const cap = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.2, 0.3, wd + 0.2), wallGlowMat.clone());
				cap.position.set(wx, wh + 0.15, wz);
				cap.castShadow = true;
				cap.receiveShadow = true;
				scene.add(cap);
				this.glowMeshes.push(cap);
			}
			const wBox = new THREE.Box3().setFromObject(m);
			if (wh > 2.9) {
				this.platforms.push({ box: wBox, topY: wh });
			}
			// 벽은 항상 미사일 차단 대상에 포함
			this.obstacleBoxes.push(wBox);
		}
	}

	// ── 주변 소품 ───────────────────────────────────────────────────────────────

	private createAmbientProps(scene: THREE.Scene): void {
		// 드럼통 클러스터
		const drumMat = new THREE.MeshStandardMaterial({ color: 0x1a2a18, roughness: 0.72, metalness: 0.55 });
		const drumBandMat = new THREE.MeshStandardMaterial({ color: 0x886600, roughness: 0.5, metalness: 0.65 });
		const drumPos: [number, number][] = [
			[-60, 15], [60, -15], [-30, 60], [30, -60],
			[50, 30], [-50, -30], [75, -65], [-75, 65],
			[0, -70], [0, 70], [-90, 0], [90, 0],
			[22, 48], [-22, -48], [48, -22], [-48, 22],
		];
		for (const [dx, dz] of drumPos) {
			const d = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.9, 8), drumMat.clone());
			d.position.set(dx, 0.45, dz);
			d.castShadow = true;
			d.receiveShadow = true;
			scene.add(d);
			const b = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 8), drumBandMat.clone());
			b.position.set(dx, 0.55, dz);
			b.castShadow = true;
			b.receiveShadow = true;
			scene.add(b);
		}

		// 수직 파이프 (시각적 배경)
		const pipeMat = new THREE.MeshStandardMaterial({ color: 0x222232, roughness: 0.7, metalness: 0.6 });
		const pipePos: [number, number, number][] = [
			[-72, 6, -72], [72, 6, -72], [-72, 6, 72], [72, 6, 72],
			[-72, 5, 0],   [72, 5, 0],  [0, 5, -72],  [0, 5, 72],
			[-20, 7, -95], [20, 7, -95], [-20, 7, 95], [20, 7, 95],
		];
		for (const [px, ph, pz] of pipePos) {
			const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, ph, 8), pipeMat.clone());
			p.position.set(px, ph / 2, pz);
			p.castShadow = true;
			p.receiveShadow = true;
			scene.add(p);
			// 파이프 상단 발광 링
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 12),
				new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: new THREE.Color(0x0066aa), emissiveIntensity: 1.2 }));
			ring.rotation.x = Math.PI / 2;
			ring.position.set(px, ph + 0.05, pz);
			ring.castShadow = true;
			ring.receiveShadow = true;
			scene.add(ring);
			this.glowMeshes.push(ring as unknown as THREE.Mesh);
		}

		// 캣워크 수평 빔 (여러 위치 연결되는 가교 느낌, 시각적 전용)
		const beamMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6, metalness: 0.8 });
		const beamDefs: [number, number, number, number, number][] = [
			[-38, 3.2, -18, 6, 0], [38, 3.2, 18, 6, 0],
			[0, 3.2, -40, 0, 16], [0, 3.2, 40, 0, 16],
		];
		for (const [bx, by, bz, bw, bd] of beamDefs) {
			const w = bw > 0 ? bw : 1.2;
			const d = bd > 0 ? bd : 1.2;
			const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), beamMat.clone());
			b.position.set(bx, by, bz);
			b.castShadow = true;
			b.receiveShadow = true;
			scene.add(b);
		}
	}

	// ── 웨이브 테마 전환 ─────────────────────────────────────────────────────────

	setWaveTheme(tier: number): void {
		tier = Math.min(tier, WAVE_THEMES.length - 1);
		const t = WAVE_THEMES[tier];

		// 바닥: 어두운 배경일수록 바닥을 더 밝게
		const gMat = this.groundMesh.material as THREE.MeshStandardMaterial;
		gMat.color.setHex(t.ground);
		gMat.emissive.setHex(t.ground);
		gMat.emissiveIntensity = t.groundEmissive;

		// 장애물 엣지: 어두운 티어일수록 발광 강도 상승
		for (const mat of this.obstacleEdgeMats) {
			mat.color.setHex(t.accent);
			mat.emissive.setHex(t.emissiveHex);
			mat.emissiveIntensity = 0.15 + tier * 0.25;
		}

		// 발광 소품: glowMult에 따라 emissiveIntensity 증폭
		const glowColors = [0x003388, 0x883300, 0x0044cc, 0xcc0022, 0x8800cc];
		for (const mesh of this.glowMeshes) {
			const mat = mesh.material as THREE.MeshStandardMaterial;
			if (!mat?.isMeshStandardMaterial) continue;
			mat.emissive.setHex(glowColors[tier]);
			mat.emissiveIntensity = t.glowMult;
		}
	}
}
