<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { playUiBossWarning, playUiModalOpen } from '$lib/audio/sfx';
	import { EventBus } from '$lib/game/bridge/EventBus';
	import {
		getUpgradePickInfo,
		rarityGradePoints,
		type UpgradeCardInfo
	} from '$lib/game/systems/UpgradeSystem';
	import { computeRunScore, VICTORY_SURVIVAL_SECONDS } from '$lib/game/constants/GameConfig';
	import { getShopSettingsForGame, refreshShopSettingsForGame } from '$lib/game/shopGameCache';
	import { appendRankRunRecord } from '$lib/storage/rankIndexedDb';
	import AudioSettingsModal from '$lib/components/AudioSettingsModal.svelte';
	import HudEvoMiniPreview from '$lib/components/HUD/HudEvoMiniPreview.svelte';
	import type { MechBase } from '$lib/domain/types';

	const MECH_BASES: MechBase[] = [
		'hypersuit',
		'azonas-v',
		'geren',
		'expressive',
		'soldier'
	];
	function coerceMechBase(x: unknown): MechBase {
		return typeof x === 'string' && (MECH_BASES as readonly string[]).includes(x)
			? (x as MechBase)
			: 'hypersuit';
	}

	// ── 미니맵 ──────────────────────────────────────────────────────────────────
	let minimapCanvas: HTMLCanvasElement | undefined = $state(undefined);
	const MMAP_SIZE = 160;

	// ── 캐릭터 진화 프리뷰 (정비소 기체 · Three.js) ────────────────────────────
	let mechBase = $state<MechBase>(getShopSettingsForGame().mechBase);

	interface MinimapData {
		player: { x: number; z: number; fx: number; fz: number };
		monsters: { x: number; z: number; isBoss: boolean }[];
		bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
		viewport: { x: number; z: number; halfW: number; halfD: number };
		loot?: { kind: 'health' | 'card'; x: number; z: number }[];
	}

	function drawMinimap(data: MinimapData): void {
		if (!minimapCanvas) return;
		const ctx = minimapCanvas.getContext('2d');
		if (!ctx) return;

		const { bounds, player, monsters, viewport, loot = [] } = data;
		const mapW = bounds.maxX - bounds.minX;
		const mapD = bounds.maxZ - bounds.minZ;
		const scaleX = MMAP_SIZE / mapW;
		const scaleZ = MMAP_SIZE / mapD;

		const wx = (wx: number) => (wx - bounds.minX) * scaleX;
		const wz = (wz: number) => (wz - bounds.minZ) * scaleZ;

		// 배경
		ctx.fillStyle = 'rgba(10, 12, 20, 0.88)';
		ctx.fillRect(0, 0, MMAP_SIZE, MMAP_SIZE);

		// 뷰포트 직사각형
		const vx0 = wx(viewport.x - viewport.halfW);
		const vz0 = wz(viewport.z - viewport.halfD);
		const vw  = viewport.halfW * 2 * scaleX;
		const vd  = viewport.halfD * 2 * scaleZ;
		ctx.strokeStyle = 'rgba(255,255,255,0.25)';
		ctx.lineWidth = 1;
		ctx.strokeRect(vx0, vz0, vw, vd);

		// 맵 아이템 (체력 포션 / 카드 보급)
		for (const L of loot) {
			const lx = wx(L.x);
			const lz = wz(L.z);
			if (L.kind === 'health') {
				ctx.beginPath();
				ctx.arc(lx, lz, 2.4, 0, Math.PI * 2);
				ctx.fillStyle = '#33ff99';
				ctx.fill();
				ctx.strokeStyle = 'rgba(255,255,255,0.5)';
				ctx.lineWidth = 0.6;
				ctx.stroke();
			} else {
				ctx.fillStyle = '#aa66ff';
				ctx.fillRect(lx - 2.5, lz - 2.5, 5, 5);
				ctx.strokeStyle = 'rgba(255,255,255,0.45)';
				ctx.lineWidth = 0.6;
				ctx.strokeRect(lx - 2.5, lz - 2.5, 5, 5);
			}
		}

		// 적 (빨간 점)
		for (const m of monsters) {
			const mx = wx(m.x), mz = wz(m.z);
			ctx.beginPath();
			ctx.arc(mx, mz, m.isBoss ? 4 : 2.5, 0, Math.PI * 2);
			ctx.fillStyle = m.isBoss ? '#ff4400' : '#ff2222';
			ctx.fill();
		}

		// 플레이어 (밝은 삼각형 방향 표시)
		const px = wx(player.x), pz = wz(player.z);
		const angle = Math.atan2(player.fx, -player.fz);
		ctx.save();
		ctx.translate(px, pz);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(0, -5);
		ctx.lineTo(3.5, 4);
		ctx.lineTo(-3.5, 4);
		ctx.closePath();
		ctx.fillStyle = '#00eeff';
		ctx.fill();
		ctx.restore();

		// 테두리
		ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(0, 0, MMAP_SIZE, MMAP_SIZE);
	}

	// ── 기본 스탯 ───────────────────────────────────────────────────────────────
	let hp     = $state(150);
	let maxHp  = $state(150);

	/** 획득 카드(id별) — 표시 레벨 = 동일 id 선택 시 등급 점수(커먼1/레어2/에픽3) 합 */
	type PickedEntry = { emoji: string; name: string; points: number };
	let pickedById = $state<Record<string, PickedEntry>>({});
	const pickedRows = $derived(
		Object.entries(pickedById)
			.map(([id, v]) => ({ id, emoji: v.emoji, name: v.name, points: v.points }))
			.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
	);

	// ── 생존 시간 / 승리 목표(15분) 카운트다운 ─────────────────────────────────────────────
	let survivalSeconds = $state(0);
	function fmtMMSS(totalSec: number): string {
		const s = Math.max(0, Math.floor(totalSec));
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
	}
	/** 경과는 floor(초), 남은 시간은 ceil(목표−경과)초 — 목표는 VICTORY_SURVIVAL_SECONDS */
	const elapsedWholeSec = $derived(Math.floor(Math.max(0, survivalSeconds)));
	const remainingWholeSec = $derived(
		Math.max(0, Math.ceil(VICTORY_SURVIVAL_SECONDS - survivalSeconds - Number.EPSILON))
	);
	/** 상단 중앙: 목표까지 남은 시간 (20:00 → 00:00) */
	const countdownDisplay = $derived(fmtMMSS(remainingWholeSec));
	/** 경과 생존 시간 */
	const elapsedDisplay = $derived(fmtMMSS(elapsedWholeSec));

	type BossKillKey = 'bear' | 'wolf' | 'dragon' | 'tiger' | 'ironlord';
	type GameOverDetail = {
		victory: boolean;
		survivalTime: number;
		level: number;
		normalKills: number;
		bosses: Record<BossKillKey, number>;
		scoreTotal: number;
		scoreBoss: number;
		scoreLevel: number;
		scoreTime: number;
		waveBossCount: number;
	};
	let killNormal = $state(0);
	let killBosses = $state<Record<BossKillKey, number>>({
		bear: 0,
		wolf: 0,
		dragon: 0,
		tiger: 0,
		ironlord: 0
	});

	// ── 경험치 & 레벨 ───────────────────────────────────────────────────────────
	let level    = $state(1);
	let expProg  = $state(0);

	// ── 알림 & 특수 상태 ─────────────────────────────────────────────────────────
	let bossAlert   = $state(false);
	let bossCleared = $state(false);
	let gameOver    = $state(false);
	let goDetail = $state<GameOverDetail | null>(null);
	let killStreak       = $state(0);
	let killStreakVisible = $state(false);
	let killStreakTimer   = 0;

	// ── 레벨업 / 발판 보급 카드 선택 ─────────────────────────────────────────────
	let showCards = $state(false);
	let cards: UpgradeCardInfo[] = $state([]);
	let levelUpNum = $state(1);
	let cardModalTitle = $state('🌟 LEVEL UP');
	let cardPickHint = $state('카드를 선택하거나 키보드 1 / 2 / 3 를 누르세요');

	// ── ESC 일시정지 ───────────────────────────────────────────────────────────
	let pauseOpen = $state(false);
	let audioSettingsOpen = $state(false);

	let prevPauseOpen = false;
	$effect(() => {
		if (pauseOpen && !prevPauseOpen) playUiModalOpen();
		prevPauseOpen = pauseOpen;
	});

	let prevShowCards = false;
	$effect(() => {
		if (showCards && !prevShowCards) playUiModalOpen();
		prevShowCards = showCards;
	});

	let prevGameOver = false;
	$effect(() => {
		if (gameOver && !prevGameOver) playUiModalOpen();
		prevGameOver = gameOver;
	});

	function togglePause(): void {
		if (gameOver || showCards) return;
		pauseOpen = !pauseOpen;
		EventBus.emit('game-pause-set', { paused: pauseOpen });
	}

	function resumeGame(): void {
		audioSettingsOpen = false;
		pauseOpen = false;
		EventBus.emit('game-pause-set', { paused: false });
	}

	function goMenu(): void {
		audioSettingsOpen = false;
		pauseOpen = false;
		EventBus.emit('game-pause-set', { paused: false });
		goto('/');
	}

	// ── 파생 ────────────────────────────────────────────────────────────────────
	const hpPct = $derived(maxHp > 0 ? (hp / maxHp) * 100 : 0);
	

	// ── 타이머 ──────────────────────────────────────────────────────────────────
	let bossAlertTimer   = 0;
	let bossClearedTimer = 0;

	// ── 키보드: ESC 일시정지 / 카드 선택 ────────────────────────────────────────
	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			if (gameOver || showCards) return;
			if (audioSettingsOpen) {
				e.preventDefault();
				audioSettingsOpen = false;
				return;
			}
			e.preventDefault();
			togglePause();
			return;
		}
		if (!showCards) return;
		if (e.key === '1') selectCard(0);
		else if (e.key === '2') selectCard(1);
		else if (e.key === '3') selectCard(2);
	}

	function selectCard(idx: number): void {
		if (!cards[idx]) return;
		showCards = false;
		EventBus.emit('upgrade-chosen', { id: cards[idx].id });
	}

	// ── EventBus 핸들러 ─────────────────────────────────────────────────────────
	function onHpUpdate(...args: unknown[]): void {
		const d = args[0] as { hp: number; maxHp: number };
		hp = d.hp; maxHp = d.maxHp;
	}
	function onUpgradePicked(...args: unknown[]): void {
		const { id } = args[0] as { id: string };
		const info = getUpgradePickInfo(id);
		if (!info) return;
		const add = rarityGradePoints(info.rarity);
		const cur = pickedById[id];
		pickedById = {
			...pickedById,
			[id]: cur
				? { emoji: cur.emoji, name: cur.name, points: cur.points + add }
				: { emoji: info.emoji, name: info.name, points: add }
		};
	}
	function onMonsterCount(..._args: unknown[]): void {
		// 적 수 표시 제거 — 이벤트만 수신
	}
	function onSurvivalTimeUpdate(...args: unknown[]): void {
		survivalSeconds = (args[0] as { seconds: number }).seconds;
	}
	function onKillStatsUpdate(...args: unknown[]): void {
		const d = args[0] as { normal: number; bosses: Record<BossKillKey, number> };
		killNormal = d.normal;
		killBosses = { ...d.bosses };
	}
	function onExpUpdate(...args: unknown[]): void {
		const d = args[0] as { level: number; progress: number };
		level = d.level;
		expProg = d.progress;
	}
	function onLevelUp(...args: unknown[]): void {
		const d = args[0] as { level: number; cards: UpgradeCardInfo[] };
		levelUpNum = d.level;
		cards = d.cards;
		cardModalTitle = `🌟 LEVEL UP — Lv.${d.level}`;
		cardPickHint = '카드를 선택하거나 키보드 1 / 2 / 3 를 누르세요';
		showCards = true;
	}
	function onFieldCardOffer(...args: unknown[]): void {
		const d = args[0] as { cards: UpgradeCardInfo[] };
		cards = d.cards;
		cardModalTitle = '📦 보급 캐시';
		cardPickHint = '고지대 보급 — 1 · 2 · 3 키로 카드 1장을 선택하세요';
		showCards = true;
	}
	function onBossIncoming(): void {
		playUiBossWarning();
		bossAlert = true; bossCleared = false;
		clearTimeout(bossAlertTimer);
		bossAlertTimer = window.setTimeout(() => { bossAlert = false; }, 4000);
	}
	function onBossCleared(): void {
		bossAlert = false; bossCleared = true;
		clearTimeout(bossClearedTimer);
		bossClearedTimer = window.setTimeout(() => { bossCleared = false; }, 3500);
	}
	function onGameOver(...args: unknown[]): void {
		const d = args[0] as
			| {
					victory?: boolean;
					survivalTime?: number;
					bossCount?: number;
					level?: number;
					normalKills?: number;
					bosses?: Record<BossKillKey, number>;
					scoreTotal?: number;
					scoreBoss?: number;
					scoreLevel?: number;
					scoreTime?: number;
					mechBase?: unknown;
			  }
			| undefined;
		const surv = Math.floor(d?.survivalTime ?? survivalSeconds);
		const lv = d?.level ?? level;
		const norm = d?.normalKills ?? killNormal;
		const bosses: Record<BossKillKey, number> = d?.bosses
			? { ...d.bosses }
			: { ...killBosses };
		const sc =
			d?.scoreTotal != null
				? {
						total: d.scoreTotal,
						partBoss: d.scoreBoss ?? 0,
						partLevel: d.scoreLevel ?? 0,
						partTime: d.scoreTime ?? 0
					}
				: computeRunScore({ level: lv, survivalSeconds: surv, bossKills: bosses });
		goDetail = {
			victory: d?.victory === true,
			survivalTime: surv,
			level: lv,
			normalKills: norm,
			bosses,
			scoreTotal: sc.total,
			scoreBoss: sc.partBoss,
			scoreLevel: sc.partLevel,
			scoreTime: sc.partTime,
			waveBossCount: d?.bossCount ?? 0
		};
		void appendRankRunRecord({
			mechBase: coerceMechBase(d?.mechBase),
			scoreTotal: sc.total,
			scoreBoss: sc.partBoss,
			scoreLevel: sc.partLevel,
			scoreTime: sc.partTime,
			level: lv,
			survivalTime: surv,
			normalKills: norm,
			bossCount: d?.bossCount ?? 0
		});
		gameOver = true;
		pauseOpen = false;
		EventBus.emit('game-pause-set', { paused: false });
	}
	function onMinimapUpdate(...args: unknown[]): void {
		drawMinimap(args[0] as MinimapData);
	}
	function onKillStreak(...args: unknown[]): void {
		killStreak = (args[0] as { streak: number }).streak;
		killStreakVisible = true;
		clearTimeout(killStreakTimer);
		killStreakTimer = window.setTimeout(() => { killStreakVisible = false; }, 2500);
	}

	function restart(): void {
		gameOver = false; bossAlert = false; bossCleared = false; showCards = false;
		pauseOpen = false;
		goDetail = null;
		killNormal = 0;
		killBosses = { bear: 0, wolf: 0, dragon: 0, tiger: 0, ironlord: 0 };
		pickedById = {};
		cardModalTitle = '🌟 LEVEL UP';
		cardPickHint = '카드를 선택하거나 키보드 1 / 2 / 3 를 누르세요';
		EventBus.emit('game-pause-set', { paused: false });
		EventBus.emit('restart-game');
	}

	function goShop(): void {
		void goto('/shop');
	}

	/** IDB 정비소 설정과 HUD 프리뷰 동기화 (첫 진입·재시작 공통) */
	function syncMechBaseFromShop(): void {
		void refreshShopSettingsForGame().then(() => {
			mechBase = coerceMechBase(getShopSettingsForGame().mechBase);
		});
	}

	function onRestartShopSync(): void {
		syncMechBaseFromShop();
	}

	onMount(() => {
		syncMechBaseFromShop();
		EventBus.on('restart-game', onRestartShopSync);
		EventBus.on('hp-update',              onHpUpdate);
		EventBus.on('monster-count-update',   onMonsterCount);
		EventBus.on('survival-time-update',   onSurvivalTimeUpdate);
		EventBus.on('exp-update',             onExpUpdate);
		EventBus.on('level-up',             onLevelUp);
		EventBus.on('field-card-offer',     onFieldCardOffer);
		EventBus.on('boss-incoming',        onBossIncoming);
		EventBus.on('boss-cleared',         onBossCleared);
		EventBus.on('game-over',            onGameOver);
		EventBus.on('minimap-update',       onMinimapUpdate);
		EventBus.on('kill-stats-update',   onKillStatsUpdate);
		EventBus.on('kill-streak',          onKillStreak);
		EventBus.on('upgrade-picked',       onUpgradePicked);
		window.addEventListener('keydown', onKeydown);
	});
	onDestroy(() => {
		EventBus.off('restart-game', onRestartShopSync);
		EventBus.off('hp-update',            onHpUpdate);
		EventBus.off('monster-count-update', onMonsterCount);
		EventBus.off('survival-time-update',  onSurvivalTimeUpdate);
		EventBus.off('exp-update',            onExpUpdate);
		EventBus.off('level-up',             onLevelUp);
		EventBus.off('field-card-offer',     onFieldCardOffer);
		EventBus.off('boss-incoming',        onBossIncoming);
		EventBus.off('boss-cleared',         onBossCleared);
		EventBus.off('game-over',            onGameOver);
		EventBus.off('minimap-update',       onMinimapUpdate);
		EventBus.off('kill-stats-update',   onKillStatsUpdate);
		EventBus.off('kill-streak',          onKillStreak);
		EventBus.off('upgrade-picked',       onUpgradePicked);
		window.removeEventListener('keydown', onKeydown);
		clearTimeout(bossAlertTimer);
		clearTimeout(bossClearedTimer);
	});
