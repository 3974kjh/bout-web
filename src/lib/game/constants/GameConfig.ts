import type { MechBase } from '$lib/domain/types';

export const GRAVITY = -32;
export const JUMP_FORCE = 13;
/** Lv10부터 공중 2단 점프 */
export const DOUBLE_JUMP_MIN_LEVEL = 10;
/** MechModel form 7(Lv17~) — 날개 비행(스페이스 길게 누름) */
export const WING_GLIDE_MIN_FORM = 7;
/** 공중에서 스페이스/C 길게 눌러 비행 시작 (ms) */
export const GLIDE_HOLD_TO_START_MS = 240;
/** 비행 유지: 스페이스를 누르는 동안, 최대 지속 (ms) */
export const GLIDE_MAX_DURATION_MS = 2800;
/** 2단 점프 상승력 배율 */
export const DOUBLE_JUMP_FORCE_MULT = 0.88;
export const COMBO_WINDOW_MS = 450;
// Index 4 = aerial slam attack
export const ATTACK_DURATIONS_MS = [220, 220, 280, 380, 320];
export const ATTACK_COOLDOWN_MS = 350;
export const GUARD_REDUCE = 0.7;
export const STUN_MS = 500;
export const IFRAME_MS = 800;
export const MELEE_RANGE = 4.5;
export const PLAYER_RADIUS = 0.45;
export const STEP_UP_HEIGHT = 0.4;
export const GAUGE_ON_DEAL = 5;
export const GAUGE_ON_TAKE = 8;
export const TRANSFORM_DRAIN_PER_SEC = 18;
export const TRANSFORM_MULT = { attack: 1.5, defense: 1.3, speed: 1.25 };

export const SPRINT_MULT = 1.85;
export const AERIAL_ATTACK_RANGE = 4.0;
export const AERIAL_ATTACK_MULT = 1.6;

export const KNOCKDOWN_THRESHOLD = 6;
export const KNOCKDOWN_MS = 1200;

// ── 대쉬 ──────────────────────────────────────────────────────────────────────
export const DASH_COOLDOWN = 3.0;   // 기본 쿨타임(초)
export const DASH_SPEED    = 68;    // 대쉬 초기 속도 (units/s)
export const DASH_DECEL    = 240;   // 감속도 (units/s²) — 약 0.28s 동안 약 8 유닛 이동

/** true일 때 `expressive`·`soldier`는 GLTF 스키닝 캐릭터 로드. 다른 기체는 절차 메쉬만 사용. */
export const PLAYER_USE_SKINNED_GLTF = true;

export function playerUsesSkinnedGltfForBase(mechBase: MechBase): boolean {
	return PLAYER_USE_SKINNED_GLTF && (mechBase === 'expressive' || mechBase === 'soldier');
}

/**
 * 스키닝 GLTF — `static/models/*.glb`를 `/models/…`로 서빙(1순위), 실패 시 CDN.
 * @see static/models/README.md
 */
export const PLAYER_GLTF_URLS: string[] = [
	'/models/player.glb',
	'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb'
];

export const SOLDIER_GLTF_URLS: string[] = [
	'/models/soldier.glb',
	'https://threejs.org/examples/models/gltf/Soldier.glb'
];

export function playerGltfUrlListForBase(mechBase: MechBase): string[] {
	if (mechBase === 'soldier') return SOLDIER_GLTF_URLS;
	return PLAYER_GLTF_URLS;
}

/** 인게임 Player vs 정비소·랭킹·HUD 등 프리뷰 — `modelRotationY`가 서로 반대 */
export type SkinnedGltfLoadContext = 'gameplay' | 'preview';

/** GLTF 정렬·스케일 (필요 시 기체별·컨텍스트별로 조정) */
export function skinnedGltfLoadOptionsForBase(
	mechBase: MechBase,
	context: SkinnedGltfLoadContext = 'gameplay'
): {
	modelRotationY: number;
	targetHeight: number;
} {
	/**
	 * gameplay: 필드 기준. 솔저는 π, 익스프레시브는 0.
	 * preview: 정비소·랭킹·HUD에서 보이는 방향을 맞추기 위해 위와 반대(솔저 0 / 익스프레시브 π).
	 */
	if (context === 'gameplay') {
		if (mechBase === 'soldier') return { modelRotationY: Math.PI, targetHeight: 2.85 };
		return { modelRotationY: 0, targetHeight: 2.85 };
	}
	if (mechBase === 'soldier') return { modelRotationY: 0, targetHeight: 2.85 };
	return { modelRotationY: Math.PI, targetHeight: 2.85 };
}

/**
 * `PLAYER_USE_SKINNED_GLTF` 가 false 일 때 필드(Player)에서만 절차 메쉬 기체의 시각적 전방을 뒤짐.
 * 하이퍼슈트·아조나스·게렌은 메쉬 축이 다른 기체와 달라 `skinnedGltfLoadOptionsForBase` 의 gameplay/preview 반전과 같은 역할.
 */
