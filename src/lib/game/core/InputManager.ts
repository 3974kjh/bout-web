import type { InputSettingsState } from '$lib/stores/inputSettings';
import { DEFAULT_GAMEPAD, DEFAULT_KEYBOARD } from '$lib/stores/inputSettings';

const GP_JUMP = '__GP_JUMP__';
const GP_DASH = '__GP_DASH__';
const GP_PAUSE = '__GP_PAUSE__';
const GP_BACK = '__GP_BACK__';
const GP_CARD1 = '__GP_CARD1__';
const GP_CARD2 = '__GP_CARD2__';
const GP_CARD3 = '__GP_CARD3__';

export class InputManager {
	private pressed = new Map<string, boolean>();
	private pendingDown = new Set<string>();
	private pendingUp = new Set<string>();
	private frameDown = new Set<string>();
	private frameUp = new Set<string>();

	private snapshot: InputSettingsState = {
		mode: 'keyboard',
		keyboard: { ...DEFAULT_KEYBOARD },
		gamepad: { ...DEFAULT_GAMEPAD }
	};

	private gpPrevButtons = new Map<number, boolean[]>();
	private gpMoveX = 0;
	private gpMoveZ = 0;

	private handleDown = (e: KeyboardEvent): void => {
		if (this.shouldPreventDefault(e.code)) e.preventDefault();
		if (!this.pressed.get(e.code)) this.pendingDown.add(e.code);
		this.pressed.set(e.code, true);
	};

	private handleUp = (e: KeyboardEvent): void => {
		this.pressed.set(e.code, false);
		this.pendingUp.add(e.code);
	};

	constructor() {
		window.addEventListener('keydown', this.handleDown);
		window.addEventListener('keyup', this.handleUp);
	}

	private shouldPreventDefault(code: string): boolean {
		const k = this.snapshot.keyboard;
		const codes = new Set<string>([
			k.moveUp,
			k.moveDown,
			k.moveLeft,
			k.moveRight,
			k.dash,
			k.jumpPrimary,
			k.jumpSecondary
		]);
		if (k.dashExtra) codes.add(k.dashExtra);
		if (k.arrowAlternate) {
			codes.add('ArrowUp');
			codes.add('ArrowDown');
			codes.add('ArrowLeft');
			codes.add('ArrowRight');
		}
		return codes.has(code);
	}

	update(snapshot: InputSettingsState): void {
		this.snapshot = snapshot;

		this.frameDown = new Set(this.pendingDown);
		this.frameUp = new Set(this.pendingUp);
		this.pendingDown.clear();
		this.pendingUp.clear();

		const gp = this.getFirstGamepad();
		const useGp = snapshot.mode === 'gamepad' && gp != null;

		this.gpMoveX = 0;
		this.gpMoveZ = 0;

		if (useGp && gp) {
			this.mergeGamepad(gp, snapshot);
		}
	}

	private getFirstGamepad(): Gamepad | null {
		const list = navigator.getGamepads?.() ?? [];
		for (const g of list) {
			if (g?.connected) return g;
		}
		return null;
	}

	private mergeGamepad(gp: Gamepad, snapshot: InputSettingsState): void {
		const {
			jumpButton,
			dashButton,
			pauseButton,
			backButton,
			cardSelect1,
			cardSelect2,
			cardSelect3,
			deadzone
		} = snapshot.gamepad;
		const buttons = gp.buttons.map((b) => b.pressed);
		const prev = this.gpPrevButtons.get(gp.index) ?? buttons.map(() => false);

		if (buttons[jumpButton] && !prev[jumpButton]) this.frameDown.add(GP_JUMP);
		if (buttons[dashButton] && !prev[dashButton]) this.frameDown.add(GP_DASH);
		if (buttons[pauseButton] && !prev[pauseButton]) this.frameDown.add(GP_PAUSE);
		if (buttons[backButton] && !prev[backButton]) this.frameDown.add(GP_BACK);
		if (buttons[cardSelect1] && !prev[cardSelect1]) this.frameDown.add(GP_CARD1);
		if (buttons[cardSelect2] && !prev[cardSelect2]) this.frameDown.add(GP_CARD2);
		if (buttons[cardSelect3] && !prev[cardSelect3]) this.frameDown.add(GP_CARD3);

		this.gpPrevButtons.set(gp.index, [...buttons]);

		const dz = deadzone;
		let x = 0;
		let z = 0;

		const ax = gp.axes[0] ?? 0;
		const ay = gp.axes[1] ?? 0;
		if (Math.abs(ax) > dz) x += ax < 0 ? -1 : 1;
		if (Math.abs(ay) > dz) z += ay < 0 ? -1 : 1;

		if (gp.buttons[12]?.pressed) z -= 1;
		if (gp.buttons[13]?.pressed) z += 1;
		if (gp.buttons[14]?.pressed) x -= 1;
		if (gp.buttons[15]?.pressed) x += 1;

		this.gpMoveX = Math.max(-1, Math.min(1, x));
		this.gpMoveZ = Math.max(-1, Math.min(1, z));
	}

	private isDownCode(code: string): boolean {
		return this.pressed.get(code) === true;
	}

	private justDownCode(code: string): boolean {
		return this.frameDown.has(code);
	}

	getMoveXZ(): { x: number; z: number } {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;

		if (useGp) {
			return { x: this.gpMoveX, z: this.gpMoveZ };
		}

		const k = snap.keyboard;
		let dx = 0;
		let dz = 0;
		if (this.isDownCode(k.moveUp) || (k.arrowAlternate && this.isDownCode('ArrowUp'))) dz -= 1;
		if (this.isDownCode(k.moveDown) || (k.arrowAlternate && this.isDownCode('ArrowDown'))) dz += 1;
		if (this.isDownCode(k.moveLeft) || (k.arrowAlternate && this.isDownCode('ArrowLeft'))) dx -= 1;
		if (this.isDownCode(k.moveRight) || (k.arrowAlternate && this.isDownCode('ArrowRight')))
			dx += 1;
		return { x: dx, z: dz };
	}

	dashJustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_DASH);

		const k = snap.keyboard;
		if (this.justDownCode(k.dash)) return true;
		if (k.dashExtra && this.justDownCode(k.dashExtra)) return true;
		return false;
	}

	jumpJustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_JUMP);

		const k = snap.keyboard;
		return this.justDownCode(k.jumpPrimary) || this.justDownCode(k.jumpSecondary);
	}

	pauseJustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_PAUSE);
		return false;
	}

	backJustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_BACK);
		return false;
	}

	cardSelect1JustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_CARD1);
		return false;
	}

	cardSelect2JustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_CARD2);
		return false;
	}

	cardSelect3JustDown(): boolean {
		const snap = this.snapshot;
		const gp = this.getFirstGamepad();
		const useGp = snap.mode === 'gamepad' && gp != null;
		if (useGp) return this.frameDown.has(GP_CARD3);
		return false;
	}

	destroy(): void {
		window.removeEventListener('keydown', this.handleDown);
		window.removeEventListener('keyup', this.handleUp);
		this.gpPrevButtons.clear();
	}
}
