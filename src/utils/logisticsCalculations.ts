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
    
    // Hitung Tahun Produksi dengan rolling window dekade yang tepat (Era 2020-an/2030-an)
    // Contoh: digit 6 -> 2026 (ED 2029), digit 7 -> 2027 (ED 2030), digit 8 -> 2028 (ED 2031), digit 9 -> 2029 (ED 2032), digit 0 -> 2030 (ED 2033)
    const currentYear = today.getFullYear();
    const currentDecade = Math.floor(currentYear / 10) * 10;
    const currentLastDigit = currentYear % 10;

    tahunProduksi = currentDecade + digitThn;
    const diff = digitThn - currentLastDigit;

    // Jika digit jauh lebih kecil dari digit tahun berjalan (misal tahun berjalan 2026 tapi digit 0, 1, 2),
    // maka batch tersebut adalah batch produksi mendatang (2030, 2031, 2032)
    if (diff < -3) {
      tahunProduksi += 10;
    } else if (diff > 6) {
      tahunProduksi -= 10;
    }
    
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
 * Memproses dan mengagregasi baris data mentah Stock Opname (SUMIFS berdasarkan Location + ItemCode + SLOC)
 */
export function aggregateStockOpnameRows(rows: Array<{
  no?: number;
  location: string;
  itemCode: string;
  itemName: string;
  sloc: string;
  lastQty: number;
}>) {
  const map = new Map();
  rows.forEach(r => {
    const key = r.location + '||' + r.itemCode + '||' + r.sloc;
    if (!map.has(key)) {
      map.set(key, {
        no: r.no || 1,
        location: r.location,
        itemCode: r.itemCode,
        itemName: r.itemName,
        sloc: r.sloc,
        lastQty: 0
      });
    }
    map.get(key).lastQty += Number(r.lastQty) || 0;
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.sloc !== b.sloc) return a.sloc.localeCompare(b.sloc);
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    return a.itemCode.localeCompare(b.itemCode);
  });
}

/**
 * Memproses data MB52 SAP (Last Qty = Unrestricted + Transit + Blocked)
 */
export function processMB52Rows(jsonRows: Array<Record<string, any>>) {
  return jsonRows.map(r => {
    const material = String(r['Material'] || r['Item Code'] || r['Kode Barang'] || '').trim();
    const unrestricted = Number(r['Unrestricted'] || r['Stok Unrestricted'] || 0) || 0;
    const transit = Number(r['Transit and Transfer'] || r['Transit'] || 0) || 0;
    const blocked = Number(r['Blocked'] || r['Stok Blocked'] || 0) || 0;
    const sloc = String(r['Storage Location'] || r['SLOC'] || r['Sloc'] || '').trim();
    
    return {
      material,
      desc: String(r['Material Description'] || r['Item Name'] || r['Nama Barang'] || '').trim(),
      plant: String(r['Plant'] || '').trim(),
      sloc,
      unrestricted,
      transit,
      blocked,
      lastQty: unrestricted + transit + blocked, // Total Stok Fisik/Sistem SAP
      group: material.toUpperCase().startsWith('FG') ? 'FG' : 'PACKAGING'
    };
  }).filter(r => r.sloc && r.material);
}

const generatedSNs = new Set<string>();

/**
 * Generate Serial Number dari teks input Excel (Tab Separated Lines)
 */
export function generateSerialNumberList(inputText: string) {
  if (!inputText.trim()) return [];
  
  const rows = inputText.split('\n');
  const d = new Date();
  const dateStr = String(d.getFullYear()).slice(-2) + 
                  String(d.getMonth() + 1).padStart(2, '0') + 
                  String(d.getDate()).padStart(2, '0');
  
  const results: Array<{ sn: string; rawCols: string[] }> = [];
  let count = 0;
  rows.forEach(row => {
    if (!row.trim()) return;
    const cols = row.split('\t');
    if (cols.length > 0) {
      count++;
      const binLoc = (cols[0] || '').trim();
      // Ambil 8 karakter terakhir bin location (dipad 8 digit nol jika kurang)
      const rightBin = binLoc.length > 8 ? binLoc.slice(-8) : binLoc.padStart(8, '0');
      
      let sn: string;
      let attempt = 0;
      do {
        let randNum = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
        if (attempt > 50) randNum = String(count).padStart(4, '0'); // Fallback jika konflik
        sn = `FGKINO-${dateStr}${rightBin}${randNum}`;
        attempt++;
      } while (generatedSNs.has(sn));
      generatedSNs.add(sn);
      results.push({ sn, rawCols: cols.map(c => (c || '').trim()) });
    }
  });
  return results;
}

