import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Locale = 'ko' | 'en';

const STORAGE_KEY = 'bout.locale';

function readInitial(): Locale {
	if (!browser) return 'ko';
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === 'en' || v === 'ko') return v;
	} catch {
		/* ignore */
	}
	try {
		const nav = navigator.language?.slice(0, 2).toLowerCase();
		if (nav === 'en') return 'en';
	} catch {
		/* ignore */
	}
	return 'ko';
}

export const locale = writable<Locale>(readInitial());

export function setLocale(next: Locale): void {
	locale.set(next);
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		/* ignore */
	}
	document.documentElement.lang = next;
}
