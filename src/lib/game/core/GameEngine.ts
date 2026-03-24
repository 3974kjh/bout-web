import * as THREE from 'three';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Projectile } from '../entities/Projectile';
import { HealthItem } from '../entities/HealthItem';
import { CombatSystem } from '../systems/CombatSystem';
import { TransformSystem } from '../systems/TransformSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { calculateStats } from '../systems/PartsSystem';
import { TrainingPlanet } from '../stages/TrainingPlanet';
import { DamageNumbers } from '../ui/DamageNumbers';
import { EventBus } from '../bridge/EventBus';
import { GAUGE_ON_TAKE } from '../constants/GameConfig';
import type { MechParts, MonsterConfig } from '$lib/domain/types';

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
	private projectiles: Projectile[] = [];
	private items: HealthItem[] = [];
	private itemSpawnTimer = 0;
	private readonly itemSpawnInterval = 18; // seconds
	private stage!: TrainingPlanet;
	private combat!: CombatSystem;
	private transform!: TransformSystem;
	private waveSystem!: WaveSystem;
	private isGameOver = false;
	private animId = 0;
	private container: HTMLElement;

	private restartHandler = (): void => this.restart();
	private resizeHandler = (): void => this.onResize();
	private bossDefeatedHandler = (): void => this.onBossDefeated();
	private enemyProjectileHandler = (...args: unknown[]): void => {
		const d = args[0] as { pos: THREE.Vector3; dir: THREE.Vector3; damage: number; speed: number };
		const proj = new Projectile(this.scene, d.pos.clone(), d.dir.clone(), d.speed, d.damage, 0xff4400);
		this.projectiles.push(proj);
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
		this.scene.background = new THREE.Color(0x0e0e1a);
		this.scene.fog = new THREE.Fog(0x0e0e1a, 50, 90);

		this.camera = new THREE.PerspectiveCamera(
			50,
			container.clientWidth / container.clientHeight,
			0.1,
			200
		);
		this.camera.position.set(0, 14, 24);

		this.clock = new THREE.Clock();
		this.input = new InputManager();
		this.camCtrl = new CameraController(this.camera);
		this.damageNumbers = new DamageNumbers(container, this.camera, this.renderer.domElement);

		this.setupLights();
		this.initGame();

		window.addEventListener('resize', this.resizeHandler);
		EventBus.on('restart-game', this.restartHandler);
		EventBus.on('boss-defeated', this.bossDefeatedHandler);
		EventBus.on('enemy-projectile', this.enemyProjectileHandler);
		this.animate();
	}

	private setupLights(): void {
		this.scene.add(new THREE.AmbientLight(0x404060, 0.7));
		this.scene.add(new THREE.HemisphereLight(0x6688cc, 0x443322, 0.5));

		const dir = new THREE.DirectionalLight(0xffeedd, 1.3);
		dir.position.set(15, 30, 15);
		dir.castShadow = true;
		dir.shadow.mapSize.set(1024, 1024); // reduced for perf
		dir.shadow.camera.left = -40;
		dir.shadow.camera.right = 40;
		dir.shadow.camera.top = 40;
		dir.shadow.camera.bottom = -40;
		dir.shadow.camera.near = 1;
		dir.shadow.camera.far = 80;
		this.scene.add(dir);
	}

	private initGame(): void {
		this.isGameOver = false;

		this.stage = new TrainingPlanet(this.scene);

		const emptyParts: MechParts = { head: null, body: null, arm: null, leg: null, weapon: null };
		const stats = calculateStats('hypersuit', emptyParts);
		this.player = new Player(this.scene, new THREE.Vector3(0, 0, 20), stats);
		this.transform = new TransformSystem(stats);

		this.monsters = [];
		this.projectiles = [];
		this.items = [];
		this.itemSpawnTimer = this.itemSpawnInterval * 0.4; // first item sooner
		this.waveSystem = new WaveSystem();

		// Spawn a small initial set of enemies (updated scales)
		const initialConfigs: MonsterConfig[] = [
			{ name: 'Beta Machine', hp: 35, attack: 7, defense: 3, speed: 3.5, detectionRange: 12, attackRange: 2.5, bodyColor: 0xcc7722, accentColor: 0xddaa44, scale: 1.15 },
			{ name: 'Beta Machine', hp: 35, attack: 7, defense: 3, speed: 3.5, detectionRange: 12, attackRange: 2.5, bodyColor: 0xcc7722, accentColor: 0xddaa44, scale: 1.15 },
			{ name: 'Alpha Machine', hp: 30, attack: 8, defense: 2, speed: 4.5, detectionRange: 14, attackRange: 2.2, bodyColor: 0xaa2222, accentColor: 0xcc4444, scale: 1.1 },
			{ name: 'Alpha Machine', hp: 30, attack: 8, defense: 2, speed: 4.5, detectionRange: 14, attackRange: 2.2, bodyColor: 0xaa2222, accentColor: 0xcc4444, scale: 1.1 }
		];
		for (const cfg of initialConfigs) {
			this.spawnMonster(cfg);
		}

		this.combat = new CombatSystem(this.player, this.monsters);

		EventBus.emit('wave-update', { wave: 1 });
		EventBus.emit('monster-count-update', { remaining: this.monsters.length, total: 0 });
	}

	private animate = (): void => {
		this.animId = requestAnimationFrame(this.animate);
		const dt = Math.min(this.clock.getDelta(), 0.05);

		if (!this.isGameOver) {
			this.input.update();
			this.player.update(dt, this.input, this.stage);

			for (const m of this.monsters) {
				if (!m.isDead()) m.update(dt, this.player.group.position, this.stage);
			}

			this.combat.update();
			this.handleTransform(dt);
			this.handleDeaths();
			this.updateProjectiles(dt);
			this.updateItems(dt);
			this.updateWaveSystem(dt);
			this.checkEnd();
		}

		this.camCtrl.update(dt, this.player.group.position);
		this.renderer.render(this.scene, this.camera);
		this.damageNumbers.update(dt);
	};

	private handleTransform(dt: number): void {
		if (this.player.transformState === 'transformed') {
			const revert = this.transform.drain(this.player.stats, dt * 1000);
			if (revert) {
				this.transform.revert(this.player.stats);
				this.player.setTransformed(false);
			}
		} else if (
			(this.input.justDown('KeyZ') || this.input.justDown('ShiftLeft')) &&
			this.transform.canTransform(this.player.stats)
		) {
			this.transform.apply(this.player.stats);
			this.player.setTransformed(true);
		}
	}

	private handleDeaths(): void {
		for (const m of this.monsters) {
			if (m.isDead() && m.group.visible) {
				m.group.visible = false;
				const ref = m;
				setTimeout(() => {
					ref.dispose(this.scene);
					const idx = this.monsters.indexOf(ref);
					if (idx >= 0) this.monsters.splice(idx, 1);
				}, 500);
			}
		}
	}

	private updateProjectiles(dt: number): void {
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const p = this.projectiles[i];
			p.update(dt);

			if (p.alive) {
				const dist = p.mesh.position.distanceTo(this.player.group.position);
				if (dist < 1.2) {
					const knockDir = new THREE.Vector3()
						.subVectors(this.player.group.position, p.mesh.position)
						.setY(0)
						.normalize();
					const hit = this.player.takeDamage(p.damage, knockDir);
					if (hit) {
						this.player.stats.transformGauge = Math.min(
							this.player.stats.maxTransformGauge,
							this.player.stats.transformGauge + GAUGE_ON_TAKE
						);
						EventBus.emit('damage-number', {
							pos: this.player.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
							amount: p.damage,
							type: 'take'
						});
					}
					p.alive = false;
				}
			}

			if (!p.alive) {
				p.dispose(this.scene);
				this.projectiles.splice(i, 1);
			}
		}
	}

	private updateItems(dt: number): void {
		// Spawn new health items on timer (max 2 active at once)
		this.itemSpawnTimer += dt;
		if (this.itemSpawnTimer >= this.itemSpawnInterval && this.items.length < 2) {
			this.itemSpawnTimer = 0;
			this.spawnHealthItem();
		}

		for (let i = this.items.length - 1; i >= 0; i--) {
			const item = this.items[i];
			const alive = item.update(dt);

			if (item.tryCollect(this.player.group.position)) {
				const missing = this.player.stats.maxHp - this.player.stats.hp;
				const heal = Math.max(1, Math.floor(missing * 0.4));
				this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + heal);
				EventBus.emit('hp-update', {
					hp: this.player.stats.hp,
					maxHp: this.player.stats.maxHp
				});
				EventBus.emit('damage-number', {
					pos: this.player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
					amount: heal,
					type: 'heal'
				});
				item.dispose();
				this.items.splice(i, 1);
			} else if (!alive) {
				item.dispose();
				this.items.splice(i, 1);
			}
		}
	}

	private spawnHealthItem(): void {
		const b = this.stage.bounds;
		const margin = 6;
		const x = b.minX + margin + Math.random() * (b.maxX - b.minX - margin * 2);
		const z = b.minZ + margin + Math.random() * (b.maxZ - b.minZ - margin * 2);
		this.items.push(new HealthItem(this.scene, new THREE.Vector3(x, 0, z)));
	}

	private updateWaveSystem(dt: number): void {
		const alive = this.combat.aliveCount();
		const action = this.waveSystem.update(dt, alive);

		if (action === 'spawn') {
			this.spawnMonster(this.waveSystem.getSpawnConfig());
			EventBus.emit('monster-count-update', {
				remaining: this.combat.aliveCount() + 1,
				total: 0
			});
		} else if (action === 'boss') {
			this.waveSystem.onBossSpawned();
			this.spawnBoss(this.waveSystem.getBossConfig());
			EventBus.emit('boss-incoming');
		}
	}

	private onBossDefeated(): void {
		// Restore full HP
		this.player.stats.hp = this.player.stats.maxHp;
		EventBus.emit('hp-update', { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });

		// Advance wave
		this.waveSystem.onBossKilled();
		EventBus.emit('wave-update', { wave: this.waveSystem.wave });
		EventBus.emit('boss-cleared');
	}

	private spawnMonster(config: MonsterConfig): void {
		const pos = this.getRandomSpawnPos();
		const m = new Monster(this.scene, pos, config);
		this.monsters.push(m);
	}

	private spawnBoss(config: MonsterConfig): void {
		const pos = this.getBossSpawnPos();
		const m = new Monster(this.scene, pos, config);
		this.monsters.push(m);
	}

	private getRandomSpawnPos(): THREE.Vector3 {
		const b = this.stage.bounds;
		const bW = b.maxX - b.minX;
		const bD = b.maxZ - b.minZ;
		const margin = 3;
		let pos: THREE.Vector3;
		let attempts = 0;
		do {
			const side = Math.floor(Math.random() * 4);
			switch (side) {
				case 0:
					pos = new THREE.Vector3(b.minX + margin, 0, b.minZ + Math.random() * bD);
					break;
				case 1:
					pos = new THREE.Vector3(b.maxX - margin, 0, b.minZ + Math.random() * bD);
					break;
				case 2:
					pos = new THREE.Vector3(b.minX + Math.random() * bW, 0, b.minZ + margin);
					break;
				default:
					pos = new THREE.Vector3(b.minX + Math.random() * bW, 0, b.maxZ - margin);
					break;
			}
			attempts++;
		} while (pos!.distanceTo(this.player.group.position) < 8 && attempts < 10);
		return pos!;
	}

	private getBossSpawnPos(): THREE.Vector3 {
		const b = this.stage.bounds;
		const pp = this.player.group.position;
		const cx = (b.minX + b.maxX) / 2;
		const cz = (b.minZ + b.maxZ) / 2;
		// Spawn opposite side from player
		const x = cx + (cx - pp.x) * 0.6;
		const z = cz + (cz - pp.z) * 0.6;
		return new THREE.Vector3(
			Math.max(b.minX + 4, Math.min(b.maxX - 4, x)),
			0,
			Math.max(b.minZ + 4, Math.min(b.maxZ - 4, z))
		);
	}

	private checkEnd(): void {
		if (this.player.state === 'dead') {
			this.isGameOver = true;
			EventBus.emit('wave-update', { wave: this.waveSystem.wave });
		}
	}

	private restart(): void {
		// Clean up projectiles and items
		for (const p of this.projectiles) p.dispose(this.scene);
		this.projectiles = [];
		for (const item of this.items) item.dispose();
		this.items = [];

		this.damageNumbers.clear();
		while (this.scene.children.length > 0) {
			this.scene.remove(this.scene.children[0]);
		}
		this.setupLights();
		this.initGame();
	}

	private onResize(): void {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
	}

	destroy(): void {
		cancelAnimationFrame(this.animId);
		window.removeEventListener('resize', this.resizeHandler);
		EventBus.off('restart-game', this.restartHandler);
		EventBus.off('boss-defeated', this.bossDefeatedHandler);
		EventBus.off('enemy-projectile', this.enemyProjectileHandler);
		this.input.destroy();
		this.damageNumbers.destroy();
		for (const p of this.projectiles) p.dispose(this.scene);
		for (const item of this.items) item.dispose();
		this.renderer.dispose();
		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
		}
	}
}
