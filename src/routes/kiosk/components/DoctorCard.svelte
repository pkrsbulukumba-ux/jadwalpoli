<script lang="ts">
	import type { DoctorScheduleCardData } from "$lib/types";
	import ScheduleBadge from "./ScheduleBadge.svelte";
	import PracticeStatus from "./PracticeStatus.svelte";

	interface Props {
		data: DoctorScheduleCardData;
		currentDayOfWeek?: number; // 1 = Senin, 2 = Selasa, dst. Default 2 (Selasa)
		onCardClick?: (data: DoctorScheduleCardData) => void;
	}

	let { data, currentDayOfWeek = 2, onCardClick }: Props = $props();

	const dayNames: Record<number, string> = {
		1: "Senin",
		2: "Selasa",
		3: "Rabu",
		4: "Kamis",
		5: "Jumat",
		6: "Sabtu",
		7: "Minggu",
	};

	// Generate inisial dokter dari nama
	function getDoctorInitials(fullName: string): string {
		const clean = fullName
			.replace(/^(dr\.|drg\.|Bdn\.|Hj\.|H\.)\s*/gi, "")
			.trim();
		const parts = clean.split(" ").filter(Boolean);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return (parts[0]?.[0] || "D").toUpperCase();
	}

	function handleClick() {
		if (onCardClick) {
			onCardClick(data);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
	class="doctor-card"
	class:clickable={!!onCardClick}
	onclick={handleClick}
	role={onCardClick ? "button" : "article"}
	tabindex={onCardClick ? 0 : undefined}
>
	<!-- Foto Dokter / Avatar Placeholder -->
	<div class="doctor-photo-frame">
		{#if data.doctor.photo_url}
			<img
				src={data.doctor.photo_url}
				alt={data.doctor.full_name}
				class="doctor-photo-img"
				loading="lazy"
			/>
		{:else}
			<div class="avatar-placeholder" aria-hidden="true">
				<span class="avatar-initials"
					>{getDoctorInitials(data.doctor.full_name)}</span
				>
			</div>
		{/if}
	</div>

	<!-- Info Dokter & Deretan Chip Jadwal -->
	<div class="doctor-details">
		<h3 class="doctor-name">{data.doctor.full_name}</h3>

		<div class="schedule-chips-row" class:single-chip={data.schedules?.length === 1}>
			{#if data.schedules && data.schedules.length > 0}
				{#each data.schedules as sch}
					<ScheduleBadge
						day={dayNames[sch.day_of_week] ||
							`Hari ${sch.day_of_week}`}
						time={`${sch.start_time.slice(0, 5)}-${sch.end_time.slice(0, 5)}`}
						isToday={sch.day_of_week === currentDayOfWeek}
					/>
				{/each}
			{:else}
				<span class="no-schedule-text"
					>Jadwal mingguan belum dikonfigurasi</span
				>
			{/if}
		</div>
	</div>

	<!-- Status Praktik Dokter di Kanan -->
	<div class="doctor-status-wrap">
		<PracticeStatus
			label={data.status.label}
			subtext={data.status.subtext}
			type={data.status.type}
		/>
	</div>
</article>

<style>
	.doctor-card {
		background: #ffffff;
		border-radius: 1.1rem;
		padding: clamp(0.58rem, 1.0vh, 0.95rem) clamp(0.85rem, 1.3vw, 1.32rem);
		display: grid;
		grid-template-columns: var(--doctor-photo-w, 106px) 1fr auto;
		align-items: center;
		gap: clamp(0.65rem, 1.1vw, 1.1rem);
		box-shadow:
			0 7px 20px -3px rgba(0, 0, 0, 0.05),
			0 2px 6px -1px rgba(0, 0, 0, 0.02);
		border: 1.5px solid #eef2f6;
		flex: 0 1 auto;
		min-height: 0;
		transition:
			transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1),
			border-color 0.15s ease,
			background-color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.doctor-card.clickable {
		cursor: pointer;
	}

	.doctor-card.clickable:hover {
		transform: translateY(-2px);
		box-shadow:
			0 12px 28px -4px rgba(10, 92, 54, 0.12),
			0 4px 10px -1px rgba(0, 0, 0, 0.04);
		border-color: #a7f3d0;
	}

	.doctor-card.clickable:active {
		transform: scale(0.985);
		background-color: #f0fdf4;
		border-color: #34d399;
	}

	.doctor-photo-frame {
		width: var(--doctor-photo-w, 106px);
		height: var(--doctor-photo-h, 118px);
		border-radius: 0.85rem;
		background: #f1f5f9;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.06),
			0 4px 12px rgba(0, 0, 0, 0.05);
		flex-shrink: 0;
	}

	.doctor-photo-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #e2e8f0;
	}

	.avatar-initials {
		font-size: 1.95rem;
		font-weight: 850;
		color: #64748b;
		letter-spacing: -0.02em;
	}

	.doctor-details {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.doctor-name {
		font-size: var(--doctor-name-size, 1.12rem);
		font-weight: 850;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.015em;
		line-height: 1.2;
		word-break: break-word;
	}

	.schedule-chips-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.28rem 0.5rem;
		align-items: center;
		width: 100%;
	}

	.schedule-chips-row.single-chip {
		display: flex;
		width: fit-content;
	}

	.no-schedule-text {
		font-size: 0.76rem;
		color: #94a3b8;
		font-style: italic;
	}

	.doctor-status-wrap {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		min-width: 110px;
	}

	@media (max-width: 768px) {
		.doctor-card {
			grid-template-columns: 78px 1fr auto;
			gap: 0.8rem;
			padding: 0.68rem 0.9rem;
		}

		.doctor-photo-frame {
			width: 78px;
			height: 88px;
		}

		.avatar-initials {
			font-size: 1.6rem;
		}

		.doctor-name {
			font-size: 1.05rem;
		}
	}

	@media (max-width: 520px) {
		.doctor-card {
			grid-template-columns: 88px 1fr;
			gap: 0.9rem;
			padding: 0.9rem;
		}

		.doctor-photo-frame {
			width: 88px;
			height: 98px;
		}

		.avatar-initials {
			font-size: 1.75rem;
		}

		.doctor-status-wrap {
			grid-column: span 2;
			width: 100%;
		}
	}
</style>
