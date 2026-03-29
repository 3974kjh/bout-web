<script lang="ts">
	import { locale, setLocale, translate, type Locale } from '$lib/i18n';

	function pick(next: Locale): void {
		setLocale(next);
	}
</script>

<div
	class="lang-switch"
	role="group"
	aria-label={translate($locale, 'common.language')}
>
	<button
		type="button"
		class="lang-switch__btn"
		class:lang-switch__btn--active={$locale === 'ko'}
		aria-pressed={$locale === 'ko'}
		onclick={() => pick('ko')}
	>
		{translate($locale, 'lang.ko')}
	</button>
	<span class="lang-switch__sep" aria-hidden="true">|</span>
	<button
		type="button"
		class="lang-switch__btn"
		class:lang-switch__btn--active={$locale === 'en'}
		aria-pressed={$locale === 'en'}
		onclick={() => pick('en')}
	>
		{translate($locale, 'lang.en')}
	</button>
</div>

<style>
	.lang-switch {
		position: fixed;
		top: clamp(0.65rem, 2.2vw, 1rem);
		right: clamp(0.65rem, 2.2vw, 1rem);
		z-index: 120;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.28rem 0.45rem;
		border-radius: 10px;
		border: 1px solid rgba(0, 200, 255, 0.32);
		background: rgba(0, 18, 36, 0.82);
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35) inset,
			0 4px 14px rgba(0, 0, 0, 0.3);
		font-family: 'Segoe UI', system-ui, sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		pointer-events: auto;
	}
	.lang-switch__sep {
		color: rgba(120, 170, 200, 0.45);
		user-select: none;
	}
	.lang-switch__btn {
		margin: 0;
		padding: 0.2rem 0.4rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: rgba(160, 210, 240, 0.75);
		cursor: pointer;
		font: inherit;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.lang-switch__btn:hover {
		color: #e8ffff;
		background: rgba(0, 80, 120, 0.35);
	}
	.lang-switch__btn--active {
		color: #00eeff;
		background: rgba(0, 60, 90, 0.55);
	}
	.lang-switch__btn:focus-visible {
		outline: 2px solid rgba(0, 220, 255, 0.65);
		outline-offset: 2px;
	}
</style>
