<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import '$lib/styles/global.css';
	import { OfflineService } from '$lib/services/offline.service';

	let { children } = $props();

	onMount(() => {
		// Inisialisasi pemantauan status jaringan offline/online
		OfflineService.init();

		// Pendaftaran Service Worker untuk caching offline TV Kiosk
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.info('[Kiosk App] Service Worker terdaftar dengan scope:', registration.scope);
				})
				.catch((error) => {
					console.warn('[Kiosk App] Registrasi Service Worker gagal atau dibatasi:', error);
				});
		}
	});
</script>

<svelte:head>
	<title>Kiosk Jadwal Poliklinik RSUD</title>
</svelte:head>

{@render children()}
