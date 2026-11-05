# Peningkatan Akurasi Kemiripan Suara (Fuzzy & Phonetic Voice Login)

Meningkatkan akurasi pengenalan suara pada form login dengan **3 lapis kecerdasan pencocokan kemiripan (Phonetic Normalization, Fuzzy Matching ke akun terdaftar, dan Parser Angka Bahasa Indonesia Lengkap)** sehingga pengucapan yang sedikit meleset karena kebisingan gudang atau logat bicara tetap otomatis terkoreksi ke Username dan Kode PIN yang tepat.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan peningkatan akurasi yang telah dikonfirmasi dari jawaban Anda:

- **Koreksi Otomatis ke Akun Terdaftar Paling Mirip**: Jika ucapan Username terdengar sedikit meleset (seperti *"atmin"*, *"amin"*, *"adnin"* -> **`admin`**, atau *"logistic"*, *"logisti"* -> **`logistik`**), sistem otomatis mencocokkan dan mengoreksinya ke akun terdaftar yang paling mendekati berdasarkan kemiripan huruf (Levenshtein + Fuse) dan kemiripan bunyi fonetik bahasa Indonesia.
- **Dukungan Ejaan Per Digit & Angka Gabungan (Belasan, Puluhan, Ratusan)**: Mendukung baik pengucapan per digit (*"tiga sembilan sembilan tiga tiga sembilan"*) maupun pengucapan angka gabungan (*"tiga puluh sembilan"*, *"sembilan belas"*, *"tiga ratus sembilan puluh sembilan"*) serta variasi bunyi mirip (homofon seperti *"tuju"* -> `7`, *"lapan"* -> `8`, *"nam"* -> `6`, *"pat"* -> `4`, *"kosong/null"* -> `0`).
- **Seleksi Multi-Alternatif (`maxAlternatives = 5`)**: Mengaktifkan hingga 5 kandidat transkrip suara dari mesin pengenal suara browser dan memilih kandidat yang menghasilkan kecocokan Username & PIN terbaik dengan data pengguna di sistem.

## 1. Overview & Core Concept

- **What It Does**: Memproses hasil rekaman suara melalui mesin normalisasi fonetik bahasa Indonesia, algoritma pencocokan kemiripan kata (Fuzzy/Levenshtein Similarity), dan pengurai angka bahasa Indonesia (satuan, belasan, puluhan, ratusan) sebelum menjalankan auto-login.
- **Target Audience / Persona**: Staf operasional gudang dan administrator Logistik Cikembar yang menggunakan fitur Login Suara di lingkungan kerja nyata yang mungkin memiliki variasi pelafalan atau kebisingan latar.
- **Key Value**: Mengurangi kegagalan login akibat salah dengar mesin Speech-to-Text (misalnya huruf `d`/`t`, `k`/`g`, `f`/`p`, atau angka yang digabung menjadi puluhan/belasan oleh browser).

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Ucap Username & PIN**: Pengguna menekan tombol **Login Suara** lalu mengucapkan kredensialnya (misal: *"atmin tiga puluh sembilan sembilan puluh tiga tiga sembilan"* atau *"admin tiga sembilan sembilan tiga tiga sembilan"*).
  2. **Koreksi Cerdas & Pratinjau**: Sistem otomatis mengoreksi `"atmin"` -> `"admin"` dan `"tiga puluh sembilan..."` -> `"399339"`, menampilkan hasil koreksi di bawah tombol mikrofon (`Terdengar: "..." → Dikoreksi: admin • 6 digit PIN`), lalu langsung memverifikasi login.
  3. **Pencocokan Berlapis saat Verifikasi**: Jika terdapat beberapa kandidat transkrip dari browser, sistem memprioritaskan kandidat yang cocok dengan pasangan Username dan PIN di database sehingga login berhasil dalam sekali ucap.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tetap mempertahankan tombol mikrofon ringkas di bawah kolom PIN dengan tambahan indikator teks kecil yang menampilkan hasil koreksi kemiripan secara transparan.
  - *Color Palette & Mood*: Konsisten menggunakan warna netral `slate` saat siaga, `rose` saat mendengarkan, dan `emerald` saat kredensial berhasil dikenali.
  - *Typography & Hierarchy*: Teks pratinjau transkrip dan hasil koreksi berukuran ringkas (`text-[11px]`) di bawah tombol mikrofon tanpa mengubah tinggi kartu login.
