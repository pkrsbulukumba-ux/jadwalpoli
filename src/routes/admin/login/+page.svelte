<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Lock, ArrowLeft, Delete, KeyRound, ShieldAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/services/auth.service';

	let pin = $state('');
	let errorMessage = $state('');
	let cooldownSeconds = $state(0);
	let cooldownInterval: ReturnType<typeof setInterval> | null = null;
	let pinInputRef: HTMLInputElement | null = null;

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

	function appendDigit(digit: string) {
		if (cooldownSeconds > 0 || pin.length >= 8) return;
		pin += digit;
		errorMessage = '';
	}

	function deleteDigit() {
		if (cooldownSeconds > 0 || pin.length === 0) return;
		pin = pin.slice(0, -1);
		errorMessage = '';
	}

	function clearPin() {
		pin = '';
		errorMessage = '';
	}

	function handlePinSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (cooldownSeconds > 0) return;

		if (!pin || pin.length < 4) {
			errorMessage = 'Masukkan minimal 4 digit PIN';
			return;
		}

		const result = AuthService.verifyMasterPin(pin);

		if (result.success) {
			errorMessage = '';
			goto('/admin');
		} else {
			errorMessage = result.message;
			pin = '';

			if (result.cooldownRemainingSeconds) {
				startCooldown(result.cooldownRemainingSeconds);
			}
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (cooldownSeconds > 0) return;
		if (e.key === 'Enter') {
			handlePinSubmit();
		}
	}

	onMount(() => {
		if (pinInputRef) {
			pinInputRef.focus();
		}
	});

	onDestroy(() => {
		if (cooldownInterval) clearInterval(cooldownInterval);
	});
</script>

<svelte:head>
	<title>Buka Kunci Kiosk & Panel Petugas - RSUD</title>
</svelte:head>

<div class="login-wrapper">
	<div class="login-card">
		<!-- Header Kartu -->
		<div class="login-header">
			<a href="/kiosk" class="back-link">
				<ArrowLeft size={18} />
				<span>Kembali ke Kiosk</span>
			</a>
			<div class="logo-circle">
				<span class="logo-symbol">✚</span>
			</div>
			<h1 class="hospital-title">RSUD H. Andi Sulthan Daeng Radja</h1>
			<p class="login-subtitle">Masukkan Master PIN untuk membuka panel CMS</p>
		</div>

		<!-- Banner Pesan Error / Cooldown -->
		{#if errorMessage}
			<div class="error-alert" role="alert">
				<ShieldAlert size={18} />
				<span>{errorMessage}</span>
			</div>
		{/if}

		<!-- Form Input PIN (Keyboard & Touchscreen Keypad) -->
		<form onsubmit={handlePinSubmit} class="form-body">
			<div class="form-group">
				<label for="pin-input">Master PIN Petugas (4–8 Digit)</label>
				<div class="input-icon-wrap">
					<Lock size={20} class="field-icon" />
					<input
						id="pin-input"
						bind:this={pinInputRef}
						type="password"
						inputmode="numeric"
						pattern="[0-9]*"
						maxlength="8"
						bind:value={pin}
						onkeydown={handleKeyDown}
						disabled={cooldownSeconds > 0}
						placeholder={cooldownSeconds > 0 ? `Terkunci (${cooldownSeconds}s)` : '• • • •'}
						class="pin-input"
						autocomplete="off"
					/>
				</div>
			</div>

			<!-- Touchscreen Virtual Keypad (Mendukung Layar TV 43"–55") -->
			<div class="keypad-container" aria-label="Keypad Angka">
				<div class="keypad-grid">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit}
						<button
							type="button"
							class="key-btn"
							onclick={() => appendDigit(digit)}
							disabled={cooldownSeconds > 0}
						>
							{digit}
						</button>
					{/each}

					<!-- Tombol Bersihkan (C) -->
					<button
						type="button"
						class="key-btn action-key clear-key"
						onclick={clearPin}
						disabled={cooldownSeconds > 0 || pin.length === 0}
						title="Hapus semua"
					>
						C
					</button>

					<!-- Angka 0 -->
					<button
						type="button"
						class="key-btn"
						onclick={() => appendDigit('0')}
						disabled={cooldownSeconds > 0}
					>
						0
					</button>

					<!-- Tombol Hapus 1 Digit (⌫) -->
					<button
						type="button"
						class="key-btn action-key delete-key"
						onclick={deleteDigit}
						disabled={cooldownSeconds > 0 || pin.length === 0}
						title="Hapus satu angka"
						aria-label="Hapus satu angka"
					>
						<Delete size={20} />
					</button>
				</div>
			</div>

			<div class="hint-container">
				<span class="hint-text">Default PIN lokal: <strong>1234</strong></span>
			</div>

			<button
				type="submit"
				class="submit-btn"
				disabled={cooldownSeconds > 0 || !pin || pin.length < 4}
			>
				<KeyRound size={18} />
				<span>{cooldownSeconds > 0 ? `Tunggu ${cooldownSeconds}s` : 'Buka Kunci Kiosk'}</span>
			</button>
		</form>
	</div>
