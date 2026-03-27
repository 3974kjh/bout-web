import type { PlayerUpgrades } from '$lib/domain/types';

export interface UpgradeCardDef {
	id: string;
	name: string;
	description: string;
	emoji: string;
	rarity: 'common' | 'rare' | 'epic';
	apply: (u: PlayerUpgrades) => void;
}

/** 직렬화 가능한 카드 정보 (EventBus, HUD용) */
export interface UpgradeCardInfo {
	id: string;
	name: string;
	description: string;
	emoji: string;
	rarity: 'common' | 'rare' | 'epic';
}

// ──────────────────────────────────────────────────────────────────────────────
//  업그레이드 카드 정의 (20종)
// ──────────────────────────────────────────────────────────────────────────────
const ALL_UPGRADES: UpgradeCardDef[] = [
	// ── Common ──
	{
		id: 'fire_rate',
		name: '연사 강화',
		description: '미사일 발사 속도 30% 증가',
		emoji: '⚡',
		rarity: 'common',
		apply: (u) => { u.fireRateMs = Math.max(200, u.fireRateMs * 0.70); }
	},
	{
		id: 'missile_damage',
		name: '미사일 강화',
		description: '미사일 데미지 +25%',
		emoji: '💥',
		rarity: 'common',
		apply: (u) => { u.missileDamage = Math.floor(u.missileDamage * 1.25); }
	},
	{
		id: 'missile_speed',
		name: '미사일 속도',
		description: '미사일 비행 속도 +30%',
		emoji: '🚀',
		rarity: 'common',
		apply: (u) => { u.missileSpeed *= 1.30; }
	},
	{
		id: 'move_speed',
		name: '이동 속도',
		description: '이동 속도 +18%',
		emoji: '👟',
		rarity: 'common',
		apply: (u) => { u.moveSpeedMult *= 1.18; }
	},
	{
		id: 'hp_restore',
		name: '긴급 수리',
		description: '현재 최대 HP의 40% 즉시 회복',
		emoji: '🔧',
		rarity: 'common',
		apply: (u) => { u.pendingHealPct = 0.4; }
	},
	{
		id: 'max_hp',
		name: '장갑 강화',
		description: '최대 HP +30%',
		emoji: '🛡️',
		rarity: 'common',
		apply: (u) => { u.maxHpMult *= 1.30; }
	},
	{
		id: 'max_hp_2',
		name: '합금 장갑',
		description: '최대 HP +42%',
		emoji: '🧱',
		rarity: 'rare',
		apply: (u) => { u.maxHpMult *= 1.42; }
	},
	{
		id: 'max_hp_3',
		name: '리액터 코어',
		description: '최대 HP +60%',
		emoji: '🛰️',
		rarity: 'epic',
		apply: (u) => { u.maxHpMult *= 1.60; }
	},
	{
		id: 'collect_range',
		name: '자석 범위',
		description: 'EXP 수집 범위 ×1.6',
		emoji: '🧲',
		rarity: 'common',
		apply: (u) => { u.collectRange *= 1.6; u.magnetRange *= 1.4; }
	},
	// ── 대쉬 관련 ──
	{
		id: 'dash_cooldown_1',
		name: '대쉬 가속 I',
		description: '대쉬 쿨타임 -25%',
		emoji: '💨',
		rarity: 'common',
		apply: (u) => { u.dashCooldownMult = Math.max(0.20, (u.dashCooldownMult ?? 1.0) * 0.75); }
	},
	{
		id: 'dash_cooldown_2',
		name: '대쉬 가속 II',
		description: '대쉬 쿨타임 -40%',
		emoji: '🌪️',
		rarity: 'rare',
		apply: (u) => { u.dashCooldownMult = Math.max(0.20, (u.dashCooldownMult ?? 1.0) * 0.60); }
	},
	{
		id: 'dash_cooldown_3',
		name: '순간이동 부스터',
		description: '대쉬 쿨타임 -60%',
		emoji: '⚡',
		rarity: 'epic',
		apply: (u) => { u.dashCooldownMult = Math.max(0.20, (u.dashCooldownMult ?? 1.0) * 0.40); }
	},
	// ── Rare ──
	{
		id: 'multi_shot',
		name: '멀티샷',
		description: '미사일 +1발 동시 발사',
		emoji: '🔱',
		rarity: 'rare',
		apply: (u) => { u.missileCount += 1; }
	},
	{
		id: 'piercing',
		name: '관통 미사일',
		description: '미사일이 적을 관통 (+1)',
		emoji: '🔻',
		rarity: 'rare',
		apply: (u) => { u.piercingCount += 1; }
	},
	{
		id: 'homing',
		name: '유도 미사일',
		description: '미사일이 적을 자동 추적',
		emoji: '🎯',
		rarity: 'rare',
		apply: (u) => { u.isHoming = true; }
	},
	{
		id: 'big_missile',
		name: '대형 미사일',
		description: '미사일 크기 +50%, 데미지 +40%',
		emoji: '💣',
		rarity: 'rare',
		apply: (u) => { u.missileScale *= 1.5; u.missileDamage = Math.floor(u.missileDamage * 1.40); }
	},
	{
		id: 'triple_fire',
		name: '3방향 발사',
		description: '정면 외 좌우 ±25° 추가 발사',
		emoji: '📡',
		rarity: 'rare',
		apply: (u) => { u.spreadShot = true; }
	},
	{
		id: 'rapid_fire',
		name: '기관총 모드',
		description: '발사 속도 50% 증가, 데미지 -20%',
		emoji: '🔫',
		rarity: 'rare',
		apply: (u) => {
			u.fireRateMs = Math.max(180, u.fireRateMs * 0.50);
			u.missileDamage = Math.max(1, Math.floor(u.missileDamage * 0.80));
		}
	},
	// ── Epic ──
	{
		id: 'explosive',
		name: '폭발 미사일',
		description: '적에게 명중 시 범위 폭발',
		emoji: '💥',
		rarity: 'epic',
		apply: (u) => { u.isExplosive = true; }
	},
	{
		id: 'laser',
		name: '레이저 빔',
		description: '무한 관통 + 데미지 +60%',
		emoji: '🔆',
		rarity: 'epic',
		apply: (u) => { u.piercingCount = 99; u.missileDamage = Math.floor(u.missileDamage * 1.6); }
	},
	{
		id: 'nuke',
		name: '핵탄두',
		description: '발사 속도 -40%, 폭발 범위 3×, 데미지 ×2',
		emoji: '☢️',
		rarity: 'epic',
		apply: (u) => {
			u.fireRateMs *= 1.4;
			u.isExplosive = true;
			u.explosionRadius = 5.5;
			u.missileDamage = Math.floor(u.missileDamage * 2.0);
		}
	},
	{
		id: 'full_auto',
		name: '완전 자동화',
		description: '미사일 수 +2, 발사 속도 +20%',
		emoji: '🤖',
		rarity: 'epic',
		apply: (u) => { u.missileCount += 2; u.fireRateMs = Math.max(150, u.fireRateMs * 0.80); }
	}
];

