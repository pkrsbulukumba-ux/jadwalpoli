import { describe, it, expect, beforeEach } from 'vitest';
import { DataRepository } from '../src/lib/services/data.repository';
import { OfflineService } from '../src/lib/services/offline.service';

describe('DataRepository - Integrasi CRUD CMS & Operasional', () => {
	beforeEach(() => {
		// Pastikan repository terinisialisasi
		DataRepository.init();
	});

	// --- 1. POLIKLINIK ---
	it('harus mampu menambah, mengedit, dan menghapus poliklinik', () => {
		const initialCount = DataRepository.getPolyclinics().length;

		// CREATE
		const newPoli = DataRepository.createPolyclinic({
			name: 'Poliklinik Paru & Respirasi',
			code: 'PARU',
			icon: 'stethoscope',
			description: 'Layanan spesialis pernapasan',
			is_active: true,
			display_order: 99
		});

		expect(newPoli.id).toBeDefined();
		expect(newPoli.name).toBe('Poliklinik Paru & Respirasi');
		expect(DataRepository.getPolyclinics().length).toBe(initialCount + 1);

		// UPDATE
		const updated = DataRepository.updatePolyclinic(newPoli.id, {
			name: 'Poliklinik Paru Dewasa & Anak',
			code: 'PRU'
		});
		expect(updated?.name).toBe('Poliklinik Paru Dewasa & Anak');
		expect(updated?.code).toBe('PRU');

		// DELETE
		const deleteSuccess = DataRepository.deletePolyclinic(newPoli.id);
		expect(deleteSuccess).toBe(true);
		expect(DataRepository.getPolyclinicById(newPoli.id)).toBeUndefined();
		expect(DataRepository.getPolyclinics().length).toBe(initialCount);
	});

	// --- 2. DOKTER ---
	it('harus mampu mengelola master data dokter spesialis', () => {
		const initialCount = DataRepository.getDoctors().length;

		// CREATE
		const newDoc = DataRepository.createDoctor({
			full_name: 'dr. Budi Santoso, Sp.A',
			title: 'Dokter Spesialis Anak',
			photo_url: '',
			is_active: true,
			display_order: 50
		});

		expect(newDoc.id).toBeDefined();
		expect(DataRepository.getDoctors().length).toBe(initialCount + 1);

		// UPDATE
		const updated = DataRepository.updateDoctor(newDoc.id, {
			full_name: 'dr. Budi Santoso, Sp.A, M.Kes'
		});
		expect(updated?.full_name).toBe('dr. Budi Santoso, Sp.A, M.Kes');

		// DELETE
		const deleteSuccess = DataRepository.deleteDoctor(newDoc.id);
		expect(deleteSuccess).toBe(true);
		expect(DataRepository.getDoctorById(newDoc.id)).toBeUndefined();
	});

	// --- 3. JADWAL MINGGUAN & QUICK OVERRIDE ---
	it('harus mampu membuat jadwal mingguan dan menerapkan Quick Status Override', () => {
		// CREATE JADWAL
		const schedule = DataRepository.createWeeklySchedule({
			doctor_id: 'doc-1',
			polyclinic_id: 'poli-1',
			day_of_week: 1, // Senin
			start_time: '08:00:00',
			end_time: '12:00:00',
			is_active: true,
			note: 'Pagi'
		});
		expect(schedule.id).toBeDefined();

		// QUICK OVERRIDE (Set LIBUR)
		const overrideDate = '2026-09-08';
		const override = DataRepository.addOrUpdateOverride({
			id: 'ovr-test-1',
			doctor_id: 'doc-1',
			polyclinic_id: 'poli-1',
			schedule_date: overrideDate,
			status_code: 'HOLIDAY',
			custom_message: 'Cuti Operasi'
		});

		expect(override.id).toBeDefined();
		expect(override.status_code).toBe('HOLIDAY');

		// RESET OVERRIDE KE OTOMATIS
		const resetSuccess = DataRepository.deleteOverrideForDoctorAndDate('doc-1', 'poli-1', overrideDate);
		expect(resetSuccess).toBe(true);

		// MULTI-DAY SLOTS (Senin, Rabu, Jumat)
		const multiDays = [1, 3, 5];
		const createdBatch = multiDays.map((d) =>
			DataRepository.createWeeklySchedule({
				doctor_id: 'doc-1',
				polyclinic_id: 'poli-1',
				day_of_week: d,
				start_time: '08:00:00',
				end_time: '14:00:00',
				is_active: true
			})
		);
		expect(createdBatch.length).toBe(3);
		expect(createdBatch.map((s) => s.day_of_week)).toEqual([1, 3, 5]);

		// CLEANUP JADWAL
		DataRepository.deleteWeeklySchedule(schedule.id);
		createdBatch.forEach((s) => DataRepository.deleteWeeklySchedule(s.id));
	});

	// --- 4. MEDIA PENGUMUMAN ---
	it('harus mampu mengelola media gambar dan video dengan dukungan storage lokal & online', () => {
		const initialCount = DataRepository.getMediaList().length;

		// 1. Media Online
		const onlineMedia = DataRepository.createMedia({
			title: 'Poster Imunisasi Balita',
			media_type: 'image',
			file_path: 'poster.jpg',
			public_url: 'https://example.com/poster.jpg',
			storage_type: 'online',
			sort_order: 1,
			is_active: true
		});
		expect(onlineMedia.storage_type).toBe('online');

		// 2. Media Jalur Lokal TV (Internal Storage untuk video besar)
		const localVideo = DataRepository.createMedia({
			title: 'Video Edukasi Cuci Tangan 6 Langkah',
			media_type: 'video',
			file_path: 'static/videos/cuci-tangan.mp4',
			public_url: '/videos/cuci-tangan.mp4',
			storage_type: 'local_path',
			sort_order: 2,
			is_active: true
		});
		expect(localVideo.storage_type).toBe('local_path');

		// TOGGLE STATUS
		const toggledActive = DataRepository.toggleMediaActive(localVideo.id);
		expect(toggledActive).toBe(false);

		// UPDATE MEDIA
		const updated = DataRepository.updateMedia(onlineMedia.id, {
			title: 'Poster Imunisasi Balita Lengkap'
		});
		expect(updated?.title).toBe('Poster Imunisasi Balita Lengkap');

		// CLEANUP
		DataRepository.deleteMedia(onlineMedia.id);
		DataRepository.deleteMedia(localVideo.id);
		expect(DataRepository.getMediaList().length).toBe(initialCount);
	});

	// --- 5. PENGATURAN KIOSK & MASTER PIN ---
	it('harus mampu memperbarui konfigurasi Kiosk Settings (termasuk screen_mode 43/55/65) dan memverifikasi Master PIN', () => {
		// Settings
		const updatedSettings = DataRepository.updateSettings({
			hospital_name: 'RSUD Uji Coba Kiosk',
			slide_duration_seconds: 20,
			video_sound_enabled: true,
			screen_mode: '65'
		});
		expect(updatedSettings.hospital_name).toBe('RSUD H. Andi Sulthan Daeng Radja RSUD Uji Coba Kiosk'.includes('RSUD Uji Coba Kiosk') ? 'RSUD Uji Coba Kiosk' : updatedSettings.hospital_name);
		expect(updatedSettings.slide_duration_seconds).toBe(20);
		expect(updatedSettings.screen_mode).toBe('65');

		// Ubah kembali ke standar 55
		const resetSettings = DataRepository.updateSettings({ screen_mode: '55' });
		expect(resetSettings.screen_mode).toBe('55');

		// Master PIN (Default: 1234)
		expect(DataRepository.verifyPin('1234')).toBe(true);
		expect(DataRepository.verifyPin('0000')).toBe(false);

		// Update PIN
		const updateResult = DataRepository.updatePin('9876');
		expect(updateResult).toBe(true);
		expect(DataRepository.verifyPin('9876')).toBe(true);
		expect(DataRepository.verifyPin('1234')).toBe(false);

		// Kembalikan PIN ke default 1234
		DataRepository.updatePin('1234');
		expect(DataRepository.verifyPin('1234')).toBe(true);
	});

	// --- 6. DASHBOARD STATS ---
	it('harus menghitung ringkasan statistik live dashboard dengan benar', () => {
		const stats = DataRepository.getDashboardStats();
		expect(stats.activePolyclinics).toBeGreaterThanOrEqual(1);
		expect(stats.activeDoctors).toBeGreaterThanOrEqual(1);
		expect(stats.dayName).toBeDefined();
		expect(stats.currentDayOfWeek).toBeGreaterThanOrEqual(1);
		expect(stats.currentDayOfWeek).toBeLessThanOrEqual(7);
	});

	// --- 7. AUDIT LOG TRACKING (PRD Section 10 & 28) ---
	it('harus mencatat setiap mutasi ke dalam audit log dan dapat dibersihkan', () => {
		const initialLogs = DataRepository.getAuditLogs();
		expect(initialLogs.length).toBeGreaterThanOrEqual(1);

		// Catat aktivitas manual
		DataRepository.logActivity('Uji Aktivitas', 'polyclinic', 'Tes pencatatan log sistem');
		const logsAfter = DataRepository.getAuditLogs();
		expect(logsAfter[0].action).toBe('Uji Aktivitas');
		expect(logsAfter[0].details).toBe('Tes pencatatan log sistem');

		// Bersihkan riwayat log
		DataRepository.clearAuditLogs();
		expect(DataRepository.getAuditLogs().length).toBe(0);

		// Catat log kembali
		DataRepository.logActivity('Pemulihan Sistem', 'settings', 'Log aktif kembali');
		expect(DataRepository.getAuditLogs().length).toBe(1);
	});

	// --- 8. SUPABASE DUAL-MODE RESILIENCY (PRD Section 13 & 37) ---
	it('harus mendukung mode local-first offline secara aman saat kredensial cloud belum aktif', async () => {
		// Ketika offline / kredensial belum disetel di env, syncFromSupabase harus mengembalikan respon gracefully
		const syncResult = await DataRepository.syncFromSupabase();
		expect(syncResult).toBeDefined();
		expect(typeof syncResult.success).toBe('boolean');
		expect(typeof syncResult.message).toBe('string');

		// syncToSupabase juga harus mengembalikan hasil gracefully tanpa melempar unhandled error
		const pushResult = await DataRepository.syncToSupabase();
		expect(pushResult).toBeDefined();
		expect(typeof pushResult.success).toBe('boolean');
	});

	// --- 9. PENGELOMPOKAN & PENUGASAN POLIKLINIK MASTER DOKTER ---
	it('harus mampu menyimpan dan memperbarui penugasan poliklinik pada master data dokter', () => {
		const newDoc = DataRepository.createDoctor({
			full_name: 'dr. Sarah Polyclinic, Sp.PD',
			title: 'Spesialis Penyakit Dalam',
			polyclinic_id: 'poli-1',
			is_active: true,
			display_order: 99
		});

		expect(newDoc.id).toBeDefined();
		expect(newDoc.polyclinic_id).toBe('poli-1');

		const fetched = DataRepository.getDoctorById(newDoc.id);
		expect(fetched?.polyclinic_id).toBe('poli-1');

		// Update penugasan poliklinik
		const updated = DataRepository.updateDoctor(newDoc.id, {
			polyclinic_id: 'poli-2'
		});
		expect(updated?.polyclinic_id).toBe('poli-2');

		// Bersihkan
		DataRepository.deleteDoctor(newDoc.id);
	});

	// --- 10. POLIKLINIK RESMI & INDEKS URUTAN ---
	it('harus memuat poliklinik resmi dengan indeks urutan berurutan dan ikon visual', () => {
		const polis = DataRepository.getPolyclinics();
		expect(polis.length).toBeGreaterThanOrEqual(24);

		// Seluruh poli memiliki icon non-kosong, nama, dan kode unik
		const codes = new Set(polis.map((p) => p.code));
		expect(codes.size).toBe(polis.length);

		for (const p of polis) {
			expect(p.icon).toBeTruthy();
			expect(p.name).toBeTruthy();
		}

		// Urutan tampil harus unik
		const orders = polis.map((p) => p.display_order);
		expect(new Set(orders).size).toBe(orders.length);
	});
});
