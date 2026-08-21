# TODO & STRUKTUR LOGIKA: GENERATOR QR & PRINT HONEYWELL PM42

Dokumen ini mendokumentasikan secara komprehensif **arsitektur logika bisnis, parsing data, kalkulasi geometri termal, alur cetak, dan roadmap pengembangan** dari menu **Generator QR & Print PM42** (`src/components/logistics/QrGeneratorHoneywellModule.tsx`).

---

## 1. Ringkasan & Spesifikasi Modul

Modul **Generator QR & Print PM42** dirancang khusus untuk memenuhi standar pencetakan label termal industri pergudangan & logistik menggunakan printer **Honeywell PM42** (resolusi 203 DPI / 8 dots per mm).

### Spesifikasi Label & Output
- **Ukuran Label Standar**: `80 x 100 mm` (Standar SN / Serial Number WMS, orientasi *Landscape* / `100 x 80 mm`).
- **Komposisi Label 3 Zona**:
  1. **Zona Atas (Header)**: *Item Code* & *Item Name* (Teks tebal, rata kiri dengan margin 2mm, pembatas garis solid).
  2. **Zona Tengah (Body)**: *QR Code* presisi tinggi (Standar 40mm, *Error Correction* L/M/Q/H, terpusat).
  3. **Zona Bawah (Footer)**: *SN/LPN* (isi QR), *Batch Number*, dan *Expired Date* (tertumpuk vertikal rapi, font monospaced).
- **Protokol Output**:
  - **Browser Direct Thermal Print**: Menggunakan `@media print`, CSS `@page size`, dan fallback dual-channel (Popup Window + Hidden Iframe).
  - **Honeywell Direct Protocol (Intermec / Fingerprint)**: Perintah native `CLL`, `DIR`, `PP`, `PB`, `PF`.
  - **ZSim / Zebra ZPL II**: Emulasi perintah `^XA ... ^XZ` dengan barcode QR `^BQN`.
  - **Export Digital**: Batch ZIP gambar PNG (`JSZip`) & Spreadsheet Excel (`SheetJS/xlsx`).

---

## 2. Diagram Alur & Logika Sistem (Data Flow)

```
[Sumber Data Input]
  ├── Paste Teks Manual (Baris demi baris)
  ├── Impor Berkas Excel (.xlsx / .xls)
  └── Impor Berkas Teks (.txt / .csv)
             │
             ▼
[Parser & Deteksi Format Data]
  ├── Format 15 Kolom WMS (Delimited Tab '\t', Pipe '|', atau Semicolon ';')
  │     ├── Kolom 1 (Index 0)  -> Item Code
  │     ├── Kolom 2 (Index 1)  -> Item Name
  │     ├── Kolom 11 (Index 10)-> LPN / Serial Number (Isi QR Code)
  │     ├── Kolom 12 (Index 11)-> Batch Number
  │     └── Kolom 15 (Index 14)-> Expired Date (DD/MM/YYYY)
  └── Format Standar 1-2 Kolom (Judul, Nilai QR)
             │
             ▼
[QR Generator Engine]
  ├── Komputasi QR Code via `qrcode` (Async DataURL, Scale 600px, Margin 1)
  ├── Dynamic Error Correction Level (L: 7%, M: 15%, Q: 25%, H: 30%)
  └── Assign UUID & Metadata (`QrLabelItem[]`)
             │
             ▼
[Editor State & Manajemen Grid]
  ├── Live Inline Editor (Ubah Item Code, Name, LPN, Batch, ED -> Auto Regenerate QR)
  ├── Live Search & Filter (Cari berdasarkan judul, kode item, atau LPN)
  └── Selection Manager (Select All, Invert, Multi-select checkbox)
             │
             ├───────────────────────────────────────────────────────┐
             │                                                       │
             ▼                                                       ▼
[Jalur Cetak Langsung (Direct Print)]                [Jalur Raw Machine Command]
  ├── Kalkulasi Geometri Layout (mm -> pt/px)          ├── Konversi Dots 203 DPI (mm * 8)
  ├── Dynamic Font Sizing (Auto-shrink jika panjang)   ├── Direct Protocol Builder (.dp)
  ├── Dual-Trigger Printing Engine:                    ├── ZPL II Builder (.zpl / .prn)
  │     ├── Channel 1: Window Popup (Clean Context)    └── Download File PRN / DP
  │     └── Channel 2: Hidden Iframe Fallback
  └── Anti-Color / Pixel Crisp Rendering
```

---

