import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const { url } = event;
	/** Supabase 가 Site URL 루트로만 돌려보낼 때 `/?code=` 로 옴 → 세션 교환 라우트로 통일 */
	if (url.pathname === '/' && url.searchParams.has('code')) {
		throw redirect(303, `/auth/callback${url.search}`);
	}

	const supabaseUrl = env.PUBLIC_SUPABASE_URL ?? '';
	const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

	event.locals.supabase =
		supabaseUrl && supabaseAnonKey
			? createServerClient(supabaseUrl, supabaseAnonKey, {
					cookies: {
						getAll: () => event.cookies.getAll(),
						setAll: (cookiesToSet) => {
							for (const { name, value, options } of cookiesToSet) {
								event.cookies.set(name, value, { ...options, path: '/' });
							}
						}
					}
				})
			: null;

	event.locals.safeGetSession = async () => {
		if (!event.locals.supabase) {
			return { session: null, user: null };
		}
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
