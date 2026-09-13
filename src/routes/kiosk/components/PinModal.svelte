<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Lock, X, Delete, ArrowRight, ShieldAlert, CheckCircle2, LayoutDashboard, Tv } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/services/auth.service';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSuccessUnlock?: () => void;
	}

	let { isOpen = false, onClose, onSuccessUnlock }: Props = $props();

	let pinInput = $state('');
	let errorMessage = $state('');
	let isShaking = $state(false);
	let isSuccess = $state(false);
	let cooldownSeconds = $state(0);
	let cooldownInterval: ReturnType<typeof setInterval> | null = null;

	function appendDigit(digit: string) {
		if (cooldownSeconds > 0 || pinInput.length >= 8) return;
		pinInput += digit;
		errorMessage = '';
	}

	function deleteDigit() {
		if (cooldownSeconds > 0 || pinInput.length === 0) return;
		pinInput = pinInput.slice(0, -1);
		errorMessage = '';
	}

	function clearPin() {
		pinInput = '';
		errorMessage = '';
	}

	function submitPin() {
		if (cooldownSeconds > 0) return;

		if (pinInput.length < 4) {
			triggerError('Masukkan minimal 4 digit PIN');
			return;
		}

		const result = AuthService.verifyMasterPin(pinInput);

		if (result.success) {
			isSuccess = true;
			errorMessage = '';
			if (onSuccessUnlock) {
				onSuccessUnlock();
			}
		} else {
			triggerError(result.message);
			pinInput = '';

			if (result.cooldownRemainingSeconds) {
				startCooldown(result.cooldownRemainingSeconds);
			}
		}
	}

	function triggerError(msg: string) {
		errorMessage = msg;
		isShaking = true;
		setTimeout(() => {
			isShaking = false;
		}, 500);
	}

	function startCooldown(seconds: number) {
		cooldownSeconds = seconds;
		if (cooldownInterval) clearInterval(cooldownInterval);

		cooldownInterval = setInterval(() => {
			cooldownSeconds--;
			if (cooldownSeconds <= 0) {
				if (cooldownInterval) clearInterval(cooldownInterval);
				cooldownInterval = null;
				errorMessage = '';
			}
		}, 1000);
	}

	function handleClose() {
		isSuccess = false;
		pinInput = '';
		errorMessage = '';
		onClose();
	}

	$effect(() => {
		if (isOpen) {
			isSuccess = false;
			pinInput = '';
			errorMessage = '';
		}
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen) return;

		if (e.key >= '0' && e.key <= '9') {
			appendDigit(e.key);
		} else if (e.key === 'Backspace') {
			deleteDigit();
		} else if (e.key === 'Enter') {
			submitPin();
		} else if (e.key === 'Escape') {
			handleClose();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			if (cooldownInterval) clearInterval(cooldownInterval);
		};
	});

	onDestroy(() => {
		if (cooldownInterval) clearInterval(cooldownInterval);
	});
</script>

