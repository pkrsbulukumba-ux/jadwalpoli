# PANDUAN OPERASIONAL KIOSK JADWAL POLIKLINIK RSUD
### Buku Petunjuk Praktis untuk Petugas Poliklinik & Teknisi IT Rumah Sakit

Dokumen ini disusun khusus sebagai panduan operasional harian bagi staf administrasi, petugas informasi poliklinik, dan teknisi perangkat TV Kiosk RSUD.

---

## 📌 DAFTAR ISI
1. [Pengenalan Singkat Tampilan Layar Kiosk](#1-pengenalan-singkat-tampilan-layar-kiosk)
2. [Prosedur Harian Menyalakan & Mematikan TV Kiosk](#2-prosedur-harian-menyalakan--mematikan-tv-kiosk)
3. [Cara Membuka Kunci Touchscreen Kiosk (Masuk ke CMS)](#3-cara-membuka-kunci-touchscreen-kiosk-masuk-ke-cms)
4. [Update Cepat Status Praktik Dokter 1-Klik (Quick Action)](#4-update-cepat-status-praktik-dokter-1-klik-quick-action)
5. [Menambah & Mengubah Jadwal Praktik Dokter](#5-menambah--mengubah-jadwal-praktik-dokter)
6. [Pengelolaan Media Gambar & Video (Opsi Video Lokal TV)](#6-pengelolaan-media-gambar--video-opsi-video-lokal-tv)
7. [Penyesuaian Ukuran Layar TV (Rentang 43" hingga 55" Inch)](#7-penyesuaian-ukuran-layar-tv-rentang-43-hingga-55-inch)
8. [Penanganan Gangguan Internet (Mode Siaga Offline Otomatis)](#8-penanganan-gangguan-internet-mode-siaga-offline-otomatis)
9. [Mengaktifkan Banner Pengumuman Darurat & Teks Berjalan](#9-mengaktifkan-banner-pengumuman-darurat--teks-berjalan)
10. [Mengganti Master PIN Touchscreen](#10-mengganti-master-pin-touchscreen)

---

## 1. Pengenalan Singkat Tampilan Layar Kiosk

Layar Kiosk RSUD dirancang vertikal (*portrait 9:16*) untuk memudahkan pasien membaca dari jarak 2–5 meter.
- **Header Atas**: Menampilkan logo RSUD, nama rumah sakit, badge hari & tanggal, suhu cuaca, jam digital detik realtime, dan indikator status siaga.
- **Badan Jadwal**: Menampilkan kartu poliklinik oranye dengan foto dokter spesialis, gelar, jam buka praktik (format 24 jam), serta pill status praktik (🟢 **BUKA**, 🟡 **ISTIRAHAT**, 🔴 **TUTUP**, ⚪ **LIBUR/CUTI**).
- **Slide Pengumuman**: Secara bergantian menampilkan poster edukasi dan video layanan bersuara.
- **Footer Bawah**: Berisi 4 kartu notisi operasional (loket pendaftaran, BPJS Mobile JKN, dll.) dan pita teks berjalan (*running text*) informasi pengaduan rumah sakit di bagian paling dasar.

---

## 2. Prosedur Harian Menyalakan & Mematikan TV Kiosk

### A. Menyalakan TV di Pagi Hari
1. Nyalakan TV Kiosk menggunakan tombol daya remote control.
2. Pastikan TV terhubung ke jaringan listrik dan Wi-Fi/LAN rumah sakit.
3. Aplikasi Kiosk akan otomatis terbuka jika browser Kiosk (*Fully Kiosk Browser* / *Kiosk Mode App*) telah diatur autostart.
4. Jika browser tidak terbuka otomatis:
   - Buka aplikasi browser di Smart TV Android.
   - Buka bookmark: `http://[IP-SERVER-RSUD]:5173/kiosk` (atau alamat website Kiosk RSUD).
   - Masuk ke mode Layar Penuh (*Fullscreen*).

### B. Mematikan TV di Sore Hari
1. Matikan daya TV Kiosk menggunakan remote control setelah jam pelayanan poliklinik selesai.
2. Seluruh data jadwal tersimpan aman di database dan akan otomatis terisi kembali saat TV dinyalakan keesokan harinya.

---

## 3. Cara Membuka Kunci Touchscreen Kiosk (Masuk ke CMS)

Layar Kiosk publik dilindungi oleh sistem pengunci layar sentuh agar pengunjung tidak dapat mengubah pengaturan:

1. Pada layar Kiosk, sentuh ikon **Gembok (Lock)** di pojok kanan atas samping jam digital.
2. Layar akan menampilkan **Virtual Keypad Touchscreen PIN**.
3. Ketikkan **Master PIN**:
   - **PIN Default Pabrik**: `1234`
4. Tekan tombol centang **Buka Kunci**.
5. Anda akan langsung dialihkan ke **CMS Dashboard Pengelolaan Rumah Sakit**.

> [!WARNING]
> **Proteksi Keamanan**: Jika salah memasukkan PIN sebanyak **5 kali berturut-turut**, sistem akan mengunci layar keypad selama **30 detik**. Layar CMS juga akan otomatis terkunci kembali jika tidak ada sentuhan selama **5 menit** (*Auto-Lock Idle*).

---

## 4. Update Cepat Status Praktik Dokter 1-Klik (Quick Action)

Jika ada dokter spesialis yang berhalangan hadir mendadak, terlambat, atau sedang istirahat:

1. Masuk ke CMS Dashboard -> Buka menu **Dokter & Jadwal**.
2. Pada tab **Status Praktik Hari Ini**, temukan nama dokter yang bersangkutan.
3. Klik tombol aksi cepat 1-klik di sebelah kanan nama dokter:
   - `[Buka Sekarang]`: Langsung menyetel status dokter menjadi **BUKA** hijau.
   - `[Istirahat]`: Menyetel status menjadi **ISTIRAHAT** kuning (jam istirahat pelayanan).
   - `[Cuti / Libur]`: Menyetel status menjadi **LIBUR / CUTI** abu-abu.
   - `[Buka Lebih Awal]`: Mengizinkan pelayanan dibuka lebih cepat dari jadwal rutin.
   - `[Kembali ke Otomatis]`: Menghapus status manual dan mengembalikan dokter ke perhitungan jam otomatis.
4. Perubahan akan **langsung terlihat seketika di layar TV Kiosk** tanpa perlu memuat ulang (*refresh*) halaman.

---

## 5. Menambah & Mengubah Jadwal Praktik Dokter

1. Buka menu **Dokter & Jadwal** -> Pilih tab **Jadwal Mingguan**.
2. Pilih nama dokter dan poliklinik yang dituju.
3. Pilih hari praktik (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu).
4. Masukkan jam mulai dan jam selesai (contoh: `08:00` sampai `12:00`).
5. Klik **Simpan Jadwal**.

---

## 6. Pengelolaan Media Gambar & Video (Opsi Video Lokal TV)

Aplikasi Kiosk mendukung pemutaran poster gambar dan video edukasi kesehatan yang disisipkan di antara slide jadwal:

1. Buka menu **Media Pengumuman** (`/admin/media`).
2. Klik tombol **+ Tambah Media Baru**.
3. Tentukan jenis media: **Gambar** atau **Video**.
4. **Pilih Jalur Penyimpanan**:
   - **Opsi 1 — Local TV Storage (`local_path`) [DIREKOMENDASIKAN UNTUK VIDEO BESAR]**:
     Jika Anda memiliki video promosi/edukasi berukuran besar (>50MB), simpan file video di flashdisk atau memori internal Android TV (misal: `/sdcard/Movies/edukasi-rsud.mp4` atau `file:///sdcard/Download/video.mp4`). Masukkan jalur tersebut pada kolom yang disediakan.
     *Keuntungan*: Tidak menghabiskan kuota internet rumah sakit dan video berputar mulus tanpa jeda buffering!
   - **Opsi 2 — URL Online**: Masukkan tautan link video/gambar dari internet (misal: link CDN atau cloud).
   - **Opsi 3 — Upload Berkas**: Unggah langsung file dari komputer/laptop operator.
5. Tentukan urutan tampil dan pastikan toggle **Aktif** menyala.
6. Klik **Simpan Media**.

---

## 7. Penyesuaian Ukuran Layar TV (Rentang 43" hingga 55" Inch)

Setiap unit monitor TV vertikal di rumah sakit memiliki ukuran fisik yang berbeda (rentang 43" hingga 55" inch). Anda dapat menyesuaikan proporsi teks agar tetap proporsional:

1. Buka menu **Pengaturan Kiosk** -> Pilih tab **Skala TV (43"–55")**.
2. Pilih salah satu preset instan:
   - **Preset Layar 43" (Kompak 0.9x)**: Merapatkan kartu jadwal sehingga muat lebih banyak dokter pada monitor 43 inch vertikal.
   - **Preset Standar (1.0x)**: Pengaturan seimbang untuk monitor 48"–50" inch.
   - **Preset Layar 50"–55" (Ekstra Besar 1.15x)**: Memperbesar teks dan badge jadwal untuk monitor TV 55 inch agar terbaca jelas dari kejauhan.
3. Atau geser slider kustom untuk mengatur skala huruf, kartu dokter, header, dan footer sesuai keinginan.
4. Klik tombol **Terapkan Skala Tampilan**. Tampilan layar Kiosk langsung menyesuaikan secara instan.

---

## 8. Penanganan Gangguan Internet (Mode Siaga Offline Otomatis)

Jika jaringan internet rumah sakit padam:
- **Layar Kiosk TIDAK AKAN Padam / Blank**: Sistem dilengkapi Service Worker dan Snapshot Cadangan Lokal.
- Kiosk akan terus berputar menampilkan data jadwal dan dokter yang terakhir kali tersimpan.
- Pada header Kiosk akan muncul badge diskret:
  `⚠️ Mode Siaga Offline (Tersinkron: 08:30 WITA)`
- Begitu koneksi internet pulih kembali, badge akan hilang dengan sendirinya dan data otomatis terbarui secara halus tanpa kedipan (*zero flicker*).

---

## 9. Mengaktifkan Banner Pengumuman Darurat & Teks Berjalan

### A. Menyalakan Banner Darurat
Bila ada pengumuman mendesak (misal: *Poli Mata tutup lebih awal karena rapat koordinasi akreditasi*):
1. Buka menu **Pengaturan Kiosk** -> Pilih tab **Banner Darurat**.
2. Aktifkan toggle **Tampilkan Banner Darurat**.
3. Pilih tingkat kepentingan:
   - 🔵 **Informasi (Biru)**: Pemberitahuan umum.
   - 🟠 **Peringatan (Oranye)**: Pengumuman penting layanan.
   - 🔴 **Kritis / Darurat (Merah)**: Kondisi darurat rumah sakit.
4. Ketikkan judul dan isi pesan lengkap.
5. Klik **Simpan Pengaturan Darurat**. Banner akan langsung membentang di bagian atas kartu jadwal Kiosk.

### B. Mengubah Teks Berjalan (Running Text)
1. Buka menu **Pengaturan Kiosk** -> Pilih tab **Teks Berjalan (Ticker)**.
2. Ubah isi teks informasi kontak, pengaduan, atau motto rumah sakit.
3. Atur kecepatan gerak teks sesuai kenyamanan membaca pasien.
4. Klik **Simpan Teks Berjalan**.

---

## 10. Mengganti Master PIN Touchscreen

Untuk menjaga keamanan Kiosk dari akses yang tidak berwenang:
1. Buka menu **Pengaturan Kiosk** -> Pilih tab **Keamanan & PIN**.
2. Masukkan PIN lama saat ini (Bawaan awal: `1234`).
3. Masukkan PIN baru (4 hingga 8 digit angka numerik).
4. Masukkan kembali konfirmasi PIN baru.
5. Klik tombol **Perbarui Master PIN**.
6. Simpan PIN baru tersebut di tempat yang aman dan hanya bagikan kepada petugas resmi poliklinik.

---

*Buku Panduan Operasional Kiosk RSUD H. Andi Sulthan Daeng Radja — Sistem Informasi Manajemen Rumah Sakit (SIMRS)*
