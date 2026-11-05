# Product Requirement Document (PRD)
# Logistik Cikembar (LogistikApps) — Sistem Operasional & Manajemen Pergudangan Terintegrasi

---

## 1. Identitas Dokumen & Metadata

* **Nama Produk**: Logistik Cikembar (LogistikApps)
* **Versi Dokumen**: 2.5 (Comprehensive Production Edition)
* **Kategori**: Warehouse Management System (WMS) & Logistics Execution Platform
* **Target Pengguna**: Supervisor Gudang, Tim Inbound/Kedatangan, Petugas Tally, Tim QC (Quality Control), Tim Staging & Picking Outbound, Tim Inventory Control, Petugas Sampel, dan Kepala Gudang.
* **Klasifikasi Distribusi**: Dokumen Teknis & Operasional Internal

---

## 2. Ringkasan Eksekutif & Visi Produk

**Logistik Cikembar (LogistikApps)** adalah platform manajemen pergudangan modern berbasis web (Progressive Web Application - PWA) yang dirancang khusus untuk memecahkan tantangan operasional pergudangan pada industri *Fast-Moving Consumer Goods (FMCG)*, farmasi, dan distribusi ritel.

Aplikasi ini mengintegrasikan seluruh rantai operasional gudang dari hulu ke hilir:
1. **Otomatisasi Urai Kode Batch & Tanggal Kedaluwarsa**: Mengeliminasi kesalahan manusia dalam membaca kode batch alfanumerik pabrik melalui algoritma *Unix Day of Year (DOY)*.
2. **Pencatatan Cepat & Tanpa Ketik (Hands-Free Inbound)**: Penggunaan *Speech-to-Text* (input suara bahasa Indonesia) yang mengenali nama distributor, produk, dan nomor batch secara akurat di lantai gudang.
3. **Cetak Label Mandiri Tanpa Lisensi Pihak Ketiga**: Kompatibilitas langsung dengan printer industri *Honeywell PM42* (ukuran 80x100mm landscape) menggunakan *Direct Protocol*, *Zebra ZPL II*, dan *Web Autosense Print* tanpa software perantara berbayar.
4. **Ekosistem 11 Modul Terintegrasi**: Mengalirkan data secara mulus antara Kedatangan, Penyiapan, Pemusnahan, Reco, Repack, Inventory, Picking, hingga Monitoring Pengambilan Sample.
5. **Keandalan Sistem Bertingkat (Hybrid Multi-Tier Database)**: Kombinasi *Supabase PostgreSQL Realtime*, *Google Spreadsheet Sync* melalui *Cloudflare Worker Reverse Proxy*, dan perlindungan sesi 30 menit.

---

## 3. Arsitektur Teknologi & Tech Stack

Aplikasi dibangun menggunakan teknologi modern dengan standar ketahanan tinggi, performa ringan, dan ramah untuk perangkat lapangan (smartphone, tablet, maupun PDA scanner industri).

### 3.1 Frontend & Runtime
* **Bahasa Pemrograman**: TypeScript 5.8+ (Strict Type-Checking aktif) & JavaScript Modern (ESM).
* **Framework UI**: React 19 (Hooks-based modular architecture).
* **Build Tool & Bundler**: Vite 6 (Kompilasi cepat dan chunk splitting optimal).
* **Desain & Styling**: Tailwind CSS v4 (Desain responsif, tata letak ergonomis, kontras warna yang nyaman untuk mata di area gudang).
* **Animasi UI**: Motion (`motion/react`) untuk transisi modal dan notifikasi robot interaktif.
* **Ikonografi**: Lucide React (Standardisasi ikon logistik, status QC, dan navigasi).
* **Pencarian Cerdas (Fuzzy Search)**: Fuse.js (Toleran terhadap saltik/typo saat mencari nama produk atau kode vendor).
* **Speech Recognition**: Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) dengan lokalisasi bahasa Indonesia (`id-ID`) dan konversi angka otomatis.
* **Olah Spreadsheet**: SheetJS (`xlsx`) & PapaParse untuk pengolahan berkas Excel ribuan baris di sisi klien tanpa jeda.
* **Kamera & Scanner**: `html5-qrcode` untuk memindai barcode 1D dan QR Code 2D langsung dari kamera perangkat mobile/laptop.
* **Generator Barcode/QR**: `qrcode` dan `jszip` untuk ekspor label batch dalam satu arsip ZIP.
* **Audio Synthesizer Engine**: Web Audio API (`broadcastSound.ts`) untuk membangkitkan nada beeps frekuensi tinggi yang dapat didengar jelas di lingkungan gudang yang bising.

