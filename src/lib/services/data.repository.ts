import { browser } from '$app/environment';
import type {
	Polyclinic,
	Doctor,
	WeeklySchedule,
	PracticeStatus,
	ScheduleOverride,
	MediaAnnouncement,
	KioskSettings,
	FooterNotice,
	PoliSectionData,
	KioskSlide,
	AuditLog
} from '$lib/types';
import { DUMMY_POLI_SLIDE_1, DUMMY_POLI_SLIDE_2 } from '$lib/constants/dummy-data';
import { supabase, isSupabaseConfigured } from '$lib/supabase/client';

const STORAGE_KEY_PREFIX = 'rsud_kiosk_data_v1_';

const SUPABASE_TABLE = {
	polyclinics: 'polyclinics',
	doctors: 'doctors',
	weekly_schedules: 'weekly_schedules',
	schedule_overrides: 'schedule_overrides',
	media_announcements: 'media_announcements',
	kiosk_settings: 'kiosk_settings',
	footer_notices: 'footer_notices',
	practice_statuses: 'practice_statuses',
	doctor_polyclinics: 'doctor_polyclinics'
} as const;

function isOnline(): boolean {
	// Cegah pengujian otomatis (Vitest) mencemari atau mengirim mutasi ke database Supabase live
	if (typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test')) {
		return false;
	}
	return isSupabaseConfigured();
}

