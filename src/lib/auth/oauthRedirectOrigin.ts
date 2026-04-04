import { env } from '$env/dynamic/public';

/**
 * OAuth `redirectTo` 호스트. 브라우저 실제 origin을 쓰고, 배포 시에는
 * `PUBLIC_SITE_URL`(예: https://bout-web.pages.dev)로 고정할 수 있습니다.
 */
export function resolveOAuthRedirectOrigin(browserOrigin: string): string {
	const configured = env.PUBLIC_SITE_URL?.trim();
	if (configured) return configured.replace(/\/$/, '');
	return browserOrigin;
}
