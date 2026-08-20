# Panduan Lengkap Integrasi Google Sheets via Cloudflare Workers & Google Apps Script Webhook

Panduan ini menjelaskan langkah demi langkah (*step-by-step*) cara mengunggah data dari **LogistikApps** langsung ke **Google Spreadsheet** secara otomatis menggunakan **Cloudflare Workers** dan **Google Apps Script Webhook**.

---

## 📌 Pertanyaan Utama: Apakah Butuh Spreadsheet ID?

**Jawabannya: BISA KEDUANYA (Sangat Fleksibel)!**

1. **Opsi 1 (Otomatis tanpa ID):** Jika Google Apps Script dipasang langsung di dalam file spreadsheet yang Anda inginkan melalui menu *Extensions > Apps Script*, script akan **otomatis mengenali spreadsheet tersebut** tanpa perlu mengisi Spreadsheet ID.
2. **Opsi 2 (Menggunakan Spreadsheet ID):** Jika Anda ingin satu Webhook / Cloudflare Worker bisa mengirim data ke banyak spreadsheet yang berbeda, Anda cukup menyalin **Spreadsheet ID** dari URL Google Sheets Anda.

### Cara Mendapatkan Spreadsheet ID:
Lihat URL di address bar browser Anda saat membuka Google Sheet:
```text
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       Ini adalah Spreadsheet ID Anda
```

---

## 🚀 Langkah 1: Pasang Google Apps Script (Penerima Data)

1. Buka Google Spreadsheet tujuan Anda (atau buat baru di [sheets.google.com](https://sheets.google.com)).
2. Di menu atas, klik **Extensions (Ekstensi)** $\rightarrow$ **Apps Script**.
3. Hapus semua kode default `myFunction()`, lalu salin seluruh kode dari file **`google_apps_script/Code.gs`** yang ada di repository proyek ini.
4. Klik tombol **Save** (ikon disket).
5. Klik tombol biru **Deploy** (di pojok kanan atas) $\rightarrow$ pilih **New deployment**.
6. Klik ikon gerigi (Select type) $\rightarrow$ pilih **Web app**.
7. Isi pengaturan sebagai berikut:
   - **Description**: `LogistikApps Sync Webhook`
   - **Execute as**: `Me (email anda, misal: logistikcikembar@gmail.com)`
   - **Who has access**: `Anyone (Siapa saja)` *(Penting agar bisa diakses oleh Cloudflare Worker)*
8. Klik tombol **Deploy**.
9. Jika muncul jendela otorisasi Google:
   - Klik **Authorize access** / **Review permissions**.
   - Pilih akun Google Anda.
   - Klik **Advanced** (di bagian bawah kiri).
   - Klik **Go to Untitled project (unsafe)**.
   - Klik **Allow**.
10. Salin **Web app URL** yang muncul (contoh format: `https://script.google.com/macros/s/AKfycbx.../exec`).

---

## ☁️ Langkah 2: Setup Cloudflare Worker & GitHub

Cloudflare Worker berfungsi sebagai gerbang (*gateway / middleware*) yang:
- Mengatasi masalah pembatasan CORS browser secara sempurna.
- Mengamankan komunikasi data antara frontend dan Google.
- Memberikan endpoint kustom yang cepat dengan domain Cloudflare Workers Anda.

### Cara A: Deploy via GitHub & Cloudflare Dashboard (Termudah)
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) $\rightarrow$ Masuk ke menu **Workers & Pages**.
2. Klik **Create Application** $\rightarrow$ **Create Worker**.
3. Beri nama worker, misalnya: `logistik-sheets-worker` $\rightarrow$ Klik **Deploy**.
4. Klik **Edit code**, lalu ganti seluruh kodenya dengan isi file **`cloudflare_worker/worker.js`** dari repository ini.
5. Di menu **Settings > Variables & Secrets** pada Worker Anda:
   - Tambahkan Environment Variable:
     - **Variable Name**: `GOOGLE_SCRIPT_URL`
     - **Value**: Masukkan *Web app URL* yang Anda dapatkan di **Langkah 1** tadi.
     - *(Opsional)* **SECRET_TOKEN**: Masukkan kata sandi jika ingin membatasi akses.
6. Klik **Save and Deploy**.
7. Salin URL Cloudflare Worker Anda (contoh: `https://logistik-sheets-worker.yourname.workers.dev`).

### Cara B: Deploy Otomatis via Wrangler CLI / GitHub Actions
Jika repositori GitHub Anda menggunakan CI/CD:
1. Pastikan folder `cloudflare_worker/` berisi `worker.js` dan `wrangler.toml`.
2. Jalankan perintah di terminal:
   ```bash
   cd cloudflare_worker
   npx wrangler deploy
   ```

---

## 🔄 Langkah 3: Menghubungkan & Menggunakan di LogistikApps

1. Buka aplikasi **LogistikApps** $\rightarrow$ Masuk ke modul **Kedatangan Barang (Incoming)**.
2. Di toolbar atas (sebelah tombol *Download Excel*), klik tombol **"Sync Google Sheets"**.
3. Pada modal yang terbuka:
   - Masukkan **URL Webhook / Cloudflare Worker**: Masukkan URL Worker Anda (misal `https://logistik-sheets-worker.yourname.workers.dev`) atau langsung URL Web App Google Script Anda.
   - Masukkan **Spreadsheet ID** *(opsional)*.
   - Masukkan **Nama Tab Sheet** (default: `Incoming`).
   - Pilih **Mode Pengiriman**:
     - `Replace / Overwrite`: Memperbarui seluruh isi sheet dengan data filter saat ini.
     - `Append`: Menambahkan baris baru di bagian bawah.
4. Klik tombol **"Kirim Data Sekarang"**.
5. Sistem akan menampilkan status sukses dan tombol **"Buka Google Sheet"** untuk melihat spreadsheet Anda yang sudah terisi otomatis!

---

## 📦 Struktur Payload JSON yang Dikirimkan

Aplikasi secara otomatis mengirimkan payload terstruktur berikut ke Worker Anda:

```json
{
  "action": "sync_incoming",
  "mode": "overwrite",
  "sheetName": "Incoming",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "secretToken": "opsional_token",
  "timestamp": "2026-08-20T03:05:00.000Z",
  "totalRows": 25,
  "headers": [
    "ID Incoming",
    "Jenis",
    "ID Distributor",
    "Distributor",
    "Item Code",
    "Item Name",
    "Kategori",
    "Lokasi",
    "Qty Awal",
    "Qty Akhir",
    "UOM",
    "Batch",
    "Expired Date",
    "Status QC",
    "User Tally",
    "Tanggal Update",
    "Status",
    "Catatan / Note"
  ],
  "rows": [
    [
      "INC-20260816-001",
      "ADMK",
      "LD-001",
      "PT KINO INDONESIA",
      "21104501",
      "KINO SAMANTHA",
      "Finished Good",
      "WH-A-01",
      100,
      100,
      "CTN",
      "L911346N",
      "2029-05-14",
      "Lulus",
      "Tally 1",
      "2026-08-16",
      "OPEN",
      "Warehouse Utama"
    ]
  ]
}
```
