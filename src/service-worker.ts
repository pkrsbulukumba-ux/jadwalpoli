/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Buat nama cache unik berdasarkan versi build SvelteKit
const CACHE_NAME = `kiosk-cache-v${version}`;

// Gabungkan berkas bundle hasil build Vite dan aset statis (gambar, font, logo)
const ASSETS_TO_CACHE = [...build, ...files];

/**
 * Event Install: Pre-cache seluruh aset aplikasi Kiosk
 */
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				return cache.addAll(ASSETS_TO_CACHE);
			})
			.then(() => {
				return sw.skipWaiting();
			})
	);
});

/**
 * Event Activate: Bersihkan cache versi lama saat rilis baru diterapkan
 */
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys.map((key) => {
						if (key !== CACHE_NAME) {
							return caches.delete(key);
						}
					})
				);
			})
			.then(() => {
				return sw.clients.claim();
			})
	);
});

/**
 * Event Fetch: Strategi Cache-First untuk aset statis, dan Network-First dengan Cache Fallback untuk halaman
 */
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Hanya tangani HTTP/HTTPS GET request
	if (event.request.method !== 'GET') return;

	// Jangan cache API eksternal atau skema selain http/https
	if (!url.protocol.startsWith('http')) return;

	// 1. Aset Statis (Bundle JS, CSS, Media Statis): Cache-First
	if (ASSETS_TO_CACHE.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE_NAME).then(async (cache) => {
				const cachedResponse = await cache.match(event.request);
				if (cachedResponse) {
					return cachedResponse;
				}
				const networkResponse = await fetch(event.request);
				if (networkResponse.status === 200) {
					cache.put(event.request, networkResponse.clone());
				}
				return networkResponse;
			})
		);
		return;
	}

	// 2. Navigasi Halaman HTML / Rute Kiosk: Network-First dengan Fallback ke Cache
	if (event.request.headers.get('accept')?.includes('text/html') || url.pathname.startsWith('/kiosk')) {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Jika online dan sukses, perbarui salinan cache
					if (response.status === 200) {
						const responseClone = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, responseClone);
						});
					}
					return response;
				})
				.catch(async () => {
					// Jika offline/jaringan mati, ambil dari cache
					const cache = await caches.open(CACHE_NAME);
					const cachedResponse = await cache.match(event.request);
					if (cachedResponse) {
						return cachedResponse;
					}

					// Fallback alternatif ke halaman /kiosk yang ter-cache
					const kioskFallback = await cache.match('/kiosk');
					if (kioskFallback) {
						return kioskFallback;
					}

					// Jika tidak ada di cache sama sekali, kembalikan offline fallback response sederhana
					return new Response(
						`<!DOCTYPE html>
						<html lang="id">
						<head>
							<meta charset="utf-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1" />
							<title>Kiosk Poliklinik RSUD - Mode Siaga Offline</title>
							<style>
								body { margin: 0; background: #EEF5F1; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; color: #0F172A; }
								.box { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1); max-width: 480px; margin: 1rem; }
								h1 { color: #0A5C36; font-size: 1.5rem; margin-bottom: 0.5rem; }
								p { color: #64748B; font-size: 0.95rem; line-height: 1.5; }
								.badge { display: inline-block; background: #FEF3C7; color: #92400E; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; margin-top: 1rem; }
							</style>
						</head>
						<body>
							<div class="box">
								<h1>Kiosk Poliklinik RSUD</h1>
								<p>Perangkat sedang berjalan dalam mode offline lokal. Menunggu sinkronisasi jaringan dipulihkan...</p>
								<div class="badge">Mode Siaga Lokal Aktif</div>
							</div>
							<script>
								window.addEventListener('online', () => window.location.reload());
								setTimeout(() => window.location.reload(), 15000);
							</script>
						</body>
						</html>`,
						{ headers: { 'Content-Type': 'text/html' } }
					);
				})
		);
		return;
	}

	// 3. Permintaan lainnya (Fetch API, data, font): Network dengan Fallback Cache
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				if (response.status === 200) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				return response;
			})
			.catch(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cached = await cache.match(event.request);
				if (cached) return cached;
				return new Response('', { status: 408, statusText: 'Offline Fallback' });
			})
	);
});