{#if isOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
		<div class="modal-card" class:shake={isShaking} class:success-border={isSuccess}>
			<!-- Tombol Tutup -->
			<button type="button" class="close-btn" onclick={handleClose} aria-label="Tutup modal PIN">
				<X size={22} />
			</button>

			<!-- Header Modal -->
			<div class="modal-header">
				<div class="lock-icon-circle" class:icon-success={isSuccess}>
					{#if isSuccess}
						<CheckCircle2 size={32} />
					{:else}
						<Lock size={32} />
					{/if}
				</div>
				<h2 id="pin-modal-title" class="modal-title">Buka Kunci Kiosk</h2>
				<p class="modal-desc">Masukkan Master PIN petugas untuk mengakses Dashboard CMS</p>
			</div>

			{#if isSuccess}
				<!-- Tampilan Pilihan Aksi Setelah Kunci Terbuka -->
				<div class="success-screen">
					<h3 class="success-subtitle">Layar sentuh jadwal saat ini sudah aktif dan dapat disentuh. Silakan pilih tujuan Anda:</h3>
					<div class="success-actions-col">
						<button
							type="button"
							class="success-choice-btn primary"
							onclick={() => {
								handleClose();
								goto('/admin');
							}}
						>
							<LayoutDashboard size={20} />
							<span>Masuk ke Dashboard CMS</span>
						</button>
						<button
							type="button"
							class="success-choice-btn secondary"
							onclick={() => {
								handleClose();
							}}
						>
							<Tv size={20} />
							<span>Tetap di Layar Kiosk (Sentuh Aktif)</span>
						</button>
					</div>
				</div>
			{:else}
				<!-- Display Titik PIN (••••) -->
				<div class="pin-display-wrapper">
					<div class="dots-row" aria-label={`PIN terisi ${pinInput.length} digit`}>
						{#each Array.from({ length: 6 }) as _, i}
							<div
								class="pin-dot"
								class:filled={i < pinInput.length}
								class:current={i === pinInput.length}
							></div>
						{/each}
					</div>
				</div>

				<!-- Pesan Error / Cooldown Alert -->
				{#if errorMessage}
					<div class="error-banner" role="alert">
						<ShieldAlert size={16} />
						<span>{errorMessage}</span>
					</div>
				{/if}

				<!-- Touchscreen Virtual Keypad (Dirancang khusus layar sentuh TV 55") -->
				<div class="virtual-keypad">
					<div class="keypad-grid">
						{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit}
							<button
								type="button"
								class="key-btn digit-btn"
								onclick={() => appendDigit(digit)}
								disabled={cooldownSeconds > 0}
							>
								<span>{digit}</span>
							</button>
						{/each}

						<!-- Baris Bawah: Hapus, 0, Submit -->
						<button
							type="button"
							class="key-btn action-btn delete-btn"
							onclick={deleteDigit}
							disabled={cooldownSeconds > 0 || pinInput.length === 0}
							aria-label="Hapus digit terakhir"
						>
							<Delete size={24} />
						</button>

						<button
							type="button"
							class="key-btn digit-btn"
							onclick={() => appendDigit('0')}
							disabled={cooldownSeconds > 0}
						>
							<span>0</span>
						</button>

						<button
							type="button"
							class="key-btn action-btn submit-btn"
							onclick={submitPin}
							disabled={cooldownSeconds > 0 || pinInput.length < 4}
							aria-label="Buka kunci"
						>
							<ArrowRight size={24} />
						</button>
					</div>
				</div>

				<!-- Footer Modal Hint -->
				<div class="modal-footer">
					<span class="hint-text">Default Master PIN lokal: <strong>1234</strong></span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(10, 25, 18, 0.75);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease-out;
	}

	.modal-card {
		background: #FFFFFF;
		width: 100%;
		max-width: 440px;
		border-radius: 2rem;
		padding: 2.5rem 2rem 2rem 2rem;
		box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4);
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 2px solid rgba(255, 255, 255, 0.8);
		transition: border-color 0.3s;
	}

	.modal-card.success-border {
		border-color: #10B981;
	}

	.close-btn {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #F1F5F9;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748B;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #E2E8F0;
		color: #0F172A;
	}

	.modal-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.lock-icon-circle {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background: #E8F5E9;
		color: #0A5C36;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1rem;
		transition: all 0.3s ease;
	}

	.lock-icon-circle.icon-success {
		background: #D1FAE5;
		color: #059669;
		transform: scale(1.08);
	}

	.modal-title {
		font-size: 1.6rem;
		font-weight: 850;
		color: #0F172A;
		margin: 0;
	}

	.modal-desc {
		font-size: 0.875rem;
		color: #64748B;
		margin: 0.35rem 0 0 0;
	}

	/* Display Dots PIN (••••) */
	.pin-display-wrapper {
		margin-bottom: 1.25rem;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.dots-row {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 1.5rem;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 9999px;
	}

	.pin-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #CBD5E1;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.pin-dot.filled {
		background: #0A5C36;
		transform: scale(1.2);
		box-shadow: 0 0 8px rgba(10, 92, 54, 0.4);
	}

	.pin-dot.current {
		border: 2px solid #0A5C36;
		background: transparent;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #FEE2E2;
		border: 1px solid #FCA5A5;
		color: #B91C1C;
		padding: 0.6rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.825rem;
		font-weight: 700;
		margin-bottom: 1.25rem;
		text-align: center;
		animation: pulseAlert 0.3s ease-out;
	}

	/* Virtual Keypad Touchscreen */
	.virtual-keypad {
		width: 100%;
		max-width: 320px;
	}

	.keypad-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.85rem;
	}

	.key-btn {
		height: 64px;
		border-radius: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		font-weight: 800;
		transition: all 0.15s ease;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}

	.digit-btn {
		background: #F1F5F9;
		color: #1E293B;
		border: 1px solid #E2E8F0;
	}

	.digit-btn:hover:not(:disabled) {
		background: #E2E8F0;
		transform: scale(1.04);
	}

	.digit-btn:active:not(:disabled) {
		background: #CBD5E1;
		transform: scale(0.96);
	}

	.action-btn {
		border: none;
	}

	.delete-btn {
		background: #FEE2E2;
		color: #DC2626;
	}

	.delete-btn:hover:not(:disabled) {
		background: #FCA5A5;
		color: #B91C1C;
	}

	.submit-btn {
		background: #0A5C36;
		color: #FFFFFF;
		box-shadow: 0 4px 12px rgba(10, 92, 54, 0.3);
	}

	.submit-btn:hover:not(:disabled) {
		background: #074327;
		transform: scale(1.04);
	}

	.key-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.modal-footer {
		margin-top: 1.5rem;
		text-align: center;
	}

	/* Success Choice Screen */
	.success-screen {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: fadeIn 0.25s ease-out;
		margin-top: 0.25rem;
	}

	.success-subtitle {
		font-size: 0.9rem;
		color: #475569;
		text-align: center;
		margin: 0 0 1.25rem 0;
		line-height: 1.45;
		font-weight: 500;
	}

	.success-actions-col {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.success-choice-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		border: none;
		font-family: inherit;
		transition: all 0.2s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.success-choice-btn.primary {
		background: #0A5C36;
		color: #FFFFFF;
		box-shadow: 0 4px 14px rgba(10, 92, 54, 0.25);
	}

	.success-choice-btn.primary:hover {
		background: #074327;
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(10, 92, 54, 0.35);
	}

	.success-choice-btn.secondary {
		background: #F8FAFC;
		color: #1E293B;
		border: 1.5px solid #CBD5E1;
	}

	.success-choice-btn.secondary:hover {
		background: #F1F5F9;
		border-color: #94A3B8;
		transform: translateY(-1px);
	}

	/* Shake Animation for Incorrect PIN */
	.shake {
		animation: shakeAnim 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	@keyframes shakeAnim {
		10%, 90% { transform: translate3d(-3px, 0, 0); }
		20%, 80% { transform: translate3d(5px, 0, 0); }
		30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
		40%, 60% { transform: translate3d(6px, 0, 0); }
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
