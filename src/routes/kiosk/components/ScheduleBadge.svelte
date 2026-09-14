<script lang="ts">
	import { Calendar } from '@lucide/svelte';

	interface Props {
		day: string;
		time: string;
		isToday?: boolean;
	}

	let { day, time, isToday = false }: Props = $props();
</script>

<div
	class="schedule-chip"
	class:active-today={isToday}
	title={isToday ? `Hari ini: ${day} (${time})` : `${day} (${time})`}
>
	<Calendar size={11} class="chip-icon" />
	<span class="chip-label">
		<strong>{day}</strong> • {time}
	</span>
</div>

<style>
	.schedule-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: #FFF7ED;
		border: 1px solid #FFEDD5;
		color: #9A3412;
		padding: 0.25rem 0.52rem;
		border-radius: 0.45rem;
		font-size: 0.68rem;
		font-weight: 650;
		white-space: nowrap;
		transition: all 0.2s ease;
		box-sizing: border-box;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.schedule-chip.active-today {
		background: #D1FAE5;
		border: 1.5px solid #10B981;
		color: #047857;
		box-shadow: 0 2px 6px rgba(16, 185, 129, 0.22);
	}

	:global(.chip-icon) {
		opacity: 0.8;
		flex-shrink: 0;
	}

	.chip-label strong {
		font-weight: 800;
	}
</style>
