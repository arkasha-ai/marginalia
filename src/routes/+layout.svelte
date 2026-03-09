<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { initDb } from '$lib/db';
	import { dbReady } from '$lib/stores/library';
	import IndexingBanner from '$lib/components/IndexingBanner.svelte';

	let initialized = false;
	let initError = '';

	onMount(async () => {
		try {
			await initDb();
			$dbReady = true;
			initialized = true;
		} catch (e: any) {
			initError = e?.message || String(e);
			console.error('DB init failed:', e);
		}
	});

	$: currentPath = $page.url.pathname;
	$: isReader = currentPath.startsWith('/reader');

	const tabs = [
		{ path: '/library', icon: '📚', label: 'Библиотека' },
		{ path: '/search', icon: '🔍', label: 'Поиск' },
		{ path: '/quotes', icon: '💬', label: 'Цитаты' }
	];
</script>

<div class="app">
	{#if initError}
		<div class="loading-screen">
			<div class="logo">⚠️</div>
			<h1>Ошибка</h1>
			<p>{initError}</p>
		</div>
	{:else if !initialized}
		<div class="loading-screen">
			<div class="logo">📖</div>
			<h1>Marginalia</h1>
			<p>Загрузка...</p>
		</div>
	{:else}
		<main class:with-tabs={!isReader}>
			<slot />
		</main>

		<IndexingBanner />

		{#if !isReader}
			<nav class="tab-bar">
				{#each tabs as tab}
					<a
						href={tab.path}
						class="tab"
						class:active={currentPath === tab.path || (tab.path === '/library' && currentPath === '/')}
					>
						<span class="tab-icon">{tab.icon}</span>
						<span class="tab-label">{tab.label}</span>
					</a>
				{/each}
			</nav>
		{/if}
	{/if}
</div>

<style>
	.app {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.loading-screen {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}
	.logo {
		font-size: 3rem;
	}
	.loading-screen h1 {
		font-family: 'Lora', serif;
		font-size: 1.8rem;
		font-weight: 600;
		color: var(--primary);
	}
	.loading-screen p {
		color: var(--muted-foreground);
	}
	main {
		flex: 1;
		overflow-y: auto;
	}
	main.with-tabs {
		padding-bottom: env(safe-area-inset-bottom, 0);
	}
	.tab-bar {
		display: flex;
		border-top: 1px solid var(--border);
		background: var(--card);
		padding-bottom: env(safe-area-inset-bottom, 0);
	}
	.tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.5rem;
		text-decoration: none;
		color: var(--muted-foreground);
		transition: color 0.2s;
	}
	.tab.active {
		color: var(--primary);
	}
	.tab-icon {
		font-size: 1.25rem;
	}
	.tab-label {
		font-size: 0.7rem;
		font-weight: 500;
	}
</style>
