<script lang="ts">
	import { audioSettings } from '$lib/stores/audioSettings';
	import { playUiModalOpen } from '$lib/audio/sfx';
	import { locale, translate as tr } from '$lib/i18n';

	/** `game`: 일시정지 위에 표시 */
	let {
		open = $bindable(false),
		layer = 'landing'
	}: {
		open?: boolean;
		layer?: 'landing' | 'game';
	} = $props();

	function clamp(v: number): number {
		return Math.min(1, Math.max(0, v));
	}

	function pct(n: number): number {
		return Math.round(n * 100);
	}

	function close(): void {
		open = false;
	}

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
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			open = false;
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});

	function toggleBgmMute(): void {
		audioSettings.update((s) => ({ ...s, bgmMuted: !s.bgmMuted }));
	}

	function toggleSfxMute(): void {
		audioSettings.update((s) => ({ ...s, sfxMuted: !s.sfxMuted }));
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="asm-backdrop"
		style="z-index: {layer === 'game' ? 120 : 96}"
		onclick={close}
		role="presentation"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="asm-card"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="asm-title"
			aria-describedby="asm-desc"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="asm-card__glow" aria-hidden="true"></div>

			<div class="asm-head">
				<div class="asm-head__text">
					<h2 id="asm-title" class="asm-title">{tr($locale, 'audio.title')}</h2>
					<p id="asm-desc" class="asm-sub">{tr($locale, 'audio.desc')}</p>
				</div>
				<button type="button" class="asm-close" onclick={close} aria-label={tr($locale, 'common.close')}>
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

			<div class="asm-body">
				<section class="asm-block">
					<div class="asm-block__top">
						<div class="asm-block__icon asm-block__icon--bgm" aria-hidden="true">
							<svg viewBox="0 0 24 24" width="22" height="22">
								<path
									fill="currentColor"
									d="M12 4v16l-4-3H4V7h4l4-3zm4.5 3.5c1.9 1.5 1.9 4.5 0 6l-1.1-1.1c1.1-1 1.1-2.8 0-3.8L16.5 7.5zm2.8-2.8c3.1 2.8 3.1 7.5 0 10.3l-1.1-1.1c2.5-2.3 2.5-5.8 0-8.1l1.1-1.1z"
									opacity="0.92"
								/>
							</svg>
						</div>
						<div class="asm-block__meta">
							<span class="asm-block__name">{tr($locale, 'audio.bgm')}</span>
							<span class="asm-block__hint">{tr($locale, 'audio.bgmHint')}</span>
						</div>
						<button
							type="button"
							class="asm-switch"
							class:asm-switch--muted={$audioSettings.bgmMuted}
							onclick={toggleBgmMute}
							aria-label={$audioSettings.bgmMuted
								? tr($locale, 'audio.bgmMuteOn')
								: tr($locale, 'audio.bgmMuteOff')}
							aria-pressed={$audioSettings.bgmMuted}
						>
							<span class="asm-switch__track">
								<span class="asm-switch__knob"></span>
							</span>
							<span class="asm-switch__text">{$audioSettings.bgmMuted ? 'OFF' : 'ON'}</span>
						</button>
					</div>
					<div class="asm-meter">
						<div
							class="asm-meter__fill"
							style="width: {pct($audioSettings.bgmVolume)}%; opacity: {$audioSettings.bgmMuted ? 0.25 : 1}"
						></div>
					</div>
					<div class="asm-slider-row">
						<span class="asm-slider__min" aria-hidden="true">0</span>
						<input
							type="range"
							class="asm-range"
							min="0"
							max="1"
							step="0.01"
							value={$audioSettings.bgmVolume}
							aria-label={tr($locale, 'audio.bgmVolume')}
							disabled={$audioSettings.bgmMuted}
							oninput={(e) => {
								const v = parseFloat((e.currentTarget as HTMLInputElement).value);
								audioSettings.update((s) => ({ ...s, bgmVolume: clamp(v) }));
							}}
						/>
						<span class="asm-slider__val">{pct($audioSettings.bgmVolume)}%</span>
					</div>
				</section>

				<section class="asm-block">
					<div class="asm-block__top">
						<div class="asm-block__icon asm-block__icon--sfx" aria-hidden="true">
							<svg viewBox="0 0 24 24" width="22" height="22">
								<path
									fill="currentColor"
									d="M4 10v4h3l4 3V7L7 10H4zm13.5 1c0-1.2-.5-2.3-1.2-3.1l-1.4 1.4c.4.5.6 1.1.6 1.7s-.2 1.2-.6 1.7l1.4 1.4c.7-.8 1.2-1.9 1.2-3.1zm3.5 0c0-2.3-.9-4.4-2.5-6l-1.4 1.4C19.2 7.6 20 9.2 20 11s-.8 3.4-2.1 4.6l1.4 1.4c1.6-1.6 2.5-3.7 2.5-6z"
								/>
							</svg>
						</div>
						<div class="asm-block__meta">
							<span class="asm-block__name">{tr($locale, 'audio.sfx')}</span>
							<span class="asm-block__hint">{tr($locale, 'audio.sfxHint')}</span>
						</div>
						<button
							type="button"
							class="asm-switch"
							class:asm-switch--muted={$audioSettings.sfxMuted}
							onclick={toggleSfxMute}
							aria-label={$audioSettings.sfxMuted
								? tr($locale, 'audio.sfxMuteOn')
								: tr($locale, 'audio.sfxMuteOff')}
							aria-pressed={$audioSettings.sfxMuted}
						>
							<span class="asm-switch__track">
								<span class="asm-switch__knob"></span>
							</span>
							<span class="asm-switch__text">{$audioSettings.sfxMuted ? 'OFF' : 'ON'}</span>
						</button>
					</div>
					<div class="asm-meter">
						<div
							class="asm-meter__fill asm-meter__fill--sfx"
							style="width: {pct($audioSettings.sfxVolume)}%; opacity: {$audioSettings.sfxMuted ? 0.25 : 1}"
						></div>
					</div>
					<div class="asm-slider-row">
						<span class="asm-slider__min" aria-hidden="true">0</span>
						<input
							type="range"
							class="asm-range asm-range--sfx"
							min="0"
							max="1"
							step="0.01"
							value={$audioSettings.sfxVolume}
							aria-label={tr($locale, 'audio.sfxVolume')}
							disabled={$audioSettings.sfxMuted}
							oninput={(e) => {
								const v = parseFloat((e.currentTarget as HTMLInputElement).value);
								audioSettings.update((s) => ({ ...s, sfxVolume: clamp(v) }));
							}}
						/>
						<span class="asm-slider__val">{pct($audioSettings.sfxVolume)}%</span>
					</div>
				</section>
			</div>

			<div class="asm-foot">
				<button type="button" class="asm-done" onclick={close}>{tr($locale, 'common.confirm')}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes asm-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes asm-pop {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.asm-backdrop {
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
		animation: asm-in 0.22s ease-out;
		/* .hud 가 pointer-events:none 일 때 클릭이 하위(일시정지 버튼 등)로 새지 않도록 */
		pointer-events: auto;
		touch-action: none;
		overscroll-behavior: none;
	}

	.asm-card {
		position: relative;
		width: min(100%, 400px);
		max-height: min(86dvh, 560px);
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
		animation: asm-pop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}


	.asm-card__glow {
		position: absolute;
		inset: -1px;
		border-radius: 16px;
		pointer-events: none;
		background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(0, 200, 255, 0.18), transparent 58%);
		opacity: 0.9;
	}

	.asm-head {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}

	.asm-head__text {
		min-width: 0;
	}

	.asm-title {
		margin: 0 0 6px;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #7aefff;
		text-shadow: 0 0 20px rgba(0, 200, 255, 0.35);
	}

	.asm-sub {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.45;
		color: rgba(170, 190, 215, 0.82);
		max-width: 280px;
	}

	.asm-close {
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
	.asm-close:hover {
		background: rgba(0, 80, 120, 0.45);
		color: #bff;
	}

	.asm-body {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow: hidden;
	}

	.asm-block {
		padding: 14px 14px 12px;
		border-radius: 12px;
		background: rgba(0, 8, 22, 0.55);
		border: 1px solid rgba(0, 160, 220, 0.15);
	}

	.asm-block__top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
		min-height: 44px;
	}

	.asm-block__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 11px;
		color: #0a1628;
	}
	.asm-block__icon--bgm {
		background: linear-gradient(135deg, #2ee6ff, #0099cc);
		box-shadow: 0 0 16px rgba(0, 200, 255, 0.35);
	}
	.asm-block__icon--sfx {
		background: linear-gradient(135deg, #a78bfa, #6366f1);
		box-shadow: 0 0 16px rgba(120, 100, 255, 0.3);
	}

	.asm-block__meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.asm-block__name {
		font-size: 0.9rem;
		font-weight: 800;
		color: rgba(230, 242, 255, 0.95);
		letter-spacing: 0.02em;
	}

	.asm-block__hint {
		font-size: 0.65rem;
		color: rgba(150, 175, 200, 0.75);
		letter-spacing: 0.03em;
	}

	.asm-switch {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		color: rgba(200, 220, 240, 0.9);
		font-family: inherit;
	}
	.asm-switch__track {
		position: relative;
		width: 48px;
		height: 28px;
		border-radius: 999px;
		background: rgba(0, 200, 255, 0.35);
		box-shadow: 0 0 0 1px rgba(0, 200, 255, 0.45) inset;
		transition: background 0.2s;
	}
	.asm-switch--muted .asm-switch__track {
		background: rgba(60, 70, 90, 0.55);
		box-shadow: 0 0 0 1px rgba(100, 110, 130, 0.35) inset;
	}
	.asm-switch__knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: linear-gradient(180deg, #fff, #b8ecff);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
		transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.asm-switch:not(.asm-switch--muted) .asm-switch__knob {
		transform: translateX(20px);
		background: linear-gradient(180deg, #e8ffff, #3ce0ff);
	}
	.asm-switch--muted .asm-switch__knob {
		background: linear-gradient(180deg, #889, #556);
	}
	.asm-switch__text {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		min-width: 2.25rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: rgba(120, 230, 255, 0.95);
	}
	.asm-switch--muted .asm-switch__text {
		color: rgba(150, 160, 180, 0.75);
	}

	.asm-meter {
		position: relative;
		height: 6px;
		margin-bottom: 10px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.asm-meter__fill {
		height: 100%;
		border-radius: 3px;
		background: linear-gradient(90deg, #0099cc, #33eeff);
		transition:
			width 0.08s ease-out,
			opacity 0.15s;
	}
	.asm-meter__fill--sfx {
		background: linear-gradient(90deg, #6366f1, #c4b5fd);
	}

	.asm-slider-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.asm-slider__min {
		font-size: 0.65rem;
		color: rgba(140, 160, 185, 0.55);
		width: 14px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.asm-slider__val {
		min-width: 38px;
		text-align: right;
		font-size: 0.72rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: rgba(120, 220, 255, 0.9);
	}

	.asm-range {
		flex: 1;
		height: 8px;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		cursor: pointer;
		touch-action: pan-x;
	}
	.asm-range:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.asm-range::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
	}
	.asm-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		margin-top: -6px;
		border-radius: 50%;
		background: linear-gradient(180deg, #e8ffff, #00c8e8);
		box-shadow:
			0 0 0 2px rgba(0, 40, 60, 0.5),
			0 2px 8px rgba(0, 200, 255, 0.4);
		border: none;
	}
	.asm-range--sfx::-webkit-slider-thumb {
		background: linear-gradient(180deg, #f0e8ff, #8b7ae8);
		box-shadow:
			0 0 0 2px rgba(30, 20, 60, 0.5),
			0 2px 8px rgba(130, 100, 255, 0.35);
	}
	.asm-range::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
	}
	.asm-range::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border: none;
		border-radius: 50%;
		background: linear-gradient(180deg, #e8ffff, #00c8e8);
		box-shadow: 0 0 0 2px rgba(0, 40, 60, 0.5);
	}

	.asm-foot {
		position: relative;
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid rgba(0, 180, 255, 0.15);
	}
	.asm-done {
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
	.asm-done:hover {
		filter: brightness(1.08);
	}
	.asm-done:active {
		transform: scale(0.99);
	}
</style>
