/** 효과음 — `static/sfx/` (빌드 후 `/sfx/...` 로 서빙). 풀링 + 스로틀로 GC·동시 재생 폭주 완화 */

import { effectiveSfxMultiplier } from '$lib/stores/audioSettings';

export const SFX = {
	playerMissile: '/sfx/player/missile_fire.wav',
	playerDamage: '/sfx/player/damage.wav',
	playerDeath: '/sfx/player/death.wav',
	playerDash: '/sfx/player/dash.wav',
	enemyDamage: '/sfx/enemy/damage.wav',
	enemyDeath: '/sfx/enemy/death.wav',
	uiButton: '/sfx/ui/button_click.wav',
	uiModal: '/sfx/ui/modal_open.wav',
	uiBossWarning: '/sfx/ui/boss_warning.wav'
} as const;

const POOL_SIZE = 10;
const pools = new Map<string, HTMLAudioElement[]>();
const lastPlayMs = new Map<string, number>();

/** 경로별 최소 간격(ms). 없으면 스로틀 없음 */
const THROTTLE_MS: Partial<Record<string, number>> = {
	[SFX.playerMissile]: 26,
	[SFX.enemyDamage]: 38,
	[SFX.playerDamage]: 72
};

function canPlay(): boolean {
	return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function getPool(src: string): HTMLAudioElement[] {
	let p = pools.get(src);
	if (!p) {
		p = [];
		for (let i = 0; i < POOL_SIZE; i++) p.push(new Audio(src));
		pools.set(src, p);
	}
	return p;
}

export function playSfx(src: string, volume = 0.88): void {
	if (!canPlay()) return;
	const mul = effectiveSfxMultiplier();
	if (mul <= 0) return;

	const throttle = THROTTLE_MS[src];
	if (throttle != null) {
		const now = performance.now();
		const prev = lastPlayMs.get(src) ?? 0;
		if (now - prev < throttle) return;
		lastPlayMs.set(src, now);
	}

	try {
		const pool = getPool(src);
		let a: HTMLAudioElement | null = null;
		for (const el of pool) {
			if (el.paused || el.ended) {
				a = el;
				break;
			}
		}
		if (!a) a = pool[0];
		a.volume = Math.min(1, Math.max(0, volume * mul));
		a.currentTime = 0;
		void a.play().catch(() => {});
	} catch {
		/* ignore */
	}
}

export function playPlayerMissile(): void {
	playSfx(SFX.playerMissile, 0.72);
}

export function playPlayerDamage(): void {
	playSfx(SFX.playerDamage, 0.82);
}

export function playPlayerDeath(): void {
	playSfx(SFX.playerDeath, 0.9);
}

export function playPlayerDash(): void {
	playSfx(SFX.playerDash, 0.68);
}

export function playEnemyDamage(): void {
	playSfx(SFX.enemyDamage, 0.78);
}

export function playEnemyDeath(): void {
	playSfx(SFX.enemyDeath, 0.88);
}

export function playUiButton(): void {
	playSfx(SFX.uiButton, 0.55);
}

export function playUiModalOpen(): void {
	playSfx(SFX.uiModal, 0.62);
}

export function playUiBossWarning(): void {
	playSfx(SFX.uiBossWarning, 0.72);
}
