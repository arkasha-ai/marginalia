<script lang="ts">
	import type { HighlightWithBook } from '$lib/db/schema';

	export let highlight: HighlightWithBook;
	export let onClick: () => void = () => {};
	export let onDelete: () => void = () => {};

	let swipeX = 0;
	let swiping = false;
	let startX = 0;

	function handleTouchStart(e: TouchEvent) {
		startX = e.touches[0].clientX;
		swiping = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!swiping) return;
		const diff = e.touches[0].clientX - startX;
		swipeX = Math.min(0, diff);
	}

	function handleTouchEnd() {
		swiping = false;
		if (swipeX < -80) {
			// Show delete
			swipeX = -80;
		} else {
			swipeX = 0;
		}
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('ru-RU', {
				day: 'numeric', month: 'long', year: 'numeric'
			});
		} catch {
			return iso;
		}
	}
</script>

<div class="quote-wrapper">
	<div
		class="quote-card"
		role="button"
		tabindex="0"
		style="transform: translateX({swipeX}px)"
		on:click={onClick}
		on:keydown={(e) => e.key === 'Enter' && onClick()}
		on:touchstart={handleTouchStart}
		on:touchmove={handleTouchMove}
		on:touchend={handleTouchEnd}
	>
		<p class="text book-text">«{highlight.text}»</p>
		{#if highlight.note}
			<p class="note">{highlight.note}</p>
		{/if}
		<div class="meta">
			<span>📖 {highlight.bookTitle} · Стр. {highlight.pageNumber}</span>
			<span>{formatDate(highlight.createdAt)}</span>
		</div>
	</div>
	{#if swipeX < -20}
		<button class="delete-btn" on:click|stopPropagation={onDelete}>
			Удалить
		</button>
	{/if}
</div>

<style>
	.quote-wrapper {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius);
	}
	.quote-card {
		padding: 1rem;
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: 0 1px 3px var(--card-shadow);
		cursor: pointer;
		transition: transform 0.2s;
		position: relative;
		z-index: 1;
	}
	.text {
		font-size: 0.95rem;
		line-height: 1.6;
		margin-bottom: 0.5rem;
	}
	.note {
		font-style: italic;
		color: var(--muted-foreground);
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}
	.delete-btn {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 80px;
		background: var(--destructive);
		color: white;
		font-weight: 600;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 0;
	}
</style>