### 3.2 Backend, Database & Proxy
* **Primary Database (Cloud BaaS)**: Supabase PostgreSQL dengan dukungan Realtime WebSocket replication (*Change Data Capture*).
* **Secondary / Backup Database**: Google Spreadsheet (ID: `1o8hWUAK6DO1rmggbiRaRNfT7On4c9RhrHR6X07nqZm4`) via Webhook Google Apps Script.
* **CORS Proxy & API Gateway**: Cloudflare Worker Reverse Proxy (`logistikapps.cikembar.workers.dev`) yang menjembatani komunikasi browser ke Google Apps Script tanpa hambatan *CORS Blocking* atau *Failed to Fetch*.
* **PWA Engine**: Service Worker kustom (`sw.js`) dan Web App Manifest (`manifest.json`) dengan deteksi pembaruan versi real-time (*In-App Auto-Update Prompt*).

---

## 4. Arsitektur Database & Skema Data

### 4.1 Skema Database Supabase PostgreSQL

```sql
-- TABEL 1: USERS (Pengguna & Hak Akses)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    pin VARCHAR(20) NOT NULL,
    avatar TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'Pelaksana', -- 'Admin' | 'Pelaksana'
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',   -- 'Aktif' | 'Nonaktif'
    email_google VARCHAR(255) DEFAULT '',
    permissions JSONB NOT NULL DEFAULT '{
        "canInputIncoming": true,
        "canTally": true,
        "canEditMasterBarang": false,
        "canManageUsers": false,
        "canApproveQC": false,
        "canAccessDatabase": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL 2: DATA_BARANG (Master SKU Produk)
CREATE TABLE IF NOT EXISTS public.data_barang (
    item_code VARCHAR(100) PRIMARY KEY NOT NULL,
    barcode VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    uom VARCHAR(50) DEFAULT 'CTN',
    shelf_life VARCHAR(50) DEFAULT '36 Bulan',
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL 3: DATA_DISTRIBUTOR (Master Rekanan / Vendor)
CREATE TABLE IF NOT EXISTS public.data_distributor (
    kode_ld VARCHAR(50) PRIMARY KEY NOT NULL,
    nama_distributor VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL 4: INCOMING (Transaksi Kedatangan Inbound)
CREATE TABLE IF NOT EXISTS public.incoming (
    id_incoming VARCHAR(100) PRIMARY KEY NOT NULL,
    jenis VARCHAR(100) DEFAULT 'ADMK',             -- ADMK, BTB, RETUR
    id_distributor VARCHAR(50),
    distributor VARCHAR(255),
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-A-01',
    location_type VARCHAR(50) DEFAULT 'Rack',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL01',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-01',
    qc_code VARCHAR(50) DEFAULT 'Lulus',            -- Lulus, Karantina, Reject
    user_tally VARCHAR(100) DEFAULT 'Tally 1',
    shelf_life VARCHAR(50) DEFAULT '36 Bulan',
    source VARCHAR(100) DEFAULT 'Supplier',
    user_input VARCHAR(100) DEFAULT 'Admin',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'OPEN',              -- OPEN | CLOSE
    tujuan VARCHAR(255) DEFAULT 'Warehouse Utama',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL 5: DATA_PENYIAPAN (Outbound Staging)
CREATE TABLE IF NOT EXISTS public.data_penyiapan (
    id_penyiapan VARCHAR(100) PRIMARY KEY NOT NULL,
    tujuan VARCHAR(255) DEFAULT 'Pengiriman Cabang',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-B-01',
    location_type VARCHAR(50) DEFAULT 'Floor',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL02',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-02',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Tally 2',
    shelf_life VARCHAR(50) DEFAULT '36 Bulan',
    source VARCHAR(100) DEFAULT 'Stok Gudang',
    user_input VARCHAR(100) DEFAULT 'Admin',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'Ready',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL 6: BROADCAST (Siaran Intercom & Pesan Siaga Gudang)
CREATE TABLE IF NOT EXISTS public.broadcast (
    id TEXT PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL DEFAULT 'Pos Logistik',
    author_name VARCHAR(255) DEFAULT 'Pos Logistik',
    message TEXT NOT NULL,
    content TEXT,
    title VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'info',
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
    device_info VARCHAR(100) DEFAULT 'Browser Web',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

### 4.2 Skema Integrasi Google Spreadsheet & Webhook Apps Script
* **ID Spreadsheet**: `1o8hWUAK6DO1rmggbiRaRNfT7On4c9RhrHR6X07nqZm4`
* **Tab Terintegrasi**:
  1. **Sheet "Sample"** (11 Kolom Wajib):
     `STATUS` | `TANGGAL` | `NO. SPPJ` | `ID` | `DESKRIPSI` | `QTY` | `UNIT` | `WMS` | `SAP` | `PIC` | `NOTE`
  2. **Sheet "Picking"** (26 Kolom Standar Logistik):
     Menampung seluruh atribut picking outbound siap kirim lengkap dengan nomor LPN dan detail batch.

---

## 5. Sistem Hak Akses (RBAC), Autentikasi & Keamanan

### 5.1 Peran Pengguna (Roles)
1. **Administrator / Superadmin**:
   * Hak akses seluruh menu dan konfigurasi sistem.
   * Mengelola akun pengguna (tambah, edit nama/role, reset PIN, aktifkan/nonaktifkan user).
   * Hak impor data massal via Excel (khusus master barang, kedatangan, dan penyiapan).
   * Konfigurasi koneksi database dan jembatan webhook.
2. **Pelaksana / Operator**:
   * Menjalankan input transaksi operasional (Incoming, Picking, Sample, Cek ED, Cetak Label).
   * Tidak dapat mengubah struktur master data barang atau menghapus user.

### 5.2 Fitur Keamanan Operasional
* **Autentikasi Cepat dengan PIN**: Memudahkan pekerja lapangan yang menggunakan sarung tangan atau perangkat layar sentuh kecil.
* **Auto-Logout Sesi 30 Menit**: Melindungi sistem saat perangkat ditinggalkan tanpa pengawasan di workstation gudang.
* **Modal Verifikasi PIN untuk Spreadsheet**: Membuka tautan eksternal database Google Spreadsheet wajib diverifikasi dengan PIN keamanan.
* **Pembersihan Cache Transaksi Otomatis**: Menghindari anomali data di perangkat klien sehingga aplikasi selalu membaca data terbaru dari cloud.

---

## 6. Rincian 11 Modul Operasional Logistik

### Modul 1: Cek Expired Date (ED Checker)
* **Tujuan**: Mencegah lolosnya barang kedaluwarsa ke pasar dan mempercepat verifikasi kualitas.
* **Logika Perhitungan**:
  1. Ekstraksi karakter kode batch (menghilangkan prefix dan suffix huruf).
  2. 3 digit pertama: *Day of Year* (DOY) hari ke-1 sampai 366.
  3. 1 digit terakhir: Digit tahun produksi (misal: 6 $\rightarrow$ 2026 atau 2016).
  4. Perhitungan tanggal mixing: 1 Januari Tahun Produksi + (DOY - 1) hari dengan presisi tahun kabisat (*Leap Year*).
  5. Perhitungan tanggal SLED / Expired Date otomatis berdasarkan aturan kategori produk (*Shelf Life* 1 hingga 5 tahun, atau *Non-Expired*).
* **Fitur**: Kalkulator interaktif instan, upload file Excel massal ribuan batch, dan ekspor laporan hasil kalkulasi.

### Modul 2: Database Master
* **Tujuan**: Menjaga integritas data referensi di seluruh gudang.
* **Sub-Menu**:
  * **Master Barang**: Kode SKU, barcode, nama barang, kategori, satuan, dan standar masa simpan.
  * **Master Distributor**: Kode rekanan/vendor (LD) dan nama resmi perusahaan supplier.
* **Fitur**: Pencarian Fuzzy (*typo tolerant*), formulir tambah/edit, template impor Excel standar, serta ekspor data.

### Modul 3: Kedatangan (Inbound / Incoming)
* **Tujuan**: Pencatatan fisik barang masuk dari supplier secara cepat, akurat, dan transparan.
* **Fitur Utama**:
  * **Input Suara Cerdas (Speech-to-Text)**: Mendukung pengisian Nama Distributor, Nama Barang, dan Nomor Batch hanya dengan perintah suara bahasa Indonesia.
  * **Auto-Calculate ED**: Otomatis menghitung tanggal expired saat batch diinput.
  * **Konversi Satuan Terpadu**: Menghitung otomatis total PCS dari jumlah karton (CTN) yang diterima.
  * **Pemindaian Barcode Kamera**: Verifikasi SKU barang menggunakan pemindai kamera bawaan perangkat.
  * **Tombol Cetak Label Cepat**: Membuka modul cetak label Honeywell PM42 dengan data yang langsung terisi.

### Modul 4: Generator QR & Cetak Label Honeywell PM42
* **Tujuan**: Menstandarkan penandaan palet dan karton dengan label QR Code industri.
* **Spesifikasi Teknis**:
  * **Ukuran Label**: 80 mm x 100 mm (Landscape).
  * **Dimensi QR Code**: 40 mm, Error Correction Level M.
  * **Direct Thermal Autosense Print**: CSS `@page { size: 100mm 80mm landscape; margin: 0; }` agar hasil cetak pas di printer thermal tanpa perlu penyetelan margin rumit di browser.
  * **Format Raw Command**: Menyediakan skrip *Direct Protocol* (Intermec/Fingerprint) dan *Zebra ZPL II* untuk pengguna tingkat lanjut yang ingin membypass driver cetak Windows.
  * **Massal & Unduh ZIP**: Menghasilkan puluhan hingga ratusan QR sekaligus dan mengunduhnya dalam berkas ZIP.

### Modul 5: Penyiapan (Outbound Staging)
* **Tujuan**: Mengorganisasi barang yang telah siap untuk dikirim ke cabang atau pelanggan.
* **Fitur**: Pencatatan lokasi staging (`WH-B-01`), status kesiapan (*Ready*, *In Progress*), pengelompokan tujuan pengiriman, serta integrasi tombol alih tugas (kirim ke Pemusnahan, Reco, Inventory, Repack, atau Picking).

### Modul 6: Pemusnahan (Disposal & Incinerator)
* **Tujuan**: Mengontrol pembuangan barang rusak, pecah, kedaluwarsa, atau tidak layak jual.
* **Fitur**:
  * Pemindahan otomatis dari modul Penyiapan.
  * Pelacakan lokasi karantina (`WH-REJECT-01`) dan storage location disposal (`SL99`).
  * Pencatatan nomor Berita Acara Pemusnahan (BAP) dan metode pemusnahan (Incinerator/Daur Ulang) untuk kepatuhan audit.

### Modul 7: Reco (Permintaan & Relokasi Barang)
* **Tujuan**: Penanganan barang yang memerlukan penggantian kemasan sekunder atau rekondisi sebelum dapat dijual kembali.
* **Fitur**: Pencatatan lokasi rekondisi (`WH-RECO-01`, `SL03`), tracking status perbaikan, dan relokasi kembali ke stok siap jual setelah lulus verifikasi QC.

### Modul 8: Inventory Gudang
* **Tujuan**: Menyajikan visibilitas stok real-time di seluruh rak dan lantai gudang.
* **Fitur**:
  * Monitoring stok per zona, lorong (*aisle*), rak (*rack*), level, dan bin.
  * **Bulk Location Transfer**: Memindahkan banyak item atau palet sekaligus dari satu rak ke rak lain dalam satu klik.
  * Scanner kamera untuk cek identitas dan jumlah fisik di lokasi rak.

### Modul 9: Repack (Bundling & Promosi)
* **Tujuan**: Pengelolaan proses perubahan bentuk kemasan produk untuk program promosi (misal: Paket 2-in-1, penambahan hadiah langsung).
* **Fitur**: Pemindahan massal dari modul Penyiapan, tracking kode SKU baru hasil bundling, dan pencatatan lokasi kerja repack (`WH-REPACK-01`, `SL04`).

### Modul 10: Picking (Outbound Order Fulfillment)
* **Tujuan**: Mengarahkan petugas pengambil barang (*picker*) agar mengambil barang dengan rute paling efisien.
* **Fitur**: Pengelompokan daftar ambil berdasarkan urutan lorong rak, verifikasi nomor lot/batch yang diambil, dan sinkronisasi berkala ke database Google Spreadsheet tab `"Picking"`.

### Modul 11: Monitoring Pengambilan Sample
* **Tujuan**: Mencegah ketidaksesuaian stok (*stock discrepancy*) akibat pengambilan barang untuk sample uji mutu (QC), laboratorium, atau tim promosi marketing.
* **Fitur Utama**:
  * Sinkronisasi dua arah real-time dengan Google Spreadsheet tab `"Sample"`.
  * Pelacakan atribut: Status (OPEN/CLOSE), Tanggal, No. SPPJ, ID Barang, Deskripsi, Jumlah, Satuan, status verifikasi WMS, status posting SAP, PIC pemohon, dan catatan pendukung.
  * Tombol sakelar status cepat (Quick Toggle Status) dari OPEN menjadi CLOSE saat barang telah diverifikasi selesai.

---

## 7. Fitur Cerdas & Interaktif

1. **Robot Siaran Intercom (Broadcast System)**:
   * Menampilkan robot/amplop animasi mengambang di layar.
   * Menyiarkan pesan operasional mendesak ke seluruh staf yang sedang membuka aplikasi.
   * Didukung audio synthesizer berbasis Web Audio API dengan frekuensi bunyi peringatan yang dapat dinyalakan/dimatikan.
2. **Quran Running Ticker**:
   * Menampilkan pesan inspiratif yang berjalan di bar bagian atas dashboard utama untuk menjaga semangat dan etos kerja staf gudang.
3. **PWA In-App Auto-Update Notification**:
   * Service worker memeriksa berkas `version.json` di server secara berkala.
   * Muncul tombol animasi *"Update Siap"* sehingga staf cukup menekan tombol tersebut untuk memuat versi aplikasi paling baru tanpa repot menghapus cache browser.

---

## 8. Alur Kerja Operasional Antar-Modul (Workflow)

```
[ PABRIK / SUPPLIER ]
         │
         ▼
