import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/public';

export const supabaseUrl = PUBLIC_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Memeriksa apakah kredensial Supabase telah dikonfigurasi dengan URL & Anon Key aktif
 */
export function isSupabaseConfigured(): boolean {
	if (!supabaseUrl || !supabaseAnonKey) return false;
	if (supabaseUrl.includes('placeholder') || supabaseUrl.includes('dummy')) return false;
	if (supabaseAnonKey.includes('placeholder') || supabaseAnonKey.includes('dummy')) return false;
	return supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 20;
}

/**
 * Supabase client instance untuk browser dan client-side requests.
 * Hanya menggunakan public anon key sesuai aturan keamanan PRD (PRD Section 13 & 29).
 */
export const supabase = createClient(
	supabaseUrl || 'https://placeholder.supabase.co',
	supabaseAnonKey || 'placeholder-key',
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true
		}
	}
);

/**
 * Membangun URL publik dari Supabase Storage bucket + path
 * Contoh: bucket "announcements", path "uploads/abc.jpg"
 * -> https://<project>.supabase.co/storage/v1/object/public/announcements/uploads/abc.jpg
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
	const cleanBucket = bucket.replace(/^\/+|\/+$/g, '');
	const cleanPath = path.replace(/^\/+/, '');
	const base = supabaseUrl || '';
	return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
}

/**
 * Mengunggah berkas ke Supabase Storage bucket.
 * Mengembalikan URL publik bila berhasil, atau error message bila gagal.
 */
export async function uploadToSupabaseStorage(
	bucket: string,
	file: File,
	path?: string
): Promise<{ success: boolean; url?: string; message?: string }> {
	if (!isSupabaseConfigured()) {
		return { success: false, message: 'Supabase belum dikonfigurasi. Gunakan Mode Lokal.' };
	}
	if (!(file instanceof File)) {
		return { success: false, message: 'Berkas tidak valid.' };
	}

	const cleanBucket = bucket.replace(/^\/+|\/+$/g, '');
	const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
	const filePath = path
		? `${path.replace(/^\/+|\/+$/g, '')}/${Date.now()}_${safeName}`
		: `${Date.now()}_${safeName}`;

	try {
		const { error } = await supabase.storage.from(cleanBucket).upload(filePath, file, {
			cacheControl: '3600',
			upsert: false
		});

		if (error) {
			return { success: false, message: `Gagal unggah ke Storage: ${error.message}` };
		}

		return { success: true, url: getStoragePublicUrl(cleanBucket, filePath) };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Gagal unggah: ${msg}` };
	}
}

/**
 * Menghapus berkas dari Supabase Storage bucket berdasarkan path.
 */
export async function deleteFromSupabaseStorage(
	bucket: string,
	path: string
): Promise<{ success: boolean; message?: string }> {
	if (!isSupabaseConfigured()) return { success: false, message: 'Supabase belum dikonfigurasi.' };
	const cleanBucket = bucket.replace(/^\/+|\/+$/g, '');
	const cleanPath = path.replace(/^\/+/, '');
	if (!cleanPath) return { success: false, message: 'Path berkas tidak valid.' };

	try {
		const { error } = await supabase.storage.from(cleanBucket).remove([cleanPath]);
		if (error) return { success: false, message: `Gagal hapus dari Storage: ${error.message}` };
		return { success: true };
	} catch (err: unknown) {
		return { success: false, message: `Gagal hapus: ${err instanceof Error ? err.message : String(err)}` };
	}
}

/**
 * Menguji konektivitas langsung ke endpoint Supabase
 */
export async function testSupabaseConnection(): Promise<{
	success: boolean;
	message: string;
	latencyMs?: number;
}> {
	if (!isSupabaseConfigured()) {
		return {
			success: false,
			message: 'Kredensial Supabase belum disetel di berkas .env (Mode Siaga Lokal aktif).'
		};
	}

	const startTime = performance.now();
	try {
		// Ping tabel public kiosk_settings atau check health
		const { data, error } = await supabase
			.from('kiosk_settings')
			.select('id, hospital_name')
			.limit(1);

		const latencyMs = Math.round(performance.now() - startTime);

		if (error) {
			// Periksa apakah tabel belum dibuat atau kredensial salah
			if (error.code === '42P01') {
				return {
					success: false,
					message: `Terhubung ke Supabase, namun tabel 'kiosk_settings' belum ada. Jalankan skrip migrasi SQL terlebih dahulu.`,
					latencyMs
				};
			}
			return {
				success: false,
				message: `Gagal query Supabase: ${error.message}`,
				latencyMs
			};
		}

		return {
			success: true,
			message: `Koneksi Supabase aktif & stabil (${latencyMs}ms). Database siap digunakan.`,
			latencyMs
		};
	} catch (err: unknown) {
		const latencyMs = Math.round(performance.now() - startTime);
		const errMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: `Tidak dapat terhubung ke server Supabase: ${errMessage}`,
			latencyMs
		};
	}
}
