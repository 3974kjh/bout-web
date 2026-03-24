<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<main class="menu">
	<h1 class="title">BOUT</h1>
	<p class="subtitle">2D Mech Action Game</p>

	<div class="actions">
		<button class="btn-start" onclick={() => goto('/game')}>게임 시작</button>
	</div>

	<footer class="phase-info">Phase 1 — 싱글 전투 코어</footer>
</main>

<style>
	.menu {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: linear-gradient(180deg, #0a0a1e 0%, #14142e 100%);
		color: #eee;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}
	.title {
		font-size: 5rem;
		font-weight: 900;
		letter-spacing: 0.35em;
		margin: 0;
		color: #6af;
		text-shadow:
			0 0 40px rgba(100, 170, 255, 0.35),
			0 2px 0 #3366aa;
	}
	.subtitle {
		font-size: 1.15rem;
		color: #667;
		margin: 0.5rem 0 3rem;
		letter-spacing: 0.05em;
	}
	.actions {
		display: flex;
		gap: 1rem;
	}
	.btn-start {
		padding: 0.9rem 3rem;
		font-size: 1.25rem;
		font-weight: 700;
		border: 2px solid #6af;
		background: transparent;
		color: #6af;
		cursor: pointer;
		transition: all 0.2s;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		border-radius: 4px;
	}
	.btn-start:hover {
		background: #6af;
		color: #0a0a1e;
	}
	.phase-info {
		position: fixed;
		bottom: 1.5rem;
		color: #334;
		font-size: 0.8rem;
	}
</style>
