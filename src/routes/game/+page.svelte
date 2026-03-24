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
		<div class="controls-overlay">
			<span>WASD 이동</span>
			<span>C/Space 점프</span>
			<span>V 공격</span>
			<span>X 가드</span>
			<span>Z 변신</span>
			<button class="back-btn" onclick={back}>← 메뉴</button>
		</div>
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
	.controls-overlay {
		position: absolute;
		bottom: 10px;
		left: 14px;
		right: 14px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		pointer-events: none;
		color: rgba(170, 180, 200, 0.65);
		font-size: 0.72rem;
		font-family: 'Segoe UI', system-ui, sans-serif;
		text-shadow: 1px 1px 3px #000;
	}
	.back-btn {
		pointer-events: auto;
		margin-left: auto;
		padding: 0.25rem 0.7rem;
		font-size: 0.72rem;
		border: 1px solid rgba(100, 130, 170, 0.4);
		background: rgba(0, 0, 0, 0.5);
		color: rgba(170, 180, 200, 0.75);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.back-btn:hover {
		border-color: #6af;
		color: #6af;
	}
</style>
