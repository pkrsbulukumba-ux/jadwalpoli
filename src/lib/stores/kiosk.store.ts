import { writable } from 'svelte/store';
import type { KioskSettings } from '$lib/types';
import { KioskService } from '$lib/services/kiosk.service';

/**
 * Global Kiosk State Stores
 */
export const kioskSettings = writable<KioskSettings>(KioskService.getDefaultSettings());
export const isKioskLocked = writable<boolean>(true);
export const activeSlideIndex = writable<number>(0);
