# PRD — Kiosk Jadwal Poliklinik RSUD

## 1. Ringkasan Produk

Membangun aplikasi **Web Kiosk Jadwal Poliklinik RSUD** yang ditampilkan pada monitor TV vertikal/kiosk berbasis **Android OS**, dengan orientasi utama **portrait 9:16** dan ukuran fisik sekitar **55 inch**.

Aplikasi memiliki dua area utama:

1. **Live Kiosk Display** — halaman publik yang berjalan otomatis/loop untuk menampilkan jadwal poliklinik, status praktik dokter, informasi fasilitas/pesan singkat, media pengumuman gambar/video, pagination, dan running text.
2. **CMS Dashboard** — halaman admin yang aman untuk mengelola seluruh konten kiosk tanpa perlu mengubah kode program.

Teknologi target:

- Frontend/App: **SvelteKit + TypeScript**
- Database: **PostgreSQL melalui Supabase**
- Authentication: **Supabase Auth** untuk admin
- Storage media: **Supabase Storage**
- Deployment: siap untuk hosting modern yang mendukung SvelteKit
- Browser target kiosk: browser Android Chromium/WebView yang mendukung autoplay video dengan pendekatan yang aman untuk kiosk

Referensi visual utama adalah file **`Exampel.png`** yang dilampirkan user. Implementasi harus memiliki nuansa, struktur, hierarki, gradasi warna, kartu jadwal, header, footer, dan kepadatan informasi yang serupa, tetapi tetap dibuat sebagai desain original yang rapi dan mudah dibaca dari jarak jauh.

---

## 2. Tujuan Produk

### 2.1 Tujuan utama

- Menampilkan jadwal poli dan dokter secara jelas dalam mode kiosk.
- Menampilkan status praktik dokter secara realtime/semi-realtime berdasarkan data CMS.
- Memudahkan staf rumah sakit memperbarui data tanpa bantuan developer.
- Menampilkan media edukasi/pengumuman berupa gambar dan video sebagai bagian dari slideshow kiosk.
- Menyediakan pengamanan touchscreen agar kiosk tidak dapat dioperasikan sembarang orang.
- Memastikan seluruh tampilan kiosk tetap konsisten walaupun konten berubah dari dashboard.
- Menyediakan konfigurasi tampilan terpusat: identitas RSUD, warna, skala layar, durasi slide, banner darurat, running text, dan PIN.

### 2.2 Sasaran pengguna

**Pengunjung/pasien:** hanya melihat informasi.

**Petugas/operator:** memperbarui jadwal, status praktik, poli, dokter, dan media.

**Administrator:** mengatur seluruh konten, kiosk settings, PIN, dan konfigurasi sistem.

---

## 3. Prinsip Produk

1. **Kiosk-first** — layar publik harus menjadi fokus utama.
2. **Readable from distance** — teks tidak boleh terlalu kecil.
3. **Simple CMS** — operator non-teknis dapat melakukan perubahan dengan mudah.
4. **Data-driven** — tidak ada data jadwal utama yang hard-coded di komponen UI.
5. **Consistent design system** — perubahan data tidak boleh merusak layout.
6. **Safe by default** — kiosk tidak menyediakan akses bebas ke browser atau dashboard.
7. **Graceful degradation** — bila internet/backend sementara gagal, kiosk tetap menampilkan data/cache terakhir yang valid selama memungkinkan.
8. **Easy maintenance** — struktur kode modular dan mudah dikembangkan.
9. **Minimal CMS navigation** — menu utama harus sedikit; fitur yang saling berkaitan digabung dalam satu menu agar dashboard tidak berat dan membingungkan.

---

# 4. Ruang Lingkup Fitur

## 4.1 Live Kiosk Display

Header wajib memiliki:

- Logo RSUD.
- Nama RSUD.
- Subjudul/lokasi rumah sakit.
- Tanggal aktif.
- Tombol/ikon **Kunci Kiosk**.
- Tombol kecil untuk masuk ke **CMS**, tersembunyi/terintegrasi dengan akses PIN.
- Jam digital realtime.
- Indikator halaman/slide, contoh `HALAMAN 1/8`.

Area judul:

- Label `JADWAL POLIKLINIK`.
- Subteks informasi jadwal praktik dokter spesialis.
- Progress indicator/bar berjalan.

Konten jadwal:

- Dikelompokkan berdasarkan poli/departemen.
- Badge nama poli.
- Jumlah dokter pada poli.
- Foto dokter.
- Nama dokter.
- Gelar dokter.
- Daftar jadwal Senin–Jumat atau hari aktif lainnya.
- Jam mulai–selesai.
- Penandaan hari aktif/terpilih.
- Status praktik.
- Status buka/tutup poli bila diaktifkan.

Contoh status:

- `BUKA`
- `TUTUP`
- `SEDANG PRAKTIK`
- `SELANJUTNYA`
- `DILUAR JADWAL`
- `LIBUR`
- `DIBATALKAN`
- `AKAN DATANG`

Status harus menggunakan warna, ikon, dan teks sehingga tidak bergantung pada warna saja.

---

## 4.2 Slideshow / Pagination Kiosk

Kiosk menampilkan konten secara otomatis berdasarkan urutan slide.

Contoh:

- Slide 1–N: jadwal poliklinik.
- Slide terakhir: media pengumuman/edukasi.

Ketentuan:

- Durasi default slide: configurable dari CMS.
- Perpindahan slide menggunakan fade/soft slide transition.
- Tidak boleh ada animasi berlebihan.
- Pagination indicator tampil di bagian bawah area utama.
- Slide aktif diberi indikator visual yang jelas.
- Bila konten media berupa **video**, slide video harus **menunggu sampai video selesai** sebelum pindah ke slide berikutnya.
- Jika video gagal diputar, gunakan fallback image/thumbnail selama beberapa detik lalu lanjut ke slide berikutnya.
- Video tidak boleh menyebabkan kiosk berhenti permanen.

