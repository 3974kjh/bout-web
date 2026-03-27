import type { MechBase } from '$lib/domain/types';

/** 레거시 localStorage 키 — 최초 IDB 로드 시 마이그레이션 후 삭제 */
export const SHOP_STORAGE_KEY = 'bout-shop-v1';

export interface ShopSettings {
	mechBase: MechBase;
	missileSkinId: string;
	/** 레벨업/필드 보급 랜덤 풀에서 가중치 상승 (최대 개수는 UI에서 제한) */
	favoredCardIds: string[];
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
	mechBase: 'hypersuit',
	missileSkinId: 'cyan',
	favoredCardIds: []
};

export const MAX_FAVORED_CARDS = 6;

export const MISSILE_SKINS: ReadonlyArray<{ id: string; label: string; color: number }> = [
	{ id: 'cyan', label: '시안 펄스', color: 0x00ccff },
	{ id: 'magenta', label: '마젠타 볼트', color: 0xff44cc },
	{ id: 'gold', label: '골드 스트라이크', color: 0xffcc22 },
	{ id: 'lime', label: '라임 플라즈마', color: 0x66ff44 },
	{ id: 'violet', label: '바이올렛 빔', color: 0xaa66ff },
	{ id: 'ember', label: '엠버 코어', color: 0xff6622 },
	{ id: 'ice', label: '아이스 스파이크', color: 0xaaddff },
	{ id: 'blood', label: '크림슨', color: 0xff2244 }
];

export function missileColorForSkin(skinId: string): number {
	const s = MISSILE_SKINS.find((x) => x.id === skinId);
	return s?.color ?? 0x00ccff;
}

const MECH_SET = new Set<MechBase>(['hypersuit', 'azonas-v', 'geren', 'expressive', 'soldier']);

function clampFavored(ids: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= MAX_FAVORED_CARDS) break;
	}
	return out;
}

/** IDB/마이그레이션/기본값 통합 검증 */
export function normalizeShopSettings(raw: unknown): ShopSettings {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_SHOP_SETTINGS };
	const j = raw as Partial<ShopSettings>;
	const mechBase = MECH_SET.has(j.mechBase as MechBase) ? (j.mechBase as MechBase) : DEFAULT_SHOP_SETTINGS.mechBase;
	const missileSkinId =
		typeof j.missileSkinId === 'string' && MISSILE_SKINS.some((s) => s.id === j.missileSkinId)
			? j.missileSkinId
			: DEFAULT_SHOP_SETTINGS.missileSkinId;
	const favoredCardIds = Array.isArray(j.favoredCardIds) ? clampFavored(j.favoredCardIds.map(String)) : [];
	return { mechBase, missileSkinId, favoredCardIds };
}

export const MECH_SHOP_INFO: Record<
	MechBase,
	{ name: string; tag: string; blurb: string }
> = {
	hypersuit: {
		name: '하이퍼슈트',
		tag: '밸런스',
		blurb: 'HP·방어에 여유. 안정적인 연행 작전에 적합합니다.'
	},
	'azonas-v': {
		name: '아조나스 V',
		tag: '기동·화력',
		blurb: '높은 속도와 공격. 회피와 딜링을 동시에 노릴 때.'
	},
	geren: {
		name: '게렌',
		tag: '장갑',
		blurb: '최고 HP와 방어. 보스전·난전에서 버티기 유리합니다.'
	},
	expressive: {
		name: '익스프레시브',
		tag: 'GLTF · 스키닝',
		blurb: '리깅 GLB. 레벨·Form마다 색·질감·오라로 진화합니다. 이 기체를 고르면 작전에서 GLTF가 사용됩니다.'
	},
	soldier: {
		name: '솔저',
		tag: 'Mixamo · 스키닝',
		blurb: 'three.js 예제 Soldier.glb — Idle/Walk/Run 스켈레탈 블렌딩. 작전에서 동일 GLB가 로드됩니다.'
	}
};
