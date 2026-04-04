import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeMechBase, type RankRunRecord } from '$lib/storage/rankIndexedDb';

type RankRow = {
	id: string;
	user_id: string;
	played_at: string;
	mech_base: string;
	score_total: number;
	score_boss: number;
	score_level: number;
	score_time: number;
	level: number;
	survival_time: number;
	normal_kills: number;
	boss_count: number;
	auth_provider: string | null;
};

function rowToRecord(row: RankRow): RankRunRecord {
	const playedAt = Date.parse(row.played_at);
	return {
		id: row.id,
		playedAt: Number.isFinite(playedAt) ? playedAt : 0,
		mechBase: normalizeMechBase(row.mech_base),
		scoreTotal: row.score_total,
		scoreBoss: row.score_boss,
		scoreLevel: row.score_level,
		scoreTime: row.score_time,
		level: row.level,
		survivalTime: row.survival_time,
		normalKills: row.normal_kills,
		bossCount: row.boss_count
	};
}

function recordToInsert(
	userId: string,
	rec: RankRunRecord,
	authProvider: string | null
): Record<string, unknown> {
	return {
		id: rec.id,
		user_id: userId,
		played_at: new Date(rec.playedAt).toISOString(),
		mech_base: rec.mechBase,
		score_total: rec.scoreTotal,
		score_boss: rec.scoreBoss,
		score_level: rec.scoreLevel,
		score_time: rec.scoreTime,
		level: rec.level,
		survival_time: rec.survivalTime,
		normal_kills: rec.normalKills,
		boss_count: rec.bossCount,
		auth_provider: authProvider
	};
}

export async function fetchRankRecordsFromCloud(
	supabase: SupabaseClient,
	userId: string
): Promise<RankRunRecord[]> {
	const { data, error } = await supabase
		.from('rank_run_records')
		.select(
			'id, user_id, played_at, mech_base, score_total, score_boss, score_level, score_time, level, survival_time, normal_kills, boss_count, auth_provider'
		)
		.eq('user_id', userId)
		.order('score_total', { ascending: false })
		.limit(10);

	if (error) {
		console.warn('[rankCloud] fetch', error.message);
		return [];
	}
	if (!data?.length) return [];
	return (data as RankRow[]).map(rowToRecord);
}

export async function insertRankRecordToCloud(
	supabase: SupabaseClient,
	userId: string,
	rec: RankRunRecord,
	authProvider: string | null
): Promise<boolean> {
	const { error } = await supabase
		.from('rank_run_records')
		.insert(recordToInsert(userId, rec, authProvider));

	if (error) {
		console.warn('[rankCloud] insert', error.message);
		return false;
	}
	return true;
}

const INSERT_CHUNK = 400;

/** 로컬 전용 기록을 클라우드에 아직 없는 id만 일괄 삽입 */
export async function insertRankRecordsBatchToCloud(
	supabase: SupabaseClient,
	userId: string,
	records: RankRunRecord[],
	authProvider: string | null
): Promise<boolean> {
	if (records.length === 0) return true;
	for (let i = 0; i < records.length; i += INSERT_CHUNK) {
		const chunk = records.slice(i, i + INSERT_CHUNK);
		const rows = chunk.map((r) => recordToInsert(userId, r, authProvider));
		const { error } = await supabase.from('rank_run_records').insert(rows);
		if (error) {
			console.warn('[rankCloud] batch insert', error.message);
			return false;
		}
	}
	return true;
}

/** get_world_leaderboard RPC 한 행 — 유저별 최고 점수에 해당하는 런 1건 + auth 프로필 */
export type WorldLeaderboardRow = {
	place: number;
	user_id: string;
	run_id: string;
	score_total: number;
	played_at: string;
	mech_base: string;
	level: number;
	survival_time: number;
	score_boss: number;
	score_level: number;
	score_time: number;
	normal_kills: number;
	boss_count: number;
	/** oauth provider 키 (예: google, github) */
	auth_provider: string;
	/** 이메일·닉 등 표시용 */
	login_id: string;
	avatar_url: string | null;
};

export function worldLeaderboardRowToRankRecord(row: WorldLeaderboardRow): RankRunRecord {
	const playedAt = Date.parse(row.played_at);
	return {
		id: row.run_id,
		playedAt: Number.isFinite(playedAt) ? playedAt : 0,
		mechBase: normalizeMechBase(row.mech_base),
		scoreTotal: row.score_total,
		scoreBoss: row.score_boss,
		scoreLevel: row.score_level,
		scoreTime: row.score_time,
		level: row.level,
		survivalTime: row.survival_time,
		normalKills: row.normal_kills,
		bossCount: row.boss_count
	};
}

/** 세계 랭킹 상위 N명 (서버·클라 모두 최대 100) */
export const WORLD_LEADERBOARD_CAP = 100;

export async function fetchWorldLeaderboardFromCloud(
	supabase: SupabaseClient,
	limit = WORLD_LEADERBOARD_CAP
): Promise<{ rows: WorldLeaderboardRow[]; error: string | null }> {
	const cap = Math.min(WORLD_LEADERBOARD_CAP, Math.max(1, limit));
	const { data, error } = await supabase.rpc('get_world_leaderboard', { p_limit: cap });

	if (error) {
		console.warn('[rankCloud] get_world_leaderboard', error.message);
		return { rows: [], error: error.message };
	}
	if (!data || !Array.isArray(data)) {
		return { rows: [], error: null };
	}

	const rows = (data as Record<string, unknown>[]).map((row) => ({
		place: Number(row.place ?? 0),
		user_id: String(row.user_id ?? ''),
		run_id: String(row.run_id ?? ''),
		score_total: Number(row.score_total ?? 0),
		played_at: String(row.played_at ?? ''),
		mech_base: String(row.mech_base ?? ''),
		level: Number(row.level ?? 0),
		survival_time: Number(row.survival_time ?? 0),
		score_boss: Number(row.score_boss ?? 0),
		score_level: Number(row.score_level ?? 0),
		score_time: Number(row.score_time ?? 0),
		normal_kills: Number(row.normal_kills ?? 0),
		boss_count: Number(row.boss_count ?? 0),
		auth_provider: String(row.auth_provider ?? ''),
		login_id: String(row.login_id ?? ''),
		avatar_url:
			row.avatar_url == null || row.avatar_url === ''
				? null
				: String(row.avatar_url)
	}));
	return { rows, error: null };
}

/**
 * 로그인 사용자의 세계 순위(1부터). 클라우드에 런 기록이 없으면 null.
 * get_world_leaderboard 와 동일한 집계·정렬 기준.
 */
export async function fetchMyWorldRankFromCloud(
	supabase: SupabaseClient
): Promise<number | null> {
	const { data, error } = await supabase.rpc('get_my_world_rank');

	if (error) {
		console.warn('[rankCloud] get_my_world_rank', error.message);
		return null;
	}
	if (data == null) return null;
	const n = typeof data === 'number' ? data : Number(data);
	if (!Number.isFinite(n) || n < 1) return null;
	return Math.floor(n);
}
