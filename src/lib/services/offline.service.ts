import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { KioskSlide, KioskSettings } from '$lib/types';

export interface KioskSnapshot {
	slides: KioskSlide[];
	settings: KioskSettings;
	currentDayOfWeek: number;
	timestamp: number;
	syncTimeString: string;
}

const SNAPSHOT_STORAGE_KEY = 'kiosk_offline_snapshot';

/**
 * Service untuk memantau konektivitas jaringan, mengelola snapshot lokal Kiosk,
 * dan menyediakan transisi mulus antara online dan offline tanpa memutus slideshow (PRD Section 22 & 24).
 */
export class OfflineService {
	public static isOffline = writable<boolean>(false);
	public static lastSyncTime = writable<string>('');
	private static isInitialized = false;

	/**
	 * Inisialisasi pemantauan status jaringan pada browser TV
	 */
	public static init() {
		if (!browser || this.isInitialized) return;

		// Set status awal
		const initialOffline = !navigator.onLine;
		this.isOffline.set(initialOffline);

		// Baca waktu sinkronisasi terakhir dari snapshot tersimpan
		const snapshot = this.loadSnapshot();
		if (snapshot && snapshot.syncTimeString) {
			this.lastSyncTime.set(snapshot.syncTimeString);
		} else {
			this.recordSuccessfulSync();
		}

		// Event listener status jaringan peramban
		window.addEventListener('online', () => {
			console.info('[OfflineService] Koneksi jaringan Kiosk kembali tersambung (Online).');
			this.isOffline.set(false);
		});

		window.addEventListener('offline', () => {
			console.warn('[OfflineService] Koneksi jaringan Kiosk terputus. Mengaktifkan Mode Siaga Offline.');
			this.isOffline.set(true);
		});

		this.isInitialized = true;
	}

	/**
	 * Simpan snapshot data lengkap Kiosk ke localStorage lokal
	 */
	public static saveSnapshot(slides: KioskSlide[], settings: KioskSettings, dayOfWeek: number) {
		if (!browser) return;

		const syncStr = this.formatCurrentTime(settings.timezone || 'Asia/Makassar');

		const snapshot: KioskSnapshot = {
			slides,
			settings,
			currentDayOfWeek: dayOfWeek,
			timestamp: Date.now(),
			syncTimeString: syncStr
		};

		try {
			localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
			this.lastSyncTime.set(syncStr);
		} catch (e) {
			console.warn('[OfflineService] Gagal menyimpan snapshot lokal:', e);
		}
	}

	/**
	 * Muat snapshot cadangan jika koneksi utama gagal atau saat boot offline
	 */
	public static loadSnapshot(): KioskSnapshot | null {
		if (!browser) return null;

		try {
			const item = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
			if (item) {
				return JSON.parse(item) as KioskSnapshot;
			}
		} catch (e) {
			console.warn('[OfflineService] Gagal membaca snapshot lokal:', e);
		}
		return null;
	}

	/**
	 * Catat waktu sinkronisasi berhasil terkini
	 */
	public static recordSuccessfulSync(timezone = 'Asia/Makassar') {
		if (!browser) return;
		const timeStr = this.formatCurrentTime(timezone);
		this.lastSyncTime.set(timeStr);
	}

	/**
	 * Format waktu lokal (Contoh: "14:35 WITA")
	 */
	private static formatCurrentTime(timezone: string): string {
		try {
			const now = new Date();
			const timePart = new Intl.DateTimeFormat('id-ID', {
				timeZone: timezone,
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			}).format(now);

			let tzSuffix = 'WITA';
			if (timezone.includes('Jakarta')) tzSuffix = 'WIB';
			else if (timezone.includes('Jayapura')) tzSuffix = 'WIT';

			return `${timePart} ${tzSuffix}`;
		} catch {
			return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
		}
	}

	/**
	 * Helper untuk simulasi pengetesan mode offline
	 */
	public static setOfflineStateForTesting(state: boolean) {
		this.isOffline.set(state);
	}
}
