import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** 브라우저 전용 — OAuth 리다이렉트 등 */
export function getBrowserSupabase(): SupabaseClient | null {
	if (typeof window === 'undefined') return null;
	const url = env.PUBLIC_SUPABASE_URL ?? '';
	const key = env.PUBLIC_SUPABASE_ANON_KEY ?? '';
	if (!url || !key) return null;
	if (!browserClient) {
		browserClient = createBrowserClient(url, key);
	}
	return browserClient;
}
