import type { User } from '@supabase/supabase-js';

/** OAuth / provider 문자열 (표시·행 메타용) */
export function authProviderFromUser(user: User | null): string | null {
	if (!user) return null;
	const fromMeta = user.app_metadata?.provider;
	if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
	const id0 = user.identities?.[0];
	if (id0 && typeof id0.provider === 'string') return id0.provider;
	return null;
}

/** Google/GitHub 등 user_metadata 의 picture · avatar_url (세계 랭킹과 동일 출처) */
export function avatarUrlFromUserMetadata(user: User | null | undefined): string | null {
	if (!user?.user_metadata || typeof user.user_metadata !== 'object') return null;
	const m = user.user_metadata as Record<string, unknown>;
	const a = m.avatar_url ?? m.picture;
	return typeof a === 'string' && a.trim() ? a.trim() : null;
}

/**
 * 표시용 로그인 식별자 — get_world_leaderboard 의 login_id 와 같은 우선순위(이메일·메타·id).
 */
export function loginDisplayIdFromUser(user: User | null | undefined): string {
	if (!user) return '';
	const m = user.user_metadata as Record<string, unknown>;
	const metaEmail = typeof m.email === 'string' ? m.email.trim() : '';
	const pref = typeof m.preferred_username === 'string' ? m.preferred_username.trim() : '';
	const uname = typeof m.user_name === 'string' ? m.user_name.trim() : '';
	const login = typeof m.login === 'string' ? m.login.trim() : '';
	const name = typeof m.name === 'string' ? m.name.trim() : '';
	const email = typeof user.email === 'string' ? user.email.trim() : '';
	return email || metaEmail || pref || uname || login || name || user.id;
}