---

# 5. Media Pengumuman

CMS harus menyediakan satu menu khusus **Media Pengumuman** dengan alur sesederhana mungkin. Media hanya digunakan sebagai slide pengumuman/edukasi pada kiosk.

## Field Media

Form upload hanya memiliki field berikut:

- **Judul Media** — nama/judul yang digunakan untuk identifikasi media di CMS.
- **Upload Media** — memilih file gambar atau video.

Format yang didukung:

- JPG
- JPEG
- PNG
- WebP
- MP4/WebM sesuai kemampuan browser kiosk

## Aksi Media

Setiap item media memiliki aksi yang fungsional dan minimal:

- **Preview/Tampilkan** — melihat media sebelum digunakan atau memastikan file dapat diputar.
- **Aktifkan / Nonaktifkan** — menentukan apakah media masuk ke slideshow kiosk.
- **Hapus** — menghapus media dari daftar dan Storage setelah konfirmasi.

Tidak ada tombol **Edit Metadata** dan tidak ada **Recorder** pada item media.

Tidak perlu fitur berikut pada CMS media:

- Edit metadata.
- Recorder.
- Pengaturan teknis media yang tidak dibutuhkan operator.
- Jadwal tayang yang kompleks.
- Field deskripsi, caption, thumbnail manual, atau poster manual sebagai requirement wajib.

Sistem secara otomatis menentukan tipe media berdasarkan file yang diunggah. Untuk video, gunakan poster/frame fallback otomatis bila browser membutuhkannya.

## Perilaku Kiosk

- Hanya media **aktif** yang ditampilkan pada slideshow.
- Media inactive tidak ikut dihitung sebagai slide publik.
- Gambar tampil sesuai durasi media yang dikonfigurasi pada Pengaturan Kiosk.
- Video menunggu sampai selesai sebelum lanjut ke slide berikutnya.
- Bila video gagal diputar, tampilkan fallback seperlunya lalu lanjut ke slide berikutnya.

---

# 6. Dashboard CMS

Dashboard CMS harus **ringkas dan berorientasi operasional**. Jangan membuat terlalu banyak menu utama. Operator harus dapat melakukan pekerjaan sehari-hari dari sedikit menu yang jelas.

## 6.1 Navigasi Utama CMS

Menu utama cukup:

1. **Dashboard**
2. **Poliklinik**
3. **Dokter & Jadwal**
4. **Media Pengumuman**
5. **Pengaturan Kiosk**

Tidak perlu membuat menu utama terpisah untuk status, running text, emergency banner, footer, log, atau konfigurasi visual. Fitur-fitur tersebut ditempatkan sebagai bagian/sub-section dari menu yang relevan.

**Aturan UI CMS:** jangan menambahkan menu utama baru hanya karena ada satu fitur kecil. Tambahkan fungsi sebagai sub-section pada menu yang sudah ada bila masih satu konteks kerja.

## 6.2 Dashboard Home

Tampilkan ringkasan yang benar-benar berguna bagi operator:

- Total poli aktif.
- Total dokter aktif.
- Jumlah jadwal hari ini.
- Jumlah media aktif.
- Waktu sinkronisasi terakhir.
- Shortcut tambah/edit data yang paling sering dipakai.

Hindari widget statistik yang tidak membantu operasional kiosk.

## 6.3 Menu Poliklinik

Fungsi:

- Melihat daftar poli.
- Tambah poli.
- Edit poli.
- Aktif/nonaktif poli.
- Hapus poli dengan konfirmasi.
- Atur urutan tampil pada kiosk.

Field minimal:

- Nama poli.
- Singkatan/kode.
- Ikon.
- Status aktif.
- Urutan tampil.

Jangan menambah konfigurasi poli yang tidak diperlukan oleh tampilan kiosk.

## 6.4 Menu Dokter & Jadwal

Menu ini menjadi pusat pengelolaan dokter, jadwal mingguan, dan status praktik. Tidak perlu memecahnya menjadi banyak menu utama.

### Data Dokter

- Tambah dokter.
- Edit dokter.
- Upload/ganti foto.
- Aktif/nonaktif dokter.
- Pilih poli.
- Atur urutan tampil.

Field minimal:

- Nama lengkap.
- Gelar.
- Foto.
- Poli.
- Status aktif.
- Urutan tampil.

### Jadwal Mingguan

- Hari.
- Jam mulai.
- Jam selesai.
- Status aktif.
- Catatan singkat opsional.

### Status Praktik

Status praktik dikelola sebagai **sub-section** di menu Dokter & Jadwal, bukan sebagai menu utama.

Operator dapat mengubah status praktik dokter/poli menggunakan status yang tersedia, misalnya:

- Buka.
- Tutup.
- Sedang Praktik.
- Libur.
- Dibatalkan.
- Diluar Jadwal.
- Akan Datang.

Admin boleh mengelola label/status aktif bila dibutuhkan, tetapi UI harus tetap sederhana. Prioritaskan penggunaan status yang sudah tersedia daripada membuat status baru terlalu sering.

Status override manual harus memiliki prioritas terhadap perhitungan jadwal otomatis.

## 6.5 Menu Media Pengumuman

Gunakan alur sederhana sesuai bagian Media Pengumuman:

- Judul Media.
- Upload Media.
- Daftar media.
- Preview.
- Aktifkan/nonaktifkan.
- Hapus.

Tidak ada menu recorder dan tidak ada editor metadata media.

