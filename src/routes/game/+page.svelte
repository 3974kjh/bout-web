<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import HudOverlay from '$lib/components/HUD/HudOverlay.svelte';
	import { EventBus } from '$lib/game/bridge/EventBus';
	import { warmupSfx } from '$lib/audio/sfx';
	import { locale, translate as tr } from '$lib/i18n';

	let gameContainer: HTMLDivElement | undefined = $state();
	let engine: { destroy: () => void } | null = $state(null);
	/** 설정 로드·엔진 생성·첫 WebGL 프레임까지 */
	let bootLoading = $state(true);
	let bootFailSafeTimer: ReturnType<typeof setTimeout> | undefined;

	function clearBootFailSafe(): void {
		if (bootFailSafeTimer !== undefined) {
			clearTimeout(bootFailSafeTimer);
			bootFailSafeTimer = undefined;
		}
	}

	onMount(async () => {
		await tick();
		if (!gameContainer) {
			bootLoading = false;
			return;
		}
		bootLoading = true;
		try {
			const { primeShopSettingsForGame } = await import('$lib/game/shopGameCache');
			await primeShopSettingsForGame();
			/** 게임 시작을 SFX fetch/디코드에 막지 않음 (새로고침 후 hang 시 스피너 무한 방지) */
			void warmupSfx();

			const { GameEngine } = await import('$lib/game/core/GameEngine');
			if (!gameContainer) {
				bootLoading = false;
				return;
			}

			clearBootFailSafe();
			bootFailSafeTimer = setTimeout(() => {
				bootFailSafeTimer = undefined;
				bootLoading = false;
			}, 25_000);

			engine = new GameEngine(gameContainer, {
				onFirstFrameRendered: () => {
					clearBootFailSafe();
					bootLoading = false;
				}
			});
		} catch {
			clearBootFailSafe();
			bootLoading = false;
		}
	});

	onDestroy(() => {
		clearBootFailSafe();
		engine?.destroy();
		EventBus.removeAll();
	});

</script>

<div class="game-page">
	<div class="game-wrapper">
		<div bind:this={gameContainer} class="game-canvas"></div>
		<HudOverlay />
		{#if bootLoading}
			<div
				class="game-boot-overlay"
				role="status"
				aria-live="polite"
				aria-busy="true"
				aria-label={tr($locale, 'game.bootAria')}
			>
				<div class="progress-circle-wrap" aria-hidden="true">
					<svg class="progress-circle" viewBox="0 0 44 44" width="48" height="48">
						<circle class="progress-circle__track" cx="22" cy="22" r="18" />
						<circle class="progress-circle__arc" cx="22" cy="22" r="18" />
					</svg>
				</div>
				<p class="game-boot-overlay__text">{tr($locale, 'game.bootLoading')}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}
	.game-page {
		position: fixed;
		inset: 0;
		background: #060612;
	}
	.game-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
	}
	.game-canvas {
		width: 100%;
		height: 100%;
	}
	.game-boot-overlay {
		position: absolute;
		inset: 0;
		z-index: 120;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background: radial-gradient(ellipse 80% 70% at 50% 45%, #0c1228 0%, #060612 72%);
		pointer-events: auto;
	}
	.progress-circle-wrap {
		animation: game-boot-spin 0.85s linear infinite;
		color: rgba(0, 220, 255, 0.88);
		filter: drop-shadow(0 0 12px rgba(0, 200, 255, 0.35));
	}
	.progress-circle {
		display: block;
	}
	.progress-circle__track {
		fill: none;
		stroke: rgba(255, 255, 255, 0.08);
		stroke-width: 3.2;
	}
	.progress-circle__arc {
		fill: none;
		stroke: currentColor;
		stroke-width: 3.2;
		stroke-linecap: round;
		stroke-dasharray: 30 83;
	}
	@keyframes game-boot-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.game-boot-overlay__text {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: rgba(180, 210, 240, 0.92);
		text-align: center;
		max-width: 16rem;
		line-height: 1.45;
	}
</style>
