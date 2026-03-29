import type { MechBase } from '$lib/domain/types';
import { MECH_SHOP_INFO, MISSILE_SKINS } from '$lib/game/shopSettings';
import type { Locale } from './locale';
import en from './messages/en.json';
import ko from './messages/ko.json';

const dict: Record<Locale, Record<string, unknown>> = { ko, en };

function walk(root: unknown, parts: string[]): unknown {
	let cur: unknown = root;
	for (const p of parts) {
		if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
		else return undefined;
	}
	return cur;
}

export function translate(
	loc: Locale,
	key: string,
	params?: Record<string, string | number>
): string {
	const parts = key.split('.');
	const primary = walk(dict[loc], parts);
	let resolved: string;
	if (typeof primary === 'string') {
		resolved = primary;
	} else {
		const altLoc: Locale = loc === 'ko' ? 'en' : 'ko';
		const alt = walk(dict[altLoc], parts);
		if (typeof alt !== 'string') return key;
		resolved = alt;
	}
	let s = resolved;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			s = s.split(`{${k}}`).join(String(v));
		}
	}
	return s;
}

export function numberLocaleTag(loc: Locale): string {
	return loc === 'en' ? 'en-US' : 'ko-KR';
}

export function mechShopLine(
	loc: Locale,
	base: MechBase,
	field: 'name' | 'tag' | 'blurb'
): string {
	if (loc === 'ko') return MECH_SHOP_INFO[base][field];
	const k = `mech.${base}.${field}`;
	const out = translate(loc, k);
	return out === k ? MECH_SHOP_INFO[base][field] : out;
}

export function missileSkinLabel(loc: Locale, skinId: string): string {
	const k = `shop.missileSkin.${skinId}`;
	const out = translate(loc, k);
	if (out !== k) return out;
	const s = MISSILE_SKINS.find((x) => x.id === skinId);
	return s?.label ?? skinId;
}