# 7. Menu Pengaturan Kiosk

Menu harus dibagi ke beberapa section agar operator tidak bingung.

## 7.1 Live Display Settings

- Nama rumah sakit.
- Subnama.
- Logo.
- Kota/kabupaten.
- Format tanggal.
- Zona waktu.
- Format jam.
- Tampilkan detik atau tidak.
- Durasi slide default.
- Durasi media gambar.
- Behavior video.
- Auto refresh data.
- Interval sinkronisasi.

## 7.2 Kiosk Customizer

- Preset skala layar: Small / Normal / Large / Custom.
- Font scale.
- Card scale.
- Header height.
- Footer height.
- Jarak antar kartu.
- Kepadatan jadwal.
- Logo size.
- Show/hide page indicator.
- Show/hide ticker.
- Show/hide announcement panel.

Gunakan CSS variables/tokens untuk konfigurasi visual, bukan style inline yang tersebar.

## 7.3 Identitas Visual

Default tema harus menyerupai referensi `Exampel.png`:

- Dominan hijau.
- Gradasi hijau → orange/amber.
- Putih sebagai warna permukaan/card.
- Orange sebagai aksen jadwal.
- Merah/pink untuk status tutup/peringatan.
- Green/teal untuk status aktif/buka.
- Background lembut putih-hijau.

Usahakan desain tetap profesional, modern, dan cocok untuk institusi kesehatan.

Warna harus disimpan sebagai design tokens.

Contoh token:

- `--primary`
- `--primary-dark`
- `--secondary`
- `--accent`
- `--success`
- `--warning`
- `--danger`
- `--surface`
- `--surface-muted`
- `--text`
- `--text-muted`
- `--border`

---

# 8. Master PIN & Kiosk Lock

## 8.1 Kiosk Lock

Setelah aplikasi berjalan dalam mode kiosk:

- Touch interaction harus dibatasi.
- User tidak boleh membuka CMS secara bebas.
- Tombol akses harus berukuran kecil namun masih dapat ditemukan oleh operator.
- Ikon lock tetap tersedia pada area header.

## 8.2 Unlock Flow

1. Operator menekan ikon lock/admin.
2. Muncul modal PIN.
3. PIN 4–8 digit.
4. PIN tidak pernah ditampilkan sebagai plaintext.
5. Bila benar, pengguna mendapatkan akses ke CMS.
6. Bila salah, tampilkan pesan error dan tetap berada di kiosk.
7. Tambahkan rate limit/backoff untuk percobaan berulang.
8. Setelah idle beberapa menit, CMS otomatis terkunci kembali.

## 8.3 Keamanan PIN

Jangan menyimpan PIN mentah di database.

Gunakan hashing yang aman. Bila menggunakan Supabase Auth, manfaatkan autentikasi admin dan gunakan PIN hanya sebagai mekanisme unlock lokal/secondary gate bila benar-benar dibutuhkan.

Master PIN bukan pengganti autentikasi backend.

---

# 9. Footer Kiosk

Footer harus menyerupai struktur referensi dengan tiga bagian:

### Informasi operasional

Contoh:

- Loket Pendaftaran Buka Pukul 08.00–12.00 WITA.
- Jadwal Sewaktu-Waktu Dapat Berubah.
- Jam Istirahat Tetap Melayani.
- Pasien BPJS Wajib Bawa Dokumen JKN.

Jumlah item dapat dikonfigurasi.

### Running Text

Tampilkan running text di bagian paling bawah.

Fitur:

- Bisa diubah dari CMS.
- Aktif/nonaktif.
- Urutan pesan.
- Kecepatan scroll.
- Arah scroll.

---

# 10. Banner Darurat

CMS harus mendukung emergency banner.

Field:

- Aktif/nonaktif.
- Judul.
- Pesan.
- Ikon.
- Level: info/warning/critical.
- Start time.
- End time.

Jika aktif:

- Banner tampil di lokasi konsisten.
- Harus terlihat tanpa menutupi informasi utama secara berlebihan.
- Prioritas visual lebih tinggi daripada konten biasa.
- Setelah emergency banner dinonaktifkan, layout kembali normal tanpa reload manual.

---

# 11. Arsitektur Teknis

## 13.1 Stack

Gunakan:

- SvelteKit.
- TypeScript.
- Supabase JS client.
- PostgreSQL via Supabase.
- Supabase Storage untuk file media.
- CSS modern + CSS variables.
- Komponen UI internal yang reusable.

Hindari dependensi UI besar kecuali benar-benar diperlukan.

---

# 12. Struktur Route

Struktur target:

```text
src/routes/
├── +page.svelte                    # entry / kiosk
├── kiosk/
│   ├── +page.svelte                # live kiosk display
│   └── components/
│       ├── KioskHeader.svelte
│       ├── DigitalClock.svelte
│       ├── PageIndicator.svelte
│       ├── PoliSection.svelte
│       ├── DoctorCard.svelte
│       ├── ScheduleBadge.svelte
│       ├── PracticeStatus.svelte
│       ├── AnnouncementSlide.svelte
│       ├── EmergencyBanner.svelte
│       ├── KioskFooter.svelte
│       └── RunningText.svelte
│
├── admin/
│   ├── +layout.svelte
│   ├── +page.svelte
│   ├── login/
│   │   └── +page.svelte
│   ├── poli/
│   ├── doctors-jadwal/
│   ├── media/
│   └── kiosk-settings/
│
└── api/                             # bila diperlukan untuk server-side actions/endpoints
```

Komponen harus dipisah berdasarkan tanggung jawab.

---

# 13. Struktur Domain/Service

Buat layer terpisah:

