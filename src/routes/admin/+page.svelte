<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Building2,
		UserCheck,
		CalendarCheck,
		ImagePlay,
		ArrowUpRight,
		PlusCircle,
		Tv,
		Clock,
		Sliders,
		X
	} from '@lucide/svelte';
	import { DataRepository } from '$lib/services/data.repository';
	import { StatusEngine } from '$lib/services/status.engine';
	import type { Doctor, Polyclinic, WeeklySchedule, ScheduleOverride, AuditLog } from '$lib/types';

	let isLivePreviewOpen = $state(false);

	let stats = $state({
		activePolyclinics: 0,
		activeDoctors: 0,
		schedulesToday: 0,
		activeMedia: 0,
		dayName: 'Hari Ini',
		currentDayOfWeek: 1
	});

	let auditLogs = $state<AuditLog[]>([]);

	let todaySchedulesList = $state<Array<{
		docName: string;
		poliName: string;
		timeRange: string;
		statusLabel: string;
		statusColor: string;
	}>>([]);

	function handleClearLogs() {
		DataRepository.clearAuditLogs();
		auditLogs = [];
	}

	function loadDashboardData() {
		stats = DataRepository.getDashboardStats();
		auditLogs = DataRepository.getAuditLogs();

		const schedules = DataRepository.getAllWeeklySchedules();
		const doctors = DataRepository.getDoctors();
		const polyclinics = DataRepository.getPolyclinics();
		const overrides = DataRepository.getOverrides();
		const settings = DataRepository.getSettings();

		const todaySchs = schedules.filter((s) => s.day_of_week === stats.currentDayOfWeek && s.is_active);

		todaySchedulesList = todaySchs.map((sch) => {
			const doc = doctors.find((d) => d.id === sch.doctor_id) || {
				id: sch.doctor_id,
				full_name: 'Dokter ID ' + sch.doctor_id,
				is_active: true,
				display_order: 1
			};
			const poli = polyclinics.find((p) => p.id === sch.polyclinic_id) || {
				id: sch.polyclinic_id,
				name: 'Poliklinik',
				code: 'POL',
				is_active: true,
				display_order: 1
			};

			const evalResult = StatusEngine.resolveDoctorStatus(
				doc,
				poli,
				schedules,
				overrides,
				settings.timezone || 'Asia/Makassar'
			);

			const colorMap: Record<string, string> = {
				open: '#059669',
				break: '#D97706',
				upcoming: '#0284C7',
				holiday: '#64748B',
				closed: '#DC2626'
			};

			return {
				docName: doc.full_name,
				poliName: poli.name,
				timeRange: `${sch.start_time.slice(0, 5)} - ${sch.end_time.slice(0, 5)}`,
				statusLabel: evalResult.status.label,
				statusColor: colorMap[evalResult.status.type] || '#64748B'
			};
		});
	}

	onMount(() => {
		loadDashboardData();
	});

	let summaryCards = $derived([
		{ label: 'Poliklinik Aktif', value: stats.activePolyclinics.toString(), icon: Building2, color: '#0A5C36', bg: '#E8F5E9', href: '/admin/poli' },
		{ label: 'Dokter Aktif', value: stats.activeDoctors.toString(), icon: UserCheck, color: '#0284C7', bg: '#E0F2FE', href: '/admin/doctors-jadwal' },
		{ label: `Jadwal Hari Ini (${stats.dayName})`, value: stats.schedulesToday.toString(), icon: CalendarCheck, color: '#E06A26', bg: '#FEF3C7', href: '/admin/doctors-jadwal' },
		{ label: 'Media Pengumuman Aktif', value: stats.activeMedia.toString(), icon: ImagePlay, color: '#7C3AED', bg: '#F3E8FF', href: '/admin/media' }
	]);
</script>

<svelte:head>
	<title>Dashboard Admin - CMS Kiosk RSUD</title>
</svelte:head>

