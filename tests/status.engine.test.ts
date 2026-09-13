import { describe, it, expect } from 'vitest';
import { StatusEngine } from '../src/lib/services/status.engine';
import { KioskDataService } from '../src/lib/services/kiosk-data.service';
import type { Doctor, Polyclinic, WeeklySchedule, ScheduleOverride } from '../src/lib/types';

describe('StatusEngine - Algoritma Status & Jadwal Praktik', () => {
	const mockDoctor: Doctor = {
		id: 'doc-test-1',
		full_name: 'dr. Andi Pratama, Sp.JP',
		title: 'Spesialis Jantung',
		is_active: true,
		display_order: 1
	};

	const mockPoli: Polyclinic = {
		id: 'poli-test-1',
		name: 'Poliklinik Jantung',
		code: 'JTG',
		is_active: true,
		display_order: 1
	};

	it('harus menghitung tanggal, jam, dan hari (1-7) sesuai timezone', () => {
		const makassar = StatusEngine.getNowInTimezone('Asia/Makassar');
		expect(makassar.currentDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(makassar.currentTimeStr).toMatch(/^\d{2}:\d{2}$/);
		expect(makassar.currentDayOfWeek).toBeGreaterThanOrEqual(1);
		expect(makassar.currentDayOfWeek).toBeLessThanOrEqual(7);

		const jakarta = StatusEngine.getNowInTimezone('Asia/Jakarta');
		expect(jakarta.currentDateStr).toBeDefined();
		expect(jakarta.currentTimeStr).toBeDefined();
	});

	it('harus menghasilkan status CLOSED bila hari ini tidak ada jadwal dan tidak ada override', () => {
		const result = StatusEngine.resolveDoctorStatus(
			mockDoctor,
			mockPoli,
			[], // tidak ada jadwal
			[], // tidak ada override
			'Asia/Makassar'
		);

		expect(result.status.code).toBe('CLOSED');
		expect(result.status.label).toBe('TUTUP');
		expect(result.status.type).toBe('closed');
		expect(result.todaySchedule).toBeUndefined();
	});

	it('harus menghasilkan status OPEN saat dokter berada dalam jam praktik', () => {
		const { currentDayOfWeek } = StatusEngine.getNowInTimezone('Asia/Makassar');

		// Buat jadwal yang mencakup seluruh 24 jam hari ini
		const activeSchedule: WeeklySchedule = {
			id: 'sch-active',
			doctor_id: mockDoctor.id,
			polyclinic_id: mockPoli.id,
			day_of_week: currentDayOfWeek,
			start_time: '00:00:00',
			end_time: '23:59:59',
			is_active: true
		};

		const result = StatusEngine.resolveDoctorStatus(
			mockDoctor,
			mockPoli,
			[activeSchedule],
			[],
			'Asia/Makassar'
		);

		expect(result.status.code).toBe('OPEN');
		expect(result.status.label).toBe('BUKA');
		expect(result.status.type).toBe('open');
		expect(result.todaySchedule).toBeDefined();
	});

	it('harus menghasilkan status UPCOMING bila jam praktik belum dimulai', () => {
		const { currentDayOfWeek } = StatusEngine.getNowInTimezone('Asia/Makassar');

		// Jadwal jam 23:58 - 23:59 (asumsi jam sekarang belum mencapai 23:58)
		const upcomingSchedule: WeeklySchedule = {
			id: 'sch-upcoming',
			doctor_id: mockDoctor.id,
			polyclinic_id: mockPoli.id,
			day_of_week: currentDayOfWeek,
			start_time: '23:58:00',
			end_time: '23:59:00',
			is_active: true
		};

		// Hanya uji UPCOMING jika jam saat ini masih sebelum 23:58
		const { currentTimeStr } = StatusEngine.getNowInTimezone('Asia/Makassar');
		if (currentTimeStr < '23:58') {
			const result = StatusEngine.resolveDoctorStatus(
				mockDoctor,
				mockPoli,
				[upcomingSchedule],
				[],
				'Asia/Makassar'
			);

			expect(result.status.code).toBe('UPCOMING');
			expect(result.status.label).toBe('AKAN DATANG');
			expect(result.status.type).toBe('upcoming');
		}
	});

	it('harus memprioritaskan Override Manual di atas perhitungan jam otomatis (Prioritas Override)', () => {
		const { currentDateStr, currentDayOfWeek } = StatusEngine.getNowInTimezone('Asia/Makassar');

		// Jadwal buka otomatis
		const activeSchedule: WeeklySchedule = {
			id: 'sch-active',
			doctor_id: mockDoctor.id,
			polyclinic_id: mockPoli.id,
			day_of_week: currentDayOfWeek,
			start_time: '00:00:00',
			end_time: '23:59:59',
			is_active: true
		};

		// 1. Override LIBUR / HOLIDAY
		const holidayOverride: ScheduleOverride = {
			id: 'ovr-1',
			doctor_id: mockDoctor.id,
			polyclinic_id: mockPoli.id,
			schedule_date: currentDateStr,
			status_code: 'HOLIDAY',
			custom_message: 'Cuti Tahunan Dokter'
		};

		const resultHoliday = StatusEngine.resolveDoctorStatus(
			mockDoctor,
			mockPoli,
			[activeSchedule],
			[holidayOverride],
			'Asia/Makassar'
		);

		expect(resultHoliday.status.code).toBe('HOLIDAY');
		expect(resultHoliday.status.label).toBe('LIBUR');
		expect(resultHoliday.status.subtext).toBe('Cuti Tahunan Dokter');
		expect(resultHoliday.status.type).toBe('holiday');

		// 2. Override ISTIRAHAT / BREAK
		const breakOverride: ScheduleOverride = {
			id: 'ovr-2',
			doctor_id: mockDoctor.id,
			polyclinic_id: mockPoli.id,
			schedule_date: currentDateStr,
			status_code: 'BREAK',
			custom_message: 'Istirahat Siang'
		};

		const resultBreak = StatusEngine.resolveDoctorStatus(
			mockDoctor,
			mockPoli,
			[activeSchedule],
			[breakOverride],
			'Asia/Makassar'
		);

		expect(resultBreak.status.code).toBe('BREAK');
		expect(resultBreak.status.label).toBe('ISTIRAHAT');
		expect(resultBreak.status.subtext).toBe('Istirahat Siang');
		expect(resultBreak.status.type).toBe('break');
	});
});

describe('KioskDataService - Algoritma Chunking & Pagination Kiosk', () => {
	it('harus membagi slide maksimal 4 kartu dokter per slide untuk mencegah overflow layout', () => {
		const generated = KioskDataService.generateKioskSlides();

		expect(generated.slides).toBeDefined();
		expect(generated.slides.length).toBeGreaterThanOrEqual(1);

		// Periksa setiap slide bertipe schedule
		for (const slide of generated.slides) {
			if (slide.type === 'schedule') {
				const totalCards = slide.sections.reduce((acc, sec) => acc + sec.doctors.length, 0);
				expect(totalCards).toBeLessThanOrEqual(4);
				expect(slide.sections.length).toBeLessThanOrEqual(4);
			}
			expect(slide.totalPages).toBe(generated.slides.length);
			expect(slide.pageNumber).toBeGreaterThanOrEqual(1);
			expect(slide.pageNumber).toBeLessThanOrEqual(generated.slides.length);
		}
	});

	it('harus memastikan nomor halaman urut dan totalPages konsisten di semua slide', () => {
		const { slides } = KioskDataService.generateKioskSlides();

		slides.forEach((slide, idx) => {
			expect(slide.pageNumber).toBe(idx + 1);
			expect(slide.totalPages).toBe(slides.length);
		});
	});

	it('hanya menampilkan poliklinik yang telah memiliki dokter dan jadwal terdaftar di Kiosk', () => {
		const { slides } = KioskDataService.generateKioskSlides();
		const scheduleSlides = slides.filter((s) => s.type === 'schedule');

		for (const slide of scheduleSlides) {
			for (const section of slide.sections) {
				// Setiap section poliklinik di Kiosk wajib memiliki dokter (> 0)
				expect(section.doctors.length).toBeGreaterThan(0);
				expect(section.doctorCount).toBeGreaterThan(0);
			}
		}
	});
});
