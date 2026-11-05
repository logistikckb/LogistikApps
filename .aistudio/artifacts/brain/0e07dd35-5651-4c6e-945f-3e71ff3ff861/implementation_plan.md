# Audit & Pembersihan Modul di Luar Menu Operasional Utama

Menyederhanakan dan membersihkan struktur kode aplikasi **Logistik Cikembar** agar hanya memuat **7 modul Menu Operasional aktif** beserta fitur inti pendukungnya (Autentikasi, Profil/Manajemen User, Siaran Publik/Intercom, Koneksi Realtime, dan PWA), serta menghapus seluruh modul logistik tambahan, komponen portal lama, dan skrip sementara tanpa mengganggu tampilan maupun fungsi menu utama.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan hasil konfirmasi pada tahap klarifikasi, seluruh pembersihan di bawah ini dirancang dengan prinsip **Zero Disruption** terhadap ke-7 modul utama yang tampil pada Menu Operasional.

- **Keputusan Terkonfirmasi 1 (Hapus 5 Modul Logistik Tambahan & Wrapper)**: Menghapus modul `Stock Opname Suite`, `Generator Serial No`, `Batch Checker`, `Barang Promosi`, dan `Surat Jalan Studio`, termasuk pembungkus lamanya (`LogisticsModal`, `EmbeddedToolsWorkspace`, dan `ToolsGrid`) beserta fungsi kalkulasi spesifik modul tersebut.
- **Keputusan Terkonfirmasi 2 (Hapus Komponen, Hook & Tipe Data Portal Lama)**: Menghapus komponen warisan yang sudah tidak terpakai (`LinkGrid`, `LinkModal`, `Sidebar` To-Do, `QuranTicker`, `LoginModal` lama, `MenuPinAuthModal`, `BroadcastBar`, `PlaceholderTool`, `LazyFallback`), hook `useSupabase` lama (`useLinks`, `useTodos`, `useMenuOrder`), serta tipe data `LinkData` dan `TodoData`.
- **Keputusan Terkonfirmasi 3 (Bersihkan Skrip Sementara di Root)**: Menghapus file skrip bantuan dan draf sementara di direktori utama (`fix_modals*`, `modals.txt`, `test.js`, `todo.md`, dan `DRAFT_firestore.rules`).

---

## 1. Overview & Core Concept

- **What It Does**: Memastikan arsitektur aplikasi 100% selaras dengan tampilan **Menu Operasional (7 modul aktif)**:
  1. **Cek Expired Date (ED)** (`ed-checker`)
  2. **Database Master** (`menu-a`)
  3. **Kedatangan** (`menu-b`)
  4. **Penyiapan** (`menu-d`)
  5. **Pemusnahan** (`menu-e` — termasuk sub-tab integrasi *Cek Fisik Pemusnahan* & *Data Pemusnahan Final*)
  6. **Inventory** (`menu-g` — termasuk sub-modal form, scanner, detail, bulk transfer, bulk location, dan Excel)
  7. **Monitoring Sample** (`menu-sample`)
- **Target Audience / Persona**: Tim operasional gudang, QC, Tally, dan Administrator Logistik Cikembar yang membutuhkan aplikasi cepat, ringan, dan bebas dari kode membengkak (*dead code*).
- **Key Value**: Mengurangi beban ukuran bundel aplikasi, menghilangkan kode yatim (*orphaned modules*) yang berpotensi menimbulkan kebingungan saat pemeliharaan, dan menjaga stabilitas 7 menu utama.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Alur Beranda (Menu Utama)**: Pengguna masuk melalui halaman Login $\rightarrow$ melihat Header status koneksi & tombol Siaran Publik, panel profil Hero (jam digital, ganti avatar, ganti PIN, kelola user bagi Admin), serta kartu **Menu Operasional (7 modul aktif)** persis seperti sedia kala.
  - **Alur Buka Modul & Navigasi**: Klik salah satu dari 7 kartu modul $\rightarrow$ membuka tampilan kerja modul secara instan dengan tombol kembali ke Menu Utama dan navigasi lintas modul (seperti pengiriman item antara *Penyiapan*, *Pemusnahan*, dan *Inventory*).
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian Enterprise SaaS Dashboard yang bersih, kontras tinggi, dan responsif untuk operasional gudang.
  - *Color Palette & Mood*: Kanvas netral terang (`bg-slate-50`, permukaan kartu `bg-white` dengan border halus `border-slate-200/90`), dipadukan aksen warna semantik per modul (Biru untuk ED Checker, Indigo untuk Database Master, Emerald untuk Kedatangan, Sky untuk Penyiapan, Rose untuk Pemusnahan, Teal untuk Inventory & Monitoring Sample).
  - *Typography & Hierarchy*: Hierarki tipografi sans-serif yang tegas untuk judul modul dan label aksi, dipadukan font monospace (`font-mono`) untuk jam operasional, kode batch, LPN, dan angka kuantitas.
  - *Component Styling & Layout*: Kontainer utama `max-w-[1440px]` dengan grid 6 kolom proporsional pada layar desktop untuk kartu Menu Operasional.
