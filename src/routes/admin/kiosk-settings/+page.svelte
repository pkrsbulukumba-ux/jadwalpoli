<script lang="ts">
	import {
		Sliders,
		Timer,
		Tv,
		Volume2,
		Check,
		Info,
		Save,
		Building2,
		MessageSquareText,
		AlertTriangle,
		AlertOctagon,
		Lock,
		RefreshCw,
		Upload,
		Eye,
		ShieldCheck,
		RotateCcw,
		Sparkles,
		Database,
		Cloud,
		Server,
		Wifi,
		WifiOff,
		CheckCircle2,
		Copy,
		FileCode,
		SlidersHorizontal,
		Layers,
		User
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { kioskSettings } from '$lib/stores/kiosk.store';
	import { DataRepository } from '$lib/services/data.repository';
	import { isSupabaseConfigured, testSupabaseConnection, supabaseUrl, uploadToSupabaseStorage } from '$lib/supabase/client';
	import type { KioskSettings } from '$lib/types';

	type SettingsTab = 'identity' | 'duration' | 'ticker' | 'emergency' | 'layout-customizer' | 'security' | 'cloud';

	let activeTab = $state<SettingsTab>('identity');
	let isSaved = $state(false);

	// Ambil state terkini dari repository / store
	const initial = DataRepository.getSettings();

	// 1. Identitas RSUD
	let hospitalName = $state(initial.hospital_name || 'RSUD H. Andi Sulthan Daeng Radja');
	let hospitalSubtitle = $state(initial.hospital_subtitle || 'Kabupaten Bulukumba');
	let hospitalLogoUrl = $state(initial.hospital_logo_url || '');
	let timezone = $state(initial.timezone || 'Asia/Makassar');
	let timeFormat = $state(initial.time_format || 'HH:mm');
	let dateFormat = $state(initial.date_format || 'dd MMMM yyyy');

	// 2. Durasi & Audio
	let slideDuration = $state(initial.slide_duration_seconds || 15);
	let imageDuration = $state(initial.image_duration_seconds || 10);
	let videoWaitForEnd = $state(initial.video_wait_for_end ?? true);
	let videoSoundEnabled = $state(initial.video_sound_enabled ?? true);
	let refreshInterval = $state(initial.refresh_interval_seconds || 30);

	// 3. Running Text & Ticker Footer
	let showRunningText = $state(initial.show_running_text ?? true);
	let runningText = $state(initial.running_text || 'Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Instagram: @RSUDBULUKUMBA • Melayani Dengan Sepenuh Hati');
	let runningTextSpeed = $state(initial.running_text_speed || 26);
	let runningTextDirection = $state<'left' | 'right'>(initial.running_text_direction || 'left');
	let showFooterNotices = $state(initial.show_footer_notices ?? true);

	// 4. Banner Darurat (Emergency Alert)
	let showEmergencyBanner = $state(initial.show_emergency_banner ?? false);
	let emergencyTitle = $state(initial.emergency_title || 'PENGUMUMAN LAYANAN POLIKLINIK');
	let emergencyMessage = $state(initial.emergency_message || 'Poli Penyakit Dalam hari ini beroperasi normal hingga pukul 14.00 WITA.');
	let emergencyLevel = $state<'info' | 'warning' | 'critical'>(initial.emergency_level || 'warning');

	// 5. Skala Layar TV Vertikal (43", 55", 65")
	let screenMode = $state<'43' | '55' | '65'>(initial.screen_mode || '55');
	let selectedPreset = $state<'standard' | 'compact' | 'large' | 'custom'>(
		initial.screen_mode === '43' ? 'compact' : initial.screen_mode === '65' ? 'large' : 'standard'
	);
	let fontScale = $state(initial.font_scale || 1);
	let cardScale = $state(initial.card_scale || 1);
	let headerScale = $state(initial.header_scale || 1);
	let footerScale = $state(initial.footer_scale || 1);
	let showPageIndicator = $state(initial.show_page_indicator ?? true);

	// 6. Keamanan & PIN Master
	let oldPin = $state('');
	let newPin = $state('');
	let confirmPin = $state('');
	let pinFeedback = $state<{ text: string; isError: boolean } | null>(null);

	// 7. Supabase Cloud Sync State
	let cloudStatus = $state<{
		checked: boolean;
		isConfigured: boolean;
		isConnected: boolean;
		message: string;
		latencyMs?: number;
		isLoading: boolean;
		counts: { poli: number; doctors: number; schedules: number; media: number } | null;
	}>({
		checked: false,
		isConfigured: isSupabaseConfigured(),
		isConnected: false,
		message: isSupabaseConfigured()
			? 'Kredensial Supabase terdeteksi. Memeriksa koneksi otomatis...'
			: 'Berjalan dalam Mode Siaga Lokal. Kredensial belum disetel di berkas .env.',
		isLoading: false,
		counts: null
	});

	let syncFeedback = $state<{ text: string; isError: boolean } | null>(null);
	let isSyncing = $state(false);

	async function runConnectionTest() {
		cloudStatus.isLoading = true;
		syncFeedback = null;
		const result = await testSupabaseConnection();
		cloudStatus.checked = true;
		cloudStatus.isConfigured = isSupabaseConfigured();
		cloudStatus.isConnected = result.success;
		cloudStatus.message = result.message;
		cloudStatus.latencyMs = result.latencyMs;
		cloudStatus.isLoading = false;
	}

	async function handlePullFromCloud() {
		isSyncing = true;
		syncFeedback = null;
		const result = await DataRepository.syncFromSupabase();
		isSyncing = false;
		if (result.success) {
			syncFeedback = { text: result.message, isError: false };
			cloudStatus.counts = result.counts ? { poli: result.counts.polyclinics, doctors: result.counts.doctors, schedules: result.counts.schedules, media: result.counts.media } : null;
			const refreshed = DataRepository.getSettings();
			hospitalName = refreshed.hospital_name;
			hospitalSubtitle = refreshed.hospital_subtitle;
			runningText = refreshed.running_text;
			slideDuration = refreshed.slide_duration_seconds;
			screenMode = refreshed.screen_mode || '55';
		} else {
			syncFeedback = { text: result.message, isError: true };
		}
	}

	async function handlePushToCloud() {
		isSyncing = true;
		syncFeedback = null;
		const result = await DataRepository.syncToSupabase();
		isSyncing = false;
		syncFeedback = { text: result.message, isError: !result.success };
	}

	let syncCounts = $state<Record<string, number>>({});
	let syncCountLoading = $state(false);

	async function loadTableCounts() {
		syncCountLoading = true;
		try {
			const { supabase } = await import('$lib/supabase/client');
			const tables = ['polyclinics', 'doctors', 'weekly_schedules', 'media_announcements', 'footer_notices'] as const;
			for (const t of tables) {
				const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
				syncCounts[t] = count ?? 0;
			}
		} catch (_) {}
		syncCountLoading = false;
	}

	onMount(() => {
		if (isSupabaseConfigured() && !cloudStatus.isConnected) {
			runConnectionTest();
		}
		if (isSupabaseConfigured()) {
			loadTableCounts();
		}
	});

	// Handler Upload Logo dengan Server Disk & Alert Sukses
	let isUploadingLogo = $state(false);
	let logoSuccessAlert = $state('');
	let logoError = $state('');

	async function handleLogoUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isUploadingLogo = true;
		logoSuccessAlert = '';
		logoError = '';

		try {
			if (isSupabaseConfigured()) {
				const result = await uploadToSupabaseStorage('logos', file);
				if (result.success && result.url) {
					hospitalLogoUrl = result.url;
					logoSuccessAlert = `Logo "${file.name}" berhasil diunggah ke Supabase Storage!`;
				} else {
					// Fallback otomatis ke penyimpanan lokal server jika bucket Supabase belum ada
					const fd = new FormData();
					fd.append('file', file);
					fd.append('folder', 'logos');
					const res = await fetch('/api/upload', { method: 'POST', body: fd });
					const data = await res.json();
					if (data.success && data.url) {
						hospitalLogoUrl = data.url;
						logoSuccessAlert = `Logo "${file.name}" berhasil disimpan ke server lokal!`;
					} else {
						logoError = data.message || result.message || 'Gagal mengunggah berkas logo.';
					}
				}
			} else {
				const fd = new FormData();
				fd.append('file', file);
				fd.append('folder', 'logos');
				const res = await fetch('/api/upload', { method: 'POST', body: fd });
				const data = await res.json();
				if (data.success && data.url) {
					hospitalLogoUrl = data.url;
					logoSuccessAlert = `Logo "${file.name}" berhasil diunggah ke server!`;
				} else {
					logoError = data.message || 'Gagal mengunggah berkas logo.';
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logoError = `Gagal mengunggah logo: ${msg}`;
		} finally {
			isUploadingLogo = false;
		}
	}

	function resetLogo() {
		hospitalLogoUrl = '';
		logoSuccessAlert = '';
		logoError = '';
	}

	// State Ekspor SQL Supabase
	let sqlExportCode = $state('');
	let isSqlCopied = $state(false);

	function handleGenerateSqlExport() {
		sqlExportCode = DataRepository.exportToSupabaseSql();
	}

	function copySqlToClipboard() {
		if (!sqlExportCode) return;
		navigator.clipboard.writeText(sqlExportCode);
		isSqlCopied = true;
		setTimeout(() => {
			isSqlCopied = false;
		}, 3000);
	}

	// Preset Proporsi Layout Customizer
	function applyCustomLayoutPreset(preset: 'compact' | 'standard' | 'large') {
		selectedPreset = preset;
		if (preset === 'compact') {
			cardScale = 0.88;
			headerScale = 0.90;
			footerScale = 0.90;
			fontScale = 0.92;
		} else if (preset === 'standard') {
			cardScale = 1.00;
			headerScale = 1.00;
			footerScale = 1.00;
			fontScale = 1.00;
		} else if (preset === 'large') {
			cardScale = 1.15;
			headerScale = 1.12;
			footerScale = 1.10;
			fontScale = 1.12;
		}
	}

	// Simpan Semua Pengaturan ke Repository & Store
	function saveAllSettings(e?: Event) {
		if (e) e.preventDefault();

		const updatedData: Partial<KioskSettings> = {
			hospital_name: hospitalName.trim(),
			hospital_subtitle: hospitalSubtitle.trim(),
			hospital_logo_url: hospitalLogoUrl,
			timezone,
			time_format: timeFormat,
			date_format: dateFormat,
			slide_duration_seconds: Number(slideDuration),
			image_duration_seconds: Number(imageDuration),
			video_wait_for_end: Boolean(videoWaitForEnd),
			video_sound_enabled: Boolean(videoSoundEnabled),
			refresh_interval_seconds: Number(refreshInterval),
			show_running_text: Boolean(showRunningText),
			running_text: runningText.trim(),
			running_text_speed: Number(runningTextSpeed),
			running_text_direction: runningTextDirection,
			show_footer_notices: Boolean(showFooterNotices),
			show_emergency_banner: Boolean(showEmergencyBanner),
			emergency_title: emergencyTitle.trim(),
			emergency_message: emergencyMessage.trim(),
			emergency_level: emergencyLevel,
			font_scale: Number(fontScale),
			card_scale: Number(cardScale),
			header_scale: Number(headerScale),
			footer_scale: Number(footerScale),
			show_page_indicator: Boolean(showPageIndicator),
			screen_mode: screenMode
		};

		const saved = DataRepository.updateSettings(updatedData);
		kioskSettings.set(saved);

		isSaved = true;
		setTimeout(() => {
			isSaved = false;
		}, 3500);
	}

	// Ganti PIN Master Touchscreen
	function handleUpdatePin(e: Event) {
		e.preventDefault();
		pinFeedback = null;

		if (!oldPin) {
			pinFeedback = { text: 'PIN Lama wajib diisi untuk verifikasi!', isError: true };
			return;
		}

		if (!DataRepository.verifyPin(oldPin)) {
			pinFeedback = { text: 'PIN Lama tidak cocok. Silakan periksa kembali!', isError: true };
			return;
		}

		if (!newPin || newPin.length < 4 || newPin.length > 8) {
			pinFeedback = { text: 'PIN Baru harus terdiri dari 4 sampai 8 digit angka numerik!', isError: true };
			return;
		}

		if (!/^\d+$/.test(newPin)) {
			pinFeedback = { text: 'PIN Baru hanya boleh berupa digit angka (0-9)!', isError: true };
			return;
		}

		if (newPin !== confirmPin) {
			pinFeedback = { text: 'Konfirmasi PIN Baru tidak cocok dengan PIN Baru!', isError: true };
			return;
		}

		const success = DataRepository.updatePin(newPin);
		if (success) {
			pinFeedback = { text: 'Master PIN Touchscreen berhasil diperbarui! Gunakan PIN baru ini untuk membuka Kiosk.', isError: false };
			oldPin = '';
			newPin = '';
			confirmPin = '';
		} else {
			pinFeedback = { text: 'Gagal memperbarui PIN. Silakan coba lagi.', isError: true };
		}
	}
</script>

<svelte:head>
	<title>Pengaturan Kiosk - CMS RSUD</title>
</svelte:head>

<div class="page-container">
	<!-- Page Header -->
	<div class="page-header">
		<div class="title-with-icon">
			<Sliders size={28} class="text-emerald" />
			<div>
				<h1>Pengaturan Kiosk</h1>
				<p>Kontrol terpusat untuk identitas RSUD, durasi tayang, teks berjalan, banner darurat, kustomisasi layout proporsi, dan Master PIN.</p>
			</div>
		</div>
	</div>

	<!-- Sub-Menu Tabs (6 Tab Fungsional sesuai PRD Bagian 7-10) -->
	<div class="settings-tabs">
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'identity'}
			onclick={() => (activeTab = 'identity')}
		>
			<Building2 size={18} />
			<span>Identitas RSUD</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'duration'}
			onclick={() => (activeTab = 'duration')}
		>
			<Timer size={18} />
			<span>Durasi & Audio</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'ticker'}
			onclick={() => (activeTab = 'ticker')}
		>
			<MessageSquareText size={18} />
			<span>Teks Berjalan (Ticker)</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'emergency'}
			onclick={() => (activeTab = 'emergency')}
		>
			<AlertTriangle size={18} />
			<span>Banner Darurat</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'layout-customizer'}
			onclick={() => (activeTab = 'layout-customizer')}
		>
			<SlidersHorizontal size={18} />
			<span>Kustomisasi Card, Header & Footer</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'security'}
			onclick={() => (activeTab = 'security')}
		>
			<Lock size={18} />
			<span>Keamanan & PIN</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'cloud'}
			onclick={() => (activeTab = 'cloud')}
		>
			<Cloud size={18} />
			<span>Cloud & Sinkronisasi</span>
		</button>
	</div>

	<!-- Toast Notifikasi Sukses -->
	{#if isSaved}
		<div class="toast-success" role="alert">
			<Check size={20} />
			<div>
				<strong>Pengaturan Berhasil Disimpan!</strong>
				<p>Perubahan langsung diterapkan ke layar Kiosk tanpa perlu memuat ulang browser.</p>
			</div>
		</div>
	{/if}

	<!-- ========================================================================= -->
	<!-- TAB 1: IDENTITAS RSUD -->
	<!-- ========================================================================= -->
	{#if activeTab === 'identity'}
		<form onsubmit={saveAllSettings} class="settings-card">
			<div class="card-header">
				<h2>Identitas Rumah Sakit & Header Kiosk</h2>
				<p>Konfigurasi nama instansi, subjudul, logo, dan zona waktu yang tampil di bagian atas layar Kiosk TV.</p>
			</div>

			<div class="form-grid">
				<div class="form-field">
					<label for="hospital-name">Nama Rumah Sakit</label>
					<input
						id="hospital-name"
						type="text"
						bind:value={hospitalName}
						placeholder="Contoh: RSUD H. Andi Sulthan Daeng Radja"
						class="text-input"
						required
					/>
					<span class="field-hint">Nama utama instansi yang terpampang jelas pada header Kiosk.</span>
				</div>

				<div class="form-field">
					<label for="hospital-sub">Subjudul / Wilayah</label>
					<input
						id="hospital-sub"
						type="text"
						bind:value={hospitalSubtitle}
						placeholder="Contoh: Kabupaten Bulukumba"
						class="text-input"
						required
					/>
					<span class="field-hint">Kabupaten, kota, atau unit kerja penjelas instansi.</span>
				</div>
			</div>

			<!-- Pengaturan Logo RSUD -->
			<div class="sub-section">
				<h3>Logo Instansi Rumah Sakit</h3>
				<div class="logo-preview-row">
					<div class="logo-circle-preview">
						{#if hospitalLogoUrl}
							<img src={hospitalLogoUrl} alt="Logo RSUD" class="logo-thumb" />
						{:else}
							<div class="logo-svg-fallback" title="Menggunakan Emblem Default RSUD">
								<Building2 size={32} class="text-emerald" />
							</div>
						{/if}
					</div>

					<div class="logo-upload-controls">
						<div class="input-with-label">
							<span class="field-label-small">Tautan URL Logo (Eksternal)</span>
							<input
								type="text"
								bind:value={hospitalLogoUrl}
								placeholder="https://domain.com/logo-rsud.png"
								class="text-input"
							/>
						</div>

						<div class="btn-row">
							<label class="btn btn-outline file-btn">
								<Upload size={16} />
								<span>Unggah Berkas Logo</span>
								<input
									type="file"
									accept="image/png, image/jpeg, image/webp, image/svg+xml"
									onchange={handleLogoUpload}
									class="hidden-file-input"
								/>
							</label>

							{#if hospitalLogoUrl}
								<button type="button" class="btn btn-ghost text-danger" onclick={resetLogo}>
									<RotateCcw size={16} />
									<span>Reset ke Emblem Bawaan</span>
								</button>
							{/if}
						</div>

						{#if isUploadingLogo}
							<div class="upload-loading-badge">
								<span class="upload-spinner"></span>
								<span>Sedang mengunggah logo RSUD ke server fisik...</span>
							</div>
						{/if}

						{#if logoSuccessAlert}
							<div class="upload-success-alert">
								<Check size={16} />
								<span>{logoSuccessAlert}</span>
							</div>
						{/if}

						{#if logoError}
							<div class="form-error-alert" style="margin-top: 0.5rem;">
								<AlertTriangle size={16} />
								<span>{logoError}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Zona Waktu & Format Jam -->
			<div class="sub-section">
				<h3>Zona Waktu & Jam Digital</h3>
				<div class="form-grid">
					<div class="form-field">
						<label for="timezone-select">Zona Waktu Kiosk</label>
						<select id="timezone-select" bind:value={timezone} class="select-input">
							<option value="Asia/Makassar">WITA — Waktu Indonesia Tengah (Makassar, Bulukumba, Bali)</option>
							<option value="Asia/Jakarta">WIB — Waktu Indonesia Barat (Jakarta, Surabaya, Medan)</option>
							<option value="Asia/Jayapura">WIT — Waktu Indonesia Timur (Jayapura, Ambon)</option>
						</select>
						<span class="field-hint">Menjamin jam digital di Kiosk akurat sesuai waktu lokal poliklinik.</span>
					</div>

					<div class="form-field">
						<label for="timeformat-select">Format Waktu</label>
						<select id="timeformat-select" bind:value={timeFormat} class="select-input">
							<option value="HH:mm">24 Jam (Contoh: 14:30)</option>
							<option value="hh:mm a">12 Jam (Contoh: 02:30 PM)</option>
						</select>
						<span class="field-hint">Format tampilan angka waktu pada jam digital header.</span>
					</div>
				</div>
			</div>

			<div class="card-footer">
				<button type="submit" class="btn btn-primary">
					<Save size={18} />
					<span>Simpan Identitas RSUD</span>
				</button>
			</div>
		</form>

	<!-- ========================================================================= -->
	<!-- TAB 2: DURASI & AUDIO SLIDESHOW -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'duration'}
		<form onsubmit={saveAllSettings} class="settings-card">
			<div class="card-header">
				<h2>Kustomisasi Durasi Slide & Output Suara Android TV</h2>
				<p>Atur kecepatan pergantian slide jadwal, durasi gambar edukasi, dan output audio video.</p>
			</div>

			<div class="form-grid">
				<!-- Durasi Slide Jadwal -->
				<div class="form-field">
					<label for="schedule-duration">
						Durasi Slide Jadwal Poliklinik
						<span class="badge-unit">{slideDuration} Detik</span>
					</label>
					<input
						id="schedule-duration"
						type="range"
						min="5"
						max="60"
						step="5"
						bind:value={slideDuration}
						class="slider-input"
					/>
					<span class="field-hint">Waktu tayang setiap halaman daftar dokter sebelum berganti slide (Direkomendasikan 15 detik).</span>
				</div>

				<!-- Durasi Media Gambar -->
				<div class="form-field">
					<label for="image-duration">
						Durasi Slide Gambar Pengumuman
						<span class="badge-unit">{imageDuration} Detik</span>
					</label>
					<input
						id="image-duration"
						type="range"
						min="5"
						max="30"
						step="1"
						bind:value={imageDuration}
						class="slider-input"
					/>
					<span class="field-hint">Waktu tampil untuk slide gambar edukasi / poster pengumuman sebelum berganti.</span>
				</div>
			</div>

			<!-- Pengaturan Video & Audio Android TV -->
			<div class="sub-section">
				<h3>Perilaku Video Pengumuman & Audio Android TV</h3>

				<div class="switch-row">
					<div class="switch-text">
						<strong>Tunggu Video Selesai Baru Berganti Slide</strong>
						<span>Jika aktif, slide video tidak akan dipotong waktu durasi tetap melainkan menunggu hingga video tuntas (`onended`).</span>
					</div>
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={videoWaitForEnd} />
						<span class="slider round"></span>
					</label>
				</div>

				<div class="switch-row">
					<div class="switch-text">
						<strong>Aktifkan Suara Video di Layar Android TV</strong>
						<span>Mengizinkan pemutaran audio video secara langsung pada TV vertikal kiosk dengan fallback gestur sentuh jika browser membatasi autoplay.</span>
					</div>
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={videoSoundEnabled} />
						<span class="slider round"></span>
					</label>
				</div>
			</div>

			<!-- Refresh Interval -->
			<div class="sub-section">
				<h3>Sinkronisasi Latar Belakang (Background Polling)</h3>
				<div class="form-field">
					<label for="refresh-interval">
						Interval Sinkronisasi Data Kiosk
						<span class="badge-unit">{refreshInterval} Detik</span>
					</label>
					<input
						id="refresh-interval"
						type="range"
						min="15"
						max="120"
						step="5"
						bind:value={refreshInterval}
						class="slider-input"
					/>
					<span class="field-hint">Frekuensi Kiosk mengecek pembaruan status praktik dokter dan jadwal secara otomatis di latar belakang.</span>
				</div>
			</div>

			<!-- Kotak Info Hardware Android TV -->
			<div class="info-box">
				<div class="info-icon-wrap">
					<Volume2 size={22} class="text-amber" />
				</div>
				<div class="info-text">
					<strong>Info Optimalisasi Suara di Android TV:</strong>
					<p>
						Pada browser Android TV / Chromium, pastikan pengaturan browser (atau Fully Kiosk Browser) telah mengaktifkan <em>"Autoplay without User Gesture"</em> agar video edukasi bersuara dapat langsung berbunyi saat kiosk pertama kali dinyalakan. Kiosk juga dilengkapi tombol sentuh di layar untuk membunyikan suara sewaktu-waktu.
					</p>
				</div>
			</div>

			<div class="card-footer">
				<button type="submit" class="btn btn-primary">
					<Save size={18} />
					<span>Simpan Durasi & Audio</span>
				</button>
			</div>
		</form>

	<!-- ========================================================================= -->
	<!-- TAB 3: RUNNING TEXT & TICKER FOOTER -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'ticker'}
		<form onsubmit={saveAllSettings} class="settings-card">
			<div class="card-header">
				<h2>Teks Berjalan (Running Text Ticker) & Footer</h2>
				<p>Kelola teks pengaduan, akun media sosial, informasi layanan, serta notisi operasional pada bagian bawah Kiosk.</p>
			</div>

			<div class="switch-row">
				<div class="switch-text">
					<strong>Tampilkan Teks Berjalan (Running Text Ticker)</strong>
					<span>Menampilkan pita teks berjalan horizontal di bagian paling bawah layar TV Kiosk.</span>
				</div>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={showRunningText} />
					<span class="slider round"></span>
				</label>
			</div>

			{#if showRunningText}
				<div class="form-field">
					<label for="running-text-input">Pesan Teks Pengumuman Berjalan</label>
					<textarea
						id="running-text-input"
						bind:value={runningText}
						rows="3"
						class="textarea-input"
						placeholder="Contoh: Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Melayani Dengan Sepenuh Hati"
					></textarea>
					<span class="field-hint">Gunakan pemisah bulatan (•) atau strip (-) untuk memisahkan antar pesan pengumuman.</span>
				</div>

				<div class="form-grid">
					<div class="form-field">
						<label for="ticker-speed">
							Durasi Perputaran Teks
							<span class="badge-unit">{runningTextSpeed} Detik</span>
						</label>
						<input
							id="ticker-speed"
							type="range"
							min="15"
							max="60"
							step="1"
							bind:value={runningTextSpeed}
							class="slider-input"
						/>
						<span class="field-hint">Semakin kecil nilai detik, semakin cepat teks melintasi layar. Direkomendasikan 25–30 detik.</span>
					</div>

					<div class="form-field">
						<label for="ticker-dir">Arah Gerakan Teks</label>
						<select id="ticker-dir" bind:value={runningTextDirection} class="select-input">
							<option value="left">Bergerak ke Kiri (Standar Ticker Televisi)</option>
							<option value="right">Bergerak ke Kanan</option>
						</select>
						<span class="field-hint">Arah aliran pergerakan animasi teks berjalan.</span>
					</div>
				</div>

				<!-- Live Ticker Preview -->
				<div class="sub-section">
					<h3>Pratinjau Langsung Kecepatan Teks Berjalan (Live Ticker)</h3>
					<div class="ticker-preview-wrap">
						<div
							class="ticker-preview-track"
							style="animation-duration: {runningTextSpeed}s; animation-direction: {runningTextDirection === 'right' ? 'reverse' : 'normal'};"
						>
							<span class="ticker-preview-item">{runningText}</span>
							<span class="ticker-preview-item" aria-hidden="true">{runningText}</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Toggle Footer Notices -->
			<div class="sub-section">
				<h3>Notisi Informasi Operasional</h3>
				<div class="switch-row">
					<div class="switch-text">
						<strong>Tampilkan 4 Kartu Notisi Operasional Footer</strong>
						<span>Menampilkan kartu ringkasan: Jam Buka Loket Pendaftaran, Jadwal Sewaktu-waktu Berubah, Jam Istirahat, dan BPJS Mobile JKN.</span>
					</div>
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={showFooterNotices} />
						<span class="slider round"></span>
					</label>
				</div>
			</div>

			<div class="card-footer">
				<button type="submit" class="btn btn-primary">
					<Save size={18} />
					<span>Simpan Teks Berjalan & Footer</span>
				</button>
			</div>
		</form>

	<!-- ========================================================================= -->
	<!-- TAB 4: BANNER DARURAT (EMERGENCY ALERT) -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'emergency'}
		<form onsubmit={saveAllSettings} class="settings-card">
			<div class="card-header">
				<h2>Banner Pengumuman Darurat (Emergency Alert)</h2>
				<p>Tampilkan pesan penting mendesak seperti pemindahan gedung, dokter berhalangan mendadak, atau pengumuman khusus tepat di bawah header Kiosk.</p>
			</div>

			<div class="switch-row highlight-emergency">
				<div class="switch-text">
					<strong>Aktifkan Banner Darurat di Layar Kiosk</strong>
					<span>Bila diaktifkan, banner mencolok akan segera muncul di seluruh slide Kiosk tanpa menutupi jadwal dokter.</span>
				</div>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={showEmergencyBanner} />
					<span class="slider round"></span>
				</label>
			</div>

			{#if showEmergencyBanner}
				<div class="form-field">
					<label for="emergency-level-group">Tingkat Kegentingan / Warna Banner</label>
					<div class="level-btn-group" id="emergency-level-group">
						<button
							type="button"
							class="level-btn info-btn"
							class:active={emergencyLevel === 'info'}
							onclick={() => (emergencyLevel = 'info')}
						>
							<Info size={18} />
							<span>Informasi (Biru)</span>
						</button>
						<button
							type="button"
							class="level-btn warning-btn"
							class:active={emergencyLevel === 'warning'}
							onclick={() => (emergencyLevel = 'warning')}
						>
							<AlertTriangle size={18} />
							<span>Peringatan (Oranye)</span>
						</button>
						<button
							type="button"
							class="level-btn critical-btn"
							class:active={emergencyLevel === 'critical'}
							onclick={() => (emergencyLevel = 'critical')}
						>
							<AlertOctagon size={18} />
							<span>Kritis / Darurat (Merah)</span>
						</button>
					</div>
				</div>

				<div class="form-field">
					<label for="emergency-title">Judul Pengumuman Darurat</label>
					<input
						id="emergency-title"
						type="text"
						bind:value={emergencyTitle}
						placeholder="Contoh: PENGUMUMAN LAYANAN POLIKLINIK"
						class="text-input"
						required
					/>
				</div>

				<div class="form-field">
					<label for="emergency-message">Isi Pesan Darurat Lengkap</label>
					<textarea
						id="emergency-message"
						bind:value={emergencyMessage}
						rows="3"
						class="textarea-input"
						placeholder="Contoh: Poli Penyakit Dalam hari ini beroperasi normal hingga pukul 14.00 WITA. Layanan dibuka kembali besok pagi."
						required
					></textarea>
				</div>

				<!-- Live Preview Banner Darurat -->
				<div class="sub-section">
					<h3>Pratinjau Tampilan Banner Darurat di Layar Kiosk:</h3>
					<div class="emergency-preview-box {emergencyLevel}">
						<div class="preview-icon">
							{#if emergencyLevel === 'critical'}
								<AlertOctagon size={24} />
							{:else if emergencyLevel === 'info'}
								<Info size={24} />
							{:else}
								<AlertTriangle size={24} />
							{/if}
						</div>
						<div class="preview-text">
							<h4>{emergencyTitle || 'PENGUMUMAN DARURAT'}</h4>
							<p>{emergencyMessage || 'Pesan pengumuman darurat akan muncul di sini.'}</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="card-footer">
				<button type="submit" class="btn btn-primary">
					<Save size={18} />
					<span>Simpan Status Banner Darurat</span>
				</button>
			</div>
		</form>


	<!-- ========================================================================= -->
	<!-- TAB KHUSUS: KUSTOMISASI UKURAN CARD DOKTER, HEADER & FOOTER -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'layout-customizer'}
		<form onsubmit={saveAllSettings} class="settings-card">
			<div class="card-header">
				<h2>Kustomisasi Variasi Ukuran Card Dokter, Header & Footer</h2>
				<p>Sesuaikan proporsi besar-kecilnya Card Dokter, Header Kiosk, dan Footer secara leluasa dengan pratinjau visual langsung.</p>
			</div>

			<!-- Preset Cepat Layout -->
			<div class="sub-section">
				<h3>Preset Cepat Proporsi Layout</h3>
				<div class="preset-pills-row">
					<button
						type="button"
						class="preset-pill-btn"
						class:active={cardScale <= 0.90 && headerScale <= 0.92}
						onclick={() => applyCustomLayoutPreset('compact')}
					>
						<span class="pill-title">Kompak & Rapat</span>
						<span class="pill-desc">Card 0.88x • Header 0.90x • Muat banyak dokter</span>
					</button>

					<button
						type="button"
						class="preset-pill-btn"
						class:active={cardScale === 1.0 && headerScale === 1.0}
						onclick={() => applyCustomLayoutPreset('standard')}
					>
						<span class="pill-title">Standar Seimbang (1.0x)</span>
						<span class="pill-desc">Rekomendasi resmi visual RSUD</span>
					</button>

					<button
						type="button"
						class="preset-pill-btn"
						class:active={cardScale >= 1.12 && headerScale >= 1.10}
						onclick={() => applyCustomLayoutPreset('large')}
					>
						<span class="pill-title">Ekstra Besar</span>
						<span class="pill-desc">Card 1.15x • Header 1.12x • Keterbacaan jarak jauh</span>
					</button>
				</div>
			</div>

			<!-- Slider Kustomisasi 4 Elemen Utama -->
			<div class="sub-section">
				<h3>Pengaturan Skala Elemen Utama</h3>
				<div class="custom-sliders-grid">
					<!-- Card Dokter -->
					<div class="slider-control-card">
						<div class="control-card-header">
							<div class="icon-bubble green">
								<Layers size={20} />
							</div>
							<div>
								<strong>Besar-Kecil Card Dokter</strong>
								<span class="badge-unit-large">{cardScale.toFixed(2)}x</span>
							</div>
						</div>
						<input
							id="custom-card-scale"
							type="range"
							min="0.75"
							max="1.35"
							step="0.05"
							bind:value={cardScale}
							class="slider-input"
						/>
						<p class="control-hint">Mengatur tinggi kartu dokter, ukuran foto profil ({Math.round(124 * cardScale)}px × {Math.round(136 * cardScale)}px), serta kenyamanan padding kartu.</p>
					</div>

					<!-- Header Kiosk -->
					<div class="slider-control-card">
						<div class="control-card-header">
							<div class="icon-bubble orange">
								<Building2 size={20} />
							</div>
							<div>
								<strong>Tinggi & Skala Header Kiosk</strong>
								<span class="badge-unit-large">{headerScale.toFixed(2)}x</span>
							</div>
						</div>
						<input
							id="custom-header-scale"
							type="range"
							min="0.75"
							max="1.30"
							step="0.05"
							bind:value={headerScale}
							class="slider-input"
						/>
						<p class="control-hint">Mengatur tinggi statis header (~{Math.round(168 * headerScale)}px), ukuran logo instansi RSUD, jam digital, dan penanda halaman.</p>
					</div>

					<!-- Footer Kiosk -->
					<div class="slider-control-card">
						<div class="control-card-header">
							<div class="icon-bubble teal">
								<Tv size={20} />
							</div>
							<div>
								<strong>Tinggi & Skala Footer Kiosk</strong>
								<span class="badge-unit-large">{footerScale.toFixed(2)}x</span>
							</div>
						</div>
						<input
							id="custom-footer-scale"
							type="range"
							min="0.75"
							max="1.30"
							step="0.05"
							bind:value={footerScale}
							class="slider-input"
						/>
						<p class="control-hint">Mengatur tinggi statis footer (~{Math.round(132 * footerScale)}px), proporsi teks berjalan ticker, dan notisi kartu.</p>
					</div>

					<!-- Skala Tipografi Global -->
					<div class="slider-control-card">
						<div class="control-card-header">
							<div class="icon-bubble slate">
								<Sliders size={20} />
							</div>
							<div>
								<strong>Skala Tipografi Global (Font)</strong>
								<span class="badge-unit-large">{fontScale.toFixed(2)}x</span>
							</div>
						</div>
						<input
							id="custom-font-scale"
							type="range"
							min="0.80"
							max="1.30"
							step="0.05"
							bind:value={fontScale}
							class="slider-input"
						/>
						<p class="control-hint">Menyesuaikan ukuran seluruh font teks nama dokter, spesialisasi, dan jam praktik.</p>
					</div>
				</div>
			</div>

			<!-- Live Interactive Visual Preview Box -->
			<div class="sub-section">
				<h3>Pratinjau Langsung Proporsi Elemen (Live Interactive Preview)</h3>
				<div class="live-preview-box">
					<!-- Mini Mockup Header -->
					<div class="mockup-header" style="transform: scale({headerScale}); transform-origin: top center;">
						<div class="mockup-header-top">
							<div class="mockup-brand">
								<div class="mockup-logo"></div>
								<div>
									<div class="mockup-instansi">RUMAH SAKIT UMUM DAERAH</div>
									<div class="mockup-name">{hospitalName}</div>
								</div>
							</div>
							<div class="mockup-clock">08:30 WITA</div>
						</div>
						<div class="mockup-header-bottom">
							<span class="mockup-title">JADWAL POLIKLINIK</span>
							<div class="mockup-header-right">
								<div class="mockup-page-badge">HALAMAN 1/4</div>
								<div class="mockup-circular-timer">15s</div>
							</div>
						</div>
					</div>

					<!-- Mini Mockup Doctor Card -->
					<div class="mockup-card-container">
						<div class="mockup-doctor-card" style="transform: scale({cardScale}); transform-origin: top center;">
							<div class="mockup-doc-photo">
								<User size={26} class="text-slate" />
							</div>
							<div class="mockup-doc-info">
								<div class="mockup-doc-name" style="font-size: {0.92 * fontScale}rem;">dr. H. Rahmat Hidayat, Sp.PD</div>
								<div class="mockup-doc-spec">Spesialis Penyakit Dalam</div>
								<div class="mockup-doc-time">🕒 08:00 - 14:00 WITA</div>
							</div>
							<div class="mockup-doc-status">BUKA</div>
						</div>
					</div>

					<!-- Mini Mockup Footer -->
					<div class="mockup-footer" style="transform: scale({footerScale}); transform-origin: bottom center;">
						<div class="mockup-ticker">
							<span>📢 {runningText ? runningText.slice(0, 80) + '...' : 'Informasi Pelayanan Poliklinik RSUD...'}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Page Indicator Dots -->
			<div class="sub-section">
				<h3>Elemen Navigasi</h3>
				<div class="switch-row">
					<div class="switch-text">
						<strong>Tampilkan Indikator Titik Halaman (Pagination Dots)</strong>
						<span>Menampilkan titik-titik indikator halaman slide di bagian bawah konten jadwal.</span>
					</div>
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={showPageIndicator} />
						<span class="slider round"></span>
					</label>
				</div>
			</div>

			<div class="card-footer">
				<button type="submit" class="btn btn-primary">
					<Save size={18} />
					<span>Simpan Kustomisasi Ukuran</span>
				</button>
			</div>
		</form>

	<!-- ========================================================================= -->
	<!-- TAB 6: KEAMANAN & MASTER PIN TOUCHSCREEN -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'security'}
		<div class="settings-card">
			<div class="card-header">
				<h2>Keamanan & Master PIN Touchscreen</h2>
				<p>Kelola PIN Master 4–8 digit untuk membuka kunci layar sentuh Kiosk saat ingin masuk ke CMS Dashboard.</p>
			</div>

			<div class="security-status-box">
				<div class="status-shield-icon">
					<ShieldCheck size={28} class="text-emerald" />
				</div>
				<div>
					<strong>Pengamanan Touchscreen Kiosk Aktif</strong>
					<p>Layar Kiosk publik terlindungi virtual keypad. Pengunjung rumah sakit tidak dapat mengakses menu CMS tanpa memasukkan PIN yang benar.</p>
				</div>
			</div>

			{#if pinFeedback}
				<div class="pin-feedback {pinFeedback.isError ? 'error' : 'success'}">
					{#if pinFeedback.isError}
						<AlertOctagon size={18} />
					{:else}
						<Check size={18} />
					{/if}
					<span>{pinFeedback.text}</span>
				</div>
			{/if}

			<form onsubmit={handleUpdatePin} class="pin-form">
				<div class="form-field">
					<label for="old-pin">PIN Lama Saat Ini</label>
					<input
						id="old-pin"
						type="password"
						inputmode="numeric"
						maxlength="8"
						bind:value={oldPin}
						placeholder="Masukkan PIN saat ini (Bawaan: 1234)"
						class="text-input"
						required
					/>
					<span class="field-hint">Diperlukan untuk memverifikasi bahwa Anda adalah pengelola resmi.</span>
				</div>

				<div class="form-grid">
					<div class="form-field">
						<label for="new-pin">PIN Baru (4–8 Digit Numerik)</label>
						<input
							id="new-pin"
							type="password"
							inputmode="numeric"
							maxlength="8"
							bind:value={newPin}
							placeholder="Contoh: 5678"
							class="text-input"
							required
						/>
						<span class="field-hint">Hanya angka 0-9 tanpa spasi atau huruf.</span>
					</div>

					<div class="form-field">
						<label for="confirm-pin">Ulangi Konfirmasi PIN Baru</label>
						<input
							id="confirm-pin"
							type="password"
							inputmode="numeric"
							maxlength="8"
							bind:value={confirmPin}
							placeholder="Ketik ulang PIN baru"
							class="text-input"
							required
						/>
						<span class="field-hint">Harus sama persis dengan PIN baru di samping.</span>
					</div>
				</div>

				<div class="card-footer">
					<button type="submit" class="btn btn-primary">
						<Lock size={18} />
						<span>Perbarui Master PIN</span>
					</button>
				</div>
			</form>
		</div>
	<!-- ========================================================================= -->
	<!-- TAB 7: CLOUD & SINKRONISASI SUPABASE -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'cloud'}
		<div class="settings-card">
			<div class="card-header">
				<h2>Integrasi Supabase Cloud & Sinkronisasi Realtime</h2>
				<p>Pantau status konektivitas database cloud, sinkronisasi data jadwal, dan uji keaktifan endpoint Supabase secara langsung.</p>
			</div>

			<!-- Status Konektivitas Card -->
			<div class="cloud-status-banner {cloudStatus.isConnected ? 'connected' : cloudStatus.isConfigured ? 'configured' : 'local-mode'}">
				<div class="status-icon-bubble">
					{#if cloudStatus.isConnected}
						<CheckCircle2 size={32} class="text-emerald" />
					{:else if cloudStatus.isConfigured}
						<Cloud size={32} class="text-amber" />
					{:else}
						<WifiOff size={32} class="text-slate" />
					{/if}
				</div>
				<div class="status-info">
					<div class="status-title-row">
						<strong>
							{#if cloudStatus.isConnected}
								🟢 Terhubung ke Supabase Cloud (Online)
							{:else if cloudStatus.isConfigured}
								🟡 Kredensial Terpasang (Menunggu Uji Koneksi)
							{:else}
								⚪ Mode Siaga Lokal (Offline Ready)
							{/if}
						</strong>
						{#if cloudStatus.latencyMs !== undefined}
							<span class="latency-badge">{cloudStatus.latencyMs} ms</span>
						{/if}
					</div>
					<p>{cloudStatus.message}</p>
					{#if supabaseUrl}
						<div class="endpoint-meta">
							<span>URL Endpoint: <code>{supabaseUrl}</code></span>
						</div>
					{/if}
				</div>
			</div>

			{#if syncFeedback}
				<div class="pin-feedback {syncFeedback.isError ? 'error' : 'success'}">
					{#if syncFeedback.isError}
						<AlertOctagon size={18} />
					{:else}
						<Check size={18} />
					{/if}
					<span>{syncFeedback.text}</span>
				</div>
			{/if}

			<!-- Action Buttons Grid -->
			<div class="cloud-action-grid">
				{#if cloudStatus.isConfigured && !cloudStatus.isConnected}
					<div class="action-card disabled-card">
						<div class="action-card-header">
							<RefreshCw size={22} class="text-amber" />
							<div>
								<h4>Menghubungkan ke Supabase...</h4>
								<p>Sedang melakukan koneksi ke database cloud.</p>
							</div>
						</div>
					</div>
				{:else if cloudStatus.isConnected}
					<div class="action-card">
						<div class="action-card-header">
							<CheckCircle2 size={22} class="text-emerald" />
							<div>
								<h4>🟢 Terhubung Online</h4>
								<p>Data sinkron realtime. Perubahan CMS langsung terupdate di kiosk.</p>
							</div>
						</div>
					</div>
					<div class="action-card">
						<div class="action-card-header">
							<Database size={22} class="text-emerald" />
							<div>
								<h4>Table Counts</h4>
								<p>
									<span>{syncCounts.poli || 0} Poliklinik</span>
									<span>{syncCounts.doctors || 0} Dokter</span>
									<span>{syncCounts.schedules || 0} Jadwal</span>
									<span>{syncCounts.media || 0} Media</span>
								</p>
							</div>
						</div>
					</div>
				{:else}
					<div class="action-card local-card">
						<div class="action-card-header">
							<WifiOff size={22} class="text-slate" />
							<div>
								<h4>Mode Siaga Lokal</h4>
								<p>Data disimpan lokal, sinkronisasi saat kredensial ada.</p>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Panel Ekspor SQL Supabase 1-Klik Siap Deploy -->
			<div class="sub-section">
				<div class="sql-export-card">
					<div class="sql-export-header">
						<div class="sql-header-info">
							<FileCode size={24} class="text-emerald" />
							<div>
								<h4>Ekspor Seluruh Data Lokal ke SQL Supabase (1-Klik Siap Deploy)</h4>
								<p>Buat skrip SQL instan dari seluruh data poliklinik, dokter, jadwal, pengumuman, dan pengaturan lokal Anda untuk langsung di-paste ke Supabase SQL Editor.</p>
							</div>
						</div>
						<button
							type="button"
							class="btn btn-primary"
							onclick={handleGenerateSqlExport}
						>
							<Sparkles size={16} />
							<span>Generate Skrip SQL</span>
						</button>
					</div>

					{#if sqlExportCode}
						<div class="sql-preview-container">
							<div class="sql-preview-topbar">
								<span class="sql-badge">Skrip SQL Siap Digunakan ({sqlExportCode.split('\n').length} baris)</span>
								<button
									type="button"
									class="btn btn-outline copy-btn"
									onclick={copySqlToClipboard}
								>
									{#if isSqlCopied}
										<Check size={14} class="text-emerald" />
										<span>Tersalin ke Clipboard!</span>
									{:else}
										<Copy size={14} />
										<span>Salin SQL Lengkap</span>
									{/if}
								</button>
							</div>
							<textarea readonly class="sql-textarea" rows="10" value={sqlExportCode}></textarea>
							<div class="sql-hint">
								💡 <strong>Cara Memakai:</strong> Buka dashboard Supabase Anda ➡️ Masuk menu <strong>SQL Editor</strong> ➡️ Tempel (Paste) skrip di atas dan klik <strong>Run</strong>. Seluruh data lokal Anda akan otomatis masuk ke Supabase Cloud!
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Panduan Setup Singkat -->
			<div class="sub-section">
				<h3>Panduan Peluncuran Supabase Production</h3>
				<div class="guide-box">
					<ol>
						<li>Buka berkas <code>.env</code> di root proyek, isikan <code>PUBLIC_SUPABASE_URL</code> dan <code>PUBLIC_SUPABASE_ANON_KEY</code> resmi proyek Supabase Anda.</li>
						<li>Buka Supabase SQL Editor dan jalankan skrip <code>supabase/migrations/20260908000000_init_kiosk_schema.sql</code>.</li>
						<li>(Opsional) Jalankan <code>supabase/seed.sql</code> untuk menginisialisasi 7 poliklinik dan 8 dokter spesialis awal.</li>
						<li>Pastikan Storage Bucket <code>announcements</code> dan <code>doctors</code> berstatus publik di dashboard Supabase Storage.</li>
						<li>Lakukan <strong>"Uji Konektivitas"</strong> pada tombol di atas. Bila berstatus hijau, aplikasi langsung aktif online realtime!</li>
					</ol>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 960px;
	}

	.title-with-icon {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.title-with-icon h1 {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.title-with-icon p {
		font-size: 0.875rem;
		color: #64748B;
		margin: 0.2rem 0 0 0;
	}

	:global(.text-emerald) {
		color: #0A5C36;
	}

	:global(.text-amber) {
		color: #D97706;
	}

	:global(.text-danger) {
		color: #DC2626;
	}

	/* Sub-Menu Tabs Sederhana */
	.settings-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		background: #E2E8F0;
		padding: 0.35rem;
		border-radius: 0.85rem;
		width: fit-content;
	}

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.15rem;
		border-radius: 0.65rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #475569;
		background: transparent;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		color: #0A5C36;
	}

	.tab-btn.active {
		background: #FFFFFF;
		color: #0A5C36;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	}

	.toast-success {
		background: #D1FAE5;
		border: 1px solid #6EE7B7;
		color: #065F46;
		padding: 1rem 1.25rem;
		border-radius: 0.85rem;
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		font-size: 0.875rem;
		animation: fadeIn 0.3s ease-out;
	}

	.toast-success strong {
		display: block;
		margin-bottom: 0.15rem;
	}

	.toast-success p {
		margin: 0;
		opacity: 0.9;
	}

	.settings-card {
		background: #FFFFFF;
		border-radius: 1.25rem;
		border: 1px solid #E2E8F0;
		padding: 2rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.card-header h2 {
		font-size: 1.25rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.card-header p {
		font-size: 0.85rem;
		color: #64748B;
		margin: 0.25rem 0 0 0;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 700px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-field label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		font-weight: 700;
		color: #1E293B;
	}

	.text-input,
	.select-input,
	.textarea-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.65rem;
		font-size: 0.9rem;
		color: #0F172A;
		background: #F8FAFC;
		outline: none;
		transition: border-color 0.2s;
		font-family: inherit;
	}

	.text-input:focus,
	.select-input:focus,
	.textarea-input:focus {
		border-color: #0A5C36;
		background: #FFFFFF;
		box-shadow: 0 0 0 3px rgba(10, 92, 54, 0.1);
	}

	.badge-unit {
		background: #0A5C36;
		color: #FFFFFF;
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
	}

	.slider-input {
		width: 100%;
		accent-color: #0A5C36;
		cursor: pointer;
		height: 6px;
	}

	.field-hint {
		font-size: 0.775rem;
		color: #64748B;
		line-height: 1.4;
	}

	.sub-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-top: 1px solid #F1F5F9;
		padding-top: 1.5rem;
	}

	.sub-section h3 {
		font-size: 1.05rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.switch-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: #F8FAFC;
		border: 1px solid #EDF2F7;
		border-radius: 0.85rem;
		gap: 1rem;
	}

	.switch-row.highlight-emergency {
		background: #FEF2F2;
		border-color: #FECACA;
	}

	.switch-text {
		display: flex;
		flex-direction: column;
	}

	.switch-text strong {
		font-size: 0.9rem;
		color: #1E293B;
	}

	.switch-text span {
		font-size: 0.775rem;
		color: #64748B;
	}

	/* Toggle Switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 50px;
		height: 26px;
		flex-shrink: 0;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #CBD5E1;
		transition: 0.2s;
	}

	.slider:before {
		position: absolute;
		content: "";
		height: 20px;
		width: 20px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.2s;
	}

	input:checked + .slider {
		background-color: #0A5C36;
	}

	input:checked + .slider:before {
		transform: translateX(24px);
	}

	.slider.round {
		border-radius: 34px;
	}

	.slider.round:before {
		border-radius: 50%;
	}

	/* Logo Row */
	.logo-preview-row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		background: #F8FAFC;
		padding: 1.25rem;
		border-radius: 0.85rem;
		border: 1px solid #EDF2F7;
	}

	.logo-circle-preview {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: #FFFFFF;
		border: 2px solid #CBD5E1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.logo-thumb {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.logo-upload-controls {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field-label-small {
		font-size: 0.8rem;
		font-weight: 700;
		color: #475569;
		display: block;
		margin-bottom: 0.25rem;
	}

	.btn-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.hidden-file-input {
		display: none;
	}

	.file-btn {
		cursor: pointer;
	}

	/* Ticker Live Preview */
	.ticker-preview-wrap {
		background: #0B1325;
		border-radius: 0.65rem;
		padding: 0.75rem 0;
		overflow: hidden;
		white-space: nowrap;
		position: relative;
	}

	.ticker-preview-track {
		display: inline-flex;
		white-space: nowrap;
		animation: scrollPreview linear infinite;
	}

	.ticker-preview-item {
		display: inline-block;
		padding-right: 3rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #F8FAFC;
	}

	@keyframes scrollPreview {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	/* Emergency Level Group */
	.level-btn-group {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.75rem;
	}

	.level-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.85rem;
		border-radius: 0.65rem;
		font-size: 0.85rem;
		font-weight: 700;
		border: 1px solid #CBD5E1;
		background: #FFFFFF;
		cursor: pointer;
		transition: all 0.2s;
	}

	.level-btn.info-btn.active {
		background: #0284C7;
		color: #FFFFFF;
		border-color: #0284C7;
	}

	.level-btn.warning-btn.active {
		background: #D97706;
		color: #FFFFFF;
		border-color: #D97706;
	}

	.level-btn.critical-btn.active {
		background: #B91C1C;
		color: #FFFFFF;
		border-color: #B91C1C;
	}

	.emergency-preview-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		color: #FFFFFF;
	}

	.emergency-preview-box.info {
		background: linear-gradient(90deg, #0284C7 0%, #38BDF8 100%);
	}

	.emergency-preview-box.warning {
		background: linear-gradient(90deg, #D97706 0%, #F59E0B 100%);
	}

	.emergency-preview-box.critical {
		background: linear-gradient(90deg, #B91C1C 0%, #EF4444 100%);
	}

	.preview-text h4 {
		font-size: 0.85rem;
		font-weight: 800;
		margin: 0;
		text-transform: uppercase;
	}

	.preview-text p {
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0.2rem 0 0 0;
		opacity: 0.95;
	}



	/* Security Box */
	.security-status-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: #F0FDF4;
		border: 1px solid #BBF7D0;
		padding: 1.25rem;
		border-radius: 0.85rem;
	}

	.security-status-box strong {
		font-size: 0.95rem;
		color: #065F46;
		display: block;
	}

	.security-status-box p {
		font-size: 0.825rem;
		color: #166534;
		margin: 0.2rem 0 0 0;
	}

	.pin-feedback {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1.25rem;
		border-radius: 0.65rem;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.pin-feedback.error {
		background: #FEE2E2;
		border: 1px solid #FCA5A5;
		color: #991B1B;
	}

	.pin-feedback.success {
		background: #D1FAE5;
		border: 1px solid #6EE7B7;
		color: #065F46;
	}

	.pin-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Buttons & UI Extras */
	.info-box {
		background: #FFFBEB;
		border: 1px solid #FDE68A;
		border-radius: 1rem;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
	}

	.info-text strong {
		font-size: 0.85rem;
		color: #92400E;
		display: block;
		margin-bottom: 0.25rem;
	}

	.info-text p {
		font-size: 0.8rem;
		color: #78350F;
		line-height: 1.5;
		margin: 0;
	}

	.card-footer {
		display: flex;
		justify-content: flex-end;
		border-top: 1px solid #F1F5F9;
		padding-top: 1.25rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		border-radius: 0.65rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #0A5C36;
		color: #FFFFFF;
		border: none;
	}

	.btn-primary:hover {
		background: #074327;
	}

	.btn-outline {
		background: #FFFFFF;
		color: #334155;
		border: 1px solid #CBD5E1;
	}

	.btn-outline:hover {
		background: #F1F5F9;
	}

	.btn-ghost {
		background: transparent;
		border: none;
		color: #64748B;
	}

	.btn-ghost:hover {
		background: #F1F5F9;
	}

	/* Cloud Tab Styling */
	.cloud-status-banner {
		display: flex;
		align-items: flex-start;
		gap: 1.25rem;
		padding: 1.25rem 1.5rem;
		border-radius: 1rem;
		border: 1px solid #E2E8F0;
		background: #F8FAFC;
		margin-bottom: 1.5rem;
		transition: all 0.2s ease;
	}

	.cloud-status-banner.connected {
		background: #ECFDF5;
		border-color: #6EE7B7;
	}

	.cloud-status-banner.configured {
		background: #FFFBEB;
		border-color: #FDE68A;
	}

	.cloud-status-banner.local-mode {
		background: #F1F5F9;
		border-color: #CBD5E1;
	}

	.status-icon-bubble {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: #FFFFFF;
		border-radius: 50%;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}

	.status-info {
		flex: 1;
	}

	.status-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.35rem;
	}

	.status-title-row strong {
		font-size: 1rem;
		color: #0F172A;
	}

	.latency-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		background: #D1FAE5;
		color: #065F46;
		border-radius: 9999px;
	}

	.status-info p {
		font-size: 0.85rem;
		color: #475569;
		margin: 0 0 0.5rem 0;
	}

	.endpoint-meta {
		font-size: 0.8rem;
		color: #64748B;
	}

	.endpoint-meta code {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.15rem 0.4rem;
		border-radius: 0.3rem;
		font-family: monospace;
	}

	.cloud-action-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.action-card {
		background: #FFFFFF;
		border: 1px solid #E2E8F0;
		border-radius: 0.85rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1rem;
	}

	.action-card-header {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
	}

	.action-card-header h4 {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0F172A;
		margin: 0 0 0.25rem 0;
	}

	.action-card-header p {
		font-size: 0.8rem;
		color: #64748B;
		margin: 0;
		line-height: 1.4;
	}

	.guide-box {
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 0.85rem;
		padding: 1rem 1.25rem;
	}

	.guide-box ol {
		margin: 0;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: #334155;
	}

	.guide-box code {
		background: #E2E8F0;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-family: monospace;
	}

	:global(.text-blue) {
		color: #2563EB;
	}

	:global(.text-slate) {
		color: #64748B;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.upload-loading-badge {
		margin-top: 0.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #EFF6FF;
		border: 1px solid #BFDBFE;
		color: #1D4ED8;
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		font-size: 0.82rem;
		font-weight: 600;
	}

	.upload-spinner {
		width: 13px;
		height: 13px;
		border: 2px solid #BFDBFE;
		border-top-color: #1D4ED8;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	.upload-success-alert {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		background: #ECFDF5;
		border: 1.5px solid #10B981;
		color: #047857;
		padding: 0.6rem 0.9rem;
		border-radius: 0.55rem;
		font-size: 0.85rem;
		font-weight: 700;
		box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
		animation: alertPopIn 0.3s ease-out;
	}

	@keyframes alertPopIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.sql-export-card {
		background: #F8FAFC;
		border: 1.5px solid #E2E8F0;
		border-radius: 0.85rem;
		padding: 1.25rem;
	}

	.sql-export-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.sql-header-info {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
	}

	.sql-header-info h4 {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		font-weight: 800;
		color: #0F172A;
	}

	.sql-header-info p {
		margin: 0;
		font-size: 0.82rem;
		color: #64748B;
		max-width: 600px;
	}

	.sql-preview-container {
		margin-top: 1.25rem;
		border-top: 1px solid #E2E8F0;
		padding-top: 1rem;
	}

	.sql-preview-topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.65rem;
	}

	.sql-badge {
		font-size: 0.8rem;
		font-weight: 700;
		color: #047857;
		background: #D1FAE5;
		padding: 0.25rem 0.65rem;
		border-radius: 0.4rem;
	}

	.copy-btn {
		font-size: 0.8rem !important;
		padding: 0.35rem 0.75rem !important;
	}

	.sql-textarea {
		width: 100%;
		font-family: Consolas, Monaco, 'Courier New', monospace;
		font-size: 0.82rem;
		background: #0F172A;
		color: #E2E8F0;
		padding: 0.85rem;
		border-radius: 0.6rem;
		border: 1px solid #334155;
		resize: vertical;
		line-height: 1.4;
	}

	.sql-hint {
		margin-top: 0.65rem;
		font-size: 0.82rem;
		color: #334155;
		background: #EFF6FF;
		border-left: 3px solid #3B82F6;
		padding: 0.6rem 0.85rem;
		border-radius: 0 0.4rem 0.4rem 0;
	}

	/* --- Responsive Mobile & Tablet Styles (RWD) --- */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.tabs-header {
			overflow-x: auto;
			flex-wrap: nowrap;
			-webkit-overflow-scrolling: touch;
			padding-bottom: 0.5rem;
		}

		.tab-btn {
			flex-shrink: 0;
			white-space: nowrap;
		}

		.sql-export-header {
			flex-direction: column;
			align-items: stretch;
		}

		.sql-export-header .btn-primary {
			width: 100%;
			justify-content: center;
		}

		.color-picker-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.main-title {
			font-size: 1.25rem;
		}

		.subtitle {
			font-size: 0.8rem;
		}
	}

	/* --- Layout Customizer & Live Preview Styles --- */
	.preset-pills-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.85rem;
	}

	.preset-pill-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		padding: 1rem;
		background: #F8FAFC;
		border: 2px solid #E2E8F0;
		border-radius: 0.75rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
	}

	.preset-pill-btn:hover {
		border-color: #94A3B8;
	}

	.preset-pill-btn.active {
		background: #ECFDF5;
		border-color: #0A5C36;
	}

	.pill-title {
		font-size: 0.95rem;
		font-weight: 800;
		color: #0F172A;
	}

	.pill-desc {
		font-size: 0.775rem;
		color: #64748B;
		line-height: 1.35;
	}

	.custom-sliders-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.slider-control-card {
		background: #F8FAFC;
		border: 1.5px solid #E2E8F0;
		border-radius: 0.75rem;
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.control-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-bubble {
		width: 40px;
		height: 40px;
		border-radius: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-bubble.green {
		background: #D1FAE5;
		color: #065F46;
	}

	.icon-bubble.orange {
		background: #FFEDD5;
		color: #C2410C;
	}

	.icon-bubble.teal {
		background: #CCFBF1;
		color: #0F766E;
	}

	.icon-bubble.slate {
		background: #E2E8F0;
		color: #334155;
	}

	.control-card-header strong {
		font-size: 0.9rem;
		color: #0F172A;
		display: block;
	}

	.badge-unit-large {
		font-size: 0.85rem;
		font-weight: 800;
		color: #0A5C36;
	}

	.control-hint {
		font-size: 0.75rem;
		color: #64748B;
		line-height: 1.4;
		margin: 0;
	}

	/* Mockup Live Preview */
	.live-preview-box {
		background: #0F172A;
		border-radius: 0.85rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		overflow: hidden;
		box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.4);
	}

	.mockup-header {
		background: linear-gradient(100deg, #df5720 0%, #178750 66%, #0a5c36 100%);
		border-radius: 0.65rem;
		padding: 0.85rem 1rem;
		color: white;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
		transition: transform 0.2s ease;
	}

	.mockup-header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.mockup-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mockup-logo {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: white;
		border: 2px solid #0A5C36;
	}

	.mockup-instansi {
		font-size: 0.6rem;
		font-weight: 700;
		opacity: 0.9;
	}

	.mockup-name {
		font-size: 0.85rem;
		font-weight: 800;
	}

	.mockup-clock {
		font-size: 0.85rem;
		font-weight: 800;
		background: rgba(0, 0, 0, 0.25);
		padding: 0.2rem 0.5rem;
		border-radius: 0.4rem;
	}

	.mockup-header-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.mockup-title {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.mockup-header-right {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.mockup-page-badge {
		font-size: 0.68rem;
		font-weight: 800;
		background: rgba(10, 92, 54, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 0.2rem 0.5rem;
		border-radius: 0.45rem;
	}

	.mockup-circular-timer {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid #F59E0B;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.62rem;
		font-weight: 800;
		color: #FCD34D;
		background: rgba(10, 92, 54, 0.85);
	}

	.mockup-card-container {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0;
	}

	.mockup-doctor-card {
		width: 100%;
		max-width: 480px;
		background: white;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s ease;
	}

	.mockup-doc-photo {
		width: 52px;
		height: 58px;
		background: #E2E8F0;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid #CBD5E1;
		flex-shrink: 0;
	}

	.mockup-doc-info {
		flex: 1;
	}

	.mockup-doc-name {
		font-weight: 800;
		color: #0F172A;
		line-height: 1.2;
	}

	.mockup-doc-spec {
		font-size: 0.72rem;
		color: #64748B;
		margin-top: 0.15rem;
	}

	.mockup-doc-time {
		font-size: 0.7rem;
		color: #0A5C36;
		font-weight: 700;
		margin-top: 0.2rem;
	}

	.mockup-doc-status {
		padding: 0.25rem 0.6rem;
		background: #D1FAE5;
		color: #065F46;
		font-size: 0.72rem;
		font-weight: 800;
		border-radius: 0.4rem;
	}

	.mockup-footer {
		background: #022C19;
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		color: #D1FAE5;
		font-size: 0.75rem;
		font-weight: 600;
		transition: transform 0.2s ease;
	}
</style>
