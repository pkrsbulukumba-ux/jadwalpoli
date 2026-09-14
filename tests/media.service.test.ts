import { describe, it, expect } from 'vitest';
import { MediaUrlService } from '../src/lib/services/media-url.service';

describe('MediaUrlService & Video URL Resolver', () => {
	it('harus dapat mengekstrak ID video YouTube dari berbagai format tautan', () => {
		// Standar watch URL
		expect(MediaUrlService.parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		// URL dengan parameter tambahan
		expect(MediaUrlService.parseYouTubeId('https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
		// Format pendek youtu.be
		expect(MediaUrlService.parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		// Format embed
		expect(MediaUrlService.parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		// Format shorts
		expect(MediaUrlService.parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('harus menghasilkan URL embed YouTube yang ramah Kiosk (Autoplay, Loop, Rel 0)', () => {
		const embedUrl = MediaUrlService.getYouTubeEmbedUrl('dQw4w9WgXcQ', true);
		expect(embedUrl).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(embedUrl).toContain('autoplay=1');
		expect(embedUrl).toContain('mute=0');
		expect(embedUrl).toContain('loop=1');
		expect(embedUrl).toContain('playlist=dQw4w9WgXcQ');

		// Jika soundEnabled = false
		const mutedEmbedUrl = MediaUrlService.getYouTubeEmbedUrl('dQw4w9WgXcQ', false);
		expect(mutedEmbedUrl).toContain('mute=1');
	});

	it('harus mengarahkan tautan YouTube ke tipe youtube dan menghasilkan embed URL yang benar', () => {
		const res = MediaUrlService.resolveMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video', 'online');
		expect(res.type).toBe('youtube');
		expect(res.youtubeId).toBe('dQw4w9WgXcQ');
		expect(res.resolvedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
	});

	it('harus mengarahkan path lokal Windows / absolut ke endpoint streaming /api/stream', () => {
		const winPath = 'C:\\Users\\Administrator\\Videos\\promo-rsud.mp4';
		const res = MediaUrlService.resolveMediaUrl(winPath, 'video', 'local_path');
		expect(res.type).toBe('local_stream');
		expect(res.isLocalStream).toBe(true);
		expect(res.resolvedUrl).toBe(`/api/stream?file=${encodeURIComponent(winPath)}`);
	});

	it('harus mengarahkan path dengan protokol file:// ke endpoint streaming /api/stream', () => {
		const filePath = 'file:///D:/videos/edukasi.mp4';
		const res = MediaUrlService.resolveMediaUrl(filePath, 'video', 'local_path');
		expect(res.type).toBe('local_stream');
		expect(res.isLocalStream).toBe(true);
		expect(res.resolvedUrl).toBe(`/api/stream?file=${encodeURIComponent(filePath)}`);
	});

	it('harus menormalisasi path /static/... menjadi path root /... yang dilayani Vite', () => {
		const staticPath = '/static/videos/edukasi-layanan.mp4';
		const res = MediaUrlService.resolveMediaUrl(staticPath, 'video');
		expect(res.resolvedUrl).toBe('/videos/edukasi-layanan.mp4');
		expect(res.isLocalStream).toBe(false);
	});

	it('harus memproses URL /uploads/... dengan benar untuk berkas upload', () => {
		const uploadPath = '/uploads/announcements/12345_video.mp4';
		const res = MediaUrlService.resolveMediaUrl(uploadPath, 'video', 'upload');
		expect(res.resolvedUrl).toBe('/uploads/announcements/12345_video.mp4');
		expect(res.type).toBe('direct_video');
	});

	it('harus menangani gambar dengan tipe image', () => {
		const imgUrl = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d';
		const res = MediaUrlService.resolveMediaUrl(imgUrl, 'image', 'online');
		expect(res.type).toBe('image');
		expect(res.resolvedUrl).toBe(imgUrl);
	});

	it('harus mempertahankan cache media dan tidak melakukan reload dalam interval dekat kecuali forceRealtime', async () => {
		const { KioskDataService } = await import('../src/lib/services/kiosk-data.service');
		// Initial fetch
		const media1 = KioskDataService.getActiveMediaWithCache(true);
		expect(media1).toBeDefined();

		// Second fetch within short interval (forceRealtime: false) uses cached reference
		const media2 = KioskDataService.getActiveMediaWithCache(false);
		expect(media2).toBe(media1);

		// Third fetch with forceRealtime: true refreshes media
		const media3 = KioskDataService.getActiveMediaWithCache(true);
		expect(media3).toBeDefined();
	});

	it('SlideshowEngine harus mengabaikan updateSlides jika struktur slide identik (mencegah flicker)', async () => {
		const { SlideshowEngine } = await import('../src/lib/services/slideshow.engine');
		const { KioskDataService } = await import('../src/lib/services/kiosk-data.service');

		const { slides, settings } = KioskDataService.generateKioskSlides();
		const engine = new SlideshowEngine(slides, settings);

		let stateEmits = 0;
		const unsub = engine.state.subscribe(() => {
			stateEmits++;
		});

		const initialEmits = stateEmits;
		// Re-send identical slides
		engine.updateSlides([...slides]);

		// Emits should NOT increase because slides are equivalent
		expect(stateEmits).toBe(initialEmits);
		unsub();
		engine.destroy();
	});

	it('MediaCacheService harus mengembalikan URL asli jika lingkungan tidak mendukung Cache Storage atau non-HTTP', async () => {
		const { MediaCacheService } = await import('../src/lib/services/media-cache.service');
		// URL lokal /api/stream atau file:// tidak di-cache oleh HTTP fetcher
		const localUrl = '/api/stream?file=video.mp4';
		const res = await MediaCacheService.getPlayableMediaUrl(localUrl);
		expect(res).toBe(localUrl);

		// Non-browser fallback aman mengembalikan URL asli
		const remoteUrl = 'https://example.com/video.mp4';
		const res2 = await MediaCacheService.getPlayableMediaUrl(remoteUrl);
		expect(res2).toBe(remoteUrl);
	});
});