```text
src/lib/
├── components/
├── stores/
├── services/
│   ├── kiosk.service.ts
│   ├── poli.service.ts
│   ├── doctor.service.ts
│   ├── schedule.service.ts
│   ├── media.service.ts
│   └── settings.service.ts
├── supabase/
├── types/
├── utils/
└── constants/
```

Jangan menaruh seluruh query Supabase langsung di komponen UI.

---

# 14. Database PostgreSQL / Supabase

Buat schema yang normalized dan mudah dirawat.

## 14.1 Tabel `polyclinics`

Kolom minimal:

- `id uuid primary key`
- `name text not null`
- `code text unique`
- `icon text`
- `description text`
- `is_active boolean default true`
- `display_order integer default 0`
- `created_at timestamptz`
- `updated_at timestamptz`

## 14.2 Tabel `doctors`

- `id uuid primary key`
- `full_name text not null`
- `title text`
- `photo_url text`
- `is_active boolean default true`
- `display_order integer default 0`
- `created_at timestamptz`
- `updated_at timestamptz`

## 14.3 Tabel `doctor_polyclinics`

Relasi many-to-many bila seorang dokter dapat bertugas di lebih dari satu poli.

- `id uuid primary key`
- `doctor_id uuid references doctors(id)`
- `polyclinic_id uuid references polyclinics(id)`
- `is_primary boolean default false`

## 14.4 Tabel `weekly_schedules`

- `id uuid primary key`
- `doctor_id uuid references doctors(id)`
- `polyclinic_id uuid references polyclinics(id)`
- `day_of_week smallint`
- `start_time time`
- `end_time time`
- `is_active boolean default true`
- `note text`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraint:

`day_of_week` harus bernilai 1–7.

## 14.5 Tabel `schedule_overrides`

Untuk kondisi khusus.

- `id uuid primary key`
- `doctor_id uuid`
- `polyclinic_id uuid`
- `schedule_date date`
- `status_code text`
- `custom_message text`
- `created_at timestamptz`
- `updated_at timestamptz`

## 14.6 Tabel `practice_statuses`

- `id uuid primary key`
- `code text unique`
- `label text`
- `icon text`
- `color text`
- `is_active boolean`
- `display_order integer`

## 14.7 Tabel `media_announcements`

Simpan hanya data yang diperlukan untuk menampilkan dan mengontrol media pada kiosk.

- `id uuid primary key`
- `title text not null`
- `media_type text check in ('image','video')`
- `file_path text not null`
- `public_url text`
- `sort_order integer default 0`
- `is_active boolean default true`
- `created_at timestamptz`
- `updated_at timestamptz`

`media_type` ditentukan otomatis dari file yang diupload. Tidak perlu field deskripsi, metadata manual, recorder, jadwal tayang kompleks, thumbnail manual, atau poster manual sebagai requirement CMS.

## 14.8 Tabel `kiosk_settings`

Gunakan singleton row atau key-value configuration yang tervalidasi.

Field minimal:

- `hospital_name`
- `hospital_subtitle`
- `hospital_logo_url`
- `timezone`
- `date_format`
- `time_format`
- `slide_duration_seconds`
- `image_duration_seconds`
- `video_wait_for_end`
- `refresh_interval_seconds`
- `font_scale`
- `card_scale`
- `header_scale`
- `footer_scale`
- `show_page_indicator`
- `show_running_text`
- `show_footer_notices`
- `show_emergency_banner`
- `emergency_title`
- `emergency_message`
- `emergency_level`
- `running_text`
- `running_text_speed`
- `running_text_direction`
- `master_pin_hash`

## 14.9 Tabel `footer_notices`

- `id uuid primary key`
- `title text`
- `icon text`
- `is_active boolean`
- `display_order integer`

## 14.10 Tabel `admin_profiles`

Bila diperlukan untuk role management:

- `id uuid references auth.users(id)`
- `full_name text`
- `role text check in ('admin','operator')`
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

---

# 15. Supabase Security

Wajib menggunakan **Row Level Security (RLS)**.

Prinsip:

- Kiosk hanya membaca data publik yang diperlukan.
- Admin/operator yang terautentikasi dapat melakukan write sesuai role.
- Data admin tidak boleh dapat ditulis dari anonymous client.
- Storage bucket media harus memiliki policy yang sesuai.
- Jangan menaruh service role key di frontend.
- Gunakan environment variables.

Environment target:

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Service role hanya boleh digunakan server-side bila benar-benar diperlukan.

---

# 16. State & Data Refresh

Kiosk perlu melakukan refresh data otomatis.

Default:

- Polling/sync setiap 30–60 detik, configurable.
- Saat aplikasi dibuka, fetch data terbaru.
- Setelah operator menyimpan perubahan dari CMS, data kiosk dapat diperbarui tanpa menunggu reload penuh.
- Bila memungkinkan gunakan Supabase Realtime untuk perubahan penting seperti status praktik dan emergency banner.

Untuk mencegah flickering:

- Jangan reset seluruh state saat polling.
- Update hanya data yang berubah.
- Gunakan loading skeleton hanya saat initial load.
- Setelah initial load, perubahan data harus terasa halus.

---

# 17. Algoritma Jadwal Kiosk

Server/data layer menyediakan view-model yang siap dipresentasikan.

Untuk setiap dokter:

1. Ambil poli.
2. Ambil jadwal hari ini.
3. Cari override untuk tanggal hari ini.
4. Tentukan status menggunakan prioritas override.
5. Bila tidak ada override, cek apakah hari ini adalah hari praktik.
6. Bila hari praktik, cek rentang jam.
7. Hasilkan status presentasi.

Contoh hasil:

