<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getParser } from '$lib/modules/book-parser';
	import { getFileDataWithFallback } from '$lib/services/book-service';
	import { updateReadingPosition } from '$lib/services/book-service';
	import { createHighlight, getForPage } from '$lib/services/highlight-service';
	import type { Book, Highlight } from '$lib/db/schema';
	import { currentPage, totalPages, toolbarVisible, isRendering } from '$lib/stores/reader';

	export let book: Book;
	export let initialPage: number | null = null;

	let canvas: HTMLCanvasElement;
	let epubDiv: HTMLDivElement;
	let container: HTMLDivElement;
	let highlights: Highlight[] = [];
	let showHighlightMenu = false;
	let highlightMenuPos = { x: 0, y: 0 };
	let selectedText = '';
	let showNoteModal = false;
	let noteText = '';

	const isEpub = book.format === 'epub';

	$currentPage = initialPage ?? book.lastReadPage;
	$totalPages = book.totalPages;

	const parser = getParser(book.filePath);
	const fileData = getFileDataWithFallback(book.id, book.filePath);

	// epubjs rendition for EPUB
	let epubRendition: any = null;

	async function initEpubRendition() {
		if (!isEpub || !epubDiv || !fileData) return;
		try {
			const ePub = (await import('epubjs')).default;
			const epubBook = ePub(fileData.slice(0));
			await epubBook.ready;

			epubRendition = epubBook.renderTo(epubDiv, {
				width: '100%',
				height: '100%',
				spread: 'none',
				flow: 'paginated'
			});

			// Navigate to saved page (spine index)
			const spineItems = (epubBook.spine as any).spineItems ?? (epubBook.spine as any).items ?? [];
			const idx = Math.min($currentPage - 1, spineItems.length - 1);
			const item = spineItems[idx];
			if (item?.href) {
				await epubRendition.display(item.href);
			} else {
				await epubRendition.display();
			}

			// Track page changes
			epubRendition.on('relocated', (location: any) => {
				const index = location?.start?.index ?? 0;
				$currentPage = index + 1;
				updateReadingPosition(book.id, $currentPage);
			});
		} catch (e) {
			console.error('EPUB rendition error:', e);
		}
	}

	async function renderCurrentPage() {
		if (isEpub) return; // EPUB uses rendition
		if (!canvas || !fileData) return;
		$isRendering = true;
		try {
			const containerWidth = container?.clientWidth || 800;
			const scale = containerWidth / 612 * 1.5;
			await parser.renderPage(fileData, $currentPage, canvas, scale, book.id);
			highlights = getForPage(book.id, $currentPage);
		} catch (e) {
			console.error('Render error:', e);
		}
		$isRendering = false;
	}

	function goToPage(page: number) {
		if (page < 1 || page > $totalPages) return;
		$currentPage = page;
		updateReadingPosition(book.id, page);

		if (isEpub && epubRendition) {
			// Navigate by spine index
			const bookInstance = (epubRendition as any).book;
			const spineItems = bookInstance?.spine?.spineItems ?? bookInstance?.spine?.items ?? [];
			const item = spineItems[page - 1];
			if (item?.href) epubRendition.display(item.href);
		} else {
			renderCurrentPage();
		}
	}

	function nextPage() {
		if (isEpub && epubRendition) {
			epubRendition.next();
		} else {
			goToPage($currentPage + 1);
		}
	}

	function prevPage() {
		if (isEpub && epubRendition) {
			epubRendition.prev();
		} else {
			goToPage($currentPage - 1);
		}
	}

	function handleCanvasClick(e: MouseEvent) {
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const width = rect.width;
		if (x < width * 0.25) prevPage();
		else if (x > width * 0.75) nextPage();
		else $toolbarVisible = !$toolbarVisible;
	}

	function handleSelection() {
		const sel = window.getSelection();
		if (sel && sel.toString().trim()) {
			selectedText = sel.toString().trim();
			const range = sel.getRangeAt(0);
			const rect = range.getBoundingClientRect();
			// Clamp menu position to stay within viewport
			const menuX = Math.max(60, Math.min(rect.left + rect.width / 2, window.innerWidth - 60));
			const menuY = Math.max(50, rect.top - 10);
			highlightMenuPos = { x: menuX, y: menuY };
			showHighlightMenu = true;
		}
	}

	function saveHighlight(withNote: boolean) {
		if (!selectedText) return;
		showHighlightMenu = false;
		if (withNote) { showNoteModal = true; return; }
		createHighlight({
			bookId: book.id,
			pageNumber: $currentPage,
			text: selectedText,
			startOffset: 0,
			endOffset: selectedText.length
		});
		highlights = getForPage(book.id, $currentPage);
		window.getSelection()?.removeAllRanges();
		selectedText = '';
	}

	function saveNote() {
		createHighlight({
			bookId: book.id,
			pageNumber: $currentPage,
			text: selectedText,
			startOffset: 0,
			endOffset: selectedText.length,
			note: noteText || undefined
		});
		highlights = getForPage(book.id, $currentPage);
		window.getSelection()?.removeAllRanges();
		selectedText = '';
		noteText = '';
		showNoteModal = false;
	}

	let touchStartX = 0;
	function handleTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX; }
	function handleTouchEnd(e: TouchEvent) {
		const diff = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(diff) > 50) {
			if (diff < 0) nextPage(); else prevPage();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage();
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage();
	}

	function handleSlider(e: Event) {
		goToPage(parseInt((e.target as HTMLInputElement).value));
	}

	onMount(async () => {
		if (isEpub) {
			await initEpubRendition();
		} else {
			renderCurrentPage();
		}
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
		if (epubRendition) {
			try { epubRendition.destroy(); } catch {}
		}
	});
