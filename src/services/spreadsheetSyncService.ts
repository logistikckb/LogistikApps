/**
 * Layanan Sinkronisasi Google Spreadsheet Terpadu & Anti-Error CORS
 * Menyediakan proteksi bertingkat (Server Proxy, Direct CORS-safe, No-CORS Fallback, dan GViz Fallback)
 * untuk mencegah error "Failed to fetch", "data tidak masuk", dan CORS Block pada Google Apps Script.
 */

import * as XLSX from 'xlsx';

export const DEFAULT_LOGISTIK_SPREADSHEET_ID = '1o8hWUAK6DO1rmggbiRaRNfT7On4c9RhrHR6X07nqZm4';
export const DEFAULT_WORKER_WEBHOOK_URL = 'https://logistikapps.cikembar.workers.dev/';

export interface SpreadsheetConfig {
  webhookUrl?: string;
  spreadsheetId?: string;
  sheetName?: string;
  secretToken?: string;
  mode?: 'overwrite' | 'append';
}

export interface SpreadsheetSyncPayload {
  sheetName: string;
  spreadsheetId?: string;
  secretToken?: string;
  mode?: 'overwrite' | 'append';
  module?: string;
  action?: string;
  headers: string[];
  rows: any[][];
  data?: any[];
  user?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  message: string;
  updatedRows?: number;
  spreadsheetUrl?: string;
  mode?: 'proxy' | 'cors' | 'no-cors' | 'local';
  timestamp?: string;
}

export interface ReadResult {
  success: boolean;
  message: string;
  headers?: string[];
  rows?: any[][];
}

export interface WebhookTestResult {
  success: boolean;
  message: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  isHtml?: boolean;
}

export const PICKING_DEFAULT_HEADERS = [
  'ID Picking',
  'Tujuan',
  'Item Code',
  'Nama Barang',
  'Kategori',
  'Lokasi',
  'Tipe Lokasi',
  'Qty Awal',
  'Qty Akhir',
  'UOM',
  'Qty Convert',
  'UOM Convert',
  'LPN / SN',
  'Batch',
  'Vendor Batch',
  'SLOC',
  'Expired Date',
  'Kode Tujuan',
  'Status QC',
  'User Tally',
  'Shelf Life',
  'Sumber',
  'User Input',
  'Tanggal Update',
  'Status',
  'Catatan / Note'
];