```ts
{
  doctorId: '...',
  doctorName: 'dr. Contoh, Sp.PD',
  clinicName: 'Penyakit Dalam',
  scheduleLabel: 'Selasa · 09:00–13:00',
  statusCode: 'OPEN',
  statusLabel: 'BUKA',
  isToday: true
}
```

Perhitungan waktu harus mengikuti timezone yang disimpan di settings, default `Asia/Makassar` bila deployment RSUD menggunakan WITA.

---

# 18. Responsive / Screen Specification

Target utama:

- Portrait 9:16.
- TV 55 inch.
- Android OS.
- Browser Chromium modern.

CSS harus menggunakan pendekatan fluid.

Gunakan:

- `clamp()` untuk ukuran teks.
- CSS grid/flex.
- CSS variables untuk scaling.
- `100dvh` dengan fallback yang sesuai.
- Safe spacing untuk edge layar.

Target logical sizes:

- 1080 × 1920 sebagai baseline desain portrait.
- Harus tetap layak pada resolusi lebih kecil seperti 720 × 1280.

Jangan mengunci ukuran dengan pixel berlebihan.

---

# 19. Design System

## 19.1 Visual direction

Tiru prinsip visual referensi:

- Header dengan gradasi hijau–orange.
- Card putih dengan shadow lembut.
- Border tipis.
- Radius cukup besar.
- Badge poli berbentuk pill.
- Badge jadwal berbentuk pill kecil.
- Status praktik sangat mudah ditemukan.
- Ikon sederhana dan konsisten.
- Background overall sangat terang.
- Footer dark untuk running text.

## 19.2 Typography

Font harus modern, bersih, dan sangat mudah dibaca.

Prioritas:

- Heading tegas.
- Nama dokter medium/bold.
- Jadwal cukup besar untuk dibaca dari kejauhan.
- Informasi kecil jangan menggunakan ukuran yang terlalu kecil.

## 19.3 Accessibility

- Kontras teks harus baik.
- Jangan menyampaikan status hanya melalui warna.
- Ikon diberi label/aria bila interaktif.
- Touch target admin minimal 44px logical size.

---

# 20. CMS UX

CMS harus dirancang untuk operator non-programmer.

Prinsip:

- Form sederhana.
- Label jelas dalam Bahasa Indonesia.
- Default value masuk akal.
- Konfirmasi untuk aksi destruktif.
- Toast setelah save/delete.
- Error message yang mudah dipahami.
- Preview media sebelum diaktifkan.
- Draft/published behavior bila dibutuhkan.

Gunakan Bahasa Indonesia untuk seluruh UI CMS, kecuali istilah teknis yang memang lebih jelas.

---

# 21. Logging & Audit

Audit log bersifat opsional pada backend dan **bukan menu utama CMS**. Prioritaskan fungsi operasional terlebih dahulu.

Contoh aksi:

- Login.
- Ubah jadwal.
- Ubah status praktik.
- Upload media.
- Aktifkan emergency banner.
- Ubah setting kiosk.
- Ubah PIN.

Field log minimal:

- user_id
- action
- entity_type
- entity_id
- old_value jsonb
- new_value jsonb
- created_at

---

# 22. Error Handling

## Kiosk

Jika database gagal:

- Tampilkan data cache terakhir.
- Tampilkan indikator kecil `Data terakhir diperbarui ...`.
- Jangan menampilkan error teknis kepada pasien.

Jika media gagal:

- Gunakan fallback.
- Lewati media yang rusak.

Jika video gagal autoplay:

- Tampilkan poster.
- Jika gagal dalam timeout tertentu, lanjut ke slide berikutnya.

## CMS

Jika request gagal:

- Tampilkan pesan yang jelas.
- Pertahankan input form.
- Jangan menghapus data form yang belum tersimpan.

---

# 23. Performance

Target:

- Initial kiosk render cepat.
- Gambar menggunakan lazy loading jika tidak sedang digunakan.
- Media video tidak semua di-download sekaligus.
- Preview/thumbnail dapat dibuat otomatis oleh sistem hanya bila dibutuhkan untuk tampilan preview; operator tidak perlu mengelolanya secara manual.
- Query hanya mengambil field yang dibutuhkan.
- Index database dibuat pada field pencarian/jadwal yang relevan.

Khusus kiosk:

- Minimalkan JS yang tidak diperlukan.
- Hindari animasi berat.
- Hindari memory leak dari timer/video event.
- Pastikan timer slideshow dibersihkan saat komponen unmount.

---

# 24. Offline / Recovery Strategy

Buat mekanisme ringan untuk menyimpan data kiosk terakhir:

- IndexedDB/localStorage untuk metadata JSON yang aman.
- Cache URL media yang masih valid bila memungkinkan.
- Simpan timestamp sync terakhir.

Saat online kembali:

1. Kiosk melakukan sync.
2. Data lokal diganti data terbaru.
3. Slide dihitung ulang.
4. Tidak memerlukan restart browser.

---

# 25. Navigation & Access Control

Public:

- `/kiosk`

Protected:

- `/admin`
- `/admin/poli`
- `/admin/doctors-jadwal`
- `/admin/media`
- `/admin/kiosk-settings`

Guard semua route admin.

Unauthorized user harus diarahkan ke `/admin/login`.

---

# 26. Initial Seed Data

Sediakan seed data untuk development:

Poli contoh:

- Jantung & Pembuluh Darah.
- Kesehatan Jiwa.
- Keluarga Berencana (KB).
- Kulit & Kelamin.

Dokter contoh harus bersifat dummy.

Jangan gunakan data pasien.

Jadwal contoh:

- Senin–Jumat.
- Jam berbeda-beda.
- Status dinamis.

Tambahkan minimal 6–8 slide agar pagination dapat diuji.

---

# 27. API / Server Contracts

