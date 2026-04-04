<script lang="ts">
	import { page } from '$app/state';
	import { getBrowserSupabase } from '$lib/supabase/browser';
	import { locale, translate as tr } from '$lib/i18n';

	const err = $derived(page.url.searchParams.get('error'));

	async function signIn(provider: 'google' | 'github'): Promise<void> {
		const supabase = getBrowserSupabase();
		if (!supabase) return;
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${page.url.origin}/auth/callback`,
				skipBrowserRedirect: true
			}
		});
		if (error) {
			console.error(error);
			return;
		}
		if (data.url) {
			window.location.href = data.url;
		}
	}
</script>

<main class="auth-page">
	<div class="auth-card">
		<h1 class="auth-title">{tr($locale, 'auth.title')}</h1>
		<p class="auth-lead">{tr($locale, 'auth.lead')}</p>

		{#if !page.data.authConfigured}
			<p class="auth-warn" role="alert">{tr($locale, 'auth.notConfigured')}</p>
		{:else}
			{#if err === 'oauth'}
				<p class="auth-err" role="alert">{tr($locale, 'auth.errorOauth')}</p>
			{:else if err === 'exchange'}
				<p class="auth-err" role="alert">{tr($locale, 'auth.errorExchange')}</p>
			{:else if err === 'config'}
				<p class="auth-err" role="alert">{tr($locale, 'auth.errorConfig')}</p>
			{/if}

			<div class="auth-buttons">
				<button type="button" class="auth-btn auth-btn--google" onclick={() => signIn('google')}>
					<span class="auth-btn__icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="20" height="20">
							<path
								fill="currentColor"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="currentColor"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="currentColor"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="currentColor"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
					</span>
					{tr($locale, 'auth.google')}
				</button>
				<button type="button" class="auth-btn auth-btn--github" onclick={() => signIn('github')}>
					<span class="auth-btn__icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path
								d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
							/>
						</svg>
					</span>
					{tr($locale, 'auth.github')}
				</button>
			</div>
		{/if}

		<p class="auth-hint">{tr($locale, 'auth.hintSupabase')}</p>

		<a class="auth-back" href="/">{tr($locale, 'auth.backHome')}</a>
	</div>
</main>

<style>
	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		background: radial-gradient(ellipse 80% 70% at 50% 20%, #0c1228 0%, #060612 72%);
		color: rgba(220, 235, 255, 0.92);
	}
	.auth-card {
		width: 100%;
		max-width: 22rem;
		padding: 1.75rem 1.5rem;
		border-radius: 12px;
		border: 1px solid rgba(0, 200, 255, 0.22);
		background: rgba(8, 12, 24, 0.92);
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
	}
	.auth-title {
		margin: 0 0 0.35rem;
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}
	.auth-lead {
		margin: 0 0 1.25rem;
		font-size: 0.82rem;
		line-height: 1.5;
		opacity: 0.85;
	}
	.auth-warn,
	.auth-err {
		font-size: 0.78rem;
		margin: 0 0 1rem;
		padding: 0.55rem 0.65rem;
		border-radius: 8px;
	}
	.auth-warn {
		background: rgba(255, 180, 60, 0.12);
		border: 1px solid rgba(255, 200, 100, 0.35);
		color: #ffd8a8;
	}
	.auth-err {
		background: rgba(255, 80, 80, 0.1);
		border: 1px solid rgba(255, 120, 120, 0.35);
		color: #ffb0b0;
	}
	.auth-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.auth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.65rem 1rem;
		font-size: 0.88rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.auth-btn--google {
		background: rgba(255, 255, 255, 0.96);
		color: #1a1a1a;
	}
	.auth-btn--google:hover {
		background: #fff;
	}
	.auth-btn--github {
		background: rgba(30, 32, 40, 0.95);
		color: #f0f4fc;
		border-color: rgba(255, 255, 255, 0.18);
	}
	.auth-btn--github:hover {
		background: rgba(45, 48, 58, 0.98);
	}
	.auth-btn__icon {
		display: flex;
		opacity: 0.95;
	}
	.auth-hint {
		margin: 1.25rem 0 0;
		font-size: 0.68rem;
		line-height: 1.45;
		opacity: 0.55;
	}
	.auth-back {
		display: inline-block;
		margin-top: 1.25rem;
		font-size: 0.82rem;
		color: rgba(120, 200, 255, 0.95);
		text-decoration: none;
	}
	.auth-back:hover {
		text-decoration: underline;
	}
</style>
