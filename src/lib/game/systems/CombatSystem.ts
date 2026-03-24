import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Monster } from '../entities/Monster';
import { MELEE_RANGE, GAUGE_ON_DEAL, GAUGE_ON_TAKE, GUARD_REDUCE } from '../constants/GameConfig';
import { EventBus } from '../bridge/EventBus';

export function calculateDamage(atk: number, def: number): number {
	return Math.max(1, Math.floor(atk - def * 0.5));
}

export class CombatSystem {
	private player: Player;
	private monsters: Monster[];
	private hitSet = new Set<string>();
	private lastCombo = -1;

	constructor(player: Player, monsters: Monster[]) {
		this.player = player;
		this.monsters = monsters;
	}

	update(): void {
		if (this.player.activeAttack !== this.lastCombo) {
			this.hitSet.clear();
			this.lastCombo = this.player.activeAttack;
			for (const m of this.monsters) m.wasHitThisSwing = false;
		}
		this.playerAttacks();
		this.monsterAttacks();
	}

	private playerAttacks(): void {
		if (!this.player.isAttackHitFrame()) return;

		const atk = this.player.stats.attack;
		for (const m of this.monsters) {
			if (m.isDead() || this.hitSet.has(m.id)) continue;

			// Simple distance check — no angle restriction
			const dist = this.player.group.position.distanceTo(m.group.position);
			if (dist > MELEE_RANGE) continue;

			const dmg = calculateDamage(atk, m.config.defense);
			const knockDir = new THREE.Vector3()
				.subVectors(m.group.position, this.player.group.position)
				.setY(0)
				.normalize();
			m.takeDamage(dmg, knockDir);
			this.hitSet.add(m.id);

			this.player.stats.transformGauge = Math.min(
				this.player.stats.maxTransformGauge,
				this.player.stats.transformGauge + GAUGE_ON_DEAL
			);

			// Floating damage number at enemy position
			EventBus.emit('damage-number', {
				pos: m.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
				amount: dmg,
				type: 'deal'
			});

			if (m.isDead()) this.onKill(m);
		}
	}

	private monsterAttacks(): void {
		for (const m of this.monsters) {
			if (m.isDead() || !m.isInAttackState()) continue;
			const dist = m.group.position.distanceTo(this.player.group.position);
			if (dist > 3.5) continue;

			let dmg = calculateDamage(m.config.attack, this.player.stats.defense);
			if (this.player.state === 'guarding') dmg = Math.floor(dmg * (1 - GUARD_REDUCE));

			const knockDir = new THREE.Vector3()
				.subVectors(this.player.group.position, m.group.position)
				.setY(0)
				.normalize();
			const hit = this.player.takeDamage(dmg, this.player.state === 'guarding' ? undefined : knockDir);
			if (hit) {
				this.player.stats.transformGauge = Math.min(
					this.player.stats.maxTransformGauge,
					this.player.stats.transformGauge + GAUGE_ON_TAKE
				);

				// Floating damage number at player position
				EventBus.emit('damage-number', {
					pos: this.player.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
					amount: dmg,
					type: 'take'
				});
			}
		}
	}

	private onKill(m: Monster): void {
		const alive = this.monsters.filter((x) => !x.isDead()).length - 1;
		EventBus.emit('monster-count-update', {
			remaining: Math.max(0, alive),
			total: this.monsters.length
		});
		if (m.config.isBoss) {
			EventBus.emit('boss-defeated');
		}
	}

	aliveCount(): number {
		return this.monsters.filter((x) => !x.isDead()).length;
	}
}
