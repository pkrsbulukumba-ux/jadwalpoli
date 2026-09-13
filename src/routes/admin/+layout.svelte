<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		LayoutDashboard,
		Building2,
		UserCheck,
		ImagePlay,
		Sliders,
		Tv,
		LogOut,
		Lock,
		Menu,
		X,
		RefreshCw,
		CloudUpload,
		CheckCircle2,
		AlertTriangle
	} from '@lucide/svelte';
	import { AuthService } from '$lib/services/auth.service';
	import { kioskSettings } from '$lib/stores/kiosk.store';
	import { DataRepository } from '$lib/services/data.repository';
	import { isSupabaseConfigured } from '$lib/supabase/client';

	let { children } = $props();

	// === Sync Button State ===
	let isSyncing = $state(false);
	let syncToast = $state<{ show: boolean; success: boolean; message: string }>({
		show: false,
		success: true,
		message: ''
	});
	let syncToastTimer: ReturnType<typeof setTimeout> | null = null;

	function showSyncToast(success: boolean, message: string) {
		if (syncToastTimer) clearTimeout(syncToastTimer);
		syncToast = { show: true, success, message };
		syncToastTimer = setTimeout(() => {
			syncToast = { show: false, success: true, message: '' };
		}, 4000);
	}

	async function handleSyncToCloud() {
		if (!isSupabaseConfigured()) {
			showSyncToast(false, 'Supabase belum dikonfigurasi. Pastikan .env sudah terisi.');
			return;
		}
		if (isSyncing) return;
		isSyncing = true;
		try {
			const result = await DataRepository.syncToSupabase();
			if (result.success) {
				const counts = DataRepository.getDashboardStats();
				showSyncToast(
					true,
					`Sinkronisasi berhasil! ${counts.activePolyclinics} poli, ${counts.activeDoctors} dokter, ${counts.schedulesToday} jadwal hari ini terkirim ke cloud.`
				);
			} else {
				showSyncToast(false, result.message || 'Gagal menyinkronkan data ke cloud.');
			}
		} catch (e: unknown) {
			showSyncToast(false, `Gagal sinkron: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			isSyncing = false;
		}
	}

	const navItems = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/poli', label: 'Poliklinik', icon: Building2 },
		{ href: '/admin/doctors-jadwal', label: 'Dokter & Jadwal', icon: UserCheck },
		{ href: '/admin/media', label: 'Media Pengumuman', icon: ImagePlay },
		{ href: '/admin/kiosk-settings', label: 'Pengaturan Kiosk', icon: Sliders }
	];

	let idleCheckTimer: ReturnType<typeof setInterval> | null = null;
	let isAuthorized = $state(AuthService.isAuthorized());
	let isMobileNavOpen = $state(false);

	function toggleMobileNav() {
		isMobileNavOpen = !isMobileNavOpen;
	}

	function closeMobileNav() {
		isMobileNavOpen = false;
	}

	// Deteksi rute halaman login agar terisolasi tanpa sidebar/topbar
	let isLoginPage = $derived(page.url.pathname === '/admin/login');

	function handleUserActivity() {
		AuthService.recordUserActivity();
	}

	function handleLockKiosk() {
		AuthService.logout();
		isAuthorized = false;
		goto('/kiosk');
	}

	// Reactive Route Guard: Jika user belum terotentikasi dan mencoba mengakses rute admin, arahkan ke login
	$effect(() => {
		const currentPath = page.url.pathname;
		// Tutup menu mobile setiap kali rute berubah
		isMobileNavOpen = false;
		if (browser) {
			const authed = AuthService.isAuthorized();
			isAuthorized = authed;
			if (!authed && currentPath !== '/admin/login') {
				goto('/admin/login', { replaceState: true });
			}
		}
	});

	onMount(() => {
		// Subscribe perubahan sessionStore secara reaktif
		const unsubscribe = AuthService.sessionStore.subscribe((session) => {
			isAuthorized = !!session && session.isAuthorized;
			if (browser && !isAuthorized && page.url.pathname !== '/admin/login') {
				goto('/admin/login', { replaceState: true });
			}
		});

		// Catat aktivitas jika sudah login
		if (isAuthorized) {
			AuthService.recordUserActivity();
		}

		// Event listener interaksi untuk mereset timer idle
		window.addEventListener('mousemove', handleUserActivity);
		window.addEventListener('keydown', handleUserActivity);
		window.addEventListener('touchstart', handleUserActivity);
		window.addEventListener('click', handleUserActivity);

		// Pengecekan timeout idle setiap 15 detik
		idleCheckTimer = setInterval(() => {
			if (!isLoginPage && !AuthService.isAuthorized()) {
				AuthService.logout();
				isAuthorized = false;
				goto('/admin/login', { replaceState: true });
			}
		}, 15000);

		return () => {
			unsubscribe();
			window.removeEventListener('mousemove', handleUserActivity);
			window.removeEventListener('keydown', handleUserActivity);
			window.removeEventListener('touchstart', handleUserActivity);
			window.removeEventListener('click', handleUserActivity);
			if (idleCheckTimer) clearInterval(idleCheckTimer);
		};
	});

onDestroy(() => {
		if (idleCheckTimer) clearInterval(idleCheckTimer);
		if (syncToastTimer) clearTimeout(syncToastTimer);
	});
</script>

{#if isLoginPage}
	<!-- Halaman Login / Unlock Kiosk standalone tanpa sidebar & topbar -->
	<div class="cms-login-viewport">
		{@render children()}
	</div>
{:else if isAuthorized}
	<!-- Panel CMS Admin Terbuka Penuh dengan Sticky Sidebar & Topbar Responsif -->
	<div class="cms-shell">
		{#if isMobileNavOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="mobile-nav-backdrop" onclick={closeMobileNav}></div>
		{/if}

		<!-- Sidebar CMS (5 Menu Utama sesuai PRD Section 6.1) -->
		<aside class="cms-sidebar" class:mobile-open={isMobileNavOpen}>
			<div class="sidebar-brand">
				<div class="brand-badge">
					<span class="cross-icon">✚</span>
				</div>
				<div class="brand-text-group">
					<h2 class="brand-title">CMS RSUD</h2>
					<span class="brand-sub">Panel Kiosk Poliklinik</span>
				</div>
				<button type="button" class="sidebar-close-btn" onclick={closeMobileNav} aria-label="Tutup Menu">
					<X size={20} />
				</button>
			</div>

			<nav class="sidebar-nav">
				{#each navItems as item}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="nav-link"
						class:active={page.url.pathname === item.href}
						onclick={closeMobileNav}
					>
						<Icon size={18} />
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>

			<!-- Footer Sidebar: Tampilkan Kiosk & Kunci Kiosk Konsisten -->
			<div class="sidebar-footer">
				<a href="/kiosk" class="footer-action-btn view-kiosk" title="Tampilkan Layar Kiosk Publik">
					<Tv size={18} />
					<span>Tampilkan Kiosk</span>
				</a>
				<button
					type="button"
					class="footer-action-btn logout"
					onclick={handleLockKiosk}
					title="Kunci Kiosk dan keluar dari CMS"
				>
					<LogOut size={18} />
					<span>Kunci Kiosk</span>
				</button>
			</div>
		</aside>

		<!-- Main Content Area -->
		<div class="cms-main">
			<header class="cms-topbar">
				<div class="topbar-left">
					<button
						type="button"
						class="mobile-menu-btn"
						onclick={toggleMobileNav}
						aria-label={isMobileNavOpen ? 'Tutup navigasi' : 'Buka menu navigasi'}
					>
						{#if isMobileNavOpen}
							<X size={22} />
						{:else}
							<Menu size={22} />
						{/if}
					</button>

					<div class="topbar-title">
						<h3>{$kioskSettings.hospital_name || 'RSUD H. Andi Sulthan Daeng Radja'}</h3>
						<span class="topbar-subtitle">{$kioskSettings.hospital_subtitle || 'Kabupaten Bulukumba'} • Kiosk Display</span>
					</div>
				</div>

				<div class="topbar-actions">
					<a href="/kiosk" class="topbar-btn topbar-view-kiosk" title="Tampilkan Layar Kiosk Publik">
						<Tv size={16} />
						<span class="btn-text">Kiosk</span>
					</a>
					<button
						type="button"
						class="topbar-btn topbar-sync-btn"
						onclick={handleSyncToCloud}
						disabled={isSyncing}
						title="Kirim semua data lokal (poli, dokter, jadwal, media) ke database Supabase online"
					>
						{#if isSyncing}
							<RefreshCw size={16} class="spin" />
							<span class="btn-text">Menyinkron...</span>
						{:else}
							<CloudUpload size={16} />
							<span class="btn-text">Sinkron</span>
						{/if}
					</button>
					<button
						type="button"
						class="topbar-btn topbar-lock-kiosk"
						onclick={handleLockKiosk}
						title="Kunci Kiosk dan keluar dari CMS"
					>
						<LogOut size={16} />
						<span class="btn-text">Kunci</span>
					</button>
					<span class="operator-badge">Operator Aktif</span>
				</div>
			</header>

			<!-- Toast Notifikasi Sinkronisasi -->
			{#if syncToast.show}
				<div class="sync-toast {syncToast.success ? 'toast-success' : 'toast-error'}" role="status" aria-live="polite">
					{#if syncToast.success}
						<CheckCircle2 size={18} />
					{:else}
						<AlertTriangle size={18} />
					{/if}
					<span>{syncToast.message}</span>
				</div>
			{/if}

			<main class="cms-content">
				{@render children()}
			</main>
		</div>
	</div>
{:else}
	<!-- Fallback Layar Terkunci saat proses pengalihan ke /admin/login -->
	<div class="cms-locked-screen">
		<div class="locked-card">
			<div class="locked-icon-bubble">
				<Lock size={36} color="#DC2626" />
			</div>
			<h2>Akses Terkunci</h2>
			<p>Anda harus memasukkan Master PIN atau Login Petugas untuk mengakses panel CMS Admin.</p>
			<div class="locked-action">
				<a href="/admin/login" class="btn-unlock-kiosk">Masukkan PIN / Buka Kunci</a>
				<a href="/kiosk" class="btn-back-kiosk">Kembali ke Layar Kiosk</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.cms-login-viewport {
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.cms-shell {
		display: flex;
		min-height: 100vh;
		background: #F8FAFC;
		font-family: inherit;
	}

	.cms-sidebar {
		width: 260px;
		background: #FFFFFF;
		border-right: 1px solid #E2E8F0;
		display: flex;
		flex-direction: column;
		padding: 1.5rem 1.15rem;
		position: sticky;
		top: 0;
		height: 100vh;
		box-sizing: border-box;
		z-index: 40;
		flex-shrink: 0;
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #F1F5F9;
		margin-bottom: 1.25rem;
	}

	.brand-badge {
		width: 40px;
		height: 40px;
		background: #0A5C36;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cross-icon {
		color: white;
		font-weight: 800;
		font-size: 1.25rem;
	}

	.brand-title {
		font-size: 1.1rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.brand-sub {
		font-size: 0.75rem;
		color: #64748B;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex: 1;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.65rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #475569;
		transition: all 0.15s ease;
	}

	.nav-link:hover {
		background: #F1F5F9;
		color: #0A5C36;
	}

	.nav-link.active {
		background: #E8F5E9;
		color: #0A5C36;
		font-weight: 700;
	}

	.sidebar-footer {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding-top: 1.25rem;
		margin-top: auto;
		border-top: 1px solid #E2E8F0;
	}

	.footer-action-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.15rem;
		border-radius: 0.75rem;
		font-size: 0.925rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
		font-family: inherit;
		text-decoration: none;
		box-sizing: border-box;
		transition: all 0.2s ease;
	}

	.view-kiosk {
		background: #0A5C36;
		color: #FFFFFF;
		box-shadow: 0 2px 6px rgba(10, 92, 54, 0.18);
	}

	.view-kiosk:hover {
		background: #074327;
		transform: translateY(-1px);
		box-shadow: 0 4px 10px rgba(10, 92, 54, 0.28);
	}

	.logout {
		color: #EF4444;
		background: #FFF1F2;
	}

	.logout:hover {
		background: #FEE2E2;
		color: #DC2626;
		transform: translateY(-1px);
	}

	.cms-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cms-topbar {
		background: white;
		border-bottom: 1px solid #E2E8F0;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 30;
	}

	.topbar-title h3 {
		font-size: 1.15rem;
		color: #0F172A;
		margin: 0;
	}

	.topbar-subtitle {
		font-size: 0.8rem;
		color: #64748B;
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.topbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.95rem;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		border: none;
		font-family: inherit;
		transition: all 0.15s ease;
	}

	.topbar-view-kiosk {
		background: #0A5C36;
		color: #FFFFFF;
	}

	.topbar-view-kiosk:hover {
		background: #074327;
	}

	.topbar-lock-kiosk {
		background: #FFF1F2;
		color: #EF4444;
	}

	.topbar-lock-kiosk:hover {
		background: #FEE2E2;
		color: #DC2626;
	}

	.operator-badge {
		background: #D1FAE5;
		color: #047857;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 9999px;
	}

	.cms-content {
		flex: 1;
		padding: 2rem;
	}

	/* Fallback Screen saat Terkunci */
	.cms-locked-screen {
		min-height: 100vh;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0F172A;
		padding: 2rem;
		box-sizing: border-box;
	}

	.locked-card {
		background: #1E293B;
		border: 1px solid #334155;
		border-radius: 1.5rem;
		padding: 2.5rem 2rem;
		text-align: center;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
	}

	.locked-icon-bubble {
		width: 72px;
		height: 72px;
		background: #FEF2F2;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.25rem;
		border: 4px solid #FEE2E2;
	}

	.locked-card h2 {
		color: #F8FAFC;
		font-size: 1.5rem;
		font-weight: 800;
		margin: 0 0 0.5rem 0;
	}

	.locked-card p {
		color: #94A3B8;
		font-size: 0.9rem;
		line-height: 1.5;
		margin: 0 0 1.75rem 0;
	}

	.locked-action {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn-unlock-kiosk {
		display: block;
		background: #0A5C36;
		color: #FFFFFF;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.85rem 1.25rem;
		border-radius: 0.75rem;
		text-decoration: none;
		transition: background 0.2s;
	}

	.btn-unlock-kiosk:hover {
		background: #074327;
	}

	.btn-back-kiosk {
		display: block;
		background: #334155;
		color: #CBD5E1;
		font-weight: 600;
		font-size: 0.875rem;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		text-decoration: none;
		transition: background 0.2s;
	}

	.btn-back-kiosk:hover {
		background: #475569;
		color: #FFFFFF;
	}

	/* --- Responsive Layout & Mobile Drawer Styles --- */
	.topbar-left {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	.mobile-menu-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 0.65rem;
		border: 1px solid #E2E8F0;
		background: #F8FAFC;
		color: #1E293B;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	.mobile-menu-btn:hover {
		background: #E2E8F0;
		color: #0A5C36;
	}

	.sidebar-close-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 0.5rem;
		border: 1px solid #E2E8F0;
		background: #F8FAFC;
		color: #64748B;
		cursor: pointer;
		margin-left: auto;
		transition: all 0.15s ease;
	}

	.sidebar-close-btn:hover {
		background: #FEE2E2;
		color: #DC2626;
	}

	.mobile-nav-backdrop {
		display: none;
	}

	@media (max-width: 900px) {
		.mobile-menu-btn {
			display: flex;
		}

		.sidebar-close-btn {
			display: flex;
		}

		.mobile-nav-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(15, 23, 42, 0.45);
			backdrop-filter: blur(4px);
			z-index: 45;
			animation: fadeInBackdrop 0.2s ease-out;
		}

		.cms-sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100vh;
			z-index: 50;
			transform: translateX(-100%);
			transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
			width: 280px;
		}

		.cms-sidebar.mobile-open {
			transform: translateX(0);
		}

		.cms-topbar {
			padding: 0.75rem 1rem;
		}

		.cms-content {
			padding: 1.25rem 1rem;
		}
	}

	@media (max-width: 640px) {
		.topbar-subtitle {
			display: none;
		}

		.topbar-title h3 {
			font-size: 0.95rem;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			max-width: 170px;
		}

		.topbar-actions {
			gap: 0.4rem;
		}

		.topbar-btn {
			padding: 0.45rem 0.6rem;
		}

		.topbar-btn .btn-text {
			display: none;
		}

		.operator-badge {
			display: none;
		}

		.cms-content {
			padding: 0.85rem 0.65rem;
		}
	}

	@keyframes fadeInBackdrop {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* === Tombol Sinkron (Push ke Cloud) === */
	.topbar-sync-btn {
		background: #2563EB;
		color: #FFFFFF;
	}

	.topbar-sync-btn:hover:not(:disabled) {
		background: #1D4ED8;
	}

	.topbar-sync-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	:global(.spin) {
		animation: spinIcon 1s linear infinite;
	}

	@keyframes spinIcon {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* === Toast Notifikasi Sinkronisasi === */
	.sync-toast {
		position: fixed;
		top: 4.5rem;
		right: 1.5rem;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1.15rem;
		border-radius: 0.85rem;
		font-size: 0.875rem;
		font-weight: 600;
		max-width: 380px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
		animation: toastSlideIn 0.25s ease-out;
		line-height: 1.4;
	}

	.sync-toast.toast-success {
		background: #ECFDF5;
		border: 1.5px solid #6EE7B7;
		color: #065F46;
	}

	.sync-toast.toast-error {
		background: #FEF2F2;
		border: 1.5px solid #FCA5A5;
		color: #B91C1C;
	}

	@keyframes toastSlideIn {
		from {
			opacity: 0;
			transform: translateX(20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (max-width: 640px) {
		.sync-toast {
			top: auto;
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}
</style>
