import * as THREE from 'three';
import { EventBus } from '../bridge/EventBus';

interface Entry {
	el: HTMLElement;
	pos: THREE.Vector3;
	life: number;
}

const LIFETIME_MS = 1100;
const RISE_SPEED = 2.8; // world units per second

export class DamageNumbers {
	private overlay: HTMLElement;
	private camera: THREE.PerspectiveCamera;
	private canvas: HTMLCanvasElement;
	private entries: Entry[] = [];

	private listener = (...args: unknown[]): void => {
		const d = args[0] as { pos: THREE.Vector3; amount: number; type: 'deal' | 'take' | 'heal' };
		this.spawn(d.pos, d.amount, d.type);
	};

	constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
		this.camera = camera;
		this.canvas = canvas;

		this.overlay = document.createElement('div');
		this.overlay.style.cssText =
			'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
		container.appendChild(this.overlay);

		EventBus.on('damage-number', this.listener);
	}

	private spawn(worldPos: THREE.Vector3, amount: number, type: 'deal' | 'take' | 'heal'): void {
		const el = document.createElement('span');
		const isHeal = type === 'heal';
		const isDeal = type === 'deal';

		el.textContent = isHeal ? `+${amount}` : `${amount}`;

		const color = isHeal ? '#44ff88' : isDeal ? '#ffe066' : '#ff4444';
		const glow = isHeal ? '#22aa55' : isDeal ? '#ffaa00' : '#ff0000';
		const size = isDeal ? '1rem' : '1.4rem';

		el.style.cssText = [
			'position:absolute',
			`font-family:'Segoe UI',system-ui,sans-serif`,
			`font-size:${size}`,
			'font-weight:900',
			`color:${color}`,
			`text-shadow:1px 1px 0 #000,-1px -1px 0 #000,0 0 8px ${glow}`,
			'pointer-events:none',
			'user-select:none',
			'transform:translate(-50%,-100%)',
			'white-space:nowrap'
		].join(';');

		this.overlay.appendChild(el);
		// Offset position so numbers start just above the hit point
		this.entries.push({
			el,
			pos: worldPos.clone().add(new THREE.Vector3(0, 1.0, 0)),
			life: 0
		});
	}

	update(dt: number): void {
		const cw = this.canvas.clientWidth || 1024;
		const ch = this.canvas.clientHeight || 576;

		for (let i = this.entries.length - 1; i >= 0; i--) {
			const e = this.entries[i];
			e.life += dt * 1000;
			e.pos.y += RISE_SPEED * dt;

			const t = e.life / LIFETIME_MS;
			const alpha = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
			const scale = Math.min(1.2, t * 12); // pop-in scale

			const ndc = e.pos.clone().project(this.camera);
			if (ndc.z <= 1) {
				const x = (ndc.x * 0.5 + 0.5) * cw;
				const y = (-ndc.y * 0.5 + 0.5) * ch;
				e.el.style.left = `${x}px`;
				e.el.style.top = `${y}px`;
				e.el.style.opacity = `${Math.max(0, alpha)}`;
				e.el.style.transform = `translate(-50%,-100%) scale(${scale})`;
			} else {
				e.el.style.opacity = '0';
			}

			if (e.life >= LIFETIME_MS) {
				e.el.remove();
				this.entries.splice(i, 1);
			}
		}
	}

	clear(): void {
		for (const e of this.entries) e.el.remove();
		this.entries = [];
	}

	destroy(): void {
		EventBus.off('damage-number', this.listener);
		this.clear();
		this.overlay.remove();
	}
}
