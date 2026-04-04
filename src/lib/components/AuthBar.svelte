<script lang="ts">
	import { page } from '$app/state';
	import { locale, translate as tr } from '$lib/i18n';
</script>

<div class="auth-bar">
	{#if page.data.user}
		<span class="auth-bar__email" title={page.data.user.email ?? ''}>
			{page.data.user.email ?? page.data.user.id}
		</span>
		<form method="POST" action="/auth/signout" class="auth-bar__form">
			<button type="submit" class="auth-bar__out">{tr($locale, 'auth.signOut')}</button>
		</form>
	{:else}
		<a href="/login" class="auth-bar__in">{tr($locale, 'auth.loginLink')}</a>
	{/if}
</div>

<style>
	.auth-bar {
		position: fixed;
		top: clamp(0.65rem, 2.2vw, 1rem);
		left: clamp(0.65rem, 2.2vw, 1rem);
		z-index: 120;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		max-width: min(42vw, 14rem);
		font-size: 0.68rem;
		color: rgba(200, 225, 255, 0.88);
	}
	.auth-bar__email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.9;
	}
	.auth-bar__form {
		margin: 0;
	}
	.auth-bar__out {
		padding: 0.2rem 0.45rem;
		font-size: 0.65rem;
		font-weight: 600;
		color: rgba(180, 220, 255, 0.95);
		background: rgba(0, 40, 80, 0.35);
		border: 1px solid rgba(0, 180, 255, 0.28);
		border-radius: 6px;
		cursor: pointer;
	}
	.auth-bar__out:hover {
		background: rgba(0, 60, 100, 0.45);
	}
	.auth-bar__in {
		padding: 0.2rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: rgba(120, 210, 255, 0.98);
		text-decoration: none;
		border: 1px solid rgba(0, 180, 255, 0.3);
		border-radius: 6px;
		background: rgba(6, 14, 28, 0.5);
	}
	.auth-bar__in:hover {
		background: rgba(10, 30, 50, 0.65);
	}
</style>
