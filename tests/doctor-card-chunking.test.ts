import { describe, it, expect, beforeEach } from 'vitest';
import { KioskDataService } from '../src/lib/services/kiosk-data.service';
import { DataRepository } from '../src/lib/services/data.repository';

describe('Doctor Card Chunking (Max 4 Doctor Cards Per Slide)', () => {
	beforeEach(() => {
		DataRepository.init();
	});

	it('harus membatasi maksimal 4 kartu dokter per slide pada data jadwal aktif', () => {
		const result = KioskDataService.generateKioskSlides();
		const scheduleSlides = result.slides.filter((s) => s.type === 'schedule');

		expect(scheduleSlides.length).toBeGreaterThanOrEqual(1);

		for (const slide of scheduleSlides) {
			const totalCards = slide.sections.reduce((acc, sec) => acc + sec.doctors.length, 0);
			console.log(
				`[TEST LOG] Slide ${slide.pageNumber}/${slide.totalPages} has ${totalCards} doctor cards:`,
				slide.sections.map((sec) => `${sec.polyclinic.name} (${sec.doctors.length} docs)`).join(', ')
			);
			expect(totalCards).toBeLessThanOrEqual(4);
			expect(totalCards).toBeGreaterThan(0);
		}
	});

	it('harus membagi dokter ke slide berikutnya jika dalam satu poli melebihi 4 dokter', () => {
		const polis = DataRepository.getPolyclinics().filter((p) => p.is_active);
		expect(polis.length).toBeGreaterThan(0);
		const targetPoli = polis[0];

		// Tambahkan beberapa dokter baru ke target poli ini dengan jadwal aktif
		const addedDocIds: string[] = [];
		for (let i = 1; i <= 6; i++) {
			const doc = DataRepository.createDoctor({
				full_name: `Dokter Spesialis Uji ${i}`,
				polyclinic_id: targetPoli.id,
				display_order: 100 + i,
				is_active: true
			});
			addedDocIds.push(doc.id);
			DataRepository.createWeeklySchedule({
				doctor_id: doc.id,
				polyclinic_id: targetPoli.id,
				day_of_week: 2,
				start_time: '08:00:00',
				end_time: '12:00:00',
				is_active: true
			});
		}

		const result = KioskDataService.generateKioskSlides();
		const scheduleSlides = result.slides.filter((s) => s.type === 'schedule');

		// Setiap slide jadwal harus memiliki maksimal 4 dokter
		for (const slide of scheduleSlides) {
			const count = slide.sections.reduce((acc, sec) => acc + sec.doctors.length, 0);
			expect(count).toBeLessThanOrEqual(4);
		}

		// Pastikan semua dokter uji ditemukan dalam slide jadwal
		const allSlidedDocIds = scheduleSlides.flatMap((s) =>
			s.sections.flatMap((sec) => sec.doctors.map((d) => d.doctor.id))
		);
		for (const docId of addedDocIds) {
			expect(allSlidedDocIds).toContain(docId);
		}

		// Bersihkan dokter uji
		for (const docId of addedDocIds) {
			DataRepository.deleteDoctor(docId);
		}
	});

	it('harus menggabungkan beberapa poli jika jumlah dokter masing-masing < 4 hingga maksimal 4 dokter per slide', () => {
		const result = KioskDataService.generateKioskSlides();
		const scheduleSlides = result.slides.filter((s) => s.type === 'schedule');

		// Periksa jika ada slide yang memuat lebih dari 1 poliklinik
		const multiPoliSlides = scheduleSlides.filter((s) => s.sections.length > 1);
		for (const slide of multiPoliSlides) {
			const totalCards = slide.sections.reduce((acc, sec) => acc + sec.doctors.length, 0);
			expect(totalCards).toBeLessThanOrEqual(4);
		}
	});

	it('harus mempertahankan urutan display_order dokter saat dibagi antar-slide', () => {
		const result = KioskDataService.generateKioskSlides();
		const scheduleSlides = result.slides.filter((s) => s.type === 'schedule');

		const extractedDoctorIds = scheduleSlides.flatMap((s) =>
			s.sections.flatMap((sec) => sec.doctors.map((d) => d.doctor.id))
		);

		const activePoliIds = new Set(DataRepository.getPolyclinics().filter((p) => p.is_active).map((p) => p.id));
		const activeDocsWithValidSchedule = DataRepository.getDoctors().filter((d) => {
			if (!d.is_active) return false;
			return DataRepository.getAllWeeklySchedules().some(
				(s) => s.doctor_id === d.id && s.is_active && activePoliIds.has(s.polyclinic_id)
			);
		});

		// Pastikan jumlah kartu di slide sesuai dengan dokter yang memenuhi kriteria
		expect(extractedDoctorIds.length).toBe(activeDocsWithValidSchedule.length);

		// Pastikan di setiap section pada setiap slide, dokter terurut naik berdasarkan display_order
		for (const slide of scheduleSlides) {
			for (const sec of slide.sections) {
				for (let i = 0; i < sec.doctors.length - 1; i++) {
					expect(sec.doctors[i].doctor.display_order).toBeLessThanOrEqual(
						sec.doctors[i + 1].doctor.display_order
					);
				}
			}
		}
	});
});