export const APPS_SCRIPT_TEMPLATE = `// =========================================================================
// GOOGLE APPS SCRIPT WEBHOOK UNTUK LOGISTIKAPPS (VERSI TERPADU & ANTI-GAGAL)
// Tempelkan kode ini di: Google Spreadsheet -> Ekstensi -> Apps Script
// Lalu Deploy: New Deployment -> Web App -> Execute as: Me -> Access: Anyone
// =========================================================================

var DEFAULT_SPREADSHEET_ID = '1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420';

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📦 Logistik Cikembar')
      .addItem('1. Buat / Rapikan Header Sheet "Picking"', 'buatHeaderSheetPicking')
      .addItem('2. Inisialisasi Seluruh Sheet Logistik', 'buatSemuaHeaderLogistik')
      .addSeparator()
      .addItem('3. Kosongkan Data Sheet "Picking" (Pertahankan Header)', 'kosongkanDataSheetPicking')
      .addToUi();
  } catch (e) {}
}

function kosongkanDataSheetPicking() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Konfirmasi Kosongkan Data Picking',
    'Apakah Anda yakin ingin menghapus seluruh baris data pada sheet "Picking"? Baris 1 (Judul Kolom) akan tetap dipertahankan.',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var ss = resolveSpreadsheet({});
  if (!ss) return;
  var sheet = resolveSheet(ss, 'Picking');
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    SpreadsheetApp.getActiveSpreadsheet().toast('Seluruh baris data sheet Picking berhasil dikosongkan!', 'Sukses', 5);
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('Sheet Picking sudah kosong (hanya ada header).', 'Info', 4);
  }
}

function buatHeaderSheetPicking() {
  var ss = resolveSpreadsheet({});
  if (!ss) return;
  var sheet = resolveSheet(ss, 'Picking');
  var headers = [
    'ID Picking', 'Tujuan', 'Item Code', 'Nama Barang', 'Kategori', 'Lokasi', 'Tipe Lokasi',
    'Qty Awal', 'Qty Akhir', 'UOM', 'Qty Convert', 'UOM Convert', 'LPN / SN', 'Batch',
    'Vendor Batch', 'SLOC', 'Expired Date', 'Kode Tujuan', 'Status QC', 'User Tally',
    'Shelf Life', 'Sumber', 'User Input', 'Tanggal Update', 'Status', 'Catatan / Note'
  ];
  ensureSheetCapacity(sheet, 10, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1e3a8a');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
    SpreadsheetApp.getActiveSpreadsheet().toast('26 Judul Kolom Sheet "Picking" berhasil dibuat!', 'Sukses', 5);
  } catch (e) {}
}

function buatSemuaHeaderLogistik() {
  buatHeaderSheetPicking();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Payload data kosong.' }, 400);
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ status: 'error', message: 'Format data JSON tidak valid: ' + parseErr.message }, 400);
    }

    var spreadsheet = resolveSpreadsheet(payload);
    if (!spreadsheet) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Spreadsheet tidak ditemukan atau script tidak memiliki izin akses.' 
      }, 404);
    }

    // Tangani aksi ping test
    if (payload.action === 'ping' || payload.action === 'test_connection') {
      return createJsonResponse({
        status: 'success',
        message: 'Koneksi Webhook Berhasil! Terhubung ke: "' + spreadsheet.getName() + '".',
        spreadsheetTitle: spreadsheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        timestamp: new Date().toISOString()
      }, 200);
    }

    var targetSheetName = (payload.sheetName || 'Data').trim();
    var sheet = resolveSheet(spreadsheet, targetSheetName);

    // Tangani Aksi Hapus Baris Berdasarkan ID (delete_rows)
    if (payload.action === 'delete_rows' || payload.action === 'delete_row') {
      var idsToDelete = [];
      if (Array.isArray(payload.ids)) {
        idsToDelete = payload.ids.map(function(id) { return String(id || '').trim(); }).filter(Boolean);
      } else if (payload.id) {
        idsToDelete = [String(payload.id).trim()];
      }

      var lastRow = sheet.getLastRow();
      var keyColIndex = Number(payload.keyColumnIndex) || 1;
      var deletedCount = 0;

      if (lastRow > 1 && idsToDelete.length > 0) {
        var idValues = sheet.getRange(2, keyColIndex, lastRow - 1, 1).getValues();
        for (var r = idValues.length - 1; r >= 0; r--) {
          var val = String(idValues[r][0] || '').trim();
          if (val && idsToDelete.indexOf(val) !== -1) {
            sheet.deleteRow(r + 2);
            deletedCount++;
          }
        }
      }

      return createJsonResponse({
        status: 'success',
        message: 'Berhasil menghapus ' + deletedCount + ' baris dari sheet "' + sheet.getName() + '" di Google Spreadsheet.',
        deletedCount: deletedCount,
        sheetName: sheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        timestamp: new Date().toISOString()
      }, 200);
    }

    // Tangani Aksi Kosongkan Data Sheet (Pertahankan Header)
    if (payload.action === 'clear_sheet_data' || payload.action === 'clear_data') {
      var lastRow = sheet.getLastRow();
      var lastCol = Math.max(sheet.getLastColumn(), 1);
      var clearedCount = 0;

      if (lastRow > 1) {
        clearedCount = lastRow - 1;
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }

      return createJsonResponse({
        status: 'success',
        message: 'Berhasil mengosongkan ' + clearedCount + ' baris data pada sheet "' + sheet.getName() + '". Judul kolom tetap utuh.',
        clearedCount: clearedCount,
        sheetName: sheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        timestamp: new Date().toISOString()
      }, 200);
    }

    var headers = Array.isArray(payload.headers) ? payload.headers : [];
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var mode = (payload.mode === 'append') ? 'append' : 'overwrite';

    if (rows.length === 0 && Array.isArray(payload.data) && payload.data.length > 0) {
      if (headers.length > 0) {
        rows = payload.data.map(function(item) {
          return headers.map(function(h) {
            return (item && item[h] !== undefined) ? item[h] : '';
          });
        });
      } else {
        rows = payload.data.map(function(item) {
          return Object.values(item);
        });
      }
    }

    var maxCols = headers.length;
    for (var r = 0; r < rows.length; r++) {
      if (Array.isArray(rows[r]) && rows[r].length > maxCols) {
        maxCols = rows[r].length;
      }
    }
    if (maxCols === 0) maxCols = 1;

    var cleanHeaders = [];
    if (headers.length > 0) {
      cleanHeaders = sanitizeRow(headers, maxCols);
    }

    var cleanRows = [];
    for (var i = 0; i < rows.length; i++) {
      cleanRows.push(sanitizeRow(rows[i], maxCols));
    }

    if (mode === 'overwrite') {
      sheet.clearContents();

      var allData = [];
      if (cleanHeaders.length > 0) {
        allData.push(cleanHeaders);
      }
      if (cleanRows.length > 0) {
        allData = allData.concat(cleanRows);
      }

      if (allData.length > 0) {
        ensureSheetCapacity(sheet, allData.length + 5, maxCols);
        var writeRange = sheet.getRange(1, 1, allData.length, maxCols);
        writeRange.setValues(allData);

        if (cleanHeaders.length > 0) {
          try {
            var headerRange = sheet.getRange(1, 1, 1, maxCols);
            headerRange.setBackground('#1e3a8a');
            headerRange.setFontColor('#ffffff');
            headerRange.setFontWeight('bold');
            sheet.setFrozenRows(1);
          } catch (e) {}
        }
      }
    } else {
      var lastRow = sheet.getLastRow();
      if (lastRow === 0 && cleanHeaders.length > 0) {
        ensureSheetCapacity(sheet, 10, maxCols);
        sheet.getRange(1, 1, 1, maxCols).setValues([cleanHeaders]);
        try {
          var hRange = sheet.getRange(1, 1, 1, maxCols);
          hRange.setBackground('#1e3a8a');
          hRange.setFontColor('#ffffff');
          hRange.setFontWeight('bold');
          sheet.setFrozenRows(1);
        } catch (e) {}
        lastRow = 1;
      }

      if (cleanRows.length > 0) {
        var startRow = lastRow + 1;
        ensureSheetCapacity(sheet, startRow + cleanRows.length + 5, maxCols);
        sheet.getRange(startRow, 1, cleanRows.length, maxCols).setValues(cleanRows);
      }
    }

    try {
      if (sheet.getLastColumn() > 0) {
        sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 30));
      }
    } catch (e) {}

    return createJsonResponse({
      status: 'success',
      message: 'Berhasil menyimpan ' + cleanRows.length + ' baris data ke sheet "' + sheet.getName() + '".',
      updatedRows: cleanRows.length,
      sheetName: sheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Gagal memproses ke Spreadsheet: ' + error.toString()
    }, 500);
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var spreadsheet = resolveSpreadsheet(params);
    if (!spreadsheet) {
      return createJsonResponse({ status: 'error', message: 'Spreadsheet tidak ditemukan.' }, 404);
    }

    var action = (params.action || '').toLowerCase();
    if (action === 'ping' || action === 'test') {
      return createJsonResponse({
        status: 'success',
        message: 'LogistikApps Webhook aktif dan siap menerima data.',
        spreadsheetTitle: spreadsheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl()
      }, 200);
    }

    var sheetName = (params.sheetName || 'Picking').trim();
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      var allSheets = spreadsheet.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName().trim().toLowerCase() === sheetName.toLowerCase()) {
          sheet = allSheets[s];
          break;
        }
      }
    }

    if (!sheet) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Sheet "' + sheetName + '" tidak ditemukan di Spreadsheet.' 
      }, 404);
    }

    var values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      return createJsonResponse({ status: 'success', headers: [], rows: [] }, 200);
    }

    var headers = values[0] || [];
    var rows = values.slice(1);

    return createJsonResponse({
      status: 'success',
      headers: headers,
      rows: rows,
      totalRows: rows.length,
      sheetName: sheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl()
    }, 200);

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() }, 500);
  }
}

function resolveSpreadsheet(source) {
  var rawId = '';
  if (source && source.spreadsheetId) rawId = String(source.spreadsheetId).trim();
  if (rawId) {
    var match = rawId.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) rawId = match[1];
    try {
      var ss = SpreadsheetApp.openById(rawId);
      if (ss) return ss;
    } catch (e) {}
  }

  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {}

  if (DEFAULT_SPREADSHEET_ID && DEFAULT_SPREADSHEET_ID !== rawId) {
    try {
      var defSs = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
      if (defSs) return defSs;
    } catch (e) {}
  }
  return null;
}

function resolveSheet(spreadsheet, targetSheetName) {
  var cleanName = (targetSheetName || 'Data').trim();
  var sheet = spreadsheet.getSheetByName(cleanName);
  if (sheet) return sheet;

  sheet = spreadsheet.getSheetByName(' ' + cleanName);
  if (sheet) return sheet;

  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === cleanName.toLowerCase()) {
      return sheets[i];
    }
  }

  try {
    return spreadsheet.insertSheet(cleanName);
  } catch (e) {
    return spreadsheet.getActiveSheet() || sheets[0];
  }
}

function ensureSheetCapacity(sheet, neededRows, neededCols) {
  try {
    var curRows = sheet.getMaxRows();
    if (curRows < neededRows) sheet.insertRowsAfter(curRows, Math.max(neededRows - curRows, 10));
    var curCols = sheet.getMaxColumns();
    if (curCols < neededCols) sheet.insertColumnsAfter(curCols, Math.max(neededCols - curCols, 5));
  } catch (e) {}
}

function sanitizeRow(row, targetLen) {
  var clean = [];
  for (var c = 0; c < targetLen; c++) {
    var val = (row && row[c] !== undefined && row[c] !== null) ? row[c] : '';
    if (typeof val === 'object' && !(val instanceof Date)) {
      try { val = JSON.stringify(val); } catch(e) { val = String(val); }
    }
    clean.push(val);
  }
  return clean;
}

function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
`;

