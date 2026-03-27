<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<main class="landing">
	<div class="bg-grid" aria-hidden="true"></div>
	<div class="bg-glow" aria-hidden="true"></div>
	<div class="scan" aria-hidden="true"></div>

	<section class="hero">
		<div class="hero-inner">
			<p class="eyebrow">3D MECH · SURVIVE · AUTO FIRE</p>
			<h1 class="title">BOUT</h1>
			<p class="tagline">넓은 행성에서 몰려오는 기계 군단을 뚫고 살아남으세요.</p>

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
			<p class="hint-caption">플레이 중 상단 HUD · 머리 위 상태바와 같은 톤</p>
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

	.bg-grid {
		position: absolute;
		inset: -40%;
		background-image:
			linear-gradient(rgba(0, 200, 255, 0.07) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 200, 255, 0.07) 1px, transparent 1px);
		background-size: 48px 48px;
		transform: perspective(400px) rotateX(58deg) translateY(-8%);
		animation: grid-drift 22s linear infinite;
		pointer-events: none;
		opacity: 0.55;
	}

	.bg-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 35%, rgba(0, 180, 255, 0.18), transparent 55%);
		pointer-events: none;
		animation: glow-pulse 5.5s ease-in-out infinite alternate;
	}

	.scan {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			rgba(0, 220, 255, 0.03) 50%,
			transparent 100%
		);
		background-size: 100% 220%;
		animation: scan-move 7s linear infinite;
		pointer-events: none;
		opacity: 0.5;
	}

	@keyframes grid-drift {
		from { transform: perspective(400px) rotateX(58deg) translateY(-8%) translateZ(0); }
		to { transform: perspective(400px) rotateX(58deg) translateY(2%) translateZ(0); }
	}

	@keyframes glow-pulse {
		from { opacity: 0.65; }
		to { opacity: 1; }
	}

	@keyframes scan-move {
		from { background-position: 0 -40%; }
		to { background-position: 0 140%; }
	}

	@media (prefers-reduced-motion: reduce) {
		.bg-grid,
		.bg-glow,
		.scan {
			animation: none;
		}
		.cta::before {
			animation: none;
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
		margin: 0.75rem 0 1.25rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgba(200, 220, 240, 0.82);
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
