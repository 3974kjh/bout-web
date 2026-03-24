<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import HudOverlay from '$lib/components/HUD/HudOverlay.svelte';
	import { EventBus } from '$lib/game/bridge/EventBus';

	let gameContainer: HTMLDivElement | undefined = $state();
	let engine: { destroy: () => void } | null = $state(null);

	onMount(async () => {
		const { GameEngine } = await import('$lib/game/core/GameEngine');
		engine = new GameEngine(gameContainer!);
	});

	onDestroy(() => {
		engine?.destroy();
		EventBus.removeAll();
	});

	function back(): void {
		goto('/');
	}
</script>

<div class="game-page">
	<div class="game-wrapper">
		<div bind:this={gameContainer} class="game-canvas"></div>
		<HudOverlay />
	</div>

	<div class="controls">
		<span>WASD/←→↑↓ 이동</span>
		<span>C/Space 점프</span>
		<span>V 공격</span>
		<span>X 가드</span>
		<span>Z 변신</span>
		<button class="back-btn" onclick={back}>← 메뉴</button>
	</div>
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #060612;
		padding: 1rem;
	}
	.game-wrapper {
		position: relative;
		width: 1024px;
		max-width: 100%;
		aspect-ratio: 16 / 9;
		border: 1px solid rgba(100, 170, 255, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}
	.game-canvas {
		width: 100%;
		height: 100%;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.75rem;
		color: #778;
		font-size: 0.8rem;
		font-family: 'Segoe UI', system-ui, sans-serif;
		align-items: center;
	}
	.back-btn {
		margin-left: auto;
		padding: 0.3rem 0.8rem;
		font-size: 0.8rem;
		border: 1px solid #445;
		background: transparent;
		color: #778;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.back-btn:hover {
		border-color: #6af;
		color: #6af;
	}
</style>
