<script lang="ts">
	import { onDestroy } from 'svelte';
	import { playUiModalOpen } from '$lib/audio/sfx';
	import { formatGamepadButton, formatKeyboardCode } from '$lib/input/keyCodeLabel';
	import {
		inputSettings,
		type InputSettingsState,
		DEFAULT_KEYBOARD,
		DEFAULT_GAMEPAD
	} from '$lib/stores/inputSettings';
	import { locale, translate as tr } from '$lib/i18n';

	let {
		open = $bindable(false),
		layer = 'landing'
	}: {
		open?: boolean;
		layer?: 'landing' | 'game';
	} = $props();

	let hasGamepad = $state(false);
	/** 버튼 입력 후 getGamepads 검증 중 */
	let gamepadDetectLoading = $state(false);
	let listeningKb = $state<keyof InputSettingsState['keyboard'] | null>(null);
	let listeningGp = $state<'jump' | 'dash' | 'pause' | 'back' | 'card1' | 'card2' | 'card3' | null>(
		null
	);
	let duplicateKeyError = $state<string | null>(null);

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
		listeningKb;
		listeningGp;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			if (listeningKb || listeningGp) {
				listeningKb = null;
				listeningGp = null;
				return;
			}
			open = false;
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});

	/**
	 * 모달이 열려 있는 동안 rAF로 폴링: (1) 버튼 누름 → 로딩 후 getGamepads 검증
	 * (2) gamepadconnected 이벤트 (3) 연결 해제 반영
	 */
	$effect(() => {
		if (!open) return;
		let stopped = false;
		let rafId = 0;
		let localHas = false;
		let localLoading = false;
		let probeFrames = 0;

		function pushUi(): void {
			hasGamepad = localHas;
			gamepadDetectLoading = localLoading;
		}

		function tick(): void {
			if (stopped) return;
			const pads = navigator.getGamepads?.() ?? [];
			const connected = pads.some((g) => g?.connected);

			let anyPress = false;
			for (const g of pads) {
				if (!g) continue;
				for (const b of g.buttons) {
					if (b.pressed || (typeof b.value === 'number' && b.value > 0.4)) {
						anyPress = true;
						break;
					}
				}
				if (anyPress) break;
			}

			if (localLoading) {
				probeFrames++;
				const nowConnected = pads.some((g) => g?.connected);
				if (nowConnected || probeFrames >= 48) {
					localHas = nowConnected;
					localLoading = false;
					probeFrames = 0;
				}
				pushUi();
			} else if (!localHas) {
				if (anyPress) {
					localLoading = true;
					probeFrames = 0;
					pushUi();
				} else if (connected) {
					localHas = true;
					pushUi();
				}
			} else {
				if (!connected) localHas = false;
				pushUi();
			}

			if (!stopped) rafId = requestAnimationFrame(tick);
		}

		function onGamepadConnected(): void {
			if (stopped) return;
			const pads = navigator.getGamepads?.() ?? [];
			if (pads.some((g) => g?.connected)) {
				localHas = true;
				localLoading = false;
				probeFrames = 0;
				pushUi();
			}
		}

		function onGamepadDisconnected(): void {
			if (stopped) return;
			const pads = navigator.getGamepads?.() ?? [];
			localHas = pads.some((g) => g?.connected);
			if (!localHas) localLoading = false;
			pushUi();
		}

		const pads0 = navigator.getGamepads?.() ?? [];
		localHas = pads0.some((g) => g?.connected);
		localLoading = false;
		pushUi();

		window.addEventListener('gamepadconnected', onGamepadConnected);
		window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
		rafId = requestAnimationFrame(tick);

		return () => {
			stopped = true;
			cancelAnimationFrame(rafId);
			window.removeEventListener('gamepadconnected', onGamepadConnected);
			window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
		};
	});

	function close(): void {
		listeningKb = null;
		listeningGp = null;
		gamepadDetectLoading = false;
		duplicateKeyError = null;
		open = false;
	}

	function setMode(mode: InputSettingsState['mode']): void {
		if (mode === 'gamepad' && !hasGamepad) return;
		inputSettings.update((s) => ({ ...s, mode }));
	}

	function patchKeyboard(patch: Partial<InputSettingsState['keyboard']>): void {
		inputSettings.update((s) => ({ ...s, keyboard: { ...s.keyboard, ...patch } }));
	}

	function patchGamepad(patch: Partial<InputSettingsState['gamepad']>): void {
		inputSettings.update((s) => ({ ...s, gamepad: { ...s.gamepad, ...patch } }));
	}

	function startListenKb(id: keyof InputSettingsState['keyboard']): void {
		listeningGp = null;
		listeningKb = listeningKb === id ? null : id;
	}

	function onRemapKeydown(e: KeyboardEvent): void {
		if (!listeningKb) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.code === 'Escape') {
			listeningKb = null;
			duplicateKeyError = null;
			return;
		}
		const field = listeningKb;
		const currentSettings = $inputSettings.keyboard;
		if (currentSettings[field] === e.code) {
			listeningKb = null;
			return;
		}
		const duplicateEntry = Object.entries(currentSettings).find(
			([key, value]) => key !== field && value === e.code
		);
		if (duplicateEntry) {
			duplicateKeyError = `${formatKeyboardCode(e.code)} 키는 이미 다른 기능에 할당되어 있습니다.`;
			setTimeout(() => {
				duplicateKeyError = null;
			}, 3000);
			listeningKb = null;
			return;
		}
		patchKeyboard({ [field]: e.code } as Partial<InputSettingsState['keyboard']>);
		listeningKb = null;
	}

	$effect(() => {
		if (!listeningKb) return;
		window.addEventListener('keydown', onRemapKeydown, true);
		return () => window.removeEventListener('keydown', onRemapKeydown, true);
	});

	let rafGp = 0;
	$effect(() => {
		if (!listeningGp) return;
		function tick(): void {
			const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected);
			if (gp) {
				for (let i = 0; i < gp.buttons.length; i++) {
					if (gp.buttons[i]?.pressed) {
						switch (listeningGp) {
							case 'jump':
								patchGamepad({ jumpButton: i });
								break;
							case 'dash':
								patchGamepad({ dashButton: i });
								break;
							case 'pause':
								patchGamepad({ pauseButton: i });
								break;
							case 'back':
								patchGamepad({ backButton: i });
								break;
							case 'card1':
								patchGamepad({ cardSelect1: i });
								break;
							case 'card2':
								patchGamepad({ cardSelect2: i });
								break;
							case 'card3':
								patchGamepad({ cardSelect3: i });
								break;
						}
						listeningGp = null;
						return;
					}
				}
			}
			rafGp = requestAnimationFrame(tick);
		}
		rafGp = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafGp);
	});

	function resetDefaults(): void {
		inputSettings.set({
			mode: 'keyboard',
			keyboard: { ...DEFAULT_KEYBOARD },
			gamepad: { ...DEFAULT_GAMEPAD }
		});
	}

	onDestroy(() => {
		listeningKb = null;
		listeningGp = null;
	});

	const kbRows: { actionId: keyof InputSettingsState['keyboard']; labelKey: string }[] = [
		{ actionId: 'moveUp', labelKey: 'input.kbUp' },
		{ actionId: 'moveDown', labelKey: 'input.kbDown' },
		{ actionId: 'moveLeft', labelKey: 'input.kbLeft' },
		{ actionId: 'moveRight', labelKey: 'input.kbRight' },
		{ actionId: 'dash', labelKey: 'input.kbDash' },
		{ actionId: 'dashExtra', labelKey: 'input.kbDashExtra' },
		{ actionId: 'jumpPrimary', labelKey: 'input.kbJump1' },
		{ actionId: 'jumpSecondary', labelKey: 'input.kbJump2' }
	];
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
			class="asm-card asm-card--input"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="ism-title"
			aria-describedby="ism-desc"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="asm-card__glow" aria-hidden="true"></div>

			<div class="asm-head">
				<div class="asm-head__text">
					<h2 id="ism-title" class="asm-title">{tr($locale, 'input.title')}</h2>
					<p id="ism-desc" class="asm-sub">{tr($locale, 'input.desc')}</p>
				</div>
				<button
					type="button"
					class="asm-close"
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

			<div class="asm-body asm-body--scroll">
				<section class="asm-block">
					<div class="asm-block__top">
						<div class="asm-block__icon asm-block__icon--input" aria-hidden="true">
							{#if $inputSettings.mode === 'gamepad'}
								<img
									class="gamepad-img"
									src="/images/etc/gamepad.svg"
									alt=""
									width="32"
									height="32"
								/>
							{:else}
								<img src="/images/etc/keyboard.svg" alt="" width="32" height="32" />
							{/if}
						</div>
						<div class="asm-block__meta">
							<span class="asm-block__name">{tr($locale, 'input.deviceMode')}</span>
							<span class="asm-block__hint">
								{#if gamepadDetectLoading}
									<span class="ism-gp-detect">
										<span class="ism-gp-spin" aria-hidden="true"></span>
										{tr($locale, 'input.gamepadDetecting')}
									</span>
								{:else if hasGamepad}
									{tr($locale, 'input.gamepadReady')}
								{:else}
									{tr($locale, 'input.gamepadPressAny')}
								{/if}
							</span>
						</div>
					</div>
					{#if gamepadDetectLoading}
						<div class="ism-gp-loading" aria-busy="true" aria-live="polite">
							<span class="ism-gp-spin ism-gp-spin--lg" aria-hidden="true"></span>
							<span>{tr($locale, 'input.gamepadDetecting')}</span>
						</div>
					{/if}
					<div class="ism-mode-row">
						<button
							type="button"
							class="ism-mode-btn"
							class:ism-mode-btn--on={$inputSettings.mode === 'keyboard'}
							onclick={() => setMode('keyboard')}
						>
							{tr($locale, 'input.modeKeyboard')}
						</button>
						<button
							type="button"
							class="ism-mode-btn"
							class:ism-mode-btn--on={$inputSettings.mode === 'gamepad'}
							disabled={!hasGamepad}
							onclick={() => setMode('gamepad')}
						>
							{tr($locale, 'input.modeGamepad')}
						</button>
					</div>
				</section>

				<section class="asm-block">
					<div class="ism-section-h">{tr($locale, 'input.sectionKeyboard')}</div>
					<label class="ism-check">
						<input
							type="checkbox"
							checked={$inputSettings.keyboard.arrowAlternate}
							onchange={(e) =>
								patchKeyboard({ arrowAlternate: (e.currentTarget as HTMLInputElement).checked })}
						/>
						<span>{tr($locale, 'input.arrowAlternate')}</span>
					</label>
					{#if duplicateKeyError}
						<div class="ism-error" role="alert">
							{tr($locale, 'input.duplicateKeyError')}
						</div>
					{/if}
					<div class="ism-kb-grid">
						{#each kbRows as row (row.actionId)}
							{@const act = row.actionId}
							{@const val = $inputSettings.keyboard[act]}
							<span class="ism-kb-label">{tr($locale, row.labelKey)}</span>
							<button
								type="button"
								class="ism-kb-val"
								class:ism-kb-val--active={listeningKb === act}
								onclick={() => startListenKb(act)}
							>
								{listeningKb === act
									? tr($locale, 'input.pressKey')
									: typeof val === 'string'
										? formatKeyboardCode(val)
										: '—'}
							</button>
						{/each}
					</div>
				</section>

				<section class="asm-block">
					<div class="ism-section-h">{tr($locale, 'input.sectionGamepad')}</div>
					<p class="ism-hint">{tr($locale, 'input.gamepadMapHint')}</p>
					<div class="ism-kb-grid">
						<span class="ism-kb-label">{tr($locale, 'input.gpJump')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'jump'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'jump' ? null : 'jump';
							}}
						>
							{listeningGp === 'jump'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.jumpButton)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpDash')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'dash'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'dash' ? null : 'dash';
							}}
						>
							{listeningGp === 'dash'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.dashButton)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpPause')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'pause'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'pause' ? null : 'pause';
							}}
						>
							{listeningGp === 'pause'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.pauseButton)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpBack')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'back'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'back' ? null : 'back';
							}}
						>
							{listeningGp === 'back'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.backButton)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpCard1')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'card1'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'card1' ? null : 'card1';
							}}
						>
							{listeningGp === 'card1'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.cardSelect1)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpCard2')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'card2'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'card2' ? null : 'card2';
							}}
						>
							{listeningGp === 'card2'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.cardSelect2)}
						</button>
						<span class="ism-kb-label">{tr($locale, 'input.gpCard3')}</span>
						<button
							type="button"
							class="ism-kb-val"
							class:ism-kb-val--active={listeningGp === 'card3'}
							onclick={() => {
								listeningKb = null;
								listeningGp = listeningGp === 'card3' ? null : 'card3';
							}}
						>
							{listeningGp === 'card3'
								? tr($locale, 'input.pressButton')
								: formatGamepadButton($inputSettings.gamepad.cardSelect3)}
						</button>
					</div>
					<div class="asm-slider-row" style="margin-top:10px">
						<span class="asm-slider__min" aria-hidden="true">DZ</span>
						<input
							type="range"
							class="asm-range"
							min="0.08"
							max="0.45"
							step="0.01"
							value={$inputSettings.gamepad.deadzone}
							aria-label={tr($locale, 'input.deadzone')}
							oninput={(e) =>
								patchGamepad({
									deadzone: parseFloat((e.currentTarget as HTMLInputElement).value)
								})}
						/>
						<span class="asm-slider__val">{Math.round($inputSettings.gamepad.deadzone * 100)}%</span
						>
					</div>
				</section>

				<button type="button" class="ism-reset" onclick={resetDefaults}>
					{tr($locale, 'input.resetDefaults')}
				</button>
			</div>

			<div class="asm-foot">
				<button type="button" class="asm-done" onclick={close}
					>{tr($locale, 'common.confirm')}</button
				>
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
		pointer-events: auto;
		touch-action: none;
		overscroll-behavior: none;
	}

	.asm-card--input {
		width: min(100%, 480px);
		max-height: min(90dvh, 720px);
	}

	.asm-card {
		position: relative;
		max-height: min(90dvh, 620px);
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
		display: flex;
		flex-direction: column;
	}

	.asm-card__glow {
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

	.asm-head {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
		flex-shrink: 0;
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
		max-width: 320px;
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
		gap: 12px;
		min-height: 0;
	}

	.asm-body--scroll {
		overflow-y: auto;
		flex: 1;
		padding-right: 4px;
	}

	.asm-block {
		padding: 12px 12px 10px;
		border-radius: 12px;
		background: rgba(0, 8, 22, 0.55);
		border: 1px solid rgba(0, 160, 220, 0.15);
	}

	.asm-block__top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
		min-height: 40px;
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
	.asm-block__icon--input {
		background: linear-gradient(135deg, #2ee6ff, #0099cc);
		box-shadow: 0 0 16px rgba(0, 200, 255, 0.35);
	}
	.asm-block__icon--input img {
		filter: none;
	}
	.asm-block__icon--input .gamepad-img {
		filter: brightness(0) invert(1);
	}

	.asm-block__meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.asm-block__name {
		font-size: 0.88rem;
		font-weight: 800;
		color: rgba(230, 242, 255, 0.95);
		letter-spacing: 0.02em;
	}

	.asm-block__hint {
		font-size: 0.62rem;
		color: rgba(150, 175, 200, 0.75);
		letter-spacing: 0.03em;
	}

	.ism-gp-detect {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.ism-gp-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin: 0 0 10px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(0, 40, 50, 0.45);
		border: 1px solid rgba(0, 200, 220, 0.22);
		font-size: 0.72rem;
		font-weight: 600;
		color: rgba(160, 230, 255, 0.95);
		letter-spacing: 0.04em;
	}
	@keyframes ism-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.ism-gp-spin {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid rgba(0, 200, 255, 0.25);
		border-top-color: rgba(100, 240, 255, 0.95);
		border-radius: 50%;
		animation: ism-spin 0.65s linear infinite;
		flex-shrink: 0;
	}
	.ism-gp-spin--lg {
		width: 18px;
		height: 18px;
		border-width: 2px;
	}

	.ism-mode-row {
		display: flex;
		gap: 8px;
	}
	.ism-mode-btn {
		flex: 1;
		padding: 10px 8px;
		border-radius: 10px;
		border: 1px solid rgba(0, 180, 220, 0.25);
		background: rgba(0, 20, 40, 0.5);
		color: rgba(180, 210, 230, 0.85);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.ism-mode-btn:hover:not(:disabled) {
		border-color: rgba(0, 220, 255, 0.45);
		color: #e8f8ff;
	}
	.ism-mode-btn:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}
	.ism-mode-btn--on {
		border-color: rgba(0, 220, 255, 0.65);
		background: rgba(0, 80, 120, 0.45);
		color: #b8f8ff;
		box-shadow: 0 0 16px rgba(0, 200, 255, 0.2);
	}

	.ism-section-h {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: rgba(120, 200, 255, 0.75);
		margin-bottom: 8px;
		text-transform: uppercase;
	}

	.ism-hint {
		margin: 0 0 8px;
		font-size: 0.65rem;
		line-height: 1.4;
		color: rgba(150, 170, 195, 0.72);
	}

	.ism-check {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		font-size: 0.72rem;
		color: rgba(200, 215, 235, 0.88);
		cursor: pointer;
		user-select: none;
	}
	.ism-check input {
		accent-color: #2dd4bf;
	}

	.ism-error {
		padding: 8px 12px;
		margin-bottom: 8px;
		border-radius: 8px;
		background: rgba(220, 50, 50, 0.2);
		border: 1px solid rgba(255, 80, 80, 0.45);
		font-size: 0.68rem;
		color: #ff9999;
		line-height: 1.4;
		animation: ism-err-in 0.2s ease-out;
	}
	@keyframes ism-err-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.ism-kb-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 10px;
		align-items: center;
	}
	.ism-kb-label {
		font-size: 0.72rem;
		color: rgba(190, 205, 225, 0.85);
	}
	.ism-kb-val {
		min-width: 7rem;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid rgba(0, 160, 200, 0.28);
		background: rgba(0, 12, 28, 0.65);
		color: rgba(160, 230, 255, 0.95);
		font-size: 0.72rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.ism-kb-val:hover {
		border-color: rgba(0, 220, 255, 0.45);
	}
	.ism-kb-val--active {
		border-color: rgba(52, 211, 153, 0.65);
		box-shadow: 0 0 12px rgba(52, 211, 153, 0.25);
		color: #a7f3d0;
	}

	.ism-reset {
		width: 100%;
		margin-top: 4px;
		padding: 8px;
		border: 1px dashed rgba(0, 160, 200, 0.28);
		border-radius: 10px;
		background: transparent;
		color: rgba(150, 190, 210, 0.85);
		font-size: 0.68rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ism-reset:hover {
		border-color: rgba(0, 200, 255, 0.4);
		color: #cff;
	}

	.asm-slider-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.asm-slider__min {
		font-size: 0.6rem;
		color: rgba(140, 160, 185, 0.55);
		width: 22px;
		text-align: center;
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
		background: linear-gradient(180deg, #a7f3d0, #059669);
		box-shadow:
			0 0 0 2px rgba(0, 40, 60, 0.5),
			0 2px 8px rgba(52, 211, 153, 0.35);
		border: none;
	}

	.asm-foot {
		position: relative;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(0, 180, 255, 0.15);
		flex-shrink: 0;
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
