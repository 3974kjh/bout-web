import type { MechStats } from '$lib/domain/types';
import { TRANSFORM_DRAIN_PER_SEC, TRANSFORM_MULT } from '../constants/GameConfig';

export class TransformSystem {
	private baseAtk: number;
	private baseDef: number;
	private baseSpd: number;

	constructor(stats: MechStats) {
		this.baseAtk = stats.attack;
		this.baseDef = stats.defense;
		this.baseSpd = stats.speed;
	}

	canTransform(s: MechStats): boolean {
		return s.transformGauge >= s.maxTransformGauge;
	}

	apply(s: MechStats): void {
		s.attack = Math.floor(this.baseAtk * TRANSFORM_MULT.attack);
		s.defense = Math.floor(this.baseDef * TRANSFORM_MULT.defense);
		s.speed = Math.floor(this.baseSpd * TRANSFORM_MULT.speed);
	}

	revert(s: MechStats): void {
		s.attack = this.baseAtk;
		s.defense = this.baseDef;
		s.speed = this.baseSpd;
	}

	drain(s: MechStats, dtMs: number): boolean {
		s.transformGauge -= TRANSFORM_DRAIN_PER_SEC * (dtMs / 1000);
		if (s.transformGauge <= 0) {
			s.transformGauge = 0;
			return true;
		}
		return false;
	}

	addGauge(s: MechStats, amount: number): void {
		s.transformGauge = Math.min(s.maxTransformGauge, s.transformGauge + amount);
	}
}
