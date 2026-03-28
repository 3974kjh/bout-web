export type MechBase = 'hypersuit' | 'azonas-v' | 'geren' | 'expressive' | 'soldier';
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
	/** xzMargin: 발판 가장자리에서 박스를 살짝 확장 */
	getGroundHeight(x: number, z: number, currentY: number, xzMargin?: number): number;
	/**
	 * 발밑 원형 링용: 발 높이가 발판 상면과 맞을 때만 그 발판 높이를 반환.
	 * 수평만 겹치고 아직 올라가지 않은 경우(발 아래)는 0(지면)만 사용.
	 */
	getGroundHeightForRing(x: number, z: number, footY: number): number;
	resolveMovement(
		fromX: number,
		fromZ: number,
		toX: number,
		toZ: number,
		y: number,
		radius?: number
	): { x: number; z: number };
	/**
	 * resolveMovement와 동일한 규칙으로, 이미 장애물 XZ 내부에 박힌 경우 가장 가까운 면 밖으로 밀어냄 (점프 착지 끼임 완화).
	 */
	pushOutOfObstacles(x: number, z: number, y: number, radius?: number): { x: number; z: number };
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
