import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const folder = (formData.get('folder') as string) || 'general';

		if (!file || !(file instanceof File)) {
			return json({ success: false, message: 'Berkas tidak ditemukan atau tidak valid.' }, { status: 400 });
		}

		// Filter folder tujuan yang diizinkan
		const validFolders = ['announcements', 'doctors', 'logos', 'general'];
		const safeFolder = validFolders.includes(folder) ? folder : 'general';

		const uploadDir = path.resolve('storage', 'uploads', safeFolder);
		await fs.mkdir(uploadDir, { recursive: true });

		// Format nama berkas aman dan unik
		const originalName = file.name || 'upload.bin';
		const ext = path.extname(originalName).toLowerCase() || '.bin';
		const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
		const uniqueFileName = `${Date.now()}_${baseName}${ext}`;
		const filePath = path.join(uploadDir, uniqueFileName);

		const arrayBuffer = await file.arrayBuffer();
		const buffer = new Uint8Array(arrayBuffer);
		await fs.writeFile(filePath, buffer);

		const publicUrl = `/uploads/${safeFolder}/${uniqueFileName}`;

		return json({
			success: true,
			url: publicUrl,
			filename: uniqueFileName,
			originalName,
			size: file.size,
			message: 'Berkas berhasil diunggah dan disimpan ke disk.'
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal mengunggah berkas: ${msg}` }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		let fileUrlOrPath = url.searchParams.get('url') || url.searchParams.get('path') || '';

		if (!fileUrlOrPath) {
			try {
				const body = await request.json();
				fileUrlOrPath = body.url || body.path || '';
			} catch {
				// Body mungkin kosong
			}
		}

		if (!fileUrlOrPath) {
			return json({ success: false, message: 'URL atau jalur berkas wajib disertakan.' }, { status: 400 });
		}

		// Hapus domain jika URL lengkap (misal http://localhost:5173/uploads/...)
		let clean = fileUrlOrPath;
		if (clean.includes('/uploads/')) {
			clean = clean.substring(clean.indexOf('/uploads/') + 9);
		} else if (clean.includes('uploads/')) {
			clean = clean.substring(clean.indexOf('uploads/') + 8);
		} else if (clean.startsWith('/')) {
			clean = clean.substring(1);
		}

		const baseUploadDir = path.resolve('storage', 'uploads');
		const fallbackUploadDir = path.resolve('static', 'uploads');
		let targetPath = path.resolve(baseUploadDir, clean);

		// Proteksi keamanan: pastikan target tetap di dalam direktori storage/uploads
		if (!targetPath.startsWith(baseUploadDir)) {
			return json(
				{ success: false, message: 'Akses ditolak: Jalur berkas berada di luar direktori uploads.' },
				{ status: 403 }
			);
		}

		try {
			await fs.access(targetPath);
			await fs.unlink(targetPath);
			return json({
				success: true,
				deletedPath: clean,
				message: 'Berkas fisik berhasil dihapus dari penyimpanan server.'
			});
		} catch (err: unknown) {
			const nodeErr = err as NodeJS.ErrnoException;
			if (nodeErr.code === 'ENOENT') {
				// Cek fallback di static/uploads jika ada
				const fallbackPath = path.resolve(fallbackUploadDir, clean);
				if (fallbackPath.startsWith(fallbackUploadDir)) {
					try {
						await fs.access(fallbackPath);
						await fs.unlink(fallbackPath);
						return json({
							success: true,
							deletedPath: clean,
							message: 'Berkas fisik berhasil dihapus dari penyimpanan static server.'
						});
					} catch {
						// Abaikan jika tidak ada di fallback
					}
				}

				return json({
					success: true,
					deletedPath: clean,
					message: 'Berkas fisik sudah tidak ada pada disk server.'
				});
			}
			throw err;
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal menghapus berkas fisik: ${msg}` }, { status: 500 });
	}
};

