import { describe, it, expect, beforeEach } from 'vitest';
import { DataRepository } from '../src/lib/services/data.repository';
import { StatusEngine } from '../src/lib/services/status.engine';
import { KioskDataService } from '../src/lib/services/kiosk-data.service';

describe('CMS Dokter & Jadwal - Sinkronisasi Status Praktik Hari Ini & Kiosk', () => {
	beforeEach(() => {
		DataRepository.init();
	});

	it('harus memunculkan dokter baru di status praktik hari ini meskipun jadwalnya di hari lain', () => {
		// 1. Simulasikan penambahan dokter baru di Master Dokter pada Poli Jantung (poli-1)
		const newDoc = DataRepository.createDoctor({
			full_name: 'dr. Spesialis Baru Uji Coba, Sp.JP',
			title: 'Spesialis Jantung & Pembuluh Darah',
			photo_url: '',
			polyclinic_id: 'poli-1',
			is_active: true,
			display_order: 99
		});

		// 2. Tambahkan jadwal mingguan pada hari Kamis (day 4) dan Jumat (day 5)
		const sch1 = DataRepository.createWeeklySchedule({
			doctor_id: newDoc.id,
			polyclinic_id: 'poli-1',
			day_of_week: 4, // Kamis
			start_time: '09:00:00',
			end_time: '14:00:00',
			is_active: true
		});

		const sch2 = DataRepository.createWeeklySchedule({
			doctor_id: newDoc.id,
			polyclinic_id: 'poli-1',
			day_of_week: 5, // Jumat
			start_time: '09:00:00',
			end_time: '14:00:00',
			is_active: true
		});

		// 3. Verifikasi pada KioskDataService
		const kioskResult = KioskDataService.generateKioskSlides();
		const scheduleSlides = kioskResult.slides.filter((s) => s.type === 'schedule');
		const allKioskDoctorCards = scheduleSlides.flatMap((s) =>
			s.sections.flatMap((sec) => sec.doctors)
		);
		const kioskDoctorFound = allKioskDoctorCards.find((c) => c.doctor.id === newDoc.id);

		expect(kioskDoctorFound).toBeDefined();
		expect(kioskDoctorFound?.doctor.full_name).toBe('dr. Spesialis Baru Uji Coba, Sp.JP');

		// 4. Verifikasi logika Tab 1 CMS: Harus memuat dokter di Poli Jantung
		const polyclinics = DataRepository.getPolyclinics();
		const weeklySchedules = DataRepository.getAllWeeklySchedules();
		const overrides = DataRepository.getOverrides();
		const doctors = DataRepository.getDoctors();
		const { currentDayOfWeek, currentDateStr } = StatusEngine.getNowInTimezone('Asia/Makassar');

		// Evaluasi seluruh dokter aktif per poliklinik (logika baru yang selaras dengan Kiosk)
		const poliJantung = polyclinics.find((p) => p.id === 'poli-1')!;
		const poliSchedules = weeklySchedules.filter((s) => s.polyclinic_id === poliJantung.id);
		const doctorIdsInPoli = Array.from(new Set(poliSchedules.map((s) => s.doctor_id)));
		const doctorsInMaster = doctors.filter((d) => d.polyclinic_id === poliJantung.id).map((d) => d.id);
		const allDoctorIds = Array.from(new Set([...doctorIdsInPoli, ...doctorsInMaster]));

		expect(allDoctorIds).toContain(newDoc.id);

		// Evaluasi status dokter baru
		const docSchedules = poliSchedules.filter((s) => s.doctor_id === newDoc.id);
		expect(docSchedules.length).toBe(2);

		const todaySchedule = docSchedules.find(
			(s) => s.day_of_week === currentDayOfWeek && s.is_active
		);
		const evaluation = StatusEngine.resolveDoctorStatus(
			newDoc,
			poliJantung,
			docSchedules,
			overrides,
			'Asia/Makassar'
		);

		// Jika hari ini bukan Kamis atau Jumat, status otomatis TUTUP (Di Luar Jadwal)
		if (!todaySchedule) {
			expect(evaluation.status.code).toBe('CLOSED');
			expect(evaluation.status.label).toBe('TUTUP');
			expect(evaluation.status.subtext).toBe('Di Luar Jadwal');
		}

		// 5. Uji Aksi Cepat Petugas: Berikan Override OPEN untuk hari ini
		const override = DataRepository.addOrUpdateOverride({
			id: 'ovr-test-' + Date.now(),
			doctor_id: newDoc.id,
			polyclinic_id: 'poli-1',
			schedule_date: currentDateStr,
			status_code: 'OPEN',
			custom_message: 'Dokter Pengganti Hari Ini'
		});

		const updatedOverrides = DataRepository.getOverrides();
		const evalAfterOverride = StatusEngine.resolveDoctorStatus(
			newDoc,
			poliJantung,
			docSchedules,
			updatedOverrides,
			'Asia/Makassar'
		);

		expect(evalAfterOverride.status.code).toBe('OPEN');
		expect(evalAfterOverride.status.label).toBe('BUKA');
		expect(evalAfterOverride.status.subtext).toBe('Dokter Pengganti Hari Ini');

		// Cleanup
		DataRepository.deleteDoctor(newDoc.id);
		DataRepository.deleteWeeklySchedule(sch1.id);
		DataRepository.deleteWeeklySchedule(sch2.id);
		DataRepository.deleteOverrideForDoctorAndDate(newDoc.id, 'poli-1', currentDateStr);
	});
});