/**
 * Validasi dan bersihkan URL Webhook Spreadsheet
 */
export function validateWebhookUrl(rawUrl: string): {
  valid: boolean;
  cleanUrl: string;
  extractedSpreadsheetId?: string;
  warning?: string;
} {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      valid: false,
      cleanUrl: '',
      warning: 'URL Webhook Google Apps Script belum diisi.'
    };
  }

  let clean = rawUrl.trim().replace(/^['"]|['"]$/g, '');

  // Deteksi jika pengguna salah memasukkan link Google Spreadsheet (bukan Webhook)
  if (clean.includes('docs.google.com/spreadsheets/d/')) {
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const extractedId = match ? match[1] : undefined;
    return {
      valid: false,
      cleanUrl: clean,
      extractedSpreadsheetId: extractedId,
      warning: 'URL yang dimasukkan adalah link Dokumen Spreadsheet (docs.google.com), bukan URL Webhook Apps Script! Buat Webhook melalui menu Ekstensi > Apps Script di Google Sheets lalu Deploy sebagai Web App (Who has access: Anyone).'
    };
  }

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  return {
    valid: true,
    cleanUrl: clean
  };
}

/**
 * Baca konfigurasi global terpadu yang tersimpan di localStorage
 */
export function getGlobalSpreadsheetConfig(): SpreadsheetConfig {
  const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || DEFAULT_WORKER_WEBHOOK_URL;
  const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || DEFAULT_LOGISTIK_SPREADSHEET_ID;

  const storageKeys = [
    'LOGISTIK_GSHEET_WEBHOOK_CONFIG',
    'PICKING_GSHEET_WEBHOOK_CONFIG',
    'INVENTORY_GSHEET_WEBHOOK_CONFIG',
    'PENYIAPAN_GSHEET_WEBHOOK_CONFIG',
    'PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG',
    'REPACK_GSHEET_WEBHOOK_CONFIG',
    'RECO_GSHEET_WEBHOOK_CONFIG'
  ];

  let webhookUrl = defaultEnvUrl;
  let spreadsheetId = defaultEnvSpreadsheetId;
  let secretToken = '';

  for (const key of storageKeys) {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (!webhookUrl && parsed.webhookUrl && typeof parsed.webhookUrl === 'string' && parsed.webhookUrl.trim()) {
          webhookUrl = parsed.webhookUrl.trim();
        }
        if ((!spreadsheetId || spreadsheetId === DEFAULT_LOGISTIK_SPREADSHEET_ID) && parsed.spreadsheetId && typeof parsed.spreadsheetId === 'string' && parsed.spreadsheetId.trim()) {
          spreadsheetId = parsed.spreadsheetId.trim();
        }
        if (!secretToken && parsed.secretToken) {
          secretToken = parsed.secretToken;
        }
      }
    } catch {}
  }

  return {
    webhookUrl,
    spreadsheetId: spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID,
    secretToken
  };
}