</div>

<style>
	.login-wrapper {
		min-height: 100vh;
		background: linear-gradient(135deg, #0A5C36 0%, #0D7A48 60%, #15803D 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	.login-card {
		background: white;
		width: 100%;
		max-width: 420px;
		border-radius: 1.75rem;
		padding: 2.25rem 2rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
	}

	.login-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: #64748B;
		font-weight: 600;
		margin-bottom: 1rem;
		text-decoration: none;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #0A5C36;
	}

	.logo-circle {
		width: 64px;
		height: 64px;
		background: #0A5C36;
		border-radius: 50%;
		margin: 0 auto 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(10, 92, 54, 0.25);
	}

	.logo-symbol {
		color: white;
		font-size: 1.85rem;
		font-weight: 800;
	}

	.hospital-title {
		font-size: 1.2rem;
		color: #0F172A;
		font-weight: 800;
		margin: 0;
		line-height: 1.25;
	}

	.login-subtitle {
		font-size: 0.85rem;
		color: #64748B;
		margin: 0.35rem 0 0 0;
	}

	.error-alert {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: #FEE2E2;
		border: 1px solid #FCA5A5;
		color: #B91C1C;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 1.25rem;
		text-align: center;
	}

	.form-body {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-group label {
		font-size: 0.85rem;
		font-weight: 700;
		color: #334155;
		text-align: center;
	}

	.input-icon-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	:global(.field-icon) {
		position: absolute;
		left: 1rem;
		color: #94A3B8;
	}

	.pin-input {
		width: 100%;
		padding: 0.85rem 1rem 0.85rem 2.75rem;
		font-size: 1.35rem;
		letter-spacing: 0.35em;
		text-align: center;
		border: 1.5px solid #CBD5E1;
		border-radius: 0.85rem;
		outline: none;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	.pin-input:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 3px rgba(10, 92, 54, 0.15);
	}

	.pin-input:disabled {
		background: #F1F5F9;
		color: #94A3B8;
		cursor: not-allowed;
	}

	/* Virtual Keypad Touchscreen */
	.keypad-container {
		display: flex;
		justify-content: center;
	}

	.keypad-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
		width: 100%;
		max-width: 280px;
	}

	.key-btn {
		height: 52px;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		border-radius: 0.75rem;
		font-size: 1.35rem;
		font-weight: 700;
		color: #1E293B;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}

	.key-btn:hover:not(:disabled) {
		background: #E2E8F0;
		transform: translateY(-1px);
	}

	.key-btn:active:not(:disabled) {
		background: #CBD5E1;
		transform: scale(0.96);
	}

	.key-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.action-key {
		font-size: 1rem;
		font-weight: 800;
	}

	.clear-key {
		color: #D97706;
		background: #FEF3C7;
		border-color: #FDE68A;
	}

	.clear-key:hover:not(:disabled) {
		background: #FDE68A;
	}

	.delete-key {
		color: #DC2626;
		background: #FEE2E2;
		border-color: #FECACA;
	}

	.delete-key:hover:not(:disabled) {
		background: #FECACA;
	}

	.hint-container {
		text-align: center;
	}

	.hint-text {
		font-size: 0.8rem;
		color: #64748B;
	}

	.submit-btn {
		background: #0A5C36;
		color: white;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.9rem 1.5rem;
		border-radius: 0.85rem;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(10, 92, 54, 0.25);
	}

	.submit-btn:hover:not(:disabled) {
		background: #074327;
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(10, 92, 54, 0.35);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
