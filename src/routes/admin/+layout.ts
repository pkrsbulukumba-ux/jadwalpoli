import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { AuthService } from '$lib/services/auth.service';
import type { LayoutLoad } from './$types';

// Nonaktifkan SSR untuk seluruh rute admin agar server tidak pernah merender konten CMS ke pengguna tanpa otentikasi
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = ({ url }) => {
	// Halaman login diperbolehkan untuk diakses secara publik guna memasukkan PIN
	if (url.pathname === '/admin/login') {
		return {};
	}

	// Untuk seluruh rute CMS (/admin, /admin/poli, /admin/doctors-jadwal, dll.)
	// Wajib memiliki sesi aktif terautentikasi (PIN / kredensial)
	if (browser) {
		if (!AuthService.isAuthorized()) {
			throw redirect(307, '/admin/login');
		}
	} else {
		// Perlindungan server-side jika terpanggil
		throw redirect(307, '/admin/login');
	}

	return {};
};
