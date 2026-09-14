<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Lock,
		LockOpen,
		LayoutDashboard,
		X,
		Calendar,
		Clock,
		MapPin,
		Sparkles
	} from '@lucide/svelte';
	import KioskHeader from './components/KioskHeader.svelte';
	import PageIndicator from './components/PageIndicator.svelte';
	import EmergencyBanner from './components/EmergencyBanner.svelte';
	import KioskFooter from './components/KioskFooter.svelte';
	import PoliSection from './components/PoliSection.svelte';
	import AnnouncementSlide from './components/AnnouncementSlide.svelte';
	import PinModal from './components/PinModal.svelte';
	import { KioskDataService } from '$lib/services/kiosk-data.service';
	import { DataRepository } from '$lib/services/data.repository';
	import { AuthService } from '$lib/services/auth.service';
	import { kioskSettings } from '$lib/stores/kiosk.store';
	import { SlideshowEngine, type SlideshowState } from '$lib/services/slideshow.engine';
	import { OfflineService } from '$lib/services/offline.service';
	import type { KioskSettings, DoctorScheduleCardData } from '$lib/types';

	const initialData = KioskDataService.generateKioskSlides();
	let currentDayOfWeek = $state(initialData.currentDayOfWeek);
	let engine = $state<SlideshowEngine | null>(null);
	let activeSettings = $state<KioskSettings>(initialData.settings);
	let syncTimer: ReturnType<typeof setInterval> | null = null;
	let isPinModalOpen = $state(false);
	let isQuickActionOpen = $state(false);
	let selectedDoctor = $state<DoctorScheduleCardData | null>(null);

	const dayNames: Record<number, string> = {
		1: 'Senin',
		2: 'Selasa',
		3: 'Rabu',
		4: 'Kamis',
		5: 'Jumat',
		6: 'Sabtu',
		7: 'Minggu'
	};

	let isOffline = $state(false);
	let lastSyncText = $state('');
	let unsubRealtime: (() => void) | null = null;
	let unsubAuth: (() => void) | null = null;
	let isUnlocked = $state(false);

	let engineState = $state<SlideshowState>({
		currentIndex: 0,
		totalSlides: initialData.slides.length,
		progressPercent: 0,
		isPaused: false,
		currentSlide: initialData.slides[0] || null
	});

	// Pengendali gestur usap layar sentuh (Touch Swipe)
	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		if (!isUnlocked) return;
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchStartTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!isUnlocked) return;
		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		const elapsed = Date.now() - touchStartTime;

		// Deteksi usap horizontal (minimal 35px, dominan mendatar, dalam durasi wajar)
		if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && elapsed < 1200) {
			if (deltaX < 0) {
				// Geser ke kiri -> Halaman berikutnya (Next)
				engine?.next();
			} else {
				// Geser ke kanan -> Halaman sebelumnya (Prev)
				engine?.prev();
			}
		}
	}

	// Pengendali drag mouse (untuk simulator / uji coba klik drag)
	let mouseStartX = 0;
	let mouseStartY = 0;
	let isMouseDragging = false;

	function handleMouseDown(e: MouseEvent) {
		if (!isUnlocked) return;
		if ((e.target as HTMLElement).closest('button, a, input, .doctor-card, .quick-action-card, .doctor-modal-card')) return;
		mouseStartX = e.clientX;
		mouseStartY = e.clientY;
		isMouseDragging = true;
	}

	function handleMouseUp(e: MouseEvent) {
		if (!isUnlocked || !isMouseDragging) return;
		isMouseDragging = false;
		const deltaX = e.clientX - mouseStartX;
		const deltaY = e.clientY - mouseStartY;
		if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
			if (deltaX < 0) {
				engine?.next();
			} else {
				engine?.prev();
			}
		}
	}

	function handleDoctorCardClick(doctorData: DoctorScheduleCardData) {
		if (isUnlocked) {
			selectedDoctor = doctorData;
		}
	}

	function openPinModal() {
		isPinModalOpen = true;
		engine?.pause();
	}

	function closePinModal() {
		isPinModalOpen = false;
		engine?.resume();
	}

	function handleLockClick() {
		if (isUnlocked) {
			// Saat kiosk sudah dalam mode terbuka (unlocked), klik ikon gembok terbuka memunculkan opsi
			isQuickActionOpen = true;
		} else {
			// Saat kiosk terkunci, klik ikon gembok tertutup membuka modal input PIN
			openPinModal();
		}
	}

	function handleLockKioskAgain() {
		AuthService.logout();
		isUnlocked = false;
		isQuickActionOpen = false;
		selectedDoctor = null;
	}

	let isBrowserFullscreen = $state(false);

	// Fungsi Auto Fullscreen Lintas Browser (PC, Android, Totem Kiosk TV)
	async function requestKioskFullscreen() {
		if (typeof document === 'undefined') return;
		const doc = document as any;
		const docEl = document.documentElement as any;
		const isFull = Boolean(
			doc.fullscreenElement ||
			doc.webkitFullscreenElement ||
			doc.mozFullScreenElement ||
			doc.msFullscreenElement
		);

		if (isFull) {
			isBrowserFullscreen = true;
			return;
		}

		try {
			if (docEl.requestFullscreen) {
				await docEl.requestFullscreen({ navigationUI: 'hide' });
			} else if (docEl.webkitRequestFullscreen) {
				await docEl.webkitRequestFullscreen();
			} else if (docEl.mozRequestFullScreen) {
				await docEl.mozRequestFullScreen();
			} else if (docEl.msRequestFullscreen) {
				await docEl.msRequestFullscreen();
			}
			isBrowserFullscreen = true;
		} catch (err) {
			// Jika browser membatasi auto-fullscreen sebelum ada user interaction,
			// listener gesture (click/touch) di bawah akan memicunya pada sentuhan pertama.
		}

		// Kunci orientasi ke portrait pada browser seluler/Android TV jika didukung
		try {
			if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
				await (screen.orientation as any).lock('portrait');
			}
		} catch (_) {}
	}

	// Fungsi memuat atau menyinkronkan data secara halus (tanpa flicker) dengan fallback snapshot
	function refreshKioskData(forceRealtime = false) {
		try {
			const result = KioskDataService.generateKioskSlides({ forceRealtime });
			currentDayOfWeek = result.currentDayOfWeek;
			activeSettings = result.settings;

			// Simpan snapshot sukses ke penyimpanan offline lokal
			OfflineService.saveSnapshot(result.slides, result.settings, result.currentDayOfWeek);

			if (engine) {
				engine.updateSlides(result.slides);
				engine.updateSettings(result.settings);
			} else {
				// Inisialisasi awal
				const slideshow = new SlideshowEngine(result.slides, result.settings);
				engine = slideshow;

				slideshow.state.subscribe((val) => {
					engineState = val;
				});

				slideshow.start();
			}
		} catch (err) {
			console.warn('[Kiosk] Gagal menyinkronkan data, memuat snapshot cadangan:', err);
			const snapshot = OfflineService.loadSnapshot();
			if (snapshot) {
				currentDayOfWeek = snapshot.currentDayOfWeek;
				activeSettings = snapshot.settings;
				if (engine) {
					engine.updateSlides(snapshot.slides);
					engine.updateSettings(snapshot.settings);
				}
			}
		}
	}

	let unsubOffline: (() => void) | null = null;
	let unsubSync: (() => void) | null = null;

	onMount(() => {
		// 1. Eksekusi Fullscreen Otomatis saat pembukaan web
		requestKioskFullscreen();
		const fsTimer = setTimeout(() => {
			requestKioskFullscreen();
		}, 800);

		// 2. Gesture listener (sentuhan/klik pertama pada browser PC & Android yang mewajibkan user activation)
		const handleGestureActivation = () => {
			requestKioskFullscreen();
		};

		const handleFsChange = () => {
			const doc = document as any;
			isBrowserFullscreen = Boolean(
				doc.fullscreenElement ||
				doc.webkitFullscreenElement ||
				doc.mozFullScreenElement ||
				doc.msFullscreenElement
			);
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('click', handleGestureActivation, { passive: true });
			window.addEventListener('touchstart', handleGestureActivation, { passive: true });
			window.addEventListener('pointerdown', handleGestureActivation, { passive: true });
			window.addEventListener('keydown', handleGestureActivation, { passive: true });
			document.addEventListener('fullscreenchange', handleFsChange);
			document.addEventListener('webkitfullscreenchange', handleFsChange);
		}

		// Inisialisasi status kunci / otorisasi
		isUnlocked = AuthService.isAuthorized();
		unsubAuth = AuthService.sessionStore.subscribe((session) => {
			isUnlocked = !!session && session.isAuthorized;
		});

		// Inisialisasi OfflineService & langganan status
		OfflineService.init();

		unsubOffline = OfflineService.isOffline.subscribe((val) => {
			isOffline = val;
			if (!val) {
				// Ketika koneksi pulih kembali, langsung segarkan data tanpa flicker
				refreshKioskData(true);
			}
		});

		unsubSync = OfflineService.lastSyncTime.subscribe((val) => {
			lastSyncText = val;
		});

		// Inisialisasi awal data dinamis (memuat dan meng-cache seluruh aset)
		refreshKioskData(true);

		// Berlangganan perubahan Realtime Supabase (perubahan di CMS langsung realtime)
		unsubRealtime = DataRepository.subscribeToRealtimeChanges(() => {
			refreshKioskData(true);
		});

		const handleStorage = (e: StorageEvent) => {
			if (e.key && e.key.includes('kiosk_')) {
				refreshKioskData(true);
			}
		};

		const handleCustomUpdate = () => {
			refreshKioskData(true);
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('storage', handleStorage);
			window.addEventListener('kiosk-data-updated', handleCustomUpdate);
		}

		// Sinkronisasi otomatis di background (Interval 30s: hanya status jadwal, media di-cache 1 jam)
		const intervalSec = activeSettings.refresh_interval_seconds || 30;
		syncTimer = setInterval(() => {
			refreshKioskData(false);
		}, intervalSec * 1000);

		return () => {
			clearTimeout(fsTimer);
			if (unsubAuth) unsubAuth();
			if (unsubOffline) unsubOffline();
			if (unsubSync) unsubSync();
			if (unsubRealtime) unsubRealtime();
			if (typeof window !== 'undefined') {
				window.removeEventListener('storage', handleStorage);
				window.removeEventListener('kiosk-data-updated', handleCustomUpdate);
				window.removeEventListener('click', handleGestureActivation);
				window.removeEventListener('touchstart', handleGestureActivation);
				window.removeEventListener('pointerdown', handleGestureActivation);
				window.removeEventListener('keydown', handleGestureActivation);
				document.removeEventListener('fullscreenchange', handleFsChange);
				document.removeEventListener('webkitfullscreenchange', handleFsChange);
			}
			if (syncTimer) clearInterval(syncTimer);
			engine?.destroy();
		};
	});

	onDestroy(() => {
		if (unsubAuth) unsubAuth();
		if (unsubOffline) unsubOffline();
		if (unsubSync) unsubSync();
		if (unsubRealtime) unsubRealtime();
		if (syncTimer) clearInterval(syncTimer);
		engine?.destroy();
	});

	// Pantau jika ada perubahan store pengaturan lokal dari CMS
	$effect(() => {
		if ($kioskSettings && engine) {
			activeSettings = $kioskSettings;
			engine.updateSettings($kioskSettings);
		}
	});

	// Mode Tampilan Layar Signage: 43" (53.5x95.2cm), 55" (68.5x121.8cm), 65" (80.9x143.9cm)
	let currentScreenMode = $state<'43' | '55' | '65'>('55');

	$effect(() => {
		const param = page.url.searchParams.get('mode') || page.url.searchParams.get('screen');
		if (param === '43' || param === '55' || param === '65') {
			currentScreenMode = param;
		} else if (activeSettings.screen_mode === '43' || activeSettings.screen_mode === '55' || activeSettings.screen_mode === '65') {
			currentScreenMode = activeSettings.screen_mode;
		} else {
			currentScreenMode = '55';
		}
	});

	// Token CSS Signage berdasarkan 3 Mode Presisi Ukuran Monitor Digital Signage
	let signageTokens = $derived(() => {
		const baseFont = activeSettings.font_scale ?? 1.0;
		const baseCard = activeSettings.card_scale ?? 1.0;
		const baseHeader = activeSettings.header_scale ?? 1.0;
		const baseFooter = activeSettings.footer_scale ?? 1.0;

		switch (currentScreenMode) {
			case '43':
				// Panel 53.5 x 95.2 cm: Jarak 1.5 - 2.5m (Kompak & Padat)
				return {
					fontScale: 0.88 * baseFont,
					cardScale: 0.77 * baseCard,
					headerScale: 0.88 * baseHeader,
					footerScale: 0.88 * baseFooter,
					headerHeight: Math.round(120 * baseHeader) + 'px',
					footerHeight: Math.round(124 * baseFooter) + 'px',
					contentGap: (0.85 * baseCard).toFixed(2) + 'rem',
					doctorPhotoW: Math.round(92 * baseCard) + 'px',
					doctorPhotoH: Math.round(103 * baseCard) + 'px',
					doctorNameSize: (1.04 * baseFont).toFixed(2) + 'rem',
					label: '43" (53,5 × 95,2 cm)'
				};
			case '65':
				// Panel 80.9 x 143.9 cm: Jarak 4 - 7+ m (Monumental & Megah)
				return {
					fontScale: 1.06 * baseFont,
					cardScale: 0.95 * baseCard,
					headerScale: 1.05 * baseHeader,
					footerScale: 1.04 * baseFooter,
					headerHeight: Math.round(148 * baseHeader) + 'px',
					footerHeight: Math.round(152 * baseFooter) + 'px',
					contentGap: (1.15 * baseCard).toFixed(2) + 'rem',
					doctorPhotoW: Math.round(115 * baseCard) + 'px',
					doctorPhotoH: Math.round(130 * baseCard) + 'px',
					doctorNameSize: (1.24 * baseFont).toFixed(2) + 'rem',
					label: '65" (80,9 × 143,9 cm)'
				};
			case '55':
			default:
				// Panel 68.5 x 121.8 cm: Standar RSUD Fortu Digital E550HZI (Skala Megah, Proporsional & Rapi)
				return {
					fontScale: 0.95 * baseFont,
					cardScale: 0.85 * baseCard,
					headerScale: 1.0 * baseHeader,
					footerScale: 1.0 * baseFooter,
					headerHeight: Math.round(132 * baseHeader) + 'px',
					footerHeight: Math.round(140 * baseFooter) + 'px',
					contentGap: (0.98 * baseCard).toFixed(2) + 'rem',
					doctorPhotoW: Math.round(106 * baseCard) + 'px',
					doctorPhotoH: Math.round(118 * baseCard) + 'px',
					doctorNameSize: (1.12 * baseFont).toFixed(2) + 'rem',
					label: '55" (68,5 × 121,8 cm)'
				};
		}
	});
