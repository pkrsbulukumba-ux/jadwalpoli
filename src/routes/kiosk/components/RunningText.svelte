<script lang="ts">
	interface Props {
		text?: string;
		speed?: number; // durasi animasi dalam detik
		direction?: 'left' | 'right';
	}

	let {
		text = 'Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Instagram: @RSUDBULUKUMBA • Melayani Dengan Sepenuh Hati • Mengutamakan Keselamatan & Kenyamanan Pasien',
		speed = 28,
		direction = 'left'
	}: Props = $props();
</script>

<div class="running-text-bar" role="marquee" aria-label="Pengumuman Berjalan">
	<div
		class="marquee-track"
		style="animation-duration: {speed}s; animation-direction: {direction === 'right' ? 'reverse' : 'normal'};"
	>
		<span class="marquee-item">{text}</span>
		<span class="marquee-item" aria-hidden="true">{text}</span>
	</div>
</div>

<style>
	.running-text-bar {
		background: #0B1325;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		color: #FFFFFF;
		padding: 0.85rem 0;
		overflow: hidden;
		white-space: nowrap;
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		z-index: 30;
	}

	.marquee-track {
		display: inline-flex;
		white-space: nowrap;
		will-change: transform;
		animation: scrollText linear infinite;
	}

	.marquee-item {
		display: inline-block;
		padding-right: 3.5rem;
		font-size: 1.15rem;
		font-weight: 750;
		letter-spacing: 0.03em;
		color: #FFFFFF;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}

	@keyframes scrollText {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}
</style>
