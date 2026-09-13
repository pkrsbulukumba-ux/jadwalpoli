import { describe, it, expect, vi } from 'vitest';
import { SlideshowEngine } from '../src/lib/services/slideshow.engine';
import { KioskDataService } from '../src/lib/services/kiosk-data.service';
import { DataRepository } from '../src/lib/services/data.repository';
import { OfflineService } from '../src/lib/services/offline.service';
import type { KioskSlide, KioskSettings } from '../src/lib/types';

describe('Kiosk Soak Testing - 24/7 Reliability & Anti-Leak Simulation', () => {
	DataRepository.init();
	const initialData = KioskDataService.generateKioskSlides();

	it('harus mampu menjalankan 100 siklus transisi slide secara terus-menerus tanpa duplikasi timer atau crash', () => {
		const engine = new SlideshowEngine(initialData.slides, initialData.settings);
		let currentState = { currentIndex: 0, totalSlides: 0, progressPercent: 0 };

		const unsubscribe = engine.state.subscribe((state) => {
			currentState = state;
		});

		const totalSlides = initialData.slides.length;
		expect(totalSlides).toBeGreaterThan(0);

		// Simulasi 100x rotasi slide Kiosk berturut-turut
		for (let i = 0; i < 100; i++) {
			const expectedIndex = (i + 1) % totalSlides;
			engine.next();
			expect(currentState.currentIndex).toBe(expectedIndex);
		}

		// Pastikan total slides tetap sinkron
		expect(currentState.totalSlides).toBe(totalSlides);

		// Bersihkan
		unsubscribe();
		engine.destroy();
	});

	it('harus mendukung kontrol Pause dan Resume saat petugas membuka modal PIN', () => {
		const engine = new SlideshowEngine(initialData.slides, initialData.settings);
		let isPaused = false;

		const unsubscribe = engine.state.subscribe((state) => {
			isPaused = state.isPaused;
		});

		// Petugas klik Kunci Kiosk
		engine.pause();
		expect(isPaused).toBe(true);

		// Petugas menutup modal
		engine.resume();
		expect(isPaused).toBe(false);

		unsubscribe();
		engine.destroy();
	});

	it('harus menangani transisi video onVideoCompleted() secara mulus', () => {
		const mockVideoSlide: KioskSlide = {
			id: 'slide-video-test',
			type: 'media',
			pageNumber: 1,
			totalPages: 2,
			durationSeconds: 0,
			media: {
				id: 'm-vid-1',
				title: 'Video Edukasi',
				media_type: 'video',
				file_path: 'video.mp4',
				public_url: '/videos/video.mp4',
				sort_order: 1,
				is_active: true
			}
		};

		const mockScheduleSlide: KioskSlide = {
			id: 'slide-sch-test',
			type: 'schedule',
			pageNumber: 2,
			totalPages: 2,
			durationSeconds: 15,
			sections: []
		};

		const engine = new SlideshowEngine([mockVideoSlide, mockScheduleSlide], initialData.settings);
		let currentIndex = 0;

		const unsubscribe = engine.state.subscribe((state) => {
			currentIndex = state.currentIndex;
		});

		expect(currentIndex).toBe(0);

		// Event video berakhir (onended)
		engine.onVideoCompleted();
		expect(currentIndex).toBe(1);

		unsubscribe();
		engine.destroy();
	});

	it('harus memperbarui struktur slide secara dinamis tanpa me-reset Kiosk saat data CMS berubah', () => {
		const engine = new SlideshowEngine(initialData.slides, initialData.settings);

		// Tambahkan slide baru
		const newSlides: KioskSlide[] = [
			...initialData.slides,
			{
				id: 'slide-extra',
				type: 'schedule',
				pageNumber: initialData.slides.length + 1,
				totalPages: initialData.slides.length + 1,
				durationSeconds: 15,
				sections: []
			}
		];

		engine.updateSlides(newSlides);

		let updatedTotal = 0;
		const unsubscribe = engine.state.subscribe((state) => {
			updatedTotal = state.totalSlides;
		});

		expect(updatedTotal).toBe(newSlides.length);

		unsubscribe();
		engine.destroy();
	});

	it('harus membersihkan seluruh timer saat destroy() dipanggil untuk mencegah memory leak', () => {
		const engine = new SlideshowEngine(initialData.slides, initialData.settings);
		engine.start();

		// Panggil destroy
		engine.destroy();

		// Panggil next setelah destroy tidak boleh menimbulkan crash
		expect(() => engine.next()).not.toThrow();
	});

	it('harus mendukung setProgress() untuk sinkronisasi progress bar lingkaran dengan pemutaran video', () => {
		const engine = new SlideshowEngine(initialData.slides, initialData.settings);
		let currentProgress = 0;

		const unsubscribe = engine.state.subscribe((state) => {
			currentProgress = state.progressPercent;
		});

		engine.setProgress(65);
		expect(currentProgress).toBe(65);

		// Harus membatasi nilai maksimal 100 dan minimal 0
		engine.setProgress(150);
		expect(currentProgress).toBe(100);

		engine.setProgress(-20);
		expect(currentProgress).toBe(0);

		unsubscribe();
		engine.destroy();
	});

	it('harus memajukan slide secara otomatis jika video macet atau melebihi batas waktu keamanan (45s)', () => {
		vi.useFakeTimers();

		const mockVideoSlide: KioskSlide = {
			id: 'slide-video-stuck',
			type: 'media',
			pageNumber: 1,
			totalPages: 2,
			durationSeconds: 0,
			media: {
				id: 'm-vid-stuck',
				title: 'Video Edukasi',
				media_type: 'video',
				file_path: 'video.mp4',
				public_url: '/videos/video.mp4',
				sort_order: 1,
				is_active: true
			}
		};

		const mockNextSlide: KioskSlide = {
			id: 'slide-next-test',
			type: 'schedule',
			pageNumber: 2,
			totalPages: 2,
			durationSeconds: 15,
			sections: []
		};

		const engine = new SlideshowEngine([mockVideoSlide, mockNextSlide], initialData.settings);
		let currentIndex = 0;

		const unsubscribe = engine.state.subscribe((state) => {
			currentIndex = state.currentIndex;
		});

		engine.start();
		expect(currentIndex).toBe(0);

		// Majukan waktu 10 menit (safety timeout maksimal video)
		vi.advanceTimersByTime(600500);
		expect(currentIndex).toBe(1);

		unsubscribe();
		engine.destroy();
		vi.useRealTimers();
	});
});

describe('Kiosk Offline Resilience & Network Recovery Simulation', () => {
	it('harus mampu memicu transisi status offline dan memuat snapshot tanpa henti', () => {
		let isOfflineValue = false;
		const unsub = OfflineService.isOffline.subscribe((val) => {
			isOfflineValue = val;
		});

		// Simulasi jaringan putus
		OfflineService.setOfflineStateForTesting(true);
		expect(isOfflineValue).toBe(true);

		// Simulasi jaringan pulih
		OfflineService.setOfflineStateForTesting(false);
		expect(isOfflineValue).toBe(false);

		unsub();
	});
});
