export type MechBase = 'hypersuit' | 'azonas-v' | 'geren';
export type PartSlot = 'head' | 'body' | 'arm' | 'leg' | 'weapon';

export interface MechStats {
	hp: number;
	maxHp: number;
	attack: number;
	defense: number;
	speed: number;
	transformGauge: number;
	maxTransformGauge: number;
}

export type TransformState = 'normal' | 'transformed';

export interface Part {
	id: string;
	slot: PartSlot;
	name: string;
	statModifier: Partial<MechStats>;
}

export type MechParts = Record<PartSlot, Part | null>;

export type PlayerState = 'idle' | 'walking' | 'jumping' | 'stunned' | 'dead';
export type MonsterAIState = 'idle' | 'chase' | 'attack' | 'rangedAttack' | 'stun' | 'knockdown';

/** 뱀서라이크 업그레이드 스탯 */
export interface PlayerUpgrades {
	missileDamage: number;
	missileSpeed: number;
	fireRateMs: number;
	missileCount: number;
	piercingCount: number;
	isHoming: boolean;
	isExplosive: boolean;
	explosionRadius: number;
	missileScale: number;
	spreadShot: boolean;
	collectRange: number;
	magnetRange: number;
	moveSpeedMult: number;
	maxHpMult: number;
	pendingHealPct: number;
	dashCooldownMult: number; // 대쉬 쿨타임 배율 (0 < x ≤ 1)
}

export interface MonsterConfig {
	name: string;
	hp: number;
	attack: number;
	defense: number;
	speed: number;
	detectionRange: number;
	attackRange: number;
	bodyColor: number;
	accentColor: number;
	scale: number;
	isBoss?: boolean;
	isRanged?: boolean;
	projectileSpeed?: number;
	fireRateMs?: number;
	// 보스 전용: AOE 공격
	bossAnimalType?: 'bear' | 'wolf' | 'dragon' | 'tiger' | 'ironlord';
	aoeRadius?: number;
	aoeFillMs?: number;
	aoeCooldownMs?: number;
}

export interface StageQuery {
	getGroundHeight(x: number, z: number, currentY: number): number;
	resolveMovement(
		fromX: number,
		fromZ: number,
		toX: number,
		toZ: number,
		y: number,
		radius?: number
	): { x: number; z: number };
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