<div class="dashboard-page">
	<div class="page-header">
		<div>
			<h1 class="page-title">Ringkasan Operasional Kiosk</h1>
			<p class="page-desc">Monitoring status jadwal poliklinik dan kontrol display kiosk publik.</p>
		</div>
		<div class="header-actions">
			<button type="button" class="btn btn-outline" onclick={() => (isLivePreviewOpen = true)}>
				<Tv size={16} />
				Preview Live Kiosk
			</button>
			<a href="/kiosk" target="_blank" class="btn btn-outline-sub">
				<ArrowUpRight size={16} />
				Buka Tab Baru
			</a>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="stats-grid">
		{#each summaryCards as stat}
			{@const Icon = stat.icon}
			<a href={stat.href} class="stat-card">
				<div class="stat-icon-wrap" style="background-color: {stat.bg}; color: {stat.color};">
					<Icon size={24} />
				</div>
				<div class="stat-info">
					<span class="stat-value">{stat.value}</span>
					<span class="stat-label">{stat.label}</span>
				</div>
			</a>
		{/each}
	</div>

	<!-- Quick Actions & Status Banner -->
	<div class="section-grid">
		<div class="card quick-actions-card">
			<h2 class="card-title">Aksi Cepat Operasional</h2>
			<div class="action-buttons">
				<a href="/admin/doctors-jadwal" class="action-btn">
					<PlusCircle size={20} class="text-primary" />
					<div class="action-text">
						<strong>Update Status Praktik Dokter Hari Ini</strong>
						<span>Ubah status Buka, Istirahat, Cuti, atau Buka Lebih Awal dengan 1 klik</span>
					</div>
					<ArrowUpRight size={18} class="action-arrow" />
				</a>

				<a href="/admin/poli" class="action-btn">
					<Building2 size={20} class="text-primary" />
					<div class="action-text">
						<strong>Kelola Poliklinik</strong>
						<span>Atur nama poli, ikon, dan urutan tampilan</span>
					</div>
					<ArrowUpRight size={18} class="action-arrow" />
				</a>

				<a href="/admin/media" class="action-btn">
					<ImagePlay size={20} class="text-primary" />
					<div class="action-text">
						<strong>Upload Media Pengumuman</strong>
						<span>Unggah gambar edukasi atau video informasi</span>
					</div>
					<ArrowUpRight size={18} class="action-arrow" />
				</a>
			</div>
		</div>

		<div class="card status-card">
			<h2 class="card-title">Status Sistem Kiosk</h2>
			<div class="system-status-list">
				<div class="status-row">
					<span class="status-name">Koneksi Layar Kiosk</span>
					<span class="badge-status-ok">Normal (Aktif)</span>
				</div>
				<div class="status-row">
					<span class="status-name">Orientasi Layar Target</span>
					<span class="value-text">Portrait 9:16 (1080×1920)</span>
				</div>
				<div class="status-row">
					<span class="status-name">Fase Sistem</span>
					<span class="badge-phase">Phase 12 — Ready for Production Launch</span>
				</div>
				<div class="status-row">
					<span class="status-name">Jadwal Hari Ini</span>
					<span class="value-text">{stats.dayName} ({stats.schedulesToday} dokter)</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Pratinjau Cepat Dokter Hari Ini -->
	{#if todaySchedulesList.length > 0}
		<div class="card today-preview-card">
			<div class="preview-header">
				<h2 class="card-title" style="margin: 0;">Pratinjau Praktik Dokter Hari Ini ({stats.dayName})</h2>
				<a href="/admin/doctors-jadwal" class="see-all-link">
					Kelola Status Praktik
					<ArrowUpRight size={16} />
				</a>
			</div>
			<div class="preview-grid">
				{#each todaySchedulesList as item}
					<div class="doc-preview-item">
						<div class="doc-meta">
							<strong class="doc-name-preview">{item.docName}</strong>
							<span class="doc-poli-preview">{item.poliName} • {item.timeRange} WITA</span>
						</div>
						<span class="status-pill-preview" style="background-color: {item.statusColor};">
							{item.statusLabel}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Riwayat Aktivitas & Audit Log (PRD Section 10 & 28) -->
	<div class="card audit-card">
		<div class="audit-header">
			<div class="audit-title-wrap">
				<Clock size={22} class="text-primary" />
				<div>
					<h2 class="card-title" style="margin: 0;">Riwayat Aktivitas & Perubahan Terakhir (Audit Log)</h2>
					<p class="audit-desc">Pencatatan riwayat pembaruan poliklinik, dokter, status praktik, media, dan kiosk settings.</p>
				</div>
			</div>
			{#if auditLogs.length > 0}
				<button type="button" class="btn-clear-logs" onclick={handleClearLogs}>
					Bersihkan Riwayat
				</button>
			{/if}
		</div>

		<div class="audit-timeline">
			{#if auditLogs.length === 0}
				<div class="empty-audit">Belum ada riwayat aktivitas yang tercatat.</div>
			{:else}
				{#each auditLogs.slice(0, 8) as log}
					<div class="audit-item">
						<div class="audit-dot"></div>
						<div class="audit-content">
							<div class="audit-meta">
								<span class="audit-action">{log.action}</span>
								<span class="audit-actor">• {log.actor_name}</span>
								<span class="audit-time">
									{new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
								</span>
							</div>
							<p class="audit-details">{log.details}</p>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Modal Preview Kiosk Interaktif di Dashboard -->
	{#if isLivePreviewOpen}
		<div class="preview-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="live-preview-title">
			<div class="preview-modal-card">
				<div class="preview-modal-header">
					<div class="preview-header-meta">
						<div class="live-indicator">
							<span class="live-dot"></span>
							<strong id="live-preview-title">Live Interactive Kiosk Preview</strong>
						</div>
						<span class="preview-note">Layar dapat disentuh & dioperasikan langsung (mode interaktif aktif)</span>
					</div>
					<div class="preview-header-actions">
						<a href="/kiosk" target="_blank" class="btn-open-tab" title="Buka di tab layar penuh">
							<ArrowUpRight size={16} />
							<span>Fullscreen Tab</span>
						</a>
						<button
							type="button"
							class="btn-close-preview"
							onclick={() => (isLivePreviewOpen = false)}
							aria-label="Tutup Preview"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div class="kiosk-iframe-container">
					<iframe src="/kiosk" title="Live Preview Kiosk Jadwal" class="kiosk-preview-frame"></iframe>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.dashboard-page {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-title {
		font-size: 1.6rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.page-desc {
		font-size: 0.9rem;
		color: #64748B;
		margin: 0.35rem 0 0 0;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		border-radius: 0.65rem;
		font-size: 0.875rem;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn-outline {
		border: 1px solid #CBD5E1;
		background: white;
		color: #334155;
	}

	.btn-outline:hover {
		border-color: #0A5C36;
		color: #0A5C36;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1.25rem;
	}

	.stat-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		align-items: center;
		gap: 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.stat-icon-wrap {
		width: 52px;
		height: 52px;
		border-radius: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stat-info {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 800;
		color: #0F172A;
		line-height: 1.1;
	}

	.stat-label {
		font-size: 0.825rem;
		color: #64748B;
		font-weight: 500;
	}

	.section-grid {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 1.5rem;
	}

	@media (max-width: 900px) {
		.section-grid {
			grid-template-columns: 1fr;
		}
	}

	.card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1.25rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 700;
		color: #0F172A;
		margin: 0 0 1.25rem 0;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid #F1F5F9;
		background: #F8FAFC;
		border-radius: 0.85rem;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		border-color: #A7F3D0;
		background: #F0FDF4;
		transform: translateX(4px);
	}

	.action-text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.action-text strong {
		font-size: 0.925rem;
		color: #0F172A;
	}

	.action-text span {
		font-size: 0.775rem;
		color: #64748B;
	}

	:global(.action-arrow) {
		color: #94A3B8;
	}

	.system-status-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid #F1F5F9;
		font-size: 0.875rem;
	}

	.status-row:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.status-name {
		color: #64748B;
	}

	.badge-status-ok {
		background: #D1FAE5;
		color: #047857;
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.badge-phase {
		background: #FEF3C7;
		color: #B45309;
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.value-text {
		color: #1E293B;
		font-weight: 600;
	}

	/* Today Preview Card */
	.today-preview-card {
		margin-top: 0.5rem;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}

	.see-all-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.825rem;
		font-weight: 700;
		color: #0A5C36;
		transition: color 0.15s;
	}

	.see-all-link:hover {
		color: #074327;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.doc-preview-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1rem;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 0.75rem;
	}

	.doc-meta {
		display: flex;
		flex-direction: column;
	}

	.doc-name-preview {
		font-size: 0.875rem;
		color: #0F172A;
		font-weight: 750;
	}

	.doc-poli-preview {
		font-size: 0.75rem;
		color: #64748B;
		margin-top: 0.15rem;
	}

	.status-pill-preview {
		color: white;
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.25rem 0.6rem;
		border-radius: 9999px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	/* Audit Card Styles */
	.audit-card {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.audit-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		border-bottom: 1px solid #F1F5F9;
		padding-bottom: 1rem;
	}

	.audit-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.audit-desc {
		font-size: 0.8rem;
		color: #64748B;
		margin: 0.25rem 0 0 0;
	}

	.btn-clear-logs {
		font-size: 0.75rem;
		color: #64748B;
		background: #F1F5F9;
		border: 1px solid #CBD5E1;
		padding: 0.35rem 0.75rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-clear-logs:hover {
		background: #E2E8F0;
		color: #0F172A;
	}

	.audit-timeline {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: relative;
		padding-left: 0.5rem;
	}

	.empty-audit {
		font-size: 0.85rem;
		color: #94A3B8;
		font-style: italic;
		padding: 1rem 0;
	}

	.audit-item {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		position: relative;
	}

	.audit-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #0A5C36;
		margin-top: 0.35rem;
		flex-shrink: 0;
		box-shadow: 0 0 0 3px #E8F5E9;
	}

	.audit-content {
		flex: 1;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 0.65rem;
		padding: 0.65rem 0.85rem;
	}

	.audit-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		margin-bottom: 0.2rem;
	}

	.audit-action {
		font-weight: 750;
		color: #0F172A;
	}

	.audit-actor {
		color: #64748B;
	}

	.audit-time {
		margin-left: auto;
		color: #94A3B8;
		font-family: monospace;
	}

	.audit-details {
		font-size: 0.8rem;
		color: #475569;
		margin: 0;
		line-height: 1.4;
	}

	/* In-Dashboard Live Preview Modal */
	.btn-outline-sub {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.95rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 600;
		color: #475569;
		text-decoration: none;
		background: white;
		transition: all 0.15s ease;
	}

	.btn-outline-sub:hover {
		background: #F1F5F9;
		color: #0F172A;
	}

	.preview-modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.78);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.25rem;
		animation: fadeIn 0.2s ease-out;
	}

	.preview-modal-card {
		background: #1E293B;
		border-radius: 1.5rem;
		width: 100%;
		max-width: 500px;
		height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		border: 1px solid #334155;
		overflow: hidden;
	}

	.preview-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1.25rem;
		background: #0F172A;
		border-bottom: 1px solid #334155;
		color: #F8FAFC;
	}

	.preview-header-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.live-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #F8FAFC;
	}

	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #10B981;
		box-shadow: 0 0 8px #10B981;
		animation: pulseLive 2s infinite;
	}

	@keyframes pulseLive {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}

	.preview-note {
		font-size: 0.725rem;
		color: #94A3B8;
	}

	.preview-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-open-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		background: #334155;
		color: #CBD5E1;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s;
	}

	.btn-open-tab:hover {
		background: #475569;
		color: white;
	}

	.btn-close-preview {
		width: 32px;
		height: 32px;
		background: #334155;
		color: #94A3B8;
		border-radius: 50%;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-close-preview:hover {
		background: #EF4444;
		color: white;
	}

	.kiosk-iframe-container {
		flex: 1;
		width: 100%;
		background: #EEF5F1;
		overflow: hidden;
		position: relative;
	}

	.kiosk-preview-frame {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
			display: flex;
			gap: 0.5rem;
		}

		.header-actions .btn {
			flex: 1;
			justify-content: center;
			font-size: 0.8rem;
			padding: 0.6rem 0.75rem;
		}

		.stats-grid {
			grid-template-columns: 1fr;
			gap: 0.85rem;
		}

		.preview-modal-card {
			width: 96vw;
			height: 94vh;
		}
	}
</style>
