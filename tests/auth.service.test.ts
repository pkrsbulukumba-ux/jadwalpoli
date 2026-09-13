import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock sessionStorage & localStorage
function createMockStorage() {
	const storage = new Map<string, string>();
	return {
		getItem: (k: string) => storage.get(k) ?? null,
		setItem: (k: string, v: string) => {
			storage.set(k, String(v));
		},
		removeItem: (k: string) => {
			storage.delete(k);
		},
		clear: () => {
			storage.clear();
		},
		length: 0,
		key: (_i: number) => null
	};
}

const mockSessionStorage = createMockStorage();
const mockLocalStorage = createMockStorage();

Object.defineProperty(globalThis, 'sessionStorage', {
	value: mockSessionStorage,
	writable: true
});

Object.defineProperty(globalThis, 'localStorage', {
	value: mockLocalStorage,
	writable: true
});

import { AuthService } from '../src/lib/services/auth.service';
import { DataRepository } from '../src/lib/services/data.repository';

describe('AuthService & Kiosk Security Lock', () => {
	beforeEach(() => {
		mockSessionStorage.clear();
		mockLocalStorage.clear();
		DataRepository.init();
		AuthService.logout();
	});

	it('harus terkunci secara default (isAuthorized === false) saat belum input PIN', () => {
		expect(AuthService.isAuthorized()).toBe(false);
	});

	it('harus menolak PIN yang salah dan tidak membuka akses', () => {
		const res = AuthService.verifyMasterPin('9999');
		expect(res.success).toBe(false);
		expect(AuthService.isAuthorized()).toBe(false);
	});

	it('harus berhasil membuka kunci dengan PIN valid (default: 1234)', () => {
		const res = AuthService.verifyMasterPin('1234');
		expect(res.success).toBe(true);
		expect(AuthService.isAuthorized()).toBe(true);
	});

	it('harus langsung menghapus otorisasi saat logout / kunci kiosk dipanggil', () => {
		AuthService.verifyMasterPin('1234');
		expect(AuthService.isAuthorized()).toBe(true);

		// Panggil logout / kunci kiosk
		AuthService.logout();
		expect(AuthService.isAuthorized()).toBe(false);
	});

	it('harus mengaktifkan cooldown setelah 5x salah memasukkan PIN', () => {
		for (let i = 0; i < 4; i++) {
			const res = AuthService.verifyMasterPin('0000');
			expect(res.success).toBe(false);
			expect(res.cooldownRemainingSeconds).toBeUndefined();
		}

		// Percobaan ke-5
		const fifthRes = AuthService.verifyMasterPin('0000');
		expect(fifthRes.success).toBe(false);
		expect(fifthRes.cooldownRemainingSeconds).toBe(30);

		// Percobaan berikutnya dalam cooldown harus langsung ditolak
		const duringCooldown = AuthService.verifyMasterPin('1234');
		expect(duringCooldown.success).toBe(false);
		expect(duringCooldown.message).toContain('Tunggu');
	});
});
