import type { MonsterConfig } from '$lib/domain/types';
import { lateGameBrutality } from '../constants/GameConfig';

// ── 기본 적 설정 ─────────────────────────────────────────────────────────────

// 적 감지 범위를 크게 넓힘 — 항상 플레이어를 추적하는 느낌
const BETA_MACHINE: MonsterConfig = {
	name: '베타 머신', hp: 35, attack: 10, defense: 3, speed: 3.8,
	detectionRange: 70, attackRange: 2.5, bodyColor: 0xcc6611, accentColor: 0xeeaa44, scale: 1.15
};
const ALPHA_MACHINE: MonsterConfig = {
	name: '알파 머신', hp: 30, attack: 12, defense: 2, speed: 5.2,
	detectionRange: 75, attackRange: 2.2, bodyColor: 0xaa1111, accentColor: 0x222222, scale: 1.1
};
const FAST_RUSHER: MonsterConfig = {
	name: '빠른 날쇠', hp: 22, attack: 17, defense: 1, speed: 8.5,
	detectionRange: 80, attackRange: 2.0, bodyColor: 0xff2200, accentColor: 0xff8800, scale: 0.95
};
const CHAIN_LABOR: MonsterConfig = {
	name: '체인 레이버', hp: 60, attack: 17, defense: 5, speed: 3.5,
	detectionRange: 68, attackRange: 2.8, bodyColor: 0x886622, accentColor: 0xbbaa33, scale: 1.35
};
const LASER_BOY: MonsterConfig = {
	name: '레이저 보이', hp: 45, attack: 14, defense: 3, speed: 3.0,
	detectionRange: 80, attackRange: 22, bodyColor: 0x1155aa, accentColor: 0x33aaff, scale: 1.2,
	isRanged: true, projectileSpeed: 17, fireRateMs: 1600
};
const BOMB_DRONE: MonsterConfig = {
	name: '폭격 드론', hp: 28, attack: 12, defense: 1, speed: 4.8,
	detectionRange: 78, attackRange: 20, bodyColor: 0x223322, accentColor: 0x44ff44, scale: 1.05,
	isRanged: true, projectileSpeed: 20, fireRateMs: 900
};
const TOUGH_GUY_Z: MonsterConfig = {
	name: '터프가이 Z', hp: 110, attack: 23, defense: 9, speed: 2.5,
	detectionRange: 65, attackRange: 3.2, bodyColor: 0x553366, accentColor: 0x886699, scale: 1.8
};
const CARGO_GUARD: MonsterConfig = {
	name: '화물 파수꾼', hp: 35, attack: 20, defense: 2, speed: 2.2,
	detectionRange: 90, attackRange: 32, bodyColor: 0x112233, accentColor: 0x22aaaa, scale: 1.1,
	isRanged: true, projectileSpeed: 22, fireRateMs: 2200
};
const ARMOR_GOLEM: MonsterConfig = {
	name: '장갑 골렘', hp: 200, attack: 28, defense: 15, speed: 2.0,
	detectionRange: 65, attackRange: 3.0, bodyColor: 0x2a2a2a, accentColor: 0x888888, scale: 2.0
};
const DEATH_STALKER: MonsterConfig = {
	name: '죽음의 낫', hp: 40, attack: 32, defense: 2, speed: 10.0,
	detectionRange: 90, attackRange: 2.2, bodyColor: 0x110011, accentColor: 0xff00ff, scale: 1.0
};

// ── 보스 템플릿 ──────────────────────────────────────────────────────────────

// 보스 5종: 동물 테마 + AOE 공격 (후반일수록 AOE 범위 크고 빠름)
const BOSS_TEMPLATES: Array<Omit<MonsterConfig, 'hp' | 'attack' | 'defense'>> = [
	{
		name: '강철 곰', speed: 3.2, detectionRange: 100, attackRange: 16,
		bodyColor: 0x8b4513, accentColor: 0xff8c00, scale: 3.2, isBoss: true,
		bossAnimalType: 'bear',
		aoeRadius: 7,  aoeFillMs: 2800, aoeCooldownMs: 8000
	},
	{
		name: '기계 늑대', speed: 5.0, detectionRange: 110, attackRange: 18,
		bodyColor: 0x2a2a5a, accentColor: 0x6644ff, scale: 3.4, isBoss: true,
		bossAnimalType: 'wolf',
		isRanged: true, projectileSpeed: 13, fireRateMs: 1600,
		aoeRadius: 9,  aoeFillMs: 2300, aoeCooldownMs: 7000
	},
	{
		name: '철갑 드래곤', speed: 2.8, detectionRange: 120, attackRange: 22,
		bodyColor: 0x1a2a1a, accentColor: 0x00ff88, scale: 3.8, isBoss: true,
		bossAnimalType: 'dragon',
		isRanged: true, projectileSpeed: 19, fireRateMs: 1200,
		aoeRadius: 11, aoeFillMs: 1900, aoeCooldownMs: 6000
	},
	{
		name: '사이버 호랑이', speed: 5.5, detectionRange: 120, attackRange: 20,
		bodyColor: 0x552200, accentColor: 0xff5500, scale: 3.6, isBoss: true,
		bossAnimalType: 'tiger',
		isRanged: true, projectileSpeed: 20, fireRateMs: 1000,
		aoeRadius: 9,  aoeFillMs: 1600, aoeCooldownMs: 5500
	},
	{
		name: '아이언 로드', speed: 4.0, detectionRange: 130, attackRange: 24,
		bodyColor: 0x1a1a1a, accentColor: 0xff2200, scale: 4.2, isBoss: true,
		bossAnimalType: 'ironlord',
		isRanged: true, projectileSpeed: 23, fireRateMs: 700,
		aoeRadius: 13, aoeFillMs: 1400, aoeCooldownMs: 4500
	}
];

