import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeShopSettings, type ShopSettings } from '$lib/game/shopSettings';

export type UserShopSettingsRow = {
	user_id: string;
	mech_base: string;
	missile_skin_id: string;
	favored_card_ids: string[];
	last_auth_provider: string | null;
	updated_at: string;
};

function rowToShop(row: UserShopSettingsRow): ShopSettings {
	return normalizeShopSettings({
		mechBase: row.mech_base,
		missileSkinId: row.missile_skin_id,
		favoredCardIds: row.favored_card_ids
	});
}

export async function fetchUserShopSettingsFromCloud(
	supabase: SupabaseClient,
	userId: string
): Promise<ShopSettings | null> {
	const { data, error } = await supabase
		.from('user_shop_settings')
		.select('user_id, mech_base, missile_skin_id, favored_card_ids, last_auth_provider, updated_at')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.warn('[shopCloud] fetch', error.message);
		return null;
	}
	if (!data) return null;
	return rowToShop(data as UserShopSettingsRow);
}

export async function upsertUserShopSettingsToCloud(
	supabase: SupabaseClient,
	userId: string,
	settings: ShopSettings,
	lastAuthProvider: string | null
): Promise<boolean> {
	const s = normalizeShopSettings(settings);
	const { error } = await supabase.from('user_shop_settings').upsert(
		{
			user_id: userId,
			mech_base: s.mechBase,
			missile_skin_id: s.missileSkinId,
			favored_card_ids: s.favoredCardIds,
			last_auth_provider: lastAuthProvider,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);
	if (error) {
		console.warn('[shopCloud] upsert', error.message);
		return false;
	}
	return true;
}
