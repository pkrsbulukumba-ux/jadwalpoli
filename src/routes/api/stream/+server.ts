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
	'.webp': 'image/webp'
};

function resolveMediaFilePath(filePath: string): string | null {
	if (!filePath) return null;

	let clean = filePath.trim();

	// Hapus prefix file:// jika ada
	if (clean.startsWith('file:///')) {
		clean = decodeURIComponent(clean.replace(/^file:\/\/\//, ''));
	} else if (clean.startsWith('file://')) {
		clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
	}

	// Cek kemungkinan path relatif atau dalam static
	const candidates: string[] = [];

	// 1. Jika mengandung /uploads/... atau uploads/...
	if (clean.includes('uploads/')) {
		const relativeUpload = clean.substring(clean.indexOf('uploads/'));
		candidates.push(path.resolve('storage', relativeUpload));
		candidates.push(path.resolve('static', relativeUpload));
	}

	// 2. Jika mengandung /static/ atau static/
	if (clean.startsWith('/static/')) {
		candidates.push(path.resolve(clean.substring(1)));
		candidates.push(path.resolve('static', clean.substring(8)));
	} else if (clean.startsWith('static/')) {
		candidates.push(path.resolve(clean));
	}

	// 3. Cek di dalam direktori static/
	const normalizedClean = clean.startsWith('/') ? clean.substring(1) : clean;
	candidates.push(path.resolve('static', normalizedClean));

	// 4. Sebagai path langsung (absolut sistem atau relatif terhadap root project)
	candidates.push(path.resolve(clean));

	for (const candidate of candidates) {
		try {
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				return candidate;
			}
		} catch {
			// Lanjutkan ke kandidat berikutnya jika akses gagal
		}
	}

	return null;
}

export const GET: RequestHandler = async ({ url, request }) => {
	const rawFile = url.searchParams.get('file') || url.searchParams.get('path');

	if (!rawFile) {
		return new Response(JSON.stringify({ error: 'Parameter file atau path diperlukan.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const decodedFile = decodeURIComponent(rawFile);
	const filePath = resolveMediaFilePath(decodedFile);

	if (!filePath) {
		return new Response(JSON.stringify({ error: 'Berkas media lokal tidak ditemukan pada perangkat.', requested: decodedFile }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const stat = fs.statSync(filePath);
		const fileSize = stat.size;
		const ext = path.extname(filePath).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'video/mp4';

		const range = request.headers.get('range');

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
			const fileStream = fs.createReadStream(filePath, { start, end });
			const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

			return new Response(webStream, {
				status: 206,
				headers: {
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Content-Length': String(chunkSize),
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});
		} else {
			const fileStream = fs.createReadStream(filePath);
			const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

			return new Response(webStream, {
				status: 200,
				headers: {
					'Content-Length': String(fileSize),
					'Content-Type': contentType,
					'Accept-Ranges': 'bytes',
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return new Response(JSON.stringify({ error: `Gagal membaca berkas: ${msg}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
