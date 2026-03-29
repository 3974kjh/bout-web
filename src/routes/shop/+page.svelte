<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import type { MechBase } from '$lib/domain/types';
	import {
		DEFAULT_SHOP_SETTINGS,
		MAX_FAVORED_CARDS,
		MISSILE_SKINS,
		type ShopSettings
	} from '$lib/game/shopSettings';
	import BackToHomeButton from '$lib/components/BackToHomeButton.svelte';
	import ShopMechPreview from '$lib/components/shop/ShopMechPreview.svelte';
	import ShopEvolutionGuide from '$lib/components/shop/ShopEvolutionGuide.svelte';
	import { getAllCardsCatalog } from '$lib/game/systems/UpgradeSystem';
	import {
		readShopSettingsFromIndexedDb,
		writeShopSettingsToIndexedDb
	} from '$lib/storage/shopIndexedDb';
	import { locale, translate as tr, mechShopLine, missileSkinLabel } from '$lib/i18n';

	const catalog = getAllCardsCatalog();
	const mechOrder: MechBase[] = [
		'hypersuit',
		'azonas-v',
		'geren',
		'expressive',
		'soldier',
		'cyberpunk-human',
		'neon-human'
	];

	let settings = $state<ShopSettings>({ ...DEFAULT_SHOP_SETTINGS });
	let loadError = $state<string | null>(null);
	let ready = $state(false);

	onMount(() => {
		void (async () => {
			try {
				settings = await readShopSettingsFromIndexedDb();
			} catch (e) {
				loadError = e instanceof Error ? e.message : tr(get(locale), 'shop.loadFailed');
				settings = { ...DEFAULT_SHOP_SETTINGS };
			} finally {
				ready = true;
			}
		})();
	});

	async function persist(next: ShopSettings): Promise<void> {
		settings = next;
		try {
			await writeShopSettingsToIndexedDb(next);
		} catch (e) {
			loadError = e instanceof Error ? e.message : tr(get(locale), 'shop.saveFailed');
		}
	}

	function selectMech(base: MechBase): void {
		void persist({ ...settings, mechBase: base });
	}

	function selectSkin(id: string): void {
		void persist({ ...settings, missileSkinId: id });
	}

	function toggleFavor(id: string): void {
		const set = new Set(settings.favoredCardIds);
		if (set.has(id)) set.delete(id);
		else if (set.size < MAX_FAVORED_CARDS) set.add(id);
		void persist({ ...settings, favoredCardIds: [...set] });
	}

	function resetDefaults(): void {
		void persist({ ...DEFAULT_SHOP_SETTINGS });
	}

</script>

