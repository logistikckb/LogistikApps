# Modul ADMK (Duplikat 100% Modul Kedatangan) & File SQL Editor Khusus `public.admk`

Penambahan menu operasional baru bernama **ADMK** yang menduplikasi 100% alur kerja, struktur kode, tampilan antarmuka, serta aturan hak akses (role) dari menu **Kedatangan**, dengan penyimpanan database mandiri pada tabel `public.admk` beserta file skrip SQL khusus untuk dieksekusi di SQL Editor Supabase.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan teknis yang telah dikonfirmasi dari hasil klarifikasi:

- **Tabel Database Mandiri (`public.admk`)**: Seluruh transaksi pada menu ADMK disimpan secara terpisah di tabel `public.admk` dengan struktur kolom, tipe data, indeks, dan trigger yang 100% identik dengan tabel `public.incoming`.
- **Kesetaraan Role & Struktur Kode 100%**: Tidak ada perbedaan pembatasan role (`requiresAdmin: false`, seluruh pengguna baik Admin maupun Pelaksana memiliki akses yang sama persis seperti pada menu Kedatangan) dan struktur kode komponen ADMK dibuat 100% identik dengan modul Kedatangan.
- **SQL Editor di File Terpisah (Bukan di UI Aplikasi)**: Skrip SQL lengkap untuk pembuatan tabel `public.admk`, migrasi kolom, indeks, trigger `updated_at`, serta kebijakan RLS disediakan dalam file SQL khusus di repositori (serta diperbarui pada file skema utama) tanpa menambahkan menu SQL Editor baru di antarmuka aplikasi.

---

## 1. Overview & Core Concept

- **What It Does**: Menyediakan modul operasional **ADMK** yang memiliki fitur pencatatan transaksi realtime, pencarian cepat (termasuk *Speech-to-Text* suara), filter multi-kriteria (Proses `open`/`closedoretur`/`closepg`, Tanggal, Status QC, Jenis), kalkulasi otomatis Shelf Life & Expired Date dari kode Batch, serta batch import/export Excel (.xlsx/.xls/.csv) yang identik 100% dengan modul **Kedatangan**.
- **Target Audience / Persona**: Seluruh tim operasional gudang dan logistik (baik role `Admin` maupun `Pelaksana`) yang menangani pencatatan dan monitoring transaksi ADMK.
- **Key Value**: Memisahkan pencatatan transaksi ADMK dari transaksi Kedatangan reguler ke dalam tabel database tersendiri (`public.admk`) tanpa mengubah kebiasaan kerja operator karena antarmuka dan fitur sama persis 100%.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Navigasi Menu Utama**: Pengguna melihat kartu menu **ADMK** pada grid *Menu Operasional* di halaman utama (sejajar dengan menu Kedatangan dan modul aktif lainnya, tanpa pembatasan khusus Admin).
  2. **Tabel & Filter Realtime**: Saat membuka menu ADMK, pengguna disajikan daftar transaksi dari tabel `public.admk` dengan filter default `Proses: open`, pencarian teks/suara, filter Tanggal, Status QC, dan Jenis, serta pengurutan kolom dan paginasi (`50` baris atau `Semua Data`).
  3. **Input & Edit Transaksi**: Pengguna dapat menambah atau mengedit transaksi dengan *autocomplete* Master Barang dan Master Distributor, kalkulasi otomatis tanggal kedaluwarsa (ED) & masa simpan dari nomor batch, serta pengubahan cepat (*quick toggle*) status proses (`open`, `closedoretur`, `closepg`) dan pengisian `matdoc` / `note` langsung dari tabel.
  4. **Batch Excel & Sinkronisasi Cloud**: Pengguna dapat mengunduh template Excel standar, mengunggah ribuan baris sekaligus dari Excel, mengekspor data terfilter ke Excel, dan menyinkronkan data secara *real-time* antar-perangkat melalui Supabase.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian SaaS Logistik berdensitas tinggi (*High-Density Data Grid*) yang bersih, konsisten 100% dengan modul Kedatangan.
  - *Color Palette & Mood*: Kanvas netral terang (`bg-slate-50`, permukaan kartu `bg-white` dengan border halus `border-slate-200/90`), aksen utama hijau zamrud (`bg-emerald-600`, `text-emerald-700`) dan biru tua (`bg-blue-900`) untuk aksi utama serta indikator status semantik (`amber` untuk *open*, `orange` untuk *closedoretur*, `emerald` untuk *closepg*).
  - *Typography & Hierarchy*: Sans-serif fungsional yang tajam untuk label dan navigasi, dipadukan dengan font *monospace tabular* (`font-mono tabular-nums`) untuk kode SKU, nomor batch, kuantitas fisik, dan tanggal kedaluwarsa.
  - *Component Styling & Layout*: Kontainer maksimal `1440px` dengan satu tingkat elevasi kartu, toolbar aksi responsif, dan tabel *scrollable* dengan *sticky header*.
