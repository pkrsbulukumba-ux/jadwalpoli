<script lang="ts">
	import {
		XCircle,
		CheckCircle2,
		Clock,
		Ban,
		CalendarClock,
		AlertCircle
	} from '@lucide/svelte';
	import type { StatusType } from '$lib/types';

	interface Props {
		label: string;
		subtext?: string;
		type?: StatusType;
	}

	let {
		label = 'TUTUP',
		subtext = 'Di Luar Jadwal',
		type = 'closed'
	}: Props = $props();
</script>

<div class="status-container" role="status" aria-label={`Status: ${label}, ${subtext}`}>
	<div class="status-pill status-{type}">
		{#if type === 'closed'}
			<XCircle size={20} class="status-icon" />
		{:else if type === 'open'}
			<CheckCircle2 size={20} class="status-icon" />
		{:else if type === 'break'}
			<Clock size={20} class="status-icon" />
		{:else if type === 'holiday'}
			<Ban size={20} class="status-icon" />
		{:else if type === 'upcoming'}
			<CalendarClock size={20} class="status-icon" />
		{:else}
			<AlertCircle size={20} class="status-icon" />
		{/if}
		{#if type === 'upcoming' || label.toUpperCase() === 'AKAN DATANG'}
			<span class="status-label status-label-stacked">
				<span class="line-stacked">AKAN</span>
				<span class="line-stacked">DATANG</span>
			</span>
		{:else}
			<span class="status-label">{label}</span>
		{/if}
	</div>

	{#if subtext}
		<span class="status-subtext">{subtext}</span>
	{/if}
</div>

<style>
	.status-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 122px;
		gap: 0.34rem;
		text-align: center;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.48rem;
		padding: 0.56rem 1.22rem;
		border-radius: 9999px;
		font-size: 0.96rem;
		font-weight: 850;
		letter-spacing: 0.04em;
		color: #FFFFFF;
		width: auto;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s ease;
	}

	.status-pill.status-upcoming {
		padding: 0.48rem 1.08rem;
		gap: 0.42rem;
		min-width: 114px;
	}

	.status-label-stacked {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.06;
		font-size: 0.84rem;
		font-weight: 900;
		letter-spacing: 0.04em;
	}

	.line-stacked {
		display: block;
	}

	/* Varian Warna Status */
	.status-closed {
		background: #EA4335;
	}

	.status-open {
		background: #059669;
		box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
	}

	.status-break {
		background: #D97706;
	}

	.status-holiday {
		background: #7C3AED;
	}

	.status-upcoming {
		background: #0284C7;
	}

	.status-cancelled {
		background: #475569;
	}

	:global(.status-icon) {
		flex-shrink: 0;
	}

	.status-label {
		line-height: 1;
	}

	.status-subtext {
		font-size: 0.78rem;
		font-weight: 750;
		color: #64748B;
		letter-spacing: 0.02em;
		white-space: nowrap;
		margin-top: 0.06rem;
	}
</style>
