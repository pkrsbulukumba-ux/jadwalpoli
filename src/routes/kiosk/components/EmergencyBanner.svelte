<script lang="ts">
	import { AlertTriangle, Info, AlertOctagon } from '@lucide/svelte';

	interface Props {
		isActive?: boolean;
		title?: string;
		message?: string;
		level?: 'info' | 'warning' | 'critical';
	}

	let {
		isActive = false,
		title = 'PENGUMUMAN PENTING',
		message = '',
		level = 'warning'
	}: Props = $props();
</script>

{#if isActive && message}
	<aside class="emergency-banner {level}" role="alert">
		<div class="banner-inner">
			<div class="icon-wrap">
				{#if level === 'critical'}
					<AlertOctagon size={24} />
				{:else if level === 'info'}
					<Info size={24} />
				{:else}
					<AlertTriangle size={24} />
				{/if}
			</div>
			<div class="text-wrap">
				<h4 class="banner-title">{title}</h4>
				<p class="banner-message">{message}</p>
			</div>
		</div>
	</aside>
{/if}

<style>
	.emergency-banner {
		width: 100%;
		padding: 0.75rem 1.5rem;
		position: relative;
		z-index: 40;
		animation: slideDown 0.3s ease-out;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		zoom: var(--header-scale, 1);
	}

	.emergency-banner.warning {
		background: linear-gradient(90deg, #D97706 0%, #F59E0B 100%);
		color: #FFFFFF;
	}

	.emergency-banner.critical {
		background: linear-gradient(90deg, #B91C1C 0%, #EF4444 100%);
		color: #FFFFFF;
	}

	.emergency-banner.info {
		background: linear-gradient(90deg, #0284C7 0%, #38BDF8 100%);
		color: #FFFFFF;
	}

	.banner-inner {
		display: flex;
		align-items: center;
		gap: 1rem;
		max-width: 1080px;
		margin: 0 auto;
	}

	.icon-wrap {
		flex-shrink: 0;
	}

	.text-wrap {
		display: flex;
		flex-direction: column;
	}

	.banner-title {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin: 0;
	}

	.banner-message {
		font-size: 0.9rem;
		font-weight: 600;
		opacity: 0.95;
		margin: 0.15rem 0 0 0;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
