<script lang="ts">
	import { onMount } from 'svelte';
	import {
		UserCheck,
		Calendar,
		Clock,
		Plus,
		Search,
		Edit3,
		Trash2,
		X,
		Check,
		AlertTriangle,
		RefreshCw,
		CheckCircle2,
		XCircle,
		Coffee,
		Ban,
		Sliders,
		Upload,
		Camera,
		ChevronUp,
		ChevronDown
	} from '@lucide/svelte';
	import { DataRepository } from '$lib/services/data.repository';
	import { StatusEngine } from '$lib/services/status.engine';
	import { getPolyclinicIconComponent } from '$lib/services/icon.service';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import type { Doctor, Polyclinic, WeeklySchedule, ScheduleOverride, PracticeStatus } from '$lib/types';

	type ActiveTab = 'status' | 'doctors' | 'schedules';
	let activeTab = $state<ActiveTab>('status');

	// Data Collections
	let doctors = $state<Doctor[]>([]);
	let polyclinics = $state<Polyclinic[]>([]);
	let weeklySchedules = $state<WeeklySchedule[]>([]);
	let overrides = $state<ScheduleOverride[]>([]);
	let kioskSettings = $state(DataRepository.getSettings());

	// Waktu & Hari Ini
	let todayDateStr = $state('');
	let dayOfWeekToday = $state(1);
	let todayFormatted = $state('');

	// Search & Filter States
	let searchDoctorQuery = $state('');
	let filterSchedulePoli = $state('all');
	let filterScheduleDay = $state<number | 'all'>('all');
	let searchScheduleQuery = $state('');
	let scheduleSortMode = $state<'doctor' | 'day'>('doctor');
	let filterDoctorPoli = $state('all');
	let filterTodayPoli = $state('all');
	let filterTodayScheduleType = $state<'all' | 'scheduled_today' | 'open_only'>('all');
	let isRefreshing = $state(false);
	let doctorViewMode = $state<'grouped' | 'flat'>('grouped');

	// State Modal Dokter
	let isDoctorModalOpen = $state(false);
	let isEditingDoctor = $state(false);
	let docId = $state('');
	let docName = $state('');
	let docTitle = $state('');
	let docPhoto = $state('');
	let docPoliId = $state('');
	let docIsActive = $state(true);
	let docError = $state('');

	// State Modal Jadwal
	let isScheduleModalOpen = $state(false);
	let isEditingSchedule = $state(false);
	let schId = $state('');
	let schDoctorId = $state('');
	let schPoliId = $state('');
	let schDayOfWeek = $state(1);
	let schSelectedDays = $state<number[]>([1]);
	let schStartTime = $state('08:00');
	let schEndTime = $state('14:00');
	let schIsActive = $state(true);
	let schError = $state('');

	// State Modal Override Cepat
	let isOverrideModalOpen = $state(false);
	let targetDoctor = $state<Doctor | null>(null);
	let targetPoli = $state<Polyclinic | null>(null);
	let overrideStatusChoice = $state<'OPEN' | 'BREAK' | 'CLOSED' | 'HOLIDAY'>('HOLIDAY');
	let overrideNote = $state('');

	// State Konfirmasi Hapus
	let isDeleteConfirmOpen = $state(false);
	let deleteType = $state<'doctor' | 'schedule'>('doctor');
	let deleteTargetId = $state('');
	let deleteTargetLabel = $state('');

	const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

	function getPoliName(poliId?: string): string {
		if (!poliId) return 'Belum Ditugaskan';
		const p = polyclinics.find((item) => item.id === poliId);
		return p ? p.name : 'Poliklinik';
	}

	function getDoctorPoliId(doc: Doctor): string {
		if (doc.polyclinic_id) return doc.polyclinic_id;
		const sch = weeklySchedules.find((s) => s.doctor_id === doc.id);
		return sch ? sch.polyclinic_id : '';
	}

	async function loadAllData(force = false) {
		if (force) {
			isRefreshing = true;
			try {
				await DataRepository.syncWithServer(true);
			} catch (e) {
				console.warn('Sync server error:', e);
			} finally {
				setTimeout(() => {
					isRefreshing = false;
				}, 450);
			}
		}

		doctors = DataRepository.getDoctors();
		polyclinics = DataRepository.getPolyclinics();
		weeklySchedules = DataRepository.getAllWeeklySchedules();
		overrides = DataRepository.getOverrides();
		kioskSettings = DataRepository.getSettings();

		const timeInfo = StatusEngine.getNowInTimezone(kioskSettings.timezone || 'Asia/Makassar');
		todayDateStr = timeInfo.currentDateStr;
		dayOfWeekToday = timeInfo.currentDayOfWeek;
		todayFormatted = `${dayNames[dayOfWeekToday]}, ${todayDateStr}`;
	}

	onMount(() => {
		loadAllData(true);

		const unsubRealtime = DataRepository.subscribeToRealtimeChanges(() => {
			loadAllData(false);
		});

		const handleStorage = (e: StorageEvent) => {
			if (e.key && e.key.includes('kiosk_')) {
				loadAllData(false);
			}
		};

		const handleCustomUpdate = () => {
			loadAllData(false);
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('storage', handleStorage);
			window.addEventListener('kiosk-data-updated', handleCustomUpdate);
		}

		return () => {
			if (unsubRealtime) unsubRealtime();
			if (typeof window !== 'undefined') {
				window.removeEventListener('storage', handleStorage);
				window.removeEventListener('kiosk-data-updated', handleCustomUpdate);
			}
		};
	});

	interface TodayDoctorScheduleItem {
		id: string;
		doctor: Doctor;
		polyclinic: Polyclinic;
		todaySchedule?: WeeklySchedule;
		allSchedules: WeeklySchedule[];
		evaluation: ReturnType<typeof StatusEngine.resolveDoctorStatus>;
		activeOverride?: ScheduleOverride;
		isScheduledToday: boolean;
	}

	// Derived: Seluruh dokter aktif per Poliklinik beserta evaluasi status live Kiosk hari ini
	// Menjamin dokter baru di Master Dokter dan jadwal mingguan selalu sinkron 100% dengan Kiosk
	let todayDoctorSchedules = $derived.by<TodayDoctorScheduleItem[]>(() => {
		const result: TodayDoctorScheduleItem[] = [];

		for (const poli of polyclinics) {
			// Cari seluruh jadwal mingguan yang terhubung dengan poli ini
			const poliSchedules = weeklySchedules.filter((s) => s.polyclinic_id === poli.id);
			const doctorIdsInPoli = Array.from(new Set(poliSchedules.map((s) => s.doctor_id)));

			// Tambahkan juga dokter yang memiliki penugasan polyclinic_id dari master dokter
			const doctorsInMaster = doctors.filter((d) => d.polyclinic_id === poli.id).map((d) => d.id);
			const allDoctorIds = Array.from(new Set([...doctorIdsInPoli, ...doctorsInMaster]));

			for (const docId of allDoctorIds) {
				const doctor = doctors.find((d) => d.id === docId);
				if (!doctor) continue;

				// Seluruh jadwal dokter ini di poli bersangkutan (terurut Senin–Minggu)
				const docSchedules = poliSchedules
					.filter((s) => s.doctor_id === docId)
					.sort((a, b) => a.day_of_week - b.day_of_week || (a.start_time || '').localeCompare(b.start_time || ''));

				// Jadwal aktif dokter untuk hari ini (jika ada)
				const todaySchedule = docSchedules.find(
					(s) => s.day_of_week === dayOfWeekToday && s.is_active
				);

				// Evaluasi status realtime menggunakan algoritma StatusEngine yang persis sama dengan Kiosk
				const evaluation = StatusEngine.resolveDoctorStatus(
					doctor,
					poli,
					docSchedules,
					overrides,
					kioskSettings.timezone || 'Asia/Makassar'
				);

				// Override aktif jika petugas mengaturnya untuk tanggal hari ini
				const activeOverride = overrides.find(
					(o) =>
						o.doctor_id === doctor.id &&
						o.polyclinic_id === poli.id &&
						o.schedule_date === todayDateStr
				);

				result.push({
					id: `${doctor.id}-${poli.id}`,
					doctor,
					polyclinic: poli,
					todaySchedule,
					allSchedules: docSchedules,
					evaluation,
					activeOverride,
					isScheduledToday: !!todaySchedule
				});
			}
		}

		// Jika ada dokter di master yang belum memiliki penugasan poli maupun jadwal
		const unassignedDoctors = doctors.filter(
			(d) => !d.polyclinic_id && !weeklySchedules.some((s) => s.doctor_id === d.id)
		);
		for (const doctor of unassignedDoctors) {
			const fallbackPoli: Polyclinic = {
				id: 'unassigned',
				name: 'Belum Ditugaskan',
				code: 'NON',
				is_active: false,
				display_order: 999
			};

			const evaluation = StatusEngine.resolveDoctorStatus(
				doctor,
				fallbackPoli,
				[],
				overrides,
				kioskSettings.timezone || 'Asia/Makassar'
			);

			const activeOverride = overrides.find(
				(o) =>
					o.doctor_id === doctor.id &&
					o.schedule_date === todayDateStr
			);

			result.push({
				id: `${doctor.id}-unassigned`,
				doctor,
				polyclinic: fallbackPoli,
				todaySchedule: undefined,
				allSchedules: [],
				evaluation,
				activeOverride,
				isScheduledToday: false
			});
		}

		return result;
	});

	// Derived: Status Praktik Hari Ini terkelompok per Poliklinik (Sinkronisasi Realtime & Filter Dinamis)
	let todayDoctorSchedulesGrouped = $derived.by(() => {
		let items = todayDoctorSchedules;

		// 1. Filter berdasarkan Poliklinik
		if (filterTodayPoli !== 'all') {
			items = items.filter((item) => item.polyclinic.id === filterTodayPoli);
		}

		// 2. Filter berdasarkan Tipe Jadwal / Status Live
		if (filterTodayScheduleType === 'scheduled_today') {
			items = items.filter((item) => item.isScheduledToday || !!item.activeOverride);
		} else if (filterTodayScheduleType === 'open_only') {
			items = items.filter((item) => item.evaluation.status.type === 'open');
		}

		const result: Array<{ polyclinic: Polyclinic; items: typeof items }> = [];

		for (const poli of polyclinics) {
			if (filterTodayPoli !== 'all' && poli.id !== filterTodayPoli) continue;

			const matching = items.filter((it) => it.polyclinic.id === poli.id);
			if (matching.length > 0) {
				// Urutkan dokter berdasar display_order
				matching.sort((a, b) => a.doctor.display_order - b.doctor.display_order);
				result.push({
					polyclinic: poli,
					items: matching
				});
			}
		}

		const unassigned = items.filter((it) => it.polyclinic.id === 'unassigned');
		if (unassigned.length > 0 && (filterTodayPoli === 'all' || filterTodayPoli === 'unassigned')) {
			result.push({
				polyclinic: {
					id: 'unassigned',
					name: 'Dokter Belum Ditugaskan ke Poliklinik',
					code: 'NON',
					is_active: false,
					display_order: 999
				},
				items: unassigned
			});
		}

		return result;
	});

	// Derived: Filtered Doctors
	let filteredDoctors = $derived(
		doctors
			.filter((d) => {
				const q = searchDoctorQuery.toLowerCase().trim();
				const matchesQuery = d.full_name.toLowerCase().includes(q) || (d.title && d.title.toLowerCase().includes(q));
				if (!matchesQuery) return false;

				if (filterDoctorPoli !== 'all') {
					const poliId = d.polyclinic_id || getDoctorPoliId(d);
					if (poliId !== filterDoctorPoli) return false;
				}
				return true;
			})
			.sort((a, b) => {
				if (filterDoctorPoli !== 'all') {
					return a.display_order - b.display_order;
				}
				const pIdA = a.polyclinic_id || getDoctorPoliId(a) || '';
				const pIdB = b.polyclinic_id || getDoctorPoliId(b) || '';
				const poliA = polyclinics.find((p) => p.id === pIdA);
				const poliB = polyclinics.find((p) => p.id === pIdB);
				const orderA = poliA?.display_order || 999;
				const orderB = poliB?.display_order || 999;
				if (orderA !== orderB) return orderA - orderB;
				return a.display_order - b.display_order;
			})
	);

	// Derived: Master Data Dokter terkelompok berdasarkan Poliklinik
	let groupedDoctors = $derived(() => {
		const result: Array<{ polyclinic: Polyclinic; doctors: Doctor[] }> = [];

		for (const poli of polyclinics) {
			if (filterDoctorPoli !== 'all' && poli.id !== filterDoctorPoli) continue;

			const docsInPoli = filteredDoctors.filter((d) => {
				const pId = d.polyclinic_id || getDoctorPoliId(d);
				return pId === poli.id;
			});
			docsInPoli.sort((a, b) => a.display_order - b.display_order);

			if (docsInPoli.length > 0) {
				result.push({
					polyclinic: poli,
					doctors: docsInPoli
				});
			}
		}

		if (filterDoctorPoli === 'all') {
			const unassigned = filteredDoctors.filter((d) => {
				const pId = d.polyclinic_id || getDoctorPoliId(d);
				return !pId || !polyclinics.some((p) => p.id === pId);
			});
			unassigned.sort((a, b) => a.display_order - b.display_order);
			if (unassigned.length > 0) {
				result.push({
					polyclinic: { id: 'unassigned', name: 'Belum Ditugaskan ke Poliklinik', code: 'N/A', is_active: true, display_order: 999 },
					doctors: unassigned
				});
			}
		}

		return result;
	});

	// Derived: Filtered Schedules (Terurut Rapi berdasar Dokter dan Hari Senin–Minggu)
	let filteredSchedules = $derived(
		weeklySchedules
			.filter((s) => {
				// 1. Filter Poliklinik
				if (filterSchedulePoli !== 'all' && s.polyclinic_id !== filterSchedulePoli) {
					return false;
				}
				// 2. Filter Hari Praktik (1 = Senin s.d. 7 = Minggu)
				if (filterScheduleDay !== 'all' && s.day_of_week !== Number(filterScheduleDay)) {
					return false;
				}
				// 3. Filter Pencarian Nama Dokter
				if (searchScheduleQuery.trim()) {
					const q = searchScheduleQuery.toLowerCase().trim();
					const doc = doctors.find((d) => d.id === s.doctor_id);
					const docName = doc ? doc.full_name.toLowerCase() : '';
					const docTitle = doc?.title ? doc.title.toLowerCase() : '';
					if (!docName.includes(q) && !docTitle.includes(q)) {
						return false;
					}
				}
				return true;
			})
			.sort((a, b) => {
				const docA = doctors.find((d) => d.id === a.doctor_id);
				const docB = doctors.find((d) => d.id === b.doctor_id);
				const poliA = polyclinics.find((p) => p.id === a.polyclinic_id);
				const poliB = polyclinics.find((p) => p.id === b.polyclinic_id);

				if (scheduleSortMode === 'day') {
					// Mode 1: Urut Hari (Senin=1..Minggu=7) -> Poliklinik -> Dokter (#1..N) -> Jam
					if (a.day_of_week !== b.day_of_week) {
						return a.day_of_week - b.day_of_week;
					}

					const pOrderA = poliA?.display_order ?? 999;
					const pOrderB = poliB?.display_order ?? 999;
					if (pOrderA !== pOrderB) return pOrderA - pOrderB;

					const dOrderA = docA?.display_order ?? 999;
					const dOrderB = docB?.display_order ?? 999;
					if (dOrderA !== dOrderB) return dOrderA - dOrderB;

					const nameA = docA?.full_name ?? '';
					const nameB = docB?.full_name ?? '';
					const nameComp = nameA.localeCompare(nameB);
					if (nameComp !== 0) return nameComp;

					return (a.start_time || '').localeCompare(b.start_time || '');
				}

				// Mode 2 (Default): Urut Poliklinik (#1..N) -> Dokter (#1..N) -> Hari (Senin=1..Minggu=7) -> Jam
				const poliOrderA = poliA?.display_order ?? 999;
				const poliOrderB = poliB?.display_order ?? 999;
				if (poliOrderA !== poliOrderB) return poliOrderA - poliOrderB;

				const docOrderA = docA?.display_order ?? 999;
				const docOrderB = docB?.display_order ?? 999;
				if (docOrderA !== docOrderB) return docOrderA - docOrderB;

				const docNameA = docA?.full_name ?? '';
				const docNameB = docB?.full_name ?? '';
				const nameComp = docNameA.localeCompare(docNameB);
				if (nameComp !== 0) return nameComp;

				// Hari Praktik (Senin=1 s.d. Minggu=7)
				if (a.day_of_week !== b.day_of_week) {
					return a.day_of_week - b.day_of_week;
				}

				// Jam Mulai Praktik
				return (a.start_time || '').localeCompare(b.start_time || '');
			})
	);

	// --- Quick Override Action & Instant Scroll Picker ---
	let quickStatusAlert = $state<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
	let quickAlertTimeout: ReturnType<typeof setTimeout> | null = null;

	function showQuickAlert(message: string, type: 'success' | 'info' | 'warning' = 'success') {
		if (quickAlertTimeout) clearTimeout(quickAlertTimeout);
		quickStatusAlert = { message, type };
		quickAlertTimeout = setTimeout(() => {
			quickStatusAlert = null;
		}, 4500);
	}

	function handleQuickStatusSelect(
		item: { doctor: Doctor; polyclinic: Polyclinic; activeOverride?: ScheduleOverride },
		newStatusCode: string
	) {
		const docName = item.doctor.full_name;
		const poliName = item.polyclinic.name;

		if (newStatusCode === 'AUTO') {
			DataRepository.deleteOverrideForDoctorAndDate(item.doctor.id, item.polyclinic.id, todayDateStr);
			loadAllData();
			showQuickAlert(`Status ${docName} (${poliName}) dikembalikan ke Otomatis (Ikuti Jam Jadwal).`, 'info');
		} else {
			let defaultMsg = '';
			if (newStatusCode === 'OPEN') defaultMsg = 'Sedang Praktik';
			else if (newStatusCode === 'BREAK') defaultMsg = 'Jam Istirahat';
			else if (newStatusCode === 'CLOSED') defaultMsg = 'Selesai Praktik';
			else if (newStatusCode === 'HOLIDAY') defaultMsg = 'Cuti / Izin Dokter';
			else if (newStatusCode === 'CANCELLED') defaultMsg = 'Praktik Dibatalkan';

			const existingMsg = item.activeOverride?.custom_message;

			DataRepository.addOrUpdateOverride({
				id: item.activeOverride ? item.activeOverride.id : 'ovr-' + Date.now(),
				doctor_id: item.doctor.id,
				polyclinic_id: item.polyclinic.id,
				schedule_date: todayDateStr,
				status_code: newStatusCode,
				custom_message: existingMsg || defaultMsg
			});
			loadAllData();

			const labelMap: Record<string, string> = {
				OPEN: 'BUKA (Sedang Praktik)',
				BREAK: 'ISTIRAHAT',
				CLOSED: 'TUTUP (Selesai Praktik)',
				HOLIDAY: 'LIBUR (Cuti / Izin)',
				CANCELLED: 'DIBATALKAN'
			};
			showQuickAlert(`Status ${docName} (${poliName}) berhasil diubah menjadi "${labelMap[newStatusCode] || newStatusCode}".`, 'success');
		}
	}

	function openQuickOverrideModal(doc: Doctor, poli: Polyclinic, defaultStatus: 'OPEN' | 'BREAK' | 'CLOSED' | 'HOLIDAY' = 'HOLIDAY') {
		targetDoctor = doc;
		targetPoli = poli;
		overrideStatusChoice = defaultStatus;
		overrideNote = defaultStatus === 'HOLIDAY' ? 'Cuti / Izin' : '';
		isOverrideModalOpen = true;
	}

	function handleSaveOverride() {
		if (!targetDoctor || !targetPoli) return;

		DataRepository.addOrUpdateOverride({
			id: 'ovr-' + Date.now(),
			doctor_id: targetDoctor.id,
			polyclinic_id: targetPoli.id,
			schedule_date: todayDateStr,
			status_code: overrideStatusChoice,
			custom_message: overrideNote.trim() || undefined
		});

		isOverrideModalOpen = false;
		loadAllData();
		showQuickAlert(`Catatan status untuk ${targetDoctor.full_name} berhasil disimpan.`, 'success');
	}

	function handleResetOverride(docId: string, poliId: string) {
		DataRepository.deleteOverrideForDoctorAndDate(docId, poliId, todayDateStr);
		loadAllData();
		showQuickAlert(`Status dokter dikembalikan ke Otomatis (Ikuti Jam Jadwal).`, 'info');
	}

	// --- Dokter CRUD Actions ---
	let isUploadingDoctorPhoto = $state(false);
	let docPhotoSuccessAlert = $state('');

	async function handleDoctorPhotoUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isUploadingDoctorPhoto = true;
		docPhotoSuccessAlert = '';
		docError = '';

		try {
			if (isSupabaseConfigured()) {
				const { uploadToSupabaseStorage } = await import('$lib/supabase/client');
				const result = await uploadToSupabaseStorage('doctors', file);
				if (result.success && result.url) {
					docPhoto = result.url;
					docPhotoSuccessAlert = `Foto "${file.name}" berhasil diunggah ke Supabase Storage!`;
				} else {
					// Fallback otomatis ke penyimpanan lokal server jika bucket Supabase belum ada
					const fd = new FormData();
					fd.append('file', file);
					fd.append('folder', 'doctors');
					const res = await fetch('/api/upload', { method: 'POST', body: fd });
					const data = await res.json();
					if (data.success && data.url) {
						docPhoto = data.url;
						docPhotoSuccessAlert = `Foto "${file.name}" berhasil disimpan ke server lokal!`;
					} else {
						docError = data.message || result.message || 'Gagal mengunggah foto dokter.';
					}
				}
			} else {
				const fd = new FormData();
				fd.append('file', file);
				fd.append('folder', 'doctors');
				const res = await fetch('/api/upload', { method: 'POST', body: fd });
				const data = await res.json();
				if (data.success && data.url) {
					docPhoto = data.url;
					docPhotoSuccessAlert = `Foto "${file.name}" berhasil diunggah dan disimpan ke server!`;
				} else {
					docError = data.message || 'Gagal mengunggah foto dokter.';
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			docError = `Gagal mengunggah foto dokter: ${msg}`;
		} finally {
			isUploadingDoctorPhoto = false;
		}
	}

	function openAddDoctorModal() {
		isEditingDoctor = false;
		docId = '';
		docName = '';
		docTitle = '';
		docPhoto = '';
		docPoliId = polyclinics.length > 0 ? polyclinics[0].id : '';
		docPhotoSuccessAlert = '';
		isUploadingDoctorPhoto = false;
		docIsActive = true;
		docError = '';
		isDoctorModalOpen = true;
	}

	function openEditDoctorModal(doc: Doctor) {
		isEditingDoctor = true;
		docId = doc.id;
		docName = doc.full_name;
		docTitle = doc.title || '';
		docPhoto = doc.photo_url || '';
		docPoliId = doc.polyclinic_id || getDoctorPoliId(doc) || (polyclinics.length > 0 ? polyclinics[0].id : '');
		docPhotoSuccessAlert = '';
		isUploadingDoctorPhoto = false;
		docIsActive = doc.is_active;
		docError = '';
		isDoctorModalOpen = true;
	}

	function handleSaveDoctor() {
		if (!docName.trim()) {
			docError = 'Nama lengkap dokter wajib diisi';
			return;
		}

		if (isEditingDoctor && docId) {
			const currentDoc = doctors.find((d) => d.id === docId);
			const currentPoli = currentDoc?.polyclinic_id;
			const poliChanged = docPoliId && currentPoli && currentPoli !== docPoliId;
			const targetOrder = poliChanged
				? DataRepository.getNextDoctorOrder(docPoliId)
				: (currentDoc?.display_order || 1);

			DataRepository.updateDoctor(docId, {
				full_name: docName.trim(),
				title: docTitle.trim(),
				photo_url: docPhoto.trim(),
				polyclinic_id: docPoliId || undefined,
				display_order: targetOrder,
				is_active: docIsActive
			});

			if (poliChanged && currentPoli) {
				DataRepository.normalizeDoctorOrdersInPoli(currentPoli);
			}
			if (docPoliId) {
				DataRepository.normalizeDoctorOrdersInPoli(docPoliId);
			}
		} else {
			const targetOrder = docPoliId ? DataRepository.getNextDoctorOrder(docPoliId) : (doctors.length + 1);
			DataRepository.createDoctor({
				full_name: docName.trim(),
				title: docTitle.trim(),
				photo_url: docPhoto.trim(),
				polyclinic_id: docPoliId || undefined,
				display_order: targetOrder,
				is_active: docIsActive
			});
		}

		isDoctorModalOpen = false;
		loadAllData();
	}

	function handleMovePolyclinic(poliId: string, direction: 'up' | 'down') {
		const success = DataRepository.movePolyclinicOrder(poliId, direction);
		if (success) {
			loadAllData();
			const p = polyclinics.find((item) => item.id === poliId);
			if (p) {
				showQuickAlert(`Urutan Poliklinik ${p.name} berhasil diubah. Tampilan Kiosk otomatis diperbarui.`, 'success');
			}
		}
	}

	function handleMoveDoctor(doc: Doctor, direction: 'up' | 'down') {
		const oldPoliId = doc.polyclinic_id || getDoctorPoliId(doc);
		const success = DataRepository.moveDoctorOrder(doc.id, direction, true);
		if (success) {
			loadAllData();
			const updatedDoc = DataRepository.getDoctorById(doc.id);
			const newPoliId = updatedDoc ? (updatedDoc.polyclinic_id || getDoctorPoliId(updatedDoc)) : oldPoliId;
			if (newPoliId !== oldPoliId) {
				const targetPoli = polyclinics.find((p) => p.id === newPoliId);
				showQuickAlert(
					`Dokter ${doc.full_name} berhasil dipindahkan ke Poliklinik ${targetPoli ? targetPoli.name : 'baru'}.`,
					'info'
				);
			}
		}
	}

	function handleToggleDoctorStatus(doc: Doctor) {
		DataRepository.updateDoctor(doc.id, {
			is_active: !doc.is_active
		});
		loadAllData();
	}

	function promptDeleteDoctor(doc: Doctor) {
		deleteType = 'doctor';
		deleteTargetId = doc.id;
		deleteTargetLabel = doc.full_name;
		isDeleteConfirmOpen = true;
	}

	function handleScheduleDoctorSelect() {
		const doc = doctors.find((d) => d.id === schDoctorId);
		if (doc) {
			const pId = doc.polyclinic_id || getDoctorPoliId(doc);
			if (pId) {
				schPoliId = pId;
			}
		}
	}

	// --- Jadwal Mingguan CRUD Actions ---
	function toggleSchDay(day: number) {
		if (schSelectedDays.includes(day)) {
			if (schSelectedDays.length > 1) {
				schSelectedDays = schSelectedDays.filter((d) => d !== day);
			}
		} else {
			schSelectedDays = [...schSelectedDays, day].sort((a, b) => a - b);
		}
	}

	function selectWeekdays() {
		schSelectedDays = [1, 2, 3, 4, 5];
	}

	function selectAllDays() {
		schSelectedDays = [1, 2, 3, 4, 5, 6, 7];
	}

	function resetSchDays() {
		schSelectedDays = [dayOfWeekToday || 1];
	}

	function openAddScheduleModal() {
		isEditingSchedule = false;
		schId = '';
		schDoctorId = doctors.length > 0 ? doctors[0].id : '';
		const initialDoc = doctors.find((d) => d.id === schDoctorId);
		schPoliId = initialDoc?.polyclinic_id || (polyclinics.length > 0 ? polyclinics[0].id : '');
		schDayOfWeek = dayOfWeekToday || 1;
		schSelectedDays = [dayOfWeekToday || 1];
		schStartTime = '08:00';
		schEndTime = '14:00';
		schIsActive = true;
		schError = '';
		isScheduleModalOpen = true;
	}

	function openEditScheduleModal(sch: WeeklySchedule) {
		isEditingSchedule = true;
		schId = sch.id;
		schDoctorId = sch.doctor_id;
		schPoliId = sch.polyclinic_id;
		schDayOfWeek = sch.day_of_week;
		schSelectedDays = [sch.day_of_week];
		schStartTime = sch.start_time.slice(0, 5);
		schEndTime = sch.end_time.slice(0, 5);
		schIsActive = sch.is_active;
		schError = '';
		isScheduleModalOpen = true;
	}

	function handleSaveSchedule() {
		if (!schDoctorId) {
			schError = 'Silakan pilih dokter terlebih dahulu';
			return;
		}
		if (!schPoliId) {
			schError = 'Silakan pilih poliklinik terlebih dahulu';
			return;
		}
		if (!schStartTime || !schEndTime) {
			schError = 'Jam mulai dan jam selesai wajib diisi';
			return;
		}

		const fmtStart = schStartTime.length === 5 ? schStartTime + ':00' : schStartTime;
		const fmtEnd = schEndTime.length === 5 ? schEndTime + ':00' : schEndTime;

		const targetDoc = doctors.find((d) => d.id === schDoctorId);
		const docName = targetDoc ? targetDoc.full_name : 'Dokter';

		if (isEditingSchedule && schId) {
			DataRepository.saveWeeklySchedule({
				id: schId,
				doctor_id: schDoctorId,
				polyclinic_id: schPoliId,
				day_of_week: Number(schDayOfWeek),
				start_time: fmtStart,
				end_time: fmtEnd,
				is_active: schIsActive
			});
			showQuickAlert(`Jadwal praktik ${docName} hari ${dayNames[schDayOfWeek]} berhasil diperbarui.`, 'success');
		} else {
			// Multi-hari sekaligus saat menambah jadwal baru
			if (schSelectedDays.length === 0) {
				schError = 'Pilih minimal satu hari praktik dokter';
				return;
			}

			const allSchedules = DataRepository.getAllWeeklySchedules();
			const savedDayNames: string[] = [];

			for (const day of schSelectedDays) {
				// Cek apakah dokter sudah memiliki jadwal di hari dan poli yang sama
				const existing = allSchedules.find(
					(s) => s.doctor_id === schDoctorId && s.polyclinic_id === schPoliId && s.day_of_week === day
				);

				if (existing) {
					DataRepository.saveWeeklySchedule({
						...existing,
						start_time: fmtStart,
						end_time: fmtEnd,
						is_active: schIsActive
					});
				} else {
					DataRepository.createWeeklySchedule({
						doctor_id: schDoctorId,
						polyclinic_id: schPoliId,
						day_of_week: day,
						start_time: fmtStart,
						end_time: fmtEnd,
						is_active: schIsActive
					});
				}
				savedDayNames.push(dayNames[day]);
			}

			showQuickAlert(`Berhasil menambahkan ${schSelectedDays.length} slot jadwal untuk ${docName} (${savedDayNames.join(', ')}).`, 'success');
		}

		isScheduleModalOpen = false;
		loadAllData();
	}

	function handleToggleScheduleStatus(sch: WeeklySchedule) {
		DataRepository.saveWeeklySchedule({
			...sch,
			is_active: !sch.is_active
		});
		loadAllData();
	}

	function promptDeleteSchedule(sch: WeeklySchedule) {
		const doc = doctors.find((d) => d.id === sch.doctor_id);
		deleteType = 'schedule';
		deleteTargetId = sch.id;
		deleteTargetLabel = `${doc ? doc.full_name : 'Jadwal'} (${dayNames[sch.day_of_week]}, ${sch.start_time.slice(0,5)} - ${sch.end_time.slice(0,5)})`;
		isDeleteConfirmOpen = true;
	}

	async function confirmDeleteAction() {
		if (deleteType === 'doctor') {
			const targetDoc = doctors.find((d) => d.id === deleteTargetId);
			if (targetDoc?.photo_url && targetDoc.photo_url.includes('/uploads/')) {
				try {
					await fetch('/api/upload', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: targetDoc.photo_url })
					});
				} catch (err) {
					console.warn('Gagal menghapus file foto fisik dokter:', err);
				}
			}
			DataRepository.deleteDoctor(deleteTargetId);
		} else {
			DataRepository.deleteWeeklySchedule(deleteTargetId);
		}
		isDeleteConfirmOpen = false;
		loadAllData();
	}
