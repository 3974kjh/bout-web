<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import AudioSettingsModal from '$lib/components/AudioSettingsModal.svelte';
	import { locale, translate as tr } from '$lib/i18n';

	let audioSettingsOpen = $state(false);

	onMount(() => {
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overflow;
		const prevBody = body.style.overflow;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		return () => {
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		};
	});
</script>

<main class="landing">
	<div class="bg-quad-wrap" aria-hidden="true">
		<div class="bg-quad bg-quad--tl"></div>
		<div class="bg-quad bg-quad--tr"></div>
		<div class="bg-quad bg-quad--bl"></div>
		<div class="bg-quad bg-quad--br"></div>
	</div>
	<div class="bg-vignette" aria-hidden="true"></div>
	<div class="bg-glow" aria-hidden="true"></div>
	<div class="bg-threat" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--tl" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--tr" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--bl" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--br" aria-hidden="true"></div>

	<section class="hero">
		<div class="hero-inner">
			<div class="survival-strip" aria-hidden="true">
				<span class="survival-strip__dot"></span>
				<span class="survival-strip__text">{tr($locale, 'home.strip')}</span>
				<span class="survival-strip__pulse"></span>
			</div>
			<p class="eyebrow">{tr($locale, 'home.eyebrow')}</p>
			<h1 class="title">BOUT</h1>
			<p class="tagline">{tr($locale, 'home.tagline')}</p>
			<p class="tagline-sub">{tr($locale, 'home.taglineSub')}</p>

			<ul class="pills" aria-label={tr($locale, 'home.featuresAria')}>
				<li>{tr($locale, 'home.featAutoFire')}</li>
				<li>{tr($locale, 'home.featCards')}</li>
				<li>{tr($locale, 'home.featBoss')}</li>
				<li>{tr($locale, 'home.featMinimap')}</li>
			</ul>

			<div class="action-stack">
				<button type="button" class="cta" onclick={() => goto('/game')}>
					<span class="cta-label">{tr($locale, 'home.ctaLabel')}</span>
					<span class="cta-sub">{tr($locale, 'home.ctaSub')}</span>
				</button>
				<button type="button" class="btn-shop" onclick={() => goto('/shop')}>
					<span class="btn-shop-row">
						<svg class="btn-shop-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linejoin="round"
								d="M4 8.5h16v9H4v-9zm2 0V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5M9 21v-3.5h6V21"
							/>
							<path
								fill="currentColor"
								d="M8 12h2v2H8v-2zm6 0h2v2h-2v-2z"
								opacity="0.85"
							/>
						</svg>
						<span class="btn-shop-label">{tr($locale, 'home.shopLabel')}</span>
					</span>
					<span class="btn-shop-hint">{tr($locale, 'home.shopHint')}</span>
				</button>
				<button type="button" class="btn-rank" onclick={() => goto('/rank')}>
					<span class="btn-rank-row">
						<svg class="btn-rank-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								fill="currentColor"
								d="M5 3h2v2h10V3h2v4.2c0 1.68-1.02 3.12-2.47 3.73L17 19H7l-.53-8.07A4.2 4.2 0 0 1 5 7.2V3zm2.2 4.2c0 .55.45 1 1 1h7.6c.55 0 1-.45 1-1V5H7.2v2.2zM8.5 21h7v2h-7v-2z"
							/>
						</svg>
						<span class="btn-rank-label">{tr($locale, 'home.rankLabel')}</span>
					</span>
					<span class="btn-rank-hint">{tr($locale, 'home.rankHint')}</span>
				</button>
			</div>
		</div>

		<div class="hud-hint" aria-hidden="true">
			<div class="fake-bar">
				<span class="fake-dash"></span>
				<span class="fake-lv">Lv</span>
				<span class="fake-hp"></span>
			</div>
			<div class="fake-radar">
				<span class="fake-radar__sweep"></span>
				<span class="fake-radar__blip"></span>
				<span class="fake-radar__blip fake-radar__blip--2"></span>
			</div>
			<p class="hint-caption">{tr($locale, 'home.hintCaption')}</p>
		</div>
	</section>

	<section class="controls" aria-label={tr($locale, 'home.controlsAria')}>
		<h2 class="controls-title">{tr($locale, 'home.controlsTitle')}</h2>
		<dl class="control-grid">
			<div><dt>{tr($locale, 'home.move')}</dt><dd>W A S D</dd></div>
			<div><dt>{tr($locale, 'home.jump')}</dt><dd>Space · C</dd></div>
			<div><dt>{tr($locale, 'home.dash')}</dt><dd>Shift</dd></div>
			<div><dt>{tr($locale, 'home.pause')}</dt><dd>Esc</dd></div>
		</dl>
	</section>

	<footer class="foot">
		<button type="button" class="foot-audio-open" onclick={() => (audioSettingsOpen = true)}>
			<span class="foot-audio-open__icn" aria-hidden="true">
				<svg viewBox="0 0 20 20" width="14" height="14" fill="none">
					<line
						x1="5"
						y1="3"
						x2="5"
						y2="17"
						stroke="currentColor"
						stroke-width="1.35"
						stroke-linecap="round"
						opacity="0.4"
					/>
					<rect x="3.2" y="9" width="3.6" height="5" rx="1" fill="currentColor" />
					<line
						x1="10"
						y1="3"
						x2="10"
						y2="17"
						stroke="currentColor"
						stroke-width="1.35"
						stroke-linecap="round"
						opacity="0.4"
					/>
					<rect x="8.2" y="5" width="3.6" height="5" rx="1" fill="currentColor" />
					<line
						x1="15"
						y1="3"
						x2="15"
						y2="17"
						stroke="currentColor"
						stroke-width="1.35"
						stroke-linecap="round"
						opacity="0.4"
					/>
					<rect x="13.2" y="11" width="3.6" height="5" rx="1" fill="currentColor" />
				</svg>
			</span>
			{tr($locale, 'home.audioOpen')}
		</button>
	</footer>

	<AudioSettingsModal bind:open={audioSettingsOpen} layer="landing" />
