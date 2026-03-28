import * as THREE from 'three';

/** 가로로 이어 붙인 스프라이트 프레임 수 */
export const PLAYER_MISSILE_FRAME_COUNT = 4;

const FRAME_W = 40;
const FRAME_H = 28;

let cached: THREE.CanvasTexture | null = null;

/**
 * 아케이드풍 네온 볼트 — 한 줄에 FRAME개 프레임(추진 불꽃 변화).
 * 런타임 캔버스로 생성해 별도 PNG 없이 선명한 픽셀 룩.
 */
export function getPlayerMissileSheetTexture(): THREE.CanvasTexture | null {
	if (typeof document === 'undefined') return null;
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = FRAME_W * PLAYER_MISSILE_FRAME_COUNT;
	canvas.height = FRAME_H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.imageSmoothingEnabled = false;

	for (let f = 0; f < PLAYER_MISSILE_FRAME_COUNT; f++) {
		const ox = f * FRAME_W;
		const cx = ox + FRAME_W * 0.62;
		const cy = FRAME_H * 0.5;
		const flick = f * 0.85;
		const tail = 14 + Math.sin(f * 1.7) * 5 + flick * 0.4;
		const head = 6 + (f % 2) * 1.5;

		ctx.save();
		ctx.translate(cx, cy);

		// 외곽 글로우 (네온)
		const glow = ctx.createRadialGradient(-6, 0, 0, -6, 0, 22 + tail * 0.15);
		glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
		glow.addColorStop(0.25, 'rgba(120, 255, 255, 0.55)');
		glow.addColorStop(0.55, 'rgba(80, 140, 255, 0.25)');
		glow.addColorStop(1, 'rgba(40, 60, 200, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.ellipse(-4, 0, 10 + head, 7, 0, 0, Math.PI * 2);
		ctx.fill();

		// 꼬리 불꽃 (삼각 스트립)
		ctx.globalCompositeOperation = 'lighter';
		ctx.fillStyle = `rgba(180, 240, 255, ${0.45 + f * 0.1})`;
		ctx.beginPath();
		ctx.moveTo(-10 - tail, -4 - f * 0.4);
		ctx.lineTo(-10 - tail * 1.35, 0);
		ctx.lineTo(-10 - tail, 4 + f * 0.4);
		ctx.closePath();
		ctx.fill();

		// 코어 볼트
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(-10, -2.5, 14 + head * 0.5, 5);
		ctx.fillStyle = 'rgba(200, 255, 255, 0.9)';
		ctx.fillRect(-8, -1.5, 10, 3);

		// 테두리 하이라이트 (아케이드 윤곽)
		ctx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
		ctx.lineWidth = 1.2;
		ctx.strokeRect(-11, -3.2, 16 + head * 0.5, 6.4);

		// 스파크
		ctx.fillStyle = '#ffffff';
		const sparkX = 4 + (f % 3) * 2;
		ctx.fillRect(sparkX, -1, 2, 2);
		ctx.fillRect(sparkX - 3, 2, 1.5, 1.5);

		ctx.restore();
	}

	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.needsUpdate = true;
	cached = tex;
	return cached;
}

/** 프레임 인덱스에 맞춰 UV 오프셋 (repeat 는 1/FRAME_COUNT, 1 로 설정된 맵 기준) */
export function setMissileSpriteFrame(map: THREE.Texture, frameIndex: number): void {
	const n = PLAYER_MISSILE_FRAME_COUNT;
	const f = ((frameIndex % n) + n) % n;
	map.offset.x = f / n;
}
