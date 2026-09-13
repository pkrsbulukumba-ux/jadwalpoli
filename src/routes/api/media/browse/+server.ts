import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi', '.ogv', '.m4v', '.ts']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif']);

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function computeMappedPath(fullFilePath: string): string {
	const staticVideosDir = path.resolve('static', 'videos');
	const storageUploadsDir = path.resolve('storage', 'uploads');
	const staticUploadsDir = path.resolve('static', 'uploads');
	const staticDir = path.resolve('static');

	const normalizedFile = path.normalize(fullFilePath);

	// 1. Jika berada di static/videos/
	if (normalizedFile.startsWith(staticVideosDir)) {
		const rel = path.relative(staticVideosDir, normalizedFile).replace(/\\/g, '/');
		return `/videos/${rel}`;
	}

	// 2. Jika berada di storage/uploads/ atau static/uploads/
	if (normalizedFile.startsWith(storageUploadsDir)) {
		const rel = path.relative(storageUploadsDir, normalizedFile).replace(/\\/g, '/');
		return `/uploads/${rel}`;
	}
	if (normalizedFile.startsWith(staticUploadsDir)) {
		const rel = path.relative(staticUploadsDir, normalizedFile).replace(/\\/g, '/');
		return `/uploads/${rel}`;
	}

	// 3. Jika berada di static/
	if (normalizedFile.startsWith(staticDir)) {
		const rel = path.relative(staticDir, normalizedFile).replace(/\\/g, '/');
		return `/${rel}`;
	}

	// 4. Jika di luar static, gunakan path absolut sistem langsung
	return normalizedFile;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const rawDir = url.searchParams.get('path') || '';
		const filterType = url.searchParams.get('type') || 'video';

		const staticVideosDir = path.resolve('static', 'videos');
		const storageUploadsDir = path.resolve('storage', 'uploads');
		const staticUploadsDir = path.resolve('static', 'uploads');
		const projectDir = path.resolve('.');

		// Pastikan direktori static/videos dan storage/uploads selalu ada
		if (!fs.existsSync(staticVideosDir)) {
			await fsp.mkdir(staticVideosDir, { recursive: true });
		}
		if (!fs.existsSync(storageUploadsDir)) {
			await fsp.mkdir(storageUploadsDir, { recursive: true });
		}

		// Tentukan direktori sasaran
		let targetDir = staticVideosDir;
		if (rawDir === 'videos' || rawDir === '') {
			targetDir = staticVideosDir;
		} else if (rawDir === 'uploads') {
			targetDir = fs.existsSync(storageUploadsDir) ? storageUploadsDir : staticUploadsDir;
		} else if (rawDir === 'project') {
			targetDir = projectDir;
		} else if (rawDir) {
			const resolved = path.resolve(rawDir);
			if (fs.existsSync(resolved)) {
				targetDir = resolved;
			}
		}

		const stat = await fsp.stat(targetDir);
		if (!stat.isDirectory()) {
			targetDir = path.dirname(targetDir);
		}

		// Ambil parent directory (jika ada dan dapat diakses)
		const parsedPath = path.parse(targetDir);
		const isRoot = parsedPath.root === targetDir;
		const parentDir = isRoot ? null : path.dirname(targetDir);

		// Baca isi direktori
		const dirEntries = await fsp.readdir(targetDir, { withFileTypes: true });

		const folders: Array<{
			name: string;
			path: string;
			isDirectory: boolean;
		}> = [];

		const files: Array<{
			name: string;
			path: string;
			mappedPath: string;
			size: number;
			formattedSize: string;
			ext: string;
			modifiedAt: string;
			isDirectory: boolean;
		}> = [];

		for (const entry of dirEntries) {
			// Lewati folder tersembunyi / sistem tertentu
			if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$Recycle.Bin' || entry.name === 'System Volume Information') {
				continue;
			}

			const fullEntryPath = path.join(targetDir, entry.name);

			try {
				if (entry.isDirectory()) {
					folders.push({
						name: entry.name,
						path: fullEntryPath,
						isDirectory: true
					});
				} else if (entry.isFile()) {
					const ext = path.extname(entry.name).toLowerCase();
					const isVideo = VIDEO_EXTENSIONS.has(ext);
					const isImage = IMAGE_EXTENSIONS.has(ext);

					if ((filterType === 'video' && isVideo) || (filterType === 'image' && isImage) || filterType === 'all' || isVideo) {
						const fileStat = await fsp.stat(fullEntryPath);
						files.push({
							name: entry.name,
							path: fullEntryPath,
							mappedPath: computeMappedPath(fullEntryPath),
							size: fileStat.size,
							formattedSize: formatFileSize(fileStat.size),
							ext,
							modifiedAt: fileStat.mtime.toISOString(),
							isDirectory: false
						});
					}
				}
			} catch {
				// Abaikan jika berkas tidak memiliki izin akses
			}
		}

		// Urutkan alfabetis
		folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

		// Bangun Breadcrumbs navigasi
		const breadcrumbs: Array<{ name: string; path: string }> = [];
		let currentWalk = targetDir;
		while (currentWalk) {
			const base = path.basename(currentWalk) || currentWalk;
			breadcrumbs.unshift({ name: base, path: currentWalk });
			const parent = path.dirname(currentWalk);
			if (parent === currentWalk) break;
			currentWalk = parent;
		}

		// Pintasan cepat (Shortcuts)
		const shortcuts = [
			{ label: 'static/videos (Folder Rekomendasi)', key: 'videos', path: staticVideosDir },
			{ label: 'storage/uploads', key: 'uploads', path: storageUploadsDir },
			{ label: 'Drive C:\\', key: 'drive-c', path: 'C:\\' }
		];

		return json({
			success: true,
			currentPath: targetDir,
			parentPath: parentDir,
			breadcrumbs,
			folders,
			files,
			shortcuts
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal membaca direktori: ${msg}` }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		let targetDir = (formData.get('targetDir') as string) || '';

		if (!file || !(file instanceof File)) {
			return json({ success: false, message: 'Berkas video tidak ditemukan.' }, { status: 400 });
		}

		const staticVideosDir = path.resolve('static', 'videos');
		if (!targetDir || targetDir === 'videos') {
			targetDir = staticVideosDir;
		} else {
			targetDir = path.resolve(targetDir);
		}

		await fsp.mkdir(targetDir, { recursive: true });

		// Sanitasi nama berkas agar aman namun tetap deskriptif
		const originalName = file.name || 'video.mp4';
		const ext = path.extname(originalName).toLowerCase() || '.mp4';
		const rawBase = path.basename(originalName, ext);
		const safeBase = rawBase.replace(/[^a-zA-Z0-9-_\s.]/g, '').trim() || 'video';
		const safeFileName = `${safeBase}${ext}`;
		const destinationPath = path.join(targetDir, safeFileName);

		const arrayBuffer = await file.arrayBuffer();
		const buffer = new Uint8Array(arrayBuffer);
		await fsp.writeFile(destinationPath, buffer);

		const mappedPath = computeMappedPath(destinationPath);

		return json({
			success: true,
			filename: safeFileName,
			fullPath: destinationPath,
			mappedPath,
			size: file.size,
			formattedSize: formatFileSize(file.size),
			message: `Berkas "${safeFileName}" berhasil disimpan ke folder lokal!`
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal menyimpan berkas ke folder lokal: ${msg}` }, { status: 500 });
	}
};
