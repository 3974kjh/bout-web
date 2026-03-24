const GAME_KEYS = [
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'KeyW',
	'KeyA',
	'KeyS',
	'KeyD',
	'KeyZ',
	'KeyX',
	'KeyC',
	'KeyV',
	'Space'
];

export class InputManager {
	private pressed = new Map<string, boolean>();
	private pendingDown = new Set<string>();
	private pendingUp = new Set<string>();
	private frameDown = new Set<string>();
	private frameUp = new Set<string>();

	private handleDown = (e: KeyboardEvent): void => {
		if (GAME_KEYS.includes(e.code)) e.preventDefault();
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

	update(): void {
		this.frameDown = new Set(this.pendingDown);
		this.frameUp = new Set(this.pendingUp);
		this.pendingDown.clear();
		this.pendingUp.clear();
	}

	isDown(code: string): boolean {
		return this.pressed.get(code) === true;
	}

	justDown(code: string): boolean {
		return this.frameDown.has(code);
	}

	justUp(code: string): boolean {
		return this.frameUp.has(code);
	}

	destroy(): void {
		window.removeEventListener('keydown', this.handleDown);
		window.removeEventListener('keyup', this.handleUp);
	}
}