</script>

<svelte:head>
	<title>{activeSettings.hospital_name || 'Jadwal Poliklinik RSUD'}</title>
</svelte:head>

<div class="kiosk-viewport mode-{currentScreenMode}">
	<div
		class="kiosk-portrait-frame mode-{currentScreenMode}"
		style="
			--font-scale: {signageTokens().fontScale};
			--card-scale: {signageTokens().cardScale};
			--header-scale: {signageTokens().headerScale};
			--footer-scale: {signageTokens().footerScale};
			--kiosk-header-height: {signageTokens().headerHeight};
			--kiosk-footer-height: {signageTokens().footerHeight};
			--content-gap: {signageTokens().contentGap};
			--doctor-photo-w: {signageTokens().doctorPhotoW};
			--doctor-photo-h: {signageTokens().doctorPhotoH};
			--doctor-name-size: {signageTokens().doctorNameSize};
		"
	>
		<!-- Header Kiosk Dinamis (Ikon Gembok Berubah Otomatis Sesuai Status Terbuka/Terkunci) -->
		<KioskHeader
			hospitalName={activeSettings.hospital_name}
			hospitalSubtitle={activeSettings.hospital_subtitle}
			logoUrl={activeSettings.hospital_logo_url}
			timezone={activeSettings.timezone}
			isOffline={isOffline}
			lastSyncText={lastSyncText}
			currentPage={engineState.currentIndex + 1}
			totalPages={engineState.totalSlides}
			slideDuration={activeSettings.slide_duration_seconds || 15}
			progressPercent={engineState.progressPercent}
			{isUnlocked}
			onLockClick={handleLockClick}
			onPageChange={(page) => engine?.goTo(page - 1)}
		/>

		<!-- Area Interaktif Kiosk yang Terkunci / Terbuka sesuai Status Sesi -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="kiosk-interactive-stage"
			class:locked={!isUnlocked}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			onmousedown={handleMouseDown}
			onmouseup={handleMouseUp}
		>
			<!-- Bar Indikator Status Saat Kiosk Tidak Terkunci (Mode Interaktif Sentuh Aktif) -->
			{#if isUnlocked}
				<div class="interactive-mode-bar">
					<div class="mode-info">
						<span class="pulse-live-dot"></span>
						<span>Mode Sentuh Aktif • Signage {signageTokens().label}</span>
					</div>

					<!-- 3 Quick Mode Switcher Pills untuk Pengujian Langsung di Layar TV -->
					<div class="mode-switcher-group">
						<button
							type="button"
							class="pill-mode-btn"
							class:active={currentScreenMode === '43'}
							onclick={() => (currentScreenMode = '43')}
							title="Digital Signage 43 Inch (Panel 53,5 × 95,2 cm)"
						>
							43"
						</button>
						<button
							type="button"
							class="pill-mode-btn"
							class:active={currentScreenMode === '55'}
							onclick={() => (currentScreenMode = '55')}
							title="Digital Signage 55 Inch (Panel 68,5 × 121,8 cm) - Standar RSUD"
						>
							55"
						</button>
						<button
							type="button"
							class="pill-mode-btn"
							class:active={currentScreenMode === '65'}
							onclick={() => (currentScreenMode = '65')}
							title="Digital Signage 65 Inch (Panel 80,9 × 143,9 cm) - Lobi Utama"
						>
							65"
						</button>
					</div>

					<button
						type="button"
						class="btn-quick-relock"
						onclick={handleLockKioskAgain}
						title="Kunci Kembali Layar Kiosk"
					>
						<Lock size={13} />
						<span>Kunci Layar</span>
					</button>
				</div>
			{/if}

			<!-- Emergency Banner Dinamis (Dapat Diaktifkan Lewat CMS) -->
			<EmergencyBanner
				isActive={activeSettings.show_emergency_banner}
				title={activeSettings.emergency_title}
				message={activeSettings.emergency_message}
				level={activeSettings.emergency_level}
			/>

			<!-- Main Content Area: Slideshow Engine Container -->
			<main class="kiosk-content-body">
				{#if engineState.currentSlide}
					{#key engineState.currentSlide.id}
						<div class="slide-content-stage">
							{#if engineState.currentSlide.type === 'schedule'}
								{#if engineState.currentSlide.sections && engineState.currentSlide.sections.length > 0}
									<div class="schedule-list">
										{#each engineState.currentSlide.sections as section, sIdx (section.polyclinic.id + '-' + sIdx)}
											<PoliSection
												{section}
												{currentDayOfWeek}
												onCardClick={handleDoctorCardClick}
											/>
										{/each}
									</div>
								{:else}
									<div class="empty-kiosk-state">
										<h3>Belum Ada Jadwal Poliklinik Aktif</h3>
										<p>Jadwal praktik dokter akan segera diperbarui oleh petugas rumah sakit.</p>
									</div>
								{/if}
							{:else if engineState.currentSlide.type === 'media'}
								<AnnouncementSlide
									media={engineState.currentSlide.media}
									soundEnabled={activeSettings.video_sound_enabled ?? true}
									onSlideComplete={() => engine?.onVideoCompleted()}
									onProgress={(p) => engine?.setProgress(p)}
								/>
							{/if}
						</div>
					{/key}
				{/if}

				<!-- Pagination Dots di Bawah Konten (Sekarang Touch/Click Responsif) -->
				{#if activeSettings.show_page_indicator ?? true}
					<div class="pagination-wrapper">
						<PageIndicator
							currentPage={engineState.currentIndex + 1}
							totalPages={engineState.totalSlides}
							variant="dots"
							onPageSelect={(page) => engine?.goTo(page - 1)}
						/>
					</div>
				{/if}
			</main>

			<!-- Footer Notices & Running Text Ticker Dinamis -->
			<KioskFooter
				runningText={activeSettings.running_text}
				runningTextSpeed={activeSettings.running_text_speed}
				runningTextDirection={activeSettings.running_text_direction || 'left'}
				showNotices={activeSettings.show_footer_notices}
				showRunningText={activeSettings.show_running_text}
			/>
		</div>

		<!-- Detail Modal Interaktif Saat Dokter Disentuh di Layar Kiosk -->
		{#if selectedDoctor}
			<div class="doctor-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title">
				<div class="doctor-modal-card">
					<button
						type="button"
						class="doc-modal-close"
						onclick={() => (selectedDoctor = null)}
						aria-label="Tutup detail dokter"
					>
						<X size={22} />
					</button>

					<div class="doc-modal-top">
						<div class="doc-modal-avatar-frame">
							{#if selectedDoctor.doctor.photo_url}
								<img src={selectedDoctor.doctor.photo_url} alt={selectedDoctor.doctor.full_name} class="doc-modal-img" />
							{:else}
								<div class="doc-modal-initials">
									{selectedDoctor.doctor.full_name.charAt(0)}
								</div>
							{/if}
						</div>
						<div class="doc-modal-heading">
							<span class="doc-modal-spec">{selectedDoctor.doctor.title || 'Dokter Spesialis'}</span>
							<h2 id="doc-modal-title" class="doc-modal-name">{selectedDoctor.doctor.full_name}</h2>
							<div class="doc-modal-status-badge">
								<span class="doc-dot"></span>
								<span>{selectedDoctor.status.label} • {selectedDoctor.status.subtext}</span>
							</div>
						</div>
					</div>

					<div class="doc-modal-body">
						<h3 class="doc-schedule-heading">
							<Calendar size={18} />
							<span>Jadwal Lengkap Praktik Mingguan</span>
						</h3>

						{#if selectedDoctor.schedules && selectedDoctor.schedules.length > 0}
							<div class="doc-schedule-grid">
								{#each selectedDoctor.schedules as sch}
									<div class="doc-sch-item" class:today-highlight={sch.day_of_week === currentDayOfWeek}>
										<div class="doc-sch-day">
											<span>{dayNames[sch.day_of_week] || `Hari ${sch.day_of_week}`}</span>
											{#if sch.day_of_week === currentDayOfWeek}
												<span class="today-tag">Hari Ini</span>
											{/if}
										</div>
										<div class="doc-sch-time">
											<Clock size={14} />
											<span>{sch.start_time.slice(0, 5)} - {sch.end_time.slice(0, 5)} WITA</span>
										</div>
										{#if sch.note}
											<div class="doc-sch-room">
												<MapPin size={14} />
												<span>{sch.note}</span>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="no-schedule-note">Jadwal mingguan lengkap belum dikonfigurasi.</p>
						{/if}
					</div>

					<div class="doc-modal-foot">
						<button type="button" class="doc-modal-btn-dismiss" onclick={() => (selectedDoctor = null)}>
							Tutup Detail Dokter
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Dialog Kontrol Cepat Saat Kiosk Sudah Terbuka (Unlocked) -->
		{#if isQuickActionOpen}
			<div class="quick-action-backdrop" role="dialog" aria-modal="true" aria-labelledby="quick-modal-title">
				<div class="quick-action-card">
					<button
						type="button"
						class="quick-close-btn"
						onclick={() => (isQuickActionOpen = false)}
						aria-label="Tutup dialog"
					>
						<X size={20} />
					</button>

					<div class="quick-icon-bubble">
						<LockOpen size={36} color="#059669" />
					</div>

					<h3 id="quick-modal-title" class="quick-title">Kiosk Sedang Terbuka</h3>
					<p class="quick-desc">
						Layar saat ini dalam mode interaktif (dapat disentuh langsung). Silakan pilih tindakan:
					</p>

					<div class="quick-btns">
						<button
							type="button"
							class="quick-btn btn-admin"
							onclick={() => {
								isQuickActionOpen = false;
								goto('/admin');
							}}
						>
							<LayoutDashboard size={20} />
							<span>Buka Dashboard CMS Admin</span>
						</button>
						<button
							type="button"
							class="quick-btn btn-relock"
							onclick={handleLockKioskAgain}
						>
							<Lock size={20} />
							<span>Kunci Kiosk Kembali</span>
						</button>
						<button
							type="button"
							class="quick-btn btn-stay"
							onclick={() => (isQuickActionOpen = false)}
						>
							<span>Lanjut di Layar Kiosk (Sentuh Aktif)</span>
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Virtual Touchscreen Keypad PIN Modal (Lock Kiosk) -->
		<PinModal
			isOpen={isPinModalOpen}
			onClose={closePinModal}
			onSuccessUnlock={() => {
				isUnlocked = true;
			}}
		/>
	</div>
</div>

<style>
	/* Viewport Kiosk Portrait 9:16 (Target Layar Digital Signage 43", 55", 65") */
	.kiosk-viewport {
		width: 100vw;
		height: 100vh;
		max-height: 100vh;
		background: #DCE7E1;
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}

	.kiosk-portrait-frame {
		width: 100%;
		max-width: 1080px;
		height: 100vh;
		max-height: 100vh;
		background: #EEF5F1;
		display: flex;
		flex-direction: column;
		box-shadow: 0 0 40px rgba(0, 0, 0, 0.15);
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
	}

	/* Area Panggung Interaktif yang Terkunci / Terbuka */
	.kiosk-interactive-stage {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		position: relative;
		transition: opacity 0.2s ease;
		overflow: hidden;
	}

	/* Ketika Terkunci: Sentuhan pada jadwal/kartu dinonaktifkan kecuali ikon gembok di header */
	.kiosk-interactive-stage.locked {
		pointer-events: none !important;
		user-select: none !important;
		-webkit-user-select: none !important;
		touch-action: none !important;
	}

	/* Content Body - Mengisi Sisa Ruang Antara Header & Footer Secara Presisi */
	.kiosk-content-body {
		flex: 1;
		min-height: 0;
		padding: clamp(0.4rem, 0.8vh, 0.85rem) clamp(1.1rem, 1.8vw, 1.85rem) 0 clamp(1.1rem, 1.8vw, 1.85rem);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		font-size: calc(1rem * var(--font-scale, 1));
		overflow: hidden;
		box-sizing: border-box;
	}

	.slide-content-stage {
		flex: 1;
		min-height: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: softFadeIn 0.35s ease-out;
	}

	.schedule-list {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--content-gap, 1.2rem);
		overflow: hidden;
	}

	.empty-kiosk-state {
		background: #FFFFFF;
		border-radius: 1.5rem;
		padding: 3.5rem 2rem;
		text-align: center;
		border: 1px dashed #CBD5E1;
		color: #64748B;
		margin: auto 0;
	}

	.empty-kiosk-state h3 {
		color: #0F172A;
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.pagination-wrapper {
		margin-top: 0.28rem;
		margin-bottom: 0.12rem;
		flex-shrink: 0;
	}

	/* Quick Action Modal (Saat Terbuka) */
	.quick-action-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(10, 25, 18, 0.72);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 120;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease-out;
	}

	.quick-action-card {
		background: #FFFFFF;
		width: 100%;
		max-width: 440px;
		border-radius: 2rem;
		padding: 2.25rem 2rem;
		box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
		position: relative;
		text-align: center;
		box-sizing: border-box;
	}

	.quick-close-btn {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #F1F5F9;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748B;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.quick-close-btn:hover {
		background: #E2E8F0;
		color: #0F172A;
	}

	.quick-icon-bubble {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background: #D1FAE5;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1rem;
		border: 3px solid #A7F3D0;
	}

	.quick-title {
		font-size: 1.4rem;
		font-weight: 850;
		color: #0F172A;
		margin: 0 0 0.4rem 0;
	}

	.quick-desc {
		font-size: 0.9rem;
		color: #64748B;
		margin: 0 0 1.5rem 0;
		line-height: 1.45;
	}

	.quick-btns {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.quick-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		padding: 0.9rem 1.25rem;
		border-radius: 0.95rem;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
		border: none;
		font-family: inherit;
		transition: all 0.2s ease;
		box-sizing: border-box;
		width: 100%;
	}

	.btn-admin {
		background: #0A5C36;
		color: #FFFFFF;
		box-shadow: 0 4px 14px rgba(10, 92, 54, 0.25);
	}

	.btn-admin:hover {
		background: #074327;
		transform: translateY(-1px);
	}

	.btn-relock {
		background: #FFF1F2;
		color: #DC2626;
		border: 1.5px solid #FECACA;
	}

	.btn-relock:hover {
		background: #FEE2E2;
		color: #B91C1C;
		transform: translateY(-1px);
	}

	.btn-stay {
		background: #F1F5F9;
		color: #475569;
		border: 1.5px solid #E2E8F0;
	}

	.interactive-mode-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: linear-gradient(90deg, #ECFDF5 0%, #D1FAE5 100%);
		border-bottom: 1.5px solid #6EE7B7;
		padding: 0.28rem 1rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: #065F46;
		z-index: 10;
		animation: fadeIn 0.25s ease-out;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.mode-switcher-group {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: rgba(255, 255, 255, 0.85);
		padding: 0.12rem 0.2rem;
		border-radius: 9999px;
		border: 1px solid #A7F3D0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.pill-mode-btn {
		background: transparent;
		border: none;
		border-radius: 9999px;
		font-size: 0.67rem;
		font-weight: 800;
		color: #065F46;
		padding: 0.15rem 0.55rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pill-mode-btn:hover {
		background: #D1FAE5;
	}

	.pill-mode-btn.active {
		background: #0A5C36;
		color: #FFFFFF;
		box-shadow: 0 1px 4px rgba(10, 92, 54, 0.3);
	}

	.mode-info {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.pulse-live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10B981;
		box-shadow: 0 0 8px #10B981;
		animation: pulseDot 1.5s infinite ease-in-out;
		flex-shrink: 0;
	}

	@keyframes pulseDot {
		0%, 100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.5;
		}
	}

	.btn-quick-relock {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: #FFFFFF;
		border: 1px solid #A7F3D0;
		color: #047857;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.55rem;
		border-radius: 0.45rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-quick-relock:hover {
		background: #FEE2E2;
		border-color: #FECACA;
		color: #DC2626;
	}

	/* Detail Modal Dokter Saat Disentuh */
	.doctor-modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.7);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 130;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease-out;
	}

	.doctor-modal-card {
		background: #FFFFFF;
		width: 100%;
		max-width: 520px;
		border-radius: 1.75rem;
		padding: 2rem;
		box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
		position: relative;
		box-sizing: border-box;
	}

	.doc-modal-close {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #F1F5F9;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748B;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.doc-modal-close:hover {
		background: #E2E8F0;
		color: #0F172A;
	}

	.doc-modal-top {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #E2E8F0;
	}

	.doc-modal-avatar-frame {
		width: 76px;
		height: 76px;
		border-radius: 1rem;
		background: #F1F5F9;
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
	}

	.doc-modal-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.doc-modal-initials {
		font-size: 1.75rem;
		font-weight: 800;
		color: #64748B;
	}

	.doc-modal-heading {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.doc-modal-spec {
		font-size: 0.78rem;
		font-weight: 700;
		color: #059669;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.doc-modal-name {
		font-size: 1.25rem;
		font-weight: 850;
		color: #0F172A;
		margin: 0;
		line-height: 1.2;
	}

	.doc-modal-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #F0FDF4;
		border: 1px solid #BBF7D0;
		color: #15803D;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		width: fit-content;
		margin-top: 0.25rem;
	}

	.doc-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #16A34A;
	}

	.doc-modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.doc-schedule-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.doc-schedule-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.65rem;
	}

	.doc-sch-item {
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 0.85rem;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.doc-sch-item.today-highlight {
		background: #ECFDF5;
		border-color: #34D399;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
	}

	.doc-sch-day {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		font-weight: 800;
		color: #1E293B;
	}

	.today-tag {
		font-size: 0.65rem;
		font-weight: 800;
		background: #059669;
		color: #FFFFFF;
		padding: 0.1rem 0.45rem;
		border-radius: 9999px;
	}

	.doc-sch-time,
	.doc-sch-room {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #64748B;
		font-weight: 600;
	}

	.no-schedule-note {
		font-size: 0.85rem;
		color: #94A3B8;
		font-style: italic;
		margin: 0;
	}

	.doc-modal-foot {
		margin-top: 1.5rem;
	}

	.doc-modal-btn-dismiss {
		width: 100%;
		background: #0A5C36;
		color: #FFFFFF;
		border: none;
		padding: 0.85rem;
		border-radius: 0.85rem;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.2s;
	}

	.doc-modal-btn-dismiss:hover {
		background: #074327;
	}

	@keyframes softFadeIn {
		from {
			opacity: 0.2;
			transform: scale(0.998);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