Buat service method terstruktur, contoh:

```ts
getKioskDisplayData()
getTodaySchedules()
getActiveMedia()
getKioskSettings()
getFooterNotices()
getActiveEmergencyBanner()

createPolyclinic()
updatePolyclinic()
deletePolyclinic()

createDoctor()
updateDoctor()
updateDoctorSchedule()
setPracticeStatus()

uploadAnnouncementMedia()
toggleAnnouncementMedia()
deleteAnnouncementMedia()
previewAnnouncementMedia()

updateKioskSettings()
updateRunningText()
updateEmergencyBanner()
```

Nama method dapat disesuaikan implementasi, namun tanggung jawab harus tetap terpisah.

---

# 28. Urutan Pengerjaan WAJIB

Pengerjaan harus dilakukan **berurutan**. Jangan membangun semua fitur sekaligus.

Setiap fase harus menghasilkan aplikasi yang dapat dijalankan.

---

## PHASE 0 — Project Foundation

### Tujuan
Membuat fondasi project.

### Tasks

- Inisialisasi SvelteKit + TypeScript.
- Setup linting/formatting.
- Setup environment variables.
- Setup struktur folder.
- Setup Supabase client.
- Setup routing dasar.
- Setup design token dasar.
- Tambahkan README setup.

### Output

Project dapat dijalankan lokal.

### Acceptance Criteria

- `npm install` berhasil.
- `npm run dev` berhasil.
- Tidak ada error TypeScript.
- Route `/kiosk` dan `/admin/login` tersedia.

---

## PHASE 1 — Design System & Kiosk Shell

### Tujuan
Membangun kerangka visual menyerupai `Exampel.png` tanpa database dahulu.

### Tasks

- Kiosk background.
- Header.
- Logo placeholder.
- Digital clock.
- Page indicator.
- Title bar.
- Footer.
- Running text.
- Emergency banner placeholder.
- Responsive portrait layout.

### Output

Static kiosk shell terlihat mendekati referensi.

### Acceptance Criteria

- 1080×1920 terlihat rapi.
- Tidak ada horizontal scroll.
- Header/footer stabil.
- Typography terbaca.

---

## PHASE 2 — Static Schedule Components

### Tujuan
Membuat komponen jadwal dengan dummy data.

### Tasks

- Poli section.
- Doctor card.
- Schedule badges.
- Practice status.
- Empty state.
- Multiple doctors.
- Multiple poli.

### Acceptance Criteria

- Tampilan mendekati struktur referensi.
- Data dokter dapat berubah dari array/type tanpa mengubah markup.
- Status visual konsisten.

---

## PHASE 3 — Slideshow Engine

### Tujuan
Membuat kiosk dapat berganti halaman otomatis.

### Tasks

- Slide model.
- Timer.
- Page indicator.
- Transition.
- Pause/resume internal.
- Video slide lifecycle.
- Cleanup timer.

### Acceptance Criteria

- Slide berpindah otomatis.
- Gambar menunggu durasi tertentu.
- Video menunggu `ended` sebelum lanjut.
- Error video tidak membuat kiosk stuck.

---

## PHASE 4 — Supabase Database & RLS

### Tujuan
Menghubungkan data nyata.

### Tasks

- Buat migration SQL.
- Buat semua tabel inti.
- Foreign keys.
- Index.
- Seed data development.
- RLS.
- Policies.
- Supabase Storage bucket.

### Acceptance Criteria

- Migration dapat dijalankan ulang tanpa konflik.
- Data dapat di-query.
- Anonymous kiosk hanya dapat membaca data publik yang diperlukan.
- Write tidak dapat dilakukan tanpa auth/role yang sesuai.

---

## PHASE 5 — Kiosk Data Integration

### Tujuan
Mengganti dummy data dengan data PostgreSQL/Supabase.

### Tasks

- Service layer.
- Query polyclinics.
- Query doctors.
- Query schedules.
- Status engine.
- Settings.
- Footer notices.
- Emergency banner.

### Acceptance Criteria

- Perubahan data di database tercermin di kiosk.
- Tidak ada hard-coded schedule pada UI production.
- Kiosk tetap usable saat data kosong.

---

## PHASE 6 — Admin Authentication & Kiosk Lock

### Tujuan
Mengamankan akses dashboard.

### Tasks

- Supabase Auth login.
- Admin/operator roles.
- Route protection.
- Kiosk PIN modal.
- Lock/unlock state.
- Auto lock timeout.
- Rate limit/backoff.

### Acceptance Criteria

- Guest tidak dapat membuka admin.
- PIN salah tidak membuka CMS.
- PIN benar membuka akses sesuai role.
- Kiosk kembali terkunci setelah timeout.

---

## PHASE 7 — CMS Core: Poli, Dokter, Jadwal, Status

### Tujuan
Operator dapat mengelola data utama.

### Tasks

- CRUD Poli.
- CRUD Dokter.
- Upload foto dokter.
- CRUD weekly schedules.
- Schedule override.
- Status configuration.
- Sorting.

### Acceptance Criteria

- Operator dapat menambah poli.
- Operator dapat menambah dokter.
- Operator dapat mengubah jadwal mingguan.
- Operator dapat mengubah status praktik.
- Perubahan tampil pada kiosk.

---

## PHASE 8 — CMS Media Pengumuman

### Tujuan
Membuat pengelolaan media pengumuman yang sangat sederhana.

### Tasks

- Buat menu `Media Pengumuman`.
- Form hanya berisi `Judul Media` dan `Upload Media`.
- Deteksi otomatis image/video dari file.
- Upload ke Supabase Storage.
- Simpan record ke PostgreSQL.
- Tampilkan daftar media dalam bentuk card/table sederhana.
- Tambahkan Preview.
- Tambahkan Aktifkan/Nonaktifkan.
- Tambahkan Hapus dengan konfirmasi.
- Pastikan hanya media aktif masuk ke slideshow.
- Hilangkan fitur edit metadata dan recorder.