## 3. Struktur Logika Detail Tiap Komponen

### 3.1 Logika Parser Multi-Format (`parseLines`)
1. **Filter Header**: Otomatis mendeteksi dan mengabaikan baris judul kolom (seperti `item code`, `lpn/serial number`, dsb.).
2. **Deteksi Delimiter**:
   - Memprioritaskan karakter pemisah `\t` (Tab hasil copy-paste dari Excel).
   - Mendukung delimiter sekunder: pipe `|`, semicolon `;`, dan koma `,`.
3. **Branching Logistik vs Simpel**:
   - Jika kolom $\ge 11$: Mengaktifkan mode `isFullLogistic = true` dan memetakan slot kolom WMS 15 kolom secara otomatis.
   - Jika kolom $< 11$: Mengaktifkan mode generic (`title`, `text`).

### 3.2 Logika Tipografi Dinamis (*Adaptive Font Scaling*)
Untuk mencegah teks meluap (*overflow*) atau terpotong pada label berukuran $100 \times 80\text{ mm}$:
- **Judul / Item Name**:
  - Karakter $> 90$: Font size berkurang $4\text{px}$ (Minimal $7\text{px}$).
  - Karakter $> 60$: Font size berkurang $3\text{px}$ (Minimal $7.5\text{px}$).
  - Karakter $> 40$: Font size berkurang $1.5\text{px}$ (Minimal $8\text{px}$).
- **LPN / Serial**: Monospace font dengan *letter-spacing* terukur dan *word-break all*.

### 3.3 Logika Perhitungan Geometri Termal
- Rasio konversi DPI: $1\text{ mm} = 8\text{ dots}$ (untuk printer 203 DPI).
- Lebar Dots: $W_{\text{dots}} = \text{round}(W_{\text{mm}} \times 8) \rightarrow 100\text{ mm} \approx 800\text{ dots}$.
- Tinggi Dots: $H_{\text{dots}} = \text{round}(H_{\text{mm}} \times 8) \rightarrow 80\text{ mm} \approx 640\text{ dots}$.
- Ukuran Efektif QR: Dihitung secara proporsional agar tidak menabrak batas atas atau bawah:
  $$\text{Effective QR Size} = \min(\text{qrSizeMm}, W_{\text{mm}} - 16, \max(22, H_{\text{mm}} - 36))$$

### 3.4 Direct Protocol & ZPL Command Builder
- **Direct Protocol (Intermec/Fingerprint)**:
  - Header setup media: `CLL`, `OPTIMIZE "BATCH" ON`, `MEDIA TYPE "LABEL WITH GAPS"`, `MEDIA SIZE ... DOTS`.
  - QR Code command: `BARCODE "QR", 5, 2, 4` disusul `PB "<data>"`.
  - Eksekusi: `PF 1` (Print Feed 1 lembar).
- **ZPL II (ZSim)**:
  - Format pembuka & penutup: `^XA` ... `^XZ`.
  - Media sensing: `^MNY` (Gap/Web sensing).
  - Elemen QR: `^FO<X>,<Y>^BQN,2,4,Q,7^FDMA,<data>^FS`.

---

## 4. Checklist Status & Roadmap Pengembangan (TODO)

### [x] FASE 1: Core Engine & Parsing Data (Selesai)
- [x] Implementasi input multi-baris manual dengan auto-prefix.
- [x] Integrasi generator QR code berbasis `qrcode` dengan level koreksi error (L, M, Q, H).
- [x] Parser cerdas untuk input 15 kolom WMS (Item Code, Item Name, LPN, Batch, ED).
- [x] Parser toleran delimiter (Tab, Pipe, Semicolon, Comma).
- [x] Import berkas `.xlsx` dan `.xls` via SheetJS (`xlsx`).
- [x] Import berkas teks murni `.txt` / `.csv`.
- [x] Fitur penambahan baris manual secara interaktif (+ Tambah Baris).

### [x] FASE 2: Manajemen & Manipulasi Label (Selesai)
- [x] Live search / filter pencarian instan pada tabel antrean cetak.
- [x] Multi-selection baris (Select All, Deselect All, Toggle per item).
- [x] Inline editing langsung pada tabel untuk semua atribut (Item Code, Name, LPN, Batch, ED).
- [x] Auto-regenerate QR Code saat nilai LPN atau text diedit.
- [x] Hapus item satuan dan hapus massal item terpilih.
- [x] Salin teks LPN / QR ke clipboard dengan indikator feedback visual.

