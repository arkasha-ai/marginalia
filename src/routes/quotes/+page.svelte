<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import QuoteCard from '$lib/components/QuoteCard.svelte';
	import { getAllHighlights, removeHighlight } from '$lib/services/highlight-service';
	import { getLibrary, openBook } from '$lib/services/book-service';
	import type { HighlightWithBook } from '$lib/db/schema';
	import type { Book } from '$lib/db/schema';
	import { dbReady } from '$lib/stores/library';

	let highlights: HighlightWithBook[] = [];
	let filterBookId = '';
	let booksWithHighlights: Book[] = [];

	function load() {
		highlights = getAllHighlights(filterBookId || undefined);
		const allBooks = getLibrary();
		const bookIds = new Set(getAllHighlights().map(h => h.bookId));
		booksWithHighlights = allBooks.filter(b => bookIds.has(b.id));
	}

	onMount(() => {
		if ($dbReady) load();
	});

	$: if ($dbReady) load();

	function handleFilter() {
		highlights = getAllHighlights(filterBookId || undefined);
	}

	function handleDelete(id: string) {
		removeHighlight(id);
		load();
	}

	function handleClick(bookId: string, pageNumber: number) {
		openBook(bookId);
		goto(`/reader/${bookId}?page=${pageNumber}`);
	}
</script>

<div class="quotes-page">
	<header>
		<h1>Цитаты</h1>
	</header>

	<div class="filter">
		<select bind:value={filterBookId} on:change={handleFilter}>
			<option value="">Все книги</option>
			{#each booksWithHighlights as book}
				<option value={book.id}>{book.title}</option>
			{/each}
		</select>
	</div>

	{#if highlights.length === 0}
		<div class="empty">
			<p>💬</p>
			<p>Пока нет выделений</p>
			<p class="hint">Откройте книгу и выделите интересный фрагмент</p>
		</div>
	{:else}
		<div class="quote-list">
			{#each highlights as h (h.id)}
				<QuoteCard
					highlight={h}
					onClick={() => handleClick(h.bookId, h.pageNumber)}
					onDelete={() => handleDelete(h.id)}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.quotes-page {
		padding: 1rem;
		padding-bottom: 5rem;
	}
	header {
		margin-bottom: 1rem;
	}
	header h1 {
		font-family: 'Lora', serif;
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--primary);
	}
	.filter {
		margin-bottom: 1rem;
	}
	.filter select {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--card);
		font-size: 0.9rem;
		cursor: pointer;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem;
		text-align: center;
		color: var(--muted-foreground);
		gap: 0.5rem;
	}
	.empty p:first-child {
		font-size: 3rem;
	}
	.hint {
		font-size: 0.85rem;
	}
	.quote-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
