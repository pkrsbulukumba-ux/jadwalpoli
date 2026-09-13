<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Building2,
		Plus,
		Search,
		Edit3,
		Trash2,
		X,
		Check,
		AlertTriangle
	} from '@lucide/svelte';
	import { AVAILABLE_POLI_ICONS, getPolyclinicIconComponent } from '$lib/services/icon.service';
	import { DataRepository } from '$lib/services/data.repository';
	import type { Polyclinic } from '$lib/types';

	let polyclinics = $state<Polyclinic[]>([]);
	let searchQuery = $state('');

	// State Modal Tambah / Edit
	let isModalOpen = $state(false);
	let isEditing = $state(false);
	let currentId = $state('');
	let formName = $state('');
	let formCode = $state('');
	let formIcon = $state('stethoscope');
	let formOrder = $state(1);
	let formIsActive = $state(true);
	let formError = $state('');

	// Dynamic icon for modal preview
	const SelectedModalIcon = $derived(getPolyclinicIconComponent(formIcon));

	// State Konfirmasi Hapus
	let isDeleteConfirmOpen = $state(false);
	let poliToDelete = $state<Polyclinic | null>(null);

	let unsubRealtime: (() => void) | null = null;

	function loadData() {
		polyclinics = DataRepository.getPolyclinics();
	}

	onMount(() => {
		loadData();

		unsubRealtime = DataRepository.subscribeToRealtimeChanges(() => {
			loadData();
		});

		const handleStorage = (e: StorageEvent) => {
			if (e.key && e.key.includes('rsud_kiosk')) loadData();
		};

		const handleCustom = () => loadData();

		if (typeof window !== 'undefined') {
			window.addEventListener('storage', handleStorage);
			window.addEventListener('kiosk-data-updated', handleCustom);
			return () => {
				window.removeEventListener('storage', handleStorage);
				window.removeEventListener('kiosk-data-updated', handleCustom);
			};
		}
	});

	onDestroy(() => {
		if (unsubRealtime) unsubRealtime();
	});

	let filteredPolyclinics = $derived(
		polyclinics.filter((p) => {
			const query = searchQuery.toLowerCase().trim();
			return p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query);
		})
	);

	let activeCount = $derived(polyclinics.filter((p) => p.is_active).length);

	function openAddModal() {
		isEditing = false;
		currentId = '';
		formName = '';
		formCode = '';
		formIcon = 'stethoscope';
		formOrder = polyclinics.length + 1;
		formIsActive = true;
		formError = '';
		isModalOpen = true;
	}

	function openEditModal(poli: Polyclinic) {
		isEditing = true;
		currentId = poli.id;
		formName = poli.name;
		formCode = poli.code;
		formIcon = poli.icon || 'stethoscope';
		formOrder = poli.display_order;
		formIsActive = poli.is_active;
		formError = '';
		isModalOpen = true;
	}

	function handleSave() {
		if (!formName.trim()) {
			formError = 'Nama poliklinik wajib diisi';
			return;
		}
		if (!formCode.trim()) {
			formError = 'Kode singkat poliklinik wajib diisi';
			return;
		}

		if (isEditing && currentId) {
			DataRepository.updatePolyclinic(currentId, {
				name: formName.trim().toUpperCase(),
				code: formCode.trim().toUpperCase(),
				icon: formIcon,
				display_order: Number(formOrder),
				is_active: formIsActive
			});
		} else {
			DataRepository.createPolyclinic({
				name: formName.trim().toUpperCase(),
				code: formCode.trim().toUpperCase(),
				icon: formIcon,
				display_order: Number(formOrder),
				is_active: formIsActive
			});
		}

		isModalOpen = false;
		loadData();
	}

	function handleToggleStatus(poli: Polyclinic) {
		DataRepository.updatePolyclinic(poli.id, {
			is_active: !poli.is_active
		});
		loadData();
	}

	function promptDelete(poli: Polyclinic) {
		poliToDelete = poli;
		isDeleteConfirmOpen = true;
	}

	function confirmDelete() {
		if (poliToDelete) {
			DataRepository.deletePolyclinic(poliToDelete.id);
			poliToDelete = null;
			isDeleteConfirmOpen = false;
			loadData();
		}
	}
</script>

<svelte:head>
	<title>Kelola Poliklinik - CMS RSUD</title>
</svelte:head>

