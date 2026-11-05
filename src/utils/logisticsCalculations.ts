export interface EdComputeResult {
  material: string;
  description: string;
  batch: string;
  tglMixing: Date | null;
  sledEd: Date | null;
  lamaEdTahun: number;
  batchUnix: string;
  kodeNumerik: number | null;
  doy: number | null;
  digitTahunProduksi: number | null;
  tahunProduksi: number | null;
  status: string;
}

/**
 * Menghitung Expired Date, Tgl Mixing, DOY, dan Validasi Batch
 * @param {string} material - Kode Material (misal: "21104501")
 * @param {string} description - Deskripsi Produk (misal: "KINO SAMANTHA HAIR OIL")
 * @param {string} rawBatch - Kode Batch mentah (misal: "L911346N")
 * @param {Date} [todayOverride] - Tanggal acuan (default: Hari Ini)
 */
export function edComputeExpiredRow(
  material: string,
  description: string,
  rawBatch: string,
  todayOverride?: Date
): EdComputeResult {
  const today = todayOverride || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const rawB = String(rawBatch || '').trim();
  
  // 1. Bersihkan karakter abjad di akhir batch (misal: "L911346N" -> "911346")
  let batchUnix = rawB;
  const last1 = rawB.slice(-1);
  const last2 = rawB.slice(-2);
  let strip = 0;
  if (/^[A-Za-z]$/.test(last1)) strip += 1;
  if (/^[A-Za-z]{2}$/.test(last2)) strip += 1;
  if (strip > 0) batchUnix = rawB.slice(0, rawB.length - strip);

  // 2. Tentukan Masa Simpan (ED) berdasarkan kata kunci pada Nama Barang
  const d = String(description || '').toUpperCase();
  let lamaEdTahun = 3; // Default 3 Tahun
  if (d.includes('PAPER')) lamaEdTahun = 5;
  else if (d.includes('OLIVE') && d.includes('OIL')) lamaEdTahun = 4;
  else if (d.includes('Q-LIFE') || d.includes('KESET') || (d.includes('SAMANT') && d.includes('20'))) lamaEdTahun = 2;
  else if (d.includes('PIA')) lamaEdTahun = 1;

  const isAbstract = d.includes('ABSTRAC');
  let status = 'OK';
  let kodeNumerik: number | null = null, doy: number | null = null, digitThn: number | null = null, tahunProduksi: number | null = null;
  let tglMixing: Date | null = null, sled: Date | null = null;

  // 3. Ambil 4 digit terakhir dari Unix Batch (Format: [DOY 3 Digit][Digit Tahun 1 Digit])
  const last4 = batchUnix.slice(-4);
  if (!batchUnix) {
    status = 'Cek: Batch kosong / tidak valid';
  } else if (!/^\d{1,4}$/.test(last4)) {
    status = 'Cek: Batch Unix gagal terbaca (4 digit kode tidak ditemukan)';
  } else {
    kodeNumerik = parseInt(last4, 10);
    doy = Math.floor(kodeNumerik / 10);      // 3 Digit Pertama = DOY (Hari ke-N dalam tahun)
    digitThn = kodeNumerik % 10;              // Digit Terakhir = Digit Terakhir Tahun Produksi
    
    // Hitung Tahun Produksi: Digit terakhir batch adalah angka satuan tahun pada dekade 2020-an
    // Contoh: digit 2 -> 2022 (ED +3 thn -> 2025)
    //         digit 3 -> 2023 (ED +3 thn -> 2026)
    //         digit 4 -> 2024 (ED +3 thn -> 2027)
    //         digit 5 -> 2025 (ED +3 thn -> 2028)
    //         digit 6 -> 2026 (ED +3 thn -> 2029)
    //         digit 7 -> 2027 (ED +3 thn -> 2030)
    tahunProduksi = 2020 + digitThn;
    
    if (doy < 1 || doy > 366) {
      status = 'Cek: Hari ke-N (DOY) di luar rentang valid';
    } else {
      // Hitung Tanggal Mixing: 1 Jan + (DOY - 1) hari
      tglMixing = new Date(tahunProduksi, 0, 1);
      tglMixing.setDate(tglMixing.getDate() + (doy - 1));
      
      if (tglMixing.getFullYear() !== tahunProduksi) {
        status = 'Cek: Hari ke-N (DOY) tidak valid untuk tahun produksi ini';
        tglMixing = null;
      }
    }
  }

  // 4. Hitung SLED (Shelf Life Expiration Date)
  if (isAbstract) {
    sled = new Date(9999, 11, 31); // Non-expired
    if (status === 'OK') status = 'OK (Non-Expired)';
  } else if (tglMixing) {
    sled = new Date(tglMixing.getTime());
    const targetYr = sled.getFullYear() + lamaEdTahun;
    const month = sled.getMonth();
    const day = sled.getDate();
    sled.setFullYear(targetYr, month, day);
    if (sled.getMonth() !== month) {
      sled.setFullYear(targetYr, month + 1, 0); // Penanganan tahun kabisat (29 Feb)
    }
    if (status === 'OK') {
      if (sled < today) {
        status = 'PERHATIAN: Sudah Expired';
      } else if (tglMixing > today) {
        status = 'OK (Planning / Masa Depan)';
      }
    }
  }

  return {
    material: material || '',
    description: description || '',
    batch: rawB,
    tglMixing,            // Date object
    sledEd: sled,         // Date object
    lamaEdTahun,
    batchUnix,
    kodeNumerik,
    doy,
    digitTahunProduksi: digitThn,
    tahunProduksi,
    status
  };
}

