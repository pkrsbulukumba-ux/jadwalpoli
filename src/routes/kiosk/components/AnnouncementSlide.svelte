<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Volume2, VolumeX, Sparkles, AlertCircle, ExternalLink } from '@lucide/svelte';
	import type { MediaAnnouncement } from '$lib/types';
	import { MediaUrlService, type ParsedMediaUrl } from '$lib/services/media-url.service';

	interface Props {
		media: MediaAnnouncement;
		onSlideComplete: () => void;
		onProgress?: (percent: number) => void;
		soundEnabled?: boolean;
	}

	let { media, onSlideComplete, onProgress, soundEnabled = true }: Props = $props();

	let videoElement = $state<HTMLVideoElement | null>(null);
	let isMuted = $state(true);
	let isAudioBlocked = $state(false);
	let hasError = $state(false);
	let hasImageError = $state(false);
	let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
	let ytTimer: ReturnType<typeof setTimeout> | null = null;
	let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
	let freezeCheckInterval: ReturnType<typeof setInterval> | null = null;

	let lastCurrentTime = 0;
	let lastProgressStamp = Date.now();
	let isPlaying = $state(false);
	let attemptedStreamFallback = false;
	let playAttemptInProgress = false;

	let parsedMedia = $derived<ParsedMediaUrl>(
		MediaUrlService.resolveMediaUrl(media.public_url, media.media_type, media.storage_type)
	);

	// URL video aktif (menggunakan derived dari parsedMedia.resolvedUrl dengan fallback override)
	let overrideVideoSrc = $state<string | null>(null);
	let activeVideoSrc = $derived(overrideVideoSrc ?? parsedMedia.resolvedUrl);

	$effect(() => {
		overrideVideoSrc = null;
		attemptedStreamFallback = false;
		hasError = false;
		lastCurrentTime = 0;
		lastProgressStamp = Date.now();
	});

	// Pemutaran video berketahanan tinggi: tidak memanggil play() berulang-ulang jika sudah berputar
	async function safePlayVideo() {
		if (!videoElement || playAttemptInProgress) return;
		if (!videoElement.paused && videoElement.currentTime > 0) {
			isPlaying = true;
			return;
		}

		playAttemptInProgress = true;
		try {
			videoElement.muted = true;
			videoElement.defaultMuted = true;
			isMuted = true;

			const playPromise = videoElement.play();
			if (playPromise !== undefined) {
				await playPromise;
			}
			isPlaying = true;
			lastProgressStamp = Date.now();

			// Cek apakah ada izin user gesture dari klik/sentuh sebelumnya
			const hasUserActivation = typeof navigator !== 'undefined' &&
				Boolean((navigator as any).userActivation?.hasBeenActive);

			if (soundEnabled && hasUserActivation) {
				videoElement.muted = false;
				videoElement.volume = 1.0;
				isMuted = false;
				isAudioBlocked = false;
			} else {
				isMuted = true;
				isAudioBlocked = soundEnabled;
			}
		} catch (err: unknown) {
			const errName = (err as Error)?.name;
			if (errName === 'AbortError') {
				// AbortError wajar saat browser masih menginisialisasi buffer stream
				return;
			}
			console.warn('[AnnouncementSlide] Autoplay awal terhambat, mencoba pemutaran muted:', err);
			if (videoElement) {
				videoElement.muted = true;
				videoElement.defaultMuted = true;
				isMuted = true;
				try {
					await videoElement.play();
					isPlaying = true;
					lastProgressStamp = Date.now();
				} catch (playErr) {
					if ((playErr as Error)?.name !== 'AbortError') {
						console.error('[AnnouncementSlide] Pemutaran video gagal:', playErr);
					}
				}
			}
		} finally {
			playAttemptInProgress = false;
		}
	}

	// Perbarui progress bar lingkaran realtime mengikuti durasi pemutaran video
	function handleTimeUpdate() {
		if (!videoElement) return;

		const current = videoElement.currentTime;
		const dur = videoElement.duration;

		// Jika waktu video bertambah, perbarui stempel aktif
		if (current > lastCurrentTime) {
			lastCurrentTime = current;
			lastProgressStamp = Date.now();
		}

		if (dur && !isNaN(dur) && dur > 0) {
			const percent = (current / dur) * 100;
			onProgress?.(percent);
		}
	}

	function handleLoadedMetadata() {
		lastProgressStamp = Date.now();
		if (videoElement && videoElement.paused) {
			safePlayVideo();
		}
	}

	// Unmute audio saat pengunjung/petugas menyentuh layar
	function unlockAudio() {
		if (videoElement && soundEnabled) {
			try {
				videoElement.muted = false;
				videoElement.volume = 1.0;
				isMuted = false;
				isAudioBlocked = false;
				if (videoElement.paused) {
					videoElement.play().catch(console.warn);
				}
			} catch (e) {
				console.warn('[AnnouncementSlide] Gagal membuka audio:', e);
			}
		}
	}

	// Penanganan event ended dari video: Pastikan video BENAR-BENAR terputar sempurna sampai habis!
	function handleVideoEnded() {
		if (videoElement && videoElement.duration && !isNaN(videoElement.duration) && videoElement.duration > 0) {
			// Jika posisi waktu masih jauh dari akhir durasi (selisih > 1.5 detik),
			// ini merupakan event ended prematur atau stream terputus sementara.
			if (videoElement.currentTime < videoElement.duration - 1.5) {
				console.warn(
					`[AnnouncementSlide] Event ended prematur terdeteksi pada ${videoElement.currentTime.toFixed(1)}s dari total ${videoElement.duration.toFixed(1)}s. Melanjutkan pemutaran...`
				);
				safePlayVideo();
				return;
			}
		}

		console.info('[AnnouncementSlide] Video telah selesai diputar secara sempurna sampai habis.');
		cleanupTimers();
		onProgress?.(100);
		onSlideComplete();
	}

	// Penanganan error video
	function handleVideoError(e?: Event) {
		console.warn('[AnnouncementSlide] Video error event:', e);

		// Jika video sudah sempat berputar (currentTime > 0), ini hanya glitch koneksi sementara, jangan batalkan slide
		if (videoElement && videoElement.currentTime > 0 && !videoElement.ended) {
			console.info('[AnnouncementSlide] Mencoba melanjutkan pemutaran video aktif...');
			safePlayVideo();
			return;
		}

		// Jika belum pernah mencoba fallback ke /api/stream dan URL bukan link HTTP eksternal
		if (!attemptedStreamFallback && !activeVideoSrc.startsWith('http') && !activeVideoSrc.startsWith('/api/stream')) {
			console.info('[AnnouncementSlide] Mencoba memuat ulang video melalui streaming endpoint /api/stream...');
			attemptedStreamFallback = true;
			overrideVideoSrc = `/api/stream?file=${encodeURIComponent(media.public_url)}`;
			if (videoElement) {
				videoElement.load();
				safePlayVideo();
			}
			return;
		}

		// Jika benar-benar berkas corrupt atau tidak ditemukan sejak awal
		console.error('[AnnouncementSlide] Berkas media video tidak dapat dimuat.');
		hasError = true;
		cleanupTimers();
		fallbackTimer = setTimeout(() => {
			onSlideComplete();
		}, 8000); // Berikan waktu 8 detik agar notifikasi error terbaca sebelum beralih
	}

	function handleVideoStalled() {
		console.warn('[AnnouncementSlide] Media video buffering / stalled sejenak...');
	}

	function handleImageError() {
		console.warn('[AnnouncementSlide] Gambar pengumuman gagal dimuat, menampilkan fallback elegan...');
		hasImageError = true;
	}

	function cleanupTimers() {
		if (fallbackTimer) {
			clearTimeout(fallbackTimer);
			fallbackTimer = null;
		}
		if (ytProgressInterval) {
			clearInterval(ytProgressInterval);
			ytProgressInterval = null;
		}
		if (ytTimer) {
			clearTimeout(ytTimer);
			ytTimer = null;
		}
		if (freezeCheckInterval) {
			clearInterval(freezeCheckInterval);
			freezeCheckInterval = null;
		}
	}

	onMount(() => {
		if (media.media_type === 'video') {
			if (parsedMedia.type === 'youtube') {
				let currentSec = 0;
				const ytDuration = 30;
				ytProgressInterval = setInterval(() => {
					currentSec += 0.2;
					onProgress?.(Math.min(100, (currentSec / ytDuration) * 100));
				}, 200);

				ytTimer = setTimeout(() => {
					handleVideoEnded();
				}, ytDuration * 1000);
			} else {
				if (videoElement) {
					safePlayVideo();
				}

				// Pengawas anti-freeze: Hanya melompat jika video macet total di detik yang sama selama > 35 detik
				freezeCheckInterval = setInterval(() => {
					if (!videoElement || videoElement.ended || hasError) return;
					if (Date.now() - lastProgressStamp > 35000) {
						console.warn('[AnnouncementSlide] Video macet tanpa pergerakan selama 35 detik, memajukan slide...');
						handleVideoEnded();
					}
				}, 5000);

				// Listener global: sentuhan pertama pada layar langsung mengaktifkan audio
				window.addEventListener('click', unlockAudio);
				window.addEventListener('touchstart', unlockAudio);

				return () => {
					window.removeEventListener('click', unlockAudio);
					window.removeEventListener('touchstart', unlockAudio);
				};
			}
		}
	});

	onDestroy(() => {
		cleanupTimers();
		if (videoElement) {
			try {
				videoElement.pause();
				videoElement.src = '';
				videoElement.load();
			} catch {
				// Abaikan jika video sudah dibersihkan
			}
		}
	});
