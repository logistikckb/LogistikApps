# Optimasi Pencarian & Tampilan Nama Produk pada Input Kedatangan Barang Baru

Menyederhanakan pencarian dan tampilan field **Produk \*** pada modal **Input Kedatangan Barang Baru** agar hanya membaca dan menampilkan 1 kolom (**Nama Produk** / `item_name`) tanpa menampilkan ID/Kode Produk di daftar maupun kartu pilihan, sehingga proses pencarian dan pemilihan barang berjalan jauh lebih ringan dan instan.

## User Review & Critical Decisions

> [!IMPORTANT]
> Meskipun tampilan dan indeks pencarian pada form hanya membaca dan menampilkan **Nama Produk** (`item_name`), saat produk dipilih dari daftar, sistem tetap menyimpan `item_code`, `category`, dan `uom` secara otomatis di balik layar agar struktur data transaksi pada tabel database `incoming` tetap valid dan utuh.

- **Pencarian 1 Kolom (`item_name`)**: Indeks pencarian (`indexedBarangList`) dan filter pencarian hanya mengevaluasi kolom `item_name` (Nama Produk) tanpa menggabungkan `item_code`, `barcode`, `category`, atau `uom`.
- **Tampilan Hanya Nama Produk**: Baik pada daftar dropdown hasil pencarian maupun pada kotak produk terpilih di form, hanya **Nama Produk** yang ditampilkan (tanpa badge ID/Kode Produk).

## 1. Overview & Core Concept

- **What It Does**: Memfokuskan pencarian dan tampilan field **Produk \*** pada modal Input Kedatangan Barang Baru menjadi 1 kolom (`item_name` / Nama Produk).
- **Target Audience / Persona**: Operator gudang & petugas tally inbound yang membutuhkan pencarian nama barang secara cepat saat mencatat kedatangan barang.
- **Key Value**: Mengurangi beban pembacaan string multi-kolom dan menyederhanakan tampilan daftar pilihan sehingga pencarian terasa instan dan bersih.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Pengguna menekan tombol **Input Kedatangan**.
  2. Pada field **Produk \***, pengguna mengetik kata kunci nama produk.
  3. Sistem memfilter daftar master barang hanya berdasarkan kolom `item_name` dengan prioritas kecocokan awalan (*prefix match*) diikuti kecocokan kata (*substring match*).
  4. Daftar dropdown menampilkan baris yang ringkas berisi **Nama Produk** saja.
  5. Saat produk dipilih (klik atau tekan `Enter`), tampilan produk terpilih dan teks pencarian hanya menampilkan **Nama Produk** (`item_name`).
- **Visual Identity & Theme**:
  - Mempertahankan tema *Emerald / Slate* yang bersih pada modal Input Kedatangan Barang Baru.
  - Setiap baris pada dropdown produk menjadi satu baris teks `item_name` yang tegas dan mudah dipindai mata (*scannable*).

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Indeks Pencarian Tunggal (`item_name`)**
  - *Chosen Approach*: Pre-index `indexedBarangList` hanya menyimpan `name: (b.item_name || '').trim().toLowerCase()` dan memfilter token kata kunci langsung terhadap `entry.name`.
  - *Why*: Memangkas operasi penggabungan string 5 kolom dan mempercepat pencocokan teks pada ribuan data barang.
- **Decision 2: Penyimpanan `item_code` di Balik Layar**
  - *Chosen Approach*: Menyembunyikan `item_code` dari tampilan UI form & dropdown, namun tetap mengisi `formData.item_code` dari objek `DataBarang` yang dipilih.
  - *Why*: Menjaga integritas data pada tabel `incoming` di database tanpa membebani tampilan pencarian.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌─────────────────────────────────────────────────────────────────┐
│                 Modal Input Kedatangan Barang                   │
├─────────────────────────────────────────────────────────────────┤
│  Master Barang (barangList)                                     │
│       │                                                         │
│       ▼                                                         │
│  Pre-Index 1 Kolom (indexedBarangList: { item, nameLower })     │
│       │                                                         │
│       ▼                                                         │
│  Filter Cepat (filteredBarangList: hanya baca kolom item_name)  │
│       │                                                         │
│       ▼                                                         │
│  Dropdown & Kartu Terpilih (Tampilkan hanya b.item_name)        │
└─────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `indexedBarangList`: Hanya memetakan `{ item: DataBarang, name: string }`.
  - `handleSelectBarangItem(b)`: Mengisi `barangSearchText` dengan `b.item_name` saja (bukan `${b.item_code} - ${b.item_name}`), serta tetap menyimpan `item_code` dan `item_name` ke `formData`.
  - `handleOpenEditModal(item)`: Mengisi `barangSearchText` dengan `item.item_name || ''`.