</script>

<div class="viewer" bind:this={container}>
	{#if $toolbarVisible}
		<div class="toolbar">
			<a href="/library" class="back-btn">←</a>
			<span class="book-title">{book.title}</span>
			<a href="/search" class="search-btn">🔍</a>
		</div>
	{/if}

	<div
		class="content-area"
		role="button"
		tabindex="0"
		on:click={handleCanvasClick}
		on:mouseup={handleSelection}
		on:touchstart={handleTouchStart}
		on:touchend={handleTouchEnd}
	>
		{#if $isRendering}
			<div class="loading-overlay"><div class="spinner"></div></div>
		{/if}

		{#if isEpub}
			<!-- epubjs renders HTML/images natively in this div -->
			<div class="epub-container" bind:this={epubDiv}></div>
		{:else}
			<canvas bind:this={canvas}></canvas>
			{#each highlights as h}
				<div class="highlight-marker" title={h.note || h.text}>
					{#if h.note}<span class="note-icon">📝</span>{/if}
				</div>
			{/each}
		{/if}
	</div>

	{#if showHighlightMenu}
		<div class="highlight-menu" style="left: {highlightMenuPos.x}px; top: {highlightMenuPos.y}px">
			<button on:click={() => saveHighlight(false)}>Выделить</button>
			<button on:click={() => saveHighlight(true)}>+ Заметка</button>
			<button on:click={() => { showHighlightMenu = false; window.getSelection()?.removeAllRanges(); }}>✕</button>
		</div>
	{/if}

	{#if $toolbarVisible}
		<div class="bottom-bar">
			<input type="range" min="1" max={$totalPages} value={$currentPage}
				on:input={handleSlider} class="page-slider" />
			<div class="page-info">Стр. {$currentPage} из {$totalPages}</div>
		</div>
	{/if}

	{#if showNoteModal}
		<div class="modal-overlay" on:click|self={() => { showNoteModal = false; }}>
			<div class="modal">
				<h3>Заметка</h3>
				<p class="selected-preview">«{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}»</p>
				<textarea bind:value={noteText} placeholder="Ваша заметка..." maxlength="2000" rows="4"></textarea>
				<div class="modal-actions">
					<button class="btn-secondary" on:click={() => { showNoteModal = false; noteText = ''; }}>Отмена</button>
					<button class="btn-primary" on:click={saveNote}>Сохранить</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.viewer {
		position: relative;
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--muted);
		overflow: hidden;
	}
	.toolbar {
		position: absolute;
		top: 0; left: 0; right: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--card);
		box-shadow: 0 2px 8px var(--card-shadow);
		z-index: 10;
	}
	.back-btn, .search-btn {
		font-size: 1.2rem;
		text-decoration: none;
		color: var(--primary);
		padding: 0.25rem;
	}
	.book-title {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.content-area {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		position: relative;
	}
	.epub-container {
		width: 100%;
		height: 100%;
		background: white;
	}
	canvas {
		max-width: 100%;
		height: auto;
		box-shadow: 0 2px 12px rgba(0,0,0,0.15);
		background: white;
	}
	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255,255,255,0.7);
		z-index: 5;
	}
	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.highlight-menu {
		position: fixed;
		transform: translate(-50%, -100%);
		display: flex;
		gap: 0.25rem;
		background: var(--foreground);
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		z-index: 20;
	}
	.highlight-menu button {
		color: white;
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		border-radius: 0.25rem;
		white-space: nowrap;
	}
	.highlight-menu button:hover { background: rgba(255,255,255,0.15); }
	.highlight-marker { position: absolute; }
	.note-icon { font-size: 0.75rem; }
	.bottom-bar {
		position: absolute;
		bottom: 0; left: 0; right: 0;
		padding: 0.75rem 1rem;
		background: var(--card);
		box-shadow: 0 -2px 8px var(--card-shadow);
		z-index: 10;
	}
	.page-slider { width: 100%; accent-color: var(--primary); }
	.page-info {
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted-foreground);
		margin-top: 0.25rem;
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
		width: min(90vw, 400px);
		box-shadow: 0 8px 32px rgba(0,0,0,0.2);
	}
	.modal h3 { margin-bottom: 0.75rem; font-weight: 600; }
	.selected-preview {
		font-family: 'Lora', serif;
		font-style: italic;
		color: var(--muted-foreground);
		font-size: 0.9rem;
		margin-bottom: 0.75rem;
		line-height: 1.5;
	}
	.modal textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--background);
		resize: vertical;
		font-size: 0.9rem;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.btn-primary {
		background: var(--primary);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		font-weight: 500;
	}
	.btn-secondary {
		color: var(--muted-foreground);
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
	}
</style>