[ Modul 3: KEDATANGAN / INCOMING ]
   ├── Input Suara (Speech-to-Text) & Cek Master SKU
   ├── Auto-Calculate ED & Validasi Kualitas (QC)
   └── Cetak Label QR [ Modul 4: CETAK PM42 ]
         │
         ▼ (Barang Diterima & Masuk Rak)
[ Modul 8: INVENTORY GUDANG ]
         │
         ├────────────────┬─────────────────┬────────────────┐
         │                │                 │                │
         ▼                ▼                 ▼                ▼
[ Modul 5: PENYIAPAN ] [ Modul 11: SAMPLE ] [ Modul 7: RECO ] [ Modul 9: REPACK ]
         │
         ├────────────────┬─────────────────┐
         ▼                ▼                 ▼
[ Modul 10: PICKING ] [ Modul 6: PEMUSNAHAN ] [ Cabang / Konsumen ]
```

---

## 9. Panduan Konfigurasi Lingkungan (.env)

| Variabel Lingkungan | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL endpoint proyek Supabase | `https://xyzproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public Anon API Key Supabase | `eyJhbGciOi...` |
| `VITE_SPREADSHEET_ID` | ID Google Spreadsheet Master | `1o8hWUAK6DO1rmggbiRaRNfT7On4c9RhrHR6X07nqZm4` |
| `VITE_WORKER_PROXY_URL` | Endpoint Cloudflare Worker Proxy | `https://logistikapps.cikembar.workers.dev/` |

---

## 10. Kesimpulan & Roadmap Masa Depan

Aplikasi **Logistik Cikembar (LogistikApps)** memberikan solusi komprehensif bagi operasional gudang dengan menghilangkan ketergantungan pada software proprietary yang mahal, memangkas waktu pencatatan barang melalui teknologi suara, dan mengunci akurasi stok melalui integrasi multi-database.

**Rencana Pengembangan Berikutnya (Future Roadmap)**:
* Integrasi antarmuka Bluetooth langsung ke printer thermal portabel (Mobile Bluetooth Printer).
* Visualisasi denah tata letak rak 2D/3D interaktif (*Warehouse Digital Twin*).
* Integrasi pembacaan RFID reader untuk penerimaan palet berkecepatan tinggi.

---
*Dokumen ini dibuat dan divalidasi sebagai acuan standar arsitektur dan fungsionalitas sistem LogistikApps.*
