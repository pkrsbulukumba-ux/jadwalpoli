import { describe, it, expect, beforeEach } from 'vitest';
import { DataRepository } from '../src/lib/services/data.repository';
import { KioskDataService } from '../src/lib/services/kiosk-data.service';
import type { Doctor } from '../src/lib/types';

describe('Logika Urutan Tampilan Dokter & Pergeseran Nomor (Doctor Display Order Engine)', () => {
	beforeEach(() => {
		DataRepository.init();
	});

	it('harus menghitung nomor urutan berikutnya dengan benar via getNextDoctorOrder', () => {
		const poliId = 'poli-test-next';
		// Poli baru tanpa dokter harus mulai dari 1
		expect(DataRepository.getNextDoctorOrder(poliId)).toBe(1);

		// Tambahkan dokter urutan 1 dan 2
		DataRepository.createDoctor({
			full_name: 'Dokter A',
			polyclinic_id: poliId,
			display_order: 1,
			is_active: true
		});
		DataRepository.createDoctor({
			full_name: 'Dokter B',
			polyclinic_id: poliId,
			display_order: 2,
			is_active: true
		});

		expect(DataRepository.getNextDoctorOrder(poliId)).toBe(3);
	});

	it('harus mendeteksi konflik nomor urutan dokter via getDoctorAtOrder', () => {
		const poliId = 'poli-test-conflict';
		const doc1 = DataRepository.createDoctor({
			full_name: 'Dokter Senior 1',
			polyclinic_id: poliId,
			display_order: 1,
			is_active: true
		});

		const conflict = DataRepository.getDoctorAtOrder(poliId, 1);
		expect(conflict).toBeDefined();
		expect(conflict?.id).toBe(doc1.id);
		expect(conflict?.full_name).toBe('Dokter Senior 1');

		// Saat dokter mengecualikan dirinya sendiri (saat edit form)
		const selfConflict = DataRepository.getDoctorAtOrder(poliId, 1, doc1.id);
		expect(selfConflict).toBeNull();

		// Nomor yang belum digunakan
		const nonExistent = DataRepository.getDoctorAtOrder(poliId, 99);
		expect(nonExistent).toBeNull();
	});

	it('harus melakukan pergeseran otomatis (shift +1) saat nomor urut yang sama dimasukkan', () => {
		const poliId = 'poli-test-shift';

		// Buat 3 dokter berurutan: 1, 2, 3
		const doc1 = DataRepository.createDoctor({
			full_name: 'Dokter Urut 1',
			polyclinic_id: poliId,
			display_order: 1,
			is_active: true
		});
		const doc2 = DataRepository.createDoctor({
			full_name: 'Dokter Urut 2',
			polyclinic_id: poliId,
			display_order: 2,
			is_active: true
		});
		const doc3 = DataRepository.createDoctor({
			full_name: 'Dokter Urut 3',
			polyclinic_id: poliId,
			display_order: 3,
			is_active: true
		});

		// Tambahkan dokter baru di posisi nomor 2 dengan pergeseran
		const docNew = DataRepository.createDoctor({
			full_name: 'Dokter Sisipan di Posisi 2',
			polyclinic_id: poliId,
			display_order: 2,
			is_active: true
		});

		const docsInPoli = DataRepository.getDoctorsInPoli(poliId);
		expect(docsInPoli.length).toBe(4);

		// Urutan harus:
		// Posisi 1: Dokter Urut 1
		// Posisi 2: Dokter Sisipan di Posisi 2
		// Posisi 3: Dokter Urut 2 (tergeser dari 2 ke 3)
		// Posisi 4: Dokter Urut 3 (tergeser dari 3 ke 4)
		expect(docsInPoli[0].id).toBe(doc1.id);
		expect(docsInPoli[0].display_order).toBe(1);

		expect(docsInPoli[1].id).toBe(docNew.id);
		expect(docsInPoli[1].display_order).toBe(2);

		expect(docsInPoli[2].id).toBe(doc2.id);
		expect(docsInPoli[2].display_order).toBe(3);

		expect(docsInPoli[3].id).toBe(doc3.id);
		expect(docsInPoli[3].display_order).toBe(4);
	});

	it('harus menukar posisi langsung (swap) saat mode swap dipilih', () => {
		const poliId = 'poli-test-swap';

		const doc1 = DataRepository.createDoctor({
			full_name: 'Dokter A (Awal Posisi 1)',
			polyclinic_id: poliId,
			display_order: 1,
			is_active: true
		});
		const doc2 = DataRepository.createDoctor({
			full_name: 'Dokter B (Awal Posisi 2)',
			polyclinic_id: poliId,
			display_order: 2,
			is_active: true
		});
		const doc3 = DataRepository.createDoctor({
			full_name: 'Dokter C (Awal Posisi 3)',
			polyclinic_id: poliId,
			display_order: 3,
			is_active: true
		});

		// Pindahkan Dokter C (posisi 3) ke posisi 1 dengan mode swap
		DataRepository.reorderDoctor(doc3.id, poliId, 1, 'swap');

		const docs = DataRepository.getDoctorsInPoli(poliId);
		// Dokter C harus jadi nomor 1
		// Dokter A harus jadi nomor 3 (bertukar)
		// Dokter B tetap nomor 2
		const updatedDocC = docs.find((d) => d.id === doc3.id);
		const updatedDocA = docs.find((d) => d.id === doc1.id);
		const updatedDocB = docs.find((d) => d.id === doc2.id);

		expect(updatedDocC?.display_order).toBe(1);
		expect(updatedDocB?.display_order).toBe(2);
		expect(updatedDocA?.display_order).toBe(3);
	});

	it('harus menggeser urutan naik (up) dan turun (down) via moveDoctorOrder dengan tepat', () => {
		const poliId = 'poli-test-move';

		const d1 = DataRepository.createDoctor({ full_name: 'D1', polyclinic_id: poliId, display_order: 1, is_active: true });
		const d2 = DataRepository.createDoctor({ full_name: 'D2', polyclinic_id: poliId, display_order: 2, is_active: true });
		const d3 = DataRepository.createDoctor({ full_name: 'D3', polyclinic_id: poliId, display_order: 3, is_active: true });

		// D1 tidak bisa digeser up karena sudah paling atas
		const cannotMoveUp = DataRepository.moveDoctorOrder(d1.id, 'up');
		expect(cannotMoveUp).toBe(false);

		// D3 tidak bisa digeser down karena sudah paling bawah
		const cannotMoveDown = DataRepository.moveDoctorOrder(d3.id, 'down');
		expect(cannotMoveDown).toBe(false);

		// Geser D2 ke atas (up) -> D2 menjadi #1, D1 menjadi #2
		const moveD2Up = DataRepository.moveDoctorOrder(d2.id, 'up');
		expect(moveD2Up).toBe(true);

		let docs = DataRepository.getDoctorsInPoli(poliId);
		expect(docs[0].id).toBe(d2.id);
		expect(docs[0].display_order).toBe(1);
		expect(docs[1].id).toBe(d1.id);
		expect(docs[1].display_order).toBe(2);
		expect(docs[2].id).toBe(d3.id);
		expect(docs[2].display_order).toBe(3);

		// Geser D2 kembali ke bawah (down) -> D1 menjadi #1, D2 menjadi #2
		const moveD2Down = DataRepository.moveDoctorOrder(d2.id, 'down');
		expect(moveD2Down).toBe(true);

		docs = DataRepository.getDoctorsInPoli(poliId);
		expect(docs[0].id).toBe(d1.id);
		expect(docs[0].display_order).toBe(1);
		expect(docs[1].id).toBe(d2.id);
		expect(docs[1].display_order).toBe(2);
	});

	it('harus menormalkan nomor urut (tanpa celah/lubang) setelah penghapusan dokter via deleteDoctor', () => {
		const poliId = 'poli-test-del';

		const d1 = DataRepository.createDoctor({ full_name: 'D1', polyclinic_id: poliId, display_order: 1, is_active: true });
		const d2 = DataRepository.createDoctor({ full_name: 'D2', polyclinic_id: poliId, display_order: 2, is_active: true });
		const d3 = DataRepository.createDoctor({ full_name: 'D3', polyclinic_id: poliId, display_order: 3, is_active: true });
		const d4 = DataRepository.createDoctor({ full_name: 'D4', polyclinic_id: poliId, display_order: 4, is_active: true });

		// Hapus dokter D2 (posisi 2)
		DataRepository.deleteDoctor(d2.id);

		const remaining = DataRepository.getDoctorsInPoli(poliId);
		expect(remaining.length).toBe(3);
		// Nomor urut harus otomatis dinormalkan menjadi 1, 2, 3 tanpa melompati nomor 2
		expect(remaining[0].id).toBe(d1.id);
		expect(remaining[0].display_order).toBe(1);

		expect(remaining[1].id).toBe(d3.id);
		expect(remaining[1].display_order).toBe(2);

		expect(remaining[2].id).toBe(d4.id);
		expect(remaining[2].display_order).toBe(3);
	});

	it('harus merefleksikan urutan display_order pada urutan card dokter di KioskDataService', () => {
		const polyclinics = DataRepository.getPolyclinics();
		const poli = polyclinics[0]; // contoh poli pertama
		expect(poli).toBeDefined();

		// Bersihkan atau ambil dokter di poli ini
		const poliDocs = DataRepository.getDoctorsInPoli(poli.id);
		if (poliDocs.length >= 2) {
			const first = poliDocs[0];
			const second = poliDocs[1];

			// Tukar posisi first dan second
			DataRepository.reorderDoctor(second.id, poli.id, 1, 'swap');

			const kioskResult = KioskDataService.generateKioskSlides();
			const scheduleSlides = kioskResult.slides.filter((s) => s.type === 'schedule');
			const allCards = scheduleSlides.flatMap((s) => s.sections.flatMap((sec) => sec.doctors));

			// Ambil card di poli ini
			const cardsInPoli = allCards.filter((c) => c.doctor.polyclinic_id === poli.id);
			if (cardsInPoli.length >= 2) {
				// Dokter kedua yang dipindahkan ke urutan 1 harus muncul sebelum dokter pertama
				const idxSecond = cardsInPoli.findIndex((c) => c.doctor.id === second.id);
				const idxFirst = cardsInPoli.findIndex((c) => c.doctor.id === first.id);
				expect(idxSecond).toBeLessThan(idxFirst);
			}
		}
	});

	it('harus mampu memindahkan dokter melintasi batas poliklinik (antar-poli) secara mulus', () => {
		const activePolis = DataRepository.getPolyclinics().filter((p) => p.is_active);
		expect(activePolis.length).toBeGreaterThanOrEqual(2);

		const poli1 = activePolis[0];
		const poli2 = activePolis[1];

		// Tambahkan dokter uji di poli 2 pada posisi #1
		const docInPoli2 = DataRepository.createDoctor({
			full_name: 'Dokter Pindah Antar Poli',
			polyclinic_id: poli2.id,
			display_order: 1,
			is_active: true
		});

		const countPoli1Before = DataRepository.getDoctorsInPoli(poli1.id).length;

		// Geser dokter naik (up) dari posisi #1 di poli 2 -> harus berpindah ke poli 1 di posisi terakhir
		const movedUp = DataRepository.moveDoctorOrder(docInPoli2.id, 'up', true);
		expect(movedUp).toBe(true);

		const updatedDoc = DataRepository.getDoctorById(docInPoli2.id);
		expect(updatedDoc?.polyclinic_id).toBe(poli1.id);
		expect(updatedDoc?.display_order).toBe(countPoli1Before + 1);

		// Sekarang dokter ada di posisi paling bawah di poli 1. Geser turun (down) -> harus kembali ke poli 2 di posisi #1!
		const movedDown = DataRepository.moveDoctorOrder(docInPoli2.id, 'down', true);
		expect(movedDown).toBe(true);

		const docBackInPoli2 = DataRepository.getDoctorById(docInPoli2.id);
		expect(docBackInPoli2?.polyclinic_id).toBe(poli2.id);
		expect(docBackInPoli2?.display_order).toBe(1);
	});

	it('harus mampu menggeser urutan grup poliklinik via movePolyclinicOrder dan merefleksikannya di Kiosk', () => {
		const polis = DataRepository.getPolyclinics().filter((p) => p.is_active);
		expect(polis.length).toBeGreaterThanOrEqual(2);

		const firstPoli = polis[0];
		const secondPoli = polis[1];
		const firstOrder = firstPoli.display_order;
		const secondOrder = secondPoli.display_order;

		// Geser poli kedua naik (up)
		const success = DataRepository.movePolyclinicOrder(secondPoli.id, 'up');
		expect(success).toBe(true);

		const updatedPolis = DataRepository.getPolyclinics().filter((p) => p.is_active);
		const updatedSecond = updatedPolis.find((p) => p.id === secondPoli.id);
		const updatedFirst = updatedPolis.find((p) => p.id === firstPoli.id);

		expect(updatedSecond?.display_order).toBe(1);
		expect(updatedFirst?.display_order).toBe(2);

		// Verifikasi pada Kiosk: seksi kedua sekarang harus dievaluasi dengan urutan display_order baru
		const kioskResult = KioskDataService.generateKioskSlides();
		const scheduleSlides = kioskResult.slides.filter((s) => s.type === 'schedule');
		const allSections = scheduleSlides.flatMap((s) => s.sections);

		const idxSecond = allSections.findIndex((sec) => sec.polyclinic.id === secondPoli.id);
		const idxFirst = allSections.findIndex((sec) => sec.polyclinic.id === firstPoli.id);

		if (idxSecond !== -1 && idxFirst !== -1) {
			expect(idxSecond).toBeLessThan(idxFirst);
		}
	});
});

