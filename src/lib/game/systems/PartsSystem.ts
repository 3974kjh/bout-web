import type { MechBase, MechParts, MechStats } from '$lib/domain/types';

const BASE_STATS: Record<MechBase, MechStats> = {
	hypersuit: {
		hp: 150,
		maxHp: 150,
		attack: 20,
		defense: 12,
		speed: 8,
		transformGauge: 0,
		maxTransformGauge: 100
	},
	'azonas-v': {
		hp: 120,
		maxHp: 120,
		attack: 24,
		defense: 9,
		speed: 10,
		transformGauge: 0,
		maxTransformGauge: 100
	},
	geren: {
		hp: 180,
		maxHp: 180,
		attack: 17,
		defense: 16,
		speed: 7,
		transformGauge: 0,
		maxTransformGauge: 100
	},
	/** GLTF 스키닝 캐릭터 — 스탯은 하이퍼슈트와 동일(밸런스형) */
	expressive: {
		hp: 150,
		maxHp: 150,
		attack: 20,
		defense: 12,
		speed: 8,
		transformGauge: 0,
		maxTransformGauge: 100
	},
	/** three.js Soldier.glb (Mixamo) — 스탯은 아조나스 V에 가깝게 */
	soldier: {
		hp: 125,
		maxHp: 125,
		attack: 22,
		defense: 10,
		speed: 9,
		transformGauge: 0,
		maxTransformGauge: 100
	}
};

const KEYS: (keyof MechStats)[] = ['maxHp', 'attack', 'defense', 'speed', 'maxTransformGauge'];

export function calculateStats(base: MechBase, parts: MechParts): MechStats {
	const s = { ...BASE_STATS[base] };
	for (const part of Object.values(parts)) {
		if (!part) continue;
		for (const k of KEYS) {
			const mod = part.statModifier[k];
			if (mod !== undefined) s[k] += mod;
		}
	}
	s.hp = s.maxHp;
	s.transformGauge = 0;
	return s;
}
