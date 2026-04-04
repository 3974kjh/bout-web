<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import BackToHomeButton from '$lib/components/BackToHomeButton.svelte';
	import RankPodium from '$lib/components/rank/RankPodium.svelte';
	import PlayerAvatar from '$lib/components/rank/PlayerAvatar.svelte';
	import { readRankRecordsForUser } from '$lib/storage/userGameStorage';
	import type { RankRunRecord } from '$lib/storage/rankIndexedDb';
	import {
		fetchWorldLeaderboardFromCloud,
		fetchMyWorldRankFromCloud,
		WORLD_LEADERBOARD_CAP,
		worldLeaderboardRowToRankRecord,
		type WorldLeaderboardRow
	} from '$lib/storage/supabase/rankCloud';
	import { goHomeOnEscape } from '$lib/navigation/goHomeOnEscape';
	import { getBrowserSupabase } from '$lib/supabase/browser';
	import { locale, translate as tr, numberLocaleTag, mechShopLine } from '$lib/i18n';
	import type { MechBase } from '$lib/domain/types';

	const PAGE_SIZE = 20;

	const MECH_ICON: Record<MechBase, string> = {
		hypersuit: '🛡',
		'azonas-v': '⚡',
		geren: '🧱',
		expressive: '✦',
		soldier: '🎖',
		'cyberpunk-human': '🌃',
		'neon-human': '💠'
	};

	type TabId = 'my' | 'world';

	let activeTab = $state<TabId>('my');
	let records = $state<RankRunRecord[]>([]);
	let listPage = $state(1);
	let loadingMy = $state(true);

	let worldRows = $state<WorldLeaderboardRow[]>([]);
	let worldLoading = $state(false);
	let worldErr = $state<string | null>(null);
	let worldPage = $state(1);
	let myWorldRank = $state<number | null>(null);
	let myWorldRankPending = $state(false);

	const sorted = $derived([...records].sort((a, b) => b.scoreTotal - a.scoreTotal || b.playedAt - a.playedAt));

	const topThree = $derived(sorted.slice(0, 3));
	/** 시상대 좌→중→우: 2등, 1등, 3등 */
	const podiumSlots = $derived<[RankRunRecord | null, RankRunRecord | null, RankRunRecord | null]>([
		topThree[1] ?? null,
		topThree[0] ?? null,
		topThree[2] ?? null
	]);

	const worldTopThree = $derived(worldRows.slice(0, 3));
	const worldPodiumSlots = $derived<[RankRunRecord | null, RankRunRecord | null, RankRunRecord | null]>([
		worldTopThree[1] ? worldLeaderboardRowToRankRecord(worldTopThree[1]) : null,
		worldTopThree[0] ? worldLeaderboardRowToRankRecord(worldTopThree[0]) : null,
		worldTopThree[2] ? worldLeaderboardRowToRankRecord(worldTopThree[2]) : null
	]);

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)));
	const pageSlice = $derived(sorted.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE));

	const worldTotalPages = $derived(Math.max(1, Math.ceil(worldRows.length / PAGE_SIZE)));
	const worldPageSlice = $derived(
		worldRows.slice((worldPage - 1) * PAGE_SIZE, worldPage * PAGE_SIZE)
	);

	const myUserId = $derived(page.data.user?.id ?? null);

	/** RPC 실패·미배포 시에도 상위 100 목록에 본인이 있으면 place 사용 */
	const myWorldRankResolved = $derived.by(() => {
		if (!myUserId) return null;
		const fromList = worldRows.find((r) => r.user_id === myUserId);
		if (fromList && fromList.place >= 1) return fromList.place;
		if (myWorldRank !== null && myWorldRank >= 1) return myWorldRank;
		return null;
	});

	const canJumpToMyWorldRank = $derived(
		myUserId !== null &&
			!worldLoading &&
			worldErr === null &&
			myWorldRankResolved !== null &&
			myWorldRankResolved >= 1 &&
			myWorldRankResolved <= WORLD_LEADERBOARD_CAP &&
			worldRows.length > 0
	);

	$effect(() => {
		if (listPage > totalPages) listPage = totalPages;
	});

	$effect(() => {
		if (worldPage > worldTotalPages) worldPage = worldTotalPages;
	});

	const dateLoc = $derived(numberLocaleTag($locale));

	$effect(() => {
		if (activeTab !== 'world') return;
		let cancelled = false;
		worldLoading = true;
		worldErr = null;
		void (async () => {
			const sb = getBrowserSupabase();
			if (!sb) {
				if (!cancelled) {
					worldErr = tr(get(locale), 'rank.worldNoSupabase');
					worldLoading = false;
					worldRows = [];
				}
				return;
			}
			const { rows, error } = await fetchWorldLeaderboardFromCloud(sb, WORLD_LEADERBOARD_CAP);
			if (cancelled) return;
			if (error) {
				worldErr = `${tr(get(locale), 'rank.worldError')} ${tr(get(locale), 'rank.worldErrorRpc')}`;
				worldRows = [];
			} else {
				worldErr = null;
				worldRows = rows;
			}
			worldLoading = false;
		})();
		return () => {
			cancelled = true;
			worldLoading = false;
		};
	});

	$effect(() => {
		if (activeTab !== 'world' || !myUserId) {
			myWorldRank = null;
			myWorldRankPending = false;
			return;
		}
		let cancelled = false;
		myWorldRankPending = true;
		void (async () => {
			const sb = getBrowserSupabase();
			if (!sb) {
				if (!cancelled) {
					myWorldRank = null;
					myWorldRankPending = false;
				}
				return;
			}
			const r = await fetchMyWorldRankFromCloud(sb);
			if (!cancelled) {
				myWorldRank = r;
				myWorldRankPending = false;
			}
		})();
		return () => {
			cancelled = true;
			myWorldRankPending = false;
		};
	});

	$effect(() => {
		const _uid = page.data.user?.id ?? null;
		loadingMy = true;
		void readRankRecordsForUser().then((r) => {
			records = r;
			loadingMy = false;
		});
	});

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

	function fmtTime(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function fmtDate(ts: number): string {
		try {
			return new Date(ts).toLocaleString(dateLoc, {
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '—';
		}
	}

	function providerLabel(raw: string): string {
		const p = raw.toLowerCase().trim();
		if (!p) return tr(get(locale), 'rank.providerUnknown');
		if (p === 'google') return tr(get(locale), 'rank.providerGoogle');
		if (p === 'github') return tr(get(locale), 'rank.providerGithub');
		if (p === 'apple') return tr(get(locale), 'rank.providerApple');
		return raw;
	}

	function onTabChange(next: TabId): void {
		activeTab = next;
		if (next === 'world') worldPage = 1;
		else listPage = 1;
	}

	function jumpToMyWorldRow(): void {
		const r = myWorldRankResolved;
		if (r === null || r < 1 || r > WORLD_LEADERBOARD_CAP) return;
		worldPage = Math.max(1, Math.ceil(r / PAGE_SIZE));
	}

	const podiumKey = $derived(
		`${podiumSlots[0]?.id ?? '∅'}-${podiumSlots[1]?.id ?? '∅'}-${podiumSlots[2]?.id ?? '∅'}`
	);
	const worldPodiumKey = $derived(
		`${worldPodiumSlots[0]?.id ?? '∅'}-${worldPodiumSlots[1]?.id ?? '∅'}-${worldPodiumSlots[2]?.id ?? '∅'}`
	);
</script>

<svelte:window onkeydown={goHomeOnEscape} />

<main class="rank-page">
	<BackToHomeButton />
	<div class="rank-body">
		<header class="rank-head">
			<h1>{tr($locale, 'rank.title')}</h1>
			<p class="sub">
				{activeTab === 'my' ? tr($locale, 'rank.subMy') : tr($locale, 'rank.subWorld')}
			</p>
			<div class="rank-tabs" role="tablist" aria-label="Rankings">
				<button
					type="button"
					class="rank-tab"
					role="tab"
					aria-selected={activeTab === 'my'}
					data-active={activeTab === 'my' ? 'true' : undefined}
					onclick={() => onTabChange('my')}
				>
					{tr($locale, 'rank.tabMy')}
				</button>
				<button
					type="button"
					class="rank-tab"
					role="tab"
					aria-selected={activeTab === 'world'}
					data-active={activeTab === 'world' ? 'true' : undefined}
					onclick={() => onTabChange('world')}
				>
					{tr($locale, 'rank.tabWorld')}
				</button>
			</div>
		</header>

		{#if activeTab === 'my'}
			{#if loadingMy}
				<div class="rank-panel rank-panel--loading">
					<p class="loading">{tr($locale, 'rank.loading')}</p>
				</div>
			{:else}
				<div class="rank-panel">
					<section class="podium-section" aria-label={tr($locale, 'rank.podiumAria')}>
						{#if sorted.length === 0}
							<p class="empty-podium">{tr($locale, 'rank.emptyPodium')}</p>
						{:else}
							{#key podiumKey}
								<RankPodium podiumRecords={podiumSlots} />
							{/key}
						{/if}
					</section>

					<section class="list-section" aria-label={tr($locale, 'rank.listAria')}>
						<h2 class="list-title">{tr($locale, 'rank.listTitle')}</h2>
						{#if sorted.length === 0}
							<p class="empty-list">{tr($locale, 'rank.emptyList')}</p>
						{:else}
							<div class="table-wrap bout-scrollbar">
								<table class="rank-table">
									<thead>
										<tr>
											<th class="col-rank">{tr($locale, 'rank.thRank')}</th>
											<th class="col-icon">{tr($locale, 'rank.thMech')}</th>
											<th class="col-name">{tr($locale, 'rank.thName')}</th>
											<th class="col-num">{tr($locale, 'rank.thTotal')}</th>
											<th class="col-num">{tr($locale, 'rank.thLevel')}</th>
											<th class="col-time">{tr($locale, 'rank.thSurvival')}</th>
											<th class="col-num">{tr($locale, 'rank.thBossScore')}</th>
											<th class="col-num">{tr($locale, 'rank.thLevelScore')}</th>
											<th class="col-num">{tr($locale, 'rank.thTimeScore')}</th>
											<th class="col-date">{tr($locale, 'rank.thDate')}</th>
										</tr>
									</thead>
									<tbody>
										{#each pageSlice as row, i (row.id)}
											{@const rank = (listPage - 1) * PAGE_SIZE + i + 1}
											<tr>
												<td class="col-rank"><strong>{rank}</strong></td>
												<td class="col-icon">
													<span
														class="mech-ico"
														title={mechShopLine($locale, row.mechBase, 'name')}
														>{MECH_ICON[row.mechBase]}</span
													>
												</td>
												<td class="col-name">{mechShopLine($locale, row.mechBase, 'name')}</td>
												<td class="col-num mono">{row.scoreTotal.toLocaleString(dateLoc)}</td>
												<td class="col-num">{row.level}</td>
												<td class="col-time mono">{fmtTime(row.survivalTime)}</td>
												<td class="col-num mono">{row.scoreBoss.toLocaleString(dateLoc)}</td>
												<td class="col-num mono">{row.scoreLevel.toLocaleString(dateLoc)}</td>
												<td class="col-num mono">{row.scoreTime.toLocaleString(dateLoc)}</td>
												<td class="col-date">{fmtDate(row.playedAt)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<nav class="pager" aria-label={tr($locale, 'rank.pagerAria')}>
								<button
									type="button"
									class="pg-btn"
									disabled={listPage <= 1}
									onclick={() => {
										listPage = Math.max(1, listPage - 1);
									}}>{tr($locale, 'rank.prev')}</button>
								<span class="pg-info">{listPage} / {totalPages}</span>
								<button
									type="button"
									class="pg-btn"
									disabled={listPage >= totalPages}
									onclick={() => {
										listPage = Math.min(totalPages, listPage + 1);
									}}>{tr($locale, 'rank.next')}</button>
							</nav>
						{/if}
					</section>
				</div>
			{/if}
		{:else if worldLoading}
			<div class="rank-panel rank-panel--loading">
				<p class="loading">{tr($locale, 'rank.worldLoading')}</p>
			</div>
		{:else}
			<div class="rank-panel">
				{#if worldErr}
					<p class="world-err world-err--top" role="alert">{worldErr}</p>
				{:else}
					<section class="podium-section" aria-label={tr($locale, 'rank.podiumAria')}>
						{#if worldRows.length === 0}
							<p class="empty-podium">{tr($locale, 'rank.worldEmpty')}</p>
						{:else}
							{#key worldPodiumKey}
								<RankPodium podiumRecords={worldPodiumSlots} />
							{/key}
						{/if}
					</section>
				{/if}

				<section class="list-section" aria-label={tr($locale, 'rank.listAria')}>
					<h2 class="list-title">{tr($locale, 'rank.tabWorld')}</h2>
					<div class="world-my-bar">
						{#if myUserId === null}
							<p class="world-my-bar__line">{tr($locale, 'rank.worldMyRankGuest')}</p>
						{:else if myWorldRankResolved !== null}
							<p class="world-my-bar__line world-my-bar__line--split">
								<span class="world-my-bar__rank">
									<span class="world-my-bar__label">{tr($locale, 'rank.worldMyRankLabel')}</span>
									<strong class="world-my-bar__value"
										>{tr($locale, 'rank.worldMyRankValue', {
											rank: myWorldRankResolved
										})}</strong
									>
								</span>
								<button
									type="button"
									class="world-my-bar__jump"
									disabled={!canJumpToMyWorldRank}
									title={canJumpToMyWorldRank
										? ''
										: tr($locale, 'rank.worldJumpDisabledTitle')}
									onclick={jumpToMyWorldRow}
								>
									{tr($locale, 'rank.worldJumpToMe')}
								</button>
							</p>
						{:else if myWorldRankPending}
							<p class="world-my-bar__line">
								<span class="world-my-bar__label">{tr($locale, 'rank.worldMyRankLabel')}</span>
								<strong class="world-my-bar__value">{tr($locale, 'rank.worldMyRankLoading')}</strong>
							</p>
						{:else}
							<p class="world-my-bar__line">{tr($locale, 'rank.worldMyRankNone')}</p>
						{/if}
					</div>
					{#if !worldErr && worldRows.length === 0}
						<p class="empty-list">{tr($locale, 'rank.worldEmpty')}</p>
					{:else if !worldErr && worldRows.length > 0}
						<div class="table-wrap bout-scrollbar">
							<table class="rank-table">
								<thead>
									<tr>
										<th class="col-rank">{tr($locale, 'rank.thRank')}</th>
										<th class="col-user">{tr($locale, 'rank.thPlayer')}</th>
										<th class="col-icon">{tr($locale, 'rank.thMech')}</th>
										<th class="col-name">{tr($locale, 'rank.thName')}</th>
										<th class="col-num">{tr($locale, 'rank.thTotal')}</th>
										<th class="col-num">{tr($locale, 'rank.thLevel')}</th>
										<th class="col-time">{tr($locale, 'rank.thSurvival')}</th>
										<th class="col-num">{tr($locale, 'rank.thBossScore')}</th>
										<th class="col-num">{tr($locale, 'rank.thLevelScore')}</th>
										<th class="col-num">{tr($locale, 'rank.thTimeScore')}</th>
										<th class="col-date">{tr($locale, 'rank.thDate')}</th>
									</tr>
								</thead>
								<tbody>
									{#each worldPageSlice as row (row.run_id)}
										{@const rec = worldLeaderboardRowToRankRecord(row)}
										<tr
											class:row--me={myUserId !== null && row.user_id === myUserId}
										>
											<td class="col-rank"><strong>{row.place}</strong></td>
											<td class="col-user">
												<div
													class="player-cell"
													aria-label="{providerLabel(row.auth_provider)} · {row.login_id}"
												>
													<PlayerAvatar
														src={row.avatar_url}
														initial={row.login_id || '?'}
														alt=""
													/>
													<div class="player-cell__text">
														<span class="player-provider">{providerLabel(row.auth_provider)}</span>
														<span class="player-login mono" title={row.login_id}>{row.login_id}</span>
														{#if myUserId !== null && row.user_id === myUserId}
															<span class="you-pill">{tr($locale, 'rank.youBadge')}</span>
														{/if}
													</div>
												</div>
											</td>
											<td class="col-icon">
												<span
													class="mech-ico"
													title={mechShopLine($locale, rec.mechBase, 'name')}
													>{MECH_ICON[rec.mechBase]}</span
												>
											</td>
											<td class="col-name">{mechShopLine($locale, rec.mechBase, 'name')}</td>
											<td class="col-num mono">{row.score_total.toLocaleString(dateLoc)}</td>
											<td class="col-num">{row.level}</td>
											<td class="col-time mono">{fmtTime(row.survival_time)}</td>
											<td class="col-num mono">{row.score_boss.toLocaleString(dateLoc)}</td>
											<td class="col-num mono">{row.score_level.toLocaleString(dateLoc)}</td>
											<td class="col-num mono">{row.score_time.toLocaleString(dateLoc)}</td>
											<td class="col-date">{fmtDate(rec.playedAt)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<nav class="pager" aria-label={tr($locale, 'rank.pagerAria')}>
							<button
								type="button"
								class="pg-btn"
								disabled={worldPage <= 1}
								onclick={() => {
									worldPage = Math.max(1, worldPage - 1);
								}}>{tr($locale, 'rank.prev')}</button>
							<span class="pg-info">{worldPage} / {worldTotalPages}</span>
							<button
								type="button"
								class="pg-btn"
								disabled={worldPage >= worldTotalPages}
								onclick={() => {
									worldPage = Math.min(worldTotalPages, worldPage + 1);
								}}>{tr($locale, 'rank.next')}</button>
						</nav>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</main>

<style>
	.rank-page {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100dvh;
		max-height: 100dvh;
		min-height: 0;
		overflow: hidden;
		padding: clamp(0.75rem, 2.5vw, 1.75rem);
		padding-top: clamp(2.75rem, 8vw, 3.25rem);
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #e8f4ff;
		background: radial-gradient(ellipse 120% 80% at 50% 0%, #0c1830 0%, #05060f 45%, #020308 100%);
	}

	.rank-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 56rem;
		margin: 0 auto;
		overflow: hidden;
	}

	.rank-tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	.rank-tab {
		padding: 0.5rem 1.1rem;
		border-radius: 999px;
		border: 1px solid rgba(0, 160, 220, 0.35);
		background: rgba(0, 24, 48, 0.55);
		color: rgba(160, 210, 240, 0.9);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.rank-tab[data-active] {
		border-color: rgba(0, 220, 255, 0.65);
		background: rgba(0, 56, 96, 0.75);
		color: #e8ffff;
		box-shadow: 0 0 18px rgba(0, 180, 255, 0.22);
	}

	.rank-tab:not([data-active]):hover {
		border-color: rgba(0, 200, 255, 0.45);
		color: #d8f4ff;
	}

	.rank-panel {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.rank-panel--loading {
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 12rem;
	}

	.world-err {
		margin: 0;
		max-width: 28rem;
		text-align: center;
		font-size: 0.82rem;
		line-height: 1.55;
		color: rgba(255, 180, 160, 0.95);
	}

	.world-err--top {
		flex-shrink: 0;
		width: 100%;
		max-width: none;
		margin-bottom: 0.65rem;
		padding: 0.65rem 0.85rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 120, 100, 0.35);
		background: rgba(40, 12, 8, 0.45);
		text-align: left;
	}

	.world-my-bar {
		flex-shrink: 0;
		width: 100%;
		margin-bottom: 0.55rem;
		padding: 0.55rem 0.65rem;
		border-radius: 10px;
		border: 1px solid rgba(0, 140, 200, 0.28);
		background: rgba(0, 20, 44, 0.55);
	}

	.world-my-bar__line {
		margin: 0;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		font-size: 0.78rem;
		color: rgba(170, 210, 240, 0.92);
		line-height: 1.45;
	}

	.world-my-bar__line--split {
		justify-content: space-between;
		align-items: center;
	}

	.world-my-bar__rank {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem 0.5rem;
		min-width: 0;
	}

	.world-my-bar__label {
		font-weight: 700;
		letter-spacing: 0.06em;
		color: rgba(140, 200, 235, 0.88);
	}

	.world-my-bar__value {
		font-size: 0.95rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		color: #e8f8ff;
		text-shadow: 0 0 14px rgba(0, 200, 255, 0.25);
	}

	.world-my-bar__jump {
		padding: 0.4rem 0.85rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 200, 255, 0.4);
		background: rgba(0, 48, 88, 0.75);
		color: #c8ecff;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		cursor: pointer;
		white-space: nowrap;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			opacity 0.15s ease;
	}

	.world-my-bar__jump:not(:disabled):hover {
		border-color: rgba(0, 240, 255, 0.55);
		color: #f0fcff;
	}

	.world-my-bar__jump:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.rank-head {
		flex-shrink: 0;
		width: 100%;
		margin: 0 auto 0.85rem;
		text-align: center;
	}

	.rank-head h1 {
		margin: 0 0 0.35rem;
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: 900;
		letter-spacing: 0.12em;
		color: #7cf0ff;
		text-shadow: 0 0 24px rgba(0, 200, 255, 0.35);
	}

	.sub {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(180, 210, 235, 0.75);
		line-height: 1.45;
	}

	.loading {
		margin: 0;
		text-align: center;
		color: rgba(120, 180, 220, 0.85);
	}

	.podium-section {
		flex: 0 1 auto;
		min-height: 0;
		width: 100%;
		margin: 0 0 0.65rem;
		max-height: min(36vh, 280px);
		overflow: hidden;
	}

	/* 뷰포트 안에 맞추기 — 시상대 WebGL 영역이 본문 스크롤을 밀어내지 않도록 */
	.podium-section :global(.podium-host) {
		box-sizing: border-box;
		min-height: 0 !important;
		max-height: min(36vh, 280px);
	}

	.empty-podium {
		text-align: center;
		padding: 2rem 1rem;
		color: rgba(160, 200, 230, 0.8);
		font-size: 0.88rem;
		line-height: 1.5;
		border: 1px dashed rgba(0, 160, 220, 0.25);
		border-radius: 12px;
		background: rgba(0, 20, 40, 0.35);
	}

	.list-section {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		margin: 0;
		overflow: hidden;
	}

	.list-title {
		flex-shrink: 0;
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: rgba(150, 200, 230, 0.95);
	}

	.empty-list {
		flex-shrink: 0;
		color: rgba(160, 200, 230, 0.75);
		font-size: 0.85rem;
	}

	.table-wrap {
		flex: 1;
		min-height: 0;
		overflow: auto;
		-webkit-overflow-scrolling: touch;
		border-radius: 10px;
		border: 1px solid rgba(0, 140, 200, 0.28);
		background: rgba(0, 12, 28, 0.55);
		box-shadow: inset 0 0 24px rgba(0, 60, 100, 0.2);
	}

	.rank-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}

	.rank-table th,
	.rank-table td {
		padding: 0.55rem 0.45rem;
		text-align: left;
		border-bottom: 1px solid rgba(0, 80, 120, 0.35);
	}

	.rank-table th {
		position: sticky;
		top: 0;
		z-index: 1;
		color: rgba(160, 210, 255, 0.85);
		font-weight: 600;
		letter-spacing: 0.04em;
		background: rgba(0, 40, 70, 0.92);
		white-space: nowrap;
		box-shadow: 0 1px 0 rgba(0, 80, 120, 0.35);
	}

	.rank-table tbody tr:hover {
		background: rgba(0, 80, 140, 0.25);
	}

	.col-rank {
		width: 2.5rem;
		text-align: center;
	}

	.col-user {
		min-width: 10rem;
		max-width: 14rem;
		vertical-align: middle;
	}

	.player-cell {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.player-cell__text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.12rem;
		min-width: 0;
	}

	.player-provider {
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(120, 200, 255, 0.95);
	}

	.player-login {
		display: block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.68rem;
		color: rgba(190, 215, 240, 0.95);
	}

	.you-pill {
		display: inline-block;
		margin-top: 0.15rem;
		padding: 0.12rem 0.38rem;
		border-radius: 4px;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		vertical-align: middle;
		color: #0a1520;
		background: linear-gradient(180deg, #7cf0ff, #3aa8cc);
	}

	.rank-table tbody tr.row--me {
		background: rgba(0, 100, 160, 0.28);
		box-shadow: inset 0 0 0 1px rgba(0, 200, 255, 0.2);
	}
	.col-icon {
		width: 2.25rem;
		text-align: center;
	}
	.col-name {
		min-width: 5rem;
	}
	.col-num {
		text-align: right;
		white-space: nowrap;
	}
	.col-time {
		text-align: center;
		white-space: nowrap;
	}
	.col-date {
		white-space: nowrap;
		color: rgba(180, 210, 235, 0.75);
	}

	.mono {
		font-variant-numeric: tabular-nums;
		font-family: ui-monospace, monospace;
	}

	.mech-ico {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 8px;
		background: rgba(0, 60, 100, 0.45);
		border: 1px solid rgba(0, 180, 255, 0.25);
		font-size: 1rem;
		line-height: 1;
	}

	.pager {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 0.65rem;
		padding-bottom: 0.15rem;
	}

	.pg-btn {
		padding: 0.45rem 1rem;
		border-radius: 6px;
		border: 1px solid rgba(0, 200, 255, 0.35);
		background: rgba(0, 28, 52, 0.75);
		color: #b8ecff;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}
	.pg-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.pg-btn:not(:disabled):hover {
		border-color: rgba(0, 240, 255, 0.55);
		color: #e8ffff;
	}

	.pg-info {
		font-size: 0.78rem;
		color: rgba(180, 210, 235, 0.75);
		font-variant-numeric: tabular-nums;
	}
</style>
