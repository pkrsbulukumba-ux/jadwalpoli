import type { PoliSectionData, KioskSlide } from '$lib/types';

/**
 * Dataset dummy poliklinik dan jadwal praktik dokter untuk pengujian Kiosk (Phase 2 & Phase 3)
 * Mencakup data persis Exampel.PNG pada Slide 1, serta variasi multiple dokter dan multi-status pada Slide 2.
 */
export const DUMMY_POLI_SLIDE_1: PoliSectionData[] = [
	{
		polyclinic: {
			id: 'poli-jantung',
			name: 'JANTUNG & PEMBULUH DARAH',
			code: 'JNT',
			icon: 'heart',
			is_active: true,
			display_order: 1
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-deni',
					full_name: 'dr. Deni Syamsuddin, Sp.JP',
					title: 'Spesialis Jantung & Pembuluh Darah',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-1',
						doctor_id: 'doc-deni',
						polyclinic_id: 'poli-jantung',
						day_of_week: 1,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-2',
						doctor_id: 'doc-deni',
						polyclinic_id: 'poli-jantung',
						day_of_week: 2,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-3',
						doctor_id: 'doc-deni',
						polyclinic_id: 'poli-jantung',
						day_of_week: 3,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-4',
						doctor_id: 'doc-deni',
						polyclinic_id: 'poli-jantung',
						day_of_week: 4,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-5',
						doctor_id: 'doc-deni',
						polyclinic_id: 'poli-jantung',
						day_of_week: 5,
						start_time: '10:00',
						end_time: '12:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-2',
					doctor_id: 'doc-deni',
					polyclinic_id: 'poli-jantung',
					day_of_week: 2,
					start_time: '10:00',
					end_time: '14:00',
					is_active: true
				},
				status: {
					code: 'CLOSED',
					label: 'TUTUP',
					subtext: 'Di Luar Jadwal',
					type: 'closed'
				}
			}
		]
	},
	{
		polyclinic: {
			id: 'poli-jiwa',
			name: 'KESEHATAN JIWA',
			code: 'JWA',
			icon: 'brain',
			is_active: true,
			display_order: 2
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-wahyuni',
					full_name: 'dr. Wahyuni, Sp.KJ',
					title: 'Spesialis Kedokteran Jiwa',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-6',
						doctor_id: 'doc-wahyuni',
						polyclinic_id: 'poli-jiwa',
						day_of_week: 1,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-7',
						doctor_id: 'doc-wahyuni',
						polyclinic_id: 'poli-jiwa',
						day_of_week: 2,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-8',
						doctor_id: 'doc-wahyuni',
						polyclinic_id: 'poli-jiwa',
						day_of_week: 3,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-9',
						doctor_id: 'doc-wahyuni',
						polyclinic_id: 'poli-jiwa',
						day_of_week: 4,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-10',
						doctor_id: 'doc-wahyuni',
						polyclinic_id: 'poli-jiwa',
						day_of_week: 5,
						start_time: '09:00',
						end_time: '12:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-7',
					doctor_id: 'doc-wahyuni',
					polyclinic_id: 'poli-jiwa',
					day_of_week: 2,
					start_time: '09:00',
					end_time: '13:00',
					is_active: true
				},
				status: {
					code: 'CLOSED',
					label: 'TUTUP',
					subtext: 'Di Luar Jadwal',
					type: 'closed'
				}
			}
		]
	},
	{
		polyclinic: {
			id: 'poli-kb',
			name: 'KELUARGA BERENCANA (KB)',
			code: 'KB',
			icon: 'users',
			is_active: true,
			display_order: 3
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-asmiati',
					full_name: 'Bdn. Asmiati, S.Tr.Keb',
					title: 'Bidan Ahli',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-11',
						doctor_id: 'doc-asmiati',
						polyclinic_id: 'poli-kb',
						day_of_week: 1,
						start_time: '08:30',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-12',
						doctor_id: 'doc-asmiati',
						polyclinic_id: 'poli-kb',
						day_of_week: 2,
						start_time: '08:30',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-13',
						doctor_id: 'doc-asmiati',
						polyclinic_id: 'poli-kb',
						day_of_week: 3,
						start_time: '08:30',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-14',
						doctor_id: 'doc-asmiati',
						polyclinic_id: 'poli-kb',
						day_of_week: 4,
						start_time: '08:30',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-15',
						doctor_id: 'doc-asmiati',
						polyclinic_id: 'poli-kb',
						day_of_week: 5,
						start_time: '08:30',
						end_time: '12:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-12',
					doctor_id: 'doc-asmiati',
					polyclinic_id: 'poli-kb',
					day_of_week: 2,
					start_time: '08:30',
					end_time: '14:00',
					is_active: true
				},
				status: {
					code: 'CLOSED',
					label: 'TUTUP',
					subtext: 'Di Luar Jadwal',
					type: 'closed'
				}
			}
		]
	},
	{
		polyclinic: {
			id: 'poli-kulit',
			name: 'KULIT & KELAMIN',
			code: 'KLT',
			icon: 'shield',
			is_active: true,
			display_order: 4
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-nurhidayat',
					full_name: 'dr. Hj. Nurhidayat, M.Kes, Sp.DV',
					title: 'Spesialis Dermatologi & Venereologi',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-16',
						doctor_id: 'doc-nurhidayat',
						polyclinic_id: 'poli-kulit',
						day_of_week: 1,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-17',
						doctor_id: 'doc-nurhidayat',
						polyclinic_id: 'poli-kulit',
						day_of_week: 2,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-18',
						doctor_id: 'doc-nurhidayat',
						polyclinic_id: 'poli-kulit',
						day_of_week: 3,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-19',
						doctor_id: 'doc-nurhidayat',
						polyclinic_id: 'poli-kulit',
						day_of_week: 4,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-17',
					doctor_id: 'doc-nurhidayat',
					polyclinic_id: 'poli-kulit',
					day_of_week: 2,
					start_time: '09:00',
					end_time: '13:00',
					is_active: true
				},
				status: {
					code: 'CLOSED',
					label: 'TUTUP',
					subtext: 'Di Luar Jadwal',
					type: 'closed'
				}
			}
		]
	}
];