export interface CompareResultRow {
  no: number;
  sloc: string;
  item: string;
  desc: string;
  bLargo: string;
  bSap: string;
  qLargo: number;
  qSap: number;
  diff: number;
  status: 'MATCH' | 'QTY_DIFF' | 'REPLACE' | 'NO_CANDIDATE' | 'LARGO_ONLY';
  rec: string;
}

/**
 * Melakukan perbandingan (Reconciliation) data LARGO vs SAP
 */
export function compareLargoAndSap(
  largoRows: Array<{ sloc: string; item: string; desc?: string; batch: string; qty: any }>,
  sapRows: Array<{ sloc: string; item: string; desc?: string; batch: string; unrestricted?: any; blocked?: any; qty?: any }>
): CompareResultRow[] {
  // Normalize material/item code: strip leading zeroes ONLY if numeric
  const normItem = (s: any) => {
    const str = String(s ?? '').trim().toUpperCase();
    if (/^\d+$/.test(str)) {
      return str.replace(/^0+/, '') || '0';
    }
    return str;
  };

  // Normalize SLOC: clean whitespace, uppercase
  const normSloc = (s: any) => String(s ?? '').trim().toUpperCase();

  // Normalize Batch: preserve exact characters without stripping leading zeroes
  const normBatch = (s: any) => String(s ?? '').trim().toUpperCase();

  // Robust Quantity Parser
  const pQty = (v: any) => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (v === null || v === undefined) return 0;
    let str = String(v).trim();
    if (!str) return 0;

    // Handle thousand/decimal formats
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        // Indonesian: 1.250,50 -> 1250.50
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // Standard: 1,250.50 -> 1250.50
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      // Check if comma is decimal (e.g. 100,5) or thousand (e.g. 1,000)
      if (/,\d{1,2}$/.test(str)) {
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.round(n * 1000) / 1000;
  };

  // 1. Grouping LARGO (Key: Sloc || Item || Batch)
  const largoMap = new Map<string, { sloc: string; item: string; origItem: string; desc: string; bat: string; qty: number }>();
  largoRows.forEach(r => {
    const sloc = normSloc(r.sloc);
    const item = normItem(r.item);
    const bat = normBatch(r.batch);
    if (!item || !bat) return;

    const key = `${sloc}||${item}||${bat}`;
    if (!largoMap.has(key)) {
      largoMap.set(key, { 
        sloc: r.sloc ? String(r.sloc).trim() : sloc, 
        item, 
        origItem: String(r.item).trim(),
        desc: r.desc ? String(r.desc).trim() : '', 
        bat: String(r.batch).trim(), 
        qty: 0 
      });
    }
    largoMap.get(key)!.qty += pQty(r.qty);
  });

  // 2. Grouping SAP (Key: Sloc || Item || Batch)
  const sapMap = new Map<string, { sloc: string; item: string; origItem: string; desc: string; bat: string; qty: number }>();
  sapRows.forEach(r => {
    const sloc = normSloc(r.sloc);
    const item = normItem(r.item);
    const bat = normBatch(r.batch);
    if (!item || !bat) return;

    const key = `${sloc}||${item}||${bat}`;
    if (!sapMap.has(key)) {
      sapMap.set(key, { 
        sloc: r.sloc ? String(r.sloc).trim() : sloc, 
        item, 
        origItem: String(r.item).trim(),
        desc: r.desc ? String(r.desc).trim() : '', 
        bat: String(r.batch).trim(), 
        qty: 0 
      });
    }
    const addQty = r.qty !== undefined ? pQty(r.qty) : (pQty(r.unrestricted) + pQty(r.blocked));
    sapMap.get(key)!.qty += addQty;
  });

  // 3. Analisis Match, Selisih Qty, dan Batch Pengganti
  const sapMissing: Array<{ key: string; sloc: string; item: string; origItem: string; desc: string; bat: string; qty: number }> = [];
  const largoMissing: Array<{ key: string; sloc: string; item: string; origItem: string; desc: string; bat: string; qty: number }> = [];

  sapMap.forEach((d, k) => { 
    if (!largoMap.has(k)) sapMissing.push({ ...d, key: k }); 
  });
  largoMap.forEach((d, k) => { 
    if (!sapMap.has(k)) largoMissing.push({ ...d, key: k }); 
  });

  const rawResults: CompareResultRow[] = [];

  // Case A: Item & Batch sama di LARGO & SAP
  sapMap.forEach((sap, key) => {
    if (!largoMap.has(key)) return;
    const largo = largoMap.get(key)!;
    const diff = Math.round((sap.qty - largo.qty) * 1000) / 1000;
    const match = Math.abs(diff) < 0.0001;

    rawResults.push({
      no: 0,
      sloc: sap.sloc || largo.sloc,
      item: sap.origItem || largo.origItem || sap.item,
      desc: sap.desc || largo.desc || '-',
      bLargo: largo.bat,
      bSap: sap.bat,
      qLargo: largo.qty,
      qSap: sap.qty,
      diff,
      status: match ? 'MATCH' : 'QTY_DIFF',
      rec: match ? 'Sesuai' : `Selisih Qty (SAP: ${sap.qty}, LARGO: ${largo.qty})`
    });
  });

  // Case B: Ada di SAP tapi tidak ada di LARGO (Cek kandidat ganti batch)
  const claimedLargoKeys = new Set<string>();

  sapMissing.forEach(sap => {
    // Cari kandidat batch di LARGO dengan SLOC & Item yang sama serta Qty yang sama
    const candidates = largoMissing.filter(l => 
      l.sloc.toUpperCase() === sap.sloc.toUpperCase() && 
      l.item === sap.item && 
      Math.abs(l.qty - sap.qty) < 0.0001 && 
      !claimedLargoKeys.has(l.key)
    );

    if (candidates.length > 0) {
      // Pick first matching candidate
      const cand = candidates[0];
      claimedLargoKeys.add(cand.key);

      rawResults.push({
        no: 0,
        sloc: sap.sloc,
        item: sap.origItem || cand.origItem || sap.item,
        desc: sap.desc || cand.desc || '-',
        bLargo: cand.bat,
        bSap: sap.bat,
        qLargo: cand.qty,
        qSap: sap.qty,
        diff: 0,
        status: 'REPLACE',
        rec: `Ganti Batch SAP [${sap.bat}] -> LARGO [${cand.bat}]`
      });
    } else {
      rawResults.push({
        no: 0,
        sloc: sap.sloc,
        item: sap.origItem || sap.item,
        desc: sap.desc || '-',
        bLargo: '-',
        bSap: sap.bat,
        qLargo: 0,
        qSap: sap.qty,
        diff: sap.qty,
        status: 'NO_CANDIDATE',
        rec: 'Hanya ada di SAP (Tanpa Kandidat di LARGO)'
      });
    }
  });

  // Case C: Hanya ada di LARGO (belum diklaim sebagai replacement)
  largoMissing.forEach(l => {
    if (claimedLargoKeys.has(l.key)) return;

    rawResults.push({
      no: 0,
      sloc: l.sloc,
      item: l.origItem || l.item,
      desc: l.desc || '-',
      bLargo: l.bat,
      bSap: '-',
      qLargo: l.qty,
      qSap: 0,
      diff: -l.qty,
      status: 'LARGO_ONLY',
      rec: 'Hanya ada di LARGO (Belum tercatat di SAP)'
    });
  });

  // Sort deterministically: SLOC -> Item -> Status Priority -> Batch
  const statusPriority: Record<string, number> = {
    'REPLACE': 1,
    'QTY_DIFF': 2,
    'NO_CANDIDATE': 3,
    'LARGO_ONLY': 4,
    'MATCH': 5
  };

  rawResults.sort((a, b) => {
    const slocCmp = a.sloc.localeCompare(b.sloc);
    if (slocCmp !== 0) return slocCmp;

    const itemCmp = a.item.localeCompare(b.item);
    if (itemCmp !== 0) return itemCmp;

    const pA = statusPriority[a.status] || 99;
    const pB = statusPriority[b.status] || 99;
    if (pA !== pB) return pA - pB;

    return (a.bSap || a.bLargo).localeCompare(b.bSap || b.bLargo);
  });

  // Assign clean 1-based sequential row numbers
  return rawResults.map((r, idx) => ({
    ...r,
    no: idx + 1
  }));
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
