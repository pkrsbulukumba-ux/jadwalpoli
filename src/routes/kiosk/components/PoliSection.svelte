<script lang="ts">
	import { Inbox } from '@lucide/svelte';
	import { getPolyclinicIconComponent } from '$lib/services/icon.service';
	import type { PoliSectionData, DoctorScheduleCardData } from '$lib/types';
	import DoctorCard from './DoctorCard.svelte';

	interface Props {
		section: PoliSectionData;
		currentDayOfWeek?: number;
		onCardClick?: (data: DoctorScheduleCardData) => void;
	}

	let { section, currentDayOfWeek = 2, onCardClick }: Props = $props();

	const PoliIcon = $derived(getPolyclinicIconComponent(section.polyclinic.icon));
</script>

<section
	class="poli-group-section"
	style="flex: {Math.max(section.doctors.length, 1)};"
	aria-label={section.polyclinic.name}
>
	<!-- Header Baris Poli: Pill Badge, Garis Konektor, dan Counter Dokter -->
	<div class="poli-header-row">
		<div class="poli-badge">
			<div class="poli-icon-wrap" aria-hidden="true">
				<PoliIcon size={14} />
			</div>
			<h2 class="poli-name">{section.polyclinic.name}</h2>
		</div>

		<div class="poli-connector-line" aria-hidden="true"></div>

		<div class="doctor-count-badge">
			<span>{section.doctors.length} Dokter</span>
		</div>
	</div>

	<!-- List Kartu Dokter / Empty State -->
	<div class="doctors-container">
		{#if section.doctors && section.doctors.length > 0}
			{#each section.doctors as docData (docData.doctor.id)}
				<DoctorCard data={docData} {currentDayOfWeek} {onCardClick} />
			{/each}
		{:else}
			<div class="empty-doctor-card">
				<Inbox size={26} class="empty-icon" />
				<p class="empty-text">Belum ada dokter yang dijadwalkan pada poliklinik ini.</p>
			</div>
		{/if}
	</div>
</section>

<style>
	.poli-group-section {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 0;
		gap: clamp(0.35rem, 0.62vh, 0.58rem);
	}

	.poli-header-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.poli-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: linear-gradient(135deg, #0A5C36 0%, #0D7A48 100%);
		border: 1.5px solid #E06A26;
		padding: 0.28rem 0.92rem 0.28rem 0.45rem;
		border-radius: 9999px;
		color: #FFFFFF;
		box-shadow: 0 3px 10px rgba(10, 92, 54, 0.2);
	}

	.poli-icon-wrap {
		width: 23px;
		height: 23px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #FED7AA;
		flex-shrink: 0;
	}

	.poli-name {
		font-size: 0.86rem;
		font-weight: 850;
		letter-spacing: 0.035em;
		margin: 0;
		line-height: 1;
		color: #FFFFFF;
	}

	.poli-connector-line {
		flex: 1;
		height: 1.5px;
		background: linear-gradient(90deg, #E06A26 0%, rgba(226, 232, 240, 0.6) 100%);
		opacity: 0.6;
	}

	.doctor-count-badge {
		font-size: 0.78rem;
		font-weight: 750;
		color: #475569;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.doctors-container {
		display: flex;
		flex-direction: column;
		justify-content: space-around;
		flex: 1;
		min-height: 0;
		gap: clamp(0.55rem, 0.95vh, 0.88rem);
	}

	.empty-doctor-card {
		background: #FFFFFF;
		border-radius: 1.25rem;
		padding: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		border: 1px dashed #CBD5E1;
		color: #64748B;
	}

	:global(.empty-icon) {
		color: #94A3B8;
	}

	.empty-text {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0;
	}
</style>
