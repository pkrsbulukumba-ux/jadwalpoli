<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		showSeconds?: boolean;
		temperature?: string;
		timezone?: string;
	}

	let {
		showSeconds = false,
		temperature = '30°',
		timezone = 'Asia/Makassar'
	}: Props = $props();

	let timeString = $state('20:07');
	let dayString = $state('Selasa');

	function updateClock() {
		try {
			const now = new Date();
			const options: Intl.DateTimeFormatOptions = {
				timeZone: timezone,
				hour: '2-digit',
				minute: '2-digit',
				...(showSeconds ? { second: '2-digit' } : {}),
				hour12: false
			};
			timeString = new Intl.DateTimeFormat('id-ID', options).format(now);

			const dayOptions: Intl.DateTimeFormatOptions = {
				timeZone: timezone,
				weekday: 'long'
			};
			dayString = new Intl.DateTimeFormat('id-ID', dayOptions).format(now);
		} catch {
			const fallback = new Date();
			timeString = fallback.toLocaleTimeString('id-ID', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			});
			dayString = fallback.toLocaleDateString('id-ID', { weekday: 'long' });
		}
	}

	onMount(() => {
		updateClock();
		const timer = setInterval(updateClock, 1000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		// Reaktif terhadap perubahan zona waktu dari settings
		if (timezone) {
			updateClock();
		}
	});
</script>

<div class="digital-clock-badge" role="timer" aria-live="polite">
	<span class="time-digits">{timeString}</span>
	<div class="clock-sub">
		<span class="status-dot"></span>
		<span class="day-temp">{dayString} • {temperature}</span>
	</div>
</div>

<style>
	.digital-clock-badge {
		background: rgba(10, 92, 54, 0.92);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		border-radius: 1.15rem;
		padding: 0.42rem 1.05rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		min-width: 132px;
		color: #FFFFFF;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
	}

	.time-digits {
		font-size: 2.15rem;
		font-weight: 850;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.clock-sub {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.22rem;
	}

	.status-dot {
		width: 6.5px;
		height: 6.5px;
		border-radius: 50%;
		background: #34D399;
		box-shadow: 0 0 6px #34D399;
	}

	.day-temp {
		font-size: 0.84rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		opacity: 0.94;
	}
</style>