- **Interactive Feedback & Motion**: Mempertahankan seluruh indikator aktif, umpan balik *toast*, peringatan sesi inaktif 30 menit, serta popup interkom Siaran Publik tanpa perubahan perilaku.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Mempertahankan `CekFisikPemusnahanModule` sebagai Bagian Integral dari Menu `Pemusnahan`**
  - *Chosen Approach*: Modul `CekFisikPemusnahanModule` tetap dipertahankan karena merupakan sub-tab utama (*Tab 1: Cek Fisik Pemusnahan*) di dalam menu **Pemusnahan** sebelum data ditransfer ke *Tab 2: Data Pemusnahan Final*.
  - *Why*: Menjaga alur kerja *staging* verifikasi fisik ke pemusnahan final agar tidak rusak.
  - *Alternatives Considered*: Menghapus semua file selain 7 nama file modul utama—ditolak karena akan merusak fitur sub-tab di dalam menu Pemusnahan.
- **Decision 2: Pemangkasan Fungsi Kalkulasi & Tipe Data Warisan**
  - *Chosen Approach*: Menghapus fungsi kalkulasi yang hanya dipakai oleh modul yang dihapus (`aggregateStockOpnameRows`, `processMB52Rows`, `generateSerialNumberList`, `compareLargoAndSap`) serta tipe `LinkData` dan `TodoData`, sambil mempertahankan seluruh fungsi kalkulasi tanggal/batch/rak (`edComputeExpiredRow`, `getEdIsoDateString`, `normalizeToIsoDate`, `formatRakLocation`).
  - *Why*: Memastikan utilitas dan definisi tipe data hanya berisi kontrak data yang benar-benar digunakan oleh 7 modul operasional aktif.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Root Application Providers                          │
│  ErrorBoundary -> ConnectionStatus -> Auth -> Notification -> PWA ->       │
│  BroadcastProvider                                                         │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         App Shell (Home / Module)                          │
│  ├─ LoginPage (Jika belum autentikasi)                                     │
│  ├─ Header Bar (ConnectionStatusBadge, PWA Update, Siaran Publik)          │
│  ├─ Hero Panel (Profil, Jam Operasional, AvatarPicker, ChangePin, Admin)   │
│  └─ ToolsGridMenu (Menu Operasional: 7 Modul Aktif)                        │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼
  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
  │   Cek   ││Database ││Kedatang-││Penyiapan││Pemusnah-││Inventory││Monitor  │
  │   ED    ││ Master  ││   an    ││Outbound ││   an    ││ Gudang  ││ Sample  │
  └─────────┘└─────────┘└─────────┘└────┬────┘└────┬────┘└────┬────┘└─────────┘
                                        │          │          │
                                        │     ┌────┴────┐     │
                                        │     │Cek Fisik│     │
                                        │     │ & Final │     │
                                        │     └─────────┘     │
                                        └──────────┼──────────┘
                                    (Relasi Transfer Antar Modul)
```

- **Data Model & State**:
  - Mempertahankan entitas data aktif pada Supabase Cloud: `UserProfile`, `BroadcastMessage`, `DataBarang`, `DataDistributor`, `IncomingItem`, `PenyiapanItem`, `CekFisikPemusnahanItem`, `PemusnahanItem`, `InventoryItem`, dan `MonitoringSampleItem`.
  - Menghapus state & langganan realtime tabel lama (`links`, `todos`, dan `settings.menu_order`) yang sudah tidak digunakan.
- **Interactive Component & State Mapping**:
  - Navigasi `currentView` (`'home' | 'module'`) dan `activeToolId` (`ToolId`) di komponen utama langsung merender salah satu dari 7 modul aktif tanpa cabang *fallback* `PlaceholderTool` yang tidak terpakai.
  - Seluruh aksi lintas modul (`onNavigateToPemusnahan`, `onNavigateToPenyiapan`, `onNavigateToInventory`) tetap terhubung secara utuh.
