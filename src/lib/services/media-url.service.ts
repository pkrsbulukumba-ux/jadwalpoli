/**
 * Media URL & Video Helper Service
 * Menangani normalisasi URL video, deteksi tautan YouTube,
 * dan penyelesaian jalur lokal (local_path) melalui streaming API.
 */

export interface ParsedMediaUrl {
	type: 'youtube' | 'direct_video' | 'image' | 'local_stream';
	resolvedUrl: string;
	youtubeId?: string;
	isLocalStream: boolean;
	originalUrl: string;
}

export class MediaUrlService {
	/**
	 * Mengekstrak ID Video YouTube dari berbagai format URL
	 */
	public static parseYouTubeId(url: string): string | null {
		if (!url) return null;
		const clean = url.trim();

		// Format: youtube.com/watch?v=ID atau youtube.com/watch?feature=...&v=ID
		const watchMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
		if (watchMatch && watchMatch[1]) {
			return watchMatch[1];
		}

		return null;
	}

	/**
	 * Membangun URL embed YouTube yang ramah Kiosk (Autoplay, Loop, No Controls, Rel 0)
	 */
	public static getYouTubeEmbedUrl(youtubeId: string, soundEnabled: boolean = true): string {
		const muteParam = soundEnabled ? '0' : '1';
		// Playlist disetel ke ID yang sama untuk looping yang mulus
		return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=${muteParam}&controls=0&showinfo=0&rel=0&loop=1&playlist=${youtubeId}&playsinline=1&enablejsapi=1&modestbranding=1`;
	}

	/**
	 * Menormalisasi dan menyelesaikan URL berkas media (video/gambar)
	 */
	public static resolveMediaUrl(
		url: string,
		mediaType: 'image' | 'video' = 'video',
		storageType?: 'online' | 'local_path' | 'upload'
	): ParsedMediaUrl {
		if (!url) {
			return {
				type: mediaType === 'image' ? 'image' : 'direct_video',
				resolvedUrl: '',
				isLocalStream: false,
				originalUrl: ''
			};
		}

		const clean = url.trim();

		// 1. Cek apakah ini tautan YouTube
		const ytId = this.parseYouTubeId(clean);
		if (ytId) {
			return {
				type: 'youtube',
				resolvedUrl: this.getYouTubeEmbedUrl(ytId, true),
				youtubeId: ytId,
				isLocalStream: false,
				originalUrl: clean
			};
		}

		// 2. Jika tipe penyimpanan explicitly 'local_path' ATAU terdeteksi path lokal sistem (Windows / Linux / Android)
		const isWindowsAbsPath = /^[a-zA-Z]:[\\\/]/.test(clean);
		const isFileProtocol = clean.startsWith('file://');
		const isExplicitLocal = storageType === 'local_path';
		const hasStaticPrefix = clean.startsWith('/static/') || clean.startsWith('static/');

		if (isWindowsAbsPath || isFileProtocol || (isExplicitLocal && !clean.startsWith('http'))) {
			// Arahkan ke endpoint streaming lokal /api/stream
			return {
				type: 'local_stream',
				resolvedUrl: `/api/stream?file=${encodeURIComponent(clean)}`,
				isLocalStream: true,
				originalUrl: clean
			};
		}

		// 3. Jika path menggunakan /static/videos/... atau static/videos/...
		if (hasStaticPrefix) {
			// Vite melayani folder static/ langsung dari root /
			const directStaticPath = clean.replace(/^\/?static\//, '/');
			return {
				type: mediaType === 'image' ? 'image' : 'direct_video',
				resolvedUrl: directStaticPath,
				isLocalStream: false,
				originalUrl: clean
			};
		}

		// 4. File uploads lokal (/uploads/...)
		if (clean.startsWith('/uploads/') || clean.startsWith('uploads/')) {
			const normalized = clean.startsWith('/') ? clean : '/' + clean;
			return {
				type: mediaType === 'image' ? 'image' : 'direct_video',
				resolvedUrl: normalized,
				isLocalStream: false,
				originalUrl: clean
			};
		}

		// 5. Tautan online langsung (HTTP/HTTPS) atau path relatif lainnya
		return {
			type: mediaType === 'image' ? 'image' : 'direct_video',
			resolvedUrl: clean,
			isLocalStream: false,
			originalUrl: clean
		};
	}
}