/**
 * Simpan konfigurasi Spreadsheet ke seluruh storage agar otomatis sinkron di semua modul
 */
export function saveGlobalSpreadsheetConfig(config: SpreadsheetConfig): void {
  const storageKeys = [
    'LOGISTIK_GSHEET_WEBHOOK_CONFIG',
    'PICKING_GSHEET_WEBHOOK_CONFIG',
    'INVENTORY_GSHEET_WEBHOOK_CONFIG',
    'PENYIAPAN_GSHEET_WEBHOOK_CONFIG',
    'PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG',
    'REPACK_GSHEET_WEBHOOK_CONFIG',
    'RECO_GSHEET_WEBHOOK_CONFIG'
  ];

  for (const key of storageKeys) {
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({
        ...existing,
        webhookUrl: config.webhookUrl !== undefined ? config.webhookUrl : existing.webhookUrl,
        spreadsheetId: config.spreadsheetId !== undefined ? config.spreadsheetId : (existing.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID),
        secretToken: config.secretToken !== undefined ? config.secretToken : existing.secretToken,
        mode: config.mode || existing.mode || 'overwrite'
      }));
    } catch {}
  }
}

/**
 * Uji koneksi Webhook Google Apps Script secara real-time
 */
export async function testSpreadsheetWebhook(config: SpreadsheetConfig): Promise<WebhookTestResult> {
  const { valid, cleanUrl, warning } = validateWebhookUrl(config.webhookUrl || '');
  if (!valid) {
    return {
      success: false,
      message: warning || 'URL Webhook belum diisi atau tidak valid.'
    };
  }

  const spreadsheetId = (config.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID).trim();

  // 1. Coba via API Proxy
  try {
    const proxyUrl = new URL('/api/spreadsheet-test', window.location.origin);
    proxyUrl.searchParams.set('webhookUrl', cleanUrl);
    if (spreadsheetId) proxyUrl.searchParams.set('spreadsheetId', spreadsheetId);

    const res = await fetch(proxyUrl.toString());
    const data = await res.json();

    if (res.ok && data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Koneksi Webhook Berhasil! Script siap menerima data.',
        spreadsheetTitle: data.spreadsheetTitle,
        spreadsheetUrl: data.spreadsheetUrl
      };
    } else {
      return {
        success: false,
        message: data.message || data.error || 'Server Webhook menolak permintaan uji coba.',
        isHtml: data.isHtml
      };
    }
  } catch (proxyErr) {
    // 2. Direct browser fallback check
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'ping');
      if (spreadsheetId) getUrl.searchParams.set('spreadsheetId', spreadsheetId);

      const directRes = await fetch(getUrl.toString());
      if (directRes.ok) {
        const text = await directRes.text();
        if (text.includes('Sign in') || text.includes('accounts.google.com')) {
          return {
            success: false,
            message: 'Akses Ditolak: Webhook memerlukan Google Sign-in. Di Apps Script, buka Deploy > Manage Deployments > Edit > Ubah "Who has access" menjadi "Anyone" (Siapa saja).'
          };
        }
        return {
          success: true,
          message: 'Webhook merespons dengan status OK! Siap digunakan.'
        };
      }
    } catch (e: any) {
      return {
        success: false,
        message: 'Tidak dapat menghubungi Webhook. Pastikan URL benar dan Web App diset "Who has access: Anyone".'
      };
    }
  }

  return {
    success: false,
    message: 'Gagal melakukan uji koneksi ke Webhook.'
  };
}