### Acceptance Criteria

- Operator dapat mengupload media gambar/video tanpa mengisi field teknis tambahan.
- Media dapat dipreview.
- Media dapat diaktifkan/nonaktifkan.
- Media dapat dihapus.
- Media nonaktif tidak tampil pada kiosk.
- Tidak ada menu recorder atau editor metadata media.

## PHASE 9 — Kiosk Settings & Customizer

### Tujuan
Semua identitas dan parameter kiosk dapat diubah tanpa kode.

### Tasks

- Identitas RSUD.
- Logo.
- Tema/warna.
- Skala preset.
- Slide duration.
- Refresh interval.
- Emergency banner.
- Running text.
- Footer notices.
- Page indicator.

### Acceptance Criteria

- Pengaturan tersimpan di database.
- Kiosk mengadopsi pengaturan tanpa deploy ulang.
- Reset/default setting tersedia.

---

## PHASE 10 — Polish, Resilience & UX

### Tujuan
Merapikan aplikasi untuk penggunaan nyata.

### Tasks

- Loading states.
- Empty states.
- Error states.
- Toast notifications.
- Confirm dialogs.
- Skeleton.
- Offline fallback.
- Cache.
- Performance tuning.
- Memory leak checks.
- Mobile/tablet-safe CMS.
- Fullscreen kiosk mode behavior.

### Acceptance Criteria

- Kiosk tidak berhenti setelah berjalan berjam-jam.
- Tidak ada overflow layout.
- Timer/video tidak menumpuk.
- Error backend tidak merusak seluruh UI.

---

# 31. PHASE 11 — Testing

Testing wajib dilakukan setelah semua fitur utama selesai.

## 31.1 Unit Testing

Test:

- schedule calculation.
- status priority.
- slide transition rules.
- date/time formatting.
- validation.

## 31.2 Integration Testing

Test:

- Supabase fetch.
- CRUD poli.
- CRUD doctor.
- schedule updates.
- media upload.
- settings update.
- auth.

## 31.3 E2E Testing

Skenario minimal:

1. Login admin.
2. Tambah poli.
3. Tambah dokter.
4. Buat jadwal.
5. Ubah status jadi `LIBUR`.
6. Pastikan kiosk berubah.
7. Upload gambar.
8. Upload video.
9. Pastikan video menunggu selesai.
10. Ubah running text.
11. Aktifkan emergency banner.
12. Logout.
13. Pastikan akses admin kembali terkunci.

## 31.4 Visual Testing

Bandingkan dengan referensi `Exampel.png` pada:

- Header.
- Card spacing.
- Warna gradient.
- Hierarki teks.
- Status badge.
- Footer.
- Pagination.
- Density konten.

## 31.5 Kiosk Soak Test

Minimal lakukan simulasi berjalan terus:

- 1 jam.
- 4 jam.
- 8 jam.

Periksa:

- memory growth.
- timer duplication.
- video playback.
- network recovery.
- UI freeze.
- layout shift.

---

# 32. Definition of Done

Project dianggap selesai bila semua poin berikut terpenuhi:

- Kiosk menampilkan jadwal poli secara dinamis.
- Dokter dan foto dapat dikelola dari CMS.
- Jadwal mingguan dapat dikelola dari CMS.
- Status praktik dapat diubah dari CMS.
- Poli dapat ditambah/edit/nonaktifkan.
- Media gambar/video dapat dikelola dari CMS.
- Video menunggu sampai selesai sebelum slide berpindah.
- Running text dapat diubah.
- Footer notices dapat diubah.
- Emergency banner dapat diubah.
- Pengaturan visual dapat diubah.
- Master PIN tersedia untuk lock/unlock kiosk.
- Admin dashboard menggunakan auth.
- RLS Supabase diterapkan.
- Kiosk memiliki fallback saat backend bermasalah.
- Layout stabil pada portrait 1080×1920.
- Tidak ada data sensitif pasien.
- Testing utama selesai dan lulus.

---

# 33. Non-Functional Requirements

## Reliability

Aplikasi harus mampu beroperasi dalam waktu lama tanpa restart browser secara rutin.

## Security

- Auth admin.
- RLS.
- Secure storage policies.
- Tidak membocorkan service role key.
- PIN tidak plaintext.

## Maintainability

- TypeScript strict.
- Komponen kecil dan reusable.
- Service layer.
- Database migration.
- README.

## Scalability

Arsitektur harus mudah ditambah:

- Banyak poli.
- Banyak dokter.
- Banyak media.
- Banyak kiosk.

---

# 34. Future-ready Features

Tidak wajib untuk versi pertama, tetapi arsitektur harus memungkinkan:

- Multi-kiosk dengan `kiosk_id`.
- Pengaturan berbeda per lokasi/kiosk.
- Multi bahasa.
- QR code untuk detail jadwal.
- Integrasi nomor antrean.
- Realtime status dokter.
- Statistik penggunaan kiosk.
- Playlist berbeda berdasarkan jam.
- Jadwal khusus hari libur nasional.

Jangan mengimplementasikan fitur future-ready sebelum fitur inti selesai.

---

# 35. Instruksi Khusus Untuk AI Coding Agent / Antigravity

Ikuti instruksi ini dengan ketat:

