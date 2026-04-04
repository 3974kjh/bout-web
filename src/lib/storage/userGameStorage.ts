/**
 * 게스트: IndexedDB만 사용.
 * 로그인: Supabase를 원천으로 하되, IDB에 미러(오프라인·빠른 읽기)하고
 * 최초 동기 시 로컬 전용 기록을 클라우드로 올립니다.
 */
import { getBrowserSupabase } from '$lib/supabase/browser';
import type { ShopSettings } from '$lib/game/shopSettings';
import { normalizeShopSettings } from '$lib/game/shopSettings';
import {
	appendRankRunRecordToIndexedDb,
	readRankRecords as readRankRecordsFromIndexedDb,
	replaceRankRecordsInIndexedDb,
	type RankRunRecord
} from '$lib/storage/rankIndexedDb';
import {
	readShopSettingsGuestFromIndexedDb,
	writeShopSettingsCloudMirrorToIndexedDb,
	writeShopSettingsGuestToIndexedDb
} from '$lib/storage/shopIndexedDb';
import { authProviderFromUser } from '$lib/storage/supabase/sessionUser';
import {
	fetchRankRecordsFromCloud,
	insertRankRecordToCloud,
	insertRankRecordsBatchToCloud
} from '$lib/storage/supabase/rankCloud';
import {
	fetchUserShopSettingsFromCloud,
	upsertUserShopSettingsToCloud
} from '$lib/storage/supabase/shopCloud';

async function getCloudContext(): Promise<{
	supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>;
	userId: string;
	provider: string | null;
} | null> {
	const supabase = getBrowserSupabase();
	if (!supabase) return null;
	/** getSession: 쿠키/스토리지 기반 — getUser()보다 먼저 준비되는 경우가 많음(랭킹 탭 등) */
	const {
		data: { session },
		error: sessionErr
	} = await supabase.auth.getSession();
	if (sessionErr || !session?.user) return null;
	const user = session.user;
	return { supabase, userId: user.id, provider: authProviderFromUser(user) };
}

export async function readShopSettingsForUser(): Promise<ShopSettings> {
	const ctx = await getCloudContext();
	if (!ctx) {
		return readShopSettingsGuestFromIndexedDb();
	}

	const guestLocal = await readShopSettingsGuestFromIndexedDb();
	const cloud = await fetchUserShopSettingsFromCloud(ctx.supabase, ctx.userId);

	if (!cloud) {
		const s = normalizeShopSettings(guestLocal);
		await upsertUserShopSettingsToCloud(ctx.supabase, ctx.userId, s, ctx.provider);
		await writeShopSettingsCloudMirrorToIndexedDb(s);
		return s;
	}

	const merged = normalizeShopSettings(cloud);
	await writeShopSettingsCloudMirrorToIndexedDb(merged);
	return merged;
}

export async function writeShopSettingsForUser(settings: ShopSettings): Promise<void> {
	const s = normalizeShopSettings(settings);
	const ctx = await getCloudContext();
	if (!ctx) {
		await writeShopSettingsGuestToIndexedDb(s);
		return;
	}
	await writeShopSettingsCloudMirrorToIndexedDb(s);
	await upsertUserShopSettingsToCloud(ctx.supabase, ctx.userId, s, ctx.provider);
}

export async function readRankRecordsForUser(): Promise<RankRunRecord[]> {
	const ctx = await getCloudContext();
	if (!ctx) {
		return readRankRecordsFromIndexedDb();
	}

	let cloud = await fetchRankRecordsFromCloud(ctx.supabase, ctx.userId);
	const local = await readRankRecordsFromIndexedDb();
	const cloudIds = new Set(cloud.map((r) => r.id));
	const toUpload = local.filter((r) => !cloudIds.has(r.id));

	if (toUpload.length > 0) {
		await insertRankRecordsBatchToCloud(ctx.supabase, ctx.userId, toUpload, ctx.provider);
		cloud = await fetchRankRecordsFromCloud(ctx.supabase, ctx.userId);
	}

	await replaceRankRecordsInIndexedDb(cloud);
	return cloud;
}

export async function appendRankRunRecordForUser(
	partial: Omit<RankRunRecord, 'id' | 'playedAt'>
): Promise<void> {
	const rec: RankRunRecord = {
		id: crypto.randomUUID(),
		playedAt: Date.now(),
		...partial
	};
	await appendRankRunRecordToIndexedDb(rec);

	const ctx = await getCloudContext();
	if (!ctx) return;
	await insertRankRecordToCloud(ctx.supabase, ctx.userId, rec, ctx.provider);
}
