<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BookViewer from '$lib/components/BookViewer.svelte';
	import { getBookById } from '$lib/services/book-service';
	import type { Book } from '$lib/db/schema';
	import { dbReady } from '$lib/stores/library';

	let book: Book | null = null;
	let error = '';
	let initialPage: number | null = null;

	$: bookId = $page.params.bookId;

	onMount(() => {
		if (!$dbReady) return;
		book = getBookById(bookId);
		if (!book) {
			error = 'Книга не найдена';
		} else {
			const pageParam = $page.url.searchParams.get('page');
			if (pageParam) {
				const parsed = parseInt(pageParam, 10);
				if (!isNaN(parsed) && parsed >= 1 && parsed <= book.totalPages) {
					initialPage = parsed;
				}
			}
		}
	});
</script>

{#if error}
	<div class="error-state">
		<p>{error}</p>
		<a href="/library">← В библиотеку</a>
	</div>
{:else if book}
	<BookViewer {book} {initialPage} />
{:else}
	<div class="loading-state">
		<p>Загрузка...</p>
	</div>
{/if}

<style>
	.error-state, .loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
	}
	.error-state p {
		color: var(--destructive);
		font-weight: 500;
	}
	.error-state a {
		color: var(--primary);
	}
</style>
