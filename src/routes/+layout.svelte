<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
	}
	:global(*) {
		box-sizing: border-box;
	}

	/* 정비소 사이드 패널·카드 풀과 동일한 스크롤바 — shop / rank 등에서 class="bout-scrollbar" */
	:global(.bout-scrollbar) {
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 180, 255, 0.35) transparent;
	}
	:global(.bout-scrollbar::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-thumb) {
		background: rgba(0, 180, 255, 0.35);
		border-radius: 999px;
	}
	:global(.bout-scrollbar::-webkit-scrollbar-thumb:hover) {
		background: rgba(0, 200, 255, 0.48);
	}
</style>
