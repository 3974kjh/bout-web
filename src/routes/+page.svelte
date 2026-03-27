<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<main class="landing">
	<div class="bg-vignette" aria-hidden="true"></div>
	<div class="bg-platform-stream" aria-hidden="true"></div>
	<div class="bg-grid" aria-hidden="true"></div>
	<div class="bg-glow" aria-hidden="true"></div>
	<div class="bg-scan" aria-hidden="true"></div>
	<div class="bg-threat" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--tl" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--tr" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--bl" aria-hidden="true"></div>
	<div class="frame-corners frame-corners--br" aria-hidden="true"></div>

	<section class="hero">
		<div class="hero-inner">
			<div class="survival-strip" aria-hidden="true">
				<span class="survival-strip__dot"></span>
				<span class="survival-strip__text">THREAT LOCK · MECH SURVIVAL</span>
				<span class="survival-strip__pulse"></span>
			</div>
			<p class="eyebrow">3D MECH · SURVIVE · AUTO FIRE</p>
			<h1 class="title">BOUT</h1>
			<p class="tagline">넓은 행성에서 몰려오는 기계 군단을 뚫고 살아남으세요.</p>
			<p class="tagline-sub">자동 화력으로 전선을 유지하세요. 정비 없이 버티는 시간이 곧 기록입니다.</p>

			<ul class="pills" aria-label="게임 특징">
				<li>자동 사격</li>
				<li>레벨업 카드</li>
				<li>보스 러시</li>
				<li>미니맵</li>
			</ul>

			<div class="action-stack">
				<button type="button" class="cta" onclick={() => goto('/game')}>
					<span class="cta-label">작전 개시</span>
					<span class="cta-sub">Enter the field</span>
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
						<span class="btn-shop-label">정비소</span>
					</span>
					<span class="btn-shop-hint">기체 · 미사일 색 · 선호 카드</span>
				</button>
				<button type="button" class="btn-rank" onclick={() => goto('/rank')}>
					<span class="btn-rank-row">
						<svg class="btn-rank-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								fill="currentColor"
								d="M5 3h2v2h10V3h2v4.2c0 1.68-1.02 3.12-2.47 3.73L17 19H7l-.53-8.07A4.2 4.2 0 0 1 5 7.2V3zm2.2 4.2c0 .55.45 1 1 1h7.6c.55 0 1-.45 1-1V5H7.2v2.2zM8.5 21h7v2h-7v-2z"
							/>
						</svg>
						<span class="btn-rank-label">랭킹</span>
					</span>
					<span class="btn-rank-hint">기록 · 시상대 · 상세 목록</span>
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
			<p class="hint-caption">HUD · 위협 감지 · 생존 타이머와 같은 톤</p>
		</div>
	</section>

	<section class="controls" aria-label="조작 안내">
		<h2 class="controls-title">조작</h2>
		<dl class="control-grid">
			<div><dt>이동</dt><dd>W A S D</dd></div>
			<div><dt>점프</dt><dd>Space · C</dd></div>
			<div><dt>대쉬</dt><dd>Shift</dd></div>
			<div><dt>일시정지</dt><dd>Esc</dd></div>
		</dl>
	</section>

	<footer class="foot">SvelteKit · Three.js · TypeScript</footer>
</main>

<style>
	.landing {
		position: relative;
		min-height: 100vh;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 4vw, 3rem);
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #e8f4ff;
		background: radial-gradient(ellipse 120% 80% at 50% 0%, #0c1830 0%, #05060f 45%, #020308 100%);
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

	/* 규칙적인 발판 띠 — 한 주기(96px)만큼만 Y 이동해 끊김 없이 아래로 흐름 */
	.bg-platform-stream {
		position: absolute;
		inset: -35% -15% 0 -15%;
		height: 120%;
		pointer-events: none;
		z-index: 0;
		opacity: 0.85;
		transform: perspective(520px) rotateX(64deg);
		transform-origin: 50% 0%;
		background-image:
			repeating-linear-gradient(
				to bottom,
				transparent 0,
				transparent 52px,
				rgba(0, 210, 255, 0.14) 52px,
				rgba(0, 210, 255, 0.14) 54px,
				transparent 54px,
				transparent 68px,
				rgba(0, 160, 255, 0.09) 68px,
				rgba(0, 160, 255, 0.09) 70px,
				transparent 70px,
				transparent 96px
			),
			repeating-linear-gradient(
				90deg,
				transparent 0,
				transparent 118px,
				rgba(0, 180, 255, 0.07) 118px,
				rgba(0, 180, 255, 0.07) 119px,
				transparent 119px,
				transparent 236px
			);
		background-size: 100% 96px, 236px 100%;
		animation: platform-flow 9s linear infinite;
	}

	@keyframes platform-flow {
		from {
			background-position: 0 0, 0 0;
		}
		to {
			background-position: 0 96px, 0 0;
		}
	}

	.bg-grid {
		position: absolute;
		inset: -40%;
		background-image:
			linear-gradient(rgba(0, 200, 255, 0.065) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 200, 255, 0.065) 1px, transparent 1px);
		background-size: 48px 48px;
		transform: perspective(400px) rotateX(58deg) translateY(-6%);
		animation: grid-flow 16s linear infinite;
		pointer-events: none;
		opacity: 0.42;
		z-index: 0;
	}

	@keyframes grid-flow {
		from {
			background-position: 0 0, 0 0;
		}
		to {
			background-position: 0 48px, 48px 0;
		}
	}

	.bg-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 32%, rgba(0, 180, 255, 0.2), transparent 52%);
		pointer-events: none;
		animation: glow-pulse 5.5s ease-in-out infinite alternate;
		z-index: 0;
	}

	.bg-scan {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			rgba(0, 220, 255, 0.028) 50%,
			transparent 100%
		);
		background-size: 100% 180%;
		animation: scan-move 11s linear infinite;
		pointer-events: none;
		opacity: 0.42;
		z-index: 0;
	}

	.bg-threat {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255, 60, 20, 0.12), transparent 62%);
		animation: threat-breathe 4.2s ease-in-out infinite;
	}

	@keyframes threat-breathe {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
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

	@keyframes glow-pulse {
		from {
			opacity: 0.65;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scan-move {
		from {
			background-position: 0 -35%;
		}
		to {
			background-position: 0 135%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bg-platform-stream,
		.bg-grid,
		.bg-glow,
		.bg-scan,
		.bg-threat,
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
		margin-bottom: 0.85rem;
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
		font-size: clamp(3.2rem, 12vw, 4.8rem);
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
		margin: 0.75rem 0 0.5rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgba(200, 220, 240, 0.82);
	}

	.tagline-sub {
		margin: 0 0 1.1rem;
		max-width: 22rem;
		font-size: 0.72rem;
		line-height: 1.6;
		letter-spacing: 0.04em;
		color: rgba(180, 210, 230, 0.62);
	}

	.pills {
		list-style: none;
		margin: 0 0 1.75rem;
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
		margin-top: 2rem;
		padding-top: 1.25rem;
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
		margin-top: 2.5rem;
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
		margin-top: 2rem;
		font-size: 0.65rem;
		letter-spacing: 0.14em;
		color: rgba(120, 150, 170, 0.45);
	}
</style>
