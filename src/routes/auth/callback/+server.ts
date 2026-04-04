import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** OAuth PKCE — Supabase가 ?code= 로 돌아온 뒤 세션 쿠키 설정 */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	if (!supabase) {
		throw redirect(303, '/login?error=config');
	}

	if (url.searchParams.get('error')) {
		throw redirect(303, '/login?error=oauth');
	}

	const code = url.searchParams.get('code');
	const nextRaw = url.searchParams.get('next') ?? '/';
	const next = nextRaw.startsWith('/') ? nextRaw : '/';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) {
			throw redirect(303, '/login?error=exchange');
		}
	}

	throw redirect(303, next);
};
