<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EventBus } from '$lib/game/bridge/EventBus';

	let hp = $state(150);
	let maxHp = $state(150);
	let gauge = $state(0);
	let maxGauge = $state(100);
	let alive = $state(0);
	let wave = $state(1);
	let gameOver = $state(false);
	let bossAlert = $state(false);
	let bossCleared = $state(false);
	let finalWave = $state(1);

	let bossAlertTimer = 0;
	let bossClearedTimer = 0;

	const hpPct = $derived(maxHp > 0 ? (hp / maxHp) * 100 : 0);
	const gaugePct = $derived(maxGauge > 0 ? (gauge / maxGauge) * 100 : 0);
	const gaugeFull = $derived(gauge >= maxGauge);

	function onHpUpdate(...args: unknown[]): void {
		const d = args[0] as { hp: number; maxHp: number };
		hp = d.hp;
		maxHp = d.maxHp;
	}
	function onGaugeUpdate(...args: unknown[]): void {
		const d = args[0] as { gauge: number; maxGauge: number };
		gauge = d.gauge;
		maxGauge = d.maxGauge;
	}
	function onMonsterCount(...args: unknown[]): void {
		const d = args[0] as { remaining: number; total: number };
		alive = d.remaining;
	}
	function onWaveUpdate(...args: unknown[]): void {
		const d = args[0] as { wave: number };
		wave = d.wave;
	}
	function onBossIncoming(): void {
		bossAlert = true;
		bossCleared = false;
		clearTimeout(bossAlertTimer);
		bossAlertTimer = window.setTimeout(() => {
			bossAlert = false;
		}, 4000);
	}
	function onBossCleared(): void {
		bossAlert = false;
		bossCleared = true;
		clearTimeout(bossClearedTimer);
		bossClearedTimer = window.setTimeout(() => {
			bossCleared = false;
		}, 3500);
	}
	function onGameOver(): void {
		finalWave = wave;
		gameOver = true;
	}
	function restart(): void {
		gameOver = false;
		bossAlert = false;
		bossCleared = false;
		EventBus.emit('restart-game');
	}

	onMount(() => {
		EventBus.on('hp-update', onHpUpdate);
		EventBus.on('gauge-update', onGaugeUpdate);
		EventBus.on('monster-count-update', onMonsterCount);
		EventBus.on('wave-update', onWaveUpdate);
		EventBus.on('boss-incoming', onBossIncoming);
		EventBus.on('boss-cleared', onBossCleared);
		EventBus.on('game-over', onGameOver);
	});
	onDestroy(() => {
		EventBus.off('hp-update', onHpUpdate);
		EventBus.off('gauge-update', onGaugeUpdate);
		EventBus.off('monster-count-update', onMonsterCount);
		EventBus.off('wave-update', onWaveUpdate);
		EventBus.off('boss-incoming', onBossIncoming);
		EventBus.off('boss-cleared', onBossCleared);
		EventBus.off('game-over', onGameOver);
		clearTimeout(bossAlertTimer);
		clearTimeout(bossClearedTimer);
	});
</script>