/**
 * Slide 2: Menguji Poli dengan Multiple Dokter (Poli Penyakit Dalam: 2 dokter)
 * dan variasi status: BUKA, SEDANG PRAKTIK, LIBUR, AKAN DATANG.
 */
export const DUMMY_POLI_SLIDE_2: PoliSectionData[] = [
	{
		polyclinic: {
			id: 'poli-penyakit-dalam',
			name: 'PENYAKIT DALAM',
			code: 'INT',
			icon: 'stethoscope',
			is_active: true,
			display_order: 5
		},
		doctorCount: 2,
		doctors: [
			{
				doctor: {
					id: 'doc-rasyid',
					full_name: 'dr. H. Rasyid Ridho, Sp.PD-KGEH',
					title: 'Konsultan Gastroenterohepatologi',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-20',
						doctor_id: 'doc-rasyid',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 1,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-21',
						doctor_id: 'doc-rasyid',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 2,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					},
					{
						id: 's-22',
						doctor_id: 'doc-rasyid',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 4,
						start_time: '09:00',
						end_time: '13:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-21',
					doctor_id: 'doc-rasyid',
					polyclinic_id: 'poli-penyakit-dalam',
					day_of_week: 2,
					start_time: '09:00',
					end_time: '13:00',
					is_active: true
				},
				status: {
					code: 'OPEN',
					label: 'BUKA',
					subtext: 'Sedang Praktik',
					type: 'open'
				}
			},
			{
				doctor: {
					id: 'doc-siti',
					full_name: 'dr. Siti Rahma, Sp.PD',
					title: 'Spesialis Penyakit Dalam',
					photo_url: '',
					is_active: true,
					display_order: 2
				},
				schedules: [
					{
						id: 's-23',
						doctor_id: 'doc-siti',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 2,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-24',
						doctor_id: 'doc-siti',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 3,
						start_time: '10:00',
						end_time: '14:00',
						is_active: true
					},
					{
						id: 's-25',
						doctor_id: 'doc-siti',
						polyclinic_id: 'poli-penyakit-dalam',
						day_of_week: 5,
						start_time: '09:00',
						end_time: '12:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-23',
					doctor_id: 'doc-siti',
					polyclinic_id: 'poli-penyakit-dalam',
					day_of_week: 2,
					start_time: '10:00',
					end_time: '14:00',
					is_active: true
				},
				status: {
					code: 'BREAK',
					label: 'ISTIRAHAT',
					subtext: 'Pukul 12:00-13:00',
					type: 'break'
				}
			}
		]
	},
	{
		polyclinic: {
			id: 'poli-mata',
			name: 'MATA',
			code: 'MTA',
			icon: 'eye',
			is_active: true,
			display_order: 6
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-maya',
					full_name: 'dr. Maya Indah, Sp.M',
					title: 'Spesialis Mata',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-26',
						doctor_id: 'doc-maya',
						polyclinic_id: 'poli-mata',
						day_of_week: 1,
						start_time: '08:00',
						end_time: '12:00',
						is_active: true
					},
					{
						id: 's-27',
						doctor_id: 'doc-maya',
						polyclinic_id: 'poli-mata',
						day_of_week: 2,
						start_time: '08:00',
						end_time: '12:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-27',
					doctor_id: 'doc-maya',
					polyclinic_id: 'poli-mata',
					day_of_week: 2,
					start_time: '08:00',
					end_time: '12:00',
					is_active: true
				},
				status: {
					code: 'HOLIDAY',
					label: 'LIBUR',
					subtext: 'Cuti Tahunan',
					type: 'holiday'
				}
			}
		]
	},
	{
		polyclinic: {
			id: 'poli-anak',
			name: 'ANAK & TUMBUH KEMBANG',
			code: 'ANK',
			icon: 'baby',
			is_active: true,
			display_order: 7
		},
		doctorCount: 1,
		doctors: [
			{
				doctor: {
					id: 'doc-faisal',
					full_name: 'dr. Ahmad Faisal, Sp.A, M.Kes',
					title: 'Spesialis Anak',
					photo_url: '',
					is_active: true,
					display_order: 1
				},
				schedules: [
					{
						id: 's-28',
						doctor_id: 'doc-faisal',
						polyclinic_id: 'poli-anak',
						day_of_week: 2,
						start_time: '13:00',
						end_time: '16:00',
						is_active: true
					},
					{
						id: 's-29',
						doctor_id: 'doc-faisal',
						polyclinic_id: 'poli-anak',
						day_of_week: 3,
						start_time: '13:00',
						end_time: '16:00',
						is_active: true
					}
				],
				todaySchedule: {
					id: 's-28',
					doctor_id: 'doc-faisal',
					polyclinic_id: 'poli-anak',
					day_of_week: 2,
					start_time: '13:00',
					end_time: '16:00',
					is_active: true
				},
				status: {
					code: 'UPCOMING',
					label: 'AKAN DATANG',
					subtext: 'Mulai Pukul 13:00',
					type: 'upcoming'
				}
			}
		]
	}
];

