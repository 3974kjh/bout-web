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

/** GLTF 정렬·스케일 (필요 시 기체별로 조정) */
export function skinnedGltfLoadOptionsForBase(mechBase: MechBase): {
	modelRotationY: number;
	targetHeight: number;
} {
	/**
	 * 절차 메쉬·익스프레시브: 얼굴 -Z — Player lookAt으로 -Z가 이동 방향.
	 * Soldier.glb(three.js 예제)는 기본 방향이 이미 그 규약에 맞아 π를 주면 걷기 클립이 반대로 보임.
	 */
	if (mechBase === 'soldier') return { modelRotationY: 0, targetHeight: 2.85 };
	return { modelRotationY: Math.PI, targetHeight: 2.85 };
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

/** 이 시간(초)까지 생존하면 승리 */
export const VICTORY_SURVIVAL_SECONDS = 20 * 60;

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
