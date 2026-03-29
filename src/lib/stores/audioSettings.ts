import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';

const LS = {
	bgmVol: 'bout-audio-bgm-vol',
	sfxVol: 'bout-audio-sfx-vol',
	bgmMute: 'bout-audio-bgm-mute',
	sfxMute: 'bout-audio-sfx-mute'
} as const;

export type AudioSettingsState = {
	bgmVolume: number;
	sfxVolume: number;
	bgmMuted: boolean;
	sfxMuted: boolean;
};

const defaults: AudioSettingsState = {
	bgmVolume: 0.38,
	sfxVolume: 1,
	bgmMuted: false,
	sfxMuted: false
};

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function load(): AudioSettingsState {
	if (!browser) return { ...defaults };
	try {
		const bv = localStorage.getItem(LS.bgmVol);
		const sv = localStorage.getItem(LS.sfxVol);
		return {
			bgmVolume: clamp01(bv != null && bv !== '' ? parseFloat(bv) : defaults.bgmVolume),
			sfxVolume: clamp01(sv != null && sv !== '' ? parseFloat(sv) : defaults.sfxVolume),
			bgmMuted: localStorage.getItem(LS.bgmMute) === '1',
			sfxMuted: localStorage.getItem(LS.sfxMute) === '1'
		};
	} catch {
		return { ...defaults };
	}
}

function persist(s: AudioSettingsState): void {
	if (!browser) return;
	try {
		localStorage.setItem(LS.bgmVol, String(s.bgmVolume));
		localStorage.setItem(LS.sfxVol, String(s.sfxVolume));
		localStorage.setItem(LS.bgmMute, s.bgmMuted ? '1' : '0');
		localStorage.setItem(LS.sfxMute, s.sfxMuted ? '1' : '0');
	} catch {
		/* private mode */
	}
}

export const audioSettings = writable<AudioSettingsState>(load());

if (browser) {
	audioSettings.subscribe((v) => persist(v));
}

export function effectiveBgmVolume(): number {
	const v = get(audioSettings);
	return v.bgmMuted ? 0 : v.bgmVolume;
}

/** 효과음 개별 볼륨에 곱할 0~1 (음소거 시 0) */
export function effectiveSfxMultiplier(): number {
	const v = get(audioSettings);
	return v.sfxMuted ? 0 : v.sfxVolume;
}
