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
		for (const m of this.monsters) {
			if (m.isDead()) continue;
			const dist = m.group.position.distanceTo(this.player.group.position);
			const knockDir = new THREE.Vector3()
				.subVectors(this.player.group.position, m.group.position)
				.setY(0)
				.normalize();

			// 공격 모션 히트
			if (m.isInAttackState() && dist <= 3.5) {
				const dmg = calculateDamage(m.config.attack, this.player.stats.defense);
				const hit = this.player.takeDamage(dmg, knockDir);
				if (hit) {
					EventBus.emit('damage-number', {
						pos: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
						amount: dmg, type: 'take'
					});
					EventBus.emit('player-hit', { damage: dmg });
				}
			}

			// 접촉 데미지: 몬스터가 플레이어에 닿으면 쿨다운마다 데미지
			const contactRange = 1.5 * m.config.scale;
			if (dist < contactRange && m.contactTimer <= 0) {
				const contactDmg = Math.max(1, Math.floor(m.config.attack * 0.25));
				const hit = this.player.takeDamage(contactDmg, knockDir);
				m.contactTimer = 700; // 700ms 쿨다운
				if (hit) {
					EventBus.emit('damage-number', {
						pos: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
						amount: contactDmg, type: 'take'
					});
					EventBus.emit('player-hit', { damage: contactDmg });
				}
			}
		}
	}

	aliveCount(): number {
		return this.monsters.filter((x) => !x.isDead()).length;
	}
}
