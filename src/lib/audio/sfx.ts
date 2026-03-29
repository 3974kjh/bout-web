/** 효과음 — `static/sfx/` (빌드 후 `/sfx/...` 로 서빙) */

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

function canPlay(): boolean {
	return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function playSfx(src: string, volume = 0.88): void {
	if (!canPlay()) return;
	const mul = effectiveSfxMultiplier();
	if (mul <= 0) return;
	try {
		const a = new Audio(src);
		a.volume = Math.min(1, Math.max(0, volume * mul));
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
