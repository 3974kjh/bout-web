/** OAuth redirectTo 베이스. `PUBLIC_SITE_URL` 없으면 `window.location.origin`. */
export function resolveOAuthRedirectOrigin(browserOrigin: string): string {
	const raw = import.meta.env.PUBLIC_SITE_URL;
	const configured = typeof raw === 'string' ? raw.trim() : '';
	if (configured) return configured.replace(/\/$/, '');
	return browserOrigin;
}