</main>

<style>
	.landing {
		position: relative;
		box-sizing: border-box;
		width: 100%;
		height: 100dvh;
		max-height: 100dvh;
		min-height: 0;
		overflow: hidden;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: clamp(0.5rem, 2.5vmin, 1.75rem);
		gap: clamp(0.35rem, 1.8vh, 1rem);
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #e8f4ff;
		background: #04060e;
	}

	/* background_3.png 한 장을 2×2로 나눠 화면 사분면에 각각 매핑 */
	.bg-quad-wrap {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.bg-quad {
		position: absolute;
		width: 50%;
		height: 50%;
		background-image: url('/images/background/background_3.png');
		background-repeat: no-repeat;
		background-size: 100% 100%;
	}

	.bg-quad--tl {
		top: 0;
		left: 0;
		background-position: 0% 0%;
	}
	.bg-quad--tr {
		top: 0;
		right: 0;
		background-position: 100% 0%;
	}
	.bg-quad--bl {
		bottom: 0;
		left: 0;
		background-position: 0% 100%;
	}
	.bg-quad--br {
		bottom: 0;
		right: 0;
		background-position: 100% 100%;
	}

	.bg-vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse 85% 70% at 50% 45%, transparent 35%, rgba(0, 0, 0, 0.55) 100%),
			radial-gradient(ellipse 100% 50% at 50% 100%, rgba(80, 20, 0, 0.22), transparent 45%);
		z-index: 0;
	}

	.bg-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 32%, rgba(0, 180, 255, 0.18), transparent 52%);
		pointer-events: none;
		z-index: 0;
		opacity: 0.88;
	}

	.bg-threat {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		opacity: 0.7;
		background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255, 60, 20, 0.1), transparent 62%);
	}

	.frame-corners {
		position: absolute;
		width: min(72px, 18vw);
		height: min(72px, 18vw);
		pointer-events: none;
		z-index: 2;
		border: 2px solid rgba(0, 220, 255, 0.35);
		opacity: 0.75;
		box-shadow: 0 0 18px rgba(0, 180, 255, 0.15);
	}
	.frame-corners--tl {
		top: clamp(0.75rem, 3vw, 1.5rem);
		left: clamp(0.75rem, 3vw, 1.5rem);
		border-right: none;
		border-bottom: none;
		border-radius: 4px 0 0 0;
	}
	.frame-corners--tr {
		top: clamp(0.75rem, 3vw, 1.5rem);
		right: clamp(0.75rem, 3vw, 1.5rem);
		border-left: none;
		border-bottom: none;
		border-radius: 0 4px 0 0;
	}
	.frame-corners--bl {
		bottom: clamp(0.75rem, 3vw, 1.5rem);
		left: clamp(0.75rem, 3vw, 1.5rem);
		border-right: none;
		border-top: none;
		border-radius: 0 0 0 4px;
	}
	.frame-corners--br {
		bottom: clamp(0.75rem, 3vw, 1.5rem);
		right: clamp(0.75rem, 3vw, 1.5rem);
		border-left: none;
		border-top: none;
		border-radius: 0 0 4px 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.survival-strip__pulse,
		.survival-strip__dot,
		.fake-radar__sweep,
		.fake-radar__blip--2 {
			animation: none;
		}
		.cta::before {
			animation: none;
		}
	}

	.survival-strip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: clamp(0.35rem, 1.2vh, 0.75rem);
		padding: 0.35rem 0.85rem;
		border-radius: 2px;
		border: 1px solid rgba(255, 80, 40, 0.45);
		background: linear-gradient(90deg, rgba(40, 8, 0, 0.75), rgba(20, 30, 50, 0.85), rgba(40, 8, 0, 0.75));
		box-shadow:
			0 0 20px rgba(255, 60, 0, 0.2),
			inset 0 0 0 1px rgba(255, 200, 120, 0.08);
	}
	.survival-strip__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ff4422;
		box-shadow: 0 0 10px #ff2200;
		animation: dot-blink 1.1s step-end infinite;
	}
	@keyframes dot-blink {
		0%,
		49% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0.35;
		}
	}
	.survival-strip__text {
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		color: #ffbbaa;
		text-shadow: 0 0 12px rgba(255, 80, 40, 0.5);
	}
	.survival-strip__pulse {
		width: 28px;
		height: 3px;
		border-radius: 2px;
		background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.5), transparent);
		animation: strip-sheen 2.4s linear infinite;
	}
	@keyframes strip-sheen {
		from {
			transform: translateX(-6px);
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
		to {
			transform: translateX(6px);
			opacity: 0.3;
		}
	}

	.hero {
		position: relative;
		z-index: 1;
		text-align: center;
		width: 100%;
		max-width: min(28rem, 100%);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 0;
		flex: 0 1 auto;
	}

	.hero-inner {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.28em;
		color: rgba(0, 220, 255, 0.75);
	}

	.title {
		margin: 0;
		font-size: clamp(2.4rem, 10vw, 4.8rem);
		font-weight: 900;
		letter-spacing: 0.42em;
		padding-left: 0.42em;
		color: #7cf0ff;
		text-shadow:
			0 0 42px rgba(0, 200, 255, 0.45),
			0 0 80px rgba(0, 120, 255, 0.2),
			0 2px 0 #1a4a6a;
		line-height: 1.05;
	}

	.tagline {
		margin: clamp(0.35rem, 1.5vh, 0.75rem) 0 clamp(0.25rem, 1vh, 0.5rem);
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgba(200, 220, 240, 0.82);
	}

	.tagline-sub {
		margin: 0 0 clamp(0.5rem, 2vh, 1rem);
		max-width: 22rem;
		font-size: 0.72rem;
		line-height: 1.6;
		letter-spacing: 0.04em;
		color: rgba(180, 210, 230, 0.62);
	}

	.pills {
		list-style: none;
		margin: 0 0 clamp(0.65rem, 2.5vh, 1.5rem);
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.45rem;
	}

	.pills li {
		padding: 0.28rem 0.65rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		border-radius: 999px;
		border: 1px solid rgba(0, 200, 255, 0.35);
		background: rgba(0, 24, 48, 0.65);
		color: #b8ecff;
	}

	.action-stack {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.65rem;
	}

	.cta {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 1rem 1.25rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		background: linear-gradient(165deg, rgba(0, 140, 200, 0.35), rgba(0, 60, 100, 0.9));
		box-shadow:
			0 0 0 1px rgba(0, 220, 255, 0.45),
			0 0 28px rgba(0, 180, 255, 0.25);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-shop {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		padding: 0.78rem 1rem;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		color: #b8ecff;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		background: linear-gradient(180deg, rgba(0, 28, 52, 0.75), rgba(0, 12, 26, 0.92));
		box-shadow:
			inset 0 0 0 1px rgba(0, 200, 255, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 14px rgba(0, 0, 0, 0.35);
		clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
		transition:
			box-shadow 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}
	.btn-shop:hover {
		color: #e8ffff;
		box-shadow:
			inset 0 0 0 1px rgba(0, 240, 255, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 0 20px rgba(0, 200, 255, 0.2),
			0 6px 18px rgba(0, 0, 0, 0.4);
		transform: translateY(-1px);
	}
	.btn-shop-row {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.btn-shop-icon {
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		opacity: 0.95;
		filter: drop-shadow(0 0 6px rgba(0, 200, 255, 0.35));
	}
	.btn-shop-label {
		font-size: 0.84rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-shadow: 0 0 10px rgba(0, 40, 60, 0.5);
	}
	.btn-shop-hint {
		font-size: 0.58rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: rgba(150, 200, 230, 0.65);
	}

	.btn-rank {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		padding: 0.78rem 1rem;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		color: #ffe8b8;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		background: linear-gradient(180deg, rgba(48, 36, 12, 0.75), rgba(20, 14, 6, 0.92));
		box-shadow:
			inset 0 0 0 1px rgba(255, 200, 100, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 14px rgba(0, 0, 0, 0.35);
		clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
		transition:
			box-shadow 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}
	.btn-rank:hover {
		color: #fff4d8;
		box-shadow:
			inset 0 0 0 1px rgba(255, 220, 140, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 0 20px rgba(200, 140, 40, 0.2),
			0 6px 18px rgba(0, 0, 0, 0.4);
		transform: translateY(-1px);
	}
	.btn-rank-row {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.btn-rank-icon {
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		opacity: 0.95;
		filter: drop-shadow(0 0 6px rgba(255, 200, 100, 0.35));
	}
	.btn-rank-label {
		font-size: 0.84rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-shadow: 0 0 10px rgba(0, 40, 60, 0.5);
	}
	.btn-rank-hint {
		font-size: 0.58rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: rgba(220, 180, 120, 0.65);
	}

	.cta::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 8px;
		background: linear-gradient(120deg, transparent, rgba(0, 255, 255, 0.15), transparent);
		background-size: 200% 100%;
		animation: sheen 3.2s ease-in-out infinite;
		pointer-events: none;
		z-index: -1;
		opacity: 0.9;
	}

	@keyframes sheen {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	.cta:hover {
		transform: translateY(-2px);
		box-shadow:
			0 0 0 1px rgba(0, 255, 255, 0.65),
			0 0 36px rgba(0, 200, 255, 0.4);
	}

	.cta-label {
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		color: #e8ffff;
	}

	.cta-sub {
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: rgba(180, 230, 255, 0.7);
		text-transform: uppercase;
	}

	.hud-hint {
		margin-top: clamp(0.75rem, 2.5vh, 1.5rem);
		padding-top: clamp(0.5rem, 1.5vh, 1rem);
		border-top: 1px solid rgba(0, 200, 255, 0.12);
	}

	.fake-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		margin: 0 auto;
		max-width: 200px;
		padding: 4px 6px;
		border-radius: 4px;
		background: rgba(0, 12, 28, 0.85);
		border: 1px solid rgba(0, 200, 255, 0.25);
		box-shadow: 0 0 16px rgba(0, 120, 200, 0.15);
	}

	.fake-dash {
		width: 18px;
		height: 14px;
		border-radius: 2px;
		border: 1px solid rgba(0, 200, 255, 0.5);
		background: conic-gradient(from -90deg, #00eeff 0 65%, rgba(0, 80, 120, 0.4) 65% 100%);
	}

	.fake-lv {
		width: 22px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 7px;
		font-weight: 800;
		color: #00eeff;
		border: 1px solid #00ccff;
		border-radius: 2px;
		background: rgba(0, 30, 60, 0.9);
	}

	.fake-hp {
		flex: 1;
		height: 10px;
		border-radius: 2px;
		background: linear-gradient(90deg, #33dd66 0%, #33dd66 62%, rgba(0, 0, 0, 0.5) 62%);
		border: 1px solid rgba(0, 200, 255, 0.35);
	}

	.fake-radar {
		position: relative;
		margin: 0.65rem auto 0;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: 1px solid rgba(0, 200, 255, 0.35);
		background: radial-gradient(circle, rgba(0, 40, 80, 0.5) 0%, rgba(0, 10, 24, 0.95) 70%);
		box-shadow: inset 0 0 12px rgba(0, 180, 255, 0.12);
		overflow: hidden;
	}
	.fake-radar__sweep {
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: conic-gradient(from 0deg, transparent 0 340deg, rgba(0, 255, 200, 0.35) 350deg, transparent 360deg);
		animation: radar-spin 3.2s linear infinite;
	}
	@keyframes radar-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	.fake-radar__blip {
		position: absolute;
		top: 38%;
		left: 58%;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #ff6644;
		box-shadow: 0 0 6px #ff2200;
	}
	.fake-radar__blip--2 {
		top: 62%;
		left: 32%;
		background: #44aaff;
		box-shadow: 0 0 6px #0088ff;
		animation: blip-flicker 1.4s ease-in-out infinite;
	}
	@keyframes blip-flicker {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.hint-caption {
		margin: 0.5rem 0 0;
		font-size: 0.62rem;
		color: rgba(150, 180, 200, 0.55);
		letter-spacing: 0.04em;
	}

	.controls {
		position: relative;
		z-index: 1;
		margin-top: clamp(0.5rem, 2vh, 1.25rem);
		flex-shrink: 0;
		width: min(100%, 28rem);
		padding: 1rem 1.15rem;
		border-radius: 8px;
		background: rgba(0, 10, 24, 0.55);
		border: 1px solid rgba(0, 200, 255, 0.12);
		backdrop-filter: blur(6px);
	}

	.controls-title {
		margin: 0 0 0.65rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.2em;
		color: rgba(0, 200, 255, 0.65);
		text-transform: uppercase;
	}

	.control-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
	}

	.control-grid div {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.control-grid dt {
		margin: 0;
		font-size: 0.78rem;
		color: rgba(200, 215, 230, 0.75);
	}

	.control-grid dd {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #9cf0ff;
		letter-spacing: 0.06em;
	}

	.foot {
		position: relative;
		z-index: 1;
		margin-top: clamp(0.35rem, 1.5vh, 1rem);
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.35rem 0.5rem;
		font-size: 0.65rem;
		letter-spacing: 0.14em;
		color: rgba(120, 150, 170, 0.45);
	}
	.foot-audio-open {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: inherit;
		letter-spacing: 0.12em;
		font-weight: 600;
		color: rgba(130, 200, 235, 0.72);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: rgba(0, 180, 220, 0.28);
		text-underline-offset: 2px;
		transition: color 0.15s;
	}
	.foot-audio-open__icn {
		display: flex;
		flex-shrink: 0;
		opacity: 0.88;
	}
	.foot-audio-open:hover {
		color: rgba(170, 230, 255, 0.95);
		text-decoration-color: rgba(0, 210, 255, 0.45);
	}
	.foot-audio-open__chev {
		margin-left: 0.12em;
		font-weight: 300;
		opacity: 0.7;
	}
	.foot-sep {
		opacity: 0.55;
		user-select: none;
	}
	.foot-meta {
		letter-spacing: 0.14em;
	}
</style>
