import { DataRepository } from './data.repository';
import { StatusEngine } from './status.engine';
import type {
	KioskSlide,
	PoliSectionData,
	DoctorScheduleCardData,
	KioskSettings
} from '$lib/types';

/**
 * KioskDataService: Generator Slide Kiosk Dinamis
 * Menghubungkan DataRepository, StatusEngine, dan Chunking Slide (PRD Section 16 & 17)
 */
export class KioskDataService {
	private static MAX_DOCTOR_CARDS_PER_SLIDE = 4; // Maksimal 4 kartu dokter per slide (berdasarkan jumlah kartu dokter)
	public static readonly MAX_CARDS_PER_SLIDE = 4;

	// Cache media pengumuman dengan interval reload 1 jam (PRD Section 16 & Prompt 22)
	private static cachedActiveMedia: any[] = [];
	private static lastMediaReloadTimestamp: number = 0;
	private static readonly ONE_HOUR_MS: number = 60 * 60 * 1000; // 1 Jam
	private static preloadedAssetUrls = new Set<string>();

	/**
	 * Melakukan preloading aset gambar (foto dokter, logo RSUD, banner gambar) ke memori cache browser
	 */
	public static preloadImageAssets(urls: (string | null | undefined)[]) {
		if (typeof window === 'undefined') return;
		for (const url of urls) {
			if (!url || typeof url !== 'string' || this.preloadedAssetUrls.has(url)) continue;
			this.preloadedAssetUrls.add(url);
			try {
				const img = new Image();
				img.src = url;
			} catch (_) {}
		}
	}

	/**
	 * Mengambil media pengumuman aktif dengan kebijakan cache 1 jam vs realtime bypass saat ada perubahan CMS
	 */
	public static getActiveMediaWithCache(forceRealtime = false) {
		const now = Date.now();
		const isExpired = now - this.lastMediaReloadTimestamp >= this.ONE_HOUR_MS;

		if (forceRealtime || isExpired || this.cachedActiveMedia.length === 0) {
			this.cachedActiveMedia = DataRepository.getMediaList().filter((m) => m.is_active);
			this.lastMediaReloadTimestamp = now;

			// Preload aset gambar pengumuman ke cache memori browser
			const mediaImgUrls = this.cachedActiveMedia
				.filter((m) => m.media_type === 'image' && m.public_url)
				.map((m) => m.public_url);
			this.preloadImageAssets(mediaImgUrls);
		}

		return this.cachedActiveMedia;
	}

