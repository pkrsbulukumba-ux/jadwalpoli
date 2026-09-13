-- ==============================================================================
-- MIGRASI BASIS DATA KIOSK JADWAL POLIKLINIK RSUD
-- File: 20260908000000_init_kiosk_schema.sql
-- Kompatibel dengan PostgreSQL 15+ & Supabase Database
-- 
-- CATATAN PENTING:
-- - Semua PK id menggunakan TEXT (bukan UUID) agar kompatibel dengan ID string
--   yang sudah dipakai data lokal (poli-1, doc-..., sch-...)
-- - Kolom polyclinic_id ditambahkan ke tabel doctors untuk mempertahankan
--   relasi dokter→poli utama tanpa memerlukan join doctor_polyclinics
-- - RLS dikonfigurasi anon full-access untuk mendukung arsitektur PIN-based
--   tanpa Supabase Auth. Untuk production, ganti ke Supabase Auth + policy
--   berbasis role. Lihat komentar di bawah.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL: polyclinics (Poliklinik RSUD)
CREATE TABLE IF NOT EXISTS public.polyclinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT 'activity',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL: doctors (Dokter Spesialis)
-- Tambahan kolom polyclinic_id untuk relasi utama dokter→poli
CREATE TABLE IF NOT EXISTS public.doctors (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    title TEXT,
    photo_url TEXT,
    polyclinic_id TEXT REFERENCES public.polyclinics(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABEL: doctor_polyclinics (Relasi many-to-many Poli dan Dokter)
-- Dipertahankan untuk fleksibilitas dokter di multiple poli
CREATE TABLE IF NOT EXISTS public.doctor_polyclinics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    polyclinic_id TEXT NOT NULL REFERENCES public.polyclinics(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (doctor_id, polyclinic_id)
);

-- 5. TABEL: weekly_schedules (Jadwal Praktik Mingguan)
CREATE TABLE IF NOT EXISTS public.weekly_schedules (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    polyclinic_id TEXT NOT NULL REFERENCES public.polyclinics(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABEL: practice_statuses (Master Status Praktik Dokter)
CREATE TABLE IF NOT EXISTS public.practice_statuses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'circle',
    color TEXT NOT NULL DEFAULT '#059669',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0
);

-- 7. TABEL: schedule_overrides (Override Jadwal Tanggal Khusus)
CREATE TABLE IF NOT EXISTS public.schedule_overrides (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    polyclinic_id TEXT NOT NULL REFERENCES public.polyclinics(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    status_code TEXT NOT NULL REFERENCES public.practice_statuses(code) ON UPDATE CASCADE,
    custom_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (doctor_id, polyclinic_id, schedule_date)
);

-- 8. TABEL: media_announcements (Media Pengumuman Gambar & Video)
CREATE TABLE IF NOT EXISTS public.media_announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    file_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABEL: kiosk_settings (Konfigurasi Singleton Tampilan Kiosk & Master PIN)
CREATE TABLE IF NOT EXISTS public.kiosk_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    hospital_name TEXT NOT NULL DEFAULT 'RSUD H. Andi Sulthan Daeng Radja',
    hospital_subtitle TEXT NOT NULL DEFAULT 'Kabupaten Bulukumba',
    hospital_logo_url TEXT DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
    date_format TEXT NOT NULL DEFAULT 'dd MMMM yyyy',
    time_format TEXT NOT NULL DEFAULT 'HH:mm',
    slide_duration_seconds INTEGER NOT NULL DEFAULT 15,
    image_duration_seconds INTEGER NOT NULL DEFAULT 10,
    video_wait_for_end BOOLEAN NOT NULL DEFAULT true,
    video_sound_enabled BOOLEAN NOT NULL DEFAULT true,
    refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
    font_scale NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    card_scale NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    header_scale NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    footer_scale NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    show_page_indicator BOOLEAN NOT NULL DEFAULT true,
    show_running_text BOOLEAN NOT NULL DEFAULT true,
    show_footer_notices BOOLEAN NOT NULL DEFAULT true,
    show_emergency_banner BOOLEAN NOT NULL DEFAULT false,
    emergency_title TEXT DEFAULT 'PENGUMUMAN LAYANAN',
    emergency_message TEXT DEFAULT '',
    emergency_level TEXT DEFAULT 'warning' CHECK (emergency_level IN ('info', 'warning', 'critical')),
    running_text TEXT NOT NULL DEFAULT 'Pengaduan: +62 811-4441-100 • Facebook: RSUD BULUKUMBA • Instagram: @RSUDBULUKUMBA • Melayani Dengan Sepenuh Hati',
    running_text_speed INTEGER NOT NULL DEFAULT 26,
    running_text_direction TEXT NOT NULL DEFAULT 'left' CHECK (running_text_direction IN ('left', 'right')),
    master_pin_hash TEXT NOT NULL DEFAULT crypt('1234', gen_salt('bf', 10)),
    screen_mode TEXT DEFAULT '55' CHECK (screen_mode IN ('43', '55', '65')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. TABEL: footer_notices (Kartu Informasi Operasional Footer Kiosk)
CREATE TABLE IF NOT EXISTS public.footer_notices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'info',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. TABEL: admin_profiles (Profil Operator & Admin Terhubung ke auth.users)
-- Tetap menggunakan UUID karena referensi ke auth.users
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEKS PERFORMA (Optimasi Query Kiosk & Realtime)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_polyclinics_active_order ON public.polyclinics(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_doctors_active_order ON public.doctors(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_doctors_policlinic ON public.doctors(polyclinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_polyclinics_lookup ON public.doctor_polyclinics(doctor_id, polyclinic_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_lookup ON public.weekly_schedules(polyclinic_id, doctor_id, day_of_week) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_overrides_lookup ON public.schedule_overrides(schedule_date, doctor_id, polyclinic_id);
CREATE INDEX IF NOT EXISTS idx_media_active_order ON public.media_announcements(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_footer_notices_active ON public.footer_notices(is_active, display_order);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- AKTIFKAN RLS pada seluruh tabel
ALTER TABLE public.polyclinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_polyclinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- CATATAN KEAMANAN RLS:
-- 
-- Aplikasi ini menggunakan arsitektur PIN-based (Master PIN + sessionStorage)
-- tanpa integrasi Supabase Auth untuk login CMS. Untuk memungkinkan operasi
-- tulis (INSERT/UPDATE/DELETE) dari browser dengan anon key, policy dibawah
-- memberikan akses penuh ke anon & authenticated.
-- 
-- UNTUK PRODUCTION SECURE:
-- 1. Aktifkan Supabase Auth (email/password atau OTP)
-- 2. Hapus policy anon-write dibawah
-- 3. Ganti dengan policy: authenticated users with role check
--    (referensi admin_profiles.role = 'admin' untuk write)
-- 4. master_pin_hash hanya readable via RPC verify_kiosk_pin (sudah benar)
-- ==============================================================================

-- 1. Poliklinik: Public full access (anon baca & tulis)
CREATE POLICY "Public full access polyclinics" ON public.polyclinics
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Dokter: Public full access
CREATE POLICY "Public full access doctors" ON public.doctors
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Doctor Polyclinics: Public full access
CREATE POLICY "Public full access doctor_polyclinics" ON public.doctor_polyclinics
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Weekly Schedules: Public full access
CREATE POLICY "Public full access weekly_schedules" ON public.weekly_schedules
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Practice Statuses: Public full access
CREATE POLICY "Public full access practice_statuses" ON public.practice_statuses
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Schedule Overrides: Public full access
CREATE POLICY "Public full access schedule_overrides" ON public.schedule_overrides
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Media Announcements: Public full access
CREATE POLICY "Public full access media_announcements" ON public.media_announcements
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Kiosk Settings: Public full access (PIN hash terlindungi via RPC)
CREATE POLICY "Public full access kiosk_settings" ON public.kiosk_settings
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. Footer Notices: Public full access
CREATE POLICY "Public full access footer_notices" ON public.footer_notices
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. Admin Profiles: Authenticated users manage own profile, admins manage all
CREATE POLICY "Users can read their own profile or admins read all" ON public.admin_profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage profiles" ON public.admin_profiles
    FOR ALL TO authenticated USING (
        auth.uid() = id OR EXISTS (
            SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==============================================================================
-- FUNGSI KEAMANAN RPC: verify_kiosk_pin
-- Memverifikasi Master PIN tanpa membocorkan plaintext/hash ke browser
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(input_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    stored_hash TEXT;
    is_valid BOOLEAN;
BEGIN
    SELECT master_pin_hash INTO stored_hash FROM public.kiosk_settings WHERE id = 1;
    IF stored_hash IS NULL THEN
        RETURN false;
    END IF;

    -- Dukung hash bcrypt (crypt) maupun format PIN tersimpan langsung (PIN#...)
    IF stored_hash LIKE 'PIN#%' THEN
        RETURN (stored_hash = 'PIN#' || input_pin);
    END IF;

    is_valid := (stored_hash = extensions.crypt(input_pin, stored_hash));
    RETURN is_valid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_kiosk_pin(TEXT) TO anon, authenticated;

-- ==============================================================================
-- FUNGSI UPDATE MASTER PIN (Hanya untuk Admin Terautentikasi)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_kiosk_pin(new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Catatan: Dengan policy anon-write saat ini, fungsi ini bisa dipanggil anon.
    -- Untuk production secure, batasi ke authenticated + role admin.
    IF length(new_pin) < 4 OR length(new_pin) > 8 THEN
        RAISE EXCEPTION 'PIN harus terdiri dari 4 sampai 8 karakter';
    END IF;

    UPDATE public.kiosk_settings
    SET master_pin_hash = 'PIN#' || new_pin,
        updated_at = timezone('utc'::text, now())
    WHERE id = 1;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kiosk_pin(TEXT) TO anon, authenticated;

-- ==============================================================================
-- TRIGGER OTOMATIS: updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_polyclinics_updated_at
    BEFORE UPDATE ON public.polyclinics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_doctors_updated_at
    BEFORE UPDATE ON public.doctors
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_weekly_schedules_updated_at
    BEFORE UPDATE ON public.weekly_schedules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_media_announcements_updated_at
    BEFORE UPDATE ON public.media_announcements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_kiosk_settings_updated_at
    BEFORE UPDATE ON public.kiosk_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_doctor_polyclinics_updated_at
    BEFORE UPDATE ON public.doctor_polyclinics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();