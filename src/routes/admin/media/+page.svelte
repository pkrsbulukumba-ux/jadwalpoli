<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		ImagePlay,
		Plus,
		Image as ImageIcon,
		Video,
		HardDrive,
		Globe,
		Upload,
		Eye,
		Edit3,
		Trash2,
		X,
		Check,
		AlertTriangle,
		Play,
		Volume2,
		Info,
		FolderOpen,
		Folder,
		FileVideo,
		ArrowLeft,
		Search,
		RefreshCw
	} from '@lucide/svelte';
	import { DataRepository } from '$lib/services/data.repository';
	import { MediaUrlService } from '$lib/services/media-url.service';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import type { MediaAnnouncement } from '$lib/types';

	let mediaList = $state<MediaAnnouncement[]>([]);
	let activeFilter = $state<'all' | 'image' | 'video'>('all');
	let unsubRealtime: (() => void) | null = null;

	// State Modal Tambah / Edit
	let isModalOpen = $state(false);
	let isEditing = $state(false);
	let currentId = $state('');
	let formTitle = $state('');
	let formMediaType = $state<'image' | 'video'>('image');
	let formStorageType = $state<'online' | 'local_path' | 'upload'>('online');
	let formUrl = $state('');
	let formLocalPath = $state('');
	let formSortOrder = $state(1);
	let formIsActive = $state(true);
	let formError = $state('');
	let uploadedFileName = $state('');
	let isUploading = $state(false);
	let uploadSuccessAlert = $state('');

	// State Modal Preview Penuh
	let isPreviewOpen = $state(false);
	let previewItem = $state<MediaAnnouncement | null>(null);

	// State Konfirmasi Hapus
	let isDeleteConfirmOpen = $state(false);
	let itemToDelete = $state<MediaAnnouncement | null>(null);

	// State File Browser Modal untuk Perangkat Lokal
	let isBrowserOpen = $state(false);
	let browserLoading = $state(false);
	let browserError = $state('');
	let browserCurrentPath = $state('');
	let browserParentPath = $state<string | null>(null);
	let browserBreadcrumbs = $state<Array<{ name: string; path: string }>>([]);
	let browserFolders = $state<Array<{ name: string; path: string; isDirectory: boolean }>>([]);
	let browserFiles = $state<
		Array<{
			name: string;
			path: string;
			mappedPath: string;
			size: number;
			formattedSize: string;
			ext: string;
			modifiedAt: string;
			isDirectory: boolean;
		}>
	>([]);
	let browserShortcuts = $state<Array<{ label: string; key: string; path: string }>>([]);
	let browserSearchQuery = $state('');
	let isSavingLocalVideo = $state(false);
	let localSaveAlert = $state('');

	// Deteksi video lokal di static/videos untuk saran cepat satu klik
	let detectedLocalVideos = $state<Array<{ name: string; mappedPath: string; formattedSize: string }>>([]);

	async function loadDetectedLocalVideos() {
		try {
			const res = await fetch('/api/media/browse?path=videos&type=video');
			const data = await res.json();
			if (data.success && Array.isArray(data.files)) {
				detectedLocalVideos = data.files.map((f: { name: string; mappedPath: string; formattedSize: string }) => ({
					name: f.name,
					mappedPath: f.mappedPath,
					formattedSize: f.formattedSize
				}));
			}
		} catch {
			// Abaikan jika endpoint belum siap
		}
	}

	async function openFileBrowser(targetPath: string = '') {
		isBrowserOpen = true;
		browserLoading = true;
		browserError = '';
		localSaveAlert = '';
		browserSearchQuery = '';

		try {
			const query = targetPath ? `?path=${encodeURIComponent(targetPath)}&type=video` : '?path=videos&type=video';
			const res = await fetch(`/api/media/browse${query}`);
			const data = await res.json();

			if (data.success) {
				browserCurrentPath = data.currentPath;
				browserParentPath = data.parentPath;
				browserBreadcrumbs = data.breadcrumbs || [];
				browserFolders = data.folders || [];
				browserFiles = data.files || [];
				browserShortcuts = data.shortcuts || [];
			} else {
				browserError = data.message || 'Gagal memuat direktori berkas.';
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			browserError = `Gagal membuka penjelajah berkas: ${msg}`;
		} finally {
			browserLoading = false;
		}
	}

	function selectLocalFile(mappedPath: string) {
		formLocalPath = mappedPath;
		isBrowserOpen = false;
		uploadSuccessAlert = `Jalur berkas berhasil dipetakan: ${mappedPath}`;
		setTimeout(() => {
			uploadSuccessAlert = '';
		}, 4000);
	}

	async function handleSaveNewLocalVideo(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isSavingLocalVideo = true;
		localSaveAlert = '';
		browserError = '';

		try {
			const fd = new FormData();
			fd.append('file', file);
			fd.append('targetDir', browserCurrentPath || 'videos');

			const res = await fetch('/api/media/browse', {
				method: 'POST',
				body: fd
			});
			const data = await res.json();

			if (data.success) {
				localSaveAlert = data.message || `Berkas "${file.name}" berhasil disimpan!`;
				// Segarkan direktori aktif
				await openFileBrowser(browserCurrentPath);
				// Otomatis pilih berkas ini
				selectLocalFile(data.mappedPath);
				loadDetectedLocalVideos();
			} else {
				browserError = data.message || 'Gagal menyimpan berkas ke perangkat.';
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			browserError = `Gagal menyimpan berkas: ${msg}`;
		} finally {
			isSavingLocalVideo = false;
		}
	}

	function loadData() {
		mediaList = DataRepository.getMediaList();
	}

	onMount(() => {
		loadData();
		loadDetectedLocalVideos();

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

	let filteredMedia = $derived(
		mediaList.filter((m) => {
			if (activeFilter === 'all') return true;
			return m.media_type === activeFilter;
		})
	);

	let imageCount = $derived(mediaList.filter((m) => m.media_type === 'image').length);
	let videoCount = $derived(mediaList.filter((m) => m.media_type === 'video').length);
	let activeCount = $derived(mediaList.filter((m) => m.is_active).length);

	function openAddModal() {
		isEditing = false;
		currentId = '';
		formTitle = '';
		formMediaType = 'image';
		formStorageType = 'online';
		formUrl = '';
		formLocalPath = '';
		formSortOrder = mediaList.length + 1;
		formIsActive = true;
		formError = '';
		uploadedFileName = '';
		uploadSuccessAlert = '';
		isUploading = false;
		isModalOpen = true;
		loadDetectedLocalVideos();
	}

	function openEditModal(item: MediaAnnouncement) {
		isEditing = true;
		currentId = item.id;
		formTitle = item.title;
		formMediaType = item.media_type;
		formStorageType = item.storage_type || (item.public_url.startsWith('http') ? 'online' : (item.public_url.startsWith('/uploads/') ? 'upload' : 'local_path'));
		formUrl = formStorageType === 'online' || formStorageType === 'upload' ? item.public_url : '';
		formLocalPath = formStorageType === 'local_path' ? item.public_url : '';
		formSortOrder = item.sort_order;
		formIsActive = item.is_active;
		formError = '';
		uploadedFileName = '';
		uploadSuccessAlert = '';
		isUploading = false;
		isModalOpen = true;
		loadDetectedLocalVideos();
	}

	async function handleFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		uploadedFileName = file.name;
		isUploading = true;
		formError = '';
		uploadSuccessAlert = '';

		const detectType = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(file.name) ? 'video' : 'image';

		try {
			if (isSupabaseConfigured()) {
				const { uploadToSupabaseStorage } = await import('$lib/supabase/client');
				const result = await uploadToSupabaseStorage('announcements', file);
				if (result.success && result.url) {
					formUrl = result.url;
					formMediaType = detectType;
					uploadSuccessAlert = `Berkas "${file.name}" berhasil diunggah ke Supabase Storage!`;
				} else {
					// Fallback otomatis ke penyimpanan lokal server jika bucket Supabase belum ada atau melampaui limit
					const fd = new FormData();
					fd.append('file', file);
					fd.append('folder', 'announcements');
					const res = await fetch('/api/upload', { method: 'POST', body: fd });
					const data = await res.json();
					if (data.success && data.url) {
						formUrl = data.url;
						formMediaType = detectType;
						uploadSuccessAlert = `Berkas "${file.name}" berhasil disimpan ke server lokal!`;
					} else {
						formError = data.message || result.message || 'Gagal mengunggah berkas.';
					}
				}
			} else {
				const fd = new FormData();
				fd.append('file', file);
				fd.append('folder', 'announcements');
				const res = await fetch('/api/upload', { method: 'POST', body: fd });
				const data = await res.json();
				if (data.success && data.url) {
					formUrl = data.url;
					formMediaType = detectType;
					uploadSuccessAlert = `Berkas "${file.name}" berhasil diunggah ke server!`;
				} else {
					formError = data.message || 'Gagal mengunggah berkas.';
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			formError = `Gagal mengunggah berkas: ${msg}`;
		} finally {
			isUploading = false;
		}
	}

	function handleSave() {
		if (!formTitle.trim()) {
			formError = 'Judul pengumuman wajib diisi';
			return;
		}

		let finalPublicUrl = '';
		if (formStorageType === 'online') {
			if (!formUrl.trim()) {
				formError = 'URL media online wajib diisi';
				return;
			}
			finalPublicUrl = formUrl.trim();
		} else if (formStorageType === 'local_path') {
			if (!formLocalPath.trim()) {
				formError = 'Jalur file lokal (path) di perangkat wajib diisi';
				return;
			}
			finalPublicUrl = formLocalPath.trim();
		} else if (formStorageType === 'upload') {
			if (!formUrl) {
				formError = 'Silakan pilih berkas file untuk diunggah';
				return;
			}
			finalPublicUrl = formUrl;
		}

		if (isEditing && currentId) {
			DataRepository.updateMedia(currentId, {
				title: formTitle.trim(),
				media_type: formMediaType,
				public_url: finalPublicUrl,
				file_path: formStorageType === 'local_path' ? finalPublicUrl : 'announcements/' + formTitle.toLowerCase().replace(/\s+/g, '-'),
				storage_type: formStorageType,
				sort_order: Number(formSortOrder),
				is_active: formIsActive
			});
		} else {
			DataRepository.createMedia({
				title: formTitle.trim(),
				media_type: formMediaType,
				public_url: finalPublicUrl,
				file_path: formStorageType === 'local_path' ? finalPublicUrl : 'announcements/' + formTitle.toLowerCase().replace(/\s+/g, '-'),
				storage_type: formStorageType,
				sort_order: Number(formSortOrder),
				is_active: formIsActive
			});
		}

		isModalOpen = false;
		loadData();
	}

	function handleToggleStatus(item: MediaAnnouncement) {
		DataRepository.toggleMediaActive(item.id);
		loadData();
	}

	function openPreviewModal(item: MediaAnnouncement) {
		previewItem = item;
		isPreviewOpen = true;
	}

	function promptDelete(item: MediaAnnouncement) {
		itemToDelete = item;
		isDeleteConfirmOpen = true;
	}

	async function confirmDelete() {
		if (itemToDelete) {
			const targetItem = itemToDelete;
			// Jika berkas berada di /uploads/, kirim request DELETE ke /api/upload untuk membersihkan berkas fisik
			if (targetItem.public_url && targetItem.public_url.includes('/uploads/')) {
				try {
					await fetch('/api/upload', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: targetItem.public_url })
					});
				} catch (err) {
					console.warn('Gagal menghapus berkas fisik server:', err);
				}
			}

			DataRepository.deleteMedia(targetItem.id);
			itemToDelete = null;
			isDeleteConfirmOpen = false;
			loadData();
		}
	}
</script>

<svelte:head>
	<title>Media Pengumuman - CMS RSUD</title>
</svelte:head>

<div class="page-shell">
	<!-- Topbar Header Section Ringkas -->
	<div class="page-header-compact">
		<div class="header-titles">
			<div class="title-row">
				<div class="badge-icon-sm">
					<ImagePlay size={20} />
				</div>
				<div>
					<h1 class="main-title-compact">Media Pengumuman & Edukasi</h1>
					<p class="subtitle-compact">Kelola poster gambar dan video edukasi pada siklus tayangan Kiosk TV.</p>
				</div>
			</div>
		</div>

		<button type="button" class="btn-primary-compact" onclick={openAddModal}>
			<Plus size={16} />
			<span>Tambah Media</span>
		</button>
	</div>

	<!-- Bar Toolbar Ringkas: Filter Tab & Status Info Ringkas (Kecil & Simpel) -->
	<div class="toolbar-strip">
		<div class="filter-tab-bar">
			<button
				type="button"
				class="filter-btn"
				class:active={activeFilter === 'all'}
				onclick={() => (activeFilter = 'all')}
			>
				<span>Semua ({mediaList.length})</span>
			</button>
			<button
				type="button"
				class="filter-btn"
				class:active={activeFilter === 'image'}
				onclick={() => (activeFilter = 'image')}
			>
				<ImageIcon size={14} />
				<span>Gambar ({imageCount})</span>
			</button>
			<button
				type="button"
				class="filter-btn"
				class:active={activeFilter === 'video'}
				onclick={() => (activeFilter = 'video')}
			>
				<Video size={14} />
				<span>Video ({videoCount})</span>
			</button>
		</div>

		<div class="mini-info-pills">
			<span class="info-pill-tag green" title="Media yang saat ini tampil di Kiosk">
				<span class="dot-indicator green"></span>
				<span>{activeCount} Aktif di Kiosk</span>
			</span>
			<span class="info-pill-tag blue" title="Slide gambar atau poster informasi">
				<span class="dot-indicator blue"></span>
				<span>{imageCount} Gambar</span>
			</span>
			<span class="info-pill-tag purple" title="Video edukasi bersuara">
				<span class="dot-indicator purple"></span>
				<span>{videoCount} Video</span>
			</span>
		</div>
	</div>

	<!-- Gallery Media Cards Grid -->
	{#if filteredMedia.length === 0}
		<div class="empty-state-card">
			<ImagePlay size={48} class="empty-icon" />
			<h3>Belum Ada Media Pengumuman</h3>
			<p>Tambahkan poster informasi atau video edukasi untuk ditampilkan di sela-sela jadwal poliklinik.</p>
			<button type="button" class="btn-primary" onclick={openAddModal}>
				<Plus size={16} />
				<span>Tambah Media Sekarang</span>
			</button>
		</div>
	{:else}
		<div class="media-grid">
			{#each filteredMedia as item (item.id)}
				{@const parsed = MediaUrlService.resolveMediaUrl(item.public_url, item.media_type, item.storage_type)}
				<div class="media-card" class:card-disabled={!item.is_active}>
					<!-- Thumbnail Stage -->
					<div class="thumbnail-stage">
						{#if item.media_type === 'image'}
							<img src={parsed.resolvedUrl} alt={item.title} class="media-thumb-img" />
						{:else if parsed.type === 'youtube'}
							<div class="video-thumb-wrap">
								<img
									src="https://img.youtube.com/vi/{parsed.youtubeId}/hqdefault.jpg"
									alt={item.title}
									class="media-thumb-img"
								/>
								<div class="video-overlay-icon">
									<Play size={24} fill="white" />
								</div>
							</div>
						{:else}
							<div class="video-thumb-wrap">
								<video src={parsed.resolvedUrl} class="media-thumb-video" preload="metadata" muted></video>
								<div class="video-overlay-icon">
									<Play size={24} fill="white" />
								</div>
							</div>
						{/if}

						<div class="media-tags-overlay">
							<span class="type-tag" class:tag-video={item.media_type === 'video'}>
								{#if item.media_type === 'video'}
									<Video size={12} />
									<span>VIDEO</span>
								{:else}
									<ImageIcon size={12} />
									<span>GAMBAR</span>
								{/if}
							</span>

							{#if item.storage_type === 'local_path'}
								<span class="storage-tag local" title="File berada di penyimpanan internal perangkat">
									<HardDrive size={11} />
									<span>Penyimpanan Lokal</span>
								</span>
							{:else}
								<span class="storage-tag online" title="File diakses melalui jaringan / URL">
									<Globe size={11} />
									<span>Online / URL</span>
								</span>
							{/if}
						</div>

						<button
							type="button"
							class="preview-trigger-btn"
							onclick={() => openPreviewModal(item)}
							title="Lihat Pratinjau Lengkap"
						>
							<Eye size={18} />
						</button>
					</div>

					<!-- Card Details -->
					<div class="card-details">
						<div class="details-top">
							<span class="order-label">Urutan Putar: #{item.sort_order}</span>
							<button
								type="button"
								class="toggle-status-btn"
								class:active={item.is_active}
								onclick={() => handleToggleStatus(item)}
								title={item.is_active ? 'Klik untuk nonaktifkan dari Kiosk' : 'Klik untuk aktifkan di Kiosk'}
							>
								{#if item.is_active}
									<Check size={13} />
									<span>Tampil</span>
								{:else}
									<X size={13} />
									<span>Off</span>
								{/if}
							</button>
						</div>

						<h3 class="media-title" title={item.title}>{item.title}</h3>
						<p class="media-path-truncate" title={item.public_url}>
							{item.public_url}
						</p>

						<div class="card-actions-row">
							<button
								type="button"
								class="card-action-btn edit"
								onclick={() => openEditModal(item)}
								title="Edit Media"
							>
								<Edit3 size={15} />
								<span>Edit</span>
							</button>
							<button
								type="button"
								class="card-action-btn delete"
								onclick={() => promptDelete(item)}
								title="Hapus Media"
							>
								<Trash2 size={15} />
								<span>Hapus</span>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal Tambah / Edit Media -->
{#if isModalOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container">
			<div class="modal-head">
				<h3>{isEditing ? 'Edit Media Pengumuman' : 'Tambah Media Pengumuman Baru'}</h3>
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
					<label for="media-title">Judul Pengumuman / Edukasi *</label>
					<input
						id="media-title"
						type="text"
						bind:value={formTitle}
						placeholder="Contoh: Layanan Poliklinik Eksekutif RSUD"
						class="form-input"
					/>
				</div>

				<!-- Pilihan Tipe Media -->
				<div class="form-field">
					<label for="media-type-choice">Pilih Jenis Media *</label>
					<div class="type-choice-grid">
						<button
							type="button"
							class="choice-btn"
							class:selected={formMediaType === 'image'}
							onclick={() => (formMediaType = 'image')}
						>
							<ImageIcon size={20} />
							<div>
								<strong>Gambar / Poster</strong>
								<span>Format JPG, PNG, WebP (Durasi slide 10-15s)</span>
							</div>
						</button>
						<button
							type="button"
							class="choice-btn"
							class:selected={formMediaType === 'video'}
							onclick={() => (formMediaType = 'video')}
						>
							<Video size={20} />
							<div>
								<strong>Video Edukasi</strong>
								<span>Format MP4 (Bersuara, otomatis lanjut saat video habis)</span>
							</div>
						</button>
					</div>
				</div>

				<!-- Pilihan Sumber Media (Online URL vs Local Internal Storage Path vs Upload) -->
				<div class="form-field">
					<label for="storage-mode-choice">
						Sumber File Media
						{#if formMediaType === 'video'}
							<span class="highlight-hint">(Tersedia opsi penyimpanan lokal untuk video besar)</span>
						{/if}
					</label>

					<div class="storage-mode-selector">
						{#if formMediaType === 'video'}
							<!-- Opsi Utama Khusus Video Ukuran Besar -->
							<button
								type="button"
								class="mode-pill"
								class:active={formStorageType === 'local_path'}
								onclick={() => (formStorageType = 'local_path')}
							>
								<HardDrive size={15} />
								<span>Jalur File Lokal (Internal TV)</span>
							</button>
						{/if}

						<button
							type="button"
							class="mode-pill"
							class:active={formStorageType === 'online'}
							onclick={() => (formStorageType = 'online')}
						>
							<Globe size={15} />
							<span>URL Online / CDN</span>
						</button>

						<button
							type="button"
							class="mode-pill"
							class:active={formStorageType === 'upload'}
							onclick={() => (formStorageType = 'upload')}
						>
							<Upload size={15} />
							<span>Upload Berkas Langsung</span>
						</button>
					</div>

					<!-- Form Input Sesuai Pilihan Sumber -->
					{#if formStorageType === 'local_path'}
						<div class="input-panel-box local-box">
							<div class="tip-box">
								<Info size={16} />
								<div>
									<strong>Pilihan Tepat Untuk Video Ukuran Besar (> 50MB):</strong>
									<p>Simpan video di memori internal TV / perangkat kiosk untuk menghemat kuota dan memastikan video terputar mulus tanpa buffering.</p>
								</div>
							</div>

							<div class="path-field-header">
								<label for="local-path-input">Jalur Path Berkas di Perangkat *</label>
								<span class="path-format-tag">Otomatis / Manual</span>
							</div>

							<div class="file-path-picker-row">
								<input
									id="local-path-input"
									type="text"
									bind:value={formLocalPath}
									placeholder="Contoh: /videos/edukasi-layanan.mp4 atau C:\Videos\promo.mp4"
									class="form-input path-input-with-btn"
								/>
								<button
									type="button"
									class="btn-browse-file"
									onclick={() => openFileBrowser('')}
									title="Buka Penjelajah Berkas di Perangkat"
								>
									<FolderOpen size={16} />
									<span>Telusuri Berkas (Browser File)</span>
								</button>
							</div>

							{#if detectedLocalVideos.length > 0}
								<div class="detected-videos-bar">
									<span class="detected-label">💡 Video terdeteksi di static/videos:</span>
									<div class="detected-pills-list">
										{#each detectedLocalVideos as vid}
											<button
												type="button"
												class="detected-pill-btn"
												class:active={formLocalPath === vid.mappedPath}
												onclick={() => (formLocalPath = vid.mappedPath)}
												title={`Klik untuk memilih: ${vid.name} (${vid.formattedSize})`}
											>
												<FileVideo size={13} />
												<span class="pill-name">{vid.name}</span>
												<span class="pill-size">({vid.formattedSize})</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<span class="input-subnote">
								💡 Tips: Tekan tombol <strong>Telusuri Berkas (Browser File)</strong> untuk memilih video di folder perangkat atau mengimpor berkas baru secara otomatis tanpa harus mengetik manual jalurnya.
							</span>
						</div>
					{:else if formStorageType === 'online'}
						<div class="input-panel-box">
							<label for="online-url-input">Alamat URL Media (HTTP / HTTPS) *</label>
							<input
								id="online-url-input"
								type="url"
								bind:value={formUrl}
								placeholder="https://commondatastorage.googleapis.com/... atau https://domain-rsud.go.id/video.mp4"
								class="form-input"
							/>
						</div>
					{:else if formStorageType === 'upload'}
						<div class="input-panel-box">
							<label for="file-upload-input">Pilih File dari Komputer *</label>
							<input
								id="file-upload-input"
								type="file"
								accept={formMediaType === 'image' ? 'image/*' : 'video/*'}
								onchange={handleFileUpload}
								class="file-input"
							/>
							{#if isUploading}
								<div class="upload-loading-badge">
									<span class="upload-spinner"></span>
									<span>Sedang mengunggah berkas ke server fisik...</span>
								</div>
							{/if}

							{#if uploadSuccessAlert}
								<div class="upload-success-alert">
									<Check size={16} />
									<span>{uploadSuccessAlert}</span>
								</div>
							{/if}

							{#if uploadedFileName && !uploadSuccessAlert}
								<span class="uploaded-badge">✓ Berkas terpilih: {uploadedFileName}</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="form-grid-2">
					<div class="form-field">
						<label for="media-order">Urutan Tampil (Sort Order)</label>
						<input
							id="media-order"
							type="number"
							min="1"
							bind:value={formSortOrder}
							class="form-input"
						/>
					</div>

					<div class="checkbox-field-wrap">
						<label class="custom-checkbox">
							<input type="checkbox" bind:checked={formIsActive} />
							<span class="checkmark"></span>
							<span class="label-text">Tampilkan langsung pada tayangan Kiosk TV</span>
						</label>
					</div>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (isModalOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-save" onclick={handleSave}>
					{isEditing ? 'Simpan Perubahan' : 'Simpan Media'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Preview Media Penuh -->
{#if isPreviewOpen && previewItem}
	{@const parsedPreview = MediaUrlService.resolveMediaUrl(previewItem.public_url, previewItem.media_type, previewItem.storage_type)}
	<div class="modal-overlay preview-overlay" role="dialog" aria-modal="true">
		<div class="modal-container preview-container">
			<div class="modal-head">
				<div class="preview-head-meta">
					<h3>{previewItem.title}</h3>
					<span class="preview-type-pill">
						{previewItem.media_type.toUpperCase()} •
						{previewItem.storage_type === 'local_path' ? 'Penyimpanan Lokal' : 'Online URL'}
					</span>
				</div>
				<button type="button" class="close-modal-btn" onclick={() => (isPreviewOpen = false)}>
					<X size={22} />
				</button>
			</div>

			<div class="preview-stage-content">
				{#if previewItem.media_type === 'image'}
					<img src={parsedPreview?.resolvedUrl || previewItem.public_url} alt={previewItem.title} class="full-preview-img" />
				{:else if parsedPreview?.type === 'youtube'}
					<iframe
						src={MediaUrlService.getYouTubeEmbedUrl(parsedPreview.youtubeId!, true)}
						class="full-preview-video"
						title={previewItem.title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				{:else}
					<video
						src={parsedPreview?.resolvedUrl || previewItem.public_url}
						controls
						autoplay
						class="full-preview-video"
					>
						<track kind="captions" />
						Browser Anda tidak mendukung tag video.
					</video>
				{/if}
			</div>

			<div class="modal-footer justify-between">
				<span class="preview-source-url">Sumber: {previewItem.public_url}</span>
				<button type="button" class="btn-cancel" onclick={() => (isPreviewOpen = false)}>
					Tutup Pratinjau
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Konfirmasi Hapus -->
{#if isDeleteConfirmOpen && itemToDelete}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal-container delete-dialog">
			<div class="delete-icon-wrap">
				<AlertTriangle size={32} />
			</div>
			<h3>Konfirmasi Hapus Media</h3>
			<p>
				Apakah Anda yakin ingin menghapus media pengumuman <strong>{itemToDelete.title}</strong>? Media ini tidak akan diputar lagi di layar Kiosk TV.
			</p>

			<div class="modal-footer justify-center">
				<button type="button" class="btn-cancel" onclick={() => (isDeleteConfirmOpen = false)}>
					Batal
				</button>
				<button type="button" class="btn-delete-confirm" onclick={confirmDelete}>
					Ya, Hapus Media
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal File Browser Perangkat (Local File Explorer) -->
{#if isBrowserOpen}
	<div class="modal-overlay browser-overlay" role="dialog" aria-modal="true">
		<div class="modal-container browser-container">
			<div class="modal-head">
				<div class="browser-head-title">
					<FolderOpen size={24} class="text-emerald" />
					<div>
						<h3>Penjelajah Berkas di Perangkat (File Browser)</h3>
						<p>Pilih berkas video dari penyimpanan lokal Kiosk untuk memetakan path secara otomatis.</p>
					</div>
				</div>
				<button type="button" class="close-modal-btn" onclick={() => (isBrowserOpen = false)}>
					<X size={20} />
				</button>
			</div>

			<!-- Browser Controls Bar -->
			<div class="browser-toolbar">
				<!-- Shortcuts Buttons -->
				<div class="browser-shortcuts">
					{#each browserShortcuts as sc}
						<button
							type="button"
							class="shortcut-btn"
							class:active={browserCurrentPath === sc.path}
							onclick={() => openFileBrowser(sc.path)}
						>
							<Folder size={14} />
							<span>{sc.label}</span>
						</button>
					{/each}
				</div>

				<!-- Action to upload/copy new video to this folder -->
				<div class="browser-actions">
					<label class="btn-import-local">
						<Upload size={14} />
						<span>Simpan Video Baru ke Sini</span>
						<input
							type="file"
							accept="video/*"
							onchange={handleSaveNewLocalVideo}
							class="hidden-file-input"
						/>
					</label>
				</div>
			</div>

			<!-- Breadcrumb & Search -->
			<div class="browser-nav-bar">
				<div class="breadcrumb-trail">
					{#if browserParentPath}
						<button
							type="button"
							class="nav-up-btn"
							onclick={() => openFileBrowser(browserParentPath || '')}
							title="Naik Satu Tingkat"
						>
							<ArrowLeft size={14} />
							<span>Kembali</span>
						</button>
					{/if}

					<div class="breadcrumbs-list">
						{#each browserBreadcrumbs as crumb, idx}
							<button
								type="button"
								class="crumb-btn"
								class:current={idx === browserBreadcrumbs.length - 1}
								onclick={() => openFileBrowser(crumb.path)}
							>
								{crumb.name}
							</button>
							{#if idx < browserBreadcrumbs.length - 1}
								<span class="crumb-sep">/</span>
							{/if}
						{/each}
					</div>
				</div>

				<div class="browser-search-box">
					<Search size={14} />
					<input
						type="text"
						bind:value={browserSearchQuery}
						placeholder="Cari nama video..."
						class="browser-search-input"
					/>
				</div>
			</div>

			<!-- Alerts in Browser -->
			{#if browserError}
				<div class="browser-alert error">
					<AlertTriangle size={16} />
					<span>{browserError}</span>
				</div>
			{/if}

			{#if localSaveAlert}
				<div class="browser-alert success">
					<Check size={16} />
					<span>{localSaveAlert}</span>
				</div>
			{/if}

			{#if isSavingLocalVideo}
				<div class="browser-alert loading">
					<span class="upload-spinner"></span>
					<span>Sedang menyalin berkas video ke penyimpanan perangkat...</span>
				</div>
			{/if}

			<!-- Browser Content Area -->
			<div class="browser-content-area">
				{#if browserLoading}
					<div class="browser-loading-state">
						<span class="upload-spinner"></span>
						<span>Membaca berkas di perangkat...</span>
					</div>
				{:else}
					{@const filteredFolders = browserFolders.filter((f) => !browserSearchQuery || f.name.toLowerCase().includes(browserSearchQuery.toLowerCase()))}
					{@const filteredFiles = browserFiles.filter((f) => !browserSearchQuery || f.name.toLowerCase().includes(browserSearchQuery.toLowerCase()))}

					{#if filteredFolders.length === 0 && filteredFiles.length === 0}
						<div class="browser-empty-state">
							<FolderOpen size={42} class="text-muted" />
							<strong>Folder ini belum berisi berkas video (.mp4, .webm, .mkv, .mov).</strong>
							<p>Gunakan tombol <em>"Simpan Video Baru ke Sini"</em> di atas untuk meletakkan video baru, atau buka folder lain melalui tombol pintasan.</p>
						</div>
					{:else}
						<div class="browser-items-grid">
							<!-- Folders -->
							{#each filteredFolders as folder}
								<button
									type="button"
									class="browser-item-card folder-card"
									onclick={() => openFileBrowser(folder.path)}
									title={`Buka folder ${folder.name}`}
								>
									<div class="item-icon-wrap folder-icon">
										<Folder size={22} />
									</div>
									<div class="item-info">
										<span class="item-name" title={folder.name}>{folder.name}</span>
										<span class="item-type">Folder Direktori</span>
									</div>
								</button>
							{/each}

							<!-- Video Files -->
							{#each filteredFiles as file}
								<div class="browser-item-card file-card" class:selected={formLocalPath === file.mappedPath}>
									<div class="item-icon-wrap video-icon">
										<FileVideo size={22} />
										<span class="file-ext-tag">{file.ext.replace('.', '').toUpperCase()}</span>
									</div>
									<div class="item-info">
										<span class="item-name" title={file.name}>{file.name}</span>
										<div class="item-meta">
											<span class="item-size">{file.formattedSize}</span>
											<span class="item-mapped" title={file.mappedPath}>Path: {file.mappedPath}</span>
										</div>
									</div>
									<button
										type="button"
										class="btn-select-file"
										onclick={() => selectLocalFile(file.mappedPath)}
										title="Pilih dan petakan berkas ini"
									>
										<Check size={14} />
										<span>Pilih</span>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-footer browser-footer">
				<div class="browser-footer-note">
					<span>💡 Berkas yang dipilih akan otomatis mengisi input jalur tanpa perlu mengetik manual.</span>
				</div>
				<button type="button" class="btn-cancel" onclick={() => (isBrowserOpen = false)}>
					Tutup
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

	.page-header-compact {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #E2E8F0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.badge-icon-sm {
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

	.main-title-compact {
		font-size: 1.25rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
		line-height: 1.2;
	}

	.subtitle-compact {
		font-size: 0.78rem;
		color: #64748B;
		margin: 0.15rem 0 0 0;
	}

	.btn-primary-compact {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #0A5C36;
		color: white;
		padding: 0.55rem 1rem;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary-compact:hover {
		background: #074327;
	}

	/* Toolbar Strip: Tabs & Mini Info Pills */
	.toolbar-strip {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
		background: #FFFFFF;
		padding: 0.5rem 0.85rem;
		border-radius: 0.85rem;
		border: 1px solid #E2E8F0;
	}

	.mini-info-pills {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.info-pill-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		color: #475569;
	}

	.info-pill-tag.green {
		background: #F0FDF4;
		border-color: #BBF7D0;
		color: #166534;
	}

	.info-pill-tag.blue {
		background: #F0F9FF;
		border-color: #BAE6FD;
		color: #075985;
	}

	.info-pill-tag.purple {
		background: #FAF5FF;
		border-color: #E9D5FF;
		color: #6B21A8;
	}

	.dot-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.dot-indicator.green { background: #16A34A; }
	.dot-indicator.blue { background: #0284C7; }
	.dot-indicator.purple { background: #9333EA; }

	/* Filter Tab Bar */
	.filter-tab-bar {
		display: flex;
		gap: 0.5rem;
		background: #F1F5F9;
		padding: 0.35rem;
		border-radius: 0.85rem;
		width: fit-content;
		border: 1px solid #E2E8F0;
	}

	.filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1.15rem;
		border-radius: 0.65rem;
		font-size: 0.825rem;
		font-weight: 700;
		color: #64748B;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.filter-btn:hover { color: #0F172A; }
	.filter-btn.active {
		background: white;
		color: #0A5C36;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
	}

	/* Empty State */
	.empty-state-card {
		background: white;
		border: 1px dashed #CBD5E1;
		border-radius: 1.25rem;
		padding: 4rem 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	:global(.empty-icon) {
		color: #94A3B8;
	}

	.empty-state-card h3 {
		font-size: 1.25rem;
		color: #0F172A;
		margin: 0;
	}

	.empty-state-card p {
		font-size: 0.875rem;
		color: #64748B;
		margin: 0;
		max-width: 420px;
	}

	/* Media Cards Grid */
	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.15rem;
	}

	.media-card {
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 1.15rem;
		overflow: hidden;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	.media-card:hover {
		transform: translateY(-3px);
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
	}

	.card-disabled {
		opacity: 0.6;
		filter: grayscale(0.2);
	}

	/* Thumbnail Stage */
	.thumbnail-stage {
		position: relative;
		width: 100%;
		height: 140px;
		background: #0B1120;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-thumb-img,
	.media-thumb-video {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		object-position: center;
	}

	.video-thumb-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.video-overlay-icon {
		position: absolute;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.media-tags-overlay {
		position: absolute;
		top: 0.85rem;
		left: 0.85rem;
		display: flex;
		gap: 0.4rem;
	}

	.type-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(2, 132, 199, 0.9);
		color: white;
		padding: 0.25rem 0.55rem;
		border-radius: 0.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		backdrop-filter: blur(4px);
	}

	.type-tag.tag-video {
		background: rgba(124, 58, 237, 0.9);
	}

	.storage-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.55rem;
		border-radius: 0.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: white;
		backdrop-filter: blur(4px);
	}

	.storage-tag.local {
		background: rgba(217, 119, 6, 0.9);
	}

	.storage-tag.online {
		background: rgba(16, 185, 129, 0.9);
	}

	.preview-trigger-btn {
		position: absolute;
		bottom: 0.85rem;
		right: 0.85rem;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s;
	}

	.preview-trigger-btn:hover {
		background: rgba(10, 92, 54, 0.9);
	}

	/* Card Details */
	.card-details {
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.details-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.order-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748B;
	}

	.toggle-status-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 700;
		border: 1px solid #CBD5E1;
		background: #F8FAFC;
		color: #64748B;
		cursor: pointer;
	}

	.toggle-status-btn.active {
		background: #D1FAE5;
		border-color: #A7F3D0;
		color: #047857;
	}

	.media-title {
		font-size: 0.925rem;
		font-weight: 750;
		color: #0F172A;
		margin: 0 0 0.25rem 0;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.media-path-truncate {
		font-size: 0.72rem;
		color: #94A3B8;
		margin: 0 0 0.75rem 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-actions-row {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.85rem;
		border-top: 1px solid #F1F5F9;
	}

	.card-action-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.55rem;
		border-radius: 0.6rem;
		font-size: 0.8rem;
		font-weight: 700;
		border: 1px solid #E2E8F0;
		background: white;
		cursor: pointer;
		transition: all 0.15s;
	}

	.card-action-btn.edit {
		color: #0284C7;
	}
	.card-action-btn.edit:hover {
		background: #E0F2FE;
		border-color: #BAE6FD;
	}

	.card-action-btn.delete {
		color: #DC2626;
	}
	.card-action-btn.delete:hover {
		background: #FEE2E2;
		border-color: #FECACA;
	}

	/* Modals */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.5rem;
	}

	.modal-container {
		background: white;
		width: 100%;
		max-width: 560px;
		border-radius: 1.25rem;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		animation: modalFadeIn 0.2s ease-out;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
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
		overflow-y: auto;
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

	.highlight-hint {
		font-weight: 500;
		color: #D97706;
		font-size: 0.75rem;
	}

	.form-input {
		padding: 0.65rem 0.85rem;
		border: 1px solid #CBD5E1;
		border-radius: 0.6rem;
		font-size: 0.9rem;
		outline: none;
		background: white;
	}

	.form-input:focus {
		border-color: #0A5C36;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.15);
	}

	.type-choice-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.choice-btn {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem;
		border-radius: 0.75rem;
		border: 2px solid #E2E8F0;
		background: #F8FAFC;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
	}

	.choice-btn.selected {
		border-color: #0A5C36;
		background: #F0FDF4;
	}

	.choice-btn strong {
		display: block;
		font-size: 0.85rem;
		color: #0F172A;
	}

	.choice-btn span {
		display: block;
		font-size: 0.725rem;
		color: #64748B;
		margin-top: 0.2rem;
		line-height: 1.35;
	}

	/* Storage Mode Selector */
	.storage-mode-selector {
		display: flex;
		gap: 0.4rem;
		background: #F1F5F9;
		padding: 0.3rem;
		border-radius: 0.65rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.mode-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		border-radius: 0.5rem;
		font-size: 0.775rem;
		font-weight: 700;
		color: #64748B;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.mode-pill.active {
		background: white;
		color: #0A5C36;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.input-panel-box {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		background: #F8FAFC;
		border: 1px solid #E2E8F0;
		padding: 1rem;
		border-radius: 0.75rem;
	}

	.local-box {
		background: #FFFBEB;
		border-color: #FDE68A;
	}

	.tip-box {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-size: 0.775rem;
		color: #92400E;
		margin-bottom: 0.5rem;
		line-height: 1.4;
	}

	.input-subnote {
		font-size: 0.75rem;
		color: #64748B;
		margin-top: 0.25rem;
	}

	.file-input {
		font-size: 0.85rem;
		color: #334155;
	}

	.uploaded-badge {
		font-size: 0.75rem;
		font-weight: 700;
		color: #059669;
		margin-top: 0.3rem;
	}

	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: center;
	}

	.checkbox-field-wrap {
		margin-top: 1.25rem;
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

	.justify-center { justify-content: center; }
	.justify-between { justify-content: space-between; align-items: center; }

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

	/* Preview Modal */
	.preview-container {
		max-width: 720px;
	}

	.preview-head-meta {
		display: flex;
		flex-direction: column;
	}

	.preview-type-pill {
		font-size: 0.725rem;
		font-weight: 700;
		color: #0A5C36;
	}

	.preview-stage-content {
		background: #0F172A;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 380px;
		max-height: 520px;
		overflow: hidden;
	}

	.full-preview-img {
		max-width: 100%;
		max-height: 520px;
		object-fit: contain;
	}

	.full-preview-video {
		width: 100%;
		max-height: 520px;
		background: black;
	}

	.preview-source-url {
		font-size: 0.75rem;
		color: #64748B;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 480px;
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

	@keyframes modalFadeIn {
		from { opacity: 0; transform: scale(0.96); }
		to { opacity: 1; transform: scale(1); }
	}

	.upload-loading-badge {
		margin-top: 0.65rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #EFF6FF;
		border: 1px solid #BFDBFE;
		color: #1D4ED8;
		padding: 0.45rem 0.85rem;
		border-radius: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.upload-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid #BFDBFE;
		border-top-color: #1D4ED8;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.upload-success-alert {
		margin-top: 0.65rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		background: #ECFDF5;
		border: 1.5px solid #10B981;
		color: #047857;
		padding: 0.65rem 0.95rem;
		border-radius: 0.55rem;
		font-size: 0.88rem;
		font-weight: 700;
		box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
		animation: alertPopIn 0.3s ease-out;
	}

	@keyframes alertPopIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* --- Responsive Mobile & Tablet Styles (RWD) --- */
	@media (max-width: 768px) {
		.page-header-compact {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.btn-primary-compact {
			width: 100%;
			justify-content: center;
		}

		.toolbar-strip {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.filter-tab-bar {
			width: 100%;
			overflow-x: auto;
			flex-wrap: nowrap;
		}

		.media-grid {
			grid-template-columns: 1fr;
		}

		.modal-container {
			width: 95vw;
			max-width: 540px;
			max-height: 90vh;
			overflow-y: auto;
		}
	}

	@media (max-width: 640px) {
		.main-title-compact {
			font-size: 1.2rem;
		}

		.subtitle-compact {
			font-size: 0.8rem;
		}
	}

	/* File Path Picker & File Browser Styles */
	.path-field-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.path-format-tag {
		font-size: 0.72rem;
		font-weight: 700;
		color: #0A5C36;
		background: #E8F5E9;
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
	}

	.file-path-picker-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.path-input-with-btn {
		flex: 1;
	}

	.btn-browse-file {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #0A5C36;
		color: white;
		border: none;
		border-radius: 0.6rem;
		padding: 0.55rem 0.95rem;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s ease, transform 0.1s ease;
	}

	.btn-browse-file:hover {
		background: #08492b;
		transform: translateY(-1px);
	}

	.detected-videos-bar {
		margin-top: 0.5rem;
		padding: 0.55rem 0.8rem;
		background: #FEF3C7;
		border: 1px solid #FDE68A;
		border-radius: 0.6rem;
	}

	.detected-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: #92400E;
		margin-bottom: 0.35rem;
	}

	.detected-pills-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.detected-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: white;
		border: 1px solid #F59E0B;
		border-radius: 0.45rem;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		color: #78350F;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.detected-pill-btn:hover,
	.detected-pill-btn.active {
		background: #F59E0B;
		color: white;
	}

	.detected-pill-btn .pill-size {
		opacity: 0.8;
		font-size: 0.7rem;
	}

	/* File Browser Modal */
	.browser-overlay {
		z-index: 1000;
	}

	.browser-container {
		max-width: 820px;
		width: 94%;
		background: white;
		border-radius: 1rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
	}

	.browser-head-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.browser-head-title h3 {
		font-size: 1.15rem;
		font-weight: 800;
		color: #0F172A;
		margin: 0;
	}

	.browser-head-title p {
		font-size: 0.78rem;
		color: #64748B;
		margin: 0.15rem 0 0;
	}

	.browser-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.25rem;
		background: #F8FAFC;
		border-bottom: 1px solid #E2E8F0;
		flex-wrap: wrap;
	}

	.browser-shortcuts {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.shortcut-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: white;
		border: 1px solid #CBD5E1;
		border-radius: 0.5rem;
		padding: 0.35rem 0.7rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.shortcut-btn:hover,
	.shortcut-btn.active {
		border-color: #0A5C36;
		background: #F0FDF4;
		color: #0A5C36;
	}

	.btn-import-local {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #0F766E;
		color: white;
		border-radius: 0.5rem;
		padding: 0.4rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-import-local:hover {
		background: #115E59;
	}

	.browser-nav-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1.25rem;
		background: white;
		border-bottom: 1px solid #F1F5F9;
		flex-wrap: wrap;
	}

	.breadcrumb-trail {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.nav-up-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: #F1F5F9;
		border: 1px solid #CBD5E1;
		border-radius: 0.4rem;
		padding: 0.25rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.breadcrumbs-list {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.78rem;
	}

	.crumb-btn {
		background: none;
		border: none;
		padding: 0.15rem 0.35rem;
		border-radius: 0.3rem;
		color: #0F766E;
		font-weight: 600;
		cursor: pointer;
	}

	.crumb-btn.current {
		color: #0F172A;
		font-weight: 800;
		background: #F1F5F9;
	}

	.crumb-sep {
		color: #94A3B8;
		font-size: 0.75rem;
	}

	.browser-search-box {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: #F8FAFC;
		border: 1px solid #CBD5E1;
		border-radius: 0.5rem;
		padding: 0.3rem 0.65rem;
		color: #64748B;
	}

	.browser-search-input {
		border: none;
		background: transparent;
		font-size: 0.78rem;
		color: #0F172A;
		outline: none;
		width: 150px;
	}

	.browser-alert {
		margin: 0.5rem 1.25rem 0;
		padding: 0.6rem 0.85rem;
		border-radius: 0.55rem;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.browser-alert.error {
		background: #FEF2F2;
		border: 1px solid #FECACA;
		color: #B91C1C;
	}

	.browser-alert.success {
		background: #F0FDF4;
		border: 1px solid #BBF7D0;
		color: #15803D;
	}

	.browser-alert.loading {
		background: #EFF6FF;
		border: 1px solid #BFDBFE;
		color: #1D4ED8;
	}

	.browser-content-area {
		padding: 1rem 1.25rem;
		overflow-y: auto;
		min-height: 260px;
		max-height: 380px;
		background: #F8FAFC;
	}

	.browser-loading-state,
	.browser-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: 220px;
		gap: 0.5rem;
		color: #64748B;
	}

	.browser-empty-state strong {
		color: #334155;
		font-size: 0.95rem;
	}

	.browser-empty-state p {
		font-size: 0.8rem;
		max-width: 420px;
		margin: 0;
		line-height: 1.45;
	}

	.browser-items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.browser-item-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		background: white;
		border: 1px solid #E2E8F0;
		border-radius: 0.75rem;
		text-align: left;
		transition: all 0.15s ease;
	}

	.folder-card {
		cursor: pointer;
	}

	.folder-card:hover {
		border-color: #0A5C36;
		background: #F0FDF4;
		transform: translateY(-1px);
	}

	.file-card.selected {
		border-color: #0A5C36;
		background: #F0FDF4;
		box-shadow: 0 0 0 2px rgba(10, 92, 54, 0.15);
	}

	.item-icon-wrap {
		width: 42px;
		height: 42px;
		border-radius: 0.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
	}

	.folder-icon {
		background: #FEF3C7;
		color: #D97706;
	}

	.video-icon {
		background: #EFF6FF;
		color: #2563EB;
	}

	.file-ext-tag {
		font-size: 0.55rem;
		font-weight: 800;
		line-height: 1;
		margin-top: 1px;
	}

	.item-info {
		flex: 1;
		min-width: 0;
	}

	.item-name {
		display: block;
		font-size: 0.82rem;
		font-weight: 700;
		color: #0F172A;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-type {
		display: block;
		font-size: 0.7rem;
		color: #64748B;
		margin-top: 0.15rem;
	}

	.item-meta {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-top: 0.15rem;
	}

	.item-size {
		font-size: 0.7rem;
		font-weight: 600;
		color: #475569;
	}

	.item-mapped {
		font-size: 0.68rem;
		color: #0A5C36;
		font-family: monospace;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.btn-select-file {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.65rem;
		background: #0A5C36;
		color: white;
		border: none;
		border-radius: 0.45rem;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.btn-select-file:hover {
		background: #08492b;
	}

	.browser-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.25rem;
		background: #F8FAFC;
		border-top: 1px solid #E2E8F0;
	}

	.browser-footer-note {
		font-size: 0.76rem;
		color: #64748B;
	}
</style>

