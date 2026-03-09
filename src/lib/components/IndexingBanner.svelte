<script lang="ts">
	import { indexingProgress } from '$lib/stores/indexing';
</script>

{#if $indexingProgress}
	<div class="indexing-banner">
		<div class="banner-content">
			<span class="icon">{$indexingProgress.stage === 'loading_model' ? '🧠' : '⏳'}</span>
			<div class="info">
				<span class="title">{$indexingProgress.bookTitle}</span>
				<span class="detail">
					{#if $indexingProgress.stage === 'loading_model'}
						Загрузка модели...
					{:else}
						стр. {$indexingProgress.currentPage} / {$indexingProgress.totalPages} · {$indexingProgress.chunks} чанков
					{/if}
				</span>
			</div>
			<span class="percent">{$indexingProgress.percent}%</span>
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: {$indexingProgress.percent}%"></div>
		</div>
	</div>
{/if}

<style>
	.indexing-banner {
		position: fixed;
		bottom: 56px; /* above tab bar */
		left: 0;
		right: 0;
		background: var(--foreground);
		color: var(--background);
		z-index: 100;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); opacity: 0; }
		to   { transform: translateY(0);   opacity: 1; }
	}

	.banner-content {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px 6px;
	}

	.icon { font-size: 16px; flex-shrink: 0; }

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.title {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.95;
	}

	.detail {
		font-size: 11px;
		opacity: 0.7;
	}

	.percent {
		font-size: 13px;
		font-weight: 700;
		flex-shrink: 0;
		opacity: 0.9;
	}

	.progress-track {
		height: 3px;
		background: rgba(255,255,255,0.2);
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}
</style>