async function sbInsert<T>(table: string, payload: T[]): Promise<{ ok: boolean; data?: T[]; error?: string }> {
	try {
		const { data, error } = await (supabase.from(table) as any).insert(payload).select();
		if (error) return { ok: false, error: error.message };
		return { ok: true, data: (data ?? []) as T[] };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function sbUpsert<T>(table: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
	try {
		const { error } = await (supabase.from(table) as any).upsert(payload as any);
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function sbUpdate<T>(table: string, id: string, patch: Partial<T>): Promise<{ ok: boolean; error?: string }> {
	try {
		const { error } = await (supabase.from(table) as any).update(patch as any).eq('id', id);
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function sbDelete(table: string, id: string): Promise<{ ok: boolean; error?: string }> {
	try {
		const { error } = await (supabase.from(table) as any).delete().eq('id', id);
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

async function sbSelect<T>(table: string, orderBy: string, asc = true): Promise<T[]> {
	try {
		const { data, error } = await (supabase.from(table) as any).select('*').order(orderBy, { ascending: asc });
		if (error || !data) return [];
		return data as T[];
	} catch {
		return [];
	}
}

async function sbSelectEq<T>(table: string, col: string, val: string): Promise<T[]> {
	try {
		const { data, error } = await (supabase.from(table) as any).select('*').eq(col, val);
		if (error || !data) return [];
		return data as T[];
	} catch {
		return [];
	}
}

/**
 * DataRepository: Supabase-First + Local Cache Fallback
 *
 * Arsitektur baru (launching): semua mutasi tulis LANGSUNG ke Supabase setiap saat
 * ketika kredensial terisi. localStorage hanya dipakai sebagai cache read-through
 * untuk fallback offline. Ketika offline/konfig tidak ada, tulisan tetap ke cache.
 *
 * Data lama (local-db.json / localStorage v1) tidak pernah dihapus — tetap
 * sebagai fallback dan bisa dimigrasi via exportToSupabaseSql / syncLocalToCloud.
 */
export class DataRepository {
	private static isInitialized = false;
	private static isServerSynced = false;
	private static syncPromise: Promise<void> | null = null;
	private static persistTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Flag Mutation Lock: true saat operasi CRUD lokal sedang berlangsung.
	 * Mencegah event Realtime Supabase (echo dari mutasi sendiri) mengoverwrite
	 * state in-memory sebelum operasi lokal selesai (fix race condition).
	 */
	private static isMutating = false;
	// Singleton Realtime channel agar tidak dibuat ulang per-komponen
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private static realtimeChannel: any = null;


	// In-memory collections
	private static polyclinics: Polyclinic[] = [];
	private static doctors: Doctor[] = [];
	private static weeklySchedules: WeeklySchedule[] = [];
	private static overrides: ScheduleOverride[] = [];
	private static mediaList: MediaAnnouncement[] = [];
	private static settings: KioskSettings;
	private static footerNotices: FooterNotice[] = [];
	private static auditLogs: AuditLog[] = [];
	private static masterPin = '1234';

	/**
	 * Inisialisasi data dari localStorage (jika di browser) atau default seed data
	 */
	public static init() {
		if (this.isInitialized) return;

		this.polyclinics = this.loadFromStorage('polyclinics', [
			{ id: 'poli-1', name: 'JANTUNG', code: 'JTG', icon: 'heart', description: 'Poliklinik Spesialis Jantung & Pembuluh Darah', is_active: true, display_order: 1 },
			{ id: 'poli-2', name: 'JIWA', code: 'JWA', icon: 'brain', description: 'Poliklinik Kesehatan Jiwa & Psikiatri', is_active: true, display_order: 2 },
			{ id: 'poli-4', name: 'KULIT DAN KELAMIN', code: 'KLT', icon: 'shield', description: 'Poliklinik Spesialis Kulit & Kelamin', is_active: true, display_order: 3 },
			{ id: 'poli-6', name: 'MATA', code: 'MTA', icon: 'eye', description: 'Poliklinik Spesialis Mata & Kesehatan Penglihatan', is_active: true, display_order: 4 },
			{ id: 'poli-1788928328490', name: 'ORTHOPEDI', code: 'ORT', icon: 'bone', description: 'Poliklinik Spesialis Orthopedi & Traumatologi', is_active: true, display_order: 5 },
			{ id: 'poli-paru', name: 'PARU', code: 'PRU', icon: 'wind', description: 'Poliklinik Spesialis Paru & Respirasi', is_active: true, display_order: 6 },
			{ id: 'poli-saraf', name: 'SARAF', code: 'SRF', icon: 'zap', description: 'Poliklinik Spesialis Saraf & Neurologi', is_active: true, display_order: 7 },
			{ id: 'poli-tht', name: 'THT', code: 'THT', icon: 'ear', description: 'Poliklinik Spesialis Telinga, Hidung & Tenggorokan', is_active: true, display_order: 8 },
			{ id: 'poli-onkologi', name: 'BEDAH ONKOLOGI', code: 'ONK', icon: 'scissors', description: 'Poliklinik Spesialis Bedah Onkologi (Kanker & Tumor)', is_active: true, display_order: 9 },
			{ id: 'poli-rehab', name: 'REHAB MEDIK', code: 'RHB', icon: 'accessibility', description: 'Poliklinik Kedokteran Fisik & Rehabilitasi Medik', is_active: true, display_order: 10 },
			{ id: 'poli-anak', name: 'ANAK', code: 'ANK', icon: 'baby', description: 'Poliklinik Spesialis Kesehatan Anak', is_active: true, display_order: 11 },
			{ id: 'poli-bedah', name: 'BEDAH', code: 'BDH', icon: 'bandage', description: 'Poliklinik Spesialis Bedah Umum', is_active: true, display_order: 12 },
			{ id: 'poli-5', name: 'PENYAKIT DALAM', code: 'INT', icon: 'stethoscope', description: 'Poliklinik Spesialis Penyakit Dalam (Interna)', is_active: true, display_order: 13 },
			{ id: 'poli-obgyn', name: 'OBSTETRI DAN GINEKOLOGI', code: 'OBG', icon: 'heart-pulse', description: 'Poliklinik Spesialis Kebidanan & Kandungan (Obgyn)', is_active: true, display_order: 14 },
			{ id: 'poli-3', name: 'KB', code: 'KB', icon: 'users', description: 'Poliklinik Pelayanan Keluarga Berencana (KB)', is_active: true, display_order: 15 },
			{ id: 'poli-nyeri', name: 'NYERI', code: 'NYR', icon: 'zap-off', description: 'Poliklinik Manajemen Intervensi Nyeri', is_active: true, display_order: 16 },
			{ id: 'poli-gizi', name: 'GIZI', code: 'GZI', icon: 'apple', description: 'Poliklinik Konsultasi Gizi Klinis & Dietetik', is_active: true, display_order: 17 },
			{ id: 'poli-gigi-endo', name: 'GIGI ENDODONSI', code: 'G-END', icon: 'sparkles', description: 'Poliklinik Gigi Spesialis Konservasi & Saluran Akar', is_active: true, display_order: 18 },
			{ id: 'poli-gigi-perio', name: 'GIGI PERIODONTI', code: 'G-PER', icon: 'smile-plus', description: 'Poliklinik Gigi Spesialis Jaringan Periodontal & Gusi', is_active: true, display_order: 19 },
			{ id: 'poli-gigi-prosth', name: 'GIGI PROSTHODONTI', code: 'G-PRO', icon: 'smile', description: 'Poliklinik Gigi Spesialis Gigi Tiruan & Prostetik', is_active: true, display_order: 20 },
			{ id: 'poli-bedah-saraf', name: 'BEDAH SARAF', code: 'B-SRF', icon: 'activity', description: 'Poliklinik Spesialis Bedah Saraf', is_active: true, display_order: 21 },
			{ id: 'poli-mcu', name: 'MEDICAL CHECK-UP', code: 'MCU', icon: 'clipboard-check', description: 'Layanan Pemeriksaan Kesehatan Berkala & MCU', is_active: true, display_order: 22 },
			{ id: 'poli-radiologi', name: 'RADIOLOGI', code: 'RAD', icon: 'scan', description: 'Instalasi Radiologi & Pencitraan Diagnostik', is_active: true, display_order: 23 },
			{ id: 'poli-laboratorium', name: 'LABORATORIUM', code: 'LAB', icon: 'microscope', description: 'Instalasi Laboratorium Patologi Klinik', is_active: true, display_order: 24 }
		]);

		this.doctors = this.loadFromStorage('doctors', [
			{ id: 'doc-1', full_name: 'dr. Deni Syamsuddin, Sp.JP', title: 'Spesialis Jantung & Pembuluh Darah', photo_url: '', polyclinic_id: 'poli-1', is_active: true, display_order: 1 },
			{ id: 'doc-2', full_name: 'dr. Wahyuni, Sp.KJ', title: 'Spesialis Kedokteran Jiwa', photo_url: '', polyclinic_id: 'poli-2', is_active: true, display_order: 2 },
			{ id: 'doc-3', full_name: 'Bdn. Asmiati, S.Tr.Keb', title: 'Bidan Ahli', photo_url: '', polyclinic_id: 'poli-3', is_active: true, display_order: 3 },
			{ id: 'doc-4', full_name: 'dr. Hj. Nurhidayat, M.Kes, Sp.DV', title: 'Spesialis Kulit & Kelamin', photo_url: '', polyclinic_id: 'poli-4', is_active: true, display_order: 4 },
			{ id: 'doc-5', full_name: 'dr. H. Rasyid Ridho, Sp.PD-KGEH', title: 'Konsultan Gastroenterohepatologi', photo_url: '', polyclinic_id: 'poli-5', is_active: true, display_order: 5 },
			{ id: 'doc-6', full_name: 'dr. Siti Rahma, Sp.PD', title: 'Spesialis Penyakit Dalam', photo_url: '', polyclinic_id: 'poli-5', is_active: true, display_order: 6 },
			{ id: 'doc-7', full_name: 'dr. Maya Indah, Sp.M', title: 'Spesialis Mata', photo_url: '', polyclinic_id: 'poli-6', is_active: true, display_order: 7 },
			{ id: 'doc-8', full_name: 'dr. Ahmad Faisal, Sp.A, M.Kes', title: 'Spesialis Anak', photo_url: '', polyclinic_id: 'poli-7', is_active: true, display_order: 8 }
		]);

		this.mediaList = this.loadFromStorage('media', [
			{
				id: 'med-1',
				title: 'Layanan Unggulan Poliklinik Eksekutif RSUD H. Andi Sulthan Daeng Radja',
				media_type: 'image',
				file_path: 'announcements/edukasi-layanan.jpg',
				public_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
				sort_order: 1,
				is_active: true
			},
			{
				id: 'med-2',
				title: 'Panduan Pendaftaran Online & Antrean Pasien BPJS Mobile JKN',
				media_type: 'video',
				file_path: 'announcements/video-edukasi-jkn.mp4',
				public_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
				sort_order: 2,
				is_active: true
			}
		]);

		this.settings = this.loadFromStorage('settings', {
			hospital_name: 'RSUD H. Andi Sulthan Daeng Radja',
			hospital_subtitle: 'Kabupaten Bulukumba',
			hospital_logo_url: '',
			timezone: 'Asia/Makassar',
			date_format: 'dd MMMM yyyy',
			time_format: 'HH:mm',
			slide_duration_seconds: 15,
			image_duration_seconds: 10,
			video_wait_for_end: true,
			video_sound_enabled: true,
			refresh_interval_seconds: 30,
			font_scale: 1,
			card_scale: 1,
			header_scale: 1,
			footer_scale: 1,
			show_page_indicator: true,
			show_running_text: true,
			show_footer_notices: true,
			show_emergency_banner: false,
			emergency_title: 'PENGUMUMAN LAYANAN POLIKLINIK',
			emergency_message: 'Poli Penyakit Dalam hari ini beroperasi normal hingga pukul 14.00 WITA.',
			emergency_level: 'warning',
			running_text: 'Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Instagram: @RSUDBULUKUMBA • Melayani Dengan Sepenuh Hati',
			running_text_speed: 26,
			running_text_direction: 'left',
			screen_mode: '55'
		});

		this.masterPin = this.loadFromStorage('master_pin', '1234');

		this.weeklySchedules = this.loadFromStorage('schedules', [
			// Dokter Deni (Poli Jantung)
			{ id: 'sch-1', doctor_id: 'doc-1', polyclinic_id: 'poli-1', day_of_week: 1, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-2', doctor_id: 'doc-1', polyclinic_id: 'poli-1', day_of_week: 2, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-3', doctor_id: 'doc-1', polyclinic_id: 'poli-1', day_of_week: 3, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-4', doctor_id: 'doc-1', polyclinic_id: 'poli-1', day_of_week: 4, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-5', doctor_id: 'doc-1', polyclinic_id: 'poli-1', day_of_week: 5, start_time: '10:00:00', end_time: '12:00:00', is_active: true },
			// Dokter Wahyuni (Poli Jiwa)
			{ id: 'sch-6', doctor_id: 'doc-2', polyclinic_id: 'poli-2', day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-7', doctor_id: 'doc-2', polyclinic_id: 'poli-2', day_of_week: 2, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-8', doctor_id: 'doc-2', polyclinic_id: 'poli-2', day_of_week: 3, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-9', doctor_id: 'doc-2', polyclinic_id: 'poli-2', day_of_week: 4, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-10', doctor_id: 'doc-2', polyclinic_id: 'poli-2', day_of_week: 5, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
			// Bidan Asmiati (Poli KB)
			{ id: 'sch-11', doctor_id: 'doc-3', polyclinic_id: 'poli-3', day_of_week: 1, start_time: '08:30:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-12', doctor_id: 'doc-3', polyclinic_id: 'poli-3', day_of_week: 2, start_time: '08:30:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-13', doctor_id: 'doc-3', polyclinic_id: 'poli-3', day_of_week: 3, start_time: '08:30:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-14', doctor_id: 'doc-3', polyclinic_id: 'poli-3', day_of_week: 4, start_time: '08:30:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-15', doctor_id: 'doc-3', polyclinic_id: 'poli-3', day_of_week: 5, start_time: '08:30:00', end_time: '12:00:00', is_active: true },
			// Dokter Nurhidayat (Poli Kulit)
			{ id: 'sch-16', doctor_id: 'doc-4', polyclinic_id: 'poli-4', day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-17', doctor_id: 'doc-4', polyclinic_id: 'poli-4', day_of_week: 2, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-18', doctor_id: 'doc-4', polyclinic_id: 'poli-4', day_of_week: 3, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-19', doctor_id: 'doc-4', polyclinic_id: 'poli-4', day_of_week: 4, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			// Dokter Rasyid (Penyakit Dalam)
			{ id: 'sch-20', doctor_id: 'doc-5', polyclinic_id: 'poli-5', day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-21', doctor_id: 'doc-5', polyclinic_id: 'poli-5', day_of_week: 2, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			{ id: 'sch-22', doctor_id: 'doc-5', polyclinic_id: 'poli-5', day_of_week: 4, start_time: '09:00:00', end_time: '13:00:00', is_active: true },
			// Dokter Siti Rahma (Penyakit Dalam)
			{ id: 'sch-23', doctor_id: 'doc-6', polyclinic_id: 'poli-5', day_of_week: 2, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-24', doctor_id: 'doc-6', polyclinic_id: 'poli-5', day_of_week: 3, start_time: '10:00:00', end_time: '14:00:00', is_active: true },
			{ id: 'sch-25', doctor_id: 'doc-6', polyclinic_id: 'poli-5', day_of_week: 5, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
			// Dokter Maya (Mata)
			{ id: 'sch-26', doctor_id: 'doc-7', polyclinic_id: 'poli-6', day_of_week: 1, start_time: '08:00:00', end_time: '12:00:00', is_active: true },
			{ id: 'sch-27', doctor_id: 'doc-7', polyclinic_id: 'poli-6', day_of_week: 2, start_time: '08:00:00', end_time: '12:00:00', is_active: true },
			// Dokter Ahmad Faisal (Anak)
			{ id: 'sch-28', doctor_id: 'doc-8', polyclinic_id: 'poli-7', day_of_week: 2, start_time: '13:00:00', end_time: '16:00:00', is_active: true },
			{ id: 'sch-29', doctor_id: 'doc-8', polyclinic_id: 'poli-7', day_of_week: 3, start_time: '13:00:00', end_time: '16:00:00', is_active: true }
		]);

		this.overrides = this.loadFromStorage('overrides', []);
		this.auditLogs = this.loadFromStorage('audit_logs', [
			{
				id: 'log-init',
				timestamp: new Date().toISOString(),
				action: 'Sistem Kiosk Siaga',
				entity_type: 'settings',
				actor_name: 'Sistem Kiosk RSUD',
				details: 'Basis data poliklinik dan jadwal aktif dimuat.'
			}
		]);
		this.isInitialized = true;
		if (browser && !this.isServerSynced) {
			if (isOnline()) {
				this.syncFromSupabase();
			} else {
				this.syncWithServer();
			}
		}
	}

	// --- Poliklinik CRUD ---
	public static getPolyclinics(): Polyclinic[] {
		this.init();
		return [...this.polyclinics].sort((a, b) => a.display_order - b.display_order);
	}

	public static createPolyclinic(data: Omit<Polyclinic, 'id'>): Polyclinic {
		this.init();
		const newPoli: Polyclinic = {
			...data,
			id: 'poli-' + Date.now()
		};
		this.polyclinics.push(newPoli);
		this.saveToStorage('polyclinics', this.polyclinics);
		if (isOnline()) {
			this.isMutating = true;
			sbInsert(SUPABASE_TABLE.polyclinics, [{ ...newPoli }]).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync poli baru ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Menambah Poliklinik', 'polyclinic', `Poliklinik ${newPoli.name} (${newPoli.code}) ditambahkan.`, newPoli.id);
		return newPoli;
	}

	public static updatePolyclinic(id: string, data: Partial<Polyclinic>): Polyclinic | null {
		this.init();
		const index = this.polyclinics.findIndex((p) => p.id === id);
		if (index === -1) return null;
		this.polyclinics[index] = { ...this.polyclinics[index], ...data };
		this.saveToStorage('polyclinics', this.polyclinics);
		if (isOnline()) {
			this.isMutating = true;
			sbUpdate(SUPABASE_TABLE.polyclinics, id, { ...this.polyclinics[index] }).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync update poli ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Memperbarui Poliklinik', 'polyclinic', `Poliklinik ${this.polyclinics[index].name} diperbarui.`, id);
		return this.polyclinics[index];
	}

	public static getPolyclinicById(id: string): Polyclinic | undefined {
		this.init();
		return this.polyclinics.find((p) => p.id === id);
	}

	public static deletePolyclinic(id: string): boolean {
		this.init();
		const target = this.polyclinics.find((p) => p.id === id);
		const before = this.polyclinics.length;
		this.polyclinics = this.polyclinics.filter((p) => p.id !== id);
		this.saveToStorage('polyclinics', this.polyclinics);
		if (isOnline()) {
			this.isMutating = true;
			sbDelete(SUPABASE_TABLE.polyclinics, id).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync hapus poli ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		if (this.polyclinics.length < before) {
			this.logActivity('Menghapus Poliklinik', 'polyclinic', `Poliklinik ${target?.name || id} dihapus.`, id);
			return true;
		}
		return false;
	}

	// --- Dokter CRUD & Manajemen Urutan Tampilan ---
	public static getDoctors(): Doctor[] {
		this.init();
		return [...this.doctors].sort((a, b) => a.display_order - b.display_order);
	}

	public static getDoctorById(id: string): Doctor | undefined {
		this.init();
		return this.doctors.find((d) => d.id === id);
	}

	/**
	 * Mengambil seluruh dokter yang terhubung dengan poliklinik tertentu
	 */
	public static getDoctorsInPoli(polyclinicId?: string): Doctor[] {
		this.init();
		if (!polyclinicId || polyclinicId === 'unassigned') {
			return this.doctors
				.filter((d) => !d.polyclinic_id && !this.weeklySchedules.some((s) => s.doctor_id === d.id))
				.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
		}
		return this.doctors
			.filter(
				(d) =>
					d.polyclinic_id === polyclinicId ||
					this.weeklySchedules.some((s) => s.doctor_id === d.id && s.polyclinic_id === polyclinicId)
			)
			.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
	}

	/**
	 * Menghitung nomor urut berikutnya yang tersedia pada poliklinik
	 */
	public static getNextDoctorOrder(polyclinicId?: string): number {
		this.init();
		if (!polyclinicId) return this.doctors.length + 1;
		const docs = this.getDoctorsInPoli(polyclinicId);
		if (docs.length === 0) return 1;
		return Math.max(...docs.map((d) => d.display_order || 0), 0) + 1;
	}

	/**
	 * Memeriksa dokter yang saat ini menempati nomor urutan tertentu di poliklinik
	 */
	public static getDoctorAtOrder(polyclinicId: string, order: number, excludeDoctorId?: string): Doctor | null {
		this.init();
		const docs = this.getDoctorsInPoli(polyclinicId);
		return docs.find((d) => d.display_order === order && d.id !== excludeDoctorId) || null;
	}

	/**
	 * Mengatur ulang urutan dokter dengan mode pergeseran (shift) atau penukaran (swap),
	 * lalu melakukan normalisasi sehingga urutan selalu rapi 1, 2, 3...
	 */
	public static reorderDoctor(
		doctorId: string,
		polyclinicId: string,
		targetOrder: number,
		mode: 'shift' | 'swap' = 'shift'
	): void {
		this.init();
		const targetDoc = this.doctors.find((d) => d.id === doctorId);
		if (!targetDoc) return;

		const poliDocs = this.getDoctorsInPoli(polyclinicId);
		const others = poliDocs.filter((d) => d.id !== doctorId).sort((a, b) => a.display_order - b.display_order);

		if (mode === 'swap') {
			const conflictDoc = others.find((d) => d.display_order === targetOrder);
			if (conflictDoc) {
				conflictDoc.display_order = targetDoc.display_order;
			}
			targetDoc.display_order = targetOrder;
			const all = [targetDoc, ...others].sort((a, b) => a.display_order - b.display_order);
			all.forEach((d, idx) => {
				d.display_order = idx + 1;
			});
		} else {
			// Mode 'shift' (Insert & Shift +1)
			const reordered = [...others];
			const insertIdx = Math.max(0, Math.min(targetOrder - 1, reordered.length));
			reordered.splice(insertIdx, 0, targetDoc);
			reordered.forEach((d, idx) => {
				d.display_order = idx + 1;
			});
		}

		this.saveToStorage('doctors', this.doctors);
		this.logActivity('Mengubah Urutan Dokter', 'doctor', `Urutan dokter ${targetDoc.full_name} diatur menjadi #${targetDoc.display_order}.`, targetDoc.id);
	}

	/**
	 * Normalisasi nomor urut dokter di suatu poliklinik menjadi 1, 2, 3... berurutan
	 */
	public static normalizeDoctorOrdersInPoli(polyclinicId?: string): void {
		const docs = this.getDoctorsInPoli(polyclinicId);
		docs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
		docs.forEach((doc, idx) => {
			doc.display_order = idx + 1;
		});
	}

	/**
	 * Menggeser urutan grup poliklinik naik atau turun di layar Kiosk
	 */
	public static movePolyclinicOrder(polyclinicId: string, direction: 'up' | 'down'): boolean {
		this.init();
		const activePolis = this.polyclinics
			.filter((p) => p.is_active && p.id !== 'other' && p.id !== 'unassigned')
			.sort((a, b) => a.display_order - b.display_order);

		const idx = activePolis.findIndex((p) => p.id === polyclinicId);
		if (idx === -1) return false;

		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= activePolis.length) return false;

		const currentPoli = activePolis[idx];
		const adjacentPoli = activePolis[targetIdx];

		const tempOrder = currentPoli.display_order;
		currentPoli.display_order = adjacentPoli.display_order;
		adjacentPoli.display_order = tempOrder;

		// Normalisasi display_order poliklinik agar berurutan rapi 1, 2, 3...
		activePolis.sort((a, b) => a.display_order - b.display_order);
		activePolis.forEach((p, i) => {
			p.display_order = i + 1;
		});

		this.saveToStorage('polyclinics', this.polyclinics);
		if (isOnline()) {
			// Sync perubahan display_order ke Supabase (sebelumnya tidak ada, penyebab reset urutan)
			this.isMutating = true;
			const ordersToUpdate = [
				{ id: currentPoli.id, display_order: currentPoli.display_order },
				{ id: adjacentPoli.id, display_order: adjacentPoli.display_order }
			];
			Promise.all(ordersToUpdate.map(p =>
				sbUpdate(SUPABASE_TABLE.polyclinics, p.id, { display_order: p.display_order })
			)).then(results => {
				results.forEach(r => {
					if (!r.ok) console.warn('[Supabase] Gagal sync urutan poli ke cloud:', r.error);
				});
			}).finally(() => {
				setTimeout(() => { this.isMutating = false; }, 500);
			});
		}
		this.logActivity(
			'Geser Urutan Poliklinik',
			'polyclinic',
			`Urutan poliklinik ${currentPoli.name} dipindahkan ke #${currentPoli.display_order}.`,
			currentPoli.id
		);
		return true;
	}

	/**
	 * Menggeser urutan dokter naik atau turun 1 peringkat langsung dalam polikliniknya
	 * atau melintasi batas poliklinik (antar-poli) jika berada di ujung teratas/terbawah
	 */
	public static moveDoctorOrder(doctorId: string, direction: 'up' | 'down', allowCrossPoli = true): boolean {
		this.init();
		const targetDoc = this.doctors.find((d) => d.id === doctorId);
		if (!targetDoc) return false;

		const currentPoliId = targetDoc.polyclinic_id || this.weeklySchedules.find((s) => s.doctor_id === doctorId)?.polyclinic_id;
		const poliDocs = this.getDoctorsInPoli(currentPoliId);
		const idx = poliDocs.findIndex((d) => d.id === doctorId);
		if (idx === -1) return false;

		if (direction === 'up') {
			if (idx > 0) {
				// Geser dengan dokter di atasnya dalam poli yang sama
				const prevDoc = poliDocs[idx - 1];
				const temp = targetDoc.display_order;
				targetDoc.display_order = prevDoc.display_order;
				prevDoc.display_order = temp;
				this.normalizeDoctorOrdersInPoli(currentPoliId);
				this.saveToStorage('doctors', this.doctors);
				if (isOnline()) {
					// Sync display_order yang berubah ke Supabase
					this.isMutating = true;
					Promise.all([
						sbUpdate(SUPABASE_TABLE.doctors, targetDoc.id, { display_order: targetDoc.display_order }),
						sbUpdate(SUPABASE_TABLE.doctors, prevDoc.id, { display_order: prevDoc.display_order })
					]).then(results => {
						results.forEach(r => { if (!r.ok) console.warn('[Supabase] Gagal sync urutan dokter:', r.error); });
					}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
				}
				this.logActivity('Geser Urutan Dokter', 'doctor', `Urutan dokter ${targetDoc.full_name} digeser ke #${targetDoc.display_order}.`, targetDoc.id);
				return true;
			}

			// Dokter berada di posisi teratas (idx === 0) -> pindah ke poliklinik sebelumnya
			if (!allowCrossPoli) return false;

			const activePolis = this.polyclinics
				.filter((p) => p.is_active && p.id !== 'other' && p.id !== 'unassigned')
				.sort((a, b) => a.display_order - b.display_order);

			const currentPoliIdx = activePolis.findIndex((p) => p.id === currentPoliId);
			if (currentPoliIdx <= 0) return false; // Sudah di poli pertama absolut

			const prevPoli = activePolis[currentPoliIdx - 1];
			targetDoc.polyclinic_id = prevPoli.id;
			targetDoc.display_order = this.getNextDoctorOrder(prevPoli.id);

			this.normalizeDoctorOrdersInPoli(currentPoliId);
			this.normalizeDoctorOrdersInPoli(prevPoli.id);

			this.saveToStorage('doctors', this.doctors);
			if (isOnline()) {
				// Sync perubahan polyclinic_id + display_order dokter ke Supabase
				this.isMutating = true;
				const affectedDocs = this.getDoctorsInPoli(prevPoli.id).concat(this.getDoctorsInPoli(currentPoliId));
				Promise.all(affectedDocs.map(d =>
					sbUpdate(SUPABASE_TABLE.doctors, d.id, { display_order: d.display_order, polyclinic_id: d.polyclinic_id })
				)).then(results => {
					results.forEach(r => { if (!r.ok) console.warn('[Supabase] Gagal sync pindah poli dokter:', r.error); });
				}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
			}
			this.logActivity(
				'Pindah Poliklinik Dokter',
				'doctor',
				`Dokter ${targetDoc.full_name} dipindahkan naik ke ${prevPoli.name}.`,
				targetDoc.id
			);
			return true;
		} else {
			// direction === 'down'
			if (idx < poliDocs.length - 1) {
				// Geser dengan dokter di bawahnya dalam poli yang sama
				const nextDoc = poliDocs[idx + 1];
				const temp = targetDoc.display_order;
				targetDoc.display_order = nextDoc.display_order;
				nextDoc.display_order = temp;
				this.normalizeDoctorOrdersInPoli(currentPoliId);
				this.saveToStorage('doctors', this.doctors);
				if (isOnline()) {
					// Sync display_order yang berubah ke Supabase
					this.isMutating = true;
					Promise.all([
						sbUpdate(SUPABASE_TABLE.doctors, targetDoc.id, { display_order: targetDoc.display_order }),
						sbUpdate(SUPABASE_TABLE.doctors, nextDoc.id, { display_order: nextDoc.display_order })
					]).then(results => {
						results.forEach(r => { if (!r.ok) console.warn('[Supabase] Gagal sync urutan dokter:', r.error); });
					}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
				}
				this.logActivity('Geser Urutan Dokter', 'doctor', `Urutan dokter ${targetDoc.full_name} digeser ke #${targetDoc.display_order}.`, targetDoc.id);
				return true;
			}

			// Dokter berada di posisi terbawah (idx === poliDocs.length - 1) -> pindah ke poliklinik sesudahnya
			if (!allowCrossPoli) return false;

			const activePolis = this.polyclinics
				.filter((p) => p.is_active && p.id !== 'other' && p.id !== 'unassigned')
				.sort((a, b) => a.display_order - b.display_order);

			const currentPoliIdx = activePolis.findIndex((p) => p.id === currentPoliId);
			if (currentPoliIdx === -1 || currentPoliIdx >= activePolis.length - 1) return false; // Sudah di poli terakhir absolut

			const nextPoli = activePolis[currentPoliIdx + 1];
			// Geser dokter yang ada di nextPoli +1
			const nextDocs = this.getDoctorsInPoli(nextPoli.id);
			nextDocs.forEach((d) => {
				d.display_order += 1;
			});
			targetDoc.polyclinic_id = nextPoli.id;
			targetDoc.display_order = 1;

			this.normalizeDoctorOrdersInPoli(currentPoliId);
			this.normalizeDoctorOrdersInPoli(nextPoli.id);

			this.saveToStorage('doctors', this.doctors);
			if (isOnline()) {
				// Sync perubahan polyclinic_id + display_order dokter ke Supabase
				this.isMutating = true;
				const affectedDocs2 = this.getDoctorsInPoli(nextPoli.id).concat(this.getDoctorsInPoli(currentPoliId));
				Promise.all(affectedDocs2.map(d =>
					sbUpdate(SUPABASE_TABLE.doctors, d.id, { display_order: d.display_order, polyclinic_id: d.polyclinic_id })
				)).then(results => {
					results.forEach(r => { if (!r.ok) console.warn('[Supabase] Gagal sync pindah poli dokter:', r.error); });
				}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
			}
			this.logActivity(
				'Pindah Poliklinik Dokter',
				'doctor',
				`Dokter ${targetDoc.full_name} dipindahkan turun ke ${nextPoli.name}.`,
				targetDoc.id
			);
			return true;
		}
	}

	public static createDoctor(data: Omit<Doctor, 'id'> & { id?: string }): Doctor {
		this.init();
		const newDoc: Doctor = {
			...data,
			id: data.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7))
		};

		// Jika nomor urut sudah dipakai oleh dokter lain di poliklinik yang sama, lakukan pergeseran (+1)
		if (newDoc.polyclinic_id && newDoc.display_order) {
			const poliDocs = this.getDoctorsInPoli(newDoc.polyclinic_id);
			const conflict = poliDocs.find((d) => d.display_order === newDoc.display_order);
			if (conflict) {
				const others = poliDocs.sort((a, b) => a.display_order - b.display_order);
				const reordered = [...others];
				reordered.splice(Math.max(0, newDoc.display_order - 1), 0, newDoc);
				reordered.forEach((doc, idx) => {
					doc.display_order = idx + 1;
				});
			}
		}

		this.doctors.push(newDoc);
		this.saveToStorage('doctors', this.doctors);
		if (isOnline()) {
			this.isMutating = true;
			const insertPromises = [
				sbInsert(SUPABASE_TABLE.doctors, [{ ...newDoc }])
			];
			if (newDoc.polyclinic_id) {
				insertPromises.push(
					sbInsert(SUPABASE_TABLE.doctor_polyclinics, [
						{ id: `dp-${Date.now()}`, doctor_id: newDoc.id, polyclinic_id: newDoc.polyclinic_id, is_primary: true }
					]) as any
				);
			}
			Promise.all(insertPromises).then(results => {
				results.forEach((r: any) => { if (!r.ok) console.warn('[Supabase] Gagal sync dokter baru ke cloud:', r.error); });
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Menambah Dokter', 'doctor', `Dokter ${newDoc.full_name} (${newDoc.title || 'Spesialis'}) ditambahkan dengan urutan #${newDoc.display_order}.`, newDoc.id);
		return newDoc;
	}

	public static updateDoctor(id: string, data: Partial<Doctor>): Doctor | null {
		this.init();
		const index = this.doctors.findIndex((d) => d.id === id);
		if (index === -1) return null;

		const targetDoc = this.doctors[index];
		const targetPoliId = data.polyclinic_id ?? targetDoc.polyclinic_id;

		// Jika display_order diubah dan poli ada, lakukan reorder
		if (data.display_order !== undefined && data.display_order !== targetDoc.display_order && targetPoliId) {
			this.doctors[index] = { ...targetDoc, ...data };
			this.reorderDoctor(id, targetPoliId, data.display_order, 'shift');
			if (isOnline()) {
				const docData = this.doctors.find(d => d.id === id);
				if (docData) {
					sbUpdate(SUPABASE_TABLE.doctors, id, { ...docData }).then(r => {
						if (!r.ok) console.warn('[Supabase] Gagal sync update dokter ke cloud:', r.error);
					});
				}
			}
			return this.doctors[index];
		}

		this.doctors[index] = { ...this.doctors[index], ...data };
		this.saveToStorage('doctors', this.doctors);
		if (isOnline()) {
			const docData = this.doctors.find(d => d.id === id);
			if (docData) {
				this.isMutating = true;
				sbUpdate(SUPABASE_TABLE.doctors, id, { ...docData }).then(r => {
					if (!r.ok) console.warn('[Supabase] Gagal sync update dokter ke cloud:', r.error);
				}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
			}
		}
		this.logActivity('Memperbarui Dokter', 'doctor', `Data dokter ${this.doctors[index].full_name} diperbarui.`, id);
		return this.doctors[index];
	}

	public static deleteDoctor(id: string): boolean {
		this.init();
		const target = this.doctors.find((d) => d.id === id);
		const poliId = target?.polyclinic_id;
		const before = this.doctors.length;
		this.doctors = this.doctors.filter((d) => d.id !== id);
		if (poliId) {
			const remaining = this.getDoctorsInPoli(poliId);
			remaining.sort((a, b) => a.display_order - b.display_order);
			remaining.forEach((d, idx) => {
				d.display_order = idx + 1;
			});
		}
		this.saveToStorage('doctors', this.doctors);
		if (isOnline()) {
			this.isMutating = true;
			sbDelete(SUPABASE_TABLE.doctors, id).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync hapus dokter ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		if (this.doctors.length < before) {
			this.logActivity('Menghapus Dokter', 'doctor', `Dokter ${target?.full_name || id} dihapus.`, id);
			return true;
		}
		return false;
	}

	// --- Media Pengumuman CRUD ---
	public static getMediaList(): MediaAnnouncement[] {
		this.init();
		return [...this.mediaList].sort((a, b) => a.sort_order - b.sort_order);
	}

	public static createMedia(data: Omit<MediaAnnouncement, 'id'>): MediaAnnouncement {
		this.init();
		const newMedia: MediaAnnouncement = {
			...data,
			id: 'med-' + Date.now()
		};
		this.mediaList.push(newMedia);
		this.saveToStorage('media', this.mediaList);
		if (isOnline()) {
			this.isMutating = true;
			const { storage_type, ...supabasePayload } = newMedia;
			sbInsert(SUPABASE_TABLE.media_announcements, [supabasePayload]).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync media baru ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Menambah Media', 'media', `Media "${newMedia.title}" (${newMedia.media_type}) ditambahkan.`, newMedia.id);
		return newMedia;
	}

	public static updateMedia(id: string, data: Partial<MediaAnnouncement>): MediaAnnouncement | null {
		this.init();
		const index = this.mediaList.findIndex((m) => m.id === id);
		if (index === -1) return null;
		this.mediaList[index] = { ...this.mediaList[index], ...data };
		this.saveToStorage('media', this.mediaList);
		if (isOnline()) {
			this.isMutating = true;
			const { storage_type, ...supabasePayload } = this.mediaList[index];
			sbUpdate(SUPABASE_TABLE.media_announcements, id, supabasePayload).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync update media ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Memperbarui Media', 'media', `Media "${this.mediaList[index].title}" diperbarui.`, id);
		return this.mediaList[index];
	}

	public static toggleMediaActive(id: string): boolean {
		this.init();
		const item = this.mediaList.find((m) => m.id === id);
		if (item) {
			item.is_active = !item.is_active;
			this.saveToStorage('media', this.mediaList);
			if (isOnline()) {
				this.isMutating = true;
				sbUpdate(SUPABASE_TABLE.media_announcements, id, { is_active: item.is_active }).then(r => {
					if (!r.ok) console.warn('[Supabase] Gagal sync toggle media ke cloud:', r.error);
				}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
			}
			this.logActivity(
				'Status Media Diubah',
				'media',
				`Media "${item.title}" ${item.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`,
				id
			);
			return item.is_active;
		}
		return false;
	}

	public static deleteMedia(id: string): boolean {
		this.init();
		const target = this.mediaList.find((m) => m.id === id);
		const before = this.mediaList.length;
		this.mediaList = this.mediaList.filter((m) => m.id !== id);
		this.saveToStorage('media', this.mediaList);
		if (isOnline()) {
			this.isMutating = true;
			sbDelete(SUPABASE_TABLE.media_announcements, id).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync hapus media ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		if (this.mediaList.length < before) {
			this.logActivity('Menghapus Media', 'media', `Media "${target?.title || id}" dihapus.`, id);
			return true;
		}
		return false;
	}

	// --- Jadwal Mingguan & Override ---
	public static getAllWeeklySchedules(): WeeklySchedule[] {
		this.init();
		return [...this.weeklySchedules].sort((a, b) => {
			const docA = this.doctors.find((d) => d.id === a.doctor_id);
			const docB = this.doctors.find((d) => d.id === b.doctor_id);
			const poliA = this.polyclinics.find((p) => p.id === a.polyclinic_id);
			const poliB = this.polyclinics.find((p) => p.id === b.polyclinic_id);

			const poliOrderA = poliA?.display_order ?? 999;
			const poliOrderB = poliB?.display_order ?? 999;
			if (poliOrderA !== poliOrderB) return poliOrderA - poliOrderB;

			const docOrderA = docA?.display_order ?? 999;
			const docOrderB = docB?.display_order ?? 999;
			if (docOrderA !== docOrderB) return docOrderA - docOrderB;

			const nameA = docA?.full_name ?? '';
			const nameB = docB?.full_name ?? '';
			const nameComp = nameA.localeCompare(nameB);
			if (nameComp !== 0) return nameComp;

			if (a.day_of_week !== b.day_of_week) {
				return a.day_of_week - b.day_of_week;
			}

			return (a.start_time || '').localeCompare(b.start_time || '');
		});
	}

	public static getSchedulesForDoctorAndPoli(doctorId: string, polyclinicId: string): WeeklySchedule[] {
		this.init();
		return this.weeklySchedules
			.filter((s) => s.doctor_id === doctorId && s.polyclinic_id === polyclinicId && s.is_active)
			.sort((a, b) => a.day_of_week - b.day_of_week || (a.start_time || '').localeCompare(b.start_time || ''));
	}

	public static createWeeklySchedule(data: Omit<WeeklySchedule, 'id'>): WeeklySchedule {
		this.init();
		const newSch: WeeklySchedule = {
			...data,
			id: 'sch-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
		};
		this.weeklySchedules.push(newSch);
		this.saveToStorage('schedules', this.weeklySchedules);
		if (isOnline()) {
			this.isMutating = true;
			sbInsert(SUPABASE_TABLE.weekly_schedules, [{ ...newSch }]).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync jadwal baru ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Menambah Jadwal', 'schedule', `Jadwal hari ke-${newSch.day_of_week} (${newSch.start_time}-${newSch.end_time}) ditambahkan.`, newSch.id);
		return newSch;
	}

	public static saveWeeklySchedule(schedule: WeeklySchedule): WeeklySchedule {
		this.init();
		const idx = this.weeklySchedules.findIndex((s) => s.id === schedule.id);
		if (idx >= 0) {
			this.weeklySchedules[idx] = schedule;
		} else {
			this.weeklySchedules.push(schedule);
		}
		this.saveToStorage('schedules', this.weeklySchedules);
		if (isOnline()) {
			this.isMutating = true;
			sbUpsert(SUPABASE_TABLE.weekly_schedules, { ...schedule }).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync simpan jadwal ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity('Menyimpan Jadwal', 'schedule', `Jadwal hari ke-${schedule.day_of_week} (${schedule.start_time}-${schedule.end_time}) disimpan.`, schedule.id);
		return schedule;
	}

	public static deleteWeeklySchedule(id: string): boolean {
		this.init();
		const before = this.weeklySchedules.length;
		this.weeklySchedules = this.weeklySchedules.filter((s) => s.id !== id);
		this.saveToStorage('schedules', this.weeklySchedules);
		if (isOnline()) {
			this.isMutating = true;
			sbDelete(SUPABASE_TABLE.weekly_schedules, id).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync hapus jadwal ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		if (this.weeklySchedules.length < before) {
			this.logActivity('Menghapus Jadwal', 'schedule', `Jadwal ID ${id} dihapus.`, id);
			return true;
		}
		return false;
	}

	public static getOverrides(): ScheduleOverride[] {
		this.init();
		return [...this.overrides];
	}

	public static addOrUpdateOverride(override: ScheduleOverride): ScheduleOverride {
		this.init();
		const idx = this.overrides.findIndex((o) => o.id === override.id);
		if (idx >= 0) {
			this.overrides[idx] = override;
		} else {
			this.overrides.push(override);
		}
		this.saveToStorage('overrides', this.overrides);
		if (isOnline()) {
			this.isMutating = true;
			sbUpsert(SUPABASE_TABLE.schedule_overrides, { ...override }).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync override ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		this.logActivity(
			'Override Status Praktik',
			'override',
			`Status dokter diubah menjadi ${override.status_code} pada tanggal ${override.schedule_date}.`,
			override.id
		);
		return override;
	}

	public static deleteOverride(id: string): boolean {
		this.init();
		const before = this.overrides.length;
		this.overrides = this.overrides.filter((o) => o.id !== id);
		this.saveToStorage('overrides', this.overrides);
		if (isOnline()) {
			this.isMutating = true;
			sbDelete(SUPABASE_TABLE.schedule_overrides, id).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync hapus override ke cloud:', r.error);
			}).finally(() => { setTimeout(() => { this.isMutating = false; }, 500); });
		}
		return this.overrides.length < before;
	}

	public static deleteOverrideForDoctorAndDate(doctorId: string, polyclinicId: string, date: string): boolean {
		this.init();
		const before = this.overrides.length;
		this.overrides = this.overrides.filter(
			(o) => !(o.doctor_id === doctorId && o.polyclinic_id === polyclinicId && o.schedule_date === date)
		);
		this.saveToStorage('overrides', this.overrides);
		if (isOnline()) {
			// FIX: Hapus dengan query compound (bukan sbDelete(id) karena id adalah UUID,
			// bukan tanggal). Query berdasarkan kombinasi doctor_id + polyclinic_id + schedule_date.
			this.isMutating = true;
			(async () => {
				try {
					const { error } = await supabase
						.from(SUPABASE_TABLE.schedule_overrides)
						.delete()
						.eq('doctor_id', doctorId)
						.eq('polyclinic_id', polyclinicId)
						.eq('schedule_date', date);
					if (error) console.warn('[Supabase] Gagal hapus override dari cloud:', error.message);
				} catch (e) {
					console.warn('[Supabase] Error hapus override:', e);
				} finally {
					setTimeout(() => { this.isMutating = false; }, 500);
				}
			})();
		}

		if (this.overrides.length < before) {
			this.logActivity(
				'Reset Status Praktik',
				'override',
				`Override status dikembalikan ke jadwal reguler otomatis.`
			);
			return true;
		}
		return false;
	}


	/**
	 * Statistik operasional live untuk Dashboard CMS
	 */
	public static getDashboardStats(): {
		activePolyclinics: number;
		activeDoctors: number;
		schedulesToday: number;
		activeMedia: number;
		dayName: string;
		currentDayOfWeek: number;
	} {
		this.init();
		const now = new Date();
		const jsDay = now.getDay();
		const dayOfWeek = jsDay === 0 ? 7 : jsDay;
		const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

		const activePolyclinics = this.polyclinics.filter((p) => p.is_active).length;
		const activeDoctors = this.doctors.filter((d) => d.is_active).length;
		const schedulesToday = this.weeklySchedules.filter((s) => s.is_active && s.day_of_week === dayOfWeek).length;
		const activeMedia = this.mediaList.filter((m) => m.is_active).length;

		return {
			activePolyclinics,
			activeDoctors,
			schedulesToday,
			activeMedia,
			dayName: dayNames[dayOfWeek],
			currentDayOfWeek: dayOfWeek
		};
	}

	// --- Settings & PIN ---
	public static getSettings(): KioskSettings {
		this.init();
		return { ...this.settings };
	}

	public static updateSettings(data: Partial<KioskSettings>): KioskSettings {
		this.init();
		this.settings = { ...this.settings, ...data };
		this.saveToStorage('settings', this.settings);
		if (isOnline()) {
			sbUpdate(SUPABASE_TABLE.kiosk_settings, '1', { ...this.settings, id: 1 }).then(r => {
				if (!r.ok) console.warn('[Supabase] Gagal sync settings ke cloud:', r.error);
			});
		}
		this.logActivity('Memperbarui Pengaturan Kiosk', 'settings', 'Konfigurasi display Kiosk / durasi / running text disimpan.');
		return { ...this.settings };
	}

	public static verifyPin(inputPin: string): boolean {
		this.init();
		if (isOnline()) {
			// RPC call — for synchronous verification we fall back to local check
			// RPC is async; the PIN modal uses this sync method.
			// We'll verify locally AND also fire RPC to update cloud PIN if mismatch
		}
		return inputPin === this.masterPin;
	}

	public static updatePin(newPin: string): boolean {
		this.init();
		if (newPin && newPin.length >= 4 && newPin.length <= 8) {
			this.masterPin = newPin;
			this.saveToStorage('master_pin', newPin);
			this.persistToServer(true);
			this.logActivity('Memperbarui Master PIN', 'auth', 'Master PIN Kiosk berhasil diubah.');
			if (isOnline()) {
				// Simpan PIN langsung ke kolom master_pin_hash di Supabase agar tersinkron sempurna
				sbUpdate(SUPABASE_TABLE.kiosk_settings, '1', {
					master_pin_hash: 'PIN#' + newPin
				}).then(r => {
					if (!r.ok) console.warn('[Supabase] Gagal sync update PIN ke kiosk_settings:', r.error);
				});
				supabase.rpc('update_kiosk_pin', { new_pin: newPin }).then(() => {}, () => {});
			}
			return true;
		}
		return false;
	}

	// --- Audit Log Management (PRD Section 10 & 28) ---
	public static logActivity(
		action: string,
		entity_type: 'doctor' | 'polyclinic' | 'schedule' | 'override' | 'media' | 'settings' | 'auth',
		details: string,
		entity_id?: string
	): void {
		const newLog: AuditLog = {
			id: 'log-' + Date.now(),
			timestamp: new Date().toISOString(),
			action,
			entity_type,
			entity_id,
			actor_name: 'Petugas Administrator',
			details
		};
		this.auditLogs.unshift(newLog);
		// Batasi hanya menyimpan 50 log terakhir di memori
		if (this.auditLogs.length > 50) {
			this.auditLogs = this.auditLogs.slice(0, 50);
		}
		this.saveToStorage('audit_logs', this.auditLogs);
	}

	public static getAuditLogs(): AuditLog[] {
		this.init();
		return this.auditLogs;
	}

	public static clearAuditLogs(): void {
		this.init();
		this.auditLogs = [];
		this.saveToStorage('audit_logs', []);
	}

	// --- Supabase Cloud Sync & Realtime (PRD Section 13 & 37) ---
	public static async syncFromSupabase(): Promise<{
		success: boolean;
		message: string;
		counts?: {
			polyclinics: number;
			doctors: number;
			schedules: number;
			overrides: number;
			media: number;
		};
	}> {
		if (!isOnline()) {
			return { success: false, message: 'Supabase belum dikonfigurasi.' };
		}

		try {
			const [poliRes, docRes, schRes, ovrRes, medRes, setRes, fnRes] = await Promise.all([
				supabase.from('polyclinics').select('*').order('display_order', { ascending: true }),
				supabase.from('doctors').select('*').order('display_order', { ascending: true }),
				supabase.from('weekly_schedules').select('*'),
				supabase.from('schedule_overrides').select('*'),
				supabase.from('media_announcements').select('*').order('sort_order', { ascending: true }),
				supabase.from('kiosk_settings').select('*').single(),
				supabase.from('footer_notices').select('*').order('display_order', { ascending: true })
			]);

			// Gunakan skipPersist=true agar tidak memicu event/persistToServer per-field,
			// sehingga menghindari loop kiosk-data-updated dan persistToServer berulang.
			if (poliRes.error) {
				console.warn('[Supabase] Gagal fetch poli:', poliRes.error.message);
			} else if (poliRes.data && poliRes.data.length > 0) {
				this.polyclinics = poliRes.data;
				this.saveToStorage('polyclinics', this.polyclinics, true);
			}

			if (docRes.error) {
				console.warn('[Supabase] Gagal fetch dokter:', docRes.error.message);
			} else if (docRes.data && docRes.data.length > 0) {
				this.doctors = docRes.data;
				this.saveToStorage('doctors', this.doctors, true);
			}

			if (schRes.error) {
				console.warn('[Supabase] Gagal fetch jadwal:', schRes.error.message);
			} else if (schRes.data && schRes.data.length > 0) {
				this.weeklySchedules = schRes.data;
				this.saveToStorage('schedules', this.weeklySchedules, true);
			}

			if (ovrRes.error) {
				console.warn('[Supabase] Gagal fetch override:', ovrRes.error.message);
			} else if (ovrRes.data) {
				this.overrides = ovrRes.data;
				this.saveToStorage('overrides', this.overrides, true);
			}

			if (medRes.error) {
				console.warn('[Supabase] Gagal fetch media:', medRes.error.message);
			} else if (medRes.data && medRes.data.length > 0) {
				this.mediaList = medRes.data;
				this.saveToStorage('media', this.mediaList, true);
			}

			if (setRes.error) {
				console.warn('[Supabase] Gagal fetch settings:', setRes.error.message);
			} else if (setRes.data) {
				this.settings = { ...this.settings, ...setRes.data };
				this.saveToStorage('settings', this.settings, true);
				if (setRes.data.master_pin_hash && setRes.data.master_pin_hash.startsWith('PIN#')) {
					const cloudPin = setRes.data.master_pin_hash.replace('PIN#', '');
					if (cloudPin && cloudPin.length >= 4) {
						this.masterPin = cloudPin;
						this.saveToStorage('master_pin', cloudPin, true);
					}
				}
			}

			if (fnRes.error) {
				console.warn('[Supabase] Gagal fetch footer:', fnRes.error.message);
			} else if (fnRes.data && fnRes.data.length > 0) {
				this.footerNotices = fnRes.data;
				this.saveToStorage('footer_notices', this.footerNotices, true);
			}

			// Simpan snapshot baru ke disk lokal (satu kali, bukan per-tabel)
			this.persistToServer(true);

			// Dispatch satu event update setelah seluruh data selesai dimuat
			if (browser) {
				window.dispatchEvent(new CustomEvent('kiosk-data-updated', { detail: { key: 'all' } }));
			}

			this.logActivity('Sinkronisasi Cloud Supabase', 'settings', 'Data kiosk disinkron dari database cloud.');

			return {
				success: true,
				message: 'Sinkronisasi berhasil!',
				counts: {
					polyclinics: this.polyclinics.length,
					doctors: this.doctors.length,
					schedules: this.weeklySchedules.length,
					overrides: this.overrides.length,
					media: this.mediaList.length
				}
			};
		} catch (e: unknown) {
			return { success: false, message: `Gagal sync: ${e instanceof Error ? e.message : String(e)}` };
		}
	}

	public static async syncToSupabase(): Promise<{ success: boolean; message: string }> {
		if (!isOnline()) {
			return { success: false, message: 'Supabase belum dikonfigurasi.' };
		}
	try {
		// Upsert all tables in parallel
		await Promise.all([
			sbUpsert(SUPABASE_TABLE.polyclinics, this.polyclinics.map(p => ({ ...p }))),
			sbUpsert(SUPABASE_TABLE.doctors, this.doctors.map(d => ({ ...d }))),
			sbUpsert(SUPABASE_TABLE.weekly_schedules, this.weeklySchedules.map(s => ({ ...s }))),
			sbUpsert(SUPABASE_TABLE.schedule_overrides, this.overrides.map(o => ({ ...o }))),
			sbUpsert(SUPABASE_TABLE.media_announcements, this.mediaList.map(m => {
				const { storage_type, ...p } = m;
				return p;
			})),
			sbUpsert(SUPABASE_TABLE.footer_notices, this.footerNotices.map(f => ({ ...f }))),
			sbUpsert(SUPABASE_TABLE.kiosk_settings, {
				...this.settings,
				id: 1,
				master_pin_hash: 'PIN#' + this.masterPin
			})
		]);
		this.logActivity('Ekspor Data ke Cloud', 'settings', 'Seluruh data lokal diunggah ke Supabase.');
		return { success: true, message: 'Semua data berhasil diekspor ke Supabase.' };
	} catch (e: unknown) {
		return { success: false, message: `Gagal ekspor: ${e instanceof Error ? e.message : String(e)}` };
	}
}

	/**
	 * Mengambil satu tabel spesifik dari Supabase dan memperbarui state in-memory.
	 * Digunakan oleh handler Realtime agar hanya mem-fetch tabel yang berubah,
	 * bukan seluruh 7 tabel sekaligus (targeted sync).
	 */
	public static async syncTableFromSupabase(table: string): Promise<void> {
		if (!isOnline()) return;
		try {
			switch (table) {
				case 'polyclinics': {
					const { data, error } = await supabase.from('polyclinics').select('*').order('display_order', { ascending: true });
					if (!error && data && data.length > 0) { this.polyclinics = data; this.saveToStorage('polyclinics', this.polyclinics, true); }
					break;
				}
				case 'doctors': {
					const { data, error } = await supabase.from('doctors').select('*').order('display_order', { ascending: true });
					if (!error && data && data.length > 0) { this.doctors = data; this.saveToStorage('doctors', this.doctors, true); }
					break;
				}
				case 'weekly_schedules': {
					const { data, error } = await supabase.from('weekly_schedules').select('*');
					if (!error && data && data.length > 0) { this.weeklySchedules = data; this.saveToStorage('schedules', this.weeklySchedules, true); }
					break;
				}
				case 'schedule_overrides': {
					const { data, error } = await supabase.from('schedule_overrides').select('*');
					if (!error && data) { this.overrides = data; this.saveToStorage('overrides', this.overrides, true); }
					break;
				}
				case 'media_announcements': {
					const { data, error } = await supabase.from('media_announcements').select('*').order('sort_order', { ascending: true });
					if (!error && data && data.length > 0) { this.mediaList = data; this.saveToStorage('media', this.mediaList, true); }
					break;
				}
				case 'kiosk_settings': {
					const { data, error } = await supabase.from('kiosk_settings').select('*').single();
					if (!error && data) { this.settings = { ...this.settings, ...data }; this.saveToStorage('settings', this.settings, true); }
					break;
				}
				case 'footer_notices': {
					const { data, error } = await supabase.from('footer_notices').select('*').order('display_order', { ascending: true });
					if (!error && data && data.length > 0) { this.footerNotices = data; this.saveToStorage('footer_notices', this.footerNotices, true); }
					break;
				}
			}
		} catch (e) {
			console.warn(`[Supabase] Gagal targeted sync tabel ${table}:`, e);
		}
	}

	/**
	 * Berlangganan perubahan Realtime Supabase menggunakan Singleton channel.
	 * - Satu channel global (kiosk-live-all) dibuat sekali dan dipakai ulang.
	 * - Mutation lock (isMutating) mencegah Realtime echo mengoverwrite state lokal
	 *   saat admin sedang melakukan operasi CRUD.
	 * - Targeted sync: hanya fetch tabel yang berubah, bukan seluruh 7 tabel.
	 * - Callback onUpdate dikumpulkan agar banyak komponen bisa subscribe tanpa
	 *   membuat channel baru.
	 */
	private static realtimeCallbacks: Set<() => void> = new Set();

	public static subscribeToRealtimeChanges(onUpdate?: () => void): () => void {
		if (!isOnline() || !browser) return () => {};

		// Daftarkan callback jika ada
		if (onUpdate) this.realtimeCallbacks.add(onUpdate);

		// Jika channel singleton sudah ada dan aktif, tidak perlu buat baru
		if (this.realtimeChannel) {
			// Kembalikan fungsi unsubscribe hanya untuk callback ini
			return () => {
				if (onUpdate) this.realtimeCallbacks.delete(onUpdate);
			};
		}

		try {
			const tables = [
				'polyclinics', 'doctors', 'weekly_schedules', 'schedule_overrides',
				'media_announcements', 'kiosk_settings', 'footer_notices'
			];

			this.realtimeChannel = supabase.channel('kiosk-live-all-v2');

			for (const table of tables) {
				(this.realtimeChannel as any).on(
					'postgres_changes',
					{ event: '*', schema: 'public', table },
					async (payload: any) => {
						// Jika isMutating=true, berarti event ini adalah echo dari mutasi kita sendiri.
						// Tunggu sebentar hingga mutasi selesai, lalu sync. Debounce 400ms.
						if (this.isMutating) {
							console.debug(`[Realtime] Mutasi sedang berlangsung, abaikan echo event tabel ${table}`);
							return;
						}
						console.debug(`[Realtime] Perubahan dari Supabase terdeteksi di tabel ${table}`);
						// Targeted sync: hanya fetch tabel yang berubah
						await this.syncTableFromSupabase(table);
						// Dispatch satu event setelah sync selesai
						if (browser) {
							window.dispatchEvent(new CustomEvent('kiosk-data-updated', { detail: { key: table } }));
						}
						// Panggil semua callback terdaftar
						for (const cb of this.realtimeCallbacks) {
							try { cb(); } catch { /* ignore */ }
						}
					}
				);
			}

			this.realtimeChannel.subscribe((status: string) => {
				if (status === 'SUBSCRIBED') {
					console.info('[Supabase] Realtime channel kiosk-live-all-v2 aktif.');
				}
			});

			return () => {
				if (onUpdate) this.realtimeCallbacks.delete(onUpdate);
				// Hanya hapus channel jika tidak ada callback lain yang masih aktif
				if (this.realtimeCallbacks.size === 0 && this.realtimeChannel) {
					supabase.removeChannel(this.realtimeChannel);
					this.realtimeChannel = null;
				}
			};
		} catch (e) {
			console.warn('[Supabase] Gagal subscribe Realtime:', e);
			return () => {};
		}
	}


	// --- Helper Storage ---
	private static loadFromStorage<T>(key: string, defaultValue: T): T {
		if (browser) {
			try {
				const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
				if (item) return JSON.parse(item);
			} catch (e) {
				console.warn('Gagal membaca storage:', e);
			}
		}
		return defaultValue;
	}

	private static saveToStorage<T>(key: string, value: T, skipPersist = false) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
				if (!skipPersist) {
					window.dispatchEvent(new CustomEvent('kiosk-data-updated', { detail: { key } }));
				}
			} catch (e) {
				console.warn('Gagal menyimpan storage:', e);
			}
			if (!skipPersist) {
				this.persistToServer();
			}
		}
	}

	/**
	 * Sinkronisasi data dari file fisik disk lokal (/api/data -> data/local-db.json)
	 */
public static async syncWithServer(force = false): Promise<void> {
	if (isOnline()) return;
	if (!browser || typeof window === 'undefined' || !window.location?.origin) return;
	if (this.syncPromise && !force) return this.syncPromise;

		this.syncPromise = (async () => {
			try {
				const res = await fetch('/api/data?t=' + Date.now());
				if (res.ok) {
					const jsonRes = await res.json();
					if (jsonRes.success && jsonRes.data) {
						const d = jsonRes.data;
						if (Array.isArray(d.polyclinics) && d.polyclinics.length > 0) this.polyclinics = d.polyclinics;
						if (Array.isArray(d.doctors) && d.doctors.length > 0) this.doctors = d.doctors;
						if (Array.isArray(d.weeklySchedules) && d.weeklySchedules.length > 0) this.weeklySchedules = d.weeklySchedules;
						if (Array.isArray(d.overrides)) this.overrides = d.overrides;
						if (Array.isArray(d.mediaList) && d.mediaList.length > 0) this.mediaList = d.mediaList;
						if (d.settings) this.settings = d.settings;
						if (Array.isArray(d.footerNotices) && d.footerNotices.length > 0) this.footerNotices = d.footerNotices;
						if (Array.isArray(d.auditLogs)) this.auditLogs = d.auditLogs;
						if (d.masterPin) this.masterPin = d.masterPin;

						// Simpan ke storage lokal sebagai fallback cache
						if (browser) {
							try {
								localStorage.setItem(STORAGE_KEY_PREFIX + 'polyclinics', JSON.stringify(this.polyclinics));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'doctors', JSON.stringify(this.doctors));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'schedules', JSON.stringify(this.weeklySchedules));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'overrides', JSON.stringify(this.overrides));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'media', JSON.stringify(this.mediaList));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(this.settings));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'footer_notices', JSON.stringify(this.footerNotices));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'audit_logs', JSON.stringify(this.auditLogs));
								localStorage.setItem(STORAGE_KEY_PREFIX + 'master_pin', JSON.stringify(this.masterPin));
								window.dispatchEvent(new CustomEvent('kiosk-data-updated', { detail: { key: 'all' } }));
							} catch (e) {
								console.warn('Gagal update cache localStorage:', e);
							}
						}
					} else if (jsonRes.success && jsonRes.data === null) {
						// File belum ada di server disk, tuliskan data default saat ini ke disk
						this.persistToServer(true);
					}
				}
				this.isServerSynced = true;
			} catch (e) {
				console.warn('Gagal sinkronisasi data dengan server lokal:', e);
			} finally {
				if (force) {
					this.syncPromise = null;
				}
			}
		})();

		return this.syncPromise;
	}

	/**
	 * Tulis data mutasi ke disk lokal (/api/data)
	 */
	public static persistToServer(immediate = false): void {
		if (!browser || typeof window === 'undefined' || !window.location?.origin) return;

		const saveFn = async () => {
			try {
				const payload = {
					polyclinics: this.polyclinics,
					doctors: this.doctors,
					weeklySchedules: this.weeklySchedules,
					overrides: this.overrides,
					mediaList: this.mediaList,
					settings: this.settings,
					footerNotices: this.footerNotices,
					auditLogs: this.auditLogs,
					masterPin: this.masterPin
				};
				await fetch('/api/data', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} catch (e) {
				console.warn('Gagal menyimpan ke /api/data:', e);
			}
		};

		if (immediate) {
			saveFn();
			return;
		}

		if (this.persistTimer) clearTimeout(this.persistTimer);
		this.persistTimer = setTimeout(saveFn, 60);
	}

	/**
	 * Menghasilkan skrip SQL INSERT untuk seluruh data lokal yang siap dijalankan di Supabase SQL Editor
	 */
	public static exportToSupabaseSql(): string {
		this.init();
		const lines: string[] = [];
		lines.push('-- ========================================================');
		lines.push('-- EKSPOR DATA KIOSK RSUD UNTUK SUPABASE CLOUD');
		lines.push(`-- Dihasilkan pada: ${new Date().toISOString()}`);
		lines.push('-- ========================================================\n');

		// 1. Polyclinics
		lines.push('-- 1. DATA POLIKLINIK');
		for (const p of this.polyclinics) {
			const id = p.id.replace(/'/g, "''");
			const name = p.name.replace(/'/g, "''");
			const code = p.code.replace(/'/g, "''");
			const icon = (p.icon || 'stethoscope').replace(/'/g, "''");
			const desc = (p.description || '').replace(/'/g, "''");
			lines.push(`INSERT INTO polyclinics (id, name, code, icon, description, is_active, display_order) ` +
				`VALUES ('${id}', '${name}', '${code}', '${icon}', '${desc}', ${p.is_active}, ${p.display_order}) ` +
				`ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, icon = EXCLUDED.icon, description = EXCLUDED.description, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`);
		}
		lines.push('');

		// 2. Doctors
		lines.push('-- 2. DATA DOKTER');
		for (const d of this.doctors) {
			const id = d.id.replace(/'/g, "''");
			const name = d.full_name.replace(/'/g, "''");
			const title = (d.title || '').replace(/'/g, "''");
			const photo = (d.photo_url || '').replace(/'/g, "''");
			lines.push(`INSERT INTO doctors (id, full_name, title, photo_url, is_active, display_order) ` +
				`VALUES ('${id}', '${name}', '${title}', '${photo}', ${d.is_active}, ${d.display_order}) ` +
				`ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, title = EXCLUDED.title, photo_url = EXCLUDED.photo_url, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`);
		}
		lines.push('');

		// 3. Weekly Schedules
		lines.push('-- 3. JADWAL MINGGUAN DOKTER');
		for (const s of this.weeklySchedules) {
			const id = s.id.replace(/'/g, "''");
			const docId = s.doctor_id.replace(/'/g, "''");
			const poliId = s.polyclinic_id.replace(/'/g, "''");
			const note = (s.note || '').replace(/'/g, "''");
			lines.push(`INSERT INTO weekly_schedules (id, doctor_id, polyclinic_id, day_of_week, start_time, end_time, is_active, note) ` +
				`VALUES ('${id}', '${docId}', '${poliId}', ${s.day_of_week}, '${s.start_time}', '${s.end_time}', ${s.is_active}, '${note}') ` +
				`ON CONFLICT (id) DO UPDATE SET doctor_id = EXCLUDED.doctor_id, polyclinic_id = EXCLUDED.polyclinic_id, day_of_week = EXCLUDED.day_of_week, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, is_active = EXCLUDED.is_active, note = EXCLUDED.note;`);
		}
		lines.push('');

		// 4. Media Announcements
		lines.push('-- 4. MEDIA PENGUMUMAN');
		for (const m of this.mediaList) {
			const id = m.id.replace(/'/g, "''");
			const title = m.title.replace(/'/g, "''");
			const type = m.media_type;
			const path = (m.file_path || '').replace(/'/g, "''");
			const url = (m.public_url || '').replace(/'/g, "''");
			lines.push(`INSERT INTO media_announcements (id, title, media_type, file_path, public_url, sort_order, is_active) ` +
				`VALUES ('${id}', '${title}', '${type}', '${path}', '${url}', ${m.sort_order}, ${m.is_active}) ` +
				`ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, media_type = EXCLUDED.media_type, file_path = EXCLUDED.file_path, public_url = EXCLUDED.public_url, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;`);
		}
		lines.push('');

// 5. Kiosk Settings
	lines.push('-- 5. PENGATURAN KIOSK');
	const st = this.settings;
	const emergencyTitle = (st.emergency_title || '').replace(/'/g, "''");
	const emergencyMsg = (st.emergency_message || '').replace(/'/g, "''");
	lines.push(`INSERT INTO kiosk_settings (id, hospital_name, hospital_subtitle, hospital_logo_url, timezone, slide_duration_seconds, image_duration_seconds, video_sound_enabled, refresh_interval_seconds, font_scale, card_scale, header_scale, footer_scale, show_emergency_banner, emergency_title, emergency_message, emergency_level, running_text, running_text_speed, running_text_direction) ` +
		`VALUES (1, '${st.hospital_name.replace(/'/g, "''")}', '${st.hospital_subtitle.replace(/'/g, "''")}', '${(st.hospital_logo_url || '').replace(/'/g, "''")}', '${st.timezone}', ${st.slide_duration_seconds}, ${st.image_duration_seconds}, ${st.video_sound_enabled}, ${st.refresh_interval_seconds}, ${st.font_scale}, ${st.card_scale}, ${st.header_scale}, ${st.footer_scale}, ${st.show_emergency_banner}, '${emergencyTitle}', '${emergencyMsg}', '${st.emergency_level}', '${st.running_text.replace(/'/g, "''")}', ${st.running_text_speed}, '${st.running_text_direction}') ` +
		`ON CONFLICT (id) DO UPDATE SET hospital_name = EXCLUDED.hospital_name, hospital_subtitle = EXCLUDED.hospital_subtitle, hospital_logo_url = EXCLUDED.hospital_logo_url, timezone = EXCLUDED.timezone, slide_duration_seconds = EXCLUDED.slide_duration_seconds, image_duration_seconds = EXCLUDED.image_duration_seconds, video_sound_enabled = EXCLUDED.video_sound_enabled, refresh_interval_seconds = EXCLUDED.refresh_interval_seconds, font_scale = EXCLUDED.font_scale, card_scale = EXCLUDED.card_scale, header_scale = EXCLUDED.header_scale, footer_scale = EXCLUDED.footer_scale, show_emergency_banner = EXCLUDED.show_emergency_banner, emergency_title = EXCLUDED.emergency_title, emergency_message = EXCLUDED.emergency_message, emergency_level = EXCLUDED.emergency_level, running_text = EXCLUDED.running_text, running_text_speed = EXCLUDED.running_text_speed, running_text_direction = EXCLUDED.running_text_direction;`);

	// 6. Doctor-Polyclinics
	lines.push('-- 6. DOCTOR-POLIKLINIC ASSIGNMENTS');
	for (const d of this.doctors) {
		const id = d.id.replace(/'/g, "''");
		const polyId = (d.polyclinic_id || '').replace(/'/g, "''");
		lines.push(`INSERT INTO doctor_polyclinics (id, doctor_id, polyclinic_id, is_primary) ` +
			`VALUES ('${id}-primary', '${id}', '${polyId}', true) ` +
			`ON CONFLICT (id) DO UPDATE SET polyclinic_id = EXCLUDED.polyclinic_id, is_primary = EXCLUDED.is_primary;`);
	}
	lines.push('');

	// 7. Footer Notices
	lines.push('-- 7. FOOTER NOTICES');
	for (const fn of this.footerNotices) {
		const id = fn.id.replace(/'/g, "''");
		const title = (fn.title || '').replace(/'/g, "''");
		const icon = (fn.icon || '').replace(/'/g, "''");
		const displayOrder = fn.display_order ?? 0;
		lines.push(`INSERT INTO footer_notices (id, title, icon, is_active, display_order) ` +
			`VALUES ('${id}', '${title}', '${icon}', ${fn.is_active}, ${displayOrder}) ` +
			`ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, icon = EXCLUDED.icon, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`);
	}
	lines.push('');

		return lines.join('\n');
}
}
