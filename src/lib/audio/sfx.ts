/**
 * 효과음 — Web Audio API (`AudioBuffer` + `AudioBufferSourceNode`).
 * HTMLAudioElement 다중 인스턴스·play() 디코드 경합을 피하고, 동시 음성 수·우선순위·스로틀로 전투 구간 병목을 완화.
 */

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { audioSettings } from '$lib/stores/audioSettings';

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

/** 낮을수록 먼저 잘리거나 스킵됨 */
type Tier = 0 | 1 | 2;

interface Voice {
	source: AudioBufferSourceNode;
	gain: GainNode;
	url: string;
	tier: Tier;
	t0: number;
}

const MAX_ACTIVE = 11;
/** URL별 동시 재생 상한(고빈도 전투음) */
const URL_CAP: Partial<Record<string, number>> = {
	[SFX.enemyDamage]: 2,
	[SFX.playerMissile]: 3
};

const THROTTLE_MS: Partial<Record<string, number>> = {
	[SFX.playerMissile]: 32,
	[SFX.enemyDamage]: 48,
	[SFX.playerDamage]: 80
};

const lastPlayMs = new Map<string, number>();
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const active: Voice[] = [];

function tierForUrl(url: string): Tier {
	if (
		url === SFX.playerDeath ||
		url === SFX.enemyDeath ||
		url === SFX.uiBossWarning
	) {
		return 0;
	}
	if (url === SFX.enemyDamage || url === SFX.playerMissile) return 2;
	return 1;
}

function initContext(): AudioContext | null {
	if (!browser || typeof window === 'undefined') return null;
	if (ctx) return ctx;
	const AC = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AC) return null;
	ctx = new AC({ latencyHint: 'interactive' });
	masterGain = ctx.createGain();
	masterGain.connect(ctx.destination);
	const s = get(audioSettings);
	masterGain.gain.value = s.sfxMuted ? 0 : s.sfxVolume;
	return ctx;
}

if (browser) {
	audioSettings.subscribe((v) => {
		const g = v.sfxMuted ? 0 : v.sfxVolume;
		if (masterGain && ctx) {
			try {
				masterGain.gain.setValueAtTime(g, ctx.currentTime);
			} catch {
				masterGain.gain.value = g;
			}
		}
	});
}

function removeVoice(v: Voice): void {
	const i = active.indexOf(v);
	if (i >= 0) active.splice(i, 1);
}

function stopVoice(v: Voice): void {
	try {
		v.source.stop();
	} catch {
		/* already ended */
	}
	removeVoice(v);
}

function countUrl(url: string): number {
	let n = 0;
	for (const v of active) if (v.url === url) n++;
	return n;
}

function oldestForUrl(url: string): Voice | null {
	let best: Voice | null = null;
	for (const v of active) {
		if (v.url !== url) continue;
		if (!best || v.t0 < best.t0) best = v;
	}
	return best;
}

/** 해당 티어만 — 가장 오래된 음성 (낮은 우선순위 티어부터 정리) */
function oldestOfPriority(p: Tier): Voice | null {
	let best: Voice | null = null;
	for (const v of active) {
		if (v.tier !== p) continue;
		if (!best || v.t0 < best.t0) best = v;
	}
	return best;
}

/** 동시 재생 한도 — 스팸(2) → 일반(1) → 중요(0) 순으로 희생 */
function makeRoom(url: string, tier: Tier): boolean {
	const cap = URL_CAP[url];
	if (cap != null) {
		while (countUrl(url) >= cap) {
			const o = oldestForUrl(url);
			if (!o) break;
			stopVoice(o);
		}
	}

	while (active.length >= MAX_ACTIVE) {
		if (tier === 2) {
			const v2 = oldestOfPriority(2);
			if (v2) {
				stopVoice(v2);
				continue;
			}
			return false;
		}
		if (tier === 1) {
			const v2 = oldestOfPriority(2);
			if (v2) {
				stopVoice(v2);
				continue;
			}
			const v1 = oldestOfPriority(1);
			if (v1) {
				stopVoice(v1);
				continue;
			}
			return false;
		}
		const v2 = oldestOfPriority(2);
		if (v2) {
			stopVoice(v2);
			continue;
		}
		const v1 = oldestOfPriority(1);
		if (v1) {
			stopVoice(v1);
			continue;
		}
		const v0 = oldestOfPriority(0);
		if (v0) {
			stopVoice(v0);
			continue;
		}
		return false;
	}
	return true;
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
	const c = initContext();
	if (!c) return null;
	const hit = buffers.get(url);
	if (hit) return hit;
	let p = loading.get(url);
	if (!p) {
		p = (async () => {
			try {
				const res = await fetch(url);
				if (!res.ok) return null;
				const ab = await res.arrayBuffer();
				const copy = ab.byteLength ? ab.slice(0) : ab;
				return await c.decodeAudioData(copy);
			} catch {
				return null;
			} finally {
				loading.delete(url);
			}
		})();
		loading.set(url, p);
	}
	const buf = await p;
	if (buf) buffers.set(url, buf);
	return buf;
}

function innerPlay(buf: AudioBuffer, url: string, volume: number, tier: Tier): void {
	const c = initContext();
	if (!c || !masterGain || buf.duration <= 0) return;

	void c.resume().catch(() => {});

	if (!makeRoom(url, tier)) return;

	const source = c.createBufferSource();
	const g = c.createGain();
	g.gain.value = Math.min(1, Math.max(0, volume));
	source.buffer = buf;
	source.connect(g);
	g.connect(masterGain);

	const entry: Voice = { source, gain: g, url, tier, t0: performance.now() };
	active.push(entry);
	source.onended = () => removeVoice(entry);

	try {
		source.start(c.currentTime);
	} catch {
		removeVoice(entry);
	}
}

function passThrottle(src: string): boolean {
	const throttle = THROTTLE_MS[src];
	if (throttle == null) return true;
	const now = performance.now();
	const prev = lastPlayMs.get(src) ?? 0;
	if (now - prev < throttle) return false;
	lastPlayMs.set(src, now);
	return true;
}

export function playSfx(src: string, volume = 0.88): void {
	if (!browser) return;
	const s = get(audioSettings);
	if (s.sfxMuted || s.sfxVolume <= 0) return;

	const tier = tierForUrl(src);
	const buf = buffers.get(src);
	if (buf) {
		if (!passThrottle(src)) return;
		innerPlay(buf, src, volume, tier);
		return;
	}
	void loadBuffer(src).then((b) => {
		if (!b) return;
		if (!passThrottle(src)) return;
		innerPlay(b, src, volume, tier);
	});
}

/** 게임 진입 등에서 미리 디코드·컨텍스트 resume (첫 피격 전 버벅임 완화) */
export async function warmupSfx(): Promise<void> {
	if (!browser) return;
	const c = initContext();
	if (!c) return;
	await Promise.all(Object.values(SFX).map((url) => loadBuffer(url)));
	await c.resume().catch(() => {});
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
