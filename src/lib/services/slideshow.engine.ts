import { writable } from 'svelte/store';
import type { KioskSlide, KioskSettings } from '$lib/types';

export interface SlideshowState {
	currentIndex: number;
	totalSlides: number;
	progressPercent: number;
	isPaused: boolean;
	currentSlide: KioskSlide | null;
}

export class SlideshowEngine {
	private slides: KioskSlide[] = [];
	private settings: KioskSettings;
	private currentIndex: number = 0;
	private progress: number = 0;
	private isPaused: boolean = false;
	private timer: ReturnType<typeof setInterval> | null = null;
	private videoSafetyTimer: ReturnType<typeof setTimeout> | null = null;
	private tickIntervalMs: number = 100; // Tick setiap 100ms untuk progress bar yang mulus

	public state = writable<SlideshowState>({
		currentIndex: 0,
		totalSlides: 0,
		progressPercent: 0,
		isPaused: false,
		currentSlide: null
	});

	constructor(slides: KioskSlide[], settings: KioskSettings) {
		this.slides = slides;
		this.settings = settings;
		this.currentIndex = 0;
		this.progress = 0;
		this.updateState();
	}

	public start() {
		this.stop();
		this.runTimer();
	}

	public stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		if (this.videoSafetyTimer) {
			clearTimeout(this.videoSafetyTimer);
			this.videoSafetyTimer = null;
		}
	}

	public pause() {
		this.isPaused = true;
		this.updateState();
	}

	public resume() {
		this.isPaused = false;
		this.updateState();
	}

	public next() {
		if (this.slides.length === 0) return;
		this.stop();
		this.currentIndex = (this.currentIndex + 1) % this.slides.length;
		this.progress = 0;
		this.updateState();
		this.start();
	}

	public prev() {
		if (this.slides.length === 0) return;
		this.stop();
		this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
		this.progress = 0;
		this.updateState();
		this.start();
	}

	public goTo(index: number) {
		if (index >= 0 && index < this.slides.length) {
			this.stop();
			this.currentIndex = index;
			this.progress = 0;
			this.updateState();
			this.start();
		}
	}

	/**
	 * Memperbarui persentase progress secara langsung (misal saat video sedang berputar)
	 */
	public setProgress(percent: number) {
		this.progress = Math.min(100, Math.max(0, percent));
		this.updateState();
	}

	/**
	 * Callback saat video selesai diputar (onended event atau graceful timeout)
	 */
	public onVideoCompleted() {
		this.stop();
		this.next();
	}

	public updateSettings(newSettings: KioskSettings) {
		this.settings = newSettings;
	}

	/**
	 * Memeriksa apakah daftar slide baru identik dengan yang sedang aktif.
	 * Jika identik, updateState tidak dipanggil agar pemutaran video / render gambar tidak terpotong.
	 */
	private areSlidesEquivalent(oldSlides: KioskSlide[], newSlides: KioskSlide[]): boolean {
		if (oldSlides.length !== newSlides.length) return false;
		for (let i = 0; i < oldSlides.length; i++) {
			const a = oldSlides[i];
			const b = newSlides[i];
			if (
				a.id !== b.id ||
				a.type !== b.type ||
				a.pageNumber !== b.pageNumber ||
				a.durationSeconds !== b.durationSeconds
			) {
				return false;
			}
			if (a.type === 'media' && b.type === 'media') {
				if (
					a.media.id !== b.media.id ||
					a.media.public_url !== b.media.public_url ||
					a.media.file_path !== b.media.file_path ||
					a.media.updated_at !== b.media.updated_at
				) {
					return false;
				}
			}
			if (a.type === 'schedule' && b.type === 'schedule') {
				const aSecs = a.sections || [];
				const bSecs = b.sections || [];
				if (aSecs.length !== bSecs.length) return false;
				for (let s = 0; s < aSecs.length; s++) {
					const sA = aSecs[s];
					const sB = bSecs[s];
					if (sA.polyclinic.id !== sB.polyclinic.id || sA.doctors.length !== sB.doctors.length) {
						return false;
					}
					for (let d = 0; d < sA.doctors.length; d++) {
						const dA = sA.doctors[d];
						const dB = sB.doctors[d];
						if (
							dA.doctor.id !== dB.doctor.id ||
							dA.status.type !== dB.status.type ||
							dA.status.label !== dB.status.label ||
							dA.status.subtext !== dB.status.subtext
						) {
							return false;
						}
					}
				}
			}
		}
		return true;
	}

	public updateSlides(newSlides: KioskSlide[]) {
		if (this.slides.length > 0 && this.areSlidesEquivalent(this.slides, newSlides)) {
			return;
		}

		this.slides = newSlides;
		if (this.currentIndex >= this.slides.length) {
			this.currentIndex = 0;
		}
		this.updateState();
	}

	private getDurationForCurrentSlide(): number {
		const slide = this.slides[this.currentIndex];
		if (!slide) return 15;

		if (slide.type === 'schedule') {
			return this.settings.slide_duration_seconds || slide.durationSeconds || 15;
		}

		if (slide.type === 'media') {
			if (slide.media.media_type === 'image') {
				return this.settings.image_duration_seconds || slide.durationSeconds || 10;
			}
			// Jika konfigurasi Kiosk mengatur agar video tidak menunggu tamat:
			if (this.settings.video_wait_for_end === false) {
				return this.settings.slide_duration_seconds || 20;
			}
			// Video dikendalikan oleh durasi pemutarannya sendiri (event onended/onProgress)
			return 0;
		}

		return 15;
	}

	private runTimer() {
		const durationSec = this.getDurationForCurrentSlide();

		// Jika durasi 0 (video yang menunggu event onended / onProgress), timer dikendalikan video
		if (durationSec === 0) {
			this.progress = 0;
			this.updateState();

			// Batas waktu keamanan maksimal 10 menit (600s) agar video durasi panjang
			// terputar sempurna sampai habis tanpa terpotong di tengah jalan
			this.videoSafetyTimer = setTimeout(() => {
				console.warn('[SlideshowEngine] Batas waktu maksimal video (10 menit) tercapai, melanjutkan slide...');
				this.next();
			}, 600000);
			return;
		}

		const totalTicks = (durationSec * 1000) / this.tickIntervalMs;
		const increment = 100 / totalTicks;

		this.timer = setInterval(() => {
			if (this.isPaused) return;

			this.progress += increment;
			if (this.progress >= 100) {
				this.next();
			} else {
				this.updateState();
			}
		}, this.tickIntervalMs);
	}

	private updateState() {
		this.state.set({
			currentIndex: this.currentIndex,
			totalSlides: this.slides.length,
			progressPercent: Math.min(100, Math.max(0, this.progress)),
			isPaused: this.isPaused,
			currentSlide: this.slides[this.currentIndex] || null
		});
	}

	public destroy() {
		this.stop();
	}
}
