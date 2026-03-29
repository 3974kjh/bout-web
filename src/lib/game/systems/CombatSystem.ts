import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Monster } from '../entities/Monster';
import { EventBus } from '../bridge/EventBus';

export function calculateDamage(atk: number, def: number): number {
	return Math.max(1, Math.floor(atk - def * 0.5));
}

/** 몬스터 → 플레이어 근접 공격만 처리. 플레이어 공격은 GameEngine 자동 미사일로 처리 */
export class CombatSystem {
	private player: Player;
	private monsters: Monster[];

	constructor(player: Player, monsters: Monster[]) {
		this.player = player;
		this.monsters = monsters;
	}

	update(): void {
		this.monsterAttacks();
	}

	private monsterAttacks(): void {
		const pp = this.player.group.position;
		const hitR2 = 3.5 * 3.5;
		for (const m of this.monsters) {
			if (m.isDead() || !m.isInAttackState()) continue;
			const mx = m.group.position.x,
				my = m.group.position.y,
				mz = m.group.position.z;
			const dx = pp.x - mx,
				dy = pp.y - my,
				dz = pp.z - mz;
			if (dx * dx + dy * dy + dz * dz > hitR2) continue;

			const knockDir = new THREE.Vector3(dx, 0, dz);
			if (knockDir.lengthSq() < 1e-10) continue;
			knockDir.normalize();

			const dmg = calculateDamage(m.config.attack, this.player.stats.defense);
			const hit = this.player.takeDamage(dmg, knockDir);
			if (hit) {
				EventBus.emit('damage-number', {
					pos: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
					amount: dmg,
					type: 'take'
				});
				EventBus.emit('player-hit', { damage: dmg });
			}
		}
	}

	aliveCount(): number {
		return this.monsters.filter((x) => !x.isDead()).length;
	}
}
