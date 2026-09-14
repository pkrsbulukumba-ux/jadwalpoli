import { browser } from '$app/environment';

const CACHE_NAME = 'kiosk-media-blob-cache-v1';

/**
 * MediaCacheService
 * Mengelola penyimpanan cache berkas video & gambar pengumuman di memori lokal TV (Cache Storage API)
 * agar video HANYA diunduh 1 KALI saja. Putaran ke-2, ke-3, dst diputar 100% dari disk lokal (0 KB kuota hosting).
 */
export class MediaCacheService {
	// Peta URL remote -> Object URL lokal (blob:...) yang sudah siap diputar
	private static objectUrlMap = new Map<string, string>();
	// Menghindari duplikasi download bersamaan jika dipanggil serentak
	private static pendingDownloads = new Map<string, Promise<string>>();

	/**
	 * Memeriksa apakah browser mendukung Cache Storage API
	 */
	public static isCacheSupported(): boolean {
		return browser && typeof window !== 'undefined' && 'caches' in window;
	}

	/**
	 * Mengambil URL video/gambar yang hemat kuota.
	 * - Jika file sudah tersimpan di Cache Storage TV: kembalikan Blob URL lokal (0 byte transfer hosting).
	 * - Jika belum: unduh sekali, simpan ke Cache Storage untuk selamanya, dan kembalikan Blob URL.
	 * - Fallback: jika CORS/jaringan membatasi fetch JS, kembalikan remoteUrl asli agar pemutaran tidak terganggu.
	 */
	public static async getPlayableMediaUrl(remoteUrl: string): Promise<string> {
		if (!remoteUrl || !this.isCacheSupported()) {
			return remoteUrl;
		}

		// Hanya cache URL file http/https langsung (misal MP4, WebM, PNG, JPG)
		if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
			return remoteUrl;
		}

		// 1. Jika sudah ada Blob URL yang aktif di sesi memori Kiosk
		const existingObjectUrl = this.objectUrlMap.get(remoteUrl);
		if (existingObjectUrl) {
			return existingObjectUrl;
		}

		// 2. Jika sedang dalam proses pengunduhan, tunggu promise yang sama
		if (this.pendingDownloads.has(remoteUrl)) {
			return this.pendingDownloads.get(remoteUrl)!;
		}

		const fetchAndCachePromise = (async () => {
			try {
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(remoteUrl);

				// Skenario A: Sudah tersimpan di Cache Storage lokal TV
				if (cachedResponse) {
					const blob = await cachedResponse.blob();
					const objectUrl = URL.createObjectURL(blob);
					this.objectUrlMap.set(remoteUrl, objectUrl);
					console.info(
						`[MediaCacheService] Video dimuat dari Cache Storage TV (0 KB Kuota Hosting): ${remoteUrl.substring(0, 60)}...`
					);
					return objectUrl;
				}

				// Skenario B: Pertama kali diunduh, simpan ke Cache Storage TV
				console.info(
					`[MediaCacheService] Mengunduh media untuk pertama kali dan menyimpannya ke memori lokal: ${remoteUrl.substring(0, 60)}...`
				);
				const response = await fetch(remoteUrl, { mode: 'cors' });
				if (response.ok) {
					// Simpan salinan respon utuh ke Cache Storage TV
					await cache.put(remoteUrl, response.clone());
					const blob = await response.blob();
					const objectUrl = URL.createObjectURL(blob);
					this.objectUrlMap.set(remoteUrl, objectUrl);
					console.info(
						`[MediaCacheService] Media berhasil disimpan ke Cache lokal TV! Putaran berikutnya 100% bebas kuota hosting.`
					);
					return objectUrl;
				}
			} catch (err) {
				console.warn(
					'[MediaCacheService] Cache otomatis tidak dapat menyimpan berkas (fallback ke pemutar langsung):',
					err
				);
			} finally {
				this.pendingDownloads.delete(remoteUrl);
			}

			// Fallback aman: kembalikan URL asli jika terjadi kendala CORS atau offline
			return remoteUrl;
		})();

		this.pendingDownloads.set(remoteUrl, fetchAndCachePromise);
		return fetchAndCachePromise;
	}

	/**
	 * Pra-unduh (pre-cache) seluruh daftar media yang aktif saat Kiosk booting
	 * agar sebelum slide video pertama kali muncul, berkas sudah tersedia di TV.
	 */
	public static prefetchMediaUrls(urls: string[]) {
		if (!this.isCacheSupported()) return;

		for (const url of urls) {
			if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
				this.getPlayableMediaUrl(url).catch(() => {});
			}
		}
	}

	/**
	 * Bersihkan Blob URL saat aplikasi ditutup untuk mencegah memory leak
	 */
	public static cleanupObjectUrls() {
		for (const [url, objectUrl] of this.objectUrlMap.entries()) {
			try {
				URL.revokeObjectURL(objectUrl);
			} catch {
				// Abaikan jika sudah di-revoke
			}
		}
		this.objectUrlMap.clear();
	}
}