/**
 * Mengubah Date SLED menjadi string ISO YYYY-MM-DD yang cocok untuk input type="date"
 */
export function getEdIsoDateString(
  material: string,
  description: string,
  rawBatch: string
): { isoDate: string; result: EdComputeResult } | null {
  const cleanBatch = String(rawBatch || '').trim();
  if (!cleanBatch) return null;
  const result = edComputeExpiredRow(material, description, cleanBatch);
  if (!result.sledEd) return null;

  if (result.sledEd.getFullYear() === 9999) {
    return { isoDate: '9999-12-31', result };
  }

  const yyyy = result.sledEd.getFullYear();
  const mm = String(result.sledEd.getMonth() + 1).padStart(2, '0');
  const dd = String(result.sledEd.getDate()).padStart(2, '0');
  return { isoDate: `${yyyy}-${mm}-${dd}`, result };
}

/**
 * Normalisasi nilai tanggal dari berbagai format (Excel serial number, DD/MM/YYYY, DD-MM-YYYY, Text, dll)
 * menjadi format standar ISO 'YYYY-MM-DD' yang aman dan valid untuk kolom DATE Supabase / PostgreSQL.
 * Jika kosong atau tidak valid, mengembalikan null (bukan string kosong "") agar tidak error di PostgreSQL.
 */
export function normalizeToIsoDate(val: any): string | null {
  if (val === null || val === undefined) return null;
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    if (val.getFullYear() === 9999) return '9999-12-31';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let str = String(val).trim();
  if (
    !str || 
    str === '-' || 
    str === '--' || 
    str.toLowerCase() === 'null' || 
    str.toLowerCase() === 'undefined' || 
    str.toLowerCase() === 'n/a' || 
    str.toLowerCase() === 'invalid date'
  ) {
    return null;
  }

  // Handle Excel Serial Number (e.g., 46626 -> 2027-08-27)
  if (typeof val === 'number' || (/^\d{4,5}(\.\d+)?$/.test(str) && Number(str) >= 1000 && Number(str) <= 90000)) {
    const serial = typeof val === 'number' ? val : parseFloat(str);
    const utcDays = Math.floor(serial - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 27/08/2027, 27-08-2027, 27.08.2027, 5/8/2027)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(\s.*|T.*)?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Handle YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD (e.g. 2027-08-27, 2027/08/27, 2027.08.27)
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(\s.*|T.*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Handle Textual Month Format (e.g. 27-Aug-2027, 27 Agustus 2027, Aug 27, 2027)
  const monthMap: Record<string, string> = {
    jan: '01', januari: '01', january: '01',
    feb: '02', februari: '02', february: '02',
    mar: '03', maret: '03', march: '03',
    apr: '04', april: '04',
    mei: '05', may: '05',
    jun: '06', juni: '06', june: '06',
    jul: '07', juli: '07', july: '07',
    agu: '08', ags: '08', agustus: '08', aug: '08', august: '08',
    sep: '09', september: '09',
    okt: '10', oktober: '10', oct: '10', october: '10',
    nop: '11', nov: '11', november: '11',
    des: '12', desember: '12', dec: '12', december: '12'
  };

  const dmyTextMatch = str.match(/^(\d{1,2})[\s\-_]+([a-zA-Z]+)[\s\-_]+(\d{2,4})/);
  if (dmyTextMatch) {
    const day = parseInt(dmyTextMatch[1], 10);
    const mKey = dmyTextMatch[2].toLowerCase();
    let year = parseInt(dmyTextMatch[3], 10);
    if (year < 100) year += 2000;
    const monthStr = monthMap[mKey];
    if (monthStr && day >= 1 && day <= 31) {
      return `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
    }
  }

  const mdyTextMatch = str.match(/^([a-zA-Z]+)[\s\-_]+(\d{1,2})[,\s\-_]+(\d{2,4})/);
  if (mdyTextMatch) {
    const mKey = mdyTextMatch[1].toLowerCase();
    const day = parseInt(mdyTextMatch[2], 10);
    let year = parseInt(mdyTextMatch[3], 10);
    if (year < 100) year += 2000;
    const monthStr = monthMap[mKey];
    if (monthStr && day >= 1 && day <= 31) {
      return `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
    }
  }

  // Fallback to JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1900 && y <= 9999) {
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * Otomatis memformat input kode rak 6 digit huruf/angka menjadi format standar:
 * CKB-FG1-XX-YY-ZZ
 * Contoh: "ae22ia" -> "CKB-FG1-AE-22-IA" / "ae221a" -> "CKB-FG1-AE-22-1A"
 */
export function formatRakLocation(input: string): string {
  if (!input) return '';
  let str = input.trim().toUpperCase();

  // Strip prefix yang mungkin sudah ada (misal: CKB-FG1- atau CKB-FG1)
  if (str.startsWith('CKB-FG1-')) {
    str = str.slice(8);
  } else if (str.startsWith('CKBFG1-')) {
    str = str.slice(7);
  } else if (str.startsWith('CKB-FG1')) {
    str = str.slice(7);
  } else if (str.startsWith('CKBFG1')) {
    str = str.slice(6);
  }

  // Hapus semua karakter selain huruf A-Z dan angka 0-9
  const clean = str.replace(/[^A-Z0-9]/g, '').slice(0, 6);

  if (!clean) return '';

  if (clean.length <= 2) {
    return `CKB-FG1-${clean}`;
  } else if (clean.length <= 4) {
    return `CKB-FG1-${clean.slice(0, 2)}-${clean.slice(2)}`;
  } else {
    return `CKB-FG1-${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4)}`;
  }
}
