<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HudOverlay from '$lib/components/HUD/HudOverlay.svelte';
	import { EventBus } from '$lib/game/bridge/EventBus';
	import { warmupSfx } from '$lib/audio/sfx';

	let gameContainer: HTMLDivElement | undefined = $state();
	let engine: { destroy: () => void } | null = $state(null);

	onMount(async () => {
		const { primeShopSettingsForGame } = await import('$lib/game/shopGameCache');
		await Promise.all([primeShopSettingsForGame(), warmupSfx()]);
		const { GameEngine } = await import('$lib/game/core/GameEngine');
		engine = new GameEngine(gameContainer!);
	});

	onDestroy(() => {
		engine?.destroy();
		EventBus.removeAll();
	});

</script>

<div class="game-page">
	<div class="game-wrapper">
		<div bind:this={gameContainer} class="game-canvas"></div>
		<HudOverlay />
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
</style>