- **Interactive Feedback & Motion**: Indikator pemuatan (*spinner* sinkronisasi), umpan balik mikrofon *Speech-to-Text* secara langsung, notifikasi *toast* saat simpan/hapus/impor berhasil, serta pembaruan instan (*optimistic & realtime subscription*) ketika ada perubahan data di tabel `public.admk`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Duplikasi Komponen Secara Mandiri (100% Identik dengan Kedatangan)**
  - *Chosen Approach*: Membangun modul ADMK dengan struktur logika, *state*, *hooks*, *handler*, dan elemen JSX yang 100% identik dengan modul Kedatangan, hanya mengarahkan target tabel Supabase dan *channel* realtime ke `public.admk`.
  - *Why*: Menjamin tidak ada perbedaan perilaku, validasi, struktur kolom Excel, maupun pembatasan role antara menu Kedatangan dan menu ADMK sesuai instruksi pengguna.
  - *Alternatives Considered*: Menggunakan satu tabel yang sama dengan filter kategori (ditolak karena pengguna mengonfirmasi penggunaan tabel terpisah `public.admk`).
- **Decision 2: Penyediaan SQL Editor Script di File Khusus (Di Luar Aplikasi)**
  - *Chosen Approach*: Menyediakan file skrip SQL khusus yang siap disalin dan dijalankan langsung pada SQL Editor Supabase untuk membangun tabel `public.admk`, indeks pencarian, *trigger* `updated_at`, serta kebijakan *Row-Level Security (RLS)*.
  - *Why*: Sesuai keputusan pengguna agar SQL Editor khusus tabel database menu ADMK dibuat di dalam file tersendiri dan tidak ditambahkan sebagai menu/editor baru di dalam aplikasi.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PORTAL LOGISTIK CIKEMBAR (App)                      │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       ToolsGridMenu (Navigasi)                       │  │
│  │   [Cek ED]  [Database Master]  [Kedatangan]  [ADMK]  [Penyiapan]...  │  │
│  └──────────────────────────┬──────────────────────┬────────────────────┘  │
│                             │                      │                       │
│                             ▼                      ▼                       │
│             ┌───────────────────────┐  ┌───────────────────────┐           │
│             │    IncomingModule     │  │      AdmkModule       │           │
│             │   (100% Identical)    │  │   (100% Identical)    │           │
│             └───────────┬───────────┘  └───────────┬───────────┘           │
│                         │                          │                       │
│     ┌───────────────────┼──────────────────────────┼───────────────────┐   │
│     │                   ▼                          ▼                   │   │
│     │        ┌─────────────────────┐    ┌─────────────────────┐        │   │
│     │        │  Supabase Realtime  │    │  Supabase Realtime  │        │   │
│     │        │   & CRUD Client     │    │   & CRUD Client     │        │   │
│     │        │  (public.incoming)  │    │    (public.admk)    │        │   │
│     │        └─────────────────────┘    └─────────────────────┘        │   │
│     │                                                                  │   │
│     │        ┌────────────────────────────────────────────────┐        │   │
│     └───────►│      Shared In-Memory Master Data Cache        │◄───────┘   │
│              │  (public.data_barang & public.data_distributor)│            │
│              └────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Tabel `public.admk`**: Memiliki struktur kolom yang 100% sama dengan `public.incoming`:
    - `id_incoming` (VARCHAR(100) PRIMARY KEY — dipertahankan agar struktur kode & payload 100% identik dengan modul Kedatangan)
    - `jenis`, `id_distributor`, `distributor`, `item_code`, `item_name`, `category`, `location`, `location_type`
    - `first_qty`, `last_qty`, `uom`, `qty_convert`, `uom_convert`
    - `lpn_serial_number`, `batch`, `vendor_batch`, `sloc`, `expired_date`, `destination_code`
    - `qc_code`, `user_tally`, `shelf_life`, `source`, `user_input`, `tanggal_update`
    - `status` (`open` / `closedoretur` / `closepg`), `tujuan` (`matdoc`), `note`
    - `created_at`, `updated_at`
  - **Master Data Cache**: Menggunakan *shared cache* `data_barang` dan `data_distributor` yang sama dengan modul Kedatangan untuk pencarian produk dan distributor 0ms.
- **Interactive Component & State Mapping**:
  - **Pencarian & Filter**: State `searchQuery`, `prosesFilter` (default `'open'`), `dateFilter`, `qcFilter`, `jenisFilter`, serta pengurutan `sortField` / `sortOrder` memfilter daftar transaksi secara reaktif.
  - **Inline Table Actions**: Dropdown *Proses* (`handleQuickStatusChange`), input inline *No. Dokumen (matdoc)* (`handleQuickTujuanChange`), dan input inline *Note* (`handleQuickNoteChange`) langsung memperbarui state dan melakukan `update` ke tabel `public.admk`.
  - **Modal Transaksi & Excel**: Modal tambah/edit transaksi (`showFormModal`), detail transaksi (`showDetailModal`), konfirmasi hapus (`showDeleteModal`), dan batch import Excel (`showExcelModal`) bekerja dengan validasi dan kalkulasi SLED/DOY yang sama persis.
  - **Skrip SQL Database**: File SQL khusus berisi perintah DDL `CREATE TABLE IF NOT EXISTS public.admk`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, serta konfigurasi `ENABLE ROW LEVEL SECURITY` dan `CREATE POLICY` untuk `anon` dan `authenticated`.
