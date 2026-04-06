<script lang="ts">
	import { playUiModalOpen } from '$lib/audio/sfx';
	import { locale, translate as tr } from '$lib/i18n';

	let {
		open = $bindable(false),
		layer = 'landing'
	}: {
		open?: boolean;
		layer?: 'landing' | 'game';
	} = $props();

	let prevOpen = false;
	$effect(() => {
		if (open && !prevOpen) playUiModalOpen();
		prevOpen = open;
	});

	$effect(() => {
		if (!open || layer !== 'landing') return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});

	$effect(() => {
		if (!open || layer === 'game') return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				open = false;
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});

	function close(): void {
		open = false;
	}

	const sections = [
		{ id: 'overview', icon: '◎' },
		{ id: 'objective', icon: '⬡' },
		{ id: 'combat', icon: '◇' },
		{ id: 'upgrade', icon: '◆' },
		{ id: 'tips', icon: '◈' }
	];
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="gg-backdrop"
		style="z-index: {layer === 'game' ? 120 : 96}"
		onclick={close}
		role="presentation"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="gg-card"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="gg-title"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="gg-glow" aria-hidden="true"></div>

			<div class="gg-head">
				<div class="gg-head__text">
					<h2 id="gg-title" class="gg-title">{tr($locale, 'guide.title')}</h2>
					<p class="gg-sub">{tr($locale, 'guide.subtitle')}</p>
				</div>
				<button
					type="button"
					class="gg-close"
					onclick={close}
					aria-label={tr($locale, 'common.close')}
				>
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<path
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							d="M6 6l12 12M18 6L6 18"
						/>
					</svg>
				</button>
			</div>

			<div class="gg-body">
				<section class="gg-section">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secOverviewIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secOverview')}</h3>
					</div>
					<p class="gg-text">{tr($locale, 'guide.overviewDesc')}</p>
					<ul class="gg-feature-list">
						<li>{tr($locale, 'guide.featSurvival')}</li>
						<li>{tr($locale, 'guide.featAutoFire')}</li>
						<li>{tr($locale, 'guide.featCards')}</li>
						<li>{tr($locale, 'guide.featBoss')}</li>
					</ul>
				</section>

				<section class="gg-section">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secObjectiveIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secObjective')}</h3>
					</div>
					<p class="gg-text">{tr($locale, 'guide.objectiveDesc')}</p>
					<div class="gg-goal-card">
						<span class="gg-goal-card__badge">{tr($locale, 'guide.goalBadge')}</span>
						<span class="gg-goal-card__text">{tr($locale, 'guide.goalText')}</span>
					</div>
				</section>

				<section class="gg-section">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secCombatIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secCombat')}</h3>
					</div>
					<div class="gg-combat-grid">
						<div class="gg-combat-item">
							<span class="gg-combat-item__key">{tr($locale, 'guide.combatMove')}</span>
							<span class="gg-combat-item__desc">{tr($locale, 'guide.combatMoveDesc')}</span>
						</div>
						<div class="gg-combat-item">
							<span class="gg-combat-item__key">{tr($locale, 'guide.combatJump')}</span>
							<span class="gg-combat-item__desc">{tr($locale, 'guide.combatJumpDesc')}</span>
						</div>
						<div class="gg-combat-item gg-combat-item--highlight">
							<span class="gg-combat-item__key">{tr($locale, 'guide.combatDoubleJump')}</span>
							<span class="gg-combat-item__desc">{tr($locale, 'guide.combatDoubleJumpDesc')}</span>
						</div>
						<div class="gg-combat-item">
							<span class="gg-combat-item__key">{tr($locale, 'guide.combatDash')}</span>
							<span class="gg-combat-item__desc">{tr($locale, 'guide.combatDashDesc')}</span>
						</div>
						<div class="gg-combat-item">
							<span class="gg-combat-item__key">{tr($locale, 'guide.combatAim')}</span>
							<span class="gg-combat-item__desc">{tr($locale, 'guide.combatAimDesc')}</span>
						</div>
					</div>
				</section>

				<section class="gg-section">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secUpgradeIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secUpgrade')}</h3>
					</div>
					<p class="gg-text">{tr($locale, 'guide.upgradeDesc')}</p>
					<div class="gg-upgrade-steps">
						<div class="gg-upgrade-step">
							<span class="gg-upgrade-step__num">1</span>
							<span class="gg-upgrade-step__text">{tr($locale, 'guide.upgradeStep1')}</span>
						</div>
						<div class="gg-upgrade-step">
							<span class="gg-upgrade-step__num">2</span>
							<span class="gg-upgrade-step__text">{tr($locale, 'guide.upgradeStep2')}</span>
						</div>
						<div class="gg-upgrade-step">
							<span class="gg-upgrade-step__num">3</span>
							<span class="gg-upgrade-step__text">{tr($locale, 'guide.upgradeStep3')}</span>
						</div>
					</div>
				</section>

				<section class="gg-section gg-section--danger">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secDifficultyIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secDifficulty')}</h3>
					</div>
					<p class="gg-text">{tr($locale, 'guide.difficultyDesc')}</p>

					<div class="gg-diff-block">
						<h4 class="gg-diff-block__title">{tr($locale, 'guide.difficultyBossTitle')}</h4>
						<ul class="gg-diff-list">
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.bossSpawnTime')}
							</li>
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.bossScalePerKill')}
							</li>
							<li><span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.bossTypes')}</li>
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.bossAoeAttack')}
							</li>
						</ul>
					</div>

					<div class="gg-diff-block">
						<h4 class="gg-diff-block__title">{tr($locale, 'guide.difficultyMonsterTitle')}</h4>
						<p class="gg-text gg-text--small">{tr($locale, 'guide.monsterScaleHeader')}</p>
						<ul class="gg-diff-list">
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.monsterHpScale')}
							</li>
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.monsterAtkScale')}
							</li>
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.monsterSpdScale')}
							</li>
							<li>
								<span class="gg-diff-list__bullet">▶</span>{tr($locale, 'guide.monsterSpawnCap')}
							</li>
						</ul>
					</div>

					<div class="gg-diff-block">
						<h4 class="gg-diff-block__title">{tr($locale, 'guide.monsterNewTypesTitle')}</h4>
						<ul class="gg-wave-list">
							<li><span class="gg-wave-list__badge">1</span>{tr($locale, 'guide.monsterWave1')}</li>
							<li>
								<span class="gg-wave-list__badge">2+</span>{tr($locale, 'guide.monsterWave2')}
							</li>
							<li>
								<span class="gg-wave-list__badge">3+</span>{tr($locale, 'guide.monsterWave3')}
							</li>
							<li>
								<span class="gg-wave-list__badge">4+</span>{tr($locale, 'guide.monsterWave4')}
							</li>
							<li>
								<span class="gg-wave-list__badge">5+</span>{tr($locale, 'guide.monsterWave5')}
							</li>
						</ul>
					</div>
				</section>

				<section class="gg-section gg-section--tips">
					<div class="gg-section__header">
						<span class="gg-section__icon">{tr($locale, 'guide.secTipsIcon')}</span>
						<h3 class="gg-section__title">{tr($locale, 'guide.secTips')}</h3>
					</div>
					<ul class="gg-tip-list">
						<li>
							<span class="gg-tip__icon" aria-hidden="true">▸</span>
							{tr($locale, 'guide.tip1')}
						</li>
						<li>
							<span class="gg-tip__icon" aria-hidden="true">▸</span>
							{tr($locale, 'guide.tip2')}
						</li>
						<li>
							<span class="gg-tip__icon" aria-hidden="true">▸</span>
							{tr($locale, 'guide.tip3')}
						</li>
						<li>
							<span class="gg-tip__icon" aria-hidden="true">▸</span>
							{tr($locale, 'guide.tip4')}
						</li>
					</ul>
				</section>
			</div>

			<div class="gg-foot">
				<button type="button" class="gg-done" onclick={close}
					>{tr($locale, 'common.confirm')}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes gg-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes gg-pop {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.gg-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
			max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
		background: rgba(2, 6, 18, 0.78);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		animation: gg-in 0.22s ease-out;
		pointer-events: auto;
		touch-action: none;
		overscroll-behavior: none;
	}

	.gg-card {
		position: relative;
		width: min(100%, 520px);
		max-height: min(90dvh, 720px);
		overflow: hidden;
		pointer-events: auto;
		touch-action: manipulation;
		border-radius: 16px;
		padding: 22px 22px 18px;
		background: linear-gradient(165deg, rgba(14, 22, 42, 0.97), rgba(6, 10, 24, 0.99));
		border: 1px solid rgba(0, 210, 255, 0.28);
		box-shadow:
			0 0 0 1px rgba(0, 140, 220, 0.12) inset,
			0 24px 48px rgba(0, 0, 0, 0.55),
			0 0 40px rgba(0, 160, 255, 0.12);
		animation: gg-pop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
		display: flex;
		flex-direction: column;
	}

	.gg-glow {
		position: absolute;
		inset: -1px;
		border-radius: 16px;
		pointer-events: none;
		background: radial-gradient(
			ellipse 80% 55% at 50% -10%,
			rgba(0, 200, 255, 0.18),
			transparent 58%
		);
		opacity: 0.9;
	}

	.gg-head {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
		flex-shrink: 0;
	}

	.gg-head__text {
		min-width: 0;
	}

	.gg-title {
		margin: 0 0 4px;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #7aefff;
		text-shadow: 0 0 20px rgba(0, 200, 255, 0.35);
	}

	.gg-sub {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.4;
		color: rgba(170, 190, 215, 0.72);
	}

	.gg-close {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		margin: -6px -6px 0 0;
		border: none;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.35);
		color: rgba(200, 220, 240, 0.85);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.gg-close:hover {
		background: rgba(0, 80, 120, 0.45);
		color: #bff;
	}

	.gg-body {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		padding-right: 6px;
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 200, 255, 0.3) transparent;
	}

	.gg-body::-webkit-scrollbar {
		width: 6px;
	}

	.gg-body::-webkit-scrollbar-track {
		background: transparent;
		margin: 2px 0;
	}

	.gg-body::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, rgba(0, 200, 255, 0.45), rgba(0, 140, 200, 0.3));
		border-radius: 999px;
		border: 1px solid rgba(0, 200, 255, 0.15);
	}

	.gg-section {
		padding: 14px;
		border-radius: 12px;
		background: rgba(0, 8, 22, 0.5);
		border: 1px solid rgba(0, 160, 220, 0.12);
	}

	.gg-section__header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.gg-section__icon {
		font-size: 0.9rem;
		color: #00d4ff;
		text-shadow: 0 0 8px rgba(0, 200, 255, 0.5);
	}

	.gg-section__title {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #b8f0ff;
		text-transform: uppercase;
	}

	.gg-text {
		margin: 0 0 10px;
		font-size: 0.75rem;
		line-height: 1.55;
		color: rgba(190, 210, 230, 0.85);
	}

	.gg-text--small {
		margin: 0 0 6px;
		font-size: 0.68rem;
	}

	.gg-feature-list {
		margin: 0;
		padding: 0 0 0 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.gg-feature-list li {
		font-size: 0.72rem;
		color: rgba(170, 200, 220, 0.8);
		line-height: 1.4;
	}

	.gg-goal-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-radius: 8px;
		background: linear-gradient(135deg, rgba(0, 60, 40, 0.5), rgba(0, 30, 20, 0.6));
		border: 1px solid rgba(52, 211, 153, 0.3);
	}

	.gg-goal-card__badge {
		flex-shrink: 0;
		padding: 3px 8px;
		border-radius: 4px;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #a7f3d0;
		background: rgba(52, 211, 153, 0.2);
		border: 1px solid rgba(52, 211, 153, 0.35);
	}

	.gg-goal-card__text {
		font-size: 0.75rem;
		font-weight: 600;
		color: #d1fae5;
		line-height: 1.4;
	}

	.gg-combat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.gg-combat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		border-radius: 6px;
		background: rgba(0, 16, 32, 0.5);
		border: 1px solid rgba(0, 140, 200, 0.15);
	}

	.gg-combat-item--highlight {
		background: rgba(52, 211, 153, 0.12);
		border-color: rgba(52, 211, 153, 0.35);
	}

	.gg-combat-item--highlight .gg-combat-item__key {
		color: #6ee7b7;
	}

	.gg-combat-item__key {
		font-size: 0.72rem;
		font-weight: 800;
		color: #7aefff;
		letter-spacing: 0.04em;
	}

	.gg-combat-item__desc {
		font-size: 0.65rem;
		color: rgba(160, 195, 215, 0.75);
		line-height: 1.35;
	}

	.gg-upgrade-steps {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.gg-upgrade-step {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}

	.gg-upgrade-step__num {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-size: 0.62rem;
		font-weight: 800;
		color: #0a1628;
		background: linear-gradient(135deg, #5ef, #0ac);
		box-shadow: 0 0 8px rgba(0, 200, 255, 0.35);
	}

	.gg-upgrade-step__text {
		font-size: 0.72rem;
		line-height: 1.45;
		color: rgba(185, 210, 230, 0.85);
		padding-top: 1px;
	}

	.gg-tip-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.gg-tip-list li {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.72rem;
		line-height: 1.45;
		color: rgba(180, 205, 225, 0.85);
	}

	.gg-tip__icon {
		flex-shrink: 0;
		color: #5ef;
		font-size: 0.7rem;
		margin-top: 1px;
	}

	.gg-section--danger {
		border-color: rgba(255, 100, 60, 0.25);
		background: linear-gradient(135deg, rgba(40, 12, 8, 0.5), rgba(20, 6, 4, 0.5));
	}

	.gg-diff-block {
		margin-bottom: 12px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(0, 10, 20, 0.5);
		border: 1px solid rgba(0, 140, 180, 0.15);
	}

	.gg-diff-block:last-child {
		margin-bottom: 0;
	}

	.gg-diff-block__title {
		margin: 0 0 8px;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #ffa07a;
		text-transform: uppercase;
	}

	.gg-diff-list {
		margin: 0;
		padding: 0 0 0 4px;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.gg-diff-list li {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.7rem;
		line-height: 1.4;
		color: rgba(200, 210, 225, 0.85);
	}

	.gg-diff-list__bullet {
		flex-shrink: 0;
		color: #ff7755;
		font-size: 0.65rem;
		margin-top: 1px;
	}

	.gg-wave-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.gg-wave-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.7rem;
		line-height: 1.4;
		color: rgba(200, 210, 225, 0.85);
	}

	.gg-wave-list__badge {
		flex-shrink: 0;
		min-width: 28px;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-align: center;
		color: #0a1628;
		background: linear-gradient(135deg, #ff7755, #cc4422);
		box-shadow: 0 0 6px rgba(255, 80, 40, 0.4);
	}

	.gg-foot {
		position: relative;
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid rgba(0, 180, 255, 0.15);
		flex-shrink: 0;
	}

	.gg-done {
		width: 100%;
		padding: 12px 16px;
		border: none;
		border-radius: 10px;
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		cursor: pointer;
		color: #021018;
		background: linear-gradient(180deg, #5ef, #0ac);
		box-shadow: 0 4px 20px rgba(0, 200, 255, 0.25);
		transition:
			filter 0.15s,
			transform 0.1s;
	}

	.gg-done:hover {
		filter: brightness(1.08);
	}

	.gg-done:active {
		transform: scale(0.99);
	}
</style>
