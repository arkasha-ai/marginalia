<script lang="ts">
	export let text: string;
	export let bookTitle: string;
	export let pageNumber: number;
	export let score: number;
	export let note: string | undefined = undefined;
	export let isHighlight: boolean = false;
	export let onClick: () => void = () => {};
</script>

<button class="result-card" on:click={onClick}>
	{#if isHighlight}
		<div class="highlight-badge">Мое выделение</div>
	{/if}
	<p class="text book-text">«{text}»</p>
	{#if note}
		<p class="note">{note}</p>
	{/if}
	<div class="meta">
		<span>📖 {bookTitle}</span>
		<span>Стр. {pageNumber}</span>
	</div>
</button>

<style>
	.result-card {
		display: block;
		width: 100%;
		text-align: left;
		padding: 1rem;
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: 0 1px 3px var(--card-shadow);
		transition: transform 0.15s;
	}
	.result-card:hover {
		transform: translateY(-1px);
	}
	.highlight-badge {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--primary);
		background: var(--highlight-yellow);
		padding: 0.15rem 0.5rem;
		border-radius: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.text {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--foreground);
		margin-bottom: 0.5rem;
	}
	.note {
		font-style: italic;
		font-size: 0.85rem;
		color: var(--muted-foreground);
		margin-bottom: 0.5rem;
	}
	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}
</style>