</script>

<svelte:head>
	<title>Dokter & Jadwal - CMS RSUD</title>
</svelte:head>

<div class="page-shell">
	<!-- Topbar Header Section -->
	<div class="page-header">
		<div class="header-titles">
			<div class="title-row">
				<div class="badge-icon">
					<UserCheck size={24} />
				</div>
				<div>
					<h1 class="main-title">Dokter & Jadwal Praktik</h1>
					<p class="subtitle">Pusat kontrol jadwal dokter spesialis, jadwal mingguan, dan override status harian.</p>
				</div>
			</div>
		</div>

		{#if activeTab === 'doctors'}
			<button type="button" class="btn-primary" onclick={openAddDoctorModal}>
				<Plus size={18} />
				<span>Tambah Dokter Baru</span>
			</button>
		{:else if activeTab === 'schedules'}
			<button type="button" class="btn-primary" onclick={openAddScheduleModal}>
				<Plus size={18} />
				<span>Tambah Slot Jadwal</span>
			</button>
		{/if}
	</div>

	<!-- Navigation Tabs Switcher (3 Sub Menu Elegan) -->
	<div class="tab-navigation">
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'status'}
			onclick={() => (activeTab = 'status')}
		>
			<Clock size={18} />
			<span>Status Praktik Hari Ini</span>
			<span class="tab-badge-active">{todayDoctorSchedules.length} Dokter</span>
		</button>

		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'doctors'}
			onclick={() => (activeTab = 'doctors')}
		>
			<UserCheck size={18} />
			<span>Master Data Dokter</span>
			<span class="tab-counter">{doctors.length}</span>
		</button>

		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'schedules'}
			onclick={() => (activeTab = 'schedules')}
		>
			<Calendar size={18} />
			<span>Jadwal Mingguan (Senin–Minggu)</span>
			<span class="tab-counter">{weeklySchedules.length}</span>
		</button>
	</div>

	<!-- TAB 1: STATUS PRAKTIK HARI INI (QUICK OVERRIDE) -->
	{#if activeTab === 'status'}
		<div class="today-banner">
			<div class="today-info">
				<span class="today-tag">HARI INI (WITA)</span>
				<h2 class="today-heading">{todayFormatted}</h2>
				<p class="today-desc">
					Pusat pemantauan status dokter spesialis di seluruh poliklinik yang terhubung ke Kiosk. Gunakan kontrol cepat di bawah untuk mengubah status praktik dokter jika dokter <strong>Cuti</strong>, <strong>Istirahat</strong>, atau <strong>Buka / Praktik Pengganti</strong>.
				</p>
			</div>
			<button type="button" class="refresh-btn" onclick={() => loadAllData(true)} title="Segarkan status dari disk dan database" disabled={isRefreshing}>
				<RefreshCw size={16} class={isRefreshing ? 'spin-icon' : ''} />
				<span>{isRefreshing ? 'Menyinkron...' : 'Refresh Status'}</span>
			</button>
		</div>

		{#if quickStatusAlert}
			<div class="quick-status-alert-banner alert-{quickStatusAlert.type}">
				<div class="alert-content">
					{#if quickStatusAlert.type === 'success'}
						<CheckCircle2 size={18} />
					{:else}
						<RefreshCw size={18} />
					{/if}
					<span>{quickStatusAlert.message}</span>
				</div>
				<button type="button" class="alert-close-btn" onclick={() => (quickStatusAlert = null)} aria-label="Tutup notifikasi">
					<X size={16} />
				</button>
			</div>
		{/if}

		<div class="today-filter-toolbar">
			<div class="filter-group">
				<label for="filter-today-poli" class="filter-label">Filter Poliklinik:</label>
				<select id="filter-today-poli" bind:value={filterTodayPoli} class="filter-select">
					<option value="all">Semua Poliklinik ({polyclinics.length})</option>
					{#each polyclinics as poli}
						<option value={poli.id}>{poli.name} ({poli.code})</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="filter-today-sched" class="filter-label">Tipe Tampilan:</label>
				<select id="filter-today-sched" bind:value={filterTodayScheduleType} class="filter-select">
					<option value="all">Semua Dokter Poliklinik (Sinkron Kiosk)</option>
					<option value="scheduled_today">Hanya Yang Terjadwal Hari Ini ({dayNames[dayOfWeekToday]})</option>
					<option value="open_only">Hanya Yang Buka Praktik</option>
				</select>
			</div>

			<div class="group-stats-info">
				<span>Menampilkan <strong>{todayDoctorSchedulesGrouped.reduce((acc, g) => acc + g.items.length, 0)}</strong> dokter ({todayDoctorSchedules.filter(it => it.evaluation.status.type === 'open').length} buka saat ini)</span>
			</div>
		</div>

		<div class="table-card">
			<div class="table-responsive">
				<table class="data-table">
					<thead>
						<tr>
							<th>Dokter Spesialis</th>
							<th>Poliklinik</th>
							<th style="width: 170px;">Jam Jadwal</th>
							<th style="width: 180px;">Status Live Kiosk</th>
							<th style="width: 150px;">Keterangan</th>
							<th style="width: 290px; text-align: right;">Aksi Cepat Petugas</th>
						</tr>
					</thead>
					<tbody>
						{#if todayDoctorSchedulesGrouped.length === 0}
							<tr>
								<td colspan="6" class="empty-row">
									<p>Tidak ada dokter yang memenuhi kriteria filter poliklinik atau tipe tampilan yang dipilih.</p>
								</td>
							</tr>
						{:else}
							{#each todayDoctorSchedulesGrouped as group (group.polyclinic.id)}
								{@const GroupIcon = getPolyclinicIconComponent(group.polyclinic.icon)}
								<tr class="poli-group-row">
									<td colspan="6">
										<div class="poli-group-header">
											<div class="group-left">
												{#if group.polyclinic.display_order && group.polyclinic.id !== 'other' && group.polyclinic.id !== 'unassigned'}
													<span class="group-order-badge" title="Urutan #{group.polyclinic.display_order}">
														{group.polyclinic.display_order}
													</span>
												{/if}
												<div class="group-icon-thumb" aria-hidden="true">
													<GroupIcon size={16} />
												</div>
												<strong class="group-title">{group.polyclinic.name} ({group.polyclinic.code})</strong>
											</div>
											<span class="group-badge">{group.items.length} Dokter Terdaftar</span>
										</div>
									</td>
								</tr>
								{#each group.items as item (item.id)}
									<tr>
										<td>
											<div class="doc-identity">
												<div class="doc-avatar">
													{#if item.doctor.photo_url}
														<img src={item.doctor.photo_url} alt={item.doctor.full_name} class="avatar-img" />
													{:else}
														<span>{item.doctor.full_name.slice(0, 2).toUpperCase()}</span>
													{/if}
												</div>
												<div>
													<strong class="doc-name">{item.doctor.full_name}</strong>
													<span class="doc-spec">{item.doctor.title || 'Spesialis'}</span>
												</div>
											</div>
										</td>
										<td>
											<span class="poli-badge">{item.polyclinic.name}</span>
										</td>
										<td>
											{#if item.todaySchedule}
												<span class="time-badge scheduled-today" title="Jadwal Praktik Hari Ini ({dayNames[dayOfWeekToday]})">
													<Clock size={13} />
													{item.todaySchedule.start_time.slice(0, 5)} - {item.todaySchedule.end_time.slice(0, 5)}
												</span>
											{:else if item.allSchedules.length > 0}
												<span class="time-badge off-schedule" title={item.allSchedules.map(s => `${dayNames[s.day_of_week]}: ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`).join(', ')}>
													<Calendar size={13} />
													{item.allSchedules.map(s => dayNames[s.day_of_week].slice(0, 3)).join(', ')} • {item.allSchedules[0].start_time.slice(0, 5)}-{item.allSchedules[0].end_time.slice(0, 5)}
												</span>
											{:else}
												<span class="time-badge unassigned-badge">
													Belum Ada Jadwal
												</span>
											{/if}
										</td>
										<td>
											<div class="status-indicator status-{item.evaluation.status.type}">
												<span class="status-dot"></span>
												<span class="status-text">{item.evaluation.status.label}</span>
											</div>
										</td>
										<td>
											{#if item.activeOverride}
												<span class="override-pill" title={item.activeOverride.custom_message || 'Manual Override'}>
													Manual Override
													{#if item.activeOverride.custom_message}
														<span class="note-tooltip">({item.activeOverride.custom_message})</span>
													{/if}
												</span>
											{:else if item.todaySchedule}
												<span class="auto-pill">Otomatis (Jadwal Hari Ini)</span>
											{:else}
												<span class="auto-pill off-schedule-pill">Di Luar Jadwal Reguler</span>
											{/if}
										</td>
										<td style="text-align: right;">
											<div class="quick-select-wrap">
												<select
													class="quick-status-dropdown status-val-{item.activeOverride ? item.activeOverride.status_code.toLowerCase() : 'auto'}"
													value={item.activeOverride ? item.activeOverride.status_code : 'AUTO'}
													onchange={(e) => handleQuickStatusSelect(item, (e.target as HTMLSelectElement).value)}
													title="Pilih status cepat untuk dokter ini"
												>
													<option value="AUTO">⚡ Otomatis ({item.todaySchedule ? 'Ikuti Jam Jadwal' : 'Di Luar Jadwal'})</option>
													<option value="OPEN">🟢 BUKA (Sedang Praktik)</option>
													<option value="BREAK">🟡 ISTIRAHAT</option>
													<option value="CLOSED">⚪ TUTUP (Selesai Praktik)</option>
													<option value="HOLIDAY">🔴 LIBUR (Cuti / Izin)</option>
													<option value="CANCELLED">❌ DIBATALKAN</option>
												</select>
												<button
													type="button"
													class="btn-note-edit"
													onclick={() => openQuickOverrideModal(item.doctor, item.polyclinic, (item.activeOverride?.status_code as any) || 'HOLIDAY')}
													title="Beri Catatan / Alasan Khusus Kiosk"
												>
													<Edit3 size={15} />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

	<!-- TAB 2: MASTER DATA DOKTER -->
	{:else if activeTab === 'doctors'}
		<div class="toolbar-card">
			<div class="search-input-wrap">
				<Search size={18} class="search-icon" />
				<input
					type="text"
					bind:value={searchDoctorQuery}
					placeholder="Cari nama dokter atau gelar spesialis..."
					class="search-field"
				/>
				{#if searchDoctorQuery}
					<button type="button" class="clear-search-btn" onclick={() => (searchDoctorQuery = '')}>
						<X size={16} />
					</button>
				{/if}
			</div>

			<div class="toolbar-actions">
				<div class="filter-group">
					<label for="filter-doctor-poli" class="filter-label">Kategori Poli:</label>
					<select id="filter-doctor-poli" bind:value={filterDoctorPoli} class="filter-select">
						<option value="all">Semua Poliklinik ({polyclinics.length})</option>
						{#each polyclinics as poli}
							<option value={poli.id}>{poli.name} ({poli.code})</option>
						{/each}
					</select>
				</div>

				<div class="mode-toggle-group">
					<button
						type="button"
						class="mode-btn"
						class:active={doctorViewMode === 'grouped'}
						onclick={() => (doctorViewMode = 'grouped')}
						title="Kelompokkan tampilan berdasar menu Poliklinik"
					>
						Kelompok Poli
					</button>
					<button
						type="button"
						class="mode-btn"
						class:active={doctorViewMode === 'flat'}
						onclick={() => (doctorViewMode = 'flat')}
						title="Tampilkan semua dokter dalam daftar datar"
					>
						Daftar Semua
					</button>
				</div>
			</div>
		</div>

		<div class="table-card">
			<div class="table-responsive">
				<table class="data-table">
					<thead>
						<tr>
							<th style="width: 70px;">Urutan</th>
							<th>Dokter Spesialis</th>
							<th>Kategori Poliklinik</th>
							<th>Spesialisasi / Jabatan</th>
							<th style="width: 150px; text-align: center;">Status Kiosk</th>
							<th style="width: 130px; text-align: right;">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#if doctorViewMode === 'grouped'}
							{#if groupedDoctors().length === 0}
								<tr>
									<td colspan="6" class="empty-row">
										<p>Tidak ada data dokter yang sesuai dengan filter pencarian atau poliklinik.</p>
									</td>
								</tr>
							{:else}
								{#each groupedDoctors() as group, groupIdx (group.polyclinic.id)}
									{@const GroupIcon = getPolyclinicIconComponent(group.polyclinic.icon)}
									<tr class="poli-group-row">
										<td colspan="6">
											<div class="poli-group-header">
												<div class="group-left">
													{#if group.polyclinic.display_order && group.polyclinic.id !== 'other' && group.polyclinic.id !== 'unassigned'}
														<div class="order-control-wrap poli-order-wrap">
															<button
																type="button"
																class="btn-order-arrow btn-poli-arrow up"
																disabled={groupIdx === 0}
																onclick={() => handleMovePolyclinic(group.polyclinic.id, 'up')}
																title="Geser Urutan Poliklinik Naik di Layar Kiosk"
															>
																<ChevronUp size={12} />
															</button>
															<span class="group-order-badge" title="Urutan Poliklinik #{group.polyclinic.display_order}">
																{group.polyclinic.display_order}
															</span>
															<button
																type="button"
																class="btn-order-arrow btn-poli-arrow down"
																disabled={groupIdx === groupedDoctors().length - 1}
																onclick={() => handleMovePolyclinic(group.polyclinic.id, 'down')}
																title="Geser Urutan Poliklinik Turun di Layar Kiosk"
															>
																<ChevronDown size={12} />
															</button>
														</div>
													{/if}
													<div class="group-icon-thumb" aria-hidden="true">
														<GroupIcon size={16} />
													</div>
													<strong class="group-title">{group.polyclinic.name} ({group.polyclinic.code})</strong>
												</div>
												<span class="group-badge">{group.doctors.length} Dokter Terdaftar</span>
											</div>
										</td>
									</tr>
									{#each group.doctors as doc, docIdx (doc.id)}
										{@const isFirstInFirstPoli = groupIdx === 0 && docIdx === 0}
										{@const isLastInLastPoli = groupIdx === groupedDoctors().length - 1 && docIdx === group.doctors.length - 1}
										{@const prevPoliName = groupIdx > 0 ? groupedDoctors()[groupIdx - 1].polyclinic.name : ''}
										{@const nextPoliName = groupIdx < groupedDoctors().length - 1 ? groupedDoctors()[groupIdx + 1].polyclinic.name : ''}
										{@const upTitle = docIdx === 0 && prevPoliName ? `Pindahkan dokter naik ke Poliklinik ${prevPoliName}` : 'Geser Urutan Naik (Prioritas Lebih Tinggi)'}
										{@const downTitle = docIdx === group.doctors.length - 1 && nextPoliName ? `Pindahkan dokter turun ke Poliklinik ${nextPoliName}` : 'Geser Urutan Turun'}
										<tr class:row-disabled={!doc.is_active}>
											<td class="order-cell">
												<div class="order-control-wrap">
													<button
														type="button"
														class="btn-order-arrow up"
														class:cross-arrow={docIdx === 0 && !isFirstInFirstPoli}
														disabled={isFirstInFirstPoli}
														onclick={() => handleMoveDoctor(doc, 'up')}
														title={upTitle}
													>
														<ChevronUp size={13} />
													</button>
													<span class="order-badge" title="Urutan #{doc.display_order}">{doc.display_order}</span>
													<button
														type="button"
														class="btn-order-arrow down"
														class:cross-arrow={docIdx === group.doctors.length - 1 && !isLastInLastPoli}
														disabled={isLastInLastPoli}
														onclick={() => handleMoveDoctor(doc, 'down')}
														title={downTitle}
													>
														<ChevronDown size={13} />
													</button>
												</div>
											</td>
											<td>
												<div class="doc-identity">
													<div class="doc-avatar">
														{#if doc.photo_url}
															<img src={doc.photo_url} alt={doc.full_name} class="avatar-img" />
														{:else}
															<span>{doc.full_name.slice(0, 2).toUpperCase()}</span>
														{/if}
													</div>
													<div>
														<strong class="doc-name">{doc.full_name}</strong>
													</div>
												</div>
											</td>
											<td>
												<span class="poli-badge">{group.polyclinic.name}</span>
											</td>
											<td>
												<span class="spec-label">{doc.title || '-'}</span>
											</td>
											<td style="text-align: center;">
												<button
													type="button"
													class="toggle-badge"
													class:active={doc.is_active}
													onclick={() => handleToggleDoctorStatus(doc)}
													title={doc.is_active ? 'Klik untuk nonaktifkan dokter' : 'Klik untuk aktifkan dokter'}
												>
													{#if doc.is_active}
														<Check size={14} />
														<span>Aktif</span>
													{:else}
														<X size={14} />
														<span>Nonaktif</span>
													{/if}
												</button>
											</td>
											<td style="text-align: right;">
												<div class="action-buttons">
													<button
														type="button"
														class="action-icon-btn edit-btn"
														onclick={() => openEditDoctorModal(doc)}
														title="Edit Dokter"
													>
														<Edit3 size={16} />
													</button>
													<button
														type="button"
														class="action-icon-btn delete-btn"
														onclick={() => promptDeleteDoctor(doc)}
														title="Hapus Dokter"
													>
														<Trash2 size={16} />
													</button>
												</div>
											</td>
										</tr>
									{/each}
								{/each}
							{/if}
						{:else}
							{#if filteredDoctors.length === 0}
								<tr>
									<td colspan="6" class="empty-row">
										<p>Tidak ada data dokter yang sesuai dengan pencarian.</p>
									</td>
								</tr>
							{:else}
								{#each filteredDoctors as doc, docIdx (doc.id)}
									<tr class:row-disabled={!doc.is_active}>
										<td class="order-cell">
											<div class="order-control-wrap">
												<button
													type="button"
													class="btn-order-arrow up"
													disabled={docIdx === 0}
													onclick={() => handleMoveDoctor(doc, 'up')}
													title="Geser Urutan Naik (Prioritas Lebih Tinggi)"
												>
													<ChevronUp size={13} />
												</button>
												<span class="order-badge" title="Urutan #{doc.display_order}">{doc.display_order}</span>
												<button
													type="button"
													class="btn-order-arrow down"
													disabled={docIdx === filteredDoctors.length - 1}
													onclick={() => handleMoveDoctor(doc, 'down')}
													title="Geser Urutan Turun"
												>
													<ChevronDown size={13} />
												</button>
											</div>
										</td>
										<td>
											<div class="doc-identity">
												<div class="doc-avatar">
													{#if doc.photo_url}
														<img src={doc.photo_url} alt={doc.full_name} class="avatar-img" />
													{:else}
														<span>{doc.full_name.slice(0, 2).toUpperCase()}</span>
													{/if}
												</div>
												<div>
													<strong class="doc-name">{doc.full_name}</strong>
												</div>
											</div>
										</td>
										<td>
											<span class="poli-badge">{getPoliName(doc.polyclinic_id || getDoctorPoliId(doc))}</span>
										</td>
										<td>
											<span class="spec-label">{doc.title || '-'}</span>
										</td>
										<td style="text-align: center;">
											<button
												type="button"
												class="toggle-badge"
												class:active={doc.is_active}
												onclick={() => handleToggleDoctorStatus(doc)}
												title={doc.is_active ? 'Klik untuk nonaktifkan dokter' : 'Klik untuk aktifkan dokter'}
											>
												{#if doc.is_active}
													<Check size={14} />
													<span>Aktif</span>
												{:else}
													<X size={14} />
													<span>Nonaktif</span>
												{/if}
											</button>
										</td>
										<td style="text-align: right;">
											<div class="action-buttons">
												<button
													type="button"
													class="action-icon-btn edit-btn"
													onclick={() => openEditDoctorModal(doc)}
													title="Edit Dokter"
												>
													<Edit3 size={16} />
												</button>
												<button
													type="button"
													class="action-icon-btn delete-btn"
													onclick={() => promptDeleteDoctor(doc)}
													title="Hapus Dokter"
												>
													<Trash2 size={16} />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

	<!-- TAB 3: JADWAL MINGGUAN (SENIN-MINGGU) -->
	{:else if activeTab === 'schedules'}
		<div class="toolbar-card filter-toolbar schedule-filter-toolbar">
			<div class="filters-wrap">
				<!-- Filter Poliklinik -->
				<div class="filter-group">
					<label for="filter-sch-poli">Poliklinik:</label>
					<select id="filter-sch-poli" bind:value={filterSchedulePoli} class="filter-select">
						<option value="all">Semua Poliklinik ({polyclinics.length})</option>
						{#each polyclinics as poli}
							<option value={poli.id}>{poli.name}</option>
						{/each}
					</select>
				</div>

				<!-- Filter Hari Praktik (Senin–Minggu) -->
				<div class="filter-group">
					<label for="filter-sch-day">Hari Praktik:</label>
					<select id="filter-sch-day" bind:value={filterScheduleDay} class="filter-select">
						<option value="all">Semua Hari (Senin–Minggu)</option>
						<option value={1}>Senin</option>
						<option value={2}>Selasa</option>
						<option value={3}>Rabu</option>
						<option value={4}>Kamis</option>
						<option value={5}>Jumat</option>
						<option value={6}>Sabtu</option>
						<option value={7}>Minggu</option>
					</select>
				</div>

				<!-- Mode Urutan -->
				<div class="filter-group">
					<label for="filter-sch-sort">Urutan Tampilan:</label>
					<select id="filter-sch-sort" bind:value={scheduleSortMode} class="filter-select">
						<option value="doctor">Urut: Dokter (#1..N) → Hari (Senin–Minggu)</option>
						<option value="day">Urut: Hari (Senin–Minggu) → Dokter (#1..N)</option>
					</select>
				</div>

				<!-- Pencarian Dokter -->
				<div class="filter-group">
					<label for="search-sch-doc">Cari Dokter:</label>
					<input
						id="search-sch-doc"
						type="text"
						bind:value={searchScheduleQuery}
						placeholder="Ketik nama dokter..."
						class="filter-search-input"
					/>
				</div>
			</div>

			<span class="total-schedules-tag">{filteredSchedules.length} Jadwal Terdaftar</span>
		</div>

		<div class="table-card">
			<div class="table-responsive">
				<table class="data-table">
					<thead>
						<tr>
							<th style="width: 140px;">Hari Praktik</th>
							<th>Dokter Spesialis</th>
							<th>Poliklinik</th>
							<th style="width: 170px;">Jam Layanan</th>
							<th style="width: 140px; text-align: center;">Status Jadwal</th>
							<th style="width: 130px; text-align: right;">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#if filteredSchedules.length === 0}
							<tr>
								<td colspan="6" class="empty-row">
									<p>Tidak ada jadwal dokter yang cocok dengan filter yang dipilih.</p>
								</td>
							</tr>
						{:else}
							{#each filteredSchedules as sch (sch.id)}
								{@const doc = doctors.find((d) => d.id === sch.doctor_id)}
								{@const poli = polyclinics.find((p) => p.id === sch.polyclinic_id)}
								<tr class:row-disabled={!sch.is_active}>
									<td>
										<span class="day-chip" class:today-chip={sch.day_of_week === dayOfWeekToday}>
											{dayNames[sch.day_of_week] || `Hari ${sch.day_of_week}`}
											{#if sch.day_of_week === dayOfWeekToday}
												<span class="today-marker">(Hari Ini)</span>
											{/if}
										</span>
									</td>
									<td>
										<div class="doc-cell-content">
											{#if doc?.display_order}
												<span class="doc-order-chip" title="Nomor Urut Dokter #{doc.display_order}">
													#{doc.display_order}
												</span>
											{/if}
											<div>
												<strong class="doc-title-table">{doc ? doc.full_name : 'Dokter ID: ' + sch.doctor_id}</strong>
												{#if doc?.title}
													<span class="doc-spec-sub">{doc.title}</span>
												{/if}
											</div>
										</div>
									</td>
									<td>
										<span class="poli-badge">{poli ? poli.name : '-'}</span>
									</td>
									<td>
										<span class="time-badge">
											<Clock size={14} />
											{sch.start_time.slice(0, 5)} - {sch.end_time.slice(0, 5)} WITA
										</span>
									</td>
									<td style="text-align: center;">
										<button
											type="button"
											class="toggle-badge"
											class:active={sch.is_active}
											onclick={() => handleToggleScheduleStatus(sch)}
										>
											{#if sch.is_active}
												<Check size={14} />
												<span>Aktif</span>
											{:else}
												<X size={14} />
												<span>Nonaktif</span>
											{/if}
										</button>
									</td>
									<td style="text-align: right;">
										<div class="action-buttons">
											<button
												type="button"
												class="action-icon-btn edit-btn"
												onclick={() => openEditScheduleModal(sch)}
												title="Edit Slot Jadwal"
											>
												<Edit3 size={16} />
											</button>
											<button
												type="button"
												class="action-icon-btn delete-btn"
												onclick={() => promptDeleteSchedule(sch)}
												title="Hapus Slot Jadwal"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Quick Override Status Hari Ini -->
{#if isOverrideModalOpen && targetDoctor && targetPoli}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container">
			<div class="modal-head">
				<h3>Override Status Dokter Hari Ini</h3>
				<button type="button" class="close-modal-btn" onclick={() => (isOverrideModalOpen = false)}>
					<X size={20} />
				</button>
			</div>

			<div class="modal-form-body">
				<div class="target-card">
					<strong class="target-name">{targetDoctor.full_name}</strong>
					<span class="target-sub">{targetPoli.name} • Tanggal: {todayFormatted}</span>
				</div>

				<div class="form-field">
					<label for="override-status">Pilih Status Override *</label>
					<div class="status-options-grid">
						<button
							type="button"
							class="status-choice-btn status-buka"
							class:selected={overrideStatusChoice === 'OPEN'}
							onclick={() => (overrideStatusChoice = 'OPEN')}
						>
							<CheckCircle2 size={18} />
							<span>BUKA (Sedang Praktik)</span>
						</button>
						<button
							type="button"
							class="status-choice-btn status-istirahat"
							class:selected={overrideStatusChoice === 'BREAK'}
							onclick={() => (overrideStatusChoice = 'BREAK')}
						>
							<Coffee size={18} />
							<span>ISTIRAHAT</span>
						</button>
						<button
							type="button"
							class="status-choice-btn status-tutup"
							class:selected={overrideStatusChoice === 'CLOSED'}
							onclick={() => (overrideStatusChoice = 'CLOSED')}
						>
							<XCircle size={18} />
							<span>TUTUP (Selesai Praktik)</span>
						</button>
						<button
							type="button"
							class="status-choice-btn status-libur"
							class:selected={overrideStatusChoice === 'HOLIDAY'}
							onclick={() => (overrideStatusChoice = 'HOLIDAY')}
						>
							<Ban size={18} />
							<span>LIBUR (Cuti / Izin Dokter)</span>
						</button>
					</div>
				</div>

				<div class="form-field">
					<label for="override-note">Catatan / Alasan (Ditampilkan di Kiosk, opsional)</label>
					<input
						id="override-note"
						type="text"
						bind:value={overrideNote}
						placeholder="Contoh: Cuti Seminar, Istirahat Siang, Operasi Darurat..."
						class="form-input"
					/>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (isOverrideModalOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-save" onclick={handleSaveOverride}>
					Terapkan Override
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Tambah / Edit Dokter -->
{#if isDoctorModalOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container">
			<div class="modal-head">
				<h3>{isEditingDoctor ? 'Edit Data Dokter' : 'Tambah Dokter Baru'}</h3>
				<button type="button" class="close-modal-btn" onclick={() => (isDoctorModalOpen = false)}>
					<X size={20} />
				</button>
			</div>

			{#if docError}
				<div class="form-error-alert">
					<AlertTriangle size={16} />
					<span>{docError}</span>
				</div>
			{/if}

			<div class="modal-form-body">
				<div class="form-field">
					<label for="doc-name">Nama Lengkap & Gelar Dokter *</label>
					<input
						id="doc-name"
						type="text"
						bind:value={docName}
						placeholder="Contoh: dr. Deni Syamsuddin, Sp.JP"
						class="form-input"
					/>
				</div>

				<div class="form-field">
					<label for="doc-title">Spesialisasi / Keahlian / Jabatan</label>
					<input
						id="doc-title"
						type="text"
						bind:value={docTitle}
						placeholder="Contoh: Spesialis Jantung & Pembuluh Darah"
						class="form-input"
					/>
				</div>

				<div class="form-field">
					<label for="doc-poli">Poliklinik Penugasan / Kategori Poliklinik *</label>
					<select
						id="doc-poli"
						bind:value={docPoliId}
						class="form-select"
					>
						<option value="">-- Pilih Poliklinik --</option>
						{#each polyclinics as poli}
							<option value={poli.id}>{poli.name} ({poli.code})</option>
						{/each}
					</select>
					<span class="form-hint">Dokter akan otomatis dikelompokkan ke poliklinik ini di master data dan realtime status.</span>
				</div>

				<div class="form-field">
					<label for="doc-photo-upload">Foto Dokter Spesialis</label>
					<div class="photo-upload-container">
						{#if docPhoto}
							<div class="photo-preview-wrap">
								<img src={docPhoto} alt="Pratinjau Foto Dokter" class="photo-preview-img" />
								<button
									type="button"
									class="remove-photo-btn"
									onclick={() => { docPhoto = ''; docPhotoSuccessAlert = ''; }}
									title="Hapus foto"
								>
									<X size={14} />
								</button>
							</div>
						{/if}

						<div class="photo-upload-actions">
							<label class="btn-upload-photo">
								<Upload size={15} />
								<span>Unggah Berkas Foto</span>
								<input
									id="doc-photo-upload"
									type="file"
									accept="image/*"
									onchange={handleDoctorPhotoUpload}
									class="hidden-file-input"
								/>
							</label>

							<span class="or-separator">atau isi link URL gambar:</span>
							<input
								id="doc-photo"
								type="url"
								bind:value={docPhoto}
								placeholder="https://... atau /uploads/doctors/foto.jpg"
								class="form-input"
							/>
						</div>
					</div>

					{#if isUploadingDoctorPhoto}
						<div class="upload-loading-badge">
							<span class="upload-spinner"></span>
							<span>Sedang mengunggah foto dokter ke server fisik...</span>
						</div>
					{/if}

					{#if docPhotoSuccessAlert}
						<div class="upload-success-alert">
							<Check size={16} />
							<span>{docPhotoSuccessAlert}</span>
						</div>
					{/if}
				</div>

				<div class="checkbox-row">
					<label class="custom-checkbox">
						<input type="checkbox" bind:checked={docIsActive} />
						<span class="checkmark"></span>
						<span class="label-text">Aktifkan dokter ini dalam sistem Kiosk</span>
					</label>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (isDoctorModalOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-save" onclick={handleSaveDoctor}>
					{isEditingDoctor ? 'Simpan Perubahan' : 'Simpan Dokter'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Tambah / Edit Slot Jadwal -->
{#if isScheduleModalOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container">
			<div class="modal-head">
				<h3>{isEditingSchedule ? 'Edit Slot Jadwal Praktik' : 'Tambah Slot Jadwal Praktik'}</h3>
				<button type="button" class="close-modal-btn" onclick={() => (isScheduleModalOpen = false)}>
					<X size={20} />
				</button>
			</div>

			{#if schError}
				<div class="form-error-alert">
					<AlertTriangle size={16} />
					<span>{schError}</span>
				</div>
			{/if}

			<div class="modal-form-body">
				<div class="form-field">
					<label for="sch-doctor">Pilih Dokter Spesialis *</label>
					<select id="sch-doctor" bind:value={schDoctorId} onchange={handleScheduleDoctorSelect} class="form-select">
						{#each polyclinics as poli}
							{@const poliDocs = doctors.filter((d) => (d.polyclinic_id || getDoctorPoliId(d)) === poli.id)}
							{#if poliDocs.length > 0}
								<optgroup label="POLIKLINIK {poli.name.toUpperCase()} ({poli.code})">
									{#each poliDocs as doc}
										<option value={doc.id}>{doc.full_name} ({doc.title || 'Dokter'})</option>
									{/each}
								</optgroup>
							{/if}
						{/each}
						{#if doctors.some((d) => !d.polyclinic_id && !getDoctorPoliId(d))}
							{@const unassignedDocs = doctors.filter((d) => !d.polyclinic_id && !getDoctorPoliId(d))}
							<optgroup label="LAINNYA / BELUM DITUGASKAN">
								{#each unassignedDocs as doc}
									<option value={doc.id}>{doc.full_name} ({doc.title || 'Dokter'})</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					<span class="form-hint">Memilih dokter otomatis menyesuaikan poliklinik penugasan dokter tersebut.</span>
				</div>

				<div class="form-field">
					<label for="sch-poli">Pilih Poliklinik *</label>
					<select id="sch-poli" bind:value={schPoliId} class="form-select">
						{#each polyclinics as poli}
							<option value={poli.id}>{poli.name} ({poli.code})</option>
						{/each}
					</select>
				</div>

				{#if isEditingSchedule}
					<div class="form-field">
						<label for="sch-day">Hari Praktik *</label>
						<select id="sch-day" bind:value={schDayOfWeek} class="form-select">
							{#each [1, 2, 3, 4, 5, 6, 7] as day}
								<option value={day}>Setiap {dayNames[day]}</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="form-field">
						<div class="field-label-row">
							<label for="multi-days-select">Pilih Hari Praktik Sekaligus *</label>
							<span class="days-selected-badge">{schSelectedDays.length} Hari Dipilih</span>
						</div>

						<!-- Tombol Pintas Pilihan Hari -->
						<div class="quick-days-presets">
							<button
								type="button"
								class="preset-day-btn"
								onclick={selectWeekdays}
								title="Pilih Senin sampai Jumat sekaligus"
							>
								Senin–Jumat (Hari Kerja)
							</button>
							<button
								type="button"
								class="preset-day-btn"
								onclick={selectAllDays}
								title="Pilih seluruh 7 hari seminggu"
							>
								Semua Hari (7 Hari)
							</button>
							<button
								type="button"
								class="preset-day-btn text-muted"
								onclick={resetSchDays}
								title="Pilih hari ini saja"
							>
								Hari Ini Saja
							</button>
						</div>

						<!-- Toggle Chips Hari -->
						<div class="days-chips-grid" id="multi-days-select">
							{#each [1, 2, 3, 4, 5, 6, 7] as day}
								{@const isSelected = schSelectedDays.includes(day)}
								<button
									type="button"
									class="day-chip-toggle"
									class:selected={isSelected}
									onclick={() => toggleSchDay(day)}
									aria-pressed={isSelected}
								>
									<span class="chip-check">{isSelected ? '✓' : '+'}</span>
									<span class="chip-name">{dayNames[day]}</span>
								</button>
							{/each}
						</div>
						<span class="form-hint">
							Pilih satu atau beberapa hari praktik sekaligus. Sistem akan otomatis membuat slot jadwal dengan jam yang sama untuk seluruh hari terpilih.
						</span>
					</div>
				{/if}

				<div class="form-grid-2">
					<div class="form-field">
						<label for="sch-start">Jam Mulai Praktik *</label>
						<input
							id="sch-start"
							type="time"
							bind:value={schStartTime}
							class="form-input"
						/>
					</div>

					<div class="form-field">
						<label for="sch-end">Jam Selesai Praktik *</label>
						<input
							id="sch-end"
							type="time"
							bind:value={schEndTime}
							class="form-input"
						/>
					</div>
				</div>

				<div class="checkbox-row">
					<label class="custom-checkbox">
						<input type="checkbox" bind:checked={schIsActive} />
						<span class="checkmark"></span>
						<span class="label-text">Jadwal ini aktif dan tampil pada siklus Kiosk</span>
					</label>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (isScheduleModalOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-save" onclick={handleSaveSchedule}>
					{isEditingSchedule ? 'Simpan Perubahan Jadwal' : 'Simpan Slot Jadwal'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Konfirmasi Hapus -->
{#if isDeleteConfirmOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container delete-dialog">
			<div class="delete-icon-wrap">
				<AlertTriangle size={32} />
			</div>
			<h3>Konfirmasi Hapus</h3>
			<p>
				Apakah Anda yakin ingin menghapus {deleteType === 'doctor' ? 'dokter' : 'jadwal'}: <strong>{deleteTargetLabel}</strong>?
			</p>

			<div class="modal-footer justify-center">
				<button type="button" class="btn-cancel" onclick={() => (isDeleteConfirmOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-delete-confirm" onclick={confirmDeleteAction}>
					Ya, Hapus
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page-shell {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		font-family: inherit;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.badge-icon {
		width: 48px;
		height: 48px;
		background: #E8F5E9;
		color: #0A5C36;
		border-radius: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.main-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #64748B;
		margin: 0.2rem 0 0 0;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #0A5C36;
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: #074327;
	}

	/* Tab Navigation */
	.tab-navigation {
		display: flex;
		gap: 0.5rem;
		background: #F1F5F9;
		padding: 0.35rem;
		border-radius: 0.85rem;
		border: 1px solid #E2E8F0;
		overflow-x: auto;
	}

	.tab-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 1.15rem;
		border-radius: 0.65rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #64748B;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.tab-item:hover {
		color: #0F172A;
	}

	.tab-item.active {
		background: white;
		color: #0A5C36;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}

	.tab-badge-active {
		background: #D1FAE5;
		color: #047857;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.725rem;
		font-weight: 800;
	}

	.tab-counter {
		background: #E2E8F0;
		color: #475569;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.725rem;
	}

	/* Today Banner */
	.today-banner {
		background: linear-gradient(135deg, #0A5C36 0%, #0F766E 100%);
		color: white;
		padding: 1.5rem;
		border-radius: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 8px 20px -4px rgba(10, 92, 54, 0.25);
		flex-wrap: wrap;
		gap: 1rem;
	}

	.today-tag {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		display: inline-block;
		margin-bottom: 0.4rem;
	}

	.today-heading {
		font-size: 1.4rem;
		font-weight: 850;
		margin: 0;
	}

	.today-desc {
		font-size: 0.85rem;
		opacity: 0.9;
		margin: 0.35rem 0 0 0;
	}

	.refresh-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.18);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.6rem 1.15rem;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.refresh-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Toolbar */
	.toolbar-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		padding: 0.85rem 1.25rem;
	}

	.search-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	:global(.search-icon) {
		position: absolute;
		left: 0.85rem;
		color: #94A3B8;
	}

	.search-field {
		width: 100%;
		padding: 0.65rem 2.5rem;
		border: 1px solid #E2E8F0;
		border-radius: 0.65rem;
		font-size: 0.9rem;
		outline: none;
	}

	.search-field:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.12);
	}

	.clear-search-btn {
		position: absolute;
		right: 0.85rem;
		background: none;
		border: none;
		color: #94A3B8;
		cursor: pointer;
	}

	.filter-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #334155;
	}

	.filter-select {
		padding: 0.5rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid #CBD5E1;
		font-size: 0.875rem;
		outline: none;
		background: white;
	}

	.total-schedules-tag {
		font-size: 0.8rem;
		font-weight: 700;
		color: #64748B;
	}

	/* Table Card */
	.table-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		overflow: hidden;
	}

	.table-responsive {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.875rem;
	}

	.data-table thead {
		background: #F8FAFC;
		border-bottom: 1px solid #E2E8F0;
	}

	.data-table th {
		padding: 0.95rem 1.25rem;
		font-weight: 700;
		color: #475569;
		font-size: 0.8rem;
		letter-spacing: 0.02em;
	}

	.data-table td {
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid #F1F5F9;
		vertical-align: middle;
	}

	.data-table tbody tr:hover {
		background: #FBFDFB;
	}

	.row-disabled {
		opacity: 0.55;
		background: #F8FAFC;
	}

	.order-cell {
		text-align: center;
	}

	.order-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: #F1F5F9;
		color: #334155;
		border-radius: 50%;
		font-weight: 700;
		font-size: 0.8rem;
	}

	/* Doctor Reordering Controls */
	.order-control-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		justify-content: center;
	}

	.btn-order-arrow {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: 1px solid #CBD5E1;
		background: #F8FAFC;
		color: #475569;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: all 0.15s ease;
	}

	.btn-order-arrow:hover:not(:disabled) {
		background: #E8F5E9;
		color: #0A5C36;
		border-color: #0A5C36;
		transform: scale(1.1);
	}

	.btn-order-arrow:active:not(:disabled) {
		transform: scale(0.95);
	}

	.btn-order-arrow:disabled {
		opacity: 0.28;
		cursor: not-allowed;
		background: #F1F5F9;
		color: #94A3B8;
		border-color: #E2E8F0;
	}

	.btn-order-arrow.cross-arrow {
		border-color: #A7F3D0;
		background: #ECFDF5;
		color: #065F46;
	}

	.btn-order-arrow.cross-arrow:hover:not(:disabled) {
		background: #0A5C36;
		color: #FFFFFF;
		border-color: #0A5C36;
	}

	.poli-order-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-right: 0.4rem;
	}

	.btn-poli-arrow {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background: #FFFFFF;
		border: 1px solid #CBD5E1;
		color: #475569;
	}

	.btn-poli-arrow:hover:not(:disabled) {
		background: #E8F5E9;
		color: #0A5C36;
		border-color: #0A5C36;
	}

	.doc-identity {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.doc-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #E8F5E9;
		color: #0A5C36;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 0.85rem;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid #CBD5E1;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.doc-name {
		font-size: 0.925rem;
		color: #0F172A;
		font-weight: 750;
	}

	.doc-spec {
		display: block;
		font-size: 0.775rem;
		color: #64748B;
	}

	.poli-badge {
		background: #F1F5F9;
		color: #0A5C36;
		font-weight: 700;
		padding: 0.3rem 0.7rem;
		border-radius: 0.5rem;
		font-size: 0.775rem;
	}

	.time-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.825rem;
		font-weight: 700;
		color: #334155;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		padding: 0.25rem 0.6rem;
		border-radius: 0.45rem;
		transition: all 0.2s ease;
	}

	.time-badge.scheduled-today {
		background: #ECFDF5;
		border-color: #A7F3D0;
		color: #065F46;
	}

	.time-badge.off-schedule {
		background: #F8FAFC;
		border-color: #E2E8F0;
		color: #475569;
		font-weight: 600;
	}

	.time-badge.unassigned-badge {
		background: #F1F5F9;
		border-color: #CBD5E1;
		color: #94A3B8;
		font-weight: 500;
	}

	/* Status Indicators */
	.status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-open,
	.status-buka {
		background: #D1FAE5;
		color: #047857;
	}
	.status-open .status-dot,
	.status-buka .status-dot { background: #059669; }

	.status-break,
	.status-istirahat {
		background: #FEF3C7;
		color: #B45309;
	}
	.status-break .status-dot,
	.status-istirahat .status-dot { background: #D97706; }

	.status-closed,
	.status-tutup {
		background: #FEE2E2;
		color: #B91C1C;
	}
	.status-closed .status-dot,
	.status-tutup .status-dot { background: #DC2626; }

	.status-holiday,
	.status-libur {
		background: #F1F5F9;
		color: #64748B;
	}
	.status-holiday .status-dot,
	.status-libur .status-dot { background: #94A3B8; }

	.status-upcoming,
	.status-akan_datang {
		background: #E0F2FE;
		color: #0369A1;
	}
	.status-upcoming .status-dot,
	.status-akan_datang .status-dot { background: #0284C7; }

	.status-cancelled {
		background: #FEE2E2;
		color: #991B1B;
	}
	.status-cancelled .status-dot { background: #B91C1C; }

	.override-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: #FEF3C7;
		color: #B45309;
		font-size: 0.725rem;
		font-weight: 800;
		padding: 0.25rem 0.6rem;
		border-radius: 0.45rem;
		border: 1px solid #FDE68A;
	}

	.note-tooltip {
		font-weight: 500;
		font-style: italic;
	}

	.auto-pill {
		font-size: 0.725rem;
		color: #64748B;
		font-weight: 600;
	}

	.auto-pill.off-schedule-pill {
		color: #64748B;
		background: #F1F5F9;
		padding: 0.2rem 0.5rem;
		border-radius: 0.35rem;
		border: 1px solid #E2E8F0;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	:global(.spin-icon) {
		animation: spin 0.8s linear infinite;
	}

	/* Quick Action Scroll/Dropdown Picker Styles */
	.quick-select-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.quick-status-dropdown {
		padding: 0.5rem 0.85rem;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 750;
		cursor: pointer;
		border: 1.5px solid transparent;
		outline: none;
		transition: all 0.2s ease;
		font-family: inherit;
		min-width: 200px;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		padding-right: 2.2rem;
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		background-size: 14px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.quick-status-dropdown:focus {
		box-shadow: 0 0 0 3px rgba(10, 92, 54, 0.25);
	}

	.status-val-open {
		background-color: #ECFDF5;
		color: #065F46;
		border-color: #6EE7B7;
	}

	.status-val-break {
		background-color: #FFFBEB;
		color: #92400E;
		border-color: #FCD34D;
	}

	.status-val-closed {
		background-color: #F8FAFC;
		color: #475569;
		border-color: #CBD5E1;
	}

	.status-val-holiday {
		background-color: #FEF2F2;
		color: #991B1B;
		border-color: #FCA5A5;
	}

	.status-val-cancelled {
		background-color: #FDF2F8;
		color: #9D174D;
		border-color: #F472B6;
	}

	.status-val-auto {
		background-color: #EFF6FF;
		color: #1E40AF;
		border-color: #BFDBFE;
	}

	.btn-note-edit {
		width: 36px;
		height: 36px;
		border-radius: 0.6rem;
		border: 1px solid #CBD5E1;
		background: #FFFFFF;
		color: #475569;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.btn-note-edit:hover {
		background: #F1F5F9;
		color: #0A5C36;
		border-color: #0A5C36;
		transform: scale(1.06);
	}

	/* Quick Status Alert Banner */
	.quick-status-alert-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		border-radius: 0.85rem;
		margin-bottom: 1.15rem;
		font-size: 0.9rem;
		font-weight: 650;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
		animation: bannerSlideDown 0.25s ease-out;
	}

	.quick-status-alert-banner.alert-success {
		background: #ECFDF5;
		color: #065F46;
		border: 1.5px solid #6EE7B7;
	}

	.quick-status-alert-banner.alert-info {
		background: #EFF6FF;
		color: #1E40AF;
		border: 1.5px solid #93C5FD;
	}

	.quick-status-alert-banner.alert-warning {
		background: #FFFBEB;
		color: #92400E;
		border: 1.5px solid #FCD34D;
	}

	.alert-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.alert-close-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		color: currentColor;
		opacity: 0.7;
		display: flex;
		align-items: center;
		padding: 0.25rem;
		border-radius: 0.35rem;
		transition: opacity 0.15s;
	}

	.alert-close-btn:hover {
		opacity: 1;
	}

	@keyframes bannerSlideDown {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.day-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: #F1F5F9;
		color: #334155;
		font-weight: 800;
		padding: 0.35rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.schedule-filter-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.filters-wrap {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.filter-search-input {
		padding: 0.45rem 0.75rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.5rem;
		font-size: 0.82rem;
		color: #0F172A;
		outline: none;
		min-width: 170px;
		background: white;
		font-family: inherit;
		transition: border-color 0.15s;
	}

	.filter-search-input:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.15);
	}

	.doc-cell-content {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.doc-order-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #E8F5E9;
		color: #0A5C36;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
		border: 1px solid #C8E6C9;
		flex-shrink: 0;
	}

	.doc-spec-sub {
		display: block;
		font-size: 0.72rem;
		color: #64748B;
		margin-top: 0.1rem;
	}

	.today-chip {
		background: #0A5C36;
		color: white;
	}

	.today-marker {
		font-size: 0.7rem;
		font-weight: 600;
		opacity: 0.85;
	}

	.toggle-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		border: 1px solid #CBD5E1;
		background: #F8FAFC;
		color: #64748B;
		cursor: pointer;
	}

	.toggle-badge.active {
		background: #D1FAE5;
		border-color: #A7F3D0;
		color: #047857;
	}

	.action-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.action-icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 0.5rem;
		border: 1px solid #E2E8F0;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}

	.edit-btn { color: #0284C7; }
	.edit-btn:hover { background: #E0F2FE; }

	.delete-btn { color: #DC2626; }
	.delete-btn:hover { background: #FEE2E2; }

	.empty-row {
		text-align: center;
		padding: 3rem 1rem !important;
		color: #64748B;
	}

	/* Modals */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.5rem;
	}

	.modal-container {
		background: white;
		width: 100%;
		max-width: 520px;
		border-radius: 1.25rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		animation: modalFadeIn 0.2s ease-out;
	}

	.target-card {
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
		display: flex;
		flex-direction: column;
	}

	.target-name {
		font-size: 1rem;
		color: #0F172A;
		font-weight: 800;
	}

	.target-sub {
		font-size: 0.8rem;
		color: #64748B;
		margin-top: 0.2rem;
	}

	.status-options-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.status-choice-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.8rem;
		font-weight: 700;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}

	.status-choice-btn.selected {
		border-color: #0F172A;
		transform: scale(1.02);
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
	}

	.delete-dialog {
		max-width: 440px;
		padding: 2rem;
		text-align: center;
	}

	.delete-icon-wrap {
		width: 60px;
		height: 60px;
		background: #FEE2E2;
		color: #DC2626;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.25rem;
	}

	.delete-dialog h3 {
		font-size: 1.2rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0 0 0.5rem 0;
	}

	.delete-dialog p {
		font-size: 0.875rem;
		color: #64748B;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.modal-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #F1F5F9;
	}

	.modal-head h3 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		color: #0F172A;
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: #94A3B8;
		cursor: pointer;
	}

	.form-error-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #FEE2E2;
		color: #B91C1C;
		padding: 0.75rem 1.5rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.modal-form-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-field label {
		font-size: 0.825rem;
		font-weight: 700;
		color: #334155;
	}

	.form-input,
	.form-select {
		padding: 0.65rem 0.85rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.6rem;
		font-size: 0.9rem;
		outline: none;
		background: white;
	}

	.form-input:focus,
	.form-select:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.15);
	}

	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		margin-top: 0.25rem;
	}

	.custom-checkbox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: #334155;
		cursor: pointer;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #F1F5F9;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		background: #F8FAFC;
	}

	.justify-center {
		justify-content: center;
	}

	.btn-cancel {
		padding: 0.65rem 1.15rem;
		border-radius: 0.6rem;
		border: 1px solid #CBD5E1;
		background: white;
		font-size: 0.85rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.btn-save {
		padding: 0.65rem 1.25rem;
		border-radius: 0.6rem;
		border: none;
		background: #0A5C36;
		font-size: 0.85rem;
		font-weight: 700;
		color: white;
		cursor: pointer;
	}

	/* Multi-Days Selector Styles */
	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
	}

	.days-selected-badge {
		font-size: 0.72rem;
		font-weight: 700;
		background: #D1FAE5;
		color: #065F46;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		border: 1px solid #A7F3D0;
	}

	.quick-days-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.preset-day-btn {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.6rem;
		border-radius: 0.45rem;
		background: #F1F5F9;
		color: #334155;
		border: 1px solid #CBD5E1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.preset-day-btn:hover {
		background: #E2E8F0;
		color: #0F172A;
		border-color: #94A3B8;
	}

	.preset-day-btn.text-muted {
		color: #64748B;
	}

	.days-chips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(85px, 1fr));
		gap: 0.45rem;
		margin-bottom: 0.35rem;
	}

	.day-chip-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.45rem 0.6rem;
		border-radius: 0.55rem;
		background: #F8FAFC;
		border: 1.5px solid #CBD5E1;
		font-size: 0.8rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.day-chip-toggle:hover {
		background: #F1F5F9;
		border-color: #94A3B8;
	}

	.day-chip-toggle.selected {
		background: #ECFDF5;
		border-color: #0A5C36;
		color: #0A5C36;
		font-weight: 700;
		box-shadow: 0 2px 5px rgba(10, 92, 54, 0.12);
	}

	.chip-check {
		font-size: 0.85rem;
		font-weight: 800;
	}

	.chip-name {
		letter-spacing: -0.01em;
	}

	.btn-delete-confirm {
		padding: 0.65rem 1.25rem;
		border-radius: 0.6rem;
		border: none;
		background: #DC2626;
		font-size: 0.85rem;
		font-weight: 700;
		color: white;
		cursor: pointer;
	}

	@keyframes modalFadeIn {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.photo-upload-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: #F8FAFC;
		border: 1.5px dashed #CBD5E1;
		border-radius: 0.75rem;
		padding: 0.85rem;
	}

	.photo-preview-wrap {
		position: relative;
		display: inline-block;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		overflow: hidden;
		border: 3px solid #10B981;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
	}

	.photo-preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-photo-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #EF4444;
		color: white;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.photo-upload-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn-upload-photo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: #0A5C36;
		color: white;
		padding: 0.55rem 1rem;
		border-radius: 0.55rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		width: fit-content;
		transition: background 0.2s;
	}

	.btn-upload-photo:hover {
		background: #074327;
	}

	.hidden-file-input {
		display: none;
	}

	.or-separator {
		font-size: 0.78rem;
		color: #64748B;
		font-weight: 600;
	}

	.upload-loading-badge {
		margin-top: 0.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #EFF6FF;
		border: 1px solid #BFDBFE;
		color: #1D4ED8;
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		font-size: 0.82rem;
		font-weight: 600;
	}

	.upload-spinner {
		width: 13px;
		height: 13px;
		border: 2px solid #BFDBFE;
		border-top-color: #1D4ED8;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.upload-success-alert {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		background: #ECFDF5;
		border: 1.5px solid #10B981;
		color: #047857;
		padding: 0.6rem 0.9rem;
		border-radius: 0.55rem;
		font-size: 0.85rem;
		font-weight: 700;
		box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
		animation: alertPopIn 0.3s ease-out;
	}

	@keyframes alertPopIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.form-hint {
		display: block;
		font-size: 0.75rem;
		color: #64748B;
		margin-top: 0.3rem;
		line-height: 1.35;
	}

	.today-filter-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		background: white;
		padding: 0.85rem 1.25rem;
		border-radius: 0.75rem;
		border: 1px solid #E2E8F0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.filter-label {
		font-size: 0.825rem;
		font-weight: 600;
		color: #475569;
		white-space: nowrap;
	}

	.filter-select {
		padding: 0.45rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid #CBD5E1;
		background: white;
		font-size: 0.85rem;
		color: #1E293B;
		font-weight: 500;
		outline: none;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.filter-select:focus {
		border-color: #10B981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
	}

	.group-stats-info {
		font-size: 0.825rem;
		color: #64748B;
	}

	.group-stats-info strong {
		color: #0A5C36;
	}

	.mode-toggle-group {
		display: inline-flex;
		background: #F1F5F9;
		padding: 3px;
		border-radius: 0.55rem;
		border: 1px solid #E2E8F0;
	}

	.mode-btn {
		border: none;
		background: transparent;
		padding: 0.4rem 0.8rem;
		font-size: 0.785rem;
		font-weight: 600;
		color: #64748B;
		border-radius: 0.4rem;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.mode-btn:hover {
		color: #1E293B;
	}

	.mode-btn.active {
		background: #0A5C36;
		color: white;
		box-shadow: 0 1px 3px rgba(10, 92, 54, 0.25);
	}

	.poli-group-row td {
		background: #F8FAFC !important;
		padding: 0.65rem 1.15rem !important;
		border-top: 2px solid #CBD5E1 !important;
		border-bottom: 1px solid #E2E8F0 !important;
	}

	.poli-group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.group-left {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.group-order-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: #E06A26;
		color: #FFFFFF;
		font-size: 0.72rem;
		font-weight: 900;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		flex-shrink: 0;
	}

	.group-icon-thumb {
		width: 28px;
		height: 28px;
		border-radius: 0.45rem;
		background: #E8F5E9;
		color: #0A5C36;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.group-tag {
		background: #0A5C36;
		color: white;
		font-size: 0.625rem;
		font-weight: 800;
		padding: 0.2rem 0.5rem;
		border-radius: 0.35rem;
		letter-spacing: 0.6px;
	}

	.group-title {
		font-size: 0.925rem;
		color: #0F172A;
		font-weight: 700;
	}

	.group-badge {
		background: #E2E8F0;
		color: #334155;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
	}

	/* --- Responsive Mobile & Tablet Styles (RWD) --- */
	@media (max-width: 900px) {
		.today-filter-toolbar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.toolbar-actions {
			width: 100%;
			justify-content: space-between;
		}
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.today-banner {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.tab-navigation {
			overflow-x: auto;
			flex-wrap: nowrap;
			-webkit-overflow-scrolling: touch;
			padding-bottom: 0.5rem;
			scrollbar-width: thin;
		}

		.tab-item {
			flex-shrink: 0;
			white-space: nowrap;
		}

		.toolbar-card {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.data-table {
			min-width: 780px;
		}

		.modal-card {
			width: 95vw;
			max-width: 550px;
			max-height: 90vh;
			overflow-y: auto;
		}
	}

	@media (max-width: 640px) {
		.main-title {
			font-size: 1.25rem;
		}

		.subtitle {
			font-size: 0.8rem;
		}

		.today-heading {
			font-size: 1.15rem;
		}

		.quick-status-dropdown {
			min-width: 170px;
			font-size: 0.775rem;
			padding: 0.45rem 0.65rem;
			padding-right: 1.8rem;
		}

		.btn-note-edit {
			width: 32px;
			height: 32px;
		}

		.status-options-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

