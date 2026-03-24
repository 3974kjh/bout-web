import type { MonsterConfig } from '$lib/domain/types';

// ── Base monster templates ──────────────────────────────────────────────────

// Scales are 1.3x larger than previous version for bigger enemies
const BETA_MACHINE: MonsterConfig = {
	name: 'Beta Machine',
	hp: 35,
	attack: 7,
	defense: 3,
	speed: 3.5,
	detectionRange: 12,
	attackRange: 2.5,
	bodyColor: 0xcc7722,
	accentColor: 0xddaa44,
	scale: 1.15
};

const ALPHA_MACHINE: MonsterConfig = {
	name: 'Alpha Machine',
	hp: 30,
	attack: 8,
	defense: 2,
	speed: 4.8,
	detectionRange: 14,
	attackRange: 2.2,
	bodyColor: 0xaa2222,
	accentColor: 0xcc4444,
	scale: 1.1
};

const CHAIN_LABOR: MonsterConfig = {
	name: 'Chain Labor',
	hp: 60,
	attack: 13,
	defense: 5,
	speed: 3.2,
	detectionRange: 15,
	attackRange: 2.8,
	bodyColor: 0x886622,
	accentColor: 0xaa8844,
	scale: 1.35
};

const SHOOTER_BOT: MonsterConfig = {
	name: 'Shooter Bot',
	hp: 45,
	attack: 10,
	defense: 3,
	speed: 2.5,
	detectionRange: 20,
	attackRange: 12,
	bodyColor: 0x226688,
	accentColor: 0x44aacc,
	scale: 1.2,
	isRanged: true,
	projectileSpeed: 9,
	fireRateMs: 2200
};

const HEAVY_TANK: MonsterConfig = {
	name: 'Heavy Tank',
	hp: 110,
	attack: 18,
	defense: 9,
	speed: 2.2,
	detectionRange: 12,
	attackRange: 3.2,
	bodyColor: 0x553366,
	accentColor: 0x886699,
	scale: 1.8
};

const SNIPER_BOT: MonsterConfig = {
	name: 'Sniper Bot',
	hp: 35,
	attack: 14,
	defense: 2,
	speed: 2.0,
	detectionRange: 25,
	attackRange: 18,
	bodyColor: 0x224444,
	accentColor: 0x33aaaa,
	scale: 1.1,
	isRanged: true,
	projectileSpeed: 14,
	fireRateMs: 3200
};

// ── Boss templates ──────────────────────────────────────────────────────────

const BOSS_TEMPLATES: Array<Omit<MonsterConfig, 'hp' | 'attack' | 'defense'>> = [
	{
		name: 'Conductor',
		speed: 3.5,
		detectionRange: 24,
		attackRange: 3.5,
		bodyColor: 0xcc6600,
		accentColor: 0xff9933,
		scale: 1.55,
		isBoss: true
	},
	{
		name: 'Dark Destroyer',
		speed: 4.0,
		detectionRange: 26,
		attackRange: 3.8,
		bodyColor: 0x440088,
		accentColor: 0x8833cc,
		scale: 1.65,
		isBoss: true
	},
	{
		name: 'Grand Devil',
		speed: 3.2,
		detectionRange: 28,
		attackRange: 14,
		bodyColor: 0x220022,
		accentColor: 0xcc0044,
		scale: 1.8,
		isBoss: true,
		isRanged: true,
		projectileSpeed: 10,
		fireRateMs: 1800
	}
];

// ── WaveSystem ──────────────────────────────────────────────────────────────

export class WaveSystem {
	wave = 1;
	bossActive = false;

	private spawnClock = 0;
	private spawnInterval: number;
	private bossClock = 0;
	private bossThreshold: number;

	constructor() {
		this.spawnInterval = 5;
		this.bossThreshold = 45;
		// First spawn almost immediately
		this.spawnClock = 4;
	}

	/** Returns 'spawn', 'boss', or null depending on timers. */
	update(dt: number, aliveCount: number): 'spawn' | 'boss' | null {
		if (this.bossActive) return null;

		this.spawnClock += dt;
		this.bossClock += dt;

		if (this.bossClock >= this.bossThreshold) {
			return 'boss';
		}

		if (this.spawnClock >= this.spawnInterval && aliveCount < this.maxAlive) {
			this.spawnClock = 0;
			return 'spawn';
		}

		return null;
	}

	get maxAlive(): number {
		return Math.min(4 + this.wave * 2, 10); // capped at 10 for performance
	}

	onBossSpawned(): void {
		this.bossActive = true;
		this.bossClock = 0;
	}

	onBossKilled(): void {
		this.wave++;
		this.bossActive = false;
		this.spawnClock = 0;
		this.bossThreshold = Math.max(28, this.bossThreshold - 5);
		this.spawnInterval = Math.max(1.8, this.spawnInterval - 0.4);
	}

	getSpawnConfig(): MonsterConfig {
		const pool = this.buildPool();
		const base = pool[Math.floor(Math.random() * pool.length)];
		return this.scale(base);
	}

	getBossConfig(): MonsterConfig {
		const t = BOSS_TEMPLATES[(this.wave - 1) % BOSS_TEMPLATES.length];
		const statScale = 1 + (this.wave - 1) * 0.35;
		return {
			...t,
			hp: Math.round(200 * statScale),
			attack: Math.round(20 * statScale),
			defense: Math.round(8 * statScale)
		};
	}

	private buildPool(): MonsterConfig[] {
		const w = this.wave;
		const pool: MonsterConfig[] = [BETA_MACHINE, ALPHA_MACHINE];
		if (w >= 2) pool.push(CHAIN_LABOR, CHAIN_LABOR);
		if (w >= 3) pool.push(SHOOTER_BOT, SHOOTER_BOT);
		if (w >= 4) pool.push(HEAVY_TANK);
		if (w >= 5) pool.push(SNIPER_BOT, SNIPER_BOT);
		return pool;
	}

	private scale(cfg: MonsterConfig): MonsterConfig {
		const s = 1 + (this.wave - 1) * 0.2;
		return {
			...cfg,
			hp: Math.round(cfg.hp * s),
			attack: Math.round(cfg.attack * s)
		};
	}
}
