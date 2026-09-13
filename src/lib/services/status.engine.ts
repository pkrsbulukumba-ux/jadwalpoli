import type {
	Doctor,
	Polyclinic,
	WeeklySchedule,
	ScheduleOverride,
	DoctorStatusPresentation
} from '$lib/types';

/**
 * StatusEngine: Algoritma Perhitungan Jadwal & Status Praktik Dokter Realtime
 * Sesuai spesifikasi PRD Section 17
 */
export class StatusEngine {
	/**
	 * Menghitung waktu dan tanggal saat ini berdasarkan timezone (default: Asia/Makassar / WITA)
	 */
	public static getNowInTimezone(timezone: string = 'Asia/Makassar') {
		const now = new Date();

		const timeFormatter = new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		const currentTimeStr = timeFormatter.format(now); // e.g. "10:30"

		const dateFormatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		const currentDateStr = dateFormatter.format(now); // e.g. "2026-09-08"

		const dayFormatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			weekday: 'short'
		});
		const dayShort = dayFormatter.format(now);
		const dayMap: Record<string, number> = {
			Mon: 1,
			Tue: 2,
			Wed: 3,
			Thu: 4,
			Fri: 5,
			Sat: 6,
			Sun: 7
		};
		const currentDayOfWeek = dayMap[dayShort] || 1;

		return {
			currentDateStr,
			currentTimeStr,
			currentDayOfWeek
		};
	}

	/**
	 * Menentukan status presentasi dokter (Buka, Tutup, Sedang Praktik, Libur, dll.)
	 * dengan hierarki: Override Manual > Jadwal Jam Buka Hari Ini > Di Luar Jadwal
	 */
	public static resolveDoctorStatus(
		doctor: Doctor,
		polyclinic: Polyclinic,
		schedules: WeeklySchedule[],
		overrides: ScheduleOverride[],
		timezone: string = 'Asia/Makassar'
	): {
		status: DoctorStatusPresentation;
		todaySchedule?: WeeklySchedule;
		currentDayOfWeek: number;
	} {
		const { currentDateStr, currentTimeStr, currentDayOfWeek } = this.getNowInTimezone(timezone);

		// 1. Ambil jadwal hari ini untuk dokter pada poli bersangkutan
		const todaySchedule = schedules.find(
			(s) => s.is_active && s.day_of_week === currentDayOfWeek && s.polyclinic_id === polyclinic.id
		);

		// 2. Cek apakah ada jadwal override tanggal hari ini
		const todayOverride = overrides.find(
			(o) =>
				o.doctor_id === doctor.id &&
				o.polyclinic_id === polyclinic.id &&
				o.schedule_date === currentDateStr
		);

		// 3. Evaluasi status dengan prioritas:
		// Prioritas 1: Override Manual dari Admin/CMS
		if (todayOverride) {
			const code = todayOverride.status_code.toUpperCase();
			switch (code) {
				case 'OPEN':
					return {
						status: {
							code: 'OPEN',
							label: 'BUKA',
							subtext: todayOverride.custom_message || 'Sedang Praktik',
							type: 'open'
						},
						todaySchedule,
						currentDayOfWeek
					};
				case 'BREAK':
					return {
						status: {
							code: 'BREAK',
							label: 'ISTIRAHAT',
							subtext: todayOverride.custom_message || 'Jam Istirahat',
							type: 'break'
						},
						todaySchedule,
						currentDayOfWeek
					};
				case 'HOLIDAY':
					return {
						status: {
							code: 'HOLIDAY',
							label: 'LIBUR',
							subtext: todayOverride.custom_message || 'Cuti Dokter',
							type: 'holiday'
						},
						todaySchedule,
						currentDayOfWeek
					};
				case 'CANCELLED':
					return {
						status: {
							code: 'CANCELLED',
							label: 'DIBATALKAN',
							subtext: todayOverride.custom_message || 'Praktik Dibatalkan',
							type: 'cancelled'
						},
						todaySchedule,
						currentDayOfWeek
					};
				default:
					return {
						status: {
							code: 'CLOSED',
							label: 'TUTUP',
							subtext: todayOverride.custom_message || 'Di Luar Jadwal',
							type: 'closed'
						},
						todaySchedule,
						currentDayOfWeek
					};
			}
		}

		// Prioritas 2: Perhitungan rentang jam praktik hari ini
		if (todaySchedule) {
			const start = todaySchedule.start_time.slice(0, 5); // "HH:mm"
			const end = todaySchedule.end_time.slice(0, 5);

			if (currentTimeStr >= start && currentTimeStr <= end) {
				return {
					status: {
						code: 'OPEN',
						label: 'BUKA',
						subtext: 'Sedang Praktik',
						type: 'open'
					},
					todaySchedule,
					currentDayOfWeek
				};
			}

			if (currentTimeStr < start) {
				return {
					status: {
						code: 'UPCOMING',
						label: 'AKAN DATANG',
						subtext: `Praktik Pukul ${start}`,
						type: 'upcoming'
					},
					todaySchedule,
					currentDayOfWeek
				};
			}

			// Lewat jam selesai praktik
			return {
				status: {
					code: 'CLOSED',
					label: 'TUTUP',
					subtext: 'Di Luar Jadwal',
					type: 'closed'
				},
				todaySchedule,
				currentDayOfWeek
			};
		}

		// Prioritas 3: Hari ini tidak ada jadwal
		return {
			status: {
				code: 'CLOSED',
				label: 'TUTUP',
				subtext: 'Di Luar Jadwal',
				type: 'closed'
			},
			todaySchedule: undefined,
			currentDayOfWeek
		};
	}
}
