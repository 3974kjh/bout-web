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

export type PlayerState = 'idle' | 'walking' | 'jumping' | 'attacking' | 'guarding' | 'stunned' | 'dead';
export type MonsterAIState = 'idle' | 'chase' | 'attack' | 'rangedAttack' | 'stun';

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
