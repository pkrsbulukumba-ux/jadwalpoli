<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { RefreshCw, Stethoscope, ArrowRight } from '@lucide/svelte';

	let countdown = $state(10);
	let timer: ReturnType<typeof setInterval> | null = null;

	function reloadKiosk() {
		if (timer) clearInterval(timer);
		window.location.href = '/kiosk';
	}

	onMount(() => {
		timer = setInterval(() => {
			if (countdown > 1) {
				countdown -= 1;
			} else {
				reloadKiosk();
			}
		}, 1000);

		return () => {
			if (timer) clearInterval(timer);
		};
	});
</script>

<svelte:head>
	<title>Memulihkan Sistem Kiosk - RSUD</title>
</svelte:head>

<div class="error-boundary-viewport">
	<div class="error-card">
		<!-- Emblem RSUD Ambient -->
		<div class="emblem-circle">
			<Stethoscope size={42} class="text-emerald" />
		</div>

		<div class="instansi-pill">
			<span>RSUD H. ANDI SULTHAN DAENG RADJA</span>
		</div>

		<h1>Sistem Kiosk Poliklinik</h1>
		<p class="desc">
			Layar sedang melakukan penyesuaian otomatis dan memulihkan sinkronisasi jadwal layanan poliklinik.
		</p>

		<!-- Watchdog Auto Recovery Countdown -->
		<div class="countdown-badge">
			<RefreshCw size={18} class="spin-icon text-amber" />
			<span>Memuat ulang otomatis dalam <strong>{countdown} detik</strong>...</span>
		</div>

		<button type="button" class="btn-reload" onclick={reloadKiosk}>
			<span>Muat Ulang Layar Sekarang</span>
			<ArrowRight size={18} />
		</button>
	</div>
</div>

<style>
	.error-boundary-viewport {
		min-height: 100vh;
		width: 100vw;
		background: #EEF5F1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		font-family: inherit;
		color: #0F172A;
	}

	.error-card {
		background: #FFFFFF;
		max-width: 480px;
		width: 100%;
		border-radius: 1.5rem;
		border: 1px solid #E2E8F0;
		box-shadow: 0 20px 40px -10px rgba(10, 92, 54, 0.15);
		padding: 3rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		animation: popIn 0.35s ease-out;
	}

	.emblem-circle {
		width: 84px;
		height: 84px;
		border-radius: 50%;
		background: #D1FAE5;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.25rem;
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
	}

	:global(.text-emerald) {
		color: #0A5C36;
	}

	:global(.text-amber) {
		color: #D97706;
	}

	.instansi-pill {
		background: #F1F5F9;
		padding: 0.25rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		color: #475569;
		letter-spacing: 0.04em;
		margin-bottom: 0.75rem;
	}

	h1 {
		font-size: 1.4rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0 0 0.5rem 0;
	}

	.desc {
		font-size: 0.9rem;
		color: #64748B;
		line-height: 1.5;
		margin: 0 0 1.5rem 0;
	}

	.countdown-badge {
		background: #FEF3C7;
		border: 1px solid #FDE68A;
		color: #92400E;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.875rem;
		margin-bottom: 1.75rem;
	}

	:global(.spin-icon) {
		animation: spin 3s linear infinite;
	}

	.btn-reload {
		background: #0A5C36;
		color: #FFFFFF;
		border: none;
		padding: 0.85rem 1.75rem;
		border-radius: 0.75rem;
		font-size: 0.95rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		cursor: pointer;
		transition: background 0.2s, transform 0.15s;
		box-shadow: 0 4px 12px rgba(10, 92, 54, 0.25);
	}

	.btn-reload:hover {
		background: #074327;
		transform: translateY(-1px);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
