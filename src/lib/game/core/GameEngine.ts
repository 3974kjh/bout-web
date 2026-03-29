import * as THREE from 'three';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Projectile } from '../entities/Projectile';
import { ExpShardManager } from '../entities/ExpShardManager';
import { PlatformHealthPotion, PlatformCardCache } from '../entities/PlatformLoot';
import { CombatSystem } from '../systems/CombatSystem';
import { LevelSystem } from '../systems/LevelSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { calculateStats } from '../systems/PartsSystem';
import { applyUpgrade, getRandomCards } from '../systems/UpgradeSystem';
import { missileColorForSkin } from '../shopSettings';
import { getShopSettingsForGame, refreshShopSettingsForGame } from '../shopGameCache';
import { TrainingPlanet } from '../stages/TrainingPlanet';
import { DamageNumbers } from '../ui/DamageNumbers';
import { EventBus } from '../bridge/EventBus';
import type { MechParts, MonsterConfig } from '$lib/domain/types';
import {
	BACKGROUND_IMAGE_COUNT,
	BACKGROUND_PLANE_SUBDIV,
	BACKGROUND_TEXTURE_REPEAT,
	computeRunScore,
	lateGameBrutality,
	visualThemeImageIndexFromForm,
	VICTORY_SURVIVAL_SECONDS
} from '../constants/GameConfig';
import { formForLevel } from '../entities/MechModel';
import { playPlayerMissile } from '$lib/audio/sfx';

/** 배경 4분면 쿼드를 카메라 앞에 둘 거리 */
const BACKGROUND_QUAD_DISTANCE = 200;

type BossAoeKind = NonNullable<MonsterConfig['bossAnimalType']>;

export class GameEngine {
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private clock: THREE.Clock;

	private input: InputManager;
	private camCtrl: CameraController;
	private damageNumbers!: DamageNumbers;
	private player!: Player;
	private monsters: Monster[] = [];
	private projectiles: Projectile[] = [];      // 적 발사체
	private playerProjectiles: Projectile[] = []; // 플레이어 자동 미사일
	private expShardManager!: ExpShardManager;

	private stage!: TrainingPlanet;
	private combat!: CombatSystem;
	private waveSystem!: WaveSystem;
	private levelSystem!: LevelSystem;

	private isGameOver = false;
	private isLevelUpPaused = false;
	private isEscapePaused = false;
	private playerFireTimer = 0;
	private minimapTimer = 0;

	// 킬 연속 처치
	private killStreak = 0;
	private killStreakTimer = 0;       // 연속 처치 리셋 타이머 (ms)
	private killEffects: { mesh: THREE.Mesh; life: number }[] = [];
	private missileHitEffects: { mesh: THREE.Mesh; life: number }[] = [];
	private normalMonsterKills = 0;
	private bossKillsByType: Record<BossAoeKind, number> = {
		bear: 0,
		wolf: 0,
		dragon: 0,
		tiger: 0,
		ironlord: 0
	};
	private survivalTime = 0;
	private survivalEmitTimer = 0;

	// 발판 루트: 주기적 스폰
	private platformHealthPotions: PlatformHealthPotion[] = [];
	private platformCardCaches: PlatformCardCache[] = [];
	private platformHealthSpawnAcc = 0;
	private platformHealthNextIn = 26 + Math.random() * 10;
	private platformCardSpawnAcc = 0;
	private platformCardNextIn = 28 + Math.random() * 10;

	private playerMissileColor = 0x00ccff;
	private favoredCardIds: string[] = [];

	/** 분리 연산·투사체 광역판정 등에 재사용 (프레임당 GC 감소) */
	private readonly _scratchPrevProj = new THREE.Vector3();
	private readonly _scratchTargetPt = new THREE.Vector3();
	private aliveMonsterScratch: Monster[] = [];
	private simFrame = 0;
	private separateCellBuckets = new Map<string, number[]>();
	private separateBucketPool: number[][] = [];
	private monsterProjCellBuckets = new Map<string, number[]>();
	private monsterProjBucketPool: number[][] = [];

	// 보스 AOE: 고정 외곽 링 + 중심에서 바깥으로 채워지는 원, 타격 시 보스별 연출
	private aoeEffects: Array<{
		rim: THREE.Mesh;
		fillDisc: THREE.Mesh;
		maxR: number;
		fillMs: number;
		damage: number;
		kind: BossAoeKind;
		elapsed: number;
		hasDamaged: boolean;
		fadeTimer: number;
	}> = [];

	private bossStrikeAnims: Array<{
		kind: BossAoeKind;
		meshes: THREE.Mesh[];
		lights: THREE.PointLight[];
		t: number;
		groundY: number;
		cx: number;
		cz: number;
		r: number;
		bearExtra?: {
			phase: 'fall' | 'impact';
			impactT: number;
			hist: THREE.Vector3[];
		};
	}> = [];

	private animId = 0;
	private container: HTMLElement;

	private backgroundTexture: THREE.Texture | null = null;
	private backgroundImageIndex = 0;
	private backgroundLoadingIndex = 0;
	private backgroundQuadGroup: THREE.Group | null = null;

	// 핸들러 바인딩
	private restartHandler = (): void => {
		void this.restart();
	};
	private resizeHandler  = (): void => this.onResize();
	private bossDefeatedHandler = (): void => this.onBossDefeated();
	private upgradeChosenHandler = (...args: unknown[]): void => {
		const d = args[0] as { id: string };
		applyUpgrade(this.player.upgrades, d.id);
		this.player.applyMaxHpUpgrade();
		this.player.applyPendingHeal();
		this.isLevelUpPaused = false;
		this.emitExpUpdate();
		EventBus.emit('upgrade-picked', { id: d.id });
	};
	private enemyProjectileHandler = (...args: unknown[]): void => {
		const d = args[0] as { pos: THREE.Vector3; dir: THREE.Vector3; damage: number; speed: number };
		const t = Math.max(0, this.survivalTime);
		const timeScale = 1 + 0.55 * Math.min(t / VICTORY_SURVIVAL_SECONDS, 1);
		const brutal = lateGameBrutality(this.levelSystem.level);
		const spd = d.speed * timeScale * brutal.enemyProjectileSpeedMul;
		this.projectiles.push(new Projectile(this.scene, d.pos.clone(), d.dir.clone(), spd, d.damage, 0xff4400));
	};
	private playerHitHandler = (): void => {
		this.camCtrl.shake(0.28, 180);
	};
	private boundaryFallShakeHandler = (): void => {
		this.camCtrl.shake(0.42, 340);
	};
	private pauseSetHandler = (...args: unknown[]): void => {
		this.isEscapePaused = !!(args[0] as { paused: boolean }).paused;
	};

	constructor(container: HTMLElement) {
		this.container = container;

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(container.clientWidth, container.clientHeight);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.1;
		container.appendChild(this.renderer.domElement);

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog(0x8fb0cc, 130, 220);

		this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 260);
		this.camera.position.set(0, 26, 20);

		this.clock = new THREE.Clock();
		this.input = new InputManager();
		this.camCtrl = new CameraController(this.camera);
		this.damageNumbers = new DamageNumbers(container, this.camera, this.renderer.domElement);

		this.setupLights();
		this.initGame();
		this.applyDifficultyTheme(this.waveSystem.diffTier);
		this.syncVisualThemeTextures();

