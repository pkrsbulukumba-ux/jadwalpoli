# Panduan Migrasi & Database Supabase RSUD Kiosk

Dokumen ini menjelaskan langkah-langkah pengaturan database PostgreSQL di **Supabase** saat aplikasi telah selesai diuji di lingkungan lokal dan siap diluncurkan (*launching*) secara online.

---

## 📁 File Migrasi & Seed

- **`supabase/migrations/20260908000000_init_kiosk_schema.sql`**: Skrip SQL untuk membuat seluruh 10 tabel utama, foreign keys, indeks performa, aturan keamanan RLS (*Row Level Security*), trigger `updated_at`, dan fungsi verifikasi Master PIN aman (`verify_kiosk_pin`).
- **`supabase/seed.sql`**: Data awal lengkap mencakup 7 Poliklinik, 8 Dokter Spesialis, Jadwal Mingguan (sesuai referensi `Exampel.PNG`), Master Status Praktik, Pengaturan Kiosk, Footer Notices, dan Media Pengumuman.

---

## 🚀 Langkah Eksekusi Saat Siap Online

### Opsi 1: Melalui Supabase Web Dashboard (SQL Editor) - *Paling Mudah*

1. Buka dashboard proyek Supabase Anda di [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor** pada navigasi sebelah kiri.
3. Buka file `supabase/migrations/20260908000000_init_kiosk_schema.sql`, salin seluruh isinya, tempel ke SQL Editor, lalu klik tombol **Run**.
4. Buka tab baru di SQL Editor, salin isi file `supabase/seed.sql`, tempel, lalu klik tombol **Run**.
5. Database beserta seluruh data awal telah siap digunakan!

### Opsi 2: Melalui Supabase CLI

```bash
# Hubungkan ke proyek Supabase
npx supabase login
npx supabase link --project-ref your-project-ref

# Terapkan migrasi dan seed
npx supabase db push
```

---

## 🗄️ Pembuatan Storage Bucket (Media Pengumuman & Foto Dokter)

Pada dashboard Supabase, buka menu **Storage** dan buat 2 bucket berikut:

1. **`announcements`**
   - Public Bucket: **Aktifkan (Checked)**
   - Digunakan untuk: Gambar dan video pengumuman edukasi Kiosk.
2. **`doctors`**
   - Public Bucket: **Aktifkan (Checked)**
   - Digunakan untuk: Foto dokter spesialis.

Kebijakan Storage (*Storage Policies*):
- **SELECT**: Izinkan publik (`anon`) untuk melihat/mengunduh file.
- **INSERT / UPDATE / DELETE**: Izinkan hanya pengguna terautentikasi (`authenticated`).

---

## 🔑 Konfigurasi Environment Production

Setelah proyek Supabase aktif, perbarui nilai pada file `.env`:
```env
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Aplikasi akan secara otomatis mendeteksi kredensial Supabase Anda dan beralih ke sinkronisasi database online secara penuh!
