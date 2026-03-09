<script lang="ts">
	import { goto } from '$app/navigation';
	import SearchResultCard from '$lib/components/SearchResult.svelte';
	import { searchQuery, searchResults, searching } from '$lib/stores/search';
	import { search } from '$lib/modules/search-engine';
	import { isEmbeddingsReady, isEmbeddingsLoading, initEmbeddings } from '$lib/modules/embeddings';
	import { openBook } from '$lib/services/book-service';

	let modelStatus = '';

	async function handleSearch() {
		if (!$searchQuery.trim()) return;

		if (!isEmbeddingsReady()) {
			modelStatus = 'Загрузка ML-модели...';
			try {
				await initEmbeddings();
				modelStatus = '';
			} catch (e) {
				modelStatus = 'Ошибка загрузки модели: ' + (e as Error).message;
				return;
			}
		}

		$searching = true;
		try {
			$searchResults = await search($searchQuery);
		} catch (e) {
			console.error('Search error:', e);
		}
		$searching = false;
	}

	function goToResult(bookId: string, pageNumber: number) {
		openBook(bookId);
		goto(`/reader/${bookId}?page=${pageNumber}`);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSearch();
	}
</script>

<div class="search-page">
	<div class="search-bar">
		<input
			type="text"
			bind:value={$searchQuery}
			on:keydown={handleKeydown}
			placeholder="Введите запрос для поиска по смыслу..."
			autofocus
		/>
		<button class="search-btn" on:click={handleSearch} disabled={$searching}>
			{$searching ? '...' : '↵'}
		</button>
	</div>

	{#if modelStatus}
		<div class="status">{modelStatus}</div>
	{/if}

	{#if $searching}
		<div class="loading">
			<p>Ищу...</p>
		</div>
	{:else if $searchResults}
		<div class="results">
			{#if $searchResults.highlights.length > 0}
				<h3 class="section-title">Мои выделения</h3>
				{#each $searchResults.highlights as result}
					<SearchResultCard
						text={result.text}
						bookTitle={result.bookTitle}
						pageNumber={result.pageNumber}
						score={result.score}
						note={result.note}
						isHighlight={true}
						onClick={() => goToResult(result.bookId, result.pageNumber)}
					/>
				{/each}
			{/if}

			{#if $searchResults.chunks.length > 0}
				<h3 class="section-title">Из книг</h3>
				{#each $searchResults.chunks as result}
					<SearchResultCard
						text={result.text}
						bookTitle={result.bookTitle}
						pageNumber={result.pageNumber}
						score={result.score}
						onClick={() => goToResult(result.bookId, result.pageNumber)}
					/>
				{/each}
			{/if}

			{#if $searchResults.highlights.length === 0 && $searchResults.chunks.length === 0}
				<div class="empty">
					<p>Ничего не найдено</p>
					<p class="hint">Попробуйте переформулировать запрос</p>
				</div>
			{/if}

			<div class="timing">
				Найдено за {$searchResults.queryTimeMs} мс
			</div>
		</div>
	{:else}
		<div class="empty">
			<p>🔍</p>
			<p>Введите запрос, чтобы найти по смыслу в ваших книгах</p>
		</div>
	{/if}
</div>

<style>
	.search-page {
		padding: 1rem;
		padding-bottom: 5rem;
	}
	.search-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.search-bar input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--card);
		font-size: 1rem;
	}
	.search-bar input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--accent-light);
	}
	.search-btn {
		padding: 0.75rem 1rem;
		background: var(--primary);
		color: white;
		border-radius: var(--radius);
		font-weight: 600;
		font-size: 1.1rem;
		min-width: 44px;
	}
	.search-btn:disabled {
		opacity: 0.6;
	}
	.status {
		padding: 0.75rem;
		background: var(--accent-light);
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		color: var(--primary);
		margin-bottom: 1rem;
		text-align: center;
	}
	.loading {
		display: flex;
		justify-content: center;
		padding: 3rem;
		color: var(--muted-foreground);
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.section-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.5rem;
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
		font-size: 2rem;
	}
	.hint {
		font-size: 0.85rem;
	}
	.timing {
		text-align: center;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-top: 0.5rem;
	}
</style>
