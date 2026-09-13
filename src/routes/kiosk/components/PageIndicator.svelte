<script lang="ts">
	interface Props {
		currentPage: number;
		totalPages: number;
		variant?: 'header' | 'dots';
		onPageSelect?: (page: number) => void;
	}

	let {
		currentPage = 1,
		totalPages = 8,
		variant = 'header',
		onPageSelect
	}: Props = $props();
</script>

{#if variant === 'header'}
	<button
		type="button"
		class="header-page-badge"
		onclick={() => onPageSelect?.(currentPage < totalPages ? currentPage + 1 : 1)}
		title="Sentuh untuk pindah ke halaman berikutnya"
		aria-label={`Halaman ${currentPage} dari ${totalPages}. Sentuh untuk halaman berikutnya`}
	>
		<span class="badge-label">HALAMAN</span>
		<span class="badge-number">{currentPage}/{totalPages}</span>
	</button>
{:else}
	<div class="pagination-dots" aria-label={`Halaman ${currentPage} dari ${totalPages}`}>
		{#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum}
			<button
				type="button"
				class="dot-btn"
				class:active={pageNum === currentPage}
				onclick={() => onPageSelect?.(pageNum)}
				aria-label={`Pindah ke halaman ${pageNum}`}
				title={`Pindah ke halaman ${pageNum}`}
			>
				<span class="dot-fill"></span>
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Header Badge Variant (Lebih Ringkas & Touchable) */
	.header-page-badge {
		background: rgba(10, 92, 54, 0.92);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		border-radius: 0.85rem;
		padding: 0.3rem 0.8rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #FFFFFF;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
		cursor: pointer;
		font-family: inherit;
		user-select: none;
		-webkit-user-select: none;
		transition: all 0.15s ease;
	}

	.header-page-badge:hover {
		background: rgba(10, 92, 54, 0.92);
		transform: scale(1.05);
	}

	.header-page-badge:active {
		transform: scale(0.95);
	}

	.badge-label {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		opacity: 0.9;
		line-height: 1;
	}

	.badge-number {
		font-size: 1.25rem;
		font-weight: 900;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	/* Dots Variant untuk Bawah Konten (Touchable Buttons) */
	.pagination-dots {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		padding: 0.28rem 0;
	}

	.dot-btn {
		background: transparent;
		border: none;
		padding: 3px 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		touch-action: manipulation;
	}

	.dot-btn:hover {
		transform: scale(1.2);
	}

	.dot-fill {
		display: block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #CBD5E1;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		opacity: 0.75;
	}

	.dot-btn.active .dot-fill {
		width: 34px;
		border-radius: 9999px;
		background: linear-gradient(90deg, #D97706 0%, #059669 100%);
		opacity: 1;
		box-shadow: 0 2px 8px rgba(5, 150, 105, 0.45);
	}
</style>
