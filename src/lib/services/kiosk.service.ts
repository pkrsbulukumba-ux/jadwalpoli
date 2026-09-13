import type {
	Polyclinic,
	Doctor,
	WeeklySchedule,
	KioskSettings,
	FooterNotice,
	MediaAnnouncement
} from '$lib/types';
import { supabase } from '$lib/supabase/client';

import { DataRepository } from './data.repository';

/**
 * Service Layer untuk Kiosk Display & Data Poliklinik.
 * Menyediakan method terisolasi agar komponen UI tidak memanggil query Supabase secara langsung (PRD Section 13).
 * Mendukung mode local-first untuk pengujian penuh di production environment sebelum peluncuran Supabase online.
 */
export class KioskService {
	/**
	 * Default fallback settings bila database belum terhubung
	 */
	static getDefaultSettings(): KioskSettings {
		return DataRepository.getSettings();
	}

	/**
	 * Fetch footer notices
	 */
	static async getFooterNotices(): Promise<FooterNotice[]> {
		try {
			const { data, error } = await supabase
				.from('footer_notices')
				.select('*')
				.eq('is_active', true)
				.order('display_order', { ascending: true });

			if (error || !data || data.length === 0) {
				return [
					{
						id: '1',
						title: 'Loket Pendaftaran Buka Pukul 08.00 – 12.00 WITA',
						icon: 'clock',
						is_active: true,
						display_order: 1
					},
					{
						id: '2',
						title: 'Jadwal Sewaktu-Waktu Dapat Berubah',
						icon: 'info',
						is_active: true,
						display_order: 2
					},
					{
						id: '3',
						title: 'Jam Istirahat Tetap Melayani',
						icon: 'heart',
						is_active: true,
						display_order: 3
					},
					{
						id: '4',
						title: 'Pasien BPJS Wajib Pakai Mobile JKN',
						icon: 'smartphone',
						is_active: true,
						display_order: 4
					}
				];
			}
			return data as FooterNotice[];
		} catch {
			return [];
		}
	}
}
