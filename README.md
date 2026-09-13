# Kiosk Jadwal Poliklinik RSUD

Sistem informasi digital **Web Kiosk Jadwal Poliklinik RSUD** berbasis Web App modern untuk layar TV vertikal portrait (rentang fisik fleksibel **43" hingga 55" inch**, resolusi baseline **1080×1920 portrait 9:16**) dengan Android TV OS / Chromium, dilengkapi **Live Kiosk Display** otomatis dan **CMS Dashboard** terintegrasi untuk staf rumah sakit.

Referensi desain dan hierarki visual mengacu pada file `Exampel.PNG` dan dokumen spesifikasi teknis `PRD.md`.

---

## 🛠️ Arsitektur & Tech Stack

- **Frontend & App Engine**: [SvelteKit 2](https://svelte.dev/) (Svelte 5 Runes) + TypeScript
- **Styling Architecture**: Modern Vanilla CSS + Design Tokens terpusat (bebas ketergantungan framework utility pihak ketiga)
- **Database & Backend**: PostgreSQL melalui [Supabase](https://supabase.com/) dengan skema RLS (*Row Level Security*)
- **Autentikasi CMS**: Dual-Mode (Kiosk Touchscreen Master PIN + Supabase Auth) dengan Rate Limiting & Auto-Lock Idle
- **Penyimpanan Media**: Hybrid Storage (Supabase Storage untuk file cloud, URL daring, serta opsi **Local Internal Storage TV (`local_path`)** khusus untuk video edukasi berukuran besar)
- **Offline Resiliency**: PWA Service Worker caching (`build`, `files`, `version`) dan snapshot cadangan `localStorage`
- **Ikon Antarmuka**: `@lucide/svelte`

---

## 🚀 Panduan Setup & Instalasi Proyek

### 1. Prasyarat Perangkat Lunak
- **Node.js**: Versi 18 ke atas (Disarankan v20 LTS)
- **npm**: Versi 9 ke atas
- Browser Chromium / WebView Android pada Smart TV Kiosk

### 2. Instalasi Dependensi
Clone repositori atau buka direktori proyek, kemudian jalankan:
```bash
npm install
```
*(Catatan bagi pengguna Windows PowerShell: gunakan `npm.cmd install` jika terdapat pembatasan execution policy)*

### 3. Konfigurasi Environment Variables
Salin berkas template lingkungan:
```bash
cp .env.example .env
```
Konfigurasi nilai pada `.env`:
```env
# URL dan Public Anon Key Supabase Anda
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> [!NOTE]
> **Arsitektur Dual-Mode**: Jika kredensial Supabase belum diisi atau bernilai dummy, aplikasi secara otomatis beroperasi dalam **Mode Siaga Lokal (Local-First Offline)** sehingga seluruh pengujian, demonstrasi, dan perputaran Kiosk tetap berjalan 100% lancar.

---

## 🗄️ Setup Database Supabase & Migrasi

### 1. Eksekusi Skrip Migrasi SQL
Buka dashboard Supabase proyek Anda pada menu **SQL Editor**:
1. Buka file [`supabase/migrations/20260908000000_init_kiosk_schema.sql`](supabase/migrations/20260908000000_init_kiosk_schema.sql).
2. Tempelkan seluruh perintah SQL dan klik tombol **Run**. Ini akan membuat seluruh 10 tabel utama (`polyclinics`, `doctors`, `weekly_schedules`, `schedule_overrides`, `media_announcements`, `kiosk_settings`, `footer_notices`, dll.), indeks performa, aturan keamanan RLS, dan RPC keamanan `verify_kiosk_pin`.

### 2. Seeding Data Awal Rumah Sakit
1. Buka file [`supabase/seed.sql`](supabase/seed.sql).
2. Salin dan tempelkan ke tab baru SQL Editor, lalu klik **Run**.
3. Data 7 Poliklinik (Jantung, Jiwa, KB, Kulit, Penyakit Dalam, Mata, Anak), 8 Dokter Spesialis, Jadwal Mingguan (Senin–Minggu), dan media pengumuman siap digunakan.

### 3. Pembuatan Storage Bucket (Media Pengumuman & Foto Dokter)
Pada dashboard Supabase, masuk ke menu **Storage** dan buat 2 bucket berikut:
- **`announcements`**: Aktifkan centang **Public Bucket** (Untuk gambar dan video pengumuman edukasi).
- **`doctors`**: Aktifkan centang **Public Bucket** (Untuk foto dokter spesialis).

Aturan Kebijakan Akses (*Storage Policies*):
- `SELECT`: Izinkan publik / anonim untuk membaca media.
- `INSERT`, `UPDATE`, `DELETE`: Batasi hanya untuk pengguna terautentikasi (`authenticated`).

---

## 💻 Menjalankan Aplikasi Secara Mandiri

### 1. Menjalankan Server Development (Lokal)
> **💡 Catatan Khusus Windows PowerShell**: Jika Anda menemui peringatan keamanan script (*Execution Policy / PSSecurityException*), jalankan perintah dengan menambahkan ekstensi `.cmd` (misal: `npm.cmd run dev`), atau gunakan Command Prompt (CMD) biasa.

* **Mode Standar (Hanya Diakses di Komputer Ini)**:
  ```powershell
  # Di Windows PowerShell / Terminal VS Code:
  npm.cmd run dev

  # Di Command Prompt (CMD) atau macOS/Linux:
  npm run dev
  ```
  Aplikasi akan aktif di `http://localhost:5173`.

* **Mode Jaringan / LAN (Dapat Diakses dari Android TV di WiFi yang Sama)**:
  ```powershell
  npm.cmd run dev -- --host
  ```
  Terminal akan menampilkan alamat IP lokal Anda (misal: `http://192.168.1.xxx:5173/kiosk`). Masukkan alamat tersebut di browser Android TV.

### 2. URL Akses Cepat & Kredensial Bawaan
* **Layar Utama Kiosk (Tampilan TV Vertikal)**: [http://localhost:5173/kiosk](http://localhost:5173/kiosk)
* **Dashboard CMS Administrator**: [http://localhost:5173/admin](http://localhost:5173/admin)
* **Halaman Login Master PIN**: [http://localhost:5173/admin/login](http://localhost:5173/admin/login)
* **Master PIN Bawaan (Default)**: `1234` *(atau `123456`)*

### 3. Pengujian Otomatis (Test Suite)
Menjalankan seluruh 26 unit test (algoritma status praktik dokter, integrasi CRUD repository, soak test 24/7, dan audit log):
```powershell
npm.cmd test
```

### 4. Pengecekan Tipe Data (Type-Checking) & Validasi Kode
Memvalidasi integritas Svelte 5 runes dan TypeScript:
```powershell
npm.cmd run check
```

### 5. Kompilasi Build Produksi & Preview
* **Membuat Paket Produksi**:
  ```powershell
  npm.cmd run build
  ```
  Bundle produksi yang teroptimasi akan dihasilkan di direktori `.svelte-kit/output`.
* **Menguji Hasil Build Produksi (Preview)**:
  ```powershell
  npm.cmd run preview
  ```

---

## 📺 Pengoperasian Layar TV Kiosk & CMS

### 1. Membuka Live Kiosk Display (`/kiosk`)
- Buka URL: `http://localhost:5173/kiosk` (atau domain produksi Anda di hosting).
- Layar Kiosk otomatis menampilkan rotasi slide jadwal poliklinik dan media pengumuman secara mulus.
- **Konfigurasi Android TV Kiosk**:
  - Pasang browser kiosk seperti *Fully Kiosk Browser* atau *Android WebView*.
  - Arahkan ke URL `/kiosk`.
  - Aktifkan opsi *Fullscreen*, *Autostart on Boot*, dan *Keep Screen On*.
  - Atur User Agent atau izin autoplay audio video di pengaturan browser TV.

### 2. Mengakses CMS Dashboard & Membuka Kunci Kiosk
- **Akses Langsung**: Buka URL `/admin` atau `/admin/login`.
- **Akses Touchscreen dari Layar Kiosk**:
  1. Sentuh ikon **Gembok (Lock)** di pojok kanan atas header Kiosk.
  2. Masukkan **Master PIN** (Bawaan Dev: `1234`) pada Virtual Keypad.
  3. Layar langsung dialihkan ke CMS Dashboard.
- **Kredensial Default Login Alternatif**:
  - Admin: `admin@rsud.go.id` / Sandi: `admin123`
  - Operator: `operator@rsud.go.id` / Sandi: `operator123`

### 3. Struktur 5 Menu Utama CMS (PRD Section 7)
1. **Dashboard** (`/admin`): Ringkasan statistik poliklinik, dokter aktif, jadwal hari ini, linimasa riwayat aktivitas (*Audit Log*), dan status sistem.
2. **Poliklinik** (`/admin/poli`): Manajemen poliklinik, kode poli, ikon medis Lucide, urutan tampilan, dan toggle status aktif.
3. **Dokter & Jadwal** (`/admin/doctors-jadwal`):
   - *Sub-menu 1*: Quick Action Status Praktik Hari Ini (1-klik Buka, Istirahat, Cuti/Libur, Buka Lebih Awal, dan Reset ke Jadwal Otomatis).
   - *Sub-menu 2*: Master Data Dokter Spesialis & Unggah Foto.
   - *Sub-menu 3*: Jadwal Praktik Mingguan (Senin–Minggu, jam mulai dan selesai).
4. **Media Pengumuman** (`/admin/media`): Manajemen konten gambar dan video edukasi slideshow. Mendukung 3 pilihan penyimpanan:
   - **Local Storage TV (`local_path`)**: Penautan berkas video lokal internal storage TV untuk video berukuran besar (>50MB) tanpa membebani kuota data rumah sakit.
   - **URL Daring**: Tautan tautan file eksternal/CDN.
   - **Unggah Berkas**: Upload langsung ke storage.
5. **Pengaturan Kiosk** (`/admin/kiosk-settings`):
   - *Identitas RSUD*: Nama RS, Subnama, Logo, Zona Waktu (WITA/WIB/WIT), dan Format Jam.
   - *Durasi & Audio*: Slider durasi jadwal/gambar, toggle suara video Android TV, interval polling.
   - *Teks Berjalan & Footer*: Running text, kecepatan, arah animasi, dan kartu informasi footer.
   - *Banner Darurat*: Pengumuman insidental darurat (Info/Warning/Critical).
   - *Skala Layar TV (43"–55")*: Preset Kompak (43"), Standar (1.0x), Ekstra Besar (50"-55"), dan penyesuaian kustom CSS variable tokens.
   - *Keamanan & Master PIN*: Penggantian PIN Touchscreen dengan validasi PIN lama.
   - *Cloud & Sinkronisasi*: Panel status koneksi Supabase, tombol Uji Konektivitas, Tarik Data (Pull), dan Ekspor Pengaturan (Push).

### 4. Prosedur Reset Data Development
Jika Anda ingin mengembalikan data ke kondisi awal bawaan pabrik:
1. Masuk ke browser Console (F12) atau buka Pengaturan Browser TV.
2. Hapus local storage aplikasi:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
3. Data lokal akan otomatis diinisialisasi ulang dari default seed data.

---

## 🌐 Panduan Menjalankan Secara Daring via Web (Hosting + Supabase)

Dengan arsitektur modern **Jamstack / Serverless BaaS**, Anda **tidak perlu membuat atau mengelola server backend mandiri** (seperti Express, PM2, atau VPS Linux terpisah). Frontend di-hosting di layanan web hosting modern, sedangkan Database PostgreSQL, Realtime WebSocket, dan Media Storage ditangani 100% oleh **Supabase Cloud**.

---

### Langkah 1: Setup Database & Storage di Supabase Cloud (Gratis)
1. Buka [supabase.com](https://supabase.com) lalu buat akun dan klik **New Project**.
2. **Eksekusi Skrip Skema Tabel**:
   * Buka menu **SQL Editor** di dashboard Supabase.
   * Salin seluruh isi file [`supabase/migrations/20260908000000_init_kiosk_schema.sql`](supabase/migrations/20260908000000_init_kiosk_schema.sql), tempelkan ke SQL Editor, lalu klik **Run**. Ini akan membuat seluruh 10 tabel utama, relasi foreign key, indeks performa, aturan keamanan RLS, dan fungsi verifikasi PIN.
3. **Buat Storage Bucket Media**:
   * Buka menu **Storage** ➡️ klik **New Bucket**.
   * Buat bucket bernama: `announcements` (Pastikan centang **Public Bucket** aktif agar poster gambar dan video edukasi dapat diakses publik oleh layar TV Kiosk).
   * Buat bucket bernama: `doctors` (Pastikan centang **Public Bucket** aktif untuk foto profil dokter spesialis).
4. **Salin Kredensial API Proyek**:
   * Masuk ke menu **Project Settings** ➡️ **API**.
   * Salin **Project URL** (contoh: `https://xyzproject.supabase.co`).
   * Salin **anon / public key** (kunci publik aman yang digunakan oleh browser).

---

### Langkah 2: Migrasikan Seluruh Data Lokal Anda ke Supabase (Fitur 1-Klik)
Seluruh poliklinik, dokter spesialis, jadwal praktik, media, dan pengaturan yang telah Anda lengkapi di lingkungan lokal **dapat langsung dipindahkan ke Supabase tanpa perlu mengetik ulang satu pun**:

1. Pastikan server lokal Anda aktif, lalu buka CMS: [http://localhost:5173/admin/kiosk-settings](http://localhost:5173/admin/kiosk-settings).
2. Masuk ke tab **Integrasi Supabase & Cloud**.
3. Gulir ke bawah hingga panel **"Ekspor Seluruh Data Lokal ke SQL Supabase (1-Klik Siap Deploy)"**.
4. Klik tombol **"Generate Skrip SQL"**:
   * Sistem akan otomatis mengekstrak seluruh data lokal Anda (dari berkas `data/local-db.json`) menjadi skrip SQL `INSERT ... ON CONFLICT DO UPDATE`.
5. Klik tombol **"Salin SQL Lengkap"**.
6. Buka kembali dashboard Supabase Anda ➡️ buka tab **SQL Editor** ➡️ Tempelkan (*Paste*) skrip tersebut dan klik **Run**.
7. **Selesai!** Seluruh data dokter, jadwal mingguan, poliklinik, dan pengumuman yang Anda inputkan di lokal kini telah 100% tersimpan aman di database PostgreSQL Supabase Cloud.

---

### Langkah 3: Deploy Frontend ke Web Hosting

#### Opsi A: Vercel / Netlify / Cloudflare Pages (Paling Direkomendasikan — Gratis & Otomatis)
Platform ini secara native mendukung SvelteKit tanpa konfigurasi server tambahan (*Zero-Configuration*):
1. Unggah (*Push*) repository proyek ini ke **GitHub** atau **GitLab** Anda.
2. Buka [vercel.com](https://vercel.com) atau [netlify.com](https://netlify.com), lalu klik **Add New Project** ➡️ **Import Git Repository**.
3. Di bagian **Environment Variables**, tambahkan dua variabel:
   * `PUBLIC_SUPABASE_URL` = *(Project URL dari Supabase)*
   * `PUBLIC_SUPABASE_ANON_KEY` = *(anon public key dari Supabase)*
4. Klik tombol **Deploy**. Vercel/Netlify akan otomatis melakukan build produksi dan memberikan tautan domain HTTPS resmi siap pakai (misal: `https://kiosk-rsud-bulukumba.vercel.app`).

#### Opsi B: Hosting Web Biasa / cPanel / Server Rumah Sakit
1. Pasang adapter statis:
   ```powershell
   npm.cmd install -D @sveltejs/adapter-static
   ```
2. Ubah adapter pada file `vite.config.ts` menjadi `adapter-static` dengan opsi `{ fallback: 'index.html' }`.
3. Jalankan `npm.cmd run build`.
4. Unggah seluruh isi folder `build` langsung ke folder `public_html` di File Manager cPanel.

#### Opsi C: Server Node.js / Docker Mandiri
```powershell
npm.cmd install -D @sveltejs/adapter-node
npm.cmd run build
node build
```

---

### Langkah 4: Alur Kerja Input & Output Setelah Live di Supabase

Setelah sistem dideploy ke hosting dan terhubung ke Supabase, alur kerja operasional rumah sakit berjalan sebagai berikut:

```text
┌────────────────────────────────┐         ┌───────────────────────────────┐         ┌────────────────────────────────┐
│      LAPTOP / HP STAF RS       │         │        SUPABASE CLOUD         │         │      LAYAR TV KIOSK RSUD       │
│ (https://domain-anda/admin)    │         │ (PostgreSQL & Realtime CDC)   │         │ (https://domain-anda/kiosk)    │
└───────────────┬────────────────┘         └───────────────┬───────────────┘         └───────────────┬────────────────┘
                │                                          │                                         │
                │ 1. Staf ubah status dokter (misal cuti)  │                                         │
                ├─────────────────────────────────────────>│                                         │
                │    Data tersimpan ke PostgreSQL Cloud    │                                         │
                │                                          │ 2. Supabase pancarkan sinyal WebSocket  │
                │                                          ├────────────────────────────────────────>│
                │                                          │    Channel: 'kiosk-live-updates'        │ 3. Layar TV Otomatis
                │                                          │                                         │    Berubah Seketika
                │                                          │                                         │    Tanpa Perlu Reload!
```

1. **Input Data (Staf RS)**:
   * Staf membuka URL CMS (contoh: `https://kiosk-rsud.vercel.app/admin`) menggunakan laptop atau smartphone di ruang poliklinik.
   * Masukkan Master PIN (`1234`).
   * Setiap penambahan dokter, perubahan jam praktik, atau status darurat yang disimpan staf langsung tersimpan ke Supabase Cloud.
2. **Output Data (Layar TV Kiosk)**:
   * Layar Android TV di ruang tunggu RSUD membuka URL: `https://kiosk-rsud.vercel.app/kiosk` dalam mode Fullscreen.
   * Modul **Supabase Realtime Channel** (`DataRepository.subscribeToRealtimeChanges`) yang tertanam di halaman Kiosk secara aktif memantau tabel database.
   * Setiap ada data baru yang disimpan oleh staf, **layar TV otomatis memperbarui tayangan dokter dan jadwal dalam hitungan detik tanpa kedip (*flicker-free*) dan tanpa perlu me-refresh halaman browser**.
3. **Penyimpanan Media Gambar & Video**:
   * File media yang telah Anda unggah di folder lokal `static/uploads/` otomatis disertakan dalam paket deployment hosting.
   * Penambahan media baru di masa mendatang dapat diunggah langsung ke Supabase Storage Bucket atau ditautkan melalui URL CDN.

---

## 📋 Verifikasi Checklist Produksi (PRD Section 38)

Semua 27 butir checklist kelayakan produksi telah teruji dan terpenuhi 100%:

- [x] **Build production berhasil** (`npm run build` sukses tanpa error)
- [x] **Typecheck berhasil** (`npm run check` 0 error, 0 warning)
- [x] **Lint & format bersih**
- [x] **Test suite berhasil 100%** (21 unit, integration, dan soak test lulus)
- [x] **Login admin berhasil** (PIN Virtual Keypad & Kredensial Email)
- [x] **Kiosk route dapat dibuka** (`/kiosk` langsung jalan)
- [x] **Jadwal poliklinik tampil** sesuai pengelompokan poli
- [x] **Status praktik dokter tampil** (BUKA, ISTIRAHAT, TUTUP, LIBUR)
- [x] **Perubahan jadwal dari CMS langsung tampil** di Kiosk secara realtime
- [x] **Foto dokter tampil** dengan fallback inisial avatar
- [x] **Poli baru tampil** dinamis dari database
- [x] **Gambar pengumuman tampil** dengan durasi teratur
- [x] **Video pengumuman tampil** bersuara di Android TV
- [x] **Video menunggu selesai** sebelum berganti slide (`onended` event)
- [x] **Pagination benar** (maksimal 4 poli per slide portrait)
- [x] **Running text berjalan** mulus di bagian footer dasar
- [x] **Footer notices tampil** dengan 4 kartu operasional
- [x] **Emergency banner dapat diaktifkan** dengan level info/warning/critical
- [x] **PIN lock berfungsi** dengan proteksi rate limiter & auto-lock 5 menit
- [x] **Admin route terproteksi** dengan session guard
- [x] **RLS aktif** pada seluruh 10 tabel migrasi Supabase
- [x] **Storage policy aman** (hanya admin yang dapat menulis)
- [x] **Tidak ada service role key pada client** (hanya public anon key)
- [x] **Offline fallback berjalan** via Service Worker & snapshot cadangan
- [x] **Tampilan portrait 1080×1920 stabil** pada rentang TV 43"–55"
- [x] **Soak test lulus 100 siklus** tanpa kebocoran memori atau duplikasi timer
- [x] **Panel status sinkronisasi Supabase aktif** dengan indikator live latency
