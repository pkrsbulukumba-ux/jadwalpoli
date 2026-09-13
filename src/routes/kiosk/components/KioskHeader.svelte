<script lang="ts">
	import { onMount } from "svelte";
	import { Lock, LockOpen, Stethoscope } from "@lucide/svelte";
	import DigitalClock from "./DigitalClock.svelte";
	import PageIndicator from "./PageIndicator.svelte";

	interface Props {
		hospitalName?: string;
		hospitalSubtitle?: string;
		logoUrl?: string;
		timezone?: string;
		isOffline?: boolean;
		lastSyncText?: string;
		currentPage?: number;
		totalPages?: number;
		slideDuration?: number; // detik
		progressPercent?: number; // 0 - 100
		isUnlocked?: boolean;
		onLockClick?: () => void;
		onPageChange?: (page: number) => void;
	}

	let {
		hospitalName = "RSUD H. Andi Sulthan Daeng Radja",
		hospitalSubtitle = "Kabupaten Bulukumba",
		logoUrl = "",
		timezone = "Asia/Makassar",
		isOffline = false,
		lastSyncText = "",
		currentPage = 1,
		totalPages = 8,
		slideDuration = 15,
		progressPercent = 35,
		isUnlocked = false,
		onLockClick,
		onPageChange,
	}: Props = $props();

	let formattedDate = $state("8 September 2026");

	onMount(() => {
		const now = new Date();
		formattedDate = new Intl.DateTimeFormat("id-ID", {
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(now);
	});
</script>

<header
	class="kiosk-header"
	style="background-color: #0a5c36 !important; background-image: linear-gradient(100deg, #df5720 0%, #df5720 30%, #da6226 36%, #b57933 46%, #578b45 56%, #178750 66%, #0e7743 82%, #0a5c36 100%) !important;"
>
	<!-- Baris Atas: Identitas RSUD & Jam Digital -->
	<div class="header-top">
		<div class="brand-group">
			<!-- Logo RSUD Circular Emblem -->
			<div class="logo-container" aria-label="Logo RSUD">
				{#if logoUrl}
					<div class="logo-circle has-img">
						<img
							src={logoUrl}
							alt={hospitalName}
							class="logo-img"
						/>
					</div>
				{:else}
					<div class="logo-circle">
						<svg
							viewBox="0 0 100 100"
							class="logo-svg"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<!-- Outer Ring with Golden Leaves Effect -->
							<circle
								cx="50"
								cy="50"
								r="46"
								stroke="#0A5C36"
								stroke-width="3"
								fill="#FFFFFF"
							/>
							<circle
								cx="50"
								cy="50"
								r="41"
								stroke="#E06A26"
								stroke-width="1.5"
								stroke-dasharray="3 2"
							/>
							<!-- Green Cross Emblem -->
							<path
								d="M44 26H56V44H74V56H56V74H44V56H26V44H44V26Z"
								fill="#0A5C36"
								rx="2"
							/>
							<!-- Inner Golden Star / Sparkle -->
							<circle cx="50" cy="50" r="5" fill="#F59E0B" />
						</svg>
					</div>
				{/if}
			</div>

			<div class="brand-details">
				<div class="instansi-pill">
					<span class="instansi-label">RUMAH SAKIT UMUM DAERAH</span>
					<span class="instansi-sep">•</span>
					<span class="instansi-date">{formattedDate}</span>
					{#if isOffline}
						<span
							class="offline-pill"
							title="Kiosk berjalan menggunakan data cache lokal"
						>
							<span class="pulse-dot"></span>
							<span
								>Mode Siaga Offline {lastSyncText
									? `(${lastSyncText})`
									: ""}</span
							>
						</span>
					{/if}
				</div>
				<h1 class="hospital-name">{hospitalName}</h1>
				<p class="hospital-sub">{hospitalSubtitle}</p>
			</div>
		</div>

		<!-- Kanan: Tombol Lock Kiosk & Jam Digital Realtime -->
		<div class="header-controls">
			{#if onLockClick}
				<button
					type="button"
					class="lock-action-btn"
					class:unlocked={isUnlocked}
					onclick={onLockClick}
					title={isUnlocked
						? "Kiosk Terbuka (Sentuh untuk Opsi Dashboard & Kunci)"
						: "Buka Kunci Kiosk (Akses CMS)"}
					aria-label={isUnlocked ? "Kiosk Terbuka" : "Kunci Kiosk"}
				>
					{#if isUnlocked}
						<LockOpen size={21} class="lock-icon-open" />
					{:else}
						<Lock size={21} />
					{/if}
				</button>
			{:else}
				<a
					href="/admin/login"
					class="lock-action-btn"
					class:unlocked={isUnlocked}
					title={isUnlocked
						? "Kiosk Terbuka (Akses CMS)"
						: "Buka Kunci Kiosk (Akses CMS)"}
					aria-label={isUnlocked ? "Kiosk Terbuka" : "Kunci Kiosk"}
				>
					{#if isUnlocked}
						<LockOpen size={21} class="lock-icon-open" />
					{:else}
						<Lock size={21} />
					{/if}
				</a>
			{/if}

			<DigitalClock {timezone} />
		</div>
	</div>

	<!-- Baris Tengah: Label Jadwal Poliklinik, Page Counter & Penanda Lingkaran Waktu -->
	<div class="header-title-bar">
		<div class="title-meta">
			<h2 class="title-main">JADWAL POLIKLINIK</h2>
			<div class="title-sub">
				<Stethoscope size={18} class="stetho-icon" />
				<span>Informasi Jadwal Praktik Dokter Spesialis</span>
			</div>
		</div>

		<div class="header-indicator-cluster">
			<PageIndicator
				{currentPage}
				{totalPages}
				variant="header"
				onPageSelect={onPageChange}
			/>
		</div>
	</div>

	<!-- Bar Berjalan Menunjukkan Durasi Perpindahan ke Slide Selanjutnya (Progress Bar) -->
	<div
		class="header-progress-track"
		aria-hidden="true"
		title={`Durasi slide: ${Math.round(progressPercent)}%`}
	>
		<div
			class="header-progress-bar"
			style="width: {Math.min(100, Math.max(0, progressPercent))}%;"
		></div>
	</div>
</header>

<style>
	.kiosk-header {
		position: relative;
		background-color: #0a5c36;
		background-image: -webkit-linear-gradient(
			100deg,
			#df5720 0%,
			#df5720 30%,
			#da6226 36%,
			#b57933 46%,
			#578b45 56%,
			#178750 66%,
			#0e7743 82%,
			#0a5c36 100%
		);
		background-image: linear-gradient(
			100deg,
			#df5720 0%,
			#df5720 30%,
			#da6226 36%,
			#b57933 46%,
			#578b45 56%,
			#178750 66%,
			#0e7743 82%,
			#0a5c36 100%
		);
		padding: clamp(0.45rem, 0.7vh, 0.65rem) clamp(1rem, 1.6vw, 1.5rem) clamp(0.68rem, 1.05vh, 0.96rem);
		overflow: hidden;
		box-shadow: 0 10px 25px -5px rgba(10, 92, 54, 0.35);
		color: #ffffff;
		z-index: 20;
		flex-shrink: 0;
		min-height: var(--kiosk-header-height, 132px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: clamp(0.42rem, 0.72vh, 0.68rem);
		-webkit-transform: translateZ(0);
		transform: translateZ(0);
		contain: layout style;
	}

	.header-top {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0;
		z-index: 2;
	}

	.brand-group {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.logo-container {
		flex-shrink: 0;
	}

	.logo-circle {
		width: 68px;
		height: 68px;
		background: #ffffff;
		border-radius: 50%;
		padding: 3.5px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.18),
			0 0 0 2px rgba(255, 255, 255, 0.3);
		overflow: hidden;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 50%;
	}

	.logo-svg {
		width: 100%;
		height: 100%;
	}

	.brand-details {
		display: flex;
		flex-direction: column;
	}

	.instansi-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		background: rgba(10, 92, 54, 0.88);
		padding: 0.18rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		margin-bottom: 0.22rem;
		width: fit-content;
		border: 1px solid rgba(255, 255, 255, 0.32);
	}

	.offline-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(217, 119, 6, 0.55);
		border: 1px solid rgba(251, 191, 36, 0.75);
		padding: 0.1rem 0.52rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 800;
		color: #fef3c7;
		margin-left: 0.24rem;
	}

	.pulse-dot {
		width: 5.5px;
		height: 5.5px;
		border-radius: 50%;
		background: #f59e0b;
		box-shadow: 0 0 6px #f59e0b;
		animation: pulseOffline 2s infinite ease-in-out;
	}

	@keyframes pulseOffline {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.35;
			transform: scale(0.85);
		}
	}

	.instansi-label {
		color: #ffffff;
	}

	.instansi-sep {
		opacity: 0.7;
	}

	.instansi-date {
		color: #ffffff;
		font-weight: 700;
		font-size: 0.82rem;
	}

	.hospital-name {
		font-size: 1.34rem;
		font-weight: 900;
		letter-spacing: -0.015em;
		color: #ffffff;
		line-height: 1.15;
		margin: 0;
		white-space: nowrap;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.hospital-sub {
		font-size: 0.84rem;
		font-weight: 500;
		opacity: 0.92;
		margin: 0.1rem 0 0 0;
		line-height: 1.2;
		letter-spacing: 0.01em;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.lock-action-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(10, 92, 54, 0.88);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		pointer-events: auto !important; /* Selalu dapat diklik/disentuh meski konten jadwal terkunci */
		z-index: 50;
	}

	.lock-action-btn:hover {
		background: rgba(10, 92, 54, 0.95);
		transform: scale(1.06);
	}

	.lock-action-btn.unlocked {
		background: rgba(16, 185, 129, 0.45);
		border-color: rgba(110, 231, 183, 0.85);
		color: #ecfdf5;
		box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
	}

	.lock-action-btn.unlocked:hover {
		background: rgba(16, 185, 129, 0.65);
		transform: scale(1.08);
	}

	:global(.lock-icon-open) {
		animation: unlockPulse 0.4s ease-out;
	}

	@keyframes unlockPulse {
		0% {
			transform: scale(0.85) rotate(-10deg);
		}
		50% {
			transform: scale(1.15) rotate(5deg);
		}
		100% {
			transform: scale(1) rotate(0);
		}
	}

	.header-title-bar {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin: 0 0 0.1rem 0;
		z-index: 2;
	}

	.title-meta {
		display: flex;
		flex-direction: column;
	}

	.title-main {
		font-size: 1.15rem;
		font-weight: 850;
		letter-spacing: 0.02em;
		margin: 0;
		line-height: 1.15;
		color: #ffffff;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
	}

	.title-sub {
		display: flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.76rem;
		font-weight: 600;
		opacity: 0.95;
		margin-top: 0.05rem;
		line-height: 1.15;
		letter-spacing: 0.01em;
	}

	:global(.stetho-icon) {
		color: #fed7aa;
	}

	.header-indicator-cluster {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.header-progress-track {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 5px;
		background: rgba(0, 0, 0, 0.28);
		overflow: hidden;
		z-index: 25;
	}

	.header-progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #f59e0b 0%, #10b981 50%, #34d399 100%);
		box-shadow:
			0 0 10px rgba(245, 158, 11, 0.75),
			0 0 5px rgba(52, 211, 153, 0.85);
		border-radius: 0 3px 3px 0;
		transition: width 0.12s linear;
	}
</style>
