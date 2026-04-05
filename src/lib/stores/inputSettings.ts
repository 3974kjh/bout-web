import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const LS_KEY = 'bout-input-settings-v1';

export type InputDeviceMode = 'keyboard' | 'gamepad';

export type KeyboardBindingSet = {
	moveUp: string;
	moveDown: string;
	moveLeft: string;
	moveRight: string;
	dash: string;
	dashExtra: string;
	jumpPrimary: string;
	jumpSecondary: string;
	/** 화살표 키를 WASD와 함께 이동에 사용 */
	arrowAlternate: boolean;
};

export type GamepadBindingSet = {
	jumpButton: number;
	dashButton: number;
	pauseButton: number;
	backButton: number;
	cardSelect1: number;
	cardSelect2: number;
	cardSelect3: number;
	deadzone: number;
};

export type InputSettingsState = {
	mode: InputDeviceMode;
	keyboard: KeyboardBindingSet;
	gamepad: GamepadBindingSet;
};

export const DEFAULT_KEYBOARD: KeyboardBindingSet = {
	moveUp: 'KeyW',
	moveDown: 'KeyS',
	moveLeft: 'KeyA',
	moveRight: 'KeyD',
	dash: 'ShiftLeft',
	dashExtra: 'ShiftRight',
	jumpPrimary: 'Space',
	jumpSecondary: 'KeyC',
	arrowAlternate: true
};

export const DEFAULT_GAMEPAD: GamepadBindingSet = {
	jumpButton: 0,
	dashButton: 5,
	pauseButton: 9,
	backButton: 8,
	cardSelect1: 2,
	cardSelect2: 1,
	cardSelect3: 3,
	deadzone: 0.22
};

function cloneDefaults(): InputSettingsState {
	return {
		mode: 'keyboard',
		keyboard: { ...DEFAULT_KEYBOARD },
		gamepad: { ...DEFAULT_GAMEPAD }
	};
}

function clampDeadzone(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_GAMEPAD.deadzone;
	return Math.min(0.45, Math.max(0.08, n));
}

function clampButton(n: unknown, fallback: number): number {
	const v = typeof n === 'number' ? n : parseInt(String(n), 10);
	if (!Number.isFinite(v) || v < 0 || v > 31) return fallback;
	return Math.floor(v);
}

function load(): InputSettingsState {
	if (!browser) return cloneDefaults();
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return cloneDefaults();
		const j = JSON.parse(raw) as Partial<InputSettingsState>;
		const mode = j.mode === 'gamepad' ? 'gamepad' : 'keyboard';
		const kb = { ...DEFAULT_KEYBOARD, ...j.keyboard };
		const gp = {
			...DEFAULT_GAMEPAD,
			...j.gamepad,
			deadzone: clampDeadzone(j.gamepad?.deadzone ?? DEFAULT_GAMEPAD.deadzone),
			jumpButton: clampButton(j.gamepad?.jumpButton, DEFAULT_GAMEPAD.jumpButton),
			dashButton: clampButton(j.gamepad?.dashButton, DEFAULT_GAMEPAD.dashButton),
			pauseButton: clampButton(j.gamepad?.pauseButton, DEFAULT_GAMEPAD.pauseButton),
			backButton: clampButton(j.gamepad?.backButton, DEFAULT_GAMEPAD.backButton),
			cardSelect1: clampButton(j.gamepad?.cardSelect1, DEFAULT_GAMEPAD.cardSelect1),
			cardSelect2: clampButton(j.gamepad?.cardSelect2, DEFAULT_GAMEPAD.cardSelect2),
			cardSelect3: clampButton(j.gamepad?.cardSelect3, DEFAULT_GAMEPAD.cardSelect3)
		};
		if (typeof kb.dashExtra !== 'string') kb.dashExtra = DEFAULT_KEYBOARD.dashExtra;
		if (typeof kb.arrowAlternate !== 'boolean') kb.arrowAlternate = DEFAULT_KEYBOARD.arrowAlternate;
		return { mode, keyboard: kb, gamepad: gp };
	} catch {
		return cloneDefaults();
	}
}

function persist(s: InputSettingsState): void {
	if (!browser) return;
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(s));
	} catch {
		/* private mode */
	}
}

export const inputSettings = writable<InputSettingsState>(load());

if (browser) {
	inputSettings.subscribe((v) => persist(v));

	window.addEventListener('gamepaddisconnected', () => {
		inputSettings.update((s) => (s.mode === 'gamepad' ? { ...s, mode: 'keyboard' } : s));
	});
}
