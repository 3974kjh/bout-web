/** 페이지별 대기 BGM — `static/bgms/pages/` (AAC `.m4a`, 짧은 루프 + 저용량) */

import { browser } from '$app/environment';
import { audioSettings, effectiveBgmVolume } from '$lib/stores/audioSettings';

export const BGM = {
	main: '/bgms/pages/main_bgm.m4a',
	sub: '/bgms/pages/sub_bgm.m4a',
	game: '/bgms/pages/game_bgm.m4a'
} as const;

const SESSION_UNLOCK_KEY = 'bout-bgm-unlocked';

let audio: HTMLAudioElement | null = null;
let currentSrc: string | null = null;
/** true면 실제로는 재생 중이나 muted로만 허용된 상태 — 사용자 제스처 후 해제 */
let bgmAwaitingAudibleUnmute = false;

function applyRouteBgmUserVolume(): void {
	if (!audio) return;
	audio.volume = effectiveBgmVolume();
}

if (browser) {
	audioSettings.subscribe(() => {
		applyRouteBgmUserVolume();
	});
}

export function bgmSrcForPathname(pathname: string): string | null {
	const p = pathname.replace(/\/$/, '') || '/';
	if (p === '/') return BGM.main;
	if (p.startsWith('/shop') || p.startsWith('/rank')) return BGM.sub;
	if (p.startsWith('/game')) return BGM.game;
	return null;
}

/** 이 탭에서 사용자가 한 번이라도 소리 재생을 허용한 것으로 표시 */
export function touchBgmUnlockedFromUserGesture(): void {
	try {
		sessionStorage.setItem(SESSION_UNLOCK_KEY, '1');
	} catch {
		/* 사생활 모드 등 */
	}
}

export function isBgmUnlockedThisSession(): boolean {
	try {
		return sessionStorage.getItem(SESSION_UNLOCK_KEY) === '1';
	} catch {
		return false;
	}
}

/**
 * 자동 재생 정책: 먼저 소리 켠 상태로 play → 거절되면 muted로 play(대부분의 브라우저가 허용).
 * 새로고침 후에도 “재생 상태”는 유지되고, 첫 클릭에서 `unmuteBgmIfDeferred`로 소리 복구.
 */
function playBgmWithAutoplayPolicy(a: HTMLAudioElement): void {
	const run = () => {
		applyRouteBgmUserVolume();
		a.muted = false;
		void a
			.play()
			.then(() => {
				touchBgmUnlockedFromUserGesture();
				bgmAwaitingAudibleUnmute = false;
			})
			.catch(() => {
				applyRouteBgmUserVolume();
				a.muted = true;
				void a
					.play()
					.then(() => {
						bgmAwaitingAudibleUnmute = true;
					})
					.catch(() => {
						bgmAwaitingAudibleUnmute = false;
					});
			});
	};
	if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) run();
	else a.addEventListener('canplay', () => run(), { once: true });
}

/**
 * 음소거 대기(muted 자동재생) 중이면 소리 켜기, 정지 중이면 재생 시도.
 * 반드시 사용자 제스처(클릭·키 등) 핸들러 안에서만 호출할 것.
 */
export function unmuteBgmIfDeferred(): void {
	if (typeof window === 'undefined' || !audio || !currentSrc) return;
	if (bgmAwaitingAudibleUnmute) {
		audio.muted = false;
		bgmAwaitingAudibleUnmute = false;
		applyRouteBgmUserVolume();
		touchBgmUnlockedFromUserGesture();
	}
	if (audio.paused) playBgmWithAutoplayPolicy(audio);
}

/**
 * 현재 경로에 맞는 트랙을 무한 반복(loop) 재생. 경로가 매핑되지 않으면 정지.
 */
export function syncRouteBgm(pathname: string): void {
	if (typeof window === 'undefined') return;
	const next = bgmSrcForPathname(pathname);
	if (next == null) {
		stopRouteBgm();
		return;
	}
	if (!audio) {
		audio = new Audio();
		audio.preload = 'auto';
	}
	audio.loop = true;
	if (currentSrc === next) {
		if (audio.paused) playBgmWithAutoplayPolicy(audio);
		return;
	}
	bgmAwaitingAudibleUnmute = false;
	currentSrc = next;
	audio.pause();
	audio.src = next;
	audio.muted = false;
	applyRouteBgmUserVolume();
	playBgmWithAutoplayPolicy(audio);
}

export function stopRouteBgm(): void {
	bgmAwaitingAudibleUnmute = false;
	if (!audio) return;
	audio.pause();
	audio.currentTime = 0;
	audio.muted = false;
	currentSrc = null;
}

/** 일시 정지만 복구(음소거 해제 없음) — pageshow·load 등 비제스처 경로용 */
export function tryResumeRouteBgm(): void {
	if (typeof window === 'undefined' || !audio || !currentSrc) return;
	if (audio.paused) playBgmWithAutoplayPolicy(audio);
}

/**
 * 새로고침·뒤로가기 복원·탭 전환 후 경로에 맞게 BGM을 다시 맞추고 재생 시도.
 */
export function bumpRouteBgmAfterNavigation(getPathname: () => string): void {
	if (typeof window === 'undefined') return;
	syncRouteBgm(getPathname());
	if (isBgmUnlockedThisSession()) tryResumeRouteBgm();
}

export function registerRouteBgmPageHooks(getPathname: () => string): () => void {
	const bump = () => bumpRouteBgmAfterNavigation(getPathname);

	window.addEventListener('pageshow', bump);
	const onLoad = () => bump();
	if (document.readyState === 'complete') queueMicrotask(onLoad);
	else window.addEventListener('load', onLoad);

	const onVis = () => {
		if (document.visibilityState === 'visible') bump();
	};
	document.addEventListener('visibilitychange', onVis);

	return () => {
		window.removeEventListener('pageshow', bump);
		window.removeEventListener('load', onLoad);
		document.removeEventListener('visibilitychange', onVis);
	};
}
