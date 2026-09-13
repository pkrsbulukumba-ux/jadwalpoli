import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('C:/Users/Administrator/Desktop/Kiosk jdwl');
const db = JSON.parse(readFileSync(join(root, 'data/local-db.json'), 'utf8'));

function esc(s) {
	return String(s ?? '').replace(/'/g, "''");
}
function bool(b) {
	return b ? 'true' : 'false';
}

const lines = [];
lines.push('-- ============================================================');
lines.push('-- MIGRASI DATA LOKAL -> SUPABASE (GENERATED FROM local-db.json)');
lines.push('-- Dihasilkan: ' + new Date().toISOString());
lines.push('-- JANGAN DIJALANKAN SEBELUM migration schema sukses');
lines.push('-- ============================================================');
lines.push('');

// 1. POLYCLINICS
lines.push('-- 1. POLIKLINIK (' + db.polyclinics.length + ')');
for (const p of db.polyclinics) {
	lines.push(
		`INSERT INTO public.polyclinics (id, name, code, icon, description, is_active, display_order) VALUES ('${esc(p.id)}', '${esc(p.name)}', '${esc(p.code)}', '${esc(p.icon || 'stethoscope')}', '${esc(p.description || '')}', ${bool(p.is_active)}, ${p.display_order ?? 0}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, icon = EXCLUDED.icon, description = EXCLUDED.description, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`
	);
}
lines.push('');

// 2. DOCTORS
lines.push('-- 2. DOKTER (' + db.doctors.length + ')');
for (const d of db.doctors) {
	lines.push(
		`INSERT INTO public.doctors (id, full_name, title, photo_url, polyclinic_id, is_active, display_order) VALUES ('${esc(d.id)}', '${esc(d.full_name)}', '${esc(d.title || '')}', '${esc(d.photo_url || '')}', ${d.polyclinic_id ? `'${esc(d.polyclinic_id)}'` : 'NULL'}, ${bool(d.is_active)}, ${d.display_order ?? 0}) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, title = EXCLUDED.title, photo_url = EXCLUDED.photo_url, polyclinic_id = EXCLUDED.polyclinic_id, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`
	);
}
lines.push('');

// 3. DOCTOR_POLYCLINICS (derive from doctor.polyclinic_id)
lines.push('-- 3. RELASI DOKTER-POLI (doctor_polyclinics)');
for (const d of db.doctors) {
	if (!d.polyclinic_id) continue;
	lines.push(
		`INSERT INTO public.doctor_polyclinics (doctor_id, polyclinic_id, is_primary) VALUES ('${esc(d.id)}', '${esc(d.polyclinic_id)}', true) ON CONFLICT (doctor_id, polyclinic_id) DO NOTHING;`
	);
}
lines.push('');

// 4. WEEKLY SCHEDULES
lines.push('-- 4. JADWAL MINGGUAN (' + db.weeklySchedules.length + ')');
for (const s of db.weeklySchedules) {
	lines.push(
		`INSERT INTO public.weekly_schedules (id, doctor_id, polyclinic_id, day_of_week, start_time, end_time, is_active, note) VALUES ('${esc(s.id)}', '${esc(s.doctor_id)}', '${esc(s.polyclinic_id)}', ${s.day_of_week}, '${esc(s.start_time)}', '${esc(s.end_time)}', ${bool(s.is_active)}, '${esc(s.note || '')}') ON CONFLICT (id) DO UPDATE SET doctor_id = EXCLUDED.doctor_id, polyclinic_id = EXCLUDED.polyclinic_id, day_of_week = EXCLUDED.day_of_week, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, is_active = EXCLUDED.is_active, note = EXCLUDED.note;`
	);
}
lines.push('');

// 5. OVERRIDES
if (Array.isArray(db.overrides) && db.overrides.length > 0) {
	lines.push('-- 5. OVERRIDE JADWAL (' + db.overrides.length + ')');
	for (const o of db.overrides) {
		lines.push(
			`INSERT INTO public.schedule_overrides (id, doctor_id, polyclinic_id, schedule_date, status_code, custom_message) VALUES ('${esc(o.id)}', '${esc(o.doctor_id)}', '${esc(o.polyclinic_id)}', '${esc(o.schedule_date)}', '${esc(o.status_code)}', '${esc(o.custom_message || '')}') ON CONFLICT (id) DO UPDATE SET doctor_id = EXCLUDED.doctor_id, polyclinic_id = EXCLUDED.polyclinic_id, schedule_date = EXCLUDED.schedule_date, status_code = EXCLUDED.status_code, custom_message = EXCLUDED.custom_message;`
		);
	}
	lines.push('');
}

// 6. MEDIA
lines.push('-- 6. MEDIA PENGUMUMAN (' + db.mediaList.length + ')');
for (const m of db.mediaList) {
	lines.push(
		`INSERT INTO public.media_announcements (id, title, media_type, file_path, public_url, sort_order, is_active) VALUES ('${esc(m.id)}', '${esc(m.title)}', '${esc(m.media_type)}', '${esc(m.file_path || '')}', '${esc(m.public_url || '')}', ${m.sort_order ?? 0}, ${bool(m.is_active)}) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, media_type = EXCLUDED.media_type, file_path = EXCLUDED.file_path, public_url = EXCLUDED.public_url, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;`
	);
}
lines.push('');

// 7. SETTINGS
lines.push('-- 7. PENGATURAN KIOSK');
const st = db.settings || {};
const stFields = [
	'hospital_name', 'hospital_subtitle', 'hospital_logo_url', 'timezone', 'date_format', 'time_format',
	'slide_duration_seconds', 'image_duration_seconds', 'video_wait_for_end', 'video_sound_enabled',
	'refresh_interval_seconds', 'font_scale', 'card_scale', 'header_scale', 'footer_scale',
	'show_page_indicator', 'show_running_text', 'show_footer_notices', 'show_emergency_banner',
	'emergency_title', 'emergency_message', 'emergency_level', 'running_text', 'running_text_speed',
	'running_text_direction', 'screen_mode'
];
const colMap = { slide_duration_seconds: 'slide_duration_seconds' };
lines.push(
	`INSERT INTO public.kiosk_settings (id, ${stFields.map(f => f).join(', ')}) VALUES (1, ${stFields.map(f => {
		const v = st[f];
		if (typeof v === 'number') return Number(v).toFixed(2);
		if (typeof v === 'boolean') return v ? 'true' : 'false';
		return `'${esc(v ?? '')}'`;
	}).join(', ')}) ON CONFLICT (id) DO UPDATE SET ${stFields.map(f => `${f} = EXCLUDED.${f}`).join(', ')}, updated_at = timezone('utc'::text, now());`
);
lines.push('');

// 8. FOOTER NOTICES
if (Array.isArray(db.footerNotices) && db.footerNotices.length > 0) {
	lines.push('-- 8. FOOTER NOTICES (' + db.footerNotices.length + ')');
	for (const f of db.footerNotices) {
		lines.push(
			`INSERT INTO public.footer_notices (id, title, icon, is_active, display_order) VALUES ('${esc(f.id)}', '${esc(f.title)}', '${esc(f.icon || 'info')}', ${bool(f.is_active)}, ${f.display_order ?? 0}) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, icon = EXCLUDED.icon, is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order;`
		);
	}
	lines.push('');
}

writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n'), 'utf8');
console.log(`OK: seed.sql ditulis (${lines.length} baris)`);
console.log(`  Polyclinics: ${db.polyclinics.length}`);
console.log(`  Doctors: ${db.doctors.length}`);
console.log(`  Schedules: ${db.weeklySchedules.length}`);
console.log(`  Media: ${db.mediaList.length}`);
console.log(`  Overrides: ${(db.overrides || []).length}`);
console.log(`  FooterNotices: ${(db.footerNotices || []).length}`);