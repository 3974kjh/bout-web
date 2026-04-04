<script lang="ts">
	type Props = {
		src: string | null | undefined;
		initial: string;
		alt?: string;
	};
	let { src, initial, alt = '' }: Props = $props();

	let failed = $state(false);

	$effect(() => {
		src;
		failed = false;
	});
</script>

<div class="player-av" aria-hidden={!alt}>
	{#if src && !failed}
		<img
			class="player-av__img"
			src={src}
			alt={alt}
			referrerpolicy="no-referrer"
			loading="lazy"
			decoding="async"
			onerror={() => {
				failed = true;
			}}
		/>
	{/if}
	{#if !src || failed}
		<span class="player-av__fallback">{initial.slice(0, 1).toUpperCase() || '?'}</span>
	{/if}
</div>

<style>
	.player-av {
		position: relative;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: 50%;
		overflow: hidden;
		background: rgba(0, 50, 90, 0.65);
		border: 1px solid rgba(0, 180, 255, 0.35);
		box-shadow: 0 0 12px rgba(0, 120, 200, 0.2);
	}

	.player-av__img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.player-av__fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 0.85rem;
		font-weight: 800;
		color: #b8e8ff;
	}
</style>