<div class="shop-fill">
	<BackToHomeButton />
	<div class="bg-grid" aria-hidden="true"></div>

	<header class="shop-head">
		<h1 class="title">{tr($locale, 'shop.title')}</h1>
		<p class="sub">
			{@html tr($locale, 'shop.subHtml')}
		</p>
		{#if loadError}
			<p class="err" role="alert">{loadError}</p>
		{/if}
		{#if !ready}
			<p class="loading">{tr($locale, 'shop.loading')}</p>
		{/if}
	</header>

	<div class="shop-body bout-scrollbar">
		<div class="col-main bout-scrollbar">
			<section class="panel" aria-labelledby="sec-mech">
				<h2 id="sec-mech" class="sec-title">{tr($locale, 'shop.secMech')}</h2>
				<p class="sec-desc">
					{@html tr($locale, 'shop.secMechDesc')}
				</p>
				<div class="mech-grid">
					{#each mechOrder as base (base)}
						<button
							type="button"
							class="mech-card"
							class:selected={settings.mechBase === base}
							disabled={!ready}
							onclick={() => selectMech(base)}
						>
							<span class="mech-name">{mechShopLine($locale, base, 'name')}</span>
							<span class="mech-tag">{mechShopLine($locale, base, 'tag')}</span>
							<span class="mech-blurb">{mechShopLine($locale, base, 'blurb')}</span>
						</button>
					{/each}
				</div>

				{#key settings.mechBase}
					<ShopEvolutionGuide mechBase={settings.mechBase} />
				{/key}
			</section>

			<section class="panel" aria-labelledby="sec-skin">
				<h2 id="sec-skin" class="sec-title">{tr($locale, 'shop.secSkin')}</h2>
				<p class="sec-desc">
					{@html tr($locale, 'shop.secSkinDesc')}
				</p>
				<div class="skin-grid">
					{#each MISSILE_SKINS as skin (skin.id)}
						<button
							type="button"
							class="skin-chip"
							class:selected={settings.missileSkinId === skin.id}
							disabled={!ready}
							onclick={() => selectSkin(skin.id)}
							title={missileSkinLabel($locale, skin.id)}
						>
							<span class="swatch" style:--c={'#' + skin.color.toString(16).padStart(6, '0')}></span>
							<span class="skin-label">{missileSkinLabel($locale, skin.id)}</span>
						</button>
					{/each}
				</div>
			</section>

			<section class="panel" aria-labelledby="sec-cards">
				<h2 id="sec-cards" class="sec-title">{tr($locale, 'shop.secCards')}</h2>
				<p class="sec-desc">
					{@html tr($locale, 'shop.secCardsDesc', { max: MAX_FAVORED_CARDS })}
				</p>
				<p class="favor-count">
					{tr($locale, 'shop.favorCount', {
						cur: settings.favoredCardIds.length,
						max: MAX_FAVORED_CARDS
					})}
				</p>
				<div class="card-pool bout-scrollbar">
					{#each catalog as card (card.id)}
						<button
							type="button"
							class="card-pill"
							class:on={settings.favoredCardIds.includes(card.id)}
							class:rare={card.rarity === 'rare'}
							class:epic={card.rarity === 'epic'}
							disabled={!ready}
							onclick={() => toggleFavor(card.id)}
						>
							<span class="ce">{card.emoji}</span>
							<span class="cn">{card.name}</span>
						</button>
					{/each}
				</div>
			</section>
		</div>

		<aside class="col-side" aria-label={tr($locale, 'shop.previewAsideAria')}>
			<div class="side-sticky bout-scrollbar">
				<h2 class="side-title">{tr($locale, 'shop.sideTitle')}</h2>
				<div class="side-mech-head">
					<span class="sm-name">{mechShopLine($locale, settings.mechBase, 'name')}</span>
					<span class="sm-tag">{mechShopLine($locale, settings.mechBase, 'tag')}</span>
				</div>
				<p class="side-one">{mechShopLine($locale, settings.mechBase, 'blurb')}</p>

				{#key settings.mechBase}
					<ShopMechPreview mechBase={settings.mechBase} />
				{/key}

				<p class="side-evo-short">{tr($locale, 'shop.sideEvoShort')}</p>
			</div>
		</aside>
	</div>

	<footer class="shop-foot">
		<button
			type="button"
			class="btn-foot btn-foot-reset"
			disabled={!ready}
			onclick={resetDefaults}
			aria-label={tr($locale, 'shop.resetAria')}
			title={tr($locale, 'shop.resetTitle')}
		>
			<span class="btn-foot-edge" aria-hidden="true"></span>
			<svg class="btn-foot-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path
					fill="none"
					stroke="currentColor"
					stroke-width="1.65"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M4 4v5h5M20.49 9A9 9 0 0 0 5.64 5.64L4 7.27M20 20v-5h-5M3.51 15a9 9 0 0 0 14.85 3.36L20 16.73"
				/>
			</svg>
			<span class="btn-foot-text">
				<span class="btn-foot-label">{tr($locale, 'shop.resetLabel')}</span>
				<span class="btn-foot-sub">{tr($locale, 'shop.resetSub')}</span>
			</span>
		</button>
		<button
			type="button"
			class="btn-foot btn-foot-deploy"
			disabled={!ready}
			onclick={() => goto('/game')}
			aria-label={tr($locale, 'shop.deployAria')}
			title={tr($locale, 'shop.deployTitle')}
		>
			<span class="btn-foot-edge" aria-hidden="true"></span>
			<svg class="btn-foot-icon btn-foot-icon-lg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path fill="currentColor" d="M8.5 5.25v13.5L20.25 12 8.5 5.25z" />
			</svg>
			<span class="btn-foot-text">
				<span class="btn-foot-label">{tr($locale, 'shop.deployLabel')}</span>
				<span class="btn-foot-sub">{tr($locale, 'shop.deploySub')}</span>
			</span>
			<span class="btn-foot-pulse" aria-hidden="true"></span>
		</button>
	</footer>
</div>

<style>
	.shop-fill {
		position: fixed;
		inset: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #e8f4ff;
		background: radial-gradient(ellipse 90% 60% at 50% 0%, #0c1830 0%, #05060f 55%, #020308 100%);
		overflow: hidden;
		box-sizing: border-box;
	}

	.bg-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(0, 200, 255, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 200, 255, 0.045) 1px, transparent 1px);
		background-size: 36px 36px;
		pointer-events: none;
		opacity: 0.5;
		z-index: 0;
	}

	.shop-head {
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		padding: 0.85rem clamp(1rem, 3vw, 2rem) 0.65rem;
		border-bottom: 1px solid rgba(0, 200, 255, 0.12);
		text-align: center;
	}

	.head-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.storage-badge {
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.2em;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(0, 200, 255, 0.35);
		color: rgba(150, 230, 255, 0.9);
		background: rgba(0, 30, 50, 0.6);
	}

	.title {
		margin: 0.35rem 0 0;
		font-size: clamp(1.35rem, 3.2vw, 1.85rem);
		font-weight: 900;
		letter-spacing: 0.14em;
		color: #7cf0ff;
		text-shadow: 0 0 18px rgba(0, 200, 255, 0.3);
	}

	.sub {
		margin: 0.4rem auto 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: rgba(170, 195, 215, 0.82);
		max-width: 56rem;
	}
	.sub :global(code) {
		font-size: 0.72em;
		color: #9cf;
	}

	.err {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: #f88;
	}
	.loading {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		color: rgba(200, 220, 255, 0.6);
	}

	.shop-body {
		position: relative;
		z-index: 1;
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr minmax(17rem, 34vw);
		gap: 0 1rem;
		padding: 0.75rem clamp(0.85rem, 2.5vw, 1.75rem) 0.5rem;
	}

	@media (max-width: 960px) {
		.shop-body {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}
		.col-side {
			border-left: none !important;
			border-top: 1px solid rgba(0, 200, 255, 0.12);
			max-height: none !important;
		}
		.side-sticky {
			position: relative !important;
			top: auto !important;
		}
	}

	.col-main {
		min-height: 0;
		overflow-y: auto;
		padding-bottom: 0.5rem;
	}

	.col-side {
		min-height: 0;
		overflow: hidden;
		border-left: 1px solid rgba(0, 200, 255, 0.1);
		padding-left: 1rem;
	}

	.side-sticky {
		position: sticky;
		top: 0;
		max-height: 100%;
		overflow-y: auto;
		padding-bottom: 1rem;
	}

	.side-title {
		margin: 0 0 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		color: rgba(0, 220, 255, 0.85);
		text-transform: uppercase;
	}

	.side-mech-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem 0.65rem;
		margin: 0 0 0.45rem;
	}

	.sm-name {
		font-size: 1.05rem;
		font-weight: 800;
		color: #dff;
	}

	.sm-tag {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: rgba(255, 200, 120, 0.95);
	}

	.side-one {
		margin: 0 0 0.75rem;
		font-size: 0.72rem;
		line-height: 1.45;
		color: rgba(175, 195, 215, 0.88);
	}

	.side-evo-short {
		margin: 0.65rem 0 0;
		font-size: 0.55rem;
		line-height: 1.4;
		color: rgba(130, 165, 190, 0.65);
		word-break: break-word;
	}

	.panel {
		margin-top: 0.85rem;
		padding: 1rem 1.1rem;
		border-radius: 10px;
		background: rgba(0, 12, 28, 0.68);
		border: 1px solid rgba(0, 200, 255, 0.12);
	}
	.panel:first-child {
		margin-top: 0;
	}

	.sec-title {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(0, 220, 255, 0.78);
	}

	.sec-desc {
		margin: 0 0 0.85rem;
		font-size: 0.76rem;
		line-height: 1.5;
		color: rgba(170, 190, 210, 0.82);
	}
	.sec-desc :global(code) {
		font-size: 0.68rem;
		color: #9cf;
	}

	.mech-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr));
		gap: 0.65rem;
	}

	.mech-card {
		text-align: left;
		padding: 0.85rem 1rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 200, 255, 0.2);
		background: rgba(0, 20, 40, 0.45);
		color: inherit;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.mech-card:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.mech-card:hover:not(:disabled) {
		border-color: rgba(0, 220, 255, 0.45);
	}
	.mech-card.selected {
		border-color: #4df;
		box-shadow: 0 0 16px rgba(0, 200, 255, 0.22);
		background: rgba(0, 40, 70, 0.5);
	}

	.mech-name {
		font-weight: 800;
		font-size: 0.98rem;
		color: #dff;
	}
	.mech-tag {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: rgba(255, 200, 120, 0.95);
	}
	.mech-blurb {
		font-size: 0.7rem;
		line-height: 1.45;
		color: rgba(180, 200, 215, 0.88);
	}

	.skin-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.8rem, 1fr));
		gap: 0.45rem;
	}

	.skin-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.55rem 0.4rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 200, 255, 0.16);
		background: rgba(0, 16, 32, 0.5);
		color: #cde;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.skin-chip:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.skin-chip:hover:not(:disabled) {
		border-color: rgba(0, 220, 255, 0.4);
	}
	.skin-chip.selected {
		border-color: #6df;
		box-shadow: 0 0 12px color-mix(in srgb, var(--c) 30%, transparent);
	}

	.swatch {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 10px var(--c), inset 0 0 8px rgba(255, 255, 255, 0.3);
		border: 2px solid rgba(255, 255, 255, 0.22);
	}

	.skin-label {
		font-size: 0.58rem;
		font-weight: 700;
		text-align: center;
		line-height: 1.2;
	}

	.favor-count {
		margin: 0 0 0.5rem;
		font-size: 0.68rem;
		color: rgba(150, 200, 230, 0.9);
	}

	.card-pool {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		max-height: min(42vh, 420px);
		overflow-y: auto;
		padding: 0.1rem 0;
	}

	.card-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.32rem 0.5rem;
		border-radius: 999px;
		border: 1px solid rgba(0, 200, 255, 0.18);
		background: rgba(0, 24, 48, 0.6);
		color: #ddeeff;
		font-size: 0.64rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}
	.card-pill:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.card-pill:hover:not(:disabled) {
		border-color: rgba(0, 220, 255, 0.42);
	}
	.card-pill.on {
		border-color: #6df;
		background: rgba(0, 60, 90, 0.72);
	}
	.card-pill.rare.on {
		border-color: #a8f;
	}
	.card-pill.epic.on {
		border-color: #fc8;
	}

	.ce {
		font-size: 0.8rem;
		line-height: 1;
	}
	.cn {
		letter-spacing: 0.02em;
	}

	.shop-foot {
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: stretch;
		justify-content: flex-end;
		padding: 0.85rem clamp(0.85rem, 2.5vw, 1.75rem) calc(0.85rem + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid rgba(0, 200, 255, 0.14);
		background:
			linear-gradient(to top, rgba(6, 10, 22, 0.98), rgba(8, 14, 28, 0.9)),
			radial-gradient(ellipse 80% 100% at 100% 100%, rgba(0, 120, 180, 0.12), transparent 55%);
	}

	.btn-foot {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.72rem 1rem 0.72rem 0.85rem;
		border: none;
		cursor: pointer;
		font: inherit;
		text-align: left;
		overflow: hidden;
		clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
		transition:
			transform 0.14s ease,
			box-shadow 0.14s ease,
			filter 0.14s ease;
	}
	.btn-foot:disabled {
		opacity: 0.42;
		cursor: not-allowed;
		filter: grayscale(0.35);
	}
	.btn-foot:not(:disabled):active {
		transform: translateY(2px);
	}

	.btn-foot-edge {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 -1px 0 rgba(0, 0, 0, 0.35);
	}

	.btn-foot-icon {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: currentColor;
		filter: drop-shadow(0 0 6px rgba(0, 220, 255, 0.35));
	}
	.btn-foot-icon-lg {
		width: 1.75rem;
		height: 1.75rem;
	}

	.btn-foot-text {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		min-width: 0;
	}
	.btn-foot-label {
		font-size: 0.78rem;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		text-shadow: 0 0 12px rgba(0, 0, 0, 0.5);
	}
	.btn-foot-sub {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		opacity: 0.72;
	}

	.btn-foot-reset {
		flex: 0 1 12.5rem;
		min-width: min(100%, 11rem);
		color: #c8dce8;
		background: linear-gradient(165deg, rgba(35, 48, 62, 0.95), rgba(12, 18, 28, 0.98));
		box-shadow:
			inset 0 0 0 1px rgba(255, 160, 80, 0.4),
			0 0 0 1px rgba(0, 0, 0, 0.45),
			0 4px 16px rgba(0, 0, 0, 0.35);
	}
	.btn-foot-reset:not(:disabled):hover {
		color: #eff8ff;
		box-shadow:
			inset 0 0 0 1px rgba(255, 200, 130, 0.65),
			0 0 0 1px rgba(255, 140, 60, 0.2),
			0 0 22px rgba(255, 140, 60, 0.18),
			0 6px 20px rgba(0, 0, 0, 0.4);
	}

	.btn-foot-deploy {
		flex: 1 1 16rem;
		min-width: min(100%, 14rem);
		color: #e8ffff;
		background: linear-gradient(165deg, rgba(0, 110, 165, 0.55), rgba(0, 35, 72, 0.98));
		box-shadow:
			inset 0 0 0 1px rgba(0, 230, 255, 0.48),
			0 0 0 1px rgba(0, 40, 80, 0.65),
			0 4px 24px rgba(0, 160, 220, 0.22);
	}
	.btn-foot-deploy:not(:disabled):hover {
		box-shadow:
			inset 0 0 0 1px rgba(140, 255, 255, 0.75),
			0 0 0 1px rgba(0, 255, 255, 0.28),
			0 0 28px rgba(0, 200, 255, 0.38),
			0 8px 28px rgba(0, 0, 0, 0.45);
		filter: brightness(1.05);
	}

	.btn-foot-pulse {
		position: absolute;
		inset: -40%;
		background: radial-gradient(circle at 30% 50%, rgba(0, 255, 255, 0.12), transparent 45%);
		pointer-events: none;
		animation: foot-deploy-glow 2.4s ease-in-out infinite;
	}
	@keyframes foot-deploy-glow {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	@media (max-width: 520px) {
		.shop-foot {
			flex-direction: column;
		}
		.btn-foot-reset,
		.btn-foot-deploy {
			flex: 1 1 auto;
			width: 100%;
			min-width: 0;
		}
	}
</style>
