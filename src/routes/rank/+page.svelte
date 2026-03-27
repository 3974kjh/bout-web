<script lang="ts">
	import { onMount } from 'svelte';
	import BackToHomeButton from '$lib/components/BackToHomeButton.svelte';
	import RankPodium from '$lib/components/rank/RankPodium.svelte';
	import { MECH_SHOP_INFO } from '$lib/game/shopSettings';
	import { readRankRecords, type RankRunRecord } from '$lib/storage/rankIndexedDb';
	import type { MechBase } from '$lib/domain/types';

	const PAGE_SIZE = 20;

	const MECH_ICON: Record<MechBase, string> = {
		hypersuit: '🛡',
		'azonas-v': '⚡',
		geren: '🧱',
		expressive: '✦',
		soldier: '🎖'
	};

	let records = $state<RankRunRecord[]>([]);
	let page = $state(1);
	let loading = $state(true);

	const sorted = $derived([...records].sort((a, b) => b.scoreTotal - a.scoreTotal || b.playedAt - a.playedAt));

	const topThree = $derived(sorted.slice(0, 3));
	/** 시상대 좌→중→우: 2등, 1등, 3등 */
	const podiumSlots = $derived<[RankRunRecord | null, RankRunRecord | null, RankRunRecord | null]>([
		topThree[1] ?? null,
		topThree[0] ?? null,
		topThree[2] ?? null
	]);

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)));
	const pageSlice = $derived(sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

	$effect(() => {
		if (page > totalPages) page = totalPages;
	});

	onMount(() => {
		void readRankRecords().then((r) => {
			records = r;
			loading = false;
		});
	});

	function fmtTime(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function fmtDate(ts: number): string {
		try {
			return new Date(ts).toLocaleString('ko-KR', {
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '—';
		}
	}

	const podiumKey = $derived(
		`${podiumSlots[0]?.id ?? '∅'}-${podiumSlots[1]?.id ?? '∅'}-${podiumSlots[2]?.id ?? '∅'}`
	);
</script>

<main class="rank-page">
	<BackToHomeButton />
	<header class="rank-head">
		<h1>기록 랭킹</h1>
		<p class="sub">게임 오버 시 기록이 저장됩니다. 최대 2000건까지 보관됩니다.</p>
	</header>

	{#if loading}
		<p class="loading">불러오는 중…</p>
	{:else}
		<section class="podium-section" aria-label="시상대">
			{#if sorted.length === 0}
				<p class="empty-podium">아직 기록이 없습니다. 작전을 한 번 끝내면 여기에 표시됩니다.</p>
			{:else}
				{#key podiumKey}
					<RankPodium podiumRecords={podiumSlots} />
				{/key}
				<div class="podium-labels" aria-hidden="true">
					<span class="pl pl-s">2위</span>
					<span class="pl pl-g">1위</span>
					<span class="pl pl-b">3위</span>
				</div>
			{/if}
		</section>

		<section class="list-section" aria-label="상세 기록">
			<h2 class="list-title">상세 기록</h2>
			{#if sorted.length === 0}
				<p class="empty-list">목록이 비어 있습니다.</p>
			{:else}
				<div class="table-wrap">
					<table class="rank-table">
						<thead>
							<tr>
								<th class="col-rank">순위</th>
								<th class="col-icon">기체</th>
								<th class="col-name">명칭</th>
								<th class="col-num">총점</th>
								<th class="col-num">레벨</th>
								<th class="col-time">생존</th>
								<th class="col-num">보스점수</th>
								<th class="col-num">레벨점수</th>
								<th class="col-num">시간점수</th>
								<th class="col-date">일시</th>
							</tr>
						</thead>
						<tbody>
							{#each pageSlice as row, i}
								{@const rank = (page - 1) * PAGE_SIZE + i + 1}
								<tr>
									<td class="col-rank"><strong>{rank}</strong></td>
									<td class="col-icon">
										<span class="mech-ico" title={MECH_SHOP_INFO[row.mechBase].name}
											>{MECH_ICON[row.mechBase]}</span
										>
									</td>
									<td class="col-name">{MECH_SHOP_INFO[row.mechBase].name}</td>
									<td class="col-num mono">{row.scoreTotal.toLocaleString('ko-KR')}</td>
									<td class="col-num">{row.level}</td>
									<td class="col-time mono">{fmtTime(row.survivalTime)}</td>
									<td class="col-num mono">{row.scoreBoss.toLocaleString('ko-KR')}</td>
									<td class="col-num mono">{row.scoreLevel.toLocaleString('ko-KR')}</td>
									<td class="col-num mono">{row.scoreTime.toLocaleString('ko-KR')}</td>
									<td class="col-date">{fmtDate(row.playedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<nav class="pager" aria-label="페이지">
					<button
						type="button"
						class="pg-btn"
						disabled={page <= 1}
						onclick={() => { page = Math.max(1, page - 1); }}
					>이전</button>
					<span class="pg-info">{page} / {totalPages}</span>
					<button
						type="button"
						class="pg-btn"
						disabled={page >= totalPages}
						onclick={() => { page = Math.min(totalPages, page + 1); }}
					>다음</button>
				</nav>
			{/if}
		</section>
	{/if}
</main>

<style>
	.rank-page {
		min-height: 100vh;
		overflow-x: hidden;
		padding: clamp(1rem, 3vw, 2rem);
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #e8f4ff;
		background: radial-gradient(ellipse 120% 80% at 50% 0%, #0c1830 0%, #05060f 45%, #020308 100%);
	}

	.rank-head {
		max-width: 56rem;
		margin: 0 auto 1.5rem;
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
		text-align: center;
		color: rgba(120, 180, 220, 0.85);
	}

	.podium-section {
		max-width: 56rem;
		margin: 0 auto 2rem;
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

	.podium-labels {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
		margin-top: 0.5rem;
		text-align: center;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.2em;
		color: rgba(160, 210, 255, 0.75);
	}

	.pl-g {
		color: #ffd54a;
		font-size: 0.78rem;
	}
	.pl-s {
		color: #c0d0e8;
	}
	.pl-b {
		color: #d4a574;
	}

	.list-section {
		max-width: 56rem;
		margin: 0 auto;
	}

	.list-title {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: rgba(150, 200, 230, 0.95);
	}

	.empty-list {
		color: rgba(160, 200, 230, 0.75);
		font-size: 0.85rem;
	}

	.table-wrap {
		overflow-x: auto;
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
		color: rgba(160, 210, 255, 0.85);
		font-weight: 600;
		letter-spacing: 0.04em;
		background: rgba(0, 40, 70, 0.45);
		white-space: nowrap;
	}

	.rank-table tbody tr:hover {
		background: rgba(0, 80, 140, 0.25);
	}

	.col-rank {
		width: 2.5rem;
		text-align: center;
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
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 1rem;
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
