<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BookCard from '$lib/components/BookCard.svelte';
	import { books, dbReady } from '$lib/stores/library';
	import { getLibrary, addBook, removeBook, openBook } from '$lib/services/book-service';

	let fileInput: HTMLInputElement;
	let showDeleteDialog = false;
	let bookToDelete: string | null = null;

	function loadBooks() {
		if ($dbReady) {
			$books = getLibrary();
		}
	}

	onMount(() => {
		loadBooks();
		// Poll for indexing progress updates
		const interval = setInterval(loadBooks, 2000);
		return () => clearInterval(interval);
	});

	$: if ($dbReady) loadBooks();

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			await addBook(file);
			loadBooks();
		} catch (err) {
			alert('Не удалось добавить книгу: ' + (err as Error).message);
		}
		input.value = '';
	}

	function handleBookClick(bookId: string) {
		openBook(bookId);
		goto(`/reader/${bookId}`);
	}

	function handleLongPress(bookId: string) {
		bookToDelete = bookId;
		showDeleteDialog = true;
	}

	function confirmDelete() {
		if (bookToDelete) {
			removeBook(bookToDelete);
			loadBooks();
		}
		showDeleteDialog = false;
		bookToDelete = null;
	}
</script>

<div class="library">
	<header>
		<h1>Marginalia</h1>
	</header>

	{#if $books.length === 0}
		<div class="empty">
			<div class="empty-icon">📖</div>
			<p>Библиотека пуста</p>
			<p class="empty-hint">Нажмите +, чтобы добавить первую книгу</p>
		</div>
	{:else}
		<div class="book-list">
			{#each $books as book (book.id)}
				<BookCard
					{book}
					onClick={() => handleBookClick(book.id)}
					onLongPress={() => handleLongPress(book.id)}
				/>
			{/each}
		</div>
	{/if}

	<button class="fab" on:click={() => fileInput.click()}>
		+
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept=".pdf,.epub,.fb2"
		on:change={handleFileSelect}
		style="display: none"
	/>

	{#if showDeleteDialog}
		<div class="modal-overlay" on:click|self={() => { showDeleteDialog = false; }}>
			<div class="modal">
				<h3>Удалить книгу?</h3>
				<p>Книга и все выделения будут удалены. Это действие нельзя отменить.</p>
				<div class="modal-actions">
					<button class="btn-secondary" on:click={() => { showDeleteDialog = false; }}>Отмена</button>
					<button class="btn-danger" on:click={confirmDelete}>Удалить</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.library {
		padding: 1rem;
		padding-bottom: 5rem;
	}
	header {
		margin-bottom: 1.5rem;
	}
	header h1 {
		font-family: 'Lora', serif;
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--primary);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
	}
	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}
	.empty p {
		font-size: 1.1rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}
	.empty-hint {
		color: var(--muted-foreground);
		font-size: 0.9rem !important;
		font-weight: 400 !important;
	}
	.book-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.fab {
		position: fixed;
		bottom: 5rem;
		right: 1.5rem;
		width: 56px;
		height: 56px;
		background: var(--primary);
		color: white;
		font-size: 1.5rem;
		font-weight: 300;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
		transition: transform 0.15s, box-shadow 0.15s;
		z-index: 5;
	}
	.fab:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(0,0,0,0.25);
	}
	.fab:active {
		transform: scale(0.95);
	}
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 30;
	}
	.modal {
		background: var(--card);
		padding: 1.5rem;
		border-radius: var(--radius-lg);
		width: min(90vw, 360px);
		box-shadow: 0 8px 32px rgba(0,0,0,0.2);
	}
	.modal h3 {
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.modal p {
		color: var(--muted-foreground);
		font-size: 0.9rem;
		line-height: 1.5;
		margin-bottom: 1rem;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		color: var(--muted-foreground);
	}
	.btn-danger {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		background: var(--destructive);
		color: white;
		font-weight: 500;
	}
</style>