<div class="hud">
	<div class="hud-top">
		<div class="bars">
			<div class="bar-row">
				<span class="label">HP</span>
				<div class="bar hp">
					<div class="fill" style="width:{hpPct}%"></div>
				</div>
				<span class="val">{Math.ceil(hp)}/{maxHp}</span>
			</div>
			<div class="bar-row">
				<span class="label" class:glow={gaugeFull}>변신</span>
				<div class="bar gauge" class:gauge-full={gaugeFull}>
					<div class="fill" style="width:{gaugePct}%"></div>
				</div>
				<span class="val">{Math.ceil(gauge)}/{maxGauge}</span>
			</div>
		</div>
		<div class="top-right">
			<div class="wave-badge">WAVE {wave}</div>
			<div class="enemies">적 {alive}</div>
		</div>
	</div>

	{#if bossAlert}
		<div class="boss-banner">
			<span class="boss-text">⚠ BOSS INCOMING ⚠</span>
		</div>
	{/if}

	{#if bossCleared}
		<div class="cleared-banner">
			<span class="cleared-text">BOSS DEFEATED — HP RESTORED!</span>
		</div>
	{/if}

	{#if gameOver}
		<div class="overlay">
			<div class="box over">
				<h2>GAME OVER</h2>
				<p>WAVE <strong>{finalWave}</strong> 까지 생존했습니다</p>
				<p class="sub">메카닉이 파괴되었습니다</p>
				<button onclick={restart}>재시작</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #eee;
		z-index: 10;
	}
	.hud-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 12px 16px;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.label {
		width: 32px;
		font-size: 0.75rem;
		font-weight: 700;
		text-shadow: 1px 1px 2px #000;
	}
	.label.glow {
		color: #ffdd44;
		text-shadow:
			0 0 6px #ffaa00,
			0 0 12px #ffaa00;
		animation: pulse 0.6s ease-in-out infinite alternate;
	}
	@keyframes pulse {
		to {
			opacity: 0.7;
		}
	}
	.bar {
		width: 180px;
		height: 14px;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		overflow: hidden;
	}
	.bar .fill {
		height: 100%;
		transition: width 0.15s ease-out;
		border-radius: 2px;
	}
	.hp .fill {
		background: linear-gradient(180deg, #ff5555, #cc2222);
	}
	.gauge .fill {
		background: linear-gradient(180deg, #55aaff, #2266cc);
	}
	.gauge-full .fill {
		background: linear-gradient(180deg, #ffdd44, #ffaa00);
		box-shadow: 0 0 6px #ffaa00;
	}
	.val {
		font-size: 0.7rem;
		min-width: 54px;
		text-shadow: 1px 1px 2px #000;
	}
	.top-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}
	.wave-badge {
		font-size: 1.1rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #66ccff;
		text-shadow:
			0 0 8px #44aaff,
			1px 1px 3px #000;
		background: rgba(0, 30, 60, 0.55);
		padding: 3px 14px;
		border-radius: 4px;
		border: 1px solid rgba(100, 180, 255, 0.3);
	}
	.enemies {
		font-size: 0.85rem;
		font-weight: 600;
		text-shadow: 1px 1px 3px #000;
		background: rgba(0, 0, 0, 0.4);
		padding: 4px 12px;
		border-radius: 4px;
	}

	/* Boss alert banner */
	.boss-banner {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		animation: bossFlash 0.5s ease-in-out infinite alternate;
	}
	.boss-text {
		font-size: 2.2rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: #ff4400;
		text-shadow:
			0 0 20px #ff2200,
			0 0 40px #ff0000,
			2px 2px 4px #000;
	}
	@keyframes bossFlash {
		from {
			opacity: 1;
		}
		to {
			opacity: 0.4;
		}
	}

	/* Boss cleared banner */
	.cleared-banner {
		position: absolute;
		top: 38%;
		left: 50%;
		transform: translateX(-50%);
		animation: slideFade 3.5s ease-out forwards;
	}
	.cleared-text {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #44ff88;
		text-shadow:
			0 0 16px #22dd66,
			2px 2px 4px #000;
		white-space: nowrap;
	}
	@keyframes slideFade {
		0% {
			opacity: 0;
			transform: translateX(-50%) translateY(20px);
		}
		15% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* Game over overlay */
	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		pointer-events: auto;
	}
	.box {
		text-align: center;
		padding: 2.5rem 3.5rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.box.over {
		background: rgba(60, 20, 20, 0.9);
	}
	.box h2 {
		margin: 0 0 0.5rem;
		font-size: 2.2rem;
		letter-spacing: 0.15em;
	}
	.over h2 {
		color: #ff5555;
		text-shadow: 0 0 20px rgba(255, 85, 85, 0.4);
	}
	.box p {
		margin: 0 0 0.4rem;
		color: #ccc;
		font-size: 1rem;
	}
	.box p strong {
		color: #66ccff;
		font-size: 1.3rem;
	}
	.box p.sub {
		color: #888;
		font-size: 0.85rem;
		margin-bottom: 1.5rem;
	}
	.box button {
		padding: 0.6rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border: 2px solid #6af;
		background: transparent;
		color: #6af;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.box button:hover {
		background: #6af;
		color: #111;
	}
</style>
