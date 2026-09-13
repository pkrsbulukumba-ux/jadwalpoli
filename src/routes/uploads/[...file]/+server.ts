import { type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const MIME_TYPES: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogg': 'video/ogg',
	'.ogv': 'video/ogg',
	'.mov': 'video/quicktime',
	'.mkv': 'video/x-matroska',
	'.avi': 'video/x-msvideo',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon'
};

const BASE_STORAGE_DIR = path.resolve('storage', 'uploads');
const FALLBACK_STATIC_DIR = path.resolve('static', 'uploads');

export const GET: RequestHandler = async ({ params, request }) => {
	const rawPath = params.file;
	if (!rawPath) {
		return new Response('Berkas tidak ditemukan', { status: 404 });
	}

	// Normalisasi dan sanitasi jalur berkas untuk mencegah Directory Traversal
	const decoded = decodeURIComponent(rawPath).replace(/\\/g, '/');
	const safeRelative = path.normalize(decoded).replace(/^(\.\.[\/\\])+/, '');

	// Cari berkas di direktori storage/uploads utama
	let targetPath = path.resolve(BASE_STORAGE_DIR, safeRelative);

	// Proteksi keamanan: pastikan berkas berada di dalam BASE_STORAGE_DIR
	if (!targetPath.startsWith(BASE_STORAGE_DIR) || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
		// Fallback ke static/uploads jika belum dipindahkan sepenuhnya
		const fallbackPath = path.resolve(FALLBACK_STATIC_DIR, safeRelative);
		if (fallbackPath.startsWith(FALLBACK_STATIC_DIR) && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
			targetPath = fallbackPath;
		} else {
			return new Response('Berkas media tidak ditemukan.', { status: 404 });
		}
	}

	try {
		const stat = fs.statSync(targetPath);
		const fileSize = stat.size;
		const ext = path.extname(targetPath).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		const range = request.headers.get('range');

		// Dukungan HTTP Range (Status 206) untuk Video Streaming / Media Seeking
		if (range) {
			const parts = range.replace(/bytes=/, '').split('-');
			const start = parseInt(parts[0], 10) || 0;
			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

			if (start >= fileSize || end >= fileSize || start > end) {
				return new Response(null, {
					status: 416,
					headers: {
						'Content-Range': `bytes */${fileSize}`,
						'Accept-Ranges': 'bytes'
					}
				});
			}

			const chunkSize = end - start + 1;
			const fileStream = fs.createReadStream(targetPath, { start, end });
			const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

			return new Response(webStream, {
				status: 206,
				headers: {
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Content-Length': String(chunkSize),
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=86400',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Respons standar HTTP 200 untuk gambar atau unduhan utuh
		const fileStream = fs.createReadStream(targetPath);
		const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

		return new Response(webStream, {
			status: 200,
			headers: {
				'Content-Length': String(fileSize),
				'Content-Type': contentType,
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=86400',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return new Response(`Gagal membaca berkas: ${msg}`, { status: 500 });
	}
};
