# Optimasi Performa Aplikasi, Penyederhanaan Kode & Sinkronisasi Real-Time Database

Menghapus sisa data dummy/mock di dalam kode, menyederhanakan logika pembacaan data serta *timer* latar belakang yang memberatkan perangkat, dan mengubah mekanisme sinkronisasi antar perangkat dari *full-table refetch* menjadi *incremental real-time delta sync* (`INSERT` / `UPDATE` / `DELETE` langsung di memori) agar aplikasi berjalan sangat ringan dan instan di semua perangkat.

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh sinkronisasi transaksi (`incoming`, `data_penyiapan`, `data_pemusnahan`, `data_inventory`, `data_barang`, `data_distributor`) akan menggunakan **Delta Realtime Sync** (memperbarui baris yang berubah secara langsung dari *payload* WebSocket Supabase tanpa mengunduh ulang seluruh tabel berulang kali), serta menghentikan pengiriman ulang seluruh tabel saat menekan tombol **Refresh**.

- **Penghapusan Mock / Dummy Data**: Menghapus akun fallback hardcoded (`admin@admin.com` pada `useSupabase.ts`) dan membersihkan fungsi/komponen dummy yang tidak diperlukan.
- **Optimasi Sinkronisasi Antar Perangkat (Delta Realtime Updates)**: Saat Perangkat A menambah, mengubah, atau menghapus 1 baris data, Perangkat B langsung menerima 1 baris tersebut melalui *payload* `postgres_changes` dan memperbarui state tabel secara instan tanpa mengunduh ulang ribuan baris dari server.
- **In-Memory Master Data Cache (`data_barang` & `data_distributor`)**: Menyimpan data master di memori aplikasi bersama (*shared memory cache* dengan *deduplicated request*) sehingga berpindah antar menu (Kedatangan, Penyiapan, Inventory, Pemusnahan) tidak perlu `JSON.parse` berulang kali atau mengunduh ulang tabel master.
- **Pengurangan Beban Timer & DOM Rendering**:
  - Mengubah interval pengecekan inaktivitas & koneksi agar tidak memicu *re-render* setiap detik.
  - Mengoptimalkan *polling* dan *channel* pada sistem Broadcast agar hanya memantau tabel yang aktif.
  - Membatasi tampilan awal baris tabel (`rowsPerPage` default `50` baris dengan opsi `Semua Data` tetap tersedia) agar browser tidak membeku saat merender ribuan baris sekaligus.

## 1. Overview & Core Concept

- **What It Does**: Mengoptimalkan kecepatan muat, responsivitas input, dan efisiensi jaringan/sinkronisasi database di seluruh modul Logistik Cikembar.
- **Target Audience / Persona**: Seluruh tim operasional gudang dan admin logistik yang menggunakan aplikasi secara bersamaan di berbagai perangkat (desktop & mobile/PWA).
- **Key Value**: Aplikasi terasa jauh lebih ringan, hemat kuota/baterai, bebas *lag* saat mengetik atau berpindah menu, dan perubahan data antar perangkat tersinkronisasi dalam hitungan milidetik.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Buka Modul & Pindah Menu Instan**: Data Master Barang & Distributor dimuat sekali ke *shared in-memory cache* dan langsung tersedia untuk semua modul tanpa jeda.
  2. **Input & Edit Data Tanpa Reload Tabel Penuh**: Saat menyimpan transaksi baru atau mengubah status proses di tabel, UI langsung diperbarui (*optimistic update*) dan hanya mengirimkan 1 baris yang berubah ke database (tanpa memanggil `fetchAllRowsFromSupabase` berulang kali).
  3. **Sinkronisasi Antar Perangkat Seketika**: Perubahan dari perangkat lain langsung disisipkan ke state tabel melalui *event payload* (`INSERT`, `UPDATE`, `DELETE`).
  4. **Tombol Refresh yang Bersih & Cepat**: Tombol **Sinkron & Refresh** pada modul Kedatangan hanya menarik data terbaru dari database tanpa melakukan *batch upsert* ulang seluruh baris lama.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Delta Realtime State Update vs Full Table Refetch**
  - *Chosen Approach*: Menggunakan `payload.eventType` (`INSERT`, `UPDATE`, `DELETE`) dan `payload.new` / `payload.old` pada listener Supabase Realtime di modul `IncomingModule`, `DatabaseMasterModule`, `PemusnahanModule`, dan `PenyiapanModule`.
  - *Why*: Menghemat 99% *bandwidth* dan waktu CPU dibanding mengunduh ulang ribuan baris setiap kali ada 1 perubahan kecil.
- **Decision 2: Shared In-Memory Cache untuk Master Data**
  - *Chosen Approach*: Menyediakan helper terpusat di `supabase.ts` (`getSharedMasterBarang` & `getSharedMasterDistributor`) yang menyimpan array di memori RAM selama sesi berjalan dan melakukan *deduplication* jika ada 2 request bersamaan.
  - *Why*: Menghilangkan *freeze* akibat pembacaan `localStorage` (`JSON.parse` ribuan objek) dan pemanggilan jaringan ganda.
- **Decision 3: Penyederhanaan Polling & Interval Background**
  - *Chosen Approach*: Memperpanjang interval *heartbeat* koneksi dari 10 detik ke 30 detik, memperpanjang *fallback poll* Broadcast dari 4 detik ke 20 detik (karena WebSocket Realtime sudah aktif), dan mengecek inaktivitas setiap 15 detik (bukan setiap 1 detik).
  - *Why*: Mengurangi beban kerja *main thread* browser dan trafik jaringan latar belakang secara drastis.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Shared In-Memory & Realtime Layer                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Perangkat A (Input/Edit 1 Baris)                                       │
│       │                                                                 │
│       ├──► 1. Optimistic State Update (0ms di UI Perangkat A)           │
│       └──► 2. Single-Row Upsert ke Supabase Cloud                       │
│                    │                                                    │
│                    ▼ (WebSocket postgres_changes payload.new/old)       │
│  Perangkat B, C, D                                                      │
│       └──► 3. Delta State Merge (Langsung update 1 baris di memori,     │
│               tanpa fetchAllRowsFromSupabase ulang)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Pembersihan kode dummy pada `useSupabase.ts` dan penyederhanaan listener Realtime di `IncomingModule`, `DatabaseMasterModule`, `PemusnahanModule`, `PenyiapanModule`, `BroadcastContext`, `ConnectionStatusContext`, dan `AuthContext`.
  - Penyesuaian default `rowsPerPage` menjadi `50` pada `IncomingModule` agar *initial render* tabel ribuan baris berlangsung instan (opsi `ALL` / Semua Data tetap dapat dipilih kapan saja).
