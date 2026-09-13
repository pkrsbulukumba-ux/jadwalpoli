import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { DataRepository } from './data.repository';
import { supabase, isSupabaseConfigured } from '$lib/supabase/client';

export interface AuthSession {
	isAuthorized: boolean;
	role: 'admin' | 'operator';
	fullName: string;
	loginMethod: 'pin' | 'credentials';
	lastActivity: number;
}

const SESSION_STORAGE_KEY = 'rsud_kiosk_auth_session';

/**
 * AuthService: Pengelolaan Autentikasi Admin, Sesi Kiosk Lock & Rate Limiting
 * Sesuai spesifikasi PRD Section 8 & 25
 */
export class AuthService {
	private static failedAttempts = 0;
	private static cooldownUntil = 0;
	private static readonly MAX_ATTEMPTS = 5;
	private static readonly COOLDOWN_SECONDS = 30;
	private static readonly IDLE_TIMEOUT_MINUTES = 5; // 5 menit tanpa aktivitas -> auto-lock

	public static sessionStore = writable<AuthSession | null>(this.getInitialSession());

	private static getInitialSession(): AuthSession | null {
		if (browser && typeof sessionStorage !== 'undefined') {
			try {
				const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
				if (saved) {
					const parsed: AuthSession = JSON.parse(saved);
					// Cek apakah sesi sudah kadaluarsa (idle timeout)
					const now = Date.now();
					if (now - parsed.lastActivity > this.IDLE_TIMEOUT_MINUTES * 60 * 1000) {
						sessionStorage.removeItem(SESSION_STORAGE_KEY);
						return null;
					}
					return parsed;
				}
			} catch (e) {
				console.warn('Gagal membaca sesi auth:', e);
			}
		}
		return null;
	}

	/**
	 * Verifikasi Master PIN dengan proteksi rate limiter / backoff
	 */
	public static verifyMasterPin(inputPin: string): {
		success: boolean;
		message: string;
		cooldownRemainingSeconds?: number;
	} {
		const now = Date.now();

		// Cek apakah sedang dalam masa cooldown
		if (now < this.cooldownUntil) {
			const remaining = Math.ceil((this.cooldownUntil - now) / 1000);
			return {
				success: false,
				message: `Terlalu banyak percobaan salah. Tunggu ${remaining} detik lagi.`,
				cooldownRemainingSeconds: remaining
			};
		}

		const isValid = DataRepository.verifyPin(inputPin);

		if (isValid) {
			this.failedAttempts = 0;
			this.cooldownUntil = 0;
			this.createSession('operator', 'Petugas Operasional', 'pin');
			return {
				success: true,
				message: 'PIN valid, membuka akses CMS...'
			};
		}

		// PIN Salah: Tambah percobaan gagal
		this.failedAttempts++;

		if (this.failedAttempts >= this.MAX_ATTEMPTS) {
			this.cooldownUntil = now + this.COOLDOWN_SECONDS * 1000;
			this.failedAttempts = 0; // Reset untuk siklus berikutnya
			return {
				success: false,
				message: `PIN salah 5x. Akses dikunci sementara selama ${this.COOLDOWN_SECONDS} detik.`,
				cooldownRemainingSeconds: this.COOLDOWN_SECONDS
			};
		}

		const sisa = this.MAX_ATTEMPTS - this.failedAttempts;
		return {
			success: false,
			message: `PIN salah! Sisa percobaan: ${sisa} kali.`
		};
	}

	/**
	 * Login dengan kredensial Admin (Email & Password)
	 * Mendukung Supabase Auth online dan fallback akun lokal
	 */
	public static async loginWithCredentials(
		email: string,
		password: string
	): Promise<{ success: boolean; message: string }> {
		if (!email || !password) {
			return { success: false, message: 'Email dan kata sandi wajib diisi.' };
		}

		// Jika Supabase Online telah terkonfigurasi, coba otentikasi via Supabase Auth
		if (isSupabaseConfigured()) {
			try {
				const { data, error } = await supabase.auth.signInWithPassword({
					email,
					password
				});

				if (!error && data?.user) {
					const role = (data.user.user_metadata?.role as 'admin' | 'operator') || 'admin';
					const fullName = data.user.user_metadata?.full_name || email.split('@')[0];
					this.createSession(role, fullName, 'credentials');
					DataRepository.logActivity('Login Admin Cloud', 'auth', `Login via Supabase Auth: ${email}`);
					return { success: true, message: 'Login Supabase Cloud berhasil.' };
				}
			} catch (err) {
				console.warn('Supabase Auth gagal, memeriksa kredensial lokal:', err);
			}
		}

		// Mode local-first: admin default lokal
		if (
			(email === 'admin@rsud.go.id' && password === 'admin123') ||
			(email === 'operator@rsud.go.id' && password === 'operator123')
		) {
			const role = email.includes('admin') ? 'admin' : 'operator';
			const name = role === 'admin' ? 'Administrator Utama' : 'Petugas Jadwal';
			this.createSession(role, name, 'credentials');
			DataRepository.logActivity('Login Petugas Lokal', 'auth', `Login via akun lokal: ${email}`);
			return { success: true, message: 'Login berhasil.' };
		}

		return {
			success: false,
			message: 'Email atau kata sandi tidak cocok. Gunakan admin@rsud.go.id / admin123'
		};
	}

	/**
	 * Memeriksa apakah pengguna saat ini berhak mengakses rute CMS
	 */
	public static isAuthorized(): boolean {
		const session = this.getInitialSession();
		return session !== null && session.isAuthorized;
	}

	/**
	 * Memperbarui timestamp aktivitas untuk mereset timer idle
	 */
	public static recordUserActivity() {
		if (!browser) return;
		const session = this.getInitialSession();
		if (session) {
			session.lastActivity = Date.now();
			sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
		}
	}

	/**
	 * Mengakhiri sesi (Logout / Kunci Kiosk)
	 */
	public static logout() {
		if (browser) {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
		}
		this.sessionStore.set(null);
	}

	private static createSession(
		role: 'admin' | 'operator',
		fullName: string,
		loginMethod: 'pin' | 'credentials'
	) {
		const session: AuthSession = {
			isAuthorized: true,
			role,
			fullName,
			loginMethod,
			lastActivity: Date.now()
		};

		if (browser) {
			sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
		}
		this.sessionStore.set(session);
	}
}