- **Interactive Feedback & Motion**:
  - Tetap dilengkapi **Suara Balasan Otomatis (TTS Bahasa Indonesia)** yang memberi tahu pengguna secara lisan apabila Username/PIN masih keliru atau saat login berhasil.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Normalisasi Fonetik Bahasa Indonesia + Skor Kemiripan Levenshtein**
  - *Chosen Approach*: Menyetarakan huruf yang sering tertukar saat diucapkan dalam bahasa Indonesia (`d`/`t`, `b`/`p`, `g`/`k`, `v`/`f`, `z`/`s`, `j`/`c`, serta penghilangan huruf ganda) lalu menghitung persentase kemiripan dengan setiap `username` dan `nama` di `usersList`.
  - *Why*: Mesin pengenal suara sering menangkap konsonan akhir atau tengah yang mirip bunyinya (contoh: `"atmin"` vs `"admin"`, `"pelaksana"` vs `"plaksana"`).
- **Decision 2: Parser Kata Bilangan Bahasa Indonesia Lengkap (Satuan, Belasan, Puluhan, Ratusan + Homofon)**
  - *Chosen Approach*: Mengonversi rangkaian kata angka seperti `"sepuluh"` (`10`), `"sebelas"` (`11`), `"dua belas"` (`12`), `"dua puluh lima"` (`25`), `"tiga ratus"` (`300`), serta kata mirip bunyi (`"sato"`/`"atu"` -> `1`, `"duwa"`/`"tua"` -> `2`, `"tika"`/`"tega"` -> `3`, `"pat"`/`"ampat"` -> `4`, `"limo"` -> `5`, `"nam"`/`"nem"` -> `6`, `"tuju"` -> `7`, `"lapan"` -> `8`, `"semilan"`/`"milan"` -> `9`, `"osong"`/`"null"` -> `0`).
  - *Why*: Pengguna bisa mengucapkan PIN baik digit demi digit maupun per dua/tiga angka sekaligus secara alami.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌────────────────────────────────────────────────────────────────────────┐
│                       SpeechRecognition (id-ID)                        │
│                 (Mengambil hingga 5 Kandidat Alternatif)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Indonesian Voice Credential Smart Matcher                │
│                                                                        │
│  1. Phonetic & Number Tokenizer                                        │
│     • Homofon Angka ("tuju"->7, "lapan"->8, "pat"->4, "nam"->6, dll.)  │
│     • Komposisi Belasan/Puluhan/Ratusan ("tiga puluh sembilan" -> 39)  │
│                                                                        │
│  2. Fuzzy & Phonetic Username Resolver                                 │
│     • Normalisasi Fonetik Konsonan (d≈t, k≈g, p≈b, f≈v)                │
│     • Skor Kemiripan Levenshtein & Substring ke daftar `usersList`     │
│     • Pilih Akun Terdaftar Paling Mirip                                │
│                                                                        │
│  3. Multi-Alternative Best Candidate Selector                          │
│     • Evaluasi semua kandidat alternatif transkrip                     │
│     • Prioritaskan kandidat yang cocok dengan User + PIN valid         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Auto-Submit Login & Suara Balasan (TTS id-ID)             │
└────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `HOMOPHONE_DIGIT_MAP`: Peta kata bilangan dan kata mirip bunyi ke nilai numerik `0–9`.
  - `parseIndonesianNumberTokens(tokens)`: Fungsi pengurai deretan kata angka satuan, `belas`, `puluh`, dan `ratus` menjadi string digit PIN yang presisi.
  - `findBestMatchingUser(spokenWord, usersList)`: Fungsi pencari akun terdaftar paling mirip menggunakan kombinasi skor karakter dan kemiripan fonetik.
- **Interactive Component & State Mapping**:
  - Saat pengguna berbicara, seluruh alternatif transkrip dari `event.results` dievaluasi oleh `selectBestVoiceCredential()`, menampilkan hasil koreksi terbaik langsung di kolom input Username & PIN, dan mengeksekusi login otomatis saat pengucapan selesai.
