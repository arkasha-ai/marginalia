<script lang="ts">
	import type { Book } from '$lib/db/schema';

	export let book: Book;
	export let onClick: () => void = () => {};
	export let onLongPress: () => void = () => {};

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPress = false;

	function handlePointerDown() {
		isLongPress = false;
		pressTimer = setTimeout(() => {
			isLongPress = true;
			onLongPress();
		}, 500);
	}

	function handlePointerUp() {
		if (pressTimer) clearTimeout(pressTimer);
		if (!isLongPress) onClick();
	}

	function handlePointerLeave() {
		if (pressTimer) clearTimeout(pressTimer);
	}

	const statusIcon: Record<string, string> = {
		pending: '⏳',
		in_progress: '⏳',
		completed: '✅',
		error: '⚠️'
	};

	const statusText: Record<string, string> = {
		pending: 'Ожидание',
		in_progress: 'Индексация...',
		completed: 'Проиндексирована',
		error: 'Ошибка'
	};

	$: progress = book.totalPages > 0 ? Math.round((book.lastReadPage / book.totalPages) * 100) : 0;
</script>

<div
	class="book-card"
	role="button"
	tabindex="0"
	on:pointerdown={handlePointerDown}
	on:pointerup={handlePointerUp}
	on:pointerleave={handlePointerLeave}
	on:keydown={(e) => e.key === 'Enter' && onClick()}
>
	<div class="cover">
		{#if book.coverDataUrl}
			<img src={book.coverDataUrl} alt={book.title} />
		{:else}
			<div class="cover-placeholder">
				<span>📖</span>
			</div>
		{/if}
	</div>
	<div class="info">
		<h3 class="title">{book.title}</h3>
		<div class="progress-bar">
			<div class="progress-fill" style="width: {progress}%"></div>
		</div>
		<div class="meta">
			<span class="progress-text">{progress}%</span>
			<span class="status">
				{statusIcon[book.indexingStatus]}
				{statusText[book.indexingStatus]}
			</span>
		</div>
	</div>
</div>

<style>
	.book-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: 0 1px 3px var(--card-shadow);
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s;
		user-select: none;
	}
	.book-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 3px 8px var(--card-shadow);
	}
	.book-card:active {
		transform: scale(0.98);
	}
	.cover {
		width: 70px;
		height: 100px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--muted);
	}
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cover-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		background: var(--accent-light);
	}
	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.title {
		font-size: 1rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.progress-bar {
		height: 4px;
		background: var(--muted);
		border-radius: 2px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 2px;
		transition: width 0.3s;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}
</style>
