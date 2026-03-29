<script lang="ts">
	import { goto } from '$app/navigation';
	import { locale, translate as tr } from '$lib/i18n';
</script>

<button
	type="button"
	class="back-home"
	onclick={() => goto('/')}
	aria-label={tr($locale, 'common.backHomeAria')}
	title={tr($locale, 'common.backHomeTitle')}
>
	<svg class="back-home-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M15 18l-6-6 6-6"
		/>
	</svg>
</button>

<style>
	.back-home {
		position: fixed;
		top: clamp(0.65rem, 2.2vw, 1rem);
		left: clamp(0.65rem, 2.2vw, 1rem);
		z-index: 100;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		margin: 0;
		padding: 0;
		border: 1px solid rgba(0, 200, 255, 0.38);
		border-radius: 10px;
		background: rgba(0, 18, 36, 0.82);
		color: rgba(140, 220, 255, 0.95);
		cursor: pointer;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35) inset,
			0 4px 14px rgba(0, 0, 0, 0.35);
		transition:
			border-color 0.15s ease,
			color 0.15s ease,
			background 0.15s ease,
			transform 0.12s ease;
	}
	.back-home:hover {
		border-color: rgba(0, 240, 255, 0.55);
		color: #e8ffff;
		background: rgba(0, 40, 72, 0.92);
		transform: translateY(-1px);
	}
	.back-home:focus-visible {
		outline: 2px solid rgba(0, 220, 255, 0.65);
		outline-offset: 2px;
	}
	.back-home-icon {
		width: 1.35rem;
		height: 1.35rem;
		display: block;
	}
	@media (prefers-reduced-motion: reduce) {
		.back-home:hover {
			transform: none;
		}
	}
</style>