### [x] FASE 3: Output & Printing Engine (Selesai)
- [x] Template HTML layout termal khusus Honeywell PM42 ($100 \times 80\text{ mm}$ Landscape).
- [x] Header divider line tepat di bawah Item Name.
- [x] Footer tumpuk vertikal untuk SN/LPN, Batch, dan Expired Date.
- [x] Dual-channel print execution (Popup window prioritizer + Hidden iframe fallback).
- [x] Tombol cetak per-baris (Quick Single Print) dan cetak massal (Batch Selected Print).
- [x] Modal preview dan opsi cetak interaktif.
- [x] Generator Raw Command Direct Protocol (Intermec/Fingerprint `.dp`).
- [x] Generator Raw Command Zebra ZPL II (`.zpl` / `.prn`).
- [x] Download batch seluruh gambar QR dalam arsip ZIP (`JSZip`).
- [x] Export dataset ke file Excel (`.xlsx`).

---

### [ ] FASE 4: Rencana Optimasi & Fitur Lanjutan (Upcoming TODO)

#### 1. Konektivitas & Direct Hardware Printing
- [ ] **WebUSB / WebSerial API Integration**: Fitur pengiriman raw script (Direct Protocol / ZPL) langsung dari browser ke kabel USB printer Honeywell PM42 tanpa melalui Windows Print Spooler.
- [ ] **Network / IP Socket Printing**: Dukungan pengiriman raw command langsung ke alamat IP printer Honeywell di jaringan lokal gudang (`http://<printer-ip>:9100`).

#### 2. Layout & Kustomisasi Desain Label
- [ ] **Visual Drag-and-Drop Label Designer**: Pengaturan posisi (X/Y) teks, barcode, dan QR secara visual dengan *live canvas preview*.
- [ ] **Dukungan Barcode 1D (Code 128 / EAN 13)**: Opsi menambahkan Barcode 1D di samping atau di bawah QR Code untuk scanner optik lama.
- [ ] **Preset Ukuran Label Tambahan**:
  - `50 x 30 mm` (Label Rak / Bin Location)
  - `70 x 50 mm` (Label Karton Standar)
  - `100 x 150 mm` (Label Pengiriman / Pallet Tag)

#### 3. Integrasi Master Data & Supabase Sync
- [ ] **Auto-Lookup Master Data Barang**: Saat menginput Item Code, sistem otomatis melengkapi Item Name dan Barcode dari database Supabase (`data_barang`).
- [ ] **Simpan Riwayat Cetak (Print Log)**: Mencatat histori pencetakan (siapa yang mencetak, waktu cetak, jumlah label, dan nomor batch) ke tabel audit log.
- [ ] **Integrasi Modul Penyiapan & Incoming**: Tombol *shortcut* 1-klik dari modul *Incoming* dan *Penyiapan* untuk langsung mengirim data ke modul *QR Generator PM42*.

#### 4. Validasi & Kontrol Kualitas (QC)
- [ ] **Pemeriksaan Duplikasi LPN**: Peringatan visual otomatis jika terdapat LPN / Serial Number yang sama ganda di dalam antrean cetak.
- [ ] **Validasi Format Tanggal ED**: Pengecekan otomatis format tanggal `DD/MM/YYYY` dan peringatan jika tanggal sudah kadaluwarsa saat akan dicetak.
- [ ] **Counter Batch Number Validator**: Validasi digit format nomor batch sesuai aturan pabrik/manufaktur.

---

## 5. Ringkasan File & Dependensi Terkait

| File / Modul | Peran Utama |
| :--- | :--- |
| `src/components/logistics/QrGeneratorHoneywellModule.tsx` | Komponen utama logika parser, rendering UI, generator ZPL/DP, dan print engine |
| `src/components/QrGeneratorModal.tsx` | Wrapper modal untuk generator QR cepat di dashboard utama |
| `src/components/BatchQrSection.tsx` | Generator QR sederhana untuk keperluan umum/non-logistik |
| `src/types.ts` | Deklarasi antarmuka data `QrLabelItem`, `LabelPresetSize` |
| `qrcode` | Engine konversi string teks menjadi QR Code Data URL |
| `jszip` | Engine pembuatan arsip ZIP untuk unduhan massal |
| `xlsx` | Engine parsing dan pembuatan berkas spreadsheet Excel |
| `lucide-react` | Set ikon antarmuka standar |

---
*Dokumen ini dibuat dan diselaraskan untuk kebutuhan operasional gudang dan pengembangan sistem LogistikApps.*