</script>

<div class="announcement-slide">
	<!-- Top Bar Judul Pengumuman -->
	<div class="announcement-header">
		<div class="announcement-tag">
			<Sparkles size={14} class="tag-icon" />
			<span>INFORMASI & EDUKASI KESEHATAN</span>
		</div>
		<h2 class="announcement-title">{media.title}</h2>
	</div>

	<!-- Media Display Container -->
	<div class="media-container">
		{#if media.media_type === 'video'}
			{#if hasError}
				<div class="error-fallback">
					<AlertCircle size={48} class="error-icon" />
					<h3>Video Sedang Tidak Dapat Dimuat</h3>
					<p>Beralih ke slide berikutnya secara otomatis dalam 8 detik...</p>
					<span class="source-debug-info">Sumber: {media.public_url}</span>
				</div>
			{:else if parsedMedia.type === 'youtube'}
				<!-- Pemutar Khusus Tautan YouTube Embed -->
				<div class="youtube-frame-wrapper">
					<iframe
						src={MediaUrlService.getYouTubeEmbedUrl(parsedMedia.youtubeId!, soundEnabled)}
						class="media-youtube-iframe"
						title={media.title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowfullscreen
					></iframe>
					<div class="youtube-kiosk-badge">
						<ExternalLink size={14} />
						<span>YouTube Video Edukasi RSUD</span>
					</div>
				</div>
			{:else}
				<!-- Pemutar Tag Video Berkinerja Tinggi & Anti-Stuck -->
				<video
					bind:this={videoElement}
					src={activeVideoSrc}
					class="media-video"
					playsinline
					autoplay
					muted={true}
					preload="auto"
					ontimeupdate={handleTimeUpdate}
					onended={handleVideoEnded}
					onerror={handleVideoError}
					onstalled={handleVideoStalled}
					onloadedmetadata={handleLoadedMetadata}
				>
					<track kind="captions" />
				</video>

				<!-- Indikator Suara & Kontrol Unmute untuk Kiosk Android TV -->
				<div class="audio-control-wrap">
					{#if isAudioBlocked || isMuted}
						<button
							type="button"
							class="sound-badge muted"
							onclick={unlockAudio}
							title="Klik untuk membunyikan suara TV"
						>
							<VolumeX size={20} />
							<span>Ketuk Layar untuk Mengaktifkan Suara TV</span>
						</button>
					{:else}
						<div class="sound-badge active">
							<Volume2 size={20} />
							<span>Audio Aktif</span>
						</div>
					{/if}
				</div>
			{/if}
		{:else}
			<!-- Tampilan Media Gambar (PNG, JPG, WebP) - Menyesuaikan Utuh ke Kotak Dialog Tanpa Terpotong -->
			<div class="image-wrapper">
				{#if hasImageError}
					<div class="error-fallback">
						<Sparkles size={48} class="error-icon" />
						<h3>{media.title}</h3>
						<p>Informasi edukasi kesehatan masyarakat RSUD H. Andi Sulthan Daeng Radja.</p>
					</div>
				{:else}
					<!-- Ambient Backdrop Lembut untuk Mengisi Ruang Samping/Atas-Bawah secara Elegan -->
					<div
						class="image-ambient-backdrop"
						style="background-image: url('{encodeURI(parsedMedia.resolvedUrl)}');"
						aria-hidden="true"
					></div>

					<!-- Gambar Utama: Pas & Utuh di dalam Kotak Dialog, 100% Bebas Terpotong -->
					<img
						src={parsedMedia.resolvedUrl}
						alt={media.title}
						class="media-image"
						loading="eager"
						onerror={handleImageError}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.announcement-slide {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 0.85rem;
		animation: fadeIn 0.4s ease-out;
	}

	.announcement-header {
		position: relative;
		background: #FFFFFF;
		border-radius: 1rem;
		padding: 1.95rem 1.25rem 0.65rem 1.25rem;
		border: 1px solid #E2E8F0;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
		overflow: hidden;
	}

	.announcement-tag {
		position: absolute;
		top: 0;
		left: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: linear-gradient(135deg, #E8F5E9 0%, #D1FAE5 100%);
		color: #0A5C36;
		padding: 0.3rem 0.95rem 0.35rem 0.85rem;
		border-bottom-right-radius: 0.75rem;
		border-top-left-radius: 1rem;
		font-size: 0.725rem;
		font-weight: 850;
		letter-spacing: 0.05em;
		border-right: 1.5px solid #C8E6C9;
		border-bottom: 1.5px solid #C8E6C9;
		box-shadow: 0 1px 3px rgba(10, 92, 54, 0.06);
	}

	:global(.tag-icon) {
		color: #E06A26;
		flex-shrink: 0;
	}

	.announcement-title {
		font-size: 1.25rem;
		font-weight: 850;
		color: #0F172A;
		margin: 0;
		line-height: 1.35;
		letter-spacing: -0.01em;
	}

	.media-container {
		flex: 1;
		background: #000000;
		border-radius: 1.5rem;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		min-height: 480px;
	}

	.media-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000000;
	}

	.youtube-frame-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000000;
	}

	.media-youtube-iframe {
		width: 100%;
		height: 100%;
		min-height: 500px;
		border: none;
	}

	.youtube-kiosk-badge {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(15, 23, 42, 0.85);
		color: #FFFFFF;
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		z-index: 5;
		pointer-events: none;
	}

	.image-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0B1120;
		overflow: hidden;
		border-radius: 1.5rem;
	}

	.image-ambient-backdrop {
		position: absolute;
		inset: -25px;
		background-size: cover;
		background-position: center;
		filter: blur(32px) brightness(0.38);
		opacity: 0.7;
		z-index: 1;
		transform: scale(1.12);
		pointer-events: none;
	}

	.media-image {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		object-position: center;
		padding: clamp(0.25rem, 1vh, 0.75rem);
		box-sizing: border-box;
		filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.6));
		animation: softImageFade 0.4s ease-out;
	}

	@keyframes softImageFade {
		from {
			opacity: 0.6;
			transform: scale(0.98);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.audio-control-wrap {
		position: absolute;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 10;
	}

	.sound-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 1.25rem;
		border-radius: 9999px;
		font-size: 0.85rem;
		font-weight: 700;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transition: all 0.2s ease;
	}

	.sound-badge.active {
		background: rgba(10, 92, 54, 0.85);
		color: #FFFFFF;
		border: 1px solid rgba(52, 211, 153, 0.4);
	}

	.sound-badge.muted {
		background: rgba(225, 29, 72, 0.9);
		color: #FFFFFF;
		border: 1px solid rgba(255, 255, 255, 0.3);
		cursor: pointer;
		animation: pulseBtn 2s infinite;
	}

	.error-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: #CBD5E1;
		text-align: center;
	}

	:global(.error-icon) {
		color: #F87171;
		margin-bottom: 1rem;
	}

	.error-fallback h3 {
		color: #FFFFFF;
		margin-bottom: 0.5rem;
	}

	.error-fallback p {
		font-size: 0.9rem;
		color: #94A3B8;
		margin-bottom: 0.75rem;
	}

	.source-debug-info {
		font-size: 0.75rem;
		color: #64748B;
		font-family: monospace;
		background: rgba(255, 255, 255, 0.05);
		padding: 0.25rem 0.5rem;
		border-radius: 0.35rem;
		max-width: 90%;
		word-break: break-all;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.99);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes pulseBtn {
		0% {
			box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.6);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(225, 29, 72, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(225, 29, 72, 0);
		}
	}

	@media (max-width: 640px) {
		.announcement-header {
			padding: 1.8rem 1rem 0.55rem 1rem;
			border-radius: 0.85rem;
		}

		.announcement-tag {
			font-size: 0.65rem;
			padding: 0.25rem 0.75rem;
			border-top-left-radius: 0.85rem;
			border-bottom-right-radius: 0.65rem;
		}

		.announcement-title {
			font-size: 1.05rem;
		}
	}
</style>