export function proceduralGameplayExtraRotationY(mechBase: MechBase): number {
	if (PLAYER_USE_SKINNED_GLTF) return 0;
	if (mechBase === 'hypersuit' || mechBase === 'azonas-v' || mechBase === 'geren') {
		return Math.PI;
	}
	return 0;
}

// ── 게임 오버 점수 (정수 합산) ───────────────────────────────────────────────
export type ScoreBossKind = 'bear' | 'wolf' | 'dragon' | 'tiger' | 'ironlord';

/** 단계별 보스 1마리당 기본 점수 (난이도 순) */
export const SCORE_BOSS_BASE_PER_KILL: Record<ScoreBossKind, number> = {
	bear: 95,
	wolf: 145,
	dragon: 210,
	tiger: 275,
	ironlord: 350
};

/** 레벨 1당 기본 점수 (가중 전) */
export const SCORE_LEVEL_FACTOR = 72;
/** 생존 1초당 기본 점수 (가중 전) */
export const SCORE_TIME_FACTOR = 6;

/** 카메라 앞 **한 면**의 가로·세로 세그먼트 수 (2 → 면을 2×2 조각 메쉬로 분할, UV는 한 장에 연속) */
export const BACKGROUND_PLANE_SUBDIV = 2;
/** 그 면 전체에 텍스처를 가로·세로 몇 번 **반복**(타일)할지 — `RepeatWrapping` */
export const BACKGROUND_TEXTURE_REPEAT = 2;

/** PNG 세트 개수 — `static/images/background/background_{1..N}.png` (맵·건물과 동일 번호 체계) */
export const BACKGROUND_IMAGE_COUNT = 6;

/**
 * 진화 F 단계(form 0~8) → 배경·맵·건물 공통 이미지 번호 `_{1..6}.png`
 * F0–F1 → 1, F2–F3 → 2, F4–F5 → 3, F6 → 4, F7 → 5, F8 → 6
 */
export function visualThemeImageIndexFromForm(form: number): number {
	const f = Math.min(Math.max(Math.floor(form), 0), 8);
	if (f <= 1) return 1;
	if (f <= 3) return 2;
	if (f <= 5) return 3;
	if (f === 6) return 4;
	if (f === 7) return 5;
	return 6;
}

/** 이 시간(초)까지 생존하면 승리 */
export const VICTORY_SURVIVAL_SECONDS = 15 * 60;

/**
 * 이 레벨을 **초과**하면(20+) 일반·보스 스폰·스탯·적 탄속이 급격히 강화된다.
 */
export const LEVEL_BRUTAL_AFTER = 19;

/** 레벨 21+ 극난이도 배율 — 스폰·스탯·보스·탄속 */
export function lateGameBrutality(level: number): {
	statMul: number;
	spawnIntervalMul: number;
	bossStatMul: number;
	maxAliveMul: number;
	enemyProjectileSpeedMul: number;
} {
	if (level <= LEVEL_BRUTAL_AFTER) {
		return {
			statMul: 1,
			spawnIntervalMul: 1,
			bossStatMul: 1,
			maxAliveMul: 1,
			enemyProjectileSpeedMul: 1
		};
	}
	const steps = Math.min(level - LEVEL_BRUTAL_AFTER, 30);
	return {
		statMul: 1.72 + steps * 0.065,
		spawnIntervalMul: 0.34,
		bossStatMul: 1.58 + steps * 0.045,
		maxAliveMul: 1.24,
		enemyProjectileSpeedMul: 1.28 + steps * 0.018
	};
}

/** 보스 처치 항 가중치 (가장 큼) */
export const SCORE_W_BOSS = 1.35;
/** 레벨 달성 항 가중치 */
export const SCORE_W_LEVEL = 1.0;
/** 생존 시간 항 가중치 */
export const SCORE_W_TIME = 0.55;

export interface RunScoreBreakdown {
	partBoss: number;
	partLevel: number;
	partTime: number;
	total: number;
}

export function computeRunScore(args: {
	level: number;
	survivalSeconds: number;
	bossKills: Record<ScoreBossKind, number>;
}): RunScoreBreakdown {
	const bossRaw = (Object.keys(args.bossKills) as ScoreBossKind[]).reduce(
		(sum, k) => sum + args.bossKills[k] * SCORE_BOSS_BASE_PER_KILL[k],
		0
	);
	const lv = Math.max(1, Math.floor(args.level));
	const levelRaw = lv * SCORE_LEVEL_FACTOR;
	const t = Math.max(0, Math.floor(args.survivalSeconds));
	const timeRaw = t * SCORE_TIME_FACTOR;

	const partBoss = Math.floor(bossRaw * SCORE_W_BOSS);
	const partLevel = Math.floor(levelRaw * SCORE_W_LEVEL);
	const partTime = Math.floor(timeRaw * SCORE_W_TIME);
	const total = partBoss + partLevel + partTime;

	return { partBoss, partLevel, partTime, total };
}