<div class="page-shell">
	<!-- Topbar Header Section -->
	<div class="page-header">
		<div class="header-titles">
			<div class="title-row">
				<div class="badge-icon">
					<Building2 size={24} />
				</div>
				<div>
					<h1 class="main-title">Kelola Poliklinik</h1>
					<p class="subtitle">Atur daftar poliklinik aktif, kode identitas, dan urutan tampil pada layar Kiosk TV.</p>
				</div>
			</div>
		</div>

		<button type="button" class="btn-primary" onclick={openAddModal}>
			<Plus size={18} />
			<span>Tambah Poliklinik</span>
		</button>
	</div>

	<!-- Mini Statistics Banner -->
	<div class="stats-ribbon">
		<div class="stat-box">
			<span class="stat-number">{polyclinics.length}</span>
			<span class="stat-desc">Total Poliklinik</span>
		</div>
		<div class="stat-box">
			<span class="stat-number text-success">{activeCount}</span>
			<span class="stat-desc">Poliklinik Aktif di Kiosk</span>
		</div>
		<div class="stat-box">
			<span class="stat-number text-muted">{polyclinics.length - activeCount}</span>
			<span class="stat-desc">Dinonaktifkan / Tutup</span>
		</div>
	</div>

	<!-- Toolbar & Search Box -->
	<div class="toolbar-card">
		<div class="search-input-wrap">
			<Search size={18} class="search-icon" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cari nama poliklinik atau kode (contoh: Jantung, JNT)..."
				class="search-field"
			/>
			{#if searchQuery}
				<button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>
					<X size={16} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Table Card -->
	<div class="table-card">
		<div class="table-responsive">
			<table class="data-table">
				<thead>
					<tr>
						<th style="width: 70px;">Urutan</th>
						<th>Poliklinik</th>
						<th style="width: 120px;">Kode</th>
						<th style="width: 140px;">Ikon</th>
						<th style="width: 150px; text-align: center;">Status Kiosk</th>
						<th style="width: 130px; text-align: right;">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#if filteredPolyclinics.length === 0}
						<tr>
							<td colspan="6" class="empty-row">
								<p>Tidak ada poliklinik yang sesuai dengan pencarian.</p>
							</td>
						</tr>
					{:else}
						{#each filteredPolyclinics as poli (poli.id)}
							{@const IconComponent = getPolyclinicIconComponent(poli.icon)}
							<tr class:row-disabled={!poli.is_active}>
								<td class="order-cell">
									<span class="order-badge">{poli.display_order}</span>
								</td>
								<td class="name-cell">
									<div class="poli-identity">
										<div class="poli-icon-thumb">
											<IconComponent size={20} />
										</div>
										<div>
											<strong class="poli-title">{poli.name}</strong>
										</div>
									</div>
								</td>
								<td>
									<span class="code-pill">{poli.code}</span>
								</td>
								<td>
									<span class="icon-label">{poli.icon || 'stethoscope'}</span>
								</td>
								<td style="text-align: center;">
									<button
										type="button"
										class="toggle-badge"
										class:active={poli.is_active}
										onclick={() => handleToggleStatus(poli)}
										title={poli.is_active ? 'Klik untuk nonaktifkan dari Kiosk' : 'Klik untuk aktifkan di Kiosk'}
									>
										{#if poli.is_active}
											<Check size={14} />
											<span>Tampil Aktif</span>
										{:else}
											<X size={14} />
											<span>Nonaktif</span>
										{/if}
									</button>
								</td>
								<td style="text-align: right;">
									<div class="action-buttons">
										<button
											type="button"
											class="action-icon-btn edit-btn"
											onclick={() => openEditModal(poli)}
											title="Edit Poliklinik"
										>
											<Edit3 size={16} />
										</button>
										<button
											type="button"
											class="action-icon-btn delete-btn"
											onclick={() => promptDelete(poli)}
											title="Hapus Poliklinik"
										>
											<Trash2 size={16} />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Tambah / Edit Poliklinik -->
{#if isModalOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container">
			<div class="modal-head">
				<h3>{isEditing ? 'Edit Data Poliklinik' : 'Tambah Poliklinik Baru'}</h3>
				<button type="button" class="close-modal-btn" onclick={() => (isModalOpen = false)}>
					<X size={20} />
				</button>
			</div>

			{#if formError}
				<div class="form-error-alert">
					<AlertTriangle size={16} />
					<span>{formError}</span>
				</div>
			{/if}

			<div class="modal-form-body">
				<div class="form-field">
					<label for="poli-name">Nama Lengkap Poliklinik *</label>
					<input
						id="poli-name"
						type="text"
						bind:value={formName}
						placeholder="Contoh: JANTUNG & PEMBULUH DARAH"
						class="form-input"
					/>
				</div>

				<div class="form-grid-2">
					<div class="form-field">
						<label for="poli-code">Kode Singkat (3-4 Huruf) *</label>
						<input
							id="poli-code"
							type="text"
							bind:value={formCode}
							maxlength="6"
							placeholder="Contoh: JNT"
							class="form-input text-uppercase"
						/>
					</div>

					<div class="form-field">
						<label for="poli-order">Urutan Tampilan (Di Layar Kiosk)</label>
						<input
							id="poli-order"
							type="number"
							min="1"
							bind:value={formOrder}
							class="form-input"
						/>
					</div>
				</div>

				<div class="form-field">
					<label for="poli-icon">Pilihan Ikon Visual</label>
					<div class="icon-picker-row">
						<div class="icon-preview-box" title="Pratinjau Ikon Terpilih">
							<SelectedModalIcon size={22} />
						</div>
						<select id="poli-icon" bind:value={formIcon} class="form-select flex-1">
							{#each AVAILABLE_POLI_ICONS as iconItem}
								<option value={iconItem.id}>{iconItem.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="checkbox-row">
					<label class="custom-checkbox">
						<input type="checkbox" bind:checked={formIsActive} />
						<span class="checkmark"></span>
						<span class="label-text">Aktifkan dan tampilkan poliklinik ini pada tayangan Kiosk TV</span>
					</label>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (isModalOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-save" onclick={handleSave}>
					{isEditing ? 'Simpan Perubahan' : 'Simpan Poliklinik'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Konfirmasi Hapus -->
{#if isDeleteConfirmOpen && poliToDelete}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container delete-dialog">
			<div class="delete-icon-wrap">
				<AlertTriangle size={32} />
			</div>
			<h3>Konfirmasi Hapus Poliklinik</h3>
			<p>
				Apakah Anda yakin ingin menghapus poliklinik <strong>{poliToDelete.name}</strong>? Tindakan ini akan menghapus data poliklinik dari daftar.
			</p>

			<div class="modal-footer justify-center">
				<button type="button" class="btn-cancel" onclick={() => (isDeleteConfirmOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-delete-confirm" onclick={confirmDelete}>
					Ya, Hapus Poliklinik
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page-shell {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		font-family: inherit;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.badge-icon {
		width: 48px;
		height: 48px;
		background: #E8F5E9;
		color: #0A5C36;
		border-radius: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.main-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #64748B;
		margin: 0.2rem 0 0 0;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #0A5C36;
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: #074327;
	}

	/* Stats Ribbon */
	.stats-ribbon {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.stat-box {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		padding: 1.15rem 1.5rem;
		display: flex;
		flex-direction: column;
	}

	.stat-number {
		font-size: 1.6rem;
		font-weight: 800;
		color: #0F172A;
	}

	.stat-desc {
		font-size: 0.8rem;
		color: #64748B;
		font-weight: 600;
		margin-top: 0.15rem;
	}

	.text-success {
		color: #059669;
	}

	.text-muted {
		color: #94A3B8;
	}

	/* Toolbar */
	.toolbar-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		padding: 0.85rem 1.25rem;
	}

	.search-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	:global(.search-icon) {
		position: absolute;
		left: 0.85rem;
		color: #94A3B8;
	}

	.search-field {
		width: 100%;
		padding: 0.65rem 2.5rem;
		border: 1px solid #E2E8F0;
		border-radius: 0.65rem;
		font-size: 0.9rem;
		outline: none;
	}

	.search-field:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.12);
	}

	.clear-search-btn {
		position: absolute;
		right: 0.85rem;
		background: none;
		border: none;
		color: #94A3B8;
		cursor: pointer;
	}

	/* Table Card */
	.table-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1rem;
		overflow: hidden;
	}

	.table-responsive {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.875rem;
	}

	.data-table thead {
		background: #F8FAFC;
		border-bottom: 1px solid #E2E8F0;
	}

	.data-table th {
		padding: 0.95rem 1.25rem;
		font-weight: 700;
		color: #475569;
		font-size: 0.8rem;
		letter-spacing: 0.02em;
	}

	.data-table td {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #F1F5F9;
		vertical-align: middle;
	}

	.data-table tbody tr:hover {
		background: #FBFDFB;
	}

	.row-disabled {
		opacity: 0.6;
		background: #F8FAFC;
	}

	.order-cell {
		text-align: center;
	}

	.order-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: #F1F5F9;
		color: #334155;
		border-radius: 50%;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.poli-identity {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.poli-icon-thumb {
		width: 38px;
		height: 38px;
		background: #E8F5E9;
		color: #0A5C36;
		border-radius: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.poli-title {
		font-size: 0.925rem;
		color: #0F172A;
		font-weight: 700;
	}

	.code-pill {
		background: #F1F5F9;
		color: #0A5C36;
		font-weight: 800;
		padding: 0.25rem 0.65rem;
		border-radius: 0.45rem;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
	}

	.icon-label {
		color: #64748B;
		font-size: 0.8rem;
	}

	.toggle-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		border: 1px solid #CBD5E1;
		background: #F8FAFC;
		color: #64748B;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toggle-badge.active {
		background: #D1FAE5;
		border-color: #A7F3D0;
		color: #047857;
	}

	.action-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.action-icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 0.5rem;
		border: 1px solid #E2E8F0;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}

	.edit-btn {
		color: #0284C7;
	}

	.edit-btn:hover {
		background: #E0F2FE;
		border-color: #BAE6FD;
	}

	.delete-btn {
		color: #DC2626;
	}

	.delete-btn:hover {
		background: #FEE2E2;
		border-color: #FECACA;
	}

	.empty-row {
		text-align: center;
		padding: 3rem 1rem !important;
		color: #64748B;
	}

	/* Modals */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.5rem;
	}

	.modal-container {
		background: white;
		width: 100%;
		max-width: 520px;
		border-radius: 1.25rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		animation: modalFadeIn 0.2s ease-out;
	}

	.delete-dialog {
		max-width: 440px;
		padding: 2rem;
		text-align: center;
	}

	.delete-icon-wrap {
		width: 60px;
		height: 60px;
		background: #FEE2E2;
		color: #DC2626;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.25rem;
	}

	.delete-dialog h3 {
		font-size: 1.2rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0 0 0.5rem 0;
	}

	.delete-dialog p {
		font-size: 0.875rem;
		color: #64748B;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.modal-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #F1F5F9;
	}

	.modal-head h3 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		color: #0F172A;
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: #94A3B8;
		cursor: pointer;
	}

	.form-error-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #FEE2E2;
		color: #B91C1C;
		padding: 0.75rem 1.5rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.modal-form-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-field label {
		font-size: 0.825rem;
		font-weight: 700;
		color: #334155;
	}

	.form-input,
	.form-select {
		padding: 0.65rem 0.85rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.6rem;
		font-size: 0.9rem;
		outline: none;
		background: white;
	}

	.form-input:focus,
	.form-select:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.15);
	}

	.text-uppercase {
		text-transform: uppercase;
	}

	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.icon-picker-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-preview-box {
		width: 42px;
		height: 42px;
		border-radius: 0.6rem;
		background: #E8F5E9;
		color: #0A5C36;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid #A7F3D0;
		flex-shrink: 0;
	}

	.flex-1 {
		flex: 1;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		margin-top: 0.25rem;
	}

	.custom-checkbox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: #334155;
		cursor: pointer;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #F1F5F9;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		background: #F8FAFC;
	}

	.justify-center {
		justify-content: center;
	}

	.btn-cancel {
		padding: 0.65rem 1.15rem;
		border-radius: 0.6rem;
		border: 1px solid #CBD5E1;
		background: white;
		font-size: 0.85rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.btn-save {
		padding: 0.65rem 1.25rem;
		border-radius: 0.6rem;
		border: none;
		background: #0A5C36;
		font-size: 0.85rem;
		font-weight: 700;
		color: white;
		cursor: pointer;
	}

	.btn-delete-confirm {
		padding: 0.65rem 1.25rem;
		border-radius: 0.6rem;
		border: none;
		background: #DC2626;
		font-size: 0.85rem;
		font-weight: 700;
		color: white;
		cursor: pointer;
	}

	@keyframes modalFadeIn {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* --- Responsive Mobile & Tablet Styles (RWD) --- */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.btn-primary {
			width: 100%;
			justify-content: center;
		}

		.stats-ribbon {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.toolbar-card {
			flex-direction: column;
			gap: 0.75rem;
		}

		.data-table {
			min-width: 650px;
		}

		.modal-container {
			width: 95vw;
			max-width: 500px;
			max-height: 90vh;
			overflow-y: auto;
		}
	}

	@media (max-width: 640px) {
		.main-title {
			font-size: 1.25rem;
		}

		.subtitle {
			font-size: 0.8rem;
		}
	}
</style>
