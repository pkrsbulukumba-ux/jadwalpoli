import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';

const DB_FILE_PATH = path.resolve('data', 'local-db.json');

export const GET: RequestHandler = async () => {
	try {
		await fs.mkdir(path.dirname(DB_FILE_PATH), { recursive: true });
		try {
			const content = await fs.readFile(DB_FILE_PATH, 'utf-8');
			const parsed = JSON.parse(content);
			return json({ success: true, data: parsed });
		} catch (err: unknown) {
			const code = (err as { code?: string }).code;
			if (code === 'ENOENT') {
				// Berkas belum ada, beritahukan client
				return json({ success: true, data: null });
			}
			throw err;
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal membaca database lokal: ${msg}` }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object') {
			return json({ success: false, message: 'Payload data tidak valid' }, { status: 400 });
		}

		await fs.mkdir(path.dirname(DB_FILE_PATH), { recursive: true });
		await fs.writeFile(DB_FILE_PATH, JSON.stringify(body, null, 2), 'utf-8');

		return json({ success: true, message: 'Data berhasil disimpan ke berkas fisik lokal (disk).' });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Gagal menyimpan database lokal: ${msg}` }, { status: 500 });
	}
};
