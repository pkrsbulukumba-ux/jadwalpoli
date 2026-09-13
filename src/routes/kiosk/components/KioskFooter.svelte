<script lang="ts">
	import { Clock, Info, HeartHandshake, Smartphone } from '@lucide/svelte';
	import RunningText from './RunningText.svelte';
	import type { FooterNotice } from '$lib/types';

	interface Props {
		notices?: FooterNotice[];
		runningText?: string;
		runningTextSpeed?: number;
		runningTextDirection?: 'left' | 'right';
		showNotices?: boolean;
		showRunningText?: boolean;
	}

	let {
		notices = [
			{
				id: '1',
				title: 'Loket Pendaftaran Buka Pukul 08.00 – 12.00 WITA',
				icon: 'clock',
				is_active: true,
				display_order: 1
			},
			{
				id: '2',
				title: 'Jadwal Sewaktu-Waktu Dapat Berubah',
				icon: 'info',
				is_active: true,
				display_order: 2
			},
			{
				id: '3',
				title: 'Jam Istirahat Tetap Melayani',
				icon: 'heart',
				is_active: true,
				display_order: 3
			},
			{
				id: '4',
				title: 'Pasien BPJS Wajib Pakai Mobile JKN',
				icon: 'smartphone',
				is_active: true,
				display_order: 4
			}
		],
		runningText = 'Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Instagram: @RSUDBULUKUMBA • Melayani Dengan Sepenuh Hati',
		runningTextSpeed = 26,
		runningTextDirection = 'left',
		showNotices = true,
		showRunningText = true
	}: Props = $props();
</script>

<footer class="kiosk-footer">
	{#if showNotices && notices.length > 0}
		<div class="notices-container">
			<div class="notices-grid">
				{#each notices as notice, idx}
					<div class="notice-card">
						<div class="icon-bubble {idx % 2 === 0 ? 'bubble-amber' : 'bubble-emerald'}">
							{#if notice.icon === 'clock'}
								<Clock size={16} />
							{:else if notice.icon === 'heart'}
								<HeartHandshake size={16} />
							{:else if notice.icon === 'smartphone'}
								<Smartphone size={16} />
							{:else}
								<Info size={16} />
							{/if}
						</div>
						<span class="notice-text">{notice.title}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if showRunningText}
		<RunningText text={runningText} speed={runningTextSpeed} direction={runningTextDirection} />
	{/if}
</footer>

<style>
	.kiosk-footer {
		margin-top: auto;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: transparent;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.notices-container {
		padding: 0.18rem 1.5rem 0.42rem 1.5rem;
	}

	.notices-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem 0.6rem;
	}

	.notice-card {
		background: #FFFFFF;
		border: 1px solid rgba(226, 232, 240, 0.85);
		border-radius: 0.85rem;
		padding: 0.48rem 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.01);
		transition: transform 0.2s ease;
	}

	.icon-bubble {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bubble-amber {
		background: #FEF3C7;
		color: #D97706;
	}

	.bubble-emerald {
		background: #D1FAE5;
		color: #059669;
	}

	.notice-text {
		font-size: 0.82rem;
		font-weight: 750;
		color: #1E293B;
		line-height: 1.22;
		letter-spacing: -0.01em;
	}
</style>