	/**
	 * Menghasilkan daftar slide Kiosk lengkap (Slide Jadwal + Slide Media Pengumuman)
	 * @param options.forceRealtime jika true (misal trigger dari event dashboard/realtime), paksa reload aset media langsung
	 */
	public static generateKioskSlides(options?: { forceRealtime?: boolean }): {
		slides: KioskSlide[];
		settings: KioskSettings;
		currentDayOfWeek: number;
	} {
		const forceRealtime = options?.forceRealtime ?? false;
		const settings = DataRepository.getSettings();
		const polyclinics = DataRepository.getPolyclinics().filter((p) => p.is_active);
		const doctors = DataRepository.getDoctors().filter((d) => d.is_active);
		const allSchedules = DataRepository.getAllWeeklySchedules().filter((s) => s.is_active);
		const overrides = DataRepository.getOverrides();
		const activeMedia = this.getActiveMediaWithCache(forceRealtime);

		// Preload foto dokter dan logo RSUD ke cache browser sekali saja
		const doctorPhotoUrls = doctors.filter((d) => d.photo_url).map((d) => d.photo_url);
		if (settings.hospital_logo_url) {
			doctorPhotoUrls.push(settings.hospital_logo_url);
		}
		this.preloadImageAssets(doctorPhotoUrls);

		const { currentDayOfWeek } = StatusEngine.getNowInTimezone(settings.timezone);

		// 1. Susun Data Tiap Poliklinik beserta Dokternya
		const poliSections: PoliSectionData[] = [];

		for (const poli of polyclinics) {
			// Cari jadwal yang terhubung ke poli ini
			const poliSchedules = allSchedules.filter((s) => s.polyclinic_id === poli.id);
			const doctorIdsInPoli = Array.from(new Set(poliSchedules.map((s) => s.doctor_id)));

			// Tambahkan juga dokter yang memiliki penugasan poliklinik_id ke poli ini dari master data
			const doctorsInMaster = doctors.filter((d) => d.polyclinic_id === poli.id).map((d) => d.id);
			const allDoctorIds = Array.from(new Set([...doctorIdsInPoli, ...doctorsInMaster]));

			const doctorCards: DoctorScheduleCardData[] = [];

			for (const docId of allDoctorIds) {
				const doctor = doctors.find((d) => d.id === docId);
				if (!doctor) continue;

				const docSchedules = poliSchedules
					.filter((s) => s.doctor_id === docId)
					.sort((a, b) => a.day_of_week - b.day_of_week || (a.start_time || '').localeCompare(b.start_time || ''));
				const { status, todaySchedule } = StatusEngine.resolveDoctorStatus(
					doctor,
					poli,
					docSchedules,
					overrides,
					settings.timezone
				);

				doctorCards.push({
					doctor,
					schedules: docSchedules,
					todaySchedule,
					status
				});
			}

			// Urutkan dokter berdasarkan display_order
			doctorCards.sort((a, b) => a.doctor.display_order - b.doctor.display_order);

			// Hanya tampilkan poliklinik di layar Kiosk jika sudah memiliki dokter dan jadwal yang didaftarkan
			if (doctorCards.length > 0 && poliSchedules.length > 0) {
				poliSections.push({
					polyclinic: poli,
					doctorCount: doctorCards.length,
					doctors: doctorCards
				});
			}
		}

		// 2. Chunking Berdasarkan Jumlah Kartu Dokter (Maksimal 4 kartu dokter per slide)
		const scheduleSlides: KioskSlide[] = [];
		const maxCardsPerSlide = this.MAX_DOCTOR_CARDS_PER_SLIDE;

		const totalDoctorCards = poliSections.reduce((acc, sec) => acc + sec.doctors.length, 0);

		if (totalDoctorCards === 0) {
			// Empty state fallback jika belum ada data dokter/poli aktif
			scheduleSlides.push({
				id: 'slide-schedule-empty',
				type: 'schedule',
				pageNumber: 1,
				totalPages: 1,
				sections: [],
				durationSeconds: settings.slide_duration_seconds || 15
			});
		} else {
			let currentSlideSections: PoliSectionData[] = [];
			let currentSlideCardCount = 0;

			for (const sec of poliSections) {
				let remainingDoctors = [...sec.doctors];

				while (remainingDoctors.length > 0) {
					const availableSlots = maxCardsPerSlide - currentSlideCardCount;

					if (availableSlots === 0) {
						// Slide saat ini telah mencapai kapasitas maksimal 4 kartu dokter, simpan slide
						const slideNum = scheduleSlides.length + 1;
						scheduleSlides.push({
							id: `slide-schedule-${slideNum}`,
							type: 'schedule',
							pageNumber: slideNum,
							totalPages: 1,
							sections: currentSlideSections,
							durationSeconds: settings.slide_duration_seconds || 15
						});
						currentSlideSections = [];
						currentSlideCardCount = 0;
						continue;
					}

					// Ambil kartu dokter sebanyak slot yang tersedia di slide saat ini
					const takeCount = Math.min(remainingDoctors.length, availableSlots);
					const doctorsChunk = remainingDoctors.slice(0, takeCount);
					remainingDoctors = remainingDoctors.slice(takeCount);

					currentSlideSections.push({
						polyclinic: sec.polyclinic,
						doctorCount: doctorsChunk.length,
						doctors: doctorsChunk
					});

					currentSlideCardCount += doctorsChunk.length;
				}
			}

			// Masukkan slide terakhir jika masih ada seksi dokter yang tersisa
			if (currentSlideSections.length > 0) {
				const slideNum = scheduleSlides.length + 1;
				scheduleSlides.push({
					id: `slide-schedule-${slideNum}`,
					type: 'schedule',
					pageNumber: slideNum,
					totalPages: 1,
					sections: currentSlideSections,
					durationSeconds: settings.slide_duration_seconds || 15
				});
			}
		}

		// 3. Susun Slide Media Pengumuman Aktif
		const mediaSlides: KioskSlide[] = [];
		for (let j = 0; j < activeMedia.length; j++) {
			const media = activeMedia[j];
			mediaSlides.push({
				id: `slide-media-${media.id}`,
				type: 'media',
				pageNumber: scheduleSlides.length + j + 1,
				totalPages: 1,
				media,
				durationSeconds:
					media.media_type === 'image'
						? settings.image_duration_seconds || 10
						: 15 // Fallback durasi untuk video jika gagal
			});
		}

		// 4. Gabungkan dan Perbarui totalPages & pageNumber
		const allSlides: KioskSlide[] = [...scheduleSlides, ...mediaSlides];
		const totalPages = allSlides.length;

		const finalizedSlides = allSlides.map((slide, index) => ({
			...slide,
			pageNumber: index + 1,
			totalPages
		}));

		return {
			slides: finalizedSlides,
			settings,
			currentDayOfWeek
		};
	}
}