</script>

<div class="hud">

	<!-- ── HP 위험 비넷 (HP 30% 이하) ─────────────────────────────────────── -->
	{#if hpPct < 30}
		<div class="danger-vignette" style="opacity:{(1 - hpPct / 30) * 0.75};"></div>
	{/if}

	<!-- ── 킬 스트릭 ────────────────────────────────────────────────────────── -->
	{#if killStreakVisible}
		<div class="streak-banner">{killStreak} KILL STREAK!</div>
	{/if}

	<!-- ── 상단 HUD ─────────────────────────────────────────────────────────── -->
	<div class="hud-top">
		<!-- 왼쪽: 캐릭터 진화 프리뷰 -->
		<div class="left-panel">
			<div class="left-panel-main">
				<div class="left-evo-column">
					<div class="evo-hp-block">
						<div class="evo-hp-label">HP</div>
						<div class="evo-hp-values">
							<span class="evo-hp-cur">{hp}</span>
							<span class="evo-hp-sep">/</span>
							<span class="evo-hp-max">{maxHp}</span>
						</div>
					</div>
					<div class="evo-wrap">
						{#key mechBase}
							<HudEvoMiniPreview mechBase={mechBase} level={level} />
						{/key}
						<div class="evo-label">Lv.{level}</div>
					</div>
				</div>
				{#if pickedRows.length > 0}
					<div class="picked-cards-grid" aria-label="획득 업그레이드">
						{#each pickedRows as row (row.id)}
							<span class="card-chip" title="{row.name} · 등급합 Lv.{row.points}">
								<span class="chip-emoji">{row.emoji}</span>
								<span class="chip-lv">Lv.{row.points}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- 가운데: 남은 목표 시간 + 경과 생존 -->
		<div class="center-panel">
			<div class="time-display">{countdownDisplay}</div>
			<div class="time-label">남은 시간</div>
			<div class="time-elapsed-row" aria-label="경과 생존 시간">
				<span class="time-elapsed-label">경과</span>
				<span class="time-elapsed-value">{elapsedDisplay}</span>
			</div>
			<div class="kill-stats" aria-label="처치 통계">
				<div class="kill-stats-boss">
					<span class="ks-head">보스</span>
					<span class="ks-segs">
						<span title="강철 곰">곰 {killBosses.bear}</span>
						<span class="ks-dot">·</span>
						<span title="기계 늑대">늑대 {killBosses.wolf}</span>
						<span class="ks-dot">·</span>
						<span title="철갑 드래곤">용 {killBosses.dragon}</span>
						<span class="ks-dot">·</span>
						<span title="사이버 호랑이">호랑이 {killBosses.tiger}</span>
						<span class="ks-dot">·</span>
						<span title="아이언 로드">로드 {killBosses.ironlord}</span>
					</span>
				</div>
				<div class="kill-stats-norm">일반 몬스터 <strong>{killNormal}</strong></div>
			</div>
		</div>

		<!-- 오른쪽: 미니맵 -->
		<div class="right-panel">
			<div class="minimap-wrap">
				<canvas
					bind:this={minimapCanvas}
					width={MMAP_SIZE}
					height={MMAP_SIZE}
					class="minimap-canvas"
				></canvas>
				<div class="minimap-label">MAP</div>
			</div>
		</div>
	</div>

	<!-- ── 바닥 EXP 바 ──────────────────────────────────────────────────────── -->
	<div class="exp-bar-wrap">
		<div class="exp-bar-fill" style="width:{expProg * 100}%;"></div>
		<span class="exp-label">EXP</span>
	</div>

	<!-- ── BOSS 알림 ────────────────────────────────────────────────────────── -->
	{#if bossAlert}
		<div class="boss-banner"><span class="boss-text">⚠ BOSS INCOMING ⚠</span></div>
	{/if}
	{#if bossCleared}
		<div class="cleared-banner"><span class="cleared-text">BOSS DEFEATED — HP RESTORED!</span></div>
	{/if}

	<!-- ── 일시정지 (ESC) ───────────────────────────────────────────────────── -->
	{#if pauseOpen}
		<div
			class="pause-overlay"
			class:pause-overlay--blocked={audioSettingsOpen}
			role="dialog"
			aria-modal="true"
			aria-labelledby="pause-title"
		>
			<div class="pause-modal">
				<h2 id="pause-title">일시정지</h2>
				<p class="pause-hint">ESC 키로 닫기</p>
				<button
					type="button"
					class="pause-open-audio"
					onclick={() => (audioSettingsOpen = true)}
				>
					<span class="pause-open-audio__icn" aria-hidden="true">
						<svg viewBox="0 0 20 20" width="16" height="16" fill="none">
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
					소리 설정
					<span class="pause-open-audio__chev" aria-hidden="true">›</span>
				</button>
				<div class="pause-actions">
					<button type="button" class="pause-btn primary" onclick={resumeGame}>계속하기</button>
					<button type="button" class="pause-btn" onclick={goMenu}>메뉴로 돌아가기</button>
				</div>
			</div>
		</div>
	{/if}

	<AudioSettingsModal bind:open={audioSettingsOpen} layer="game" />

	<!-- ── 레벨업 카드 선택 ─────────────────────────────────────────────────── -->
	{#if showCards}
		<div class="card-overlay">
			<div class="card-modal">
				<div class="card-title">{cardModalTitle}</div>
				<p class="card-hint">{cardPickHint}</p>
				<div class="card-row">
					{#each cards as card, i (card.id)}
						<button
							class="upgrade-card rarity-{card.rarity}"
							onclick={() => selectCard(i)}
						>
							<div class="card-num">[{i + 1}]</div>
							<div class="card-emoji">{card.emoji}</div>
							<div class="card-name">{card.name}</div>
							<div class="card-desc">{card.description}</div>
							<div class="card-rarity-tag">{card.rarity.toUpperCase()}</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- ── 게임 오버 ──────────────────────────────────────────────────────────── -->
	{#if gameOver && goDetail}
		<div class="overlay">
			<div class="box over go-box" class:go-victory={goDetail.victory}>
				<h2>{goDetail.victory ? '미션 클리어' : 'GAME OVER'}</h2>
				<p class="go-score-line">
					총 점수 <strong class="go-score-total">{goDetail.scoreTotal.toLocaleString('ko-KR')}</strong>
				</p>
				<div class="go-score-grid" aria-label="점수 상세">
					<span class="go-key">보스 기여</span><strong class="go-part">{goDetail.scoreBoss.toLocaleString('ko-KR')}</strong>
					<span class="go-key">레벨 기여</span><strong class="go-part">{goDetail.scoreLevel.toLocaleString('ko-KR')}</strong>
					<span class="go-key">생존 기여</span><strong class="go-part">{goDetail.scoreTime.toLocaleString('ko-KR')}</strong>
				</div>
				<p>
					생존 시간
					<strong
						>{String(Math.floor(goDetail.survivalTime / 60)).padStart(2, '0')}:{String(
							goDetail.survivalTime % 60
						).padStart(2, '0')}</strong
					>
					<span class="go-inline-meta">
						&nbsp;·&nbsp; 달성 레벨 <strong>{goDetail.level}</strong></span
					>
				</p>
				<div class="go-kill-block">
					<div class="go-kill-title">보스 처치 (단계별)</div>
					<ul class="go-kill-list">
						<li><span>강철 곰</span> <strong>{goDetail.bosses.bear}</strong></li>
						<li><span>기계 늑대</span> <strong>{goDetail.bosses.wolf}</strong></li>
						<li><span>철갑 드래곤</span> <strong>{goDetail.bosses.dragon}</strong></li>
						<li><span>사이버 호랑이</span> <strong>{goDetail.bosses.tiger}</strong></li>
						<li><span>아이언 로드</span> <strong>{goDetail.bosses.ironlord}</strong></li>
					</ul>
					<p class="go-norm-line">
						일반 몬스터 처치 <strong>{goDetail.normalKills.toLocaleString('ko-KR')}</strong>
					</p>
					{#if goDetail.waveBossCount > 0}
						<p class="go-wave-hint">(웨이브 난이도 기준 보스 격파 {goDetail.waveBossCount}회)</p>
					{/if}
				</div>
				<div class="go-actions">
					<button type="button" class="go-btn" onclick={restart}>재시작</button>
					<button type="button" class="go-btn go-btn-shop" onclick={goShop}>정비소</button>
				</div>
			</div>
		</div>
	{/if}


</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: #eee;
		z-index: 10;
	}

	/* ── 상단 ── */
	.hud-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 12px 16px;
	}

	.left-panel  {
		min-width: 0;
		max-width: min(420px, 96vw);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.left-panel-main {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 10px;
	}
	.left-evo-column {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
		flex-shrink: 0;
		width: max-content;
		max-width: min(100%, 200px);
	}
	.evo-hp-block {
		background: rgba(0, 12, 28, 0.82);
		border: 1px solid rgba(0, 200, 255, 0.28);
		border-radius: 6px;
		padding: 6px 10px 7px;
		box-shadow: 0 0 10px rgba(0, 100, 180, 0.15);
		box-sizing: border-box;
	}
	.evo-hp-label {
		font-size: 0.52rem;
		font-weight: 800;
		letter-spacing: 0.2em;
		color: rgba(0, 200, 255, 0.65);
		margin-bottom: 2px;
	}
	.evo-hp-values {
		font-variant-numeric: tabular-nums;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.evo-hp-cur { color: #7effb0; text-shadow: 0 0 8px rgba(0, 255, 160, 0.35); }
	.evo-hp-sep { color: rgba(180, 200, 220, 0.55); margin: 0 1px; font-weight: 600; }
	.evo-hp-max { color: rgba(220, 235, 255, 0.88); }

	/* 획득 카드: 5열 × 3행 고정 높이, 초과 시 세로 스크롤 */
	.picked-cards-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		grid-auto-rows: minmax(36px, auto);
		gap: 4px;
		width: 198px;
		flex-shrink: 0;
		max-height: calc(3 * 36px + 2 * 4px);
		overflow-x: hidden;
		overflow-y: auto;
		align-content: start;
		padding: 2px 0;
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
		box-sizing: border-box;
	}
	.card-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 3px 2px;
		min-width: 0;
		font-size: 0.5rem;
		font-weight: 700;
		border-radius: 6px;
		background: rgba(0, 18, 40, 0.9);
		border: 1px solid rgba(0, 200, 255, 0.22);
		color: #ddeeff;
		text-align: center;
		line-height: 1.1;
		pointer-events: auto;
		cursor: default;
	}
	.chip-emoji { font-size: 0.72rem; line-height: 1; }
	.chip-lv {
		font-variant-numeric: tabular-nums;
		color: #88ddff;
		font-size: 0.5rem;
		letter-spacing: 0.02em;
	}
	.center-panel {
		display: flex; flex-direction: column; align-items: center;
		gap: 2px;
		max-width: min(96vw, 360px);
	}
	.kill-stats {
		margin-top: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		font-size: 0.52rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: rgba(180, 210, 235, 0.88);
		line-height: 1.35;
		text-align: center;
	}
	.kill-stats-boss {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: baseline;
		gap: 0 4px;
		max-width: 100%;
	}
	.kill-stats .ks-head {
		color: rgba(255, 140, 80, 0.95);
		font-weight: 800;
		margin-right: 2px;
	}
	.kill-stats .ks-segs {
		display: inline;
		font-variant-numeric: tabular-nums;
	}
	.kill-stats .ks-dot {
		color: rgba(120, 160, 190, 0.55);
		margin: 0 1px;
	}
	.kill-stats-norm {
		color: rgba(160, 200, 230, 0.82);
		font-variant-numeric: tabular-nums;
	}
	.kill-stats-norm strong {
		color: #a8f0ff;
		font-weight: 800;
	}
	.time-display {
		font-size: 2.2rem; font-weight: 900; letter-spacing: 0.12em;
		color: #ffffff;
		text-shadow: 0 0 14px rgba(0,200,255,0.9), 0 0 28px rgba(0,120,255,0.5);
		font-variant-numeric: tabular-nums;
	}
	.time-label {
		font-size: 0.60rem; font-weight: 700; letter-spacing: 0.22em;
		color: rgba(0,200,255,0.75); text-transform: uppercase;
	}
	.time-elapsed-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 1px;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: rgba(170, 205, 230, 0.82);
	}
	.time-elapsed-label {
		opacity: 0.88;
		text-transform: uppercase;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
	}
	.time-elapsed-value {
		font-variant-numeric: tabular-nums;
		color: rgba(230, 248, 255, 0.95);
		font-weight: 800;
	}
	.right-panel { min-width: 180px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }

	/* ── 진화 프리뷰 (너비 = 위 HP 블록과 동일) ── */
	.evo-wrap {
		position: relative;
		width: 100%;
		height: 110px;
		box-sizing: border-box;
		border-radius: 4px;
		background: rgba(0,10,25,0.82);
		border: 1px solid rgba(0,200,255,0.3);
		box-shadow: 0 0 10px rgba(0,150,255,0.2);
		overflow: hidden;
	}
	.evo-label {
		position: absolute; top: 4px; left: 0; right: 0; bottom: auto;
		text-align: center;
		font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em;
		color: #00eeff; text-shadow: 0 0 6px #0099ff;
		pointer-events: none;
	}

	/* ── 일시정지 모달 ── */
	.pause-overlay {
		position: absolute; inset: 0;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0, 8, 20, 0.78);
		pointer-events: auto;
		z-index: 80;
		backdrop-filter: blur(4px);
	}
	/* 소리 설정 모달이 열린 동안 일시정지 레이어가 포인터를 가로채지 않도록 */
	.pause-overlay--blocked {
		pointer-events: none;
	}
	.pause-modal {
		padding: 28px 36px 32px;
		min-width: min(92vw, 300px);
		border-radius: 12px;
		background: linear-gradient(165deg, rgba(15, 25, 45, 0.96), rgba(8, 12, 28, 0.98));
		border: 1px solid rgba(0, 200, 255, 0.35);
		box-shadow: 0 0 32px rgba(0, 120, 200, 0.25);
		text-align: center;
	}
	.pause-modal h2 {
		margin: 0 0 8px;
		font-size: 1.35rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #00ddff;
		text-shadow: 0 0 12px rgba(0, 200, 255, 0.5);
	}
	.pause-hint {
		margin: 0 0 22px;
		font-size: 0.78rem;
		color: rgba(180, 200, 220, 0.75);
	}
	.pause-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.pause-btn {
		padding: 10px 18px;
		font-size: 0.88rem;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		border: 1px solid rgba(100, 150, 190, 0.45);
		background: rgba(0, 0, 0, 0.35);
		color: rgba(200, 215, 235, 0.9);
		transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
	}
	.pause-btn:hover {
		border-color: #6af;
		color: #bff;
	}
	.pause-btn.primary {
		border-color: rgba(0, 200, 255, 0.55);
		background: rgba(0, 60, 90, 0.45);
		color: #00eeff;
	}
	.pause-btn.primary:hover {
		box-shadow: 0 0 16px rgba(0, 200, 255, 0.35);
	}
	.pause-open-audio {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 0 auto 16px;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		color: rgba(120, 210, 255, 0.88);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: rgba(0, 200, 255, 0.35);
		text-underline-offset: 3px;
		transition: color 0.15s;
	}
	.pause-open-audio:hover {
		color: #bff;
		text-decoration-color: rgba(0, 230, 255, 0.55);
	}
	.pause-open-audio__icn {
		display: flex;
		flex-shrink: 0;
		opacity: 0.92;
	}
	.pause-open-audio__chev {
		font-size: 1.05em;
		font-weight: 300;
		opacity: 0.75;
		transform: translateY(-0.5px);
	}

	/* ── 미니맵 ── */
	.minimap-wrap {
		position: relative; width: 160px; height: 160px;
		border-radius: 4px; overflow: hidden;
		box-shadow: 0 0 12px rgba(0,200,255,0.3), 0 0 4px rgba(0,0,0,0.8);
	}
	.minimap-canvas { display: block; width: 160px; height: 160px; }
	.minimap-label {
		position: absolute; bottom: 2px; left: 4px;
		font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em;
		color: rgba(0,200,255,0.5); pointer-events: none;
	}

	/* ── EXP 바 ── */
	.exp-bar-wrap {
		position: absolute; bottom: 0; left: 0; right: 0;
		height: 20px; background: rgba(0,0,0,0.5);
		border-top: 1px solid rgba(0,200,255,0.2);
	}
	.exp-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #0066ff, #00ddff);
		box-shadow: 0 0 8px #00aaff;
		transition: width 0.3s ease-out;
	}
	.exp-label {
		position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
		font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
		color: rgba(255,255,255,0.7); text-shadow: 1px 1px 2px #000;
		pointer-events: none;
	}

	/* ── 레벨업 카드 오버레이 ── */
	.card-overlay {
		position: absolute; inset: 0;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0,0,0,0.72);
		pointer-events: auto;
		backdrop-filter: blur(2px);
	}
	.card-modal {
		display: flex; flex-direction: column; align-items: center; gap: 16px;
		padding: 32px 24px 28px; max-width: 900px; width: 95%;
	}
	.card-title {
		font-size: 2rem; font-weight: 900; letter-spacing: 0.12em;
		color: #ffdd44;
		text-shadow: 0 0 20px #ffaa00, 0 0 40px #ff8800, 2px 2px 4px #000;
		animation: titlePulse 0.9s ease-in-out infinite alternate;
	}
	@keyframes titlePulse { to { text-shadow: 0 0 30px #ffcc00, 0 0 60px #ffaa00, 2px 2px 4px #000; } }
	.card-hint {
		font-size: 0.85rem; color: #aaa; margin: 0;
		text-shadow: 1px 1px 2px #000;
	}
	.card-row {
		display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;
	}
	.upgrade-card {
		width: 230px; padding: 22px 16px;
		display: flex; flex-direction: column; align-items: center; gap: 10px;
		border-radius: 12px; cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s;
		color: #eee; text-align: center;
		font-family: inherit;
	}
	.upgrade-card:hover, .upgrade-card:focus {
		transform: translateY(-6px) scale(1.03);
		outline: none;
	}
	.rarity-common {
		background: linear-gradient(160deg, rgba(40,50,70,0.92), rgba(20,30,50,0.95));
		border: 2px solid rgba(100,180,255,0.45);
		box-shadow: 0 0 16px rgba(80,150,255,0.2);
	}
	.rarity-common:hover  { box-shadow: 0 0 28px rgba(80,150,255,0.6); border-color: #88ccff; }
	.rarity-rare {
		background: linear-gradient(160deg, rgba(50,30,80,0.92), rgba(25,10,55,0.95));
		border: 2px solid rgba(180,100,255,0.55);
		box-shadow: 0 0 20px rgba(150,80,255,0.25);
	}
	.rarity-rare:hover    { box-shadow: 0 0 32px rgba(180,80,255,0.7); border-color: #cc88ff; }
	.rarity-epic {
		background: linear-gradient(160deg, rgba(80,30,10,0.92), rgba(50,10,5,0.95));
		border: 2px solid rgba(255,120,30,0.65);
		box-shadow: 0 0 24px rgba(255,100,20,0.35);
	}
	.rarity-epic:hover    { box-shadow: 0 0 40px rgba(255,120,20,0.8); border-color: #ff9944; }

	.card-num    { font-size: 0.72rem; color: #888; font-weight: 700; letter-spacing: 0.1em; }
	.card-emoji  { font-size: 2.2rem; }
	.card-name   { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.06em; }
	.card-desc   { font-size: 0.82rem; color: #ccc; line-height: 1.4; }
	.card-rarity-tag { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.15em; opacity: 0.6; }

	/* ── BOSS 배너 (뷰포트 높이 상단 1/3 구간의 중앙 ≈ top 16.67%) ── */
	.boss-banner {
		position: absolute;
		top: calc(100% / 6);
		left: 50%;
		transform: translate(-50%, -50%);
		animation: bossFlash 0.5s ease-in-out infinite alternate;
	}
	.boss-text {
		font-size: 2.2rem; font-weight: 900; letter-spacing: 0.15em; color: #ff4400;
		text-shadow: 0 0 20px #ff2200, 0 0 40px #ff0000, 2px 2px 4px #000;
	}
	@keyframes bossFlash { to { opacity: 0.4; } }

	.cleared-banner {
		position: absolute; top: 38%; left: 50%; transform: translateX(-50%);
		animation: slideFade 3.5s ease-out forwards;
	}
	.cleared-text {
		font-size: 1.5rem; font-weight: 800; letter-spacing: 0.1em; color: #44ff88; white-space: nowrap;
		text-shadow: 0 0 16px #22dd66, 2px 2px 4px #000;
	}
	@keyframes slideFade {
		0%   { opacity: 0; transform: translateX(-50%) translateY(20px); }
		15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
		75%  { opacity: 1; }
		100% { opacity: 0; }
	}

	/* ── HP 위험 비넷 ── */
	.danger-vignette {
		position: absolute; inset: 0; pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 35%, rgba(220,20,20,0.82) 100%);
		animation: dangerPulse 0.7s ease-in-out infinite alternate;
	}
	@keyframes dangerPulse { to { opacity: 0.55; } }

	/* ── 킬 스트릭 ── */
	.streak-banner {
		position: absolute; top: 42%; left: 50%; transform: translateX(-50%);
		font-size: 1.8rem; font-weight: 900; letter-spacing: 0.12em; color: #ff8800;
		text-shadow: 0 0 20px #ff4400, 2px 2px 4px #000;
		animation: streakIn 2.5s ease-out forwards;
		pointer-events: none;
	}
	@keyframes streakIn {
		0%   { opacity: 0; transform: translateX(-50%) scale(1.4); }
		10%  { opacity: 1; transform: translateX(-50%) scale(1.0); }
		70%  { opacity: 1; }
		100% { opacity: 0; transform: translateX(-50%) translateY(-30px); }
	}

	/* ── 게임 오버 ── */
	.overlay {
		position: absolute; inset: 0;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0,0,0,0.65); pointer-events: auto;
	}
	.box {
		text-align: center; padding: 2.5rem 3.5rem;
		border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
	}
	.box.over { background: rgba(60,20,20,0.92); }
	.box.go-box.go-victory {
		background: rgba(16, 52, 40, 0.94);
		border-color: rgba(0, 220, 150, 0.28);
	}
	.box.go-box.go-victory h2 {
		color: #66ffaa !important;
		text-shadow: 0 0 18px rgba(0, 220, 140, 0.35);
	}
	.box.go-box {
		max-width: min(420px, 94vw);
		max-height: min(88vh, 640px);
		overflow-y: auto;
		padding: 1.75rem 2rem 2rem;
		text-align: left;
	}
	.box h2   { margin: 0 0 0.5rem; font-size: 2.2rem; letter-spacing: 0.15em; color: #ff5555; text-align: center; }
	.box p    { margin: 0 0 0.4rem; color: #ccc; }
	.box p strong { color: #66ccff; font-size: 1.3rem; }
	.go-score-line {
		text-align: center;
		font-size: 1rem;
		margin-bottom: 0.25rem !important;
	}
	.go-score-total {
		font-size: 1.85rem !important;
		color: #ffee88 !important;
		text-shadow: 0 0 12px rgba(255, 220, 100, 0.35);
	}
	.go-score-grid {
		margin: 0 0 0.9rem;
		padding: 0.55rem 0.7rem;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 0.8rem;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.24);
		border: 1px solid rgba(255, 255, 255, 0.08);
		align-items: center;
	}
	.go-key {
		font-size: 0.76rem;
		color: #9aa;
		letter-spacing: 0.04em;
	}
	.go-part { color: #b8e8ff; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
	.go-inline-meta { font-size: 0.9rem; color: #aaa; }
	.go-inline-meta strong { font-size: inherit; color: #8cf; }
	.go-kill-block {
		margin: 0.85rem 0 1.25rem;
		padding: 0.75rem 0.9rem;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.28);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.go-kill-title {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: rgba(255, 160, 120, 0.95);
		margin-bottom: 0.45rem;
	}
	.go-kill-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.28rem 0;
		font-size: 0.78rem;
		color: #c8c8c8;
	}
	.go-kill-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.22rem 0.1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.go-kill-list li strong {
		font-size: 0.85rem;
		color: #7df;
		font-variant-numeric: tabular-nums;
	}
	.go-norm-line {
		margin-top: 0.65rem !important;
		margin-bottom: 0 !important;
		font-size: 0.82rem;
		color: #bbb;
	}
	.go-norm-line strong { font-size: 0.95rem; color: #9f9; }
	.go-wave-hint {
		margin: 0.35rem 0 0 !important;
		font-size: 0.65rem;
		color: #777;
	}
	.go-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.5rem;
	}
	.go-btn {
		padding: 0.6rem 1.35rem;
		font-size: 0.95rem;
		font-weight: 600;
		border: 2px solid #6af;
		background: transparent;
		color: #6af;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s, color 0.2s, border-color 0.2s;
	}
	.go-btn:hover {
		background: #6af;
		color: #111;
	}
	.go-btn-shop {
		border-color: rgba(255, 200, 120, 0.75);
		color: #ffd8a0;
	}
	.go-btn-shop:hover {
		background: rgba(255, 200, 120, 0.2);
		color: #fff8e8;
		border-color: rgba(255, 220, 160, 0.95);
	}
	.box button {
		padding: 0.6rem 2rem; font-size: 1rem; font-weight: 600;
		border: 2px solid #6af; background: transparent; color: #6af;
		border-radius: 6px; cursor: pointer; transition: all 0.2s;
	}
	.box button:hover { background: #6af; color: #111; }

</style>