1. **Kerjakan proyek secara bertahap sesuai PHASE 0 → PHASE 11.**
2. Jangan melewati fase.
3. Setelah setiap fase, pastikan project masih dapat dijalankan.
4. Jangan mengganti stack dari SvelteKit + TypeScript + Supabase.
5. Jangan hard-code data jadwal production di komponen.
6. Semua data utama harus berasal dari database/service layer.
7. Jangan menaruh Supabase service role key di browser.
8. Gunakan Bahasa Indonesia pada CMS.
9. Kiosk harus menjadi tampilan paling stabil dan ringan.
10. Pertahankan design system agar seluruh halaman konsisten.
11. Jangan membuat dashboard dengan gaya visual yang terlalu berbeda dari kiosk.
12. Gunakan reusable components.
13. Tambahkan validation pada form.
14. Tambahkan loading/error/empty states.
15. Setiap perubahan database harus melalui migration.
16. Setiap fitur baru wajib memiliki acceptance criteria yang dapat diuji.
17. Sebelum masuk fase berikutnya, jalankan lint/typecheck/test yang tersedia.
18. Jangan menghapus fitur yang telah selesai pada fase sebelumnya.
19. Jika terjadi konflik requirement, prioritaskan keamanan, konsistensi data, dan stabilitas kiosk.
20. Jangan menambahkan menu dashboard baru di luar 5 menu utama tanpa kebutuhan yang jelas dan persetujuan requirement. Fitur kecil harus ditempatkan sebagai sub-section pada menu yang sudah ada.
21. Pada Media Pengumuman, jangan membuat field atau aksi tambahan selain requirement yang ditetapkan: Judul Media, Upload Media, Preview/Tampilkan, Aktifkan/Nonaktifkan, dan Hapus.
22. Setelah PHASE 11, buat ringkasan testing: PASS/FAIL, bug yang ditemukan, dan bug yang tersisa.

---

# 36. Prioritas Implementasi

Gunakan prioritas berikut bila waktu terbatas:

### P0 — wajib

- Live kiosk.
- Poli.
- Dokter.
- Jadwal.
- Status praktik.
- Supabase/PostgreSQL.
- CMS.
- Media image/video.
- PIN lock.
- Kiosk settings dasar.

### P1 — penting

- Realtime/sync.
- Emergency banner.
- Running text.
- Offline fallback.
- Audit log.
- Visual customization.

### P2 — pengembangan lanjutan

- Multi-kiosk.
- QR code.
- Statistik.
- Playlist berbasis waktu.
- Integrasi antrean.

---

# 37. Output Yang Diharapkan Dari Antigravity

Pada akhir implementasi, repository minimal memiliki:

```text
README.md
PRD.md
package.json
svelte.config.*
vite.config.*
.env.example
supabase/
  migrations/
  seed.sql
src/
  lib/
  routes/
  styles/
```

README wajib menjelaskan:

- Setup project.
- Environment variables.
- Setup Supabase.
- Menjalankan migration.
- Seed database.
- Menjalankan development.
- Build production.
- Deployment.
- Cara membuka `/kiosk`.
- Cara login CMS.
- Cara melakukan reset data development.

---

# 38. Final Test Checklist

Sebelum dianggap siap deploy, centang semua:

- [ ] Build production berhasil.
- [ ] Typecheck berhasil.
- [ ] Lint berhasil.
- [ ] Test berhasil.
- [ ] Login admin berhasil.
- [ ] Kiosk route dapat dibuka.
- [ ] Jadwal tampil.
- [ ] Status praktik tampil.
- [ ] Perubahan jadwal dari CMS tampil di kiosk.
- [ ] Foto dokter tampil.
- [ ] Poli baru tampil.
- [ ] Gambar pengumuman tampil.
- [ ] Video pengumuman tampil.
- [ ] Video menunggu selesai.
- [ ] Pagination benar.
- [ ] Running text berjalan.
- [ ] Footer notices tampil.
- [ ] Emergency banner dapat diaktifkan.
- [ ] PIN lock berfungsi.
- [ ] Admin route terproteksi.
- [ ] RLS aktif.
- [ ] Storage policy aman.
- [ ] Tidak ada service key pada client.
- [ ] Offline fallback dasar berjalan.
- [ ] Tampilan portrait 1080×1920 stabil.
- [ ] Soak test lulus.

---

# 39. Catatan Implementasi UI Berdasarkan Referensi

Gunakan `Exampel.png` sebagai **visual reference**, bukan sebagai source code yang harus disalin mentah.

Elemen yang perlu dipertahankan sebagai karakter utama:

- Header gradient hijau-orange.
- Logo kiri.
- Nama RSUD dan informasi tanggal.
- Jam digital besar di kanan.
- Ikon lock/admin.
- Judul `JADWAL POLIKLINIK`.
- Page counter.
- Section poli berbentuk badge/pill.
- Doctor card horizontal.
- Foto dokter di sisi kiri card.
- Chip jadwal hari/jam.
- Status praktik di sisi kanan card.
- Pagination di bawah konten.
- Notice cards pada footer.
- Running text paling bawah.

Namun, implementasi final harus memperbaiki readability, spacing, contrast, dan responsivitas bila diperlukan untuk layar TV 55 inch.

---

# 40. Kesimpulan

Produk akhir adalah **Digital Kiosk Informasi Jadwal Poliklinik RSUD** yang:

- terlihat modern dan profesional,
- mudah dibaca pada TV portrait 55 inch,
- seluruh data terkontrol lewat CMS,
- menggunakan SvelteKit + TypeScript,
- menggunakan PostgreSQL melalui Supabase,
- memiliki media announcement image/video,
- memiliki kiosk lock berbasis PIN,
- memiliki konfigurasi visual terpusat,
- aman dengan Supabase Auth + RLS,
- dan dikembangkan secara bertahap dari foundation hingga testing.

**End of PRD**