// ── WaveSystem (시간 기반 — 웨이브 없음) ─────────────────────────────────────
// 20초마다 보스 등장 (이전 보스가 살아있어도 누적 등장)
// 일반 몬스터는 보스 유무와 무관하게 상시 소환

const BOSS_INTERVAL = 30; // 30초마다 보스 등장

export class WaveSystem {
	bossCount = 0;  // 처치한 보스 수 (난이도 지표)

	private spawnClock = 0;
	private spawnInterval = 0.9;
	private bossClock = 0;

	constructor() {
		this.spawnClock = 0.6;
	}

	/** { spawnMonster, spawnBoss } — 동시에 둘 다 true 가능 */
	update(dt: number, aliveCount: number, playerLevel: number): { spawnMonster: boolean; spawnBoss: boolean } {
		this.spawnClock += dt;
		this.bossClock  += dt;

		const brutal = lateGameBrutality(playerLevel);
		const bossEvery = BOSS_INTERVAL * brutal.bossSpawnIntervalScale;
		const spawnBoss = this.bossClock >= bossEvery;
		if (spawnBoss) this.bossClock -= bossEvery;
		const effInterval = Math.max(0.14, this.spawnInterval * brutal.spawnIntervalMul);
		const cap = Math.min(100, Math.floor(Math.min(30 + this.bossCount * 12, 100) * brutal.maxAliveMul));

		const spawnMonster = this.spawnClock >= effInterval && aliveCount < cap;
		if (spawnMonster) this.spawnClock -= effInterval;

		return { spawnMonster, spawnBoss };
	}

	get maxAlive(): number {
		return Math.min(30 + this.bossCount * 12, 100);
	}

	onBossKilled(): void {
		this.bossCount++;
		this.spawnInterval = Math.max(0.35, 0.9 - this.bossCount * 0.10);
	}

	getSpawnConfig(): MonsterConfig {
		const pool = this.buildPool();
		return this.scale(pool[Math.floor(Math.random() * pool.length)]);
	}

	getBossConfig(): MonsterConfig {
		const t = BOSS_TEMPLATES[this.bossCount % BOSS_TEMPLATES.length];
		const ss = 1 + this.bossCount * 0.50; // 보스 처치마다 50% 강화
		return {
			...t,
			hp:      Math.round(400 * ss),
			attack:  Math.round(30  * ss),
			defense: Math.round(12  * ss)
		};
	}

	/** 난이도 티어 (0~4) — 테마 전환에 사용 */
	get diffTier(): number {
		return Math.min(Math.floor(this.bossCount / 2), 4);
	}

	private buildPool(): MonsterConfig[] {
		const b = this.bossCount;
		const pool: MonsterConfig[] = [
			BETA_MACHINE, BETA_MACHINE, ALPHA_MACHINE, ALPHA_MACHINE,
			FAST_RUSHER, FAST_RUSHER, LASER_BOY, BOMB_DRONE
		];
		if (b >= 1) pool.push(CHAIN_LABOR, FAST_RUSHER, FAST_RUSHER, BOMB_DRONE, BOMB_DRONE, LASER_BOY, LASER_BOY);
		if (b >= 2) pool.push(LASER_BOY, LASER_BOY, BOMB_DRONE, BOMB_DRONE, CARGO_GUARD, FAST_RUSHER);
		if (b >= 3) pool.push(TOUGH_GUY_Z, TOUGH_GUY_Z, CARGO_GUARD, CARGO_GUARD, BOMB_DRONE, FAST_RUSHER);
		if (b >= 4) pool.push(ARMOR_GOLEM, ARMOR_GOLEM, FAST_RUSHER, FAST_RUSHER, BOMB_DRONE, BOMB_DRONE, LASER_BOY);
		if (b >= 5) pool.push(DEATH_STALKER, DEATH_STALKER, DEATH_STALKER, CARGO_GUARD, LASER_BOY, BOMB_DRONE);
		return pool;
	}

	/** 난이도 스케일링 — 보스 처치 횟수 기준 */
	private scale(cfg: MonsterConfig): MonsterConfig {
		const b = this.bossCount;
		const hpScale  = 1 + b * 0.24;
		const atkScale = 1 + b * 0.30;
		const spdScale = 1 + b * 0.09;
		return {
			...cfg,
			hp:     Math.round(cfg.hp     * hpScale),
			attack: Math.round(cfg.attack * atkScale),
			speed:  Math.min(cfg.speed * spdScale, 14)
		};
	}
}
