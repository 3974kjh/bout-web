import { writable, type Writable } from 'svelte/store';

/** 0단계 기준선 — URL `?perf=1` 또는 수동으로 true */
export const perfOverlayEnabled: Writable<boolean> = writable(false);

export type GamePerfSnapshot = {
	/** 지난 샘플 구간 평균 FPS */
	fps: number;
	/** ms/프레임 (같은 구간 평균) */
	msFrame: number;
	drawCalls: number;
	triangles: number;
	points: number;
	lines: number;
	aliveMonsters: number;
	enemyProjectiles: number;
	playerProjectiles: number;
	/** Chrome 전용 — performance.memory (bytes) */
	jsHeapUsedMb: number | null;
	jsHeapTotalMb: number | null;
};

const emptySnapshot: GamePerfSnapshot = {
	fps: 0,
	msFrame: 0,
	drawCalls: 0,
	triangles: 0,
	points: 0,
	lines: 0,
	aliveMonsters: 0,
	enemyProjectiles: 0,
	playerProjectiles: 0,
	jsHeapUsedMb: null,
	jsHeapTotalMb: null
};

export const perfSnapshot: Writable<GamePerfSnapshot> = writable({ ...emptySnapshot });

export function resetPerfSnapshot(): void {
	perfSnapshot.set({ ...emptySnapshot });
}

/** 브라우저에서 `?perf=1` 이면 오버레이 켜기 */
export function readPerfFromUrl(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return new URLSearchParams(window.location.search).get('perf') === '1';
	} catch {
		return false;
	}
}