		window.addEventListener('resize', this.resizeHandler);
		EventBus.on('restart-game', this.restartHandler);
		EventBus.on('boss-defeated', this.bossDefeatedHandler);
		EventBus.on('enemy-projectile', this.enemyProjectileHandler);
		EventBus.on('upgrade-chosen', this.upgradeChosenHandler);
		EventBus.on('player-hit', this.playerHitHandler);
		EventBus.on('player-boundary-fall', this.boundaryFallShakeHandler);
		EventBus.on('game-pause-set', this.pauseSetHandler);
		this.animate();
	}

	private setupLights(): void {
		this.scene.add(new THREE.AmbientLight(0xffeedd, 1.6));
		this.scene.add(new THREE.HemisphereLight(0x88aadd, 0xbbaa88, 1.0));

		const dir = new THREE.DirectionalLight(0xffffff, 2.2);
		dir.position.set(15, 30, 15);
		dir.castShadow = true;
		dir.shadow.mapSize.set(2048, 2048);
		const sc = dir.shadow.camera;
		sc.left = -95;
		sc.right = 95;
		sc.top = 95;
		sc.bottom = -95;
		sc.near = 0.15;
		sc.far = 260;
		sc.updateProjectionMatrix();
		dir.shadow.bias = -0.00022;
		dir.shadow.normalBias = 0.035;
		this.scene.add(dir);
	}

	private initGame(): void {
		this.isGameOver = false;
		this.isLevelUpPaused = false;
		this.isEscapePaused = false;
		this.playerFireTimer = 0;

		this.stage = new TrainingPlanet(this.scene);

		const shop = getShopSettingsForGame();
		this.playerMissileColor = missileColorForSkin(shop.missileSkinId);
		this.favoredCardIds = [...shop.favoredCardIds];

		const emptyParts: MechParts = { head: null, body: null, arm: null, leg: null, weapon: null };
		const stats = calculateStats(shop.mechBase, emptyParts);
		this.player = new Player(this.scene, new THREE.Vector3(0, 0, 20), stats, shop.mechBase);

		this.monsters = [];
		this.projectiles = [];
		this.playerProjectiles = [];
		this.expShardManager = new ExpShardManager(this.scene);
		this.killEffects = [];
		this.missileHitEffects = [];
		this.killStreak = 0;
		this.killStreakTimer = 0;
		this.waveSystem = new WaveSystem();
		this.levelSystem = new LevelSystem();
		this.survivalTime = 0;
		this.survivalEmitTimer = 0;
		this.platformHealthSpawnAcc = 0;
		this.platformHealthNextIn = 26 + Math.random() * 10;
		this.platformCardSpawnAcc = 0;
		this.platformCardNextIn = 28 + Math.random() * 10;

		// 초기 웨이브 몬스터
		const initialConfigs: MonsterConfig[] = [
			{ name: '베타 머신', hp: 35, attack: 10, defense: 3, speed: 3.8, detectionRange: 22, attackRange: 2.5, bodyColor: 0xcc6611, accentColor: 0xeeaa44, scale: 1.15 },
			{ name: '베타 머신', hp: 35, attack: 10, defense: 3, speed: 3.8, detectionRange: 22, attackRange: 2.5, bodyColor: 0xcc6611, accentColor: 0xeeaa44, scale: 1.15 },
			{ name: '알파 머신', hp: 30, attack: 12, defense: 2, speed: 5.0, detectionRange: 26, attackRange: 2.2, bodyColor: 0xaa1111, accentColor: 0x222222, scale: 1.1 },
		];
		for (const cfg of initialConfigs) this.spawnMonster(cfg);

		this.combat = new CombatSystem(this.player, this.monsters);

		EventBus.on('boss-aoe-request', this.onBossAoeRequest);

		EventBus.emit('survival-time-update', { seconds: 0 });
		EventBus.emit('monster-count-update', { remaining: this.monsters.length, total: 0 });
		this.normalMonsterKills = 0;
		this.bossKillsByType = { bear: 0, wolf: 0, dragon: 0, tiger: 0, ironlord: 0 };
		this.emitKillStats();
		// HUD·난이도용 levelSystem.level 과 3D 진화 단계(Player) 동기화
		this.player.setLevel(this.levelSystem.level);
		this.emitExpUpdate();
	}

	private emitKillStats(): void {
		EventBus.emit('kill-stats-update', {
			normal: this.normalMonsterKills,
			bosses: { ...this.bossKillsByType }
		});
	}

	// ─── 메인 루프 ──────────────────────────────────────────────────────────────

	private animate = (): void => {
		this.animId = requestAnimationFrame(this.animate);
		const dt = Math.min(this.clock.getDelta(), 0.05);

		if (!this.isGameOver && !this.isLevelUpPaused && !this.isEscapePaused) {
			this.simFrame++;
			this.input.update();
			this.player.update(dt, this.input, this.stage);

			// 생존 시간 적산 + HUD emit (500ms 주기)
			this.survivalTime += dt;
			this.survivalEmitTimer += dt * 1000;
			if (this.survivalEmitTimer >= 500) {
				this.survivalEmitTimer -= 500;
				EventBus.emit('survival-time-update', { seconds: this.survivalTime });
			}

			let mi = 0;
			for (const m of this.monsters) {
				if (!m.isDead()) {
					m.update(dt, this.player.group.position, this.stage, this.simFrame + mi);
					mi++;
				}
			}

			this.combat.update();
			this.updateAutoFire(dt);
			this.updatePlayerProjectiles(dt);
			this.updateEnemyProjectiles(dt);
			this.updateExpShards(dt);
			this.updatePlatformLoot(dt);
			this.handleDeaths();
			this.updateWaveSystem(dt);
			this.updateKillEffects(dt);
			this.updateMissileHitEffects(dt);
			this.updateKillStreak(dt);
			this.updateAoeEffects(dt);
			this.updateBossStrikeAnims(dt);
			this.separateMonsters();
			this.checkEnd();
		} else if (!this.isGameOver && this.isLevelUpPaused) {
			// 레벨업 중: 입력 처리만 (플레이어/몬스터 멈춤)
			this.input.update();
		}

		this.camCtrl.update(dt, this.player.group.position);
		this.syncBackgroundQuadsToCamera();
		this.renderer.render(this.scene, this.camera);
		this.damageNumbers.update(dt);
		this.updateMinimap(dt);
	};

	// ─── 미니맵 ──────────────────────────────────────────────────────────────────

	private updateMinimap(dt: number): void {
		this.minimapTimer += dt * 1000;
		if (this.minimapTimer < 150) return; // 150ms마다 갱신
		this.minimapTimer = 0;

		const pp = this.player.group.position;
		const loot: { kind: 'health' | 'card'; x: number; z: number }[] = [
			...this.platformHealthPotions.map((p) => ({
				kind: 'health' as const,
				x: p.group.position.x,
				z: p.group.position.z
			})),
			...this.platformCardCaches.map((c) => ({
				kind: 'card' as const,
				x: c.group.position.x,
				z: c.group.position.z
			}))
		];
		EventBus.emit('minimap-update', {
			player: { x: pp.x, z: pp.z, fx: this.player.facing.x, fz: this.player.facing.z },
			monsters: this.monsters
				.filter((m) => !m.isDead())
				.map((m) => ({ x: m.group.position.x, z: m.group.position.z, isBoss: !!m.config.isBoss })),
			bounds: this.stage.bounds,
			viewport: { x: pp.x, z: pp.z, halfW: 30, halfD: 22 },
			loot
		});
	}

	// ─── 자동 미사일 ────────────────────────────────────────────────────────────

	/** 발사에 필요한 만큼만 거리순 타겟 선택 (전체 정렬 O(n log n) 제거) */
	private pickMissileTargets(pp: THREE.Vector3, alive: Monster[], want: number): Monster[] {
		const n = Math.min(want, alive.length);
		const out: Monster[] = [];
		const used = new Set<Monster>();
		const fireY = pp.y + 1.8;
		for (let k = 0; k < n; k++) {
			let best: Monster | null = null;
			let bestD = Infinity;
			for (const m of alive) {
				if (used.has(m)) continue;
				const aimY = 1.0 + 0.5 * m.config.scale;
				const dx = m.group.position.x - pp.x;
				const dy = m.group.position.y + aimY - fireY;
				const dz = m.group.position.z - pp.z;
				const d2 = dx * dx + dy * dy + dz * dz;
				if (d2 < bestD) {
					bestD = d2;
					best = m;
				}
			}
			if (best) {
				used.add(best);
				out.push(best);
			}
		}
		return out;
	}

	private updateAutoFire(dt: number): void {
		const u = this.player.upgrades;
		const effectiveRate = u.fireRateMs;
		this.playerFireTimer += dt * 1000;
		if (this.playerFireTimer < effectiveRate) return;
		this.playerFireTimer -= effectiveRate;

		const alive = this.aliveMonsterScratch;
		alive.length = 0;
		for (const m of this.monsters) {
			if (!m.isDead()) alive.push(m);
		}
		if (alive.length === 0) return;

		const pp = this.player.group.position;
		const shotCount = u.missileCount + (u.spreadShot ? 2 : 0);
		const targets = this.pickMissileTargets(pp, alive, shotCount);
		if (targets.length === 0) return;

		// 발사할 각도 목록 (스프레드샷 포함)
		const angles: number[] = [0];
		if (u.spreadShot) angles.push(-0.44, 0.44);
		if (u.missileCount > 1) {
			const extra = u.missileCount - 1;
			for (let i = 0; i < extra; i++) {
				const a = ((i + 1) * 0.3) * (i % 2 === 0 ? 1 : -1);
				if (!angles.includes(a)) angles.push(a);
			}
		}

		const origin = new THREE.Vector3(pp.x, pp.y + 1.8, pp.z);
		const targetPt = this._scratchTargetPt;

		for (let mi = 0; mi < shotCount; mi++) {
			const target = targets[mi % targets.length];
			const aimY = 1.0 + 0.5 * target.config.scale;
			targetPt.set(target.group.position.x, target.group.position.y + aimY, target.group.position.z);

			const baseDir = new THREE.Vector3().subVectors(targetPt, origin).normalize();
			const angleOff = angles[mi] ?? 0;
			const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOff);

			const homingObj = u.isHoming ? target.group : null;
			const proj = new Projectile(
				this.scene, origin, dir,
				u.missileSpeed, u.missileDamage,
				this.playerMissileColor, true, u.piercingCount, u.missileScale, homingObj
			);
			this.playerProjectiles.push(proj);
		}

		this.player.triggerFireFlash();
		playPlayerMissile();
		this.emitExpUpdate(); // 빈번한 emit 피하기 위해 fire 시 같이 갱신
	}

	// ─── 플레이어 미사일 충돌 ────────────────────────────────────────────────────

	/** 궤적 세그먼트와 구체 충돌 (고속 미사일 터널링 방지) */
	private static segmentDistSqToPoint(
		ax: number, ay: number, az: number,
		bx: number, by: number, bz: number,
		px: number, py: number, pz: number
	): number {
		const abx = bx - ax, aby = by - ay, abz = bz - az;
		const apx = px - ax, apy = py - ay, apz = pz - az;
		const abLenSq = abx * abx + aby * aby + abz * abz;
		const t = abLenSq < 1e-14 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq));
		const qx = ax + abx * t, qy = ay + aby * t, qz = az + abz * t;
		const dx = px - qx, dy = py - qy, dz = pz - qz;
		return dx * dx + dy * dy + dz * dz;
	}

	private static segmentHitsSphere(
		ax: number, ay: number, az: number,
		bx: number, by: number, bz: number,
		cx: number, cy: number, cz: number,
		r: number
	): boolean {
		return GameEngine.segmentDistSqToPoint(ax, ay, az, bx, by, bz, cx, cy, cz) <= r * r;
	}

	/** XZ 평면에서 선분–점 거리² (미사일–적 광역 탈락용) */
	private static segmentDistSqXZ(
		ax: number,
		az: number,
		bx: number,
		bz: number,
		px: number,
		pz: number
	): number {
		const abx = bx - ax,
			abz = bz - az;
		const apx = px - ax,
			apz = pz - az;
		const abLenSq = abx * abx + abz * abz;
		const t =
			abLenSq < 1e-14 ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
		const qx = ax + abx * t,
			qz = az + abz * t;
		const dx = px - qx,
			dz = pz - qz;
		return dx * dx + dz * dz;
	}

	/** 플레이어 투사체 광역판정용 — XZ 셀 버킷 (프레임당 1회 채움) */
	private rebuildMonsterProjBuckets(): void {
		const CELL = 5;
		const map = this.monsterProjCellBuckets;
		for (const arr of map.values()) {
			arr.length = 0;
			this.monsterProjBucketPool.push(arr);
		}
		map.clear();
		for (let mi = 0; mi < this.monsters.length; mi++) {
			const m = this.monsters[mi];
			if (m.isDead()) continue;
			const ix = Math.floor(m.group.position.x / CELL);
			const iz = Math.floor(m.group.position.z / CELL);
			const key = ix + ',' + iz;
			let bucket = map.get(key);
			if (!bucket) {
				bucket = this.monsterProjBucketPool.pop() ?? [];
				map.set(key, bucket);
			}
			bucket.push(mi);
		}
	}

	private updatePlayerProjectiles(dt: number): void {
		const u = this.player.upgrades;
		const canPierceObstacle = u.piercingCount > 0;
		const prevPos = this._scratchPrevProj;
		this.rebuildMonsterProjBuckets();
		const CELL = 5;
		// looseR 최대(대형 보스·미사일 스케일)보다 커야 셀 스킵 없이 전부 검사
		const SEG_PAD = 8.5;
		for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
			const p = this.playerProjectiles[i];
			prevPos.copy(p.mesh.position);
			p.update(dt);
			if (!p.alive) { p.dispose(this.scene); this.playerProjectiles.splice(i, 1); continue; }

			// 장애물 관통 차단 (관통 카드 없을 때만)
			if (!canPierceObstacle) {
				const pp = p.mesh.position;
				if (this.stage.checkLineObstacle(prevPos.x, prevPos.y, prevPos.z, pp.x, pp.y, pp.z)) {
					p.alive = false;
					p.dispose(this.scene);
					this.playerProjectiles.splice(i, 1);
					continue;
				}
			}

			const ax = prevPos.x,
				ay = prevPos.y,
				az = prevPos.z;
			const bx = p.mesh.position.x,
				by = p.mesh.position.y,
				bz = p.mesh.position.z;
			const minIx = Math.floor((Math.min(ax, bx) - SEG_PAD) / CELL);
			const maxIx = Math.floor((Math.max(ax, bx) + SEG_PAD) / CELL);
			const minIz = Math.floor((Math.min(az, bz) - SEG_PAD) / CELL);
			const maxIz = Math.floor((Math.max(az, bz) + SEG_PAD) / CELL);

			projMonsterScan: for (let cix = minIx; cix <= maxIx; cix++) {
				for (let ciz = minIz; ciz <= maxIz; ciz++) {
					const bucket = this.monsterProjCellBuckets.get(cix + ',' + ciz);
					if (!bucket) continue;
					for (const mi of bucket) {
						const m = this.monsters[mi];
						if (m.isDead() || p.hitIds.has(m.id)) continue;
						const cx = m.group.position.x;
						const s = m.config.scale;
						// 발~머리 중간 쪽으로 약간 낮춰, 키 큰 메시와 궤적 높이 어긋남 완화
						const cy = m.group.position.y + 1.05 + 0.58 * s;
						const cz = m.group.position.z;
						// 형체에 닿는 느낌 — 기존 0.8s 대비 피격 구 확대 (스케일·미사일 크기 반영)
						let hitRadius = (1.05 + 0.12 * Math.min(s, 2.2)) * u.missileScale * s;
						if (m.config.isBoss) hitRadius *= 1.14;
						const looseR = hitRadius + 1.85;
						if (GameEngine.segmentDistSqXZ(ax, az, bx, bz, cx, cz) > looseR * looseR) {
							continue;
						}
						if (!GameEngine.segmentHitsSphere(ax, ay, az, bx, by, bz, cx, cy, cz, hitRadius))
							continue;

						p.hitIds.add(m.id);
						const isCrit = Math.random() < 0.15;
						const dmg = isCrit ? p.damage * 2 : p.damage;
						const knockDir = new THREE.Vector3()
							.subVectors(m.group.position, p.mesh.position)
							.setY(0)
							.normalize();
						m.takeDamage(dmg, knockDir, false);

						const toM = new THREE.Vector3().subVectors(p.mesh.position, new THREE.Vector3(cx, cy, cz));
						if (toM.lengthSq() < 1e-8) toM.set(0, 1, 0);
						else toM.normalize();
						const hitPos = new THREE.Vector3(cx, cy, cz).addScaledVector(toM, hitRadius);
						this.spawnMissileHitImpact(hitPos);

						EventBus.emit('damage-number', {
							pos: m.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
							amount: dmg,
							type: isCrit ? 'crit' : 'deal'
						});
						if (isCrit) this.camCtrl.shake(0.18, 120);

						if (u.isExplosive) this.triggerExplosion(p.mesh.position.clone(), u.explosionRadius, dmg);

						if (p.pierceLeft > 0) {
							p.pierceLeft--;
						} else {
							p.alive = false;
							break projMonsterScan;
						}
					}
				}
			}
		}
	}

	private triggerExplosion(center: THREE.Vector3, radius: number, dmg: number): void {
		for (const m of this.monsters) {
			if (m.isDead()) continue;
			const dist = m.group.position.distanceTo(center);
			if (dist < radius) {
				const explosionDmg = Math.ceil(dmg * (1 - dist / radius));
				m.takeDamage(explosionDmg, new THREE.Vector3().subVectors(m.group.position, center).setY(0).normalize(), false);
			}
		}
		// 간단한 폭발 이펙트: 큰 데미지 숫자
		EventBus.emit('damage-number', {
			pos: center.clone().add(new THREE.Vector3(0, 1, 0)),
			amount: Math.ceil(dmg * 0.5),
			type: 'deal'
		});
	}

	// ─── 적 발사체 ───────────────────────────────────────────────────────────────

	private updateEnemyProjectiles(dt: number): void {
		const prevPos = this._scratchPrevProj;
		const pp = this.player.group.position;
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const p = this.projectiles[i];
			prevPos.copy(p.mesh.position);
			p.update(dt);
			if (p.alive) {
				// 적 미사일도 장애물에 막힘
				const ep = p.mesh.position;
				if (this.stage.checkLineObstacle(prevPos.x, prevPos.y, prevPos.z, ep.x, ep.y, ep.z)) {
					p.alive = false;
				}
			}
			if (p.alive) {
				const ex = p.mesh.position.x - pp.x;
				const ey = p.mesh.position.y - pp.y;
				const ez = p.mesh.position.z - pp.z;
				if (ex * ex + ey * ey + ez * ez < 1.44) {
					const knockDir = new THREE.Vector3()
						.subVectors(this.player.group.position, p.mesh.position)
						.setY(0)
						.normalize();
				const hit = this.player.takeDamage(p.damage, knockDir);
				if (hit) {
					EventBus.emit('damage-number', {
						pos: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
						amount: p.damage,
						type: 'take'
					});
					this.camCtrl.shake(0.30, 200);
				}
					p.alive = false;
				}
			}
			if (!p.alive) { p.dispose(this.scene); this.projectiles.splice(i, 1); }
		}
	}

	// ─── 경험치 조각 ─────────────────────────────────────────────────────────────

	private updateExpShards(dt: number): void {
		const pp = this.player.group.position;
		const u = this.player.upgrades;
		this.expShardManager.update(dt, pp, u.collectRange, u.magnetRange, (value) => {
			const leveled = this.levelSystem.addExp(value);
			this.emitExpUpdate();
			if (leveled) this.triggerLevelUp();
		});
	}

	// ─── 발판 체력 포션 / 카드 보급 ───────────────────────────────────────────────

	private updatePlatformLoot(dt: number): void {
		this.platformHealthSpawnAcc += dt;
		if (this.platformHealthSpawnAcc >= this.platformHealthNextIn) {
			this.platformHealthSpawnAcc = 0;
			this.platformHealthNextIn = 24 + Math.random() * 12;
			this.trySpawnPlatformHealth();
		}
		this.platformCardSpawnAcc += dt;
		if (this.platformCardSpawnAcc >= this.platformCardNextIn) {
			this.platformCardSpawnAcc = 0;
			this.platformCardNextIn = 24 + Math.random() * 12;
			this.trySpawnPlatformCard();
		}

		const pp = this.player.group.position;
		for (let i = this.platformHealthPotions.length - 1; i >= 0; i--) {
			const pot = this.platformHealthPotions[i];
			if (!pot.update(dt)) {
				pot.dispose();
				this.platformHealthPotions.splice(i, 1);
				continue;
			}
			if (pot.tryCollect(pp)) {
				const before = this.player.stats.hp;
				this.player.healByMaxHpFraction(0.24);
				const gained = this.player.stats.hp - before;
				if (gained > 0) {
					EventBus.emit('damage-number', {
						pos: pp.clone().add(new THREE.Vector3(0, 2.1, 0)),
						amount: gained,
						type: 'heal'
					});
				}
				pot.dispose();
				this.platformHealthPotions.splice(i, 1);
			}
		}

		for (let i = this.platformCardCaches.length - 1; i >= 0; i--) {
			const cache = this.platformCardCaches[i];
			if (!cache.update(dt)) {
				cache.dispose();
				this.platformCardCaches.splice(i, 1);
				continue;
			}
			if (cache.tryCollect(pp)) {
				this.isLevelUpPaused = true;
				EventBus.emit('field-card-offer', { cards: getRandomCards(3, this.favoredCardIds) });
				cache.dispose();
				this.platformCardCaches.splice(i, 1);
			}
		}
	}

	private trySpawnPlatformHealth(): void {
		if (this.platformHealthPotions.length >= 2) return;
		const pt = this.stage.getPlatformLootPoint('health');
		if (!pt) return;
		this.platformHealthPotions.push(new PlatformHealthPotion(this.scene, pt));
	}

	private trySpawnPlatformCard(): void {
		if (this.platformCardCaches.length >= 2) return;
		const pt = this.stage.getPlatformLootPoint('card');
		if (!pt) return;
		this.platformCardCaches.push(new PlatformCardCache(this.scene, pt));
	}

	private triggerLevelUp(): void {
		this.isLevelUpPaused = true;
		const cards = getRandomCards(3, this.favoredCardIds);
		this.player.setLevel(this.levelSystem.level); // 캐릭터 진화
		this.syncVisualThemeTextures();
		EventBus.emit('level-up', { level: this.levelSystem.level, cards });
	}

	private emitExpUpdate(): void {
		EventBus.emit('exp-update', {
			level: this.levelSystem.level,
			exp: this.levelSystem.exp,
			expToNext: this.levelSystem.expToNext,
			progress: this.levelSystem.progress
		});
	}

	// ─── 처치 처리 + EXP 드롭 ───────────────────────────────────────────────────

	private handleDeaths(): void {
		for (const m of this.monsters) {
			if (m.isDead() && m.group.visible) {
				m.group.visible = false;

				// 킬 이펙트
				this.spawnKillEffect(m.group.position.clone());
				// 킬 연속 처치
				this.killStreakTimer = 3000;
				this.killStreak++;
				if (this.killStreak >= 5) {
					this.camCtrl.shake(0.25, 250);
					EventBus.emit('kill-streak', { streak: this.killStreak });
				}
				if (m.config.isBoss) this.camCtrl.shake(0.6, 500);

				// EXP 조각 드롭
				const baseExp = Math.max(3, Math.floor(m.maxHp / 8));
				const numShards = m.config.isBoss ? 8 : Math.min(3, Math.ceil(m.config.scale));
				const expPerShard = m.config.isBoss ? Math.floor(m.maxHp * 0.5 / numShards) : baseExp;
				const px = m.group.position.x;
				const pz = m.group.position.z;
				for (let s = 0; s < numShards; s++) {
					const ox = (Math.random() - 0.5) * 2.5;
					const oz = (Math.random() - 0.5) * 2.5;
					if (!this.expShardManager.spawn(px + ox, pz + oz, expPerShard)) {
						const leveled = this.levelSystem.addExp(expPerShard);
						this.emitExpUpdate();
						if (leveled) this.triggerLevelUp();
					}
				}

				if (m.config.isBoss) {
					const bt = m.config.bossAnimalType;
					if (bt) this.bossKillsByType[bt]++;
					EventBus.emit('boss-defeated');
				} else {
					this.normalMonsterKills++;
				}
				this.emitKillStats();

				const ref = m;
				setTimeout(() => {
					ref.dispose(this.scene);
					const idx = this.monsters.indexOf(ref);
					if (idx >= 0) this.monsters.splice(idx, 1);
				}, 500);

				EventBus.emit('monster-count-update', {
					remaining: this.monsters.filter((x) => !x.isDead()).length,
					total: 0
				});
			}
		}
	}

	// ─── 웨이브 시스템 ───────────────────────────────────────────────────────────

	private updateWaveSystem(dt: number): void {
		const alive = this.combat.aliveCount();
		const { spawnMonster, spawnBoss } = this.waveSystem.update(dt, alive, this.levelSystem.level);

		if (spawnMonster) this.spawnMonster(this.applyLateGameDifficulty(this.waveSystem.getSpawnConfig()));
		if (spawnBoss) {
			this.spawnBoss(this.applyLateGameDifficulty(this.waveSystem.getBossConfig()));
			EventBus.emit('boss-incoming');
		}
		EventBus.emit('monster-count-update', { remaining: this.combat.aliveCount(), total: 0 });
	}

	private onBossDefeated(): void {
		// 보스 처치 시 HP 완전 회복
		this.player.stats.hp = this.player.stats.maxHp;
		this.player.drawHeadHud(this.player.stats.hp, this.player.stats.maxHp, this.player.getCurrentLevel());
		EventBus.emit('hp-update', { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
		this.waveSystem.onBossKilled();
		this.applyDifficultyTheme(this.waveSystem.diffTier);
		EventBus.emit('boss-cleared');
	}

	/** 난이도 티어(0~4)에 따라 씬 배경·안개·조명·구조물 테마 변경 */
	private applyDifficultyTheme(tier: number): void {
		tier = Math.min(tier, 4);
		const themes = [
			{ bg: 0x8fb0cc, fog: 0x8fb0cc, fogNear: 100, fogFar: 180, ambient: 0xffeedd, ambInt: 1.6, dir: 0xffffff, dirInt: 2.2 },
			{ bg: 0x9a5535, fog: 0x9a5535, fogNear: 85, fogFar: 160, ambient: 0xffaa66, ambInt: 1.4, dir: 0xff8833, dirInt: 2.0 },
			{ bg: 0x1a3a5a, fog: 0x1a3a5a, fogNear: 90, fogFar: 165, ambient: 0x8899ff, ambInt: 1.5, dir: 0x6699ff, dirInt: 2.2 },
			{ bg: 0x5a1020, fog: 0x5a1020, fogNear: 70, fogFar: 140, ambient: 0xff6633, ambInt: 1.3, dir: 0xff3300, dirInt: 2.5 },
			{ bg: 0x180828, fog: 0x180828, fogNear: 60, fogFar: 130, ambient: 0xaa66ff, ambInt: 1.2, dir: 0xcc44ff, dirInt: 2.8 },
		];
		const t = themes[tier];
		const fog = this.scene.fog as THREE.Fog;
		if (fog) { fog.color.setHex(t.fog); fog.near = t.fogNear; fog.far = t.fogFar; }
		// 조명 업데이트
		this.scene.traverse((obj) => {
			if (obj instanceof THREE.AmbientLight) {
				obj.color.setHex(t.ambient); obj.intensity = t.ambInt;
			}
			if (obj instanceof THREE.DirectionalLight) {
				obj.color.setHex(t.dir); obj.intensity = t.dirInt;
			}
		});
		// 진화 F 팔레트를 먼저 반영한 뒤 웨이브 티어로 바닥·파사드 틴트 (지붕·상단은 form 기준)
		this.stage.setEvolutionForm(formForLevel(this.player.getCurrentLevel()));
		this.stage.setWaveTheme(tier);
	}

	/** 현재 레벨 → 진화 form → 배경·맵·건물 `_{1..6}.png` 동기화 */
	private syncVisualThemeTextures(): void {
		this.stage.setEvolutionForm(formForLevel(this.player.getCurrentLevel()));
		const tier = Math.min(this.waveSystem.diffTier, 4);
		const themes = [
			0x8fb0cc, 0x9a5535, 0x1a3a5a, 0x5a1020, 0x180828
		];
		const fallbackHex = themes[tier];
		const form = formForLevel(this.player.getCurrentLevel());
		const imgIdx = visualThemeImageIndexFromForm(form);
		this.requestBackgroundTexture(imgIdx, fallbackHex);
		this.stage.applyVisualThemeImages(imgIdx);
		this.ensureBackgroundQuads();
	}

	/** `background_{index}.png` — index는 1..BACKGROUND_IMAGE_COUNT (진화 F 단계에서 결정). 한 면을 SUB×SUB으로 쪼개 타일 반복. */
	private requestBackgroundTexture(imageIndex: number, fallbackHex: number): void {
		const index = Math.min(Math.max(1, Math.floor(imageIndex)), BACKGROUND_IMAGE_COUNT);
		if (index === this.backgroundImageIndex && this.backgroundTexture) {
			if (this.backgroundQuadGroup?.parent === this.scene) return;
			this.backgroundLoadingIndex = 0;
			return;
		}
		if (this.backgroundLoadingIndex === index) return;

		this.backgroundImageIndex = index;
		this.backgroundLoadingIndex = index;

		if (this.backgroundTexture) {
			this.clearBackgroundQuads();
			this.backgroundTexture.dispose();
			this.backgroundTexture = null;
		}
		this.scene.background = new THREE.Color(fallbackHex);

		const url = `/images/background/background_${index}.png`;
		const loader = new THREE.TextureLoader();
		const loadIndex = index;

		loader.load(
			url,
			(tex) => {
				this.backgroundLoadingIndex = 0;
				if (loadIndex !== this.backgroundImageIndex) {
					tex.dispose();
					return;
				}
				if (this.backgroundTexture) {
					this.clearBackgroundQuads();
					this.backgroundTexture.dispose();
				}
				this.applyBackgroundTilingTextureSettings(tex);
				this.backgroundTexture = tex;
				this.buildBackgroundTiledPlane(tex);
			},
			undefined,
			() => {
				this.backgroundLoadingIndex = 0;
				if (loadIndex !== this.backgroundImageIndex) return;
				this.clearBackgroundQuads();
				this.scene.background = new THREE.Color(fallbackHex);
			}
		);
	}

	/** 한 면에 텍스처를 반복 타일링 — 이음새는 Repeat + 세그먼트 메쉬로 완화 */
	private applyBackgroundTilingTextureSettings(tex: THREE.Texture): void {
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		const r = BACKGROUND_TEXTURE_REPEAT;
		tex.repeat.set(r, r);
		tex.offset.set(0, 0);
		tex.generateMipmaps = true;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.magFilter = THREE.LinearFilter;
		const maxA = this.renderer.capabilities.getMaxAnisotropy();
		tex.anisotropy = Math.min(16, maxA);
	}

	/** 재시작 등으로 씬에서 제거된 뒤에도 동일 티어 텍스처가 있으면 배경 면만 복구 */
	private ensureBackgroundQuads(): void {
		if (!this.backgroundTexture) return;
		if (this.backgroundQuadGroup?.parent === this.scene) return;
		this.buildBackgroundTiledPlane(this.backgroundTexture);
	}

	private syncBackgroundQuadsToCamera(): void {
		if (!this.backgroundQuadGroup) return;
		this.backgroundQuadGroup.position.copy(this.camera.position);
		this.backgroundQuadGroup.quaternion.copy(this.camera.quaternion);
	}

	private clearBackgroundQuads(): void {
		if (!this.backgroundQuadGroup) return;
		this.scene.remove(this.backgroundQuadGroup);
		for (const ch of this.backgroundQuadGroup.children) {
			const mesh = ch as THREE.Mesh;
			mesh.geometry.dispose();
			const mat = mesh.material as THREE.MeshBasicMaterial;
			mat.map = null;
			mat.dispose();
		}
		this.backgroundQuadGroup.clear();
		this.backgroundQuadGroup = null;
	}

	/**
	 * 시야에 맞는 **한 평면**을 SUB×SUB으로만 쪼개고(4개 면), UV는 0~1로 두고
	 * 텍스처 repeat로 **같은 이미지를 면 전체에 타일**한다. (아틀라스 4분할 아님)
	 */
	private buildBackgroundTiledPlane(mapTex: THREE.Texture): void {
		this.clearBackgroundQuads();
		const group = new THREE.Group();
		group.name = 'BackgroundTiledPlane';
		const d = BACKGROUND_QUAD_DISTANCE;
		const vFov = THREE.MathUtils.degToRad(this.camera.fov);
		const halfH = d * Math.tan(vFov * 0.5);
		const halfW = halfH * this.camera.aspect;
		const fullW = halfW * 2;
		const fullH = halfH * 2;
		const sub = BACKGROUND_PLANE_SUBDIV;

		const geom = new THREE.PlaneGeometry(fullW, fullH, sub, sub);
		const mat = new THREE.MeshBasicMaterial({
			map: mapTex,
			depthTest: false,
			depthWrite: false,
			fog: false,
			toneMapped: true
		});
		const mesh = new THREE.Mesh(geom, mat);
		mesh.frustumCulled = false;
		mesh.renderOrder = -1000;
		mesh.position.set(0, 0, -d);
		group.add(mesh);

		this.backgroundQuadGroup = group;
		this.scene.add(group);
		this.syncBackgroundQuadsToCamera();
	}

	// ─── 스폰 ────────────────────────────────────────────────────────────────────

	/** 레벨 15+ — 스탯·사거리 몬스터 탄속·연사·보스 AOE 압박 가속 */
	private applyLateGameDifficulty(cfg: MonsterConfig): MonsterConfig {
		const b = lateGameBrutality(this.levelSystem.level);
		const mul = cfg.isBoss ? b.bossStatMul : b.statMul;
		if (mul <= 1) return cfg;
		const aoeExtraTight =
			cfg.isBoss && cfg.aoeCooldownMs != null
				? Math.max(0.55, 0.92 - b.bossAoeBurstBonus * 0.045 - b.bossAoePeriodicExtra * 0.04)
				: 1;
		return {
			...cfg,
			hp: Math.round(cfg.hp * mul),
			attack: Math.round(cfg.attack * mul),
			defense: Math.round(cfg.defense * mul),
			speed: Math.min(cfg.speed * (1 + (mul - 1) * 0.26), cfg.isBoss ? 12 : 16),
			projectileSpeed:
				cfg.projectileSpeed != null ? cfg.projectileSpeed * (1 + (mul - 1) * 0.22) : undefined,
			fireRateMs: cfg.fireRateMs != null ? Math.max(220, cfg.fireRateMs * 0.76) : undefined,
			aoeCooldownMs:
				cfg.aoeCooldownMs != null
					? Math.max(900, cfg.aoeCooldownMs * 0.86 * aoeExtraTight)
					: undefined,
			...(cfg.isBoss
				? {
						bossAoeBurstBonus: b.bossAoeBurstBonus,
						bossAoePeriodicExtra: b.bossAoePeriodicExtra
					}
				: {})
		};
	}

	private spawnMonster(config: MonsterConfig): void {
		const pos = this.getRandomSpawnPos();
		this.monsters.push(new Monster(this.scene, pos, config));
	}

	private spawnBoss(config: MonsterConfig): void {
		this.monsters.push(new Monster(this.scene, this.getBossSpawnPos(), config));
	}

	private getRandomSpawnPos(): THREE.Vector3 {
		const b = this.stage.bounds;
		const pp = this.player.group.position;
		// 넓은 맵: 플레이어 주변 25~70 유닛 범위에서 스폰 (너무 멀거나 너무 가깝지 않게)
		const minDist = 25, maxDist = 70;
		let pos!: THREE.Vector3;
		let attempts = 0;
		do {
			const angle = Math.random() * Math.PI * 2;
			const dist  = minDist + Math.random() * (maxDist - minDist);
			const x = Math.max(b.minX + 5, Math.min(b.maxX - 5, pp.x + Math.cos(angle) * dist));
			const z = Math.max(b.minZ + 5, Math.min(b.maxZ - 5, pp.z + Math.sin(angle) * dist));
			pos = new THREE.Vector3(x, 0, z);
			attempts++;
		} while (attempts < 12 && pos.distanceTo(pp) < minDist);
		return pos;
	}

	private getBossSpawnPos(): THREE.Vector3 {
		const b = this.stage.bounds;
		const pp = this.player.group.position;
		const cx = (b.minX + b.maxX) / 2;
		const cz = (b.minZ + b.maxZ) / 2;
		return new THREE.Vector3(
			Math.max(b.minX + 4, Math.min(b.maxX - 4, cx + (cx - pp.x) * 0.6)),
			0,
			Math.max(b.minZ + 4, Math.min(b.maxZ - 4, cz + (cz - pp.z) * 0.6))
		);
	}

	private emitGameEnd(victory: boolean): void {
		if (this.isGameOver) return;
		this.isGameOver = true;
		EventBus.emit('survival-time-update', { seconds: this.survivalTime });
		const survivalSec = Math.floor(this.survivalTime);
		const lv = this.levelSystem.level;
		const bosses = { ...this.bossKillsByType };
		const score = computeRunScore({
			level: lv,
			survivalSeconds: survivalSec,
			bossKills: bosses
		});
		const shop = getShopSettingsForGame();
		EventBus.emit('game-over', {
			victory,
			survivalTime: survivalSec,
			bossCount: this.waveSystem.bossCount,
			level: lv,
			normalKills: this.normalMonsterKills,
			bosses,
			scoreTotal: score.total,
			scoreBoss: score.partBoss,
			scoreLevel: score.partLevel,
			scoreTime: score.partTime,
			mechBase: shop.mechBase
		});
	}

	private checkEnd(): void {
		if (this.player.state === 'dead') {
			this.emitGameEnd(false);
			return;
		}
		if (this.survivalTime >= VICTORY_SURVIVAL_SECONDS) {
			this.emitGameEnd(true);
		}
	}

	// ─── 킬 이펙트 (폭발 빛 구체) ────────────────────────────────────────────────

	private spawnKillEffect(pos: THREE.Vector3): void {
		const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.9 });
		const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), mat);
		mesh.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
		this.scene.add(mesh);
		this.killEffects.push({ mesh, life: 1.0 });
	}

	private updateKillEffects(dt: number): void {
		for (let i = this.killEffects.length - 1; i >= 0; i--) {
			const ef = this.killEffects[i];
			ef.life -= dt * 3.5;
			if (ef.life <= 0) {
				this.scene.remove(ef.mesh);
				this.killEffects.splice(i, 1);
				continue;
			}
			const t = 1 - ef.life;
			ef.mesh.scale.setScalar(1 + t * 3.5);
			(ef.mesh.material as THREE.MeshBasicMaterial).opacity = ef.life * 0.85;
		}
	}

	/** 플레이어 미사일이 적·보스에 명중한 표면 근처 좌표 */
	private spawnMissileHitImpact(pos: THREE.Vector3): void {
		const c = this.playerMissileColor;
		const col = new THREE.Color(c);

		const ring = new THREE.Mesh(
			new THREE.RingGeometry(0.14, 0.48, 22),
			new THREE.MeshBasicMaterial({
				color: col,
				transparent: true,
				opacity: 0.92,
				side: THREE.DoubleSide,
				blending: THREE.AdditiveBlending,
				depthWrite: false
			})
		);
		ring.rotation.x = -Math.PI / 2;
		ring.position.copy(pos);
		this.scene.add(ring);
		this.missileHitEffects.push({ mesh: ring, life: 1 });

		const flash = new THREE.Mesh(
			new THREE.SphereGeometry(0.24, 8, 8),
			new THREE.MeshBasicMaterial({
				color: col,
				transparent: true,
				opacity: 0.78,
				blending: THREE.AdditiveBlending,
				depthWrite: false
			})
		);
		flash.position.copy(pos);
		this.scene.add(flash);
		this.missileHitEffects.push({ mesh: flash, life: 1 });
	}

	private updateMissileHitEffects(dt: number): void {
		for (let i = this.missileHitEffects.length - 1; i >= 0; i--) {
			const ef = this.missileHitEffects[i];
			ef.life -= dt * 5.2;
			if (ef.life <= 0) {
				this.scene.remove(ef.mesh);
				ef.mesh.geometry.dispose();
				(ef.mesh.material as THREE.Material).dispose();
				this.missileHitEffects.splice(i, 1);
				continue;
			}
			const mat = ef.mesh.material as THREE.MeshBasicMaterial;
			const isSphere = ef.mesh.geometry instanceof THREE.SphereGeometry;
			mat.opacity = ef.life * (isSphere ? 0.78 : 0.92);
			const grow = 1 + (1 - ef.life) * (isSphere ? 2.2 : 3.8);
			ef.mesh.scale.setScalar(grow);
		}
	}

	private updateKillStreak(dt: number): void {
		if (this.killStreakTimer > 0) {
			this.killStreakTimer -= dt * 1000;
			if (this.killStreakTimer <= 0) {
				this.killStreak = 0;
			}
		}
	}

	// ─── 보스 AOE 범위공격 ───────────────────────────────────────────────────────

	private static readonly AOE_RIM_COLORS: Record<BossAoeKind, number> = {
		bear: 0xff6600,
		wolf: 0x88ccff,
		dragon: 0xff4400,
		tiger: 0xffee88,
		ironlord: 0xaa66ff
	};

	private static readonly AOE_FILL_COLORS: Record<BossAoeKind, number> = {
		bear: 0xff3311,
		wolf: 0x5599ee,
		dragon: 0xff7700,
		tiger: 0xffffcc,
		ironlord: 0x7744cc
	};

	private onBossAoeRequest = (...args: unknown[]): void => {
		const d = args[0] as {
			x: number; y: number; z: number; radius: number; fillMs: number; damage: number;
			aoeKind?: BossAoeKind;
		};
		const kind: BossAoeKind = d.aoeKind ?? 'bear';

		const rimGeo = new THREE.RingGeometry(d.radius * 0.93, d.radius, 52);
		const rimMat = new THREE.MeshBasicMaterial({
			color: GameEngine.AOE_RIM_COLORS[kind],
			transparent: true,
			opacity: 0.78,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const rim = new THREE.Mesh(rimGeo, rimMat);
		rim.rotation.x = -Math.PI / 2;
		rim.position.set(d.x, d.y + 0.07, d.z);
		rim.renderOrder = 4;
		this.scene.add(rim);

		// Y축 실린더 — XZ 평면에서 반지름이 모든 방향 동일한 정원(원기둥 단면)
		const fillH = 0.07;
		const fillMat = new THREE.MeshBasicMaterial({
			color: GameEngine.AOE_FILL_COLORS[kind],
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const fillDisc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, fillH, 72, 1, false), fillMat);
		fillDisc.position.set(d.x, d.y + 0.06 + fillH * 0.5, d.z);
		fillDisc.scale.set(0.02 * d.radius, 1, 0.02 * d.radius);
		fillDisc.renderOrder = 3;
		this.scene.add(fillDisc);

		this.aoeEffects.push({
			rim,
			fillDisc,
			maxR: d.radius,
			fillMs: d.fillMs,
			damage: d.damage,
			kind,
			elapsed: 0,
			hasDamaged: false,
			fadeTimer: 0
		});
	};

	private updateAoeEffects(dt: number): void {
		const ms = dt * 1000;
		for (let i = this.aoeEffects.length - 1; i >= 0; i--) {
			const ae = this.aoeEffects[i];
			const fillMat = ae.fillDisc.material as THREE.MeshBasicMaterial;
			const rimMat  = ae.rim.material as THREE.MeshBasicMaterial;

			if (!ae.hasDamaged) {
				ae.elapsed += ms;
				const progress = Math.min(1, ae.elapsed / ae.fillMs);
				const radScale = Math.max(0.02, progress) * ae.maxR;
				ae.fillDisc.scale.set(radScale, 1, radScale);
				fillMat.opacity = progress * 0.62;
				rimMat.opacity = progress > 0.82
					? 0.45 + Math.sin(progress * Math.PI * 18) * 0.48
					: 0.78;

				if (progress >= 1) {
					ae.hasDamaged = true;
					fillMat.opacity = 0.82;
					rimMat.opacity = 1;
					const cx = ae.fillDisc.position.x;
					const cz = ae.fillDisc.position.z;
					const pp = this.player.group.position;
					const dx = pp.x - cx;
					const dz = pp.z - cz;
					if (Math.sqrt(dx * dx + dz * dz) <= ae.maxR) {
						const away = new THREE.Vector3(dx, 0, dz).normalize();
						this.player.takeDamage(ae.damage, away);
						EventBus.emit('damage-number', {
							pos: new THREE.Vector3(pp.x, pp.y + 1.5, pp.z),
							amount: ae.damage,
							type: 'take'
						});
					}
					this.spawnBossStrike(ae.kind, cx, ae.fillDisc.position.y, cz, ae.maxR);
				}
			} else {
				ae.fadeTimer += ms;
				const fade = 1 - Math.min(1, ae.fadeTimer / 480);
				fillMat.opacity = 0.82 * fade;
				rimMat.opacity = fade;
				if (fade <= 0) {
					this.scene.remove(ae.fillDisc, ae.rim);
					ae.fillDisc.geometry.dispose();
					ae.rim.geometry.dispose();
					fillMat.dispose();
					rimMat.dispose();
					this.aoeEffects.splice(i, 1);
				}
			}
		}
	}

	private spawnBossStrike(kind: BossAoeKind, x: number, y: number, z: number, r: number): void {
		const meshes: THREE.Mesh[] = [];
		const lights: THREE.PointLight[] = [];
		const groundY = y + 0.08;

		if (kind === 'bear') {
			const coreR = Math.max(0.52, r * 0.21);
			const coreMat = new THREE.MeshStandardMaterial({
				color: 0xff5530,
				emissive: new THREE.Color(0xff2200),
				emissiveIntensity: 1.35,
				roughness: 0.28,
				metalness: 0.55
			});
			const core = new THREE.Mesh(new THREE.IcosahedronGeometry(coreR, 1), coreMat);
			core.position.set(x, y + 17.5, z);
			core.castShadow = true;
			this.scene.add(core);
			meshes.push(core);

			for (let i = 0; i < 5; i++) {
				const ember = new THREE.Mesh(
					new THREE.SphereGeometry(Math.max(0.14, r * 0.055), 7, 6),
					new THREE.MeshBasicMaterial({
						color: i < 2 ? 0xffcc66 : 0xff5522,
						transparent: true,
						opacity: 0.78
					})
				);
				ember.position.copy(core.position);
				this.scene.add(ember);
				meshes.push(ember);
			}

			const shock = new THREE.Mesh(
				new THREE.RingGeometry(0.06, 0.22, 40),
				new THREE.MeshBasicMaterial({
					color: 0xfff0cc,
					transparent: true,
					opacity: 0,
					side: THREE.DoubleSide,
					depthWrite: false
				})
			);
			shock.rotation.x = -Math.PI / 2;
			shock.position.set(x, groundY + 0.11, z);
			this.scene.add(shock);
			meshes.push(shock);

			const Lmain = new THREE.PointLight(0xff7722, Math.min(11, r * 0.5), r * 5.5);
			const Lsub = new THREE.PointLight(0xffaa55, 5, r * 2.8);
			Lmain.position.copy(core.position);
			Lsub.position.copy(core.position);
			this.scene.add(Lmain, Lsub);
			lights.push(Lmain, Lsub);

			this.bossStrikeAnims.push({
				kind,
				meshes,
				lights,
				t: 0,
				groundY,
				cx: x,
				cz: z,
				r,
				bearExtra: { phase: 'fall', impactT: 0, hist: [] }
			});
			return;
		}

		if (kind === 'wolf') {
			const n = 7;
			for (let k = 0; k < n; k++) {
				const ang = (k / n) * Math.PI * 2;
				const blade = new THREE.Mesh(
					new THREE.BoxGeometry(r * 0.06, 0.08, r * 0.92),
					new THREE.MeshBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: 0.95 })
				);
				blade.position.set(x + Math.cos(ang) * r * 0.32, groundY + 0.06, z + Math.sin(ang) * r * 0.32);
				blade.rotation.y = ang;
				this.scene.add(blade);
				meshes.push(blade);
			}
			this.bossStrikeAnims.push({ kind, meshes, lights, t: 0, groundY, cx: x, cz: z, r });
			return;
		}

		if (kind === 'dragon') {
			const ball = new THREE.Mesh(
				new THREE.SphereGeometry(r * 0.34, 16, 16),
				new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.88 })
			);
			ball.position.set(x, groundY + r * 0.14, z);
			this.scene.add(ball);
			meshes.push(ball);
			const L = new THREE.PointLight(0xff3300, 8, r * 3);
			L.position.copy(ball.position);
			this.scene.add(L);
			lights.push(L);
			this.bossStrikeAnims.push({ kind, meshes, lights, t: 0, groundY, cx: x, cz: z, r });
			return;
		}

		if (kind === 'tiger') {
			for (let b = 0; b < 5; b++) {
				const ang = (b / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
				const bolt = new THREE.Mesh(
					new THREE.CylinderGeometry(0.06, 0.12, r * 1.15, 6),
					new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 })
				);
				bolt.position.set(x + Math.cos(ang) * r * 0.22, groundY + r * 0.52, z + Math.sin(ang) * r * 0.22);
				this.scene.add(bolt);
				meshes.push(bolt);
			}
			const L = new THREE.PointLight(0xaaccff, 12, r * 2.6);
			L.position.set(x, groundY + 1, z);
			this.scene.add(L);
			lights.push(L);
			this.bossStrikeAnims.push({ kind, meshes, lights, t: 0, groundY, cx: x, cz: z, r });
			return;
		}

		const torus = new THREE.Mesh(
			new THREE.TorusGeometry(r * 0.42, r * 0.06, 10, 32),
			new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.9 })
		);
		torus.rotation.x = Math.PI / 2;
		torus.position.set(x, groundY + 0.1, z);
		this.scene.add(torus);
		meshes.push(torus);
		const L2 = new THREE.PointLight(0x9966ff, 5, r * 2);
		L2.position.set(x, groundY + 0.5, z);
		this.scene.add(L2);
		lights.push(L2);
		this.bossStrikeAnims.push({ kind, meshes, lights, t: 0, groundY, cx: x, cz: z, r });
	}

	private updateBossStrikeAnims(dt: number): void {
		for (let i = this.bossStrikeAnims.length - 1; i >= 0; i--) {
			const fx = this.bossStrikeAnims[i];
			fx.t += dt;

			const disposeFx = (): void => {
				for (const m of fx.meshes) {
					this.scene.remove(m);
					m.geometry.dispose();
					(m.material as THREE.Material).dispose();
				}
				for (const L of fx.lights) {
					this.scene.remove(L);
					L.dispose();
				}
				this.bossStrikeAnims.splice(i, 1);
			};

			if (fx.kind === 'bear' && fx.bearExtra) {
				const core = fx.meshes[0];
				const shock = fx.meshes[6];
				const be = fx.bearExtra;

				if (be.phase === 'fall') {
					const accel = 1 + fx.t * 0.45;
					core.position.y -= dt * (54 * accel);
					const fallFrac = Math.min(1, (fx.groundY + 17.5 - core.position.y) / 17);
					core.position.x = fx.cx + Math.sin(fx.t * 15 + fx.r) * 0.55 * fallFrac;
					core.position.z = fx.cz + Math.cos(fx.t * 12.5) * 0.5 * fallFrac;
					core.rotation.x += dt * 6.2;
					core.rotation.y += dt * 8.5;
					core.rotation.z += dt * 3.8;

					be.hist.unshift(core.position.clone());
					if (be.hist.length > 22) be.hist.pop();

					for (let j = 1; j <= 5; j++) {
						const hi = Math.min(be.hist.length - 1, j * 3 + 1);
						const tgt = be.hist[hi] ?? core.position;
						fx.meshes[j].position.lerp(tgt, 0.62);
						const em = fx.meshes[j].material as THREE.MeshBasicMaterial;
						em.opacity = Math.max(0.2, 0.82 - j * 0.11 + Math.sin(fx.t * 22 + j) * 0.1);
					}

					fx.lights[0].position.copy(core.position);
					fx.lights[1].position.copy(core.position).add(new THREE.Vector3(0, -1.4, 0));
					fx.lights[0].intensity = Math.min(13, 6.5 + fx.t * 3.5);

					if (core.position.y <= fx.groundY + 0.38) {
						be.phase = 'impact';
						core.position.y = fx.groundY + 0.32;
						this.camCtrl.shake(0.62, 280);
						(shock.material as THREE.MeshBasicMaterial).opacity = 0.92;
					}
				} else {
					be.impactT += dt;
					const imp = be.impactT;
					shock.scale.setScalar(1 + imp * (fx.r * 4.8));
					(shock.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.92 - imp * 2.6);
					const cr = core.material as THREE.MeshStandardMaterial;
					core.scale.setScalar(Math.max(0.12, 1 - imp * 3.8));
					cr.emissiveIntensity = 1.35 + imp * 10;
					for (let j = 1; j <= 5; j++) {
						fx.meshes[j].position.y += dt * 3.2;
						(fx.meshes[j].material as THREE.MeshBasicMaterial).opacity *= 0.9;
					}
					fx.lights[0].intensity = Math.max(0, 13 - imp * 28);
					fx.lights[1].intensity = Math.max(0, 5 - imp * 14);
					if (imp > 0.48) disposeFx();
				}
				continue;
			}

			if (fx.kind === 'wolf') {
				for (const m of fx.meshes) {
					m.rotation.y += dt * 5.5;
					(m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - fx.t / 0.52);
				}
				if (fx.t > 0.52) disposeFx();
				continue;
			}

			if (fx.kind === 'dragon') {
				const m = fx.meshes[0];
				const sc = 1 + fx.t * 2.9;
				m.scale.setScalar(sc);
				(m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.88 - fx.t * 1.15);
				for (const L of fx.lights) L.intensity = Math.max(0, 8 - fx.t * 13);
				if (fx.t > 0.62) disposeFx();
				continue;
			}

			if (fx.kind === 'tiger') {
				for (const m of fx.meshes) {
					const mat = m.material as THREE.MeshBasicMaterial;
					mat.opacity = fx.t < 0.08 ? 1 : Math.max(0, 1 - (fx.t - 0.08) / 0.34);
				}
				for (const L of fx.lights) L.intensity = Math.max(0, 12 - fx.t * 21);
				if (fx.t > 0.48) disposeFx();
				continue;
			}

			const tor = fx.meshes[0];
			const pulse = 1 + Math.sin(fx.t * 14) * 0.12;
			tor.scale.setScalar(pulse * (1 + fx.t * 0.55));
			(tor.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - fx.t * 1.05);
			for (const L of fx.lights) L.intensity = Math.max(0, 5 - fx.t * 7.5);
			if (fx.t > 0.68) disposeFx();
		}
	}

	// ─── 몬스터 분리힘 (서로 겹치지 않도록) ─────────────────────────────────────

	private resolveMonsterSeparation(a: Monster, b: Monster): void {
		const MIN = 1.1;
		if (a.isDead() || b.isDead()) return;
		const dx = b.group.position.x - a.group.position.x;
		const dz = b.group.position.z - a.group.position.z;
		const d2 = dx * dx + dz * dz;
		const minD = MIN * ((a.config.scale + b.config.scale) * 0.5);
		if (d2 >= minD * minD || d2 <= 0.001) return;
		const d = Math.sqrt(d2);
		const push = (minD - d) * 0.5;
		const nx = dx / d,
			nz = dz / d;
		a.group.position.x -= nx * push;
		a.group.position.z -= nz * push;
		b.group.position.x += nx * push;
		b.group.position.z += nz * push;
	}

	/** 3×3 셀 이웃만 검사 + 다수일 때 격프레임으로 비용 절감 */
	private separateMonsters(): void {
		let alive = 0;
		for (const m of this.monsters) {
			if (!m.isDead()) alive++;
		}
		if (alive > 40 && (this.simFrame & 1)) return;

		const CELL = 5;
		const map = this.separateCellBuckets;
		for (const arr of map.values()) {
			arr.length = 0;
			this.separateBucketPool.push(arr);
		}
		map.clear();

		for (let i = 0; i < this.monsters.length; i++) {
			const m = this.monsters[i];
			if (m.isDead()) continue;
			const ix = Math.floor(m.group.position.x / CELL);
			const iz = Math.floor(m.group.position.z / CELL);
			const key = ix + ',' + iz;
			let bucket = map.get(key);
			if (!bucket) {
				bucket = this.separateBucketPool.pop() ?? [];
				map.set(key, bucket);
			}
			bucket.push(i);
		}

		for (let i = 0; i < this.monsters.length; i++) {
			const a = this.monsters[i];
			if (a.isDead()) continue;
			const ix = Math.floor(a.group.position.x / CELL);
			const iz = Math.floor(a.group.position.z / CELL);
			for (let dx = -1; dx <= 1; dx++) {
				for (let dz = -1; dz <= 1; dz++) {
					const key = ix + dx + ',' + (iz + dz);
					const arr = map.get(key);
					if (!arr) continue;
					for (const j of arr) {
						if (j <= i) continue;
						this.resolveMonsterSeparation(a, this.monsters[j]);
					}
				}
			}
		}
	}

	// ─── 재시작 ──────────────────────────────────────────────────────────────────

	private async restart(): Promise<void> {
		await refreshShopSettingsForGame();
		EventBus.off('boss-aoe-request', this.onBossAoeRequest);
		for (const p of this.projectiles) p.dispose(this.scene);
		for (const p of this.playerProjectiles) p.dispose(this.scene);
		this.expShardManager.dispose(this.scene);
		for (const fx of this.bossStrikeAnims) {
			for (const m of fx.meshes) {
				this.scene.remove(m);
				m.geometry.dispose();
				(m.material as THREE.Material).dispose();
			}
			for (const L of fx.lights) {
				this.scene.remove(L);
				L.dispose();
			}
		}
		this.bossStrikeAnims = [];
		for (const ae of this.aoeEffects) {
			this.scene.remove(ae.fillDisc, ae.rim);
			ae.fillDisc.geometry.dispose();
			ae.rim.geometry.dispose();
			(ae.fillDisc.material as THREE.MeshBasicMaterial).dispose();
			(ae.rim.material as THREE.MeshBasicMaterial).dispose();
		}
		this.aoeEffects = [];
		for (const pot of this.platformHealthPotions) pot.dispose();
		this.platformHealthPotions = [];
		for (const cache of this.platformCardCaches) cache.dispose();
		this.platformCardCaches = [];
		this.projectiles = [];
		this.playerProjectiles = [];
		this.damageNumbers.clear();
		while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
		this.setupLights();
		this.initGame();
		this.applyDifficultyTheme(this.waveSystem.diffTier);
		this.syncVisualThemeTextures();
	}

	private onResize(): void {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
		this.relayoutBackgroundQuads();
	}

	private relayoutBackgroundQuads(): void {
		if (!this.backgroundQuadGroup || !this.backgroundTexture) return;
		const mesh = this.backgroundQuadGroup.children[0] as THREE.Mesh | undefined;
		if (!mesh) return;
		const d = BACKGROUND_QUAD_DISTANCE;
		const vFov = THREE.MathUtils.degToRad(this.camera.fov);
		const halfH = d * Math.tan(vFov * 0.5);
		const halfW = halfH * this.camera.aspect;
		const sub = BACKGROUND_PLANE_SUBDIV;
		mesh.geometry.dispose();
		mesh.geometry = new THREE.PlaneGeometry(halfW * 2, halfH * 2, sub, sub);
		mesh.position.set(0, 0, -d);
	}

	destroy(): void {
		cancelAnimationFrame(this.animId);
		window.removeEventListener('resize', this.resizeHandler);
		EventBus.off('restart-game', this.restartHandler);
		EventBus.off('boss-defeated', this.bossDefeatedHandler);
		EventBus.off('enemy-projectile', this.enemyProjectileHandler);
		EventBus.off('upgrade-chosen', this.upgradeChosenHandler);
		EventBus.off('player-hit', this.playerHitHandler);
		EventBus.off('player-boundary-fall', this.boundaryFallShakeHandler);
		EventBus.off('game-pause-set', this.pauseSetHandler);
		for (const fx of this.bossStrikeAnims) {
			for (const m of fx.meshes) {
				this.scene.remove(m);
				m.geometry.dispose();
				(m.material as THREE.Material).dispose();
			}
			for (const L of fx.lights) {
				this.scene.remove(L);
				L.dispose();
			}
		}
		this.bossStrikeAnims = [];
		for (const ae of this.aoeEffects) {
			this.scene.remove(ae.fillDisc, ae.rim);
			ae.fillDisc.geometry.dispose();
			ae.rim.geometry.dispose();
			(ae.fillDisc.material as THREE.MeshBasicMaterial).dispose();
			(ae.rim.material as THREE.MeshBasicMaterial).dispose();
		}
		this.aoeEffects = [];
		for (const pot of this.platformHealthPotions) pot.dispose();
		this.platformHealthPotions = [];
		for (const cache of this.platformCardCaches) cache.dispose();
		this.platformCardCaches = [];
		this.input.destroy();
		this.damageNumbers.destroy();
		for (const p of this.projectiles) p.dispose(this.scene);
		for (const p of this.playerProjectiles) p.dispose(this.scene);
		this.expShardManager.dispose(this.scene);
		for (const ef of this.missileHitEffects) {
			this.scene.remove(ef.mesh);
			ef.mesh.geometry.dispose();
			(ef.mesh.material as THREE.Material).dispose();
		}
		this.missileHitEffects = [];
		this.clearBackgroundQuads();
		if (this.backgroundTexture) {
			this.backgroundTexture.dispose();
			this.backgroundTexture = null;
		}
		this.scene.background = null;
		this.renderer.dispose();
		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
		}
	}
}