/**
 * Playlist lengkap Slideshow Kiosk (Phase 3):
 * - Slide 1: Jadwal 4 Poli (Jantung, Jiwa, KB, Kulit) - 15 detik
 * - Slide 2: Jadwal 3 Poli (Penyakit Dalam 2 dokter, Mata, Anak) - 15 detik
 * - Slide 3: Pengumuman Gambar (Layanan Unggulan RSUD) - 10 detik
 * - Slide 4: Pengumuman Video Edukasi Pasien BPJS JKN - Menunggu video selesai
 */
export const DUMMY_SLIDES: KioskSlide[] = [
	{
		id: 'slide-jadwal-1',
		type: 'schedule',
		pageNumber: 1,
		totalPages: 4,
		sections: DUMMY_POLI_SLIDE_1,
		durationSeconds: 15
	},
	{
		id: 'slide-jadwal-2',
		type: 'schedule',
		pageNumber: 2,
		totalPages: 4,
		sections: DUMMY_POLI_SLIDE_2,
		durationSeconds: 15
	},
	{
		id: 'slide-media-gambar',
		type: 'media',
		pageNumber: 3,
		totalPages: 4,
		media: {
			id: 'med-1',
			title: 'Layanan Unggulan Poliklinik Eksekutif RSUD H. Andi Sulthan Daeng Radja',
			media_type: 'image',
			file_path: 'announcements/edukasi-layanan.jpg',
			public_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
			sort_order: 1,
			is_active: true
		},
		durationSeconds: 10
	},
	{
		id: 'slide-media-video',
		type: 'media',
		pageNumber: 4,
		totalPages: 4,
		media: {
			id: 'med-2',
			title: 'Panduan Pendaftaran Online & Antrean Pasien BPJS Mobile JKN',
			media_type: 'video',
			file_path: 'announcements/video-edukasi-jkn.mp4',
			public_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
			sort_order: 2,
			is_active: true
		},
		durationSeconds: 15 // Fallback timer jika video gagal diputar
	}
];