/** 랜덤 3장 선택 (희귀도 가중치 적용) */
export function getRandomCards(count = 3): UpgradeCardInfo[] {
	const pool: UpgradeCardDef[] = [];
	for (const card of ALL_UPGRADES) {
		const weight = card.rarity === 'epic' ? 1 : card.rarity === 'rare' ? 3 : 6;
		for (let i = 0; i < weight; i++) pool.push(card);
	}
	const seen = new Set<string>();
	const result: UpgradeCardInfo[] = [];
	for (let attempt = 0; result.length < count && attempt < 200; attempt++) {
		const card = pool[Math.floor(Math.random() * pool.length)];
		if (!seen.has(card.id)) {
			seen.add(card.id);
			result.push({ id: card.id, name: card.name, description: card.description, emoji: card.emoji, rarity: card.rarity });
		}
	}
	return result;
}

/** ID로 업그레이드 적용 */
export function applyUpgrade(upgrades: PlayerUpgrades, id: string): void {
	const card = ALL_UPGRADES.find((c) => c.id === id);
	if (card) card.apply(upgrades);
}

/** HUD·이벤트용 카드 메타 */
export function getUpgradePickInfo(id: string): Pick<UpgradeCardInfo, 'name' | 'emoji' | 'rarity'> | undefined {
	const c = ALL_UPGRADES.find((x) => x.id === id);
	return c ? { name: c.name, emoji: c.emoji, rarity: c.rarity } : undefined;
}

/** 같은 카드(id) 중첩 시 표시용 등급 합산: 커먼=1, 레어=2, 에픽=3 */
export function rarityGradePoints(rarity: 'common' | 'rare' | 'epic'): number {
	return rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
}
