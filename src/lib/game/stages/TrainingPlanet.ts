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
/** 바닥 맵 이미지 한 타일이 차지하는 월드 XZ 크기 (이미지를 이 크기로 반복 깔음) */
export const GROUND_MAP_TILE_SIZE = 10;
/** `static/images/map/map_{1..N}.png` 개수 — 티어에 따라 순서대로 교체 */
export const GROUND_MAP_IMAGE_COUNT = 6;
/** `static/images/building/building_{1..N}.png` 개수 — 구조물(플랫폼·벽) 텍스처 */
export const BUILDING_IMAGE_COUNT = 6;
/** 파사드 텍스처 가로·세로 반복 기준(월드 유닛) — 넓은 면에 타일이 반복되도록 */
const FACADE_REPEAT_UNIT_XZ = 10;
const FACADE_REPEAT_UNIT_Y = 15;
const STEP_UP = 0.4;

/** 박스 중심 (cx,cz)과 반폭 halfW/halfD를 스테이지 AABB 안으로 맞춤 (시각·충돌이 맵 밖으로 나가지 않게) */
function clampAabbCenterXZ(
	cx: number,
	cz: number,
	halfW: number,
	halfD: number,
	minX: number,
	maxX: number,
	minZ: number,
	maxZ: number
): { x: number; z: number } {
	const cxMin = minX + halfW;
	const cxMax = maxX - halfW;
	const czMin = minZ + halfD;
	const czMax = maxZ - halfD;
	const x = cxMin <= cxMax ? THREE.MathUtils.clamp(cx, cxMin, cxMax) : (minX + maxX) * 0.5;
	const z = czMin <= czMax ? THREE.MathUtils.clamp(cz, czMin, czMax) : (minZ + maxZ) * 0.5;
	return { x, z };
}

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
	/** 로드된 바닥 맵 텍스처 (웨이브 틴트 시 유지) */
	private groundMapTexture: THREE.Texture | null = null;
	/** 현재 적용 중인 맵 이미지 번호 1..GROUND_MAP_IMAGE_COUNT */
	private groundMapImageIndex = 0;
	/** 비동기 로드 중인 이미지 번호 (같은 맵 중복 로드 방지) */
	private groundMapLoadingIndex = 0;
	private lastWaveTier = 0;
	/**
	 * 플랫폼·벽 박스 (6면 재질: ±X/±Z 파사드, +Y 지붕, -Y 바닥면=바닥 맵)
	 * @see https://threejs.org/docs/#api/en/geometries/BoxGeometry — materials 순서 +X,-X,+Y,-Y,+Z,-Z
	 */
	private buildingMeshes: THREE.Mesh[] = [];
	/** 각 건물 메시의 파사드 기준색(틴트 복원용) */
	private buildingMeshFacadeColors: number[] = [];
	private buildingTexture: THREE.Texture | null = null;
	private buildingImageIndex = 0;
	private buildingLoadingIndex = 0;
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

	/** resolveMovement / pushOutOfObstacles 공통: 이 높이에서 수평으로 막는 장애물인지 */
	private blocksHorizontalCollision(p: Platform, y: number): boolean {
		if (p.topY <= y + STEP_UP) return false;
		if (y >= p.topY) return false;
		return true;
	}

	resolveMovement(
		fromX: number, fromZ: number,
		toX: number, toZ: number,
		y: number, radius = 0.45
	): { x: number; z: number } {
		let rx = toX, rz = toZ;
		for (const p of this.platforms) {
			if (!this.blocksHorizontalCollision(p, y)) continue;
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

	pushOutOfObstacles(x: number, z: number, y: number, radius = 0.45): { x: number; z: number } {
		const EPS = 0.004;
		let px = x;
		let pz = z;
		for (let iter = 0; iter < 10; iter++) {
			let changed = false;
			for (const p of this.platforms) {
				if (!this.blocksHorizontalCollision(p, y)) continue;
				const ex0 = p.box.min.x - radius;
				const ex1 = p.box.max.x + radius;
				const ez0 = p.box.min.z - radius;
				const ez1 = p.box.max.z + radius;
				if (!(px > ex0 && px < ex1 && pz > ez0 && pz < ez1)) continue;
				const dl = px - ex0;
				const dr = ex1 - px;
				const db = pz - ez0;
				const df = ez1 - pz;
				let which = 0;
				let m = dl;
				if (dr < m) { m = dr; which = 1; }
				if (db < m) { m = db; which = 2; }
				if (df < m) { m = df; which = 3; }
				if (which === 0) px = ex0 - EPS;
				else if (which === 1) px = ex1 + EPS;
				else if (which === 2) pz = ez0 - EPS;
				else pz = ez1 + EPS;
				changed = true;
			}
			if (!changed) break;
		}
		return { x: px, z: pz };
	}

	// ── GROUND ─────────────────────────────────────────────────────────────────

	private createGround(scene: THREE.Scene): void {
		// 바닥 평면: 예시처럼 PlaneGeometry(가로, 세로) 후 X축 -90° 회전 → XZ 바닥
		const floorMat = new THREE.MeshStandardMaterial({
			color: 0x242018,
			roughness: 0.92,
			metalness: 0.03
		});
		this.groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_D), floorMat);
		this.groundMesh.rotation.x = -Math.PI / 2;
		this.groundMesh.receiveShadow = true;
		scene.add(this.groundMesh);

		this.requestGroundMapTexture(this.lastWaveTier);

		const grid = new THREE.GridHelper(WORLD_W, 60, 0x3a3020, 0x2a2216);
		(grid.material as THREE.Material).opacity = 0.18;
		(grid.material as THREE.Material).transparent = true;
		scene.add(grid);

		this.addMapBoundary(scene);
	}

	/** 맵 플레이 경계(바닥과 동일 AABB)를 빨간 테두리로 표시 */
	private addMapBoundary(scene: THREE.Scene): void {
		const { minX: bx, maxX: bX, minZ: bz, maxZ: bZ } = this.bounds;
		const tw = 0.55;
		const th = 0.14;
		const y = th * 0.5 + 0.02;
		const mat = new THREE.MeshStandardMaterial({
			color: 0xe83028,
			emissive: new THREE.Color(0x501010),
			emissiveIntensity: 0.5,
			roughness: 0.42,
			metalness: 0.18
		});
		const spanX = bX - bx;
		const spanZ = bZ - bz;
		const addStrip = (w: number, d: number, cx: number, cz: number) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mat.clone());
			m.position.set(cx, y, cz);
			m.receiveShadow = true;
			m.castShadow = false;
			scene.add(m);
		};
		addStrip(spanX + tw * 2, tw, (bx + bX) * 0.5, bz + tw * 0.5);
		addStrip(spanX + tw * 2, tw, (bx + bX) * 0.5, bZ - tw * 0.5);
		addStrip(tw, spanZ + tw * 2, bx + tw * 0.5, (bz + bZ) * 0.5);
		addStrip(tw, spanZ + tw * 2, bX - tw * 0.5, (bz + bZ) * 0.5);

		const edgeGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(WORLD_W, WORLD_D));
		const rim = new THREE.LineSegments(
			edgeGeom,
			new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.95 })
		);
		rim.rotation.x = -Math.PI / 2;
		rim.position.y = th + 0.06;
		scene.add(rim);
	}

	// ── OBSTACLES ──────────────────────────────────────────────────────────────

	/** BoxGeometry 면 순서: +X,-X,+Y(지붕),-Y(바닥),+Z,-Z — 파사드 4면 / 상·하 단색 */
	private createBuildingBoxMaterials(facadeColor: number): THREE.MeshStandardMaterial[] {
		const roof = new THREE.Color(facadeColor).multiplyScalar(0.14).getHex();
		const floor = new THREE.Color(facadeColor).multiplyScalar(0.2).getHex();
		const mk = (c: number, rough: number, metal: number) =>
			new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
		return [
			mk(facadeColor, 0.82, 0.26),
			mk(facadeColor, 0.82, 0.26),
			mk(roof, 0.9, 0.12),
			mk(floor, 0.88, 0.22),
			mk(facadeColor, 0.82, 0.26),
			mk(facadeColor, 0.82, 0.26)
		];
	}

	private createObstacles(scene: THREE.Scene): void {
		const bx = this.bounds.minX;
		const bX = this.bounds.maxX;
		const bz = this.bounds.minZ;
		const bZ = this.bounds.maxZ;

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

		for (const [px0, pz0, pw, topY, pd, col] of platforms) {
			const hw = pw * 0.5;
			const hd = pd * 0.5;
			const { x: px, z: pz } = clampAabbCenterXZ(px0, pz0, hw, hd, bx, bX, bz, bZ);
			const mats = this.createBuildingBoxMaterials(col);
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, topY, pd), mats);
			mesh.position.set(px, topY / 2, pz);
			mesh.castShadow = true; mesh.receiveShadow = true;
			scene.add(mesh);
			this.buildingMeshes.push(mesh);
			this.buildingMeshFacadeColors.push(col);

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
		for (const [wx0, wz0, ww, wh, wd, wcol] of walls) {
			const hww = ww * 0.5;
			const hwd = wd * 0.5;
			const { x: wx, z: wz } = clampAabbCenterXZ(wx0, wz0, hww, hwd, bx, bX, bz, bZ);
			const wmats = this.createBuildingBoxMaterials(wcol);
			const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wmats);
			m.position.set(wx, wh / 2, wz);
			m.castShadow = true; m.receiveShadow = true;
			scene.add(m);
			this.buildingMeshes.push(m);
			this.buildingMeshFacadeColors.push(wcol);
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

		this.requestBuildingTexture(this.lastWaveTier);
	}

	// ── 주변 소품 ───────────────────────────────────────────────────────────────

	private createAmbientProps(scene: THREE.Scene): void {
		const bx = this.bounds.minX;
		const bX = this.bounds.maxX;
		const bz = this.bounds.minZ;
		const bZ = this.bounds.maxZ;

		// 드럼통 클러스터
		const drumMat = new THREE.MeshStandardMaterial({ color: 0x1a2a18, roughness: 0.72, metalness: 0.55 });
		const drumBandMat = new THREE.MeshStandardMaterial({ color: 0x886600, roughness: 0.5, metalness: 0.65 });
		const drumHalf = 0.35;
		const drumPos: [number, number][] = [
			[-60, 15], [60, -15], [-30, 60], [30, -60],
			[50, 30], [-50, -30], [75, -65], [-75, 65],
			[0, -70], [0, 70], [-90, 0], [90, 0],
			[22, 48], [-22, -48], [48, -22], [-48, 22],
		];
		for (const [dx0, dz0] of drumPos) {
			const { x: dx, z: dz } = clampAabbCenterXZ(dx0, dz0, drumHalf, drumHalf, bx, bX, bz, bZ);
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
		const pipeR = 0.45;
		const pipePos: [number, number, number][] = [
			[-72, 6, -72], [72, 6, -72], [-72, 6, 72], [72, 6, 72],
			[-72, 5, 0],   [72, 5, 0],  [0, 5, -72],  [0, 5, 72],
			[-20, 7, -95], [20, 7, -95], [-20, 7, 95], [20, 7, 95],
		];
		for (const [px0, ph, pz0] of pipePos) {
			const { x: px, z: pz } = clampAabbCenterXZ(px0, pz0, pipeR, pipeR, bx, bX, bz, bZ);
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
		for (const [bx0, by, bz0, bw, bd] of beamDefs) {
			const w = bw > 0 ? bw : 1.2;
			const d = bd > 0 ? bd : 1.2;
			const { x: bx1, z: bz1 } = clampAabbCenterXZ(bx0, bz0, w * 0.5, d * 0.5, bx, bX, bz, bZ);
			const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), beamMat.clone());
			b.position.set(bx1, by, bz1);
			b.castShadow = true;
			b.receiveShadow = true;
			scene.add(b);
		}
	}

	// ── 웨이브 테마 전환 ─────────────────────────────────────────────────────────

	/** 난이도 티어 → `map_{1+N}.png` (티어 0→map_1 … 티어가 이미지 수를 넘기면 map_N으로 고정) */
	private requestGroundMapTexture(tier: number): void {
		const index = Math.min(Math.max(0, tier) + 1, GROUND_MAP_IMAGE_COUNT);
		if (index === this.groundMapImageIndex && this.groundMapTexture) return;
		if (this.groundMapLoadingIndex === index) return;

		this.groundMapImageIndex = index;
		this.groundMapLoadingIndex = index;
		const url = `/images/map/map_${index}.png`;
		const floorMat = this.groundMesh.material as THREE.MeshStandardMaterial;
		const loader = new THREE.TextureLoader();
		const loadIndex = index;

		loader.load(
			url,
			(texture) => {
				this.groundMapLoadingIndex = 0;
				if (loadIndex !== this.groundMapImageIndex) {
					texture.dispose();
					return;
				}
				if (this.groundMapTexture) {
					this.groundMapTexture.dispose();
				}
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set(WORLD_W / GROUND_MAP_TILE_SIZE, WORLD_D / GROUND_MAP_TILE_SIZE);
				texture.flipY = false;
				texture.anisotropy = 8;
				this.groundMapTexture = texture;
				floorMat.map = texture;
				floorMat.needsUpdate = true;
				this.applyGroundWaveTint(this.lastWaveTier);
				this.applyBuildingFloorMapsFromGround();
				this.applyBuildingWaveTint(this.lastWaveTier);
			},
			undefined,
			() => {
				this.groundMapLoadingIndex = 0;
				if (loadIndex !== this.groundMapImageIndex) return;
				this.groundMapTexture = null;
				floorMat.map = null;
				floorMat.color.setHex(0x242018);
				this.applyGroundWaveTint(this.lastWaveTier);
				this.clearBuildingBottomFaceMaps();
			}
		);
	}

	private applyGroundWaveTint(tier: number): void {
		tier = Math.min(tier, WAVE_THEMES.length - 1);
		const t = WAVE_THEMES[tier];
		const gMat = this.groundMesh.material as THREE.MeshStandardMaterial;
		if (this.groundMapTexture) {
			const tint = new THREE.Color(t.ground);
			const white = new THREE.Color(0xffffff);
			gMat.color.copy(tint).lerp(white, 0.58);
			gMat.emissive.copy(tint).lerp(white, 0.75);
			gMat.emissiveIntensity = t.groundEmissive * 0.32;
		} else {
			gMat.color.setHex(t.ground);
			gMat.emissive.setHex(t.ground);
			gMat.emissiveIntensity = t.groundEmissive;
		}
	}

	setWaveTheme(tier: number): void {
		tier = Math.min(tier, WAVE_THEMES.length - 1);
		this.lastWaveTier = tier;
		const t = WAVE_THEMES[tier];

		this.applyGroundWaveTint(tier);

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

		this.applyBuildingWaveTint(tier);
		this.requestGroundMapTexture(tier);
		this.requestBuildingTexture(tier);
	}

	/** 건물 박스 -Y 면: 바닥(맵) 텍스처 — 박스 가로·세로에 맞게 repeat */
	private applyBuildingFloorMapsFromGround(): void {
		if (!this.groundMapTexture || this.buildingMeshes.length === 0) return;
		for (let mi = 0; mi < this.buildingMeshes.length; mi++) {
			const mesh = this.buildingMeshes[mi];
			const mats = mesh.material as THREE.MeshStandardMaterial[];
			if (mats[3].map) {
				mats[3].map.dispose();
			}
			const g = mesh.geometry as THREE.BoxGeometry;
			const W = g.parameters.width;
			const D = g.parameters.depth;
			const t = this.groundMapTexture.clone();
			t.colorSpace = THREE.SRGBColorSpace;
			t.wrapS = THREE.RepeatWrapping;
			t.wrapT = THREE.RepeatWrapping;
			t.repeat.set(Math.max(0.2, W / GROUND_MAP_TILE_SIZE), Math.max(0.2, D / GROUND_MAP_TILE_SIZE));
			t.flipY = false;
			t.anisotropy = 8;
			mats[3].map = t;
			mats[3].needsUpdate = true;
		}
	}

	private clearBuildingBottomFaceMaps(): void {
		for (const mesh of this.buildingMeshes) {
			const mats = mesh.material as THREE.MeshStandardMaterial[];
			if (mats[3].map) {
				mats[3].map.dispose();
				mats[3].map = null;
			}
			mats[3].needsUpdate = true;
		}
		this.applyBuildingWaveTint(this.lastWaveTier);
	}

	/** 파사드(±X,±Z) 및 바닥면 맵 해제 — 텍스처 교체 전 */
	private disposeBuildingMeshTextureMaps(mesh: THREE.Mesh): void {
		const mats = mesh.material as THREE.MeshStandardMaterial[];
		for (const i of [0, 1, 3, 4, 5]) {
			if (mats[i].map) {
				mats[i].map!.dispose();
				mats[i].map = null;
			}
		}
	}

	/** 파사드: 박스 크기에 따라 repeat (±X는 D×H, ±Z는 W×H) */
	private applyFacadeTexturesToAllBuildings(facadeBase: THREE.Texture): void {
		facadeBase.wrapS = THREE.RepeatWrapping;
		facadeBase.wrapT = THREE.RepeatWrapping;
		facadeBase.colorSpace = THREE.SRGBColorSpace;

		for (const mesh of this.buildingMeshes) {
			const g = mesh.geometry as THREE.BoxGeometry;
			const W = g.parameters.width;
			const H = g.parameters.height;
			const D = g.parameters.depth;
			const mats = mesh.material as THREE.MeshStandardMaterial[];

			const repUxd = Math.max(0.25, D / FACADE_REPEAT_UNIT_XZ);
			const repUz = Math.max(0.25, W / FACADE_REPEAT_UNIT_XZ);
			const repV = Math.max(0.35, H / FACADE_REPEAT_UNIT_Y);

			const txd = facadeBase.clone();
			txd.repeat.set(repUxd, repV);
			txd.anisotropy = 8;
			mats[0].map = txd;
			mats[1].map = txd;

			const tzd = facadeBase.clone();
			tzd.repeat.set(repUz, repV);
			tzd.anisotropy = 8;
			mats[4].map = tzd;
			mats[5].map = tzd;

			for (const i of [0, 1, 4, 5]) {
				mats[i].roughness = 0.82;
				mats[i].metalness = 0.26;
				mats[i].needsUpdate = true;
			}
		}
	}

	/** 난이도 티어 → `building_{1+N}.png` — 4면 파사드 + 바닥면은 바닥 맵 세트 */
	private requestBuildingTexture(tier: number): void {
		if (this.buildingMeshes.length === 0) return;
		const index = Math.min(Math.max(0, tier) + 1, BUILDING_IMAGE_COUNT);
		if (index === this.buildingImageIndex && this.buildingTexture) return;
		if (this.buildingLoadingIndex === index) return;

		this.buildingImageIndex = index;
		this.buildingLoadingIndex = index;
		const url = `/images/building/building_${index}.png`;
		const loader = new THREE.TextureLoader();
		const loadIndex = index;

		loader.load(
			url,
			(texture) => {
				this.buildingLoadingIndex = 0;
				if (loadIndex !== this.buildingImageIndex) {
					texture.dispose();
					return;
				}
				for (const mesh of this.buildingMeshes) {
					this.disposeBuildingMeshTextureMaps(mesh);
				}
				if (this.buildingTexture) {
					this.buildingTexture.dispose();
				}

				texture.colorSpace = THREE.SRGBColorSpace;
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set(1, 1);
				texture.anisotropy = 8;
				this.buildingTexture = texture;

				this.applyFacadeTexturesToAllBuildings(texture);
				this.applyBuildingFloorMapsFromGround();
				this.applyBuildingWaveTint(this.lastWaveTier);
			},
			undefined,
			() => {
				this.buildingLoadingIndex = 0;
				if (loadIndex !== this.buildingImageIndex) return;
				for (const mesh of this.buildingMeshes) {
					this.disposeBuildingMeshTextureMaps(mesh);
				}
				if (this.buildingTexture) {
					this.buildingTexture.dispose();
					this.buildingTexture = null;
				}
				this.applyBuildingWaveTint(this.lastWaveTier);
			}
		);
	}

	private applyBuildingWaveTint(tier: number): void {
		if (this.buildingMeshes.length === 0) return;
		tier = Math.min(tier, WAVE_THEMES.length - 1);
		const t = WAVE_THEMES[tier];
		const tint = new THREE.Color(t.accent);
		const white = new THREE.Color(0xffffff);
		const gt = new THREE.Color(t.ground);

		for (let mi = 0; mi < this.buildingMeshes.length; mi++) {
			const mesh = this.buildingMeshes[mi];
			const mats = mesh.material as THREE.MeshStandardMaterial[];
			const baseCol = this.buildingMeshFacadeColors[mi];

			if (this.buildingTexture && mats[0].map) {
				const facadeTint = tint.clone().lerp(white, 0.48);
				for (const i of [0, 1, 4, 5]) {
					mats[i].color.copy(facadeTint);
					mats[i].emissive.copy(tint).lerp(white, 0.78);
					mats[i].emissiveIntensity = 0.05 + tier * 0.038;
				}
			} else {
				const c = new THREE.Color(baseCol).lerp(tint, 0.22);
				for (const i of [0, 1, 4, 5]) {
					mats[i].color.copy(c);
					mats[i].emissive.setHex(0x000000);
					mats[i].emissiveIntensity = 0;
				}
			}

			mats[2].color.copy(new THREE.Color(0x020d14).lerp(tint, 0.4));
			mats[2].emissive.setHex(0x000000);

			if (mats[3].map && this.groundMapTexture) {
				mats[3].color.copy(gt).lerp(white, 0.55);
				mats[3].emissive.copy(gt).lerp(white, 0.75);
				mats[3].emissiveIntensity = t.groundEmissive * 0.28;
			} else {
				const fb = new THREE.Color(baseCol);
				fb.multiplyScalar(0.2);
				fb.lerp(tint, 0.15);
				mats[3].color.copy(fb);
				mats[3].emissive.setHex(0x000000);
				mats[3].emissiveIntensity = 0;
			}
		}
	}
}