/**
 * Ekspor data langsung ke file Excel (.xlsx) untuk cadangan offline dan import manual langsung
 */
export function exportToExcelFile(fileName: string, sheetName: string, headers: string[], rows: any[][]): void {
  try {
    const wb = XLSX.utils.book_new();
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto-fit kolom sederhana
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      for (let r = 0; r < Math.min(rows.length, 50); r++) {
        const cell = String(rows[r][i] || '');
        if (cell.length > maxLen) maxLen = cell.length;
      }
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Data').slice(0, 31));
    const safeName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(wb, safeName);
  } catch (err: any) {
    console.error('Gagal mengekspor file Excel:', err);
    throw new Error('Gagal membuat file Excel: ' + (err?.message || 'Unknown error'));
  }
}

/**
 * Kirim data ke Google Spreadsheet secara aman dengan proteksi berlapis dan deteksi error komprehensif
 */
export async function syncDataToSpreadsheet(
  config: SpreadsheetConfig,
  payload: SpreadsheetSyncPayload
): Promise<SyncResult> {
  const { valid, cleanUrl, extractedSpreadsheetId, warning } = validateWebhookUrl(config.webhookUrl || '');

  if (!valid) {
    throw new Error(warning || 'URL Webhook Google Apps Script tidak valid.');
  }

  const finalSpreadsheetId = (
    payload.spreadsheetId || 
    config.spreadsheetId || 
    extractedSpreadsheetId || 
    DEFAULT_LOGISTIK_SPREADSHEET_ID
  ).trim();

  const finalPayload: SpreadsheetSyncPayload = {
    ...payload,
    sheetName: payload.sheetName || config.sheetName || 'Data',
    spreadsheetId: finalSpreadsheetId,
    secretToken: payload.secretToken || config.secretToken || '',
    mode: payload.mode || config.mode || 'overwrite',
    timestamp: payload.timestamp || new Date().toISOString()
  };

  const rowCount = Array.isArray(finalPayload.rows) ? finalPayload.rows.length : (finalPayload.data?.length || 0);

  // -------------------------------------------------------------------------
  // TIER 1: Coba via Server Proxy API (/api/spreadsheet-sync)
  // Menghindari CORS browser, menangani 302 redirect Google, dan memvalidasi respon JSON
  // -------------------------------------------------------------------------
  try {
    const proxyRes = await fetch('/api/spreadsheet-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl: cleanUrl,
        payload: finalPayload
      })
    });

    const resJson = await proxyRes.json().catch(() => null);

    if (proxyRes.ok && resJson && resJson.status === 'success') {
      const updatedCount = resJson?.updatedRows ?? rowCount;
      const sheetUrl = resJson?.spreadsheetUrl || (finalPayload.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${finalPayload.spreadsheetId}` : undefined);

      return {
        success: true,
        message: resJson?.message || `Berhasil menyimpan ${updatedCount} baris data ke sheet "${finalPayload.sheetName}"!`,
        updatedRows: updatedCount,
        spreadsheetUrl: sheetUrl,
        mode: 'proxy',
        timestamp: new Date().toLocaleTimeString('id-ID')
      };
    } else if (resJson && (resJson.status === 'error' || resJson.error)) {
      // Jika Google Apps Script atau Proxy melaporkan error secara eksplisit, lempar error asli
      throw new Error(resJson.message || resJson.error || 'Google Apps Script menolak penulisan data.');
    }
  } catch (proxyErr: any) {
    // Jika pesan error berasal dari server proxy yang mengenali error Google Apps Script, jangan fallback ke direct
    if (proxyErr?.message && (
      proxyErr.message.includes('Who has access: Anyone') ||
      proxyErr.message.includes('Izin Apps Script') ||
      proxyErr.message.includes('Spreadsheet tidak ditemukan') ||
      proxyErr.message.includes('Google Apps Script')
    )) {
      throw proxyErr;
    }
    console.debug('Server proxy tidak merespons, mencoba koneksi browser langsung...', proxyErr);
  }

  // -------------------------------------------------------------------------
  // TIER 2: Direct browser POST menggunakan text/plain (CORS Simple Request)
  // -------------------------------------------------------------------------
  try {
    const directRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(finalPayload)
    });

    if (directRes.ok) {
      let resJson: any = null;
      try {
        resJson = await directRes.json();
      } catch {
        resJson = { status: 'success' };
      }

      if (resJson?.status === 'error') {
        throw new Error(resJson.message || 'Error dilaporkan oleh Google Apps Script.');
      }

      const updatedCount = resJson?.updatedRows ?? rowCount;
      const sheetUrl = resJson?.spreadsheetUrl || (finalPayload.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${finalPayload.spreadsheetId}` : undefined);

      return {
        success: true,
        message: resJson?.message || `Berhasil sinkronisasi ${updatedCount} baris data ke sheet "${finalPayload.sheetName}"!`,
        updatedRows: updatedCount,
        spreadsheetUrl: sheetUrl,
        mode: 'cors',
        timestamp: new Date().toLocaleTimeString('id-ID')
      };
    } else {
      let errorMsg = `Server merespons HTTP ${directRes.status}`;
      try {
        const errorJson = await directRes.json();
        if (errorJson?.message) errorMsg = errorJson.message;
      } catch {}
      throw new Error(errorMsg);
    }
  } catch (directErr: any) {
    // -----------------------------------------------------------------------
    // TIER 3: Fallback mode no-cors
    // -----------------------------------------------------------------------
    const isGoogleAppsScript = cleanUrl.includes('script.google.com');
    const isFetchFailure = directErr?.message?.includes('Failed to fetch') || directErr?.name === 'TypeError';

    if (isGoogleAppsScript || isFetchFailure) {
      try {
        await fetch(cleanUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(finalPayload)
        });

        const sheetUrl = finalPayload.spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${finalPayload.spreadsheetId}`
          : undefined;

        return {
          success: true,
          message: `Berhasil mengirim ${rowCount} baris data ke Google Apps Script (Sheet: "${finalPayload.sheetName}"). Data sedang diproses oleh spreadsheet. Jika data belum masuk, klik tombol "Uji Koneksi Webhook" untuk memeriksa izin script.`,
          updatedRows: rowCount,
          spreadsheetUrl: sheetUrl,
          mode: 'no-cors',
          timestamp: new Date().toLocaleTimeString('id-ID')
        };
      } catch (noCorsErr: any) {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          throw new Error('Koneksi internet tidak terhubung. Periksa jaringan Anda.');
        }
        throw new Error(
          'Tidak dapat menghubungi Webhook Google Apps Script. Pastikan Web App diset "Who has access: Anyone" (Siapa saja) saat di-deploy.'
        );
      }
    }

    throw directErr;
  }
}

/**
 * Tarik data dari Google Spreadsheet (via Webhook doGet atau Google Visualization API)
 */
export async function readDataFromSpreadsheet(
  config: SpreadsheetConfig,
  targetSheetName?: string
): Promise<ReadResult> {
  const sheetName = targetSheetName || config.sheetName || 'Picking';
  const spreadsheetId = (config.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID).trim();
  const rawUrl = (config.webhookUrl || '').trim();

  // 1. Coba via Proxy Server
  if (rawUrl) {
    try {
      const proxyUrl = new URL('/api/spreadsheet-read', window.location.origin);
      proxyUrl.searchParams.set('webhookUrl', rawUrl);
      proxyUrl.searchParams.set('sheetName', sheetName);
      if (spreadsheetId) proxyUrl.searchParams.set('spreadsheetId', spreadsheetId);

      const res = await fetch(proxyUrl.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.rows)) {
          return {
            success: true,
            message: `Berhasil mengambil ${data.rows.length} baris data dari sheet "${sheetName}".`,
            headers: data.headers || [],
            rows: data.rows
          };
        }
      }
    } catch {}
  }

  // 2. Coba direct fetch ke Webhook doGet
  if (rawUrl && rawUrl.includes('script.google.com')) {
    try {
      const getUrl = new URL(rawUrl);
      getUrl.searchParams.set('action', 'read');
      getUrl.searchParams.set('sheetName', sheetName);
      if (spreadsheetId) getUrl.searchParams.set('spreadsheetId', spreadsheetId);

      const res = await fetch(getUrl.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.rows)) {
          return {
            success: true,
            message: `Berhasil mengambil ${data.rows.length} baris data dari sheet "${sheetName}".`,
            headers: data.headers || [],
            rows: data.rows
          };
        }
      }
    } catch {}
  }

  // 3. Fallback: Google Visualization API (GViz) jika Spreadsheet ID tersedia dan sheet dibagikan publik / siapa saja yang punya link
  if (spreadsheetId) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        const rawText = await res.text();
        const jsonMatch = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (jsonMatch && jsonMatch[1]) {
          const gvizData = JSON.parse(jsonMatch[1]);
          const table = gvizData.table;
          if (table && Array.isArray(table.rows)) {
            const headers = (table.cols || []).map((col: any) => col.label || col.id || '');
            const rows = table.rows.map((r: any) => (r.c || []).map((cell: any) => (cell ? (cell.v ?? cell.f ?? '') : '')));
            return {
              success: true,
              message: `Berhasil memuat ${rows.length} baris data dari Google Spreadsheet via GViz API.`,
              headers,
              rows
            };
          }
        }
      }
    } catch {}
  }

  return {
    success: false,
    message: 'Gagal menarik data dari Spreadsheet. Pastikan URL Webhook mendukung doGet atau Spreadsheet dibagikan dengan akses lihat.'
  };
}

export interface DeleteRowsOptions {
  sheetName: string;
  ids: string[];
  keyColumnIndex?: number;
  fallbackRemainingData?: {
    headers: string[];
    rows: any[][];
  };
}

/**
 * Hapus satu atau banyak baris data tertentu di Google Spreadsheet berdasarkan ID
 */
export async function deleteRowsFromSpreadsheet(
  config: SpreadsheetConfig,
  options: DeleteRowsOptions
): Promise<SyncResult> {
  const { valid, cleanUrl, extractedSpreadsheetId, warning } = validateWebhookUrl(config.webhookUrl || '');
  if (!valid) {
    throw new Error(warning || 'URL Webhook Google Apps Script tidak valid.');
  }

  const finalSpreadsheetId = (
    config.spreadsheetId || 
    extractedSpreadsheetId || 
    DEFAULT_LOGISTIK_SPREADSHEET_ID
  ).trim();

  const payload = {
    action: 'delete_rows',
    sheetName: options.sheetName || 'Picking',
    spreadsheetId: finalSpreadsheetId,
    secretToken: config.secretToken || '',
    ids: options.ids,
    keyColumnIndex: options.keyColumnIndex || 1,
    timestamp: new Date().toISOString()
  };

  // 1. Coba via API Proxy
  try {
    const proxyRes = await fetch('/api/spreadsheet-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: cleanUrl,
        payload
      })
    });

    if (proxyRes.ok) {
      const resJson = await proxyRes.json().catch(() => null);
      if (resJson && resJson.status === 'success') {
        return {
          success: true,
          message: resJson.message || `Berhasil menghapus ${options.ids.length} baris dari Google Spreadsheet.`,
          updatedRows: resJson.deletedCount,
          spreadsheetUrl: resJson.spreadsheetUrl,
          mode: 'proxy',
          timestamp: new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('Proxy delete_rows error:', err);
  }

  // 2. Direct fetch fallback
  try {
    const directRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (directRes.ok) {
      const text = await directRes.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.status === 'success') {
          return {
            success: true,
            message: parsed.message || `Berhasil menghapus ${options.ids.length} baris dari Google Spreadsheet.`,
            mode: 'cors',
            timestamp: new Date().toISOString()
          };
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Direct delete_rows failed:', err);
  }

  // 3. Fallback Cerdas: Jika skrip Webhook di Google Sheets adalah versi lama yang belum mengenal aksi delete_rows,
  // sync sisa data yang masih ada menggunakan mode overwrite. Baris yang dihapus otomatis hilang dari sheet!
  if (options.fallbackRemainingData) {
    return await syncDataToSpreadsheet(config, {
      sheetName: options.sheetName,
      spreadsheetId: finalSpreadsheetId,
      mode: 'overwrite',
      headers: options.fallbackRemainingData.headers,
      rows: options.fallbackRemainingData.rows
    });
  }

  throw new Error('Gagal menghapus baris dari Google Spreadsheet.');
}

/**
 * Kosongkan seluruh data tabel pada Google Spreadsheet (baris 2 ke bawah, mempertahankan baris 1 judul kolom)
 */
export async function clearSheetDataFromSpreadsheet(
  config: SpreadsheetConfig,
  sheetName: string,
  headers: string[]
): Promise<SyncResult> {
  const { valid, cleanUrl, extractedSpreadsheetId, warning } = validateWebhookUrl(config.webhookUrl || '');
  if (!valid) {
    throw new Error(warning || 'URL Webhook Google Apps Script tidak valid.');
  }

  const finalSpreadsheetId = (
    config.spreadsheetId || 
    extractedSpreadsheetId || 
    DEFAULT_LOGISTIK_SPREADSHEET_ID
  ).trim();

  // Mode overwrite dengan rows kosong dan headers utuh
  // menjamin baris data bersih dan judul kolom tetap rapi
  return await syncDataToSpreadsheet(config, {
    sheetName: sheetName || 'Picking',
    spreadsheetId: finalSpreadsheetId,
    action: 'clear_sheet_data',
    mode: 'overwrite',
    headers: headers,
    rows: []
  });
}

