<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import {
		bumpRouteBgmAfterNavigation,
		registerRouteBgmPageHooks,
		syncRouteBgm,
		touchBgmUnlockedFromUserGesture,
		unmuteBgmIfDeferred
	} from '$lib/audio/routeBgm';
	import { playUiButton } from '$lib/audio/sfx';

	let { children } = $props();

	$effect(() => {
		syncRouteBgm(page.url.pathname);
	});

	onMount(() => {
		const unregBgmHooks = registerRouteBgmPageHooks(() => page.url.pathname);
		queueMicrotask(() => bumpRouteBgmAfterNavigation(() => page.url.pathname));

		const onUserInteractAudio = () => {
			unmuteBgmIfDeferred();
			touchBgmUnlockedFromUserGesture();
		};

		const onPointerDown = (e: PointerEvent) => {
			onUserInteractAudio();
			const raw = e.target;
			if (!(raw instanceof Element)) return;
			const el = raw.closest(
				'button, [role="button"], a[href], input[type="button"], input[type="submit"], input[type="reset"]'
			);
			if (!el || el.hasAttribute('data-sfx-skip')) return;
			if (el instanceof HTMLAnchorElement) {
				const h = el.getAttribute('href');
				if (h == null || h === '' || h.startsWith('#')) return;
			}
			playUiButton();
		};
		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('keydown', onUserInteractAudio, true);
		return () => {
			unregBgmHooks();
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('keydown', onUserInteractAudio, true);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
	}
	:global(*) {
		box-sizing: border-box;
	}

	/* 정비소 사이드 패널·카드 풀과 동일한 스크롤바 — shop / rank 등에서 class="bout-scrollbar" */
	:global(.bout-scrollbar) {
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
	}
	:global(.bout-scrollbar::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-thumb) {
		background: rgba(0, 180, 255, 0.35);
		border-radius: 999px;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-thumb:hover) {
		background: rgba(0, 200, 255, 0.48);
	}
</style>
