/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT WEBHOOK UNTUK LOGISTIKAPPS (VERSI TERPADU & ANTI-GAGAL)
 * ==============================================================================
 * Panduan Pemasangan Cepat:
 * 1. Buka Google Spreadsheet tujuan Anda di browser.
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus seluruh kode yang ada di editor, lalu tempel (paste) kode ini.
 * 4. Klik ikon Disket (Save / Simpan).
 * 5. Klik tombol biru "Deploy" (Terapkan) > "New deployment" (Penerapan baru).
 * 6. Klik ikon Gear di sebelah "Select type", pilih "Web app".
 * 7. Konfigurasi Wajib:
 *    - Description: "Logistik Webhook v2"
 *    - Execute as: "Me" (email Anda, misal: logistikcikembar@gmail.com)
 *    - Who has access: "Anyone" (Siapa saja)  <-- WAJIB PILIH INI!
 * 8. Klik "Deploy", lalu klik "Review permissions" > pilih akun > "Advanced" > "Go to ... (unsafe)" > "Allow".
 * 9. Salin "Web app URL" (akhiran /exec) dan tempel ke form sinkronisasi aplikasi Logistik.
 * 
 * CATATAN PENTING JIKA MENGUPDATE KODE:
 * Setiap kali mengubah kode di Apps Script, Anda WAJIB klik:
 * "Deploy" > "Manage deployments" > Ikon Pensil (Edit) > Version: "New version" > "Deploy".
 * ==============================================================================
 */

// Spreadsheet ID default operasional Logistik Cikembar
var DEFAULT_SPREADSHEET_ID = '1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420';

/**
 * Menu otomatis saat Google Spreadsheet dibuka
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📦 Logistik Cikembar')
      .addItem('1. Buat / Rapikan Header Sheet "Picking"', 'buatHeaderSheetPicking')
      .addItem('2. Buat Header Seluruh Sheet Logistik', 'buatSemuaHeaderLogistik')
      .addSeparator()
      .addItem('3. Kosongkan Data Sheet "Picking" (Pertahankan Header)', 'kosongkanDataSheetPicking')
      .addToUi();
  } catch (e) {}
}

/**
 * Kosongkan seluruh data pada sheet Picking (Baris 2 ke bawah, Header baris 1 tetap utuh)
 */
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

/**
 * Buat Judul Kolom Resmi untuk Sheet "Picking" (26 Kolom Logistik)
 */
function buatHeaderSheetPicking() {
  var ss = resolveSpreadsheet({});
  if (!ss) {
    try {
      SpreadsheetApp.getUi().alert('Gagal membuka spreadsheet.');
    } catch (e) {}
    return;
  }

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
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
    SpreadsheetApp.getActiveSpreadsheet().toast('26 Judul Kolom Sheet "Picking" berhasil dibuat dan dirapikan!', 'Sukses', 5);
  } catch (e) {}
}

/**
 * Buat Header untuk semua Sheet Logistik utama
 */
function buatSemuaHeaderLogistik() {
  buatHeaderSheetPicking();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Seluruh header sheet logistik berhasil diinisialisasi!', 'Sukses', 5);
  } catch (e) {}
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Tunggu hingga 30 detik untuk menghindari tabrakan data (race condition)
  var hasLock = lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Payload data kosong atau request tidak memiliki body.' 
      }, 400);
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Format data JSON tidak valid: ' + parseErr.message 
      }, 400);
    }

    // 1. Ekstrak & Validasi Spreadsheet Target
    var spreadsheet = resolveSpreadsheet(payload);
    if (!spreadsheet) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Spreadsheet tidak ditemukan atau Script tidak memiliki izin akses. Harap pastikan Spreadsheet ID diisi atau jalankan script dari dalam Google Spreadsheet (Ekstensi > Apps Script).' 
      }, 404);
    }

    // 2. Tangani Aksi Ping / Uji Koneksi
    if (payload.action === 'ping' || payload.action === 'test_connection') {
      return createJsonResponse({
        status: 'success',
        message: 'Koneksi Webhook Berhasil! Script terhubung ke Spreadsheet: "' + spreadsheet.getName() + '".',
        spreadsheetTitle: spreadsheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        timestamp: new Date().toISOString()
      }, 200);
    }

    // 3. Tentukan Sheet Tab Tujuan
    var targetSheetName = (payload.sheetName || 'Data').trim();
    var sheet = resolveSheet(spreadsheet, targetSheetName);

    // 3b. Tangani Aksi Hapus Baris Tertentu berdasarkan ID (delete_rows / delete_row)
    if (payload.action === 'delete_rows' || payload.action === 'delete_row') {
      var idsToDelete = [];
      if (Array.isArray(payload.ids)) {
        idsToDelete = payload.ids.map(function(id) { return String(id || '').trim(); }).filter(Boolean);
      } else if (payload.id) {
        idsToDelete = [String(payload.id).trim()];
      }

      var lastRow = sheet.getLastRow();
      var keyColIndex = Number(payload.keyColumnIndex) || 1; // Default kolom 1 (misal: ID Picking)
      var deletedCount = 0;

      if (lastRow > 1 && idsToDelete.length > 0) {
        var idValues = sheet.getRange(2, keyColIndex, lastRow - 1, 1).getValues();
        // Hapus dari baris terbawah ke baris teratas agar index tidak bergeser
        for (var r = idValues.length - 1; r >= 0; r--) {
          var val = String(idValues[r][0] || '').trim();
          if (val && idsToDelete.indexOf(val) !== -1) {
            sheet.deleteRow(r + 2); // Baris 1 adalah header, data mulai baris 2
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

    // 3c. Tangani Aksi Kosongkan Data Sheet (Hapus isi tabel baris 2 ke bawah, simpan header)
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
        message: 'Berhasil mengosongkan ' + clearedCount + ' baris data pada sheet "' + sheet.getName() + '". Judul kolom (Header) tetap utuh.',
        clearedCount: clearedCount,
        sheetName: sheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        timestamp: new Date().toISOString()
      }, 200);
    }

    // 4. Siapkan Header dan Baris Data
    var headers = Array.isArray(payload.headers) ? payload.headers : [];
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var mode = (payload.mode === 'append') ? 'append' : 'overwrite';

    // Fallback jika rows belum dibentuk tapi payload.data ada
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

    // Hitung jumlah kolom maksimum yang dibutuhkan
    var maxCols = headers.length;
    for (var r = 0; r < rows.length; r++) {
      if (Array.isArray(rows[r]) && rows[r].length > maxCols) {
        maxCols = rows[r].length;
      }
    }
    if (maxCols === 0) maxCols = 1;

    // Sanitasi Headers: Jangan ada undefined/null, seragamkan panjang
    var cleanHeaders = [];
    if (headers.length > 0) {
      cleanHeaders = sanitizeRow(headers, maxCols);
    }

    // Sanitasi Rows: Hapus undefined, format tanggal/objek, ratakan kolom
    var cleanRows = [];
    for (var i = 0; i < rows.length; i++) {
      cleanRows.push(sanitizeRow(rows[i], maxCols));
    }

    // 5. Eksekusi Penulisan Data
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

        // Styling Header (Warna Biru Tua Elegan + Teks Putih Tebal + Freeze Baris 1)
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
      // Mode Append
      var lastRow = sheet.getLastRow();

      // Jika sheet masih baru/kosong dan ada header, buat header dulu
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

    // Format otomatis lebar kolom agar terbaca rapi
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
    if (hasLock) {
      lock.releaseLock();
    }
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
      // Coba cari nama case-insensitive
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

/**
 * Ekstraksi & Resolusi Spreadsheet secara cerdas
 */
function resolveSpreadsheet(source) {
  var rawId = '';
  if (source && source.spreadsheetId) {
    rawId = String(source.spreadsheetId).trim();
  }

  // Jika input berupa link Dokumen Spreadsheet penuh, ekstrak ID-nya
  if (rawId) {
    var match = rawId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      rawId = match[1];
    }
  }

  // 1. Coba buka dari ID jika ada
  if (rawId) {
    try {
      var ss = SpreadsheetApp.openById(rawId);
      if (ss) return ss;
    } catch (e) {}
  }

  // 2. Coba Spreadsheet Aktif (tempat script terpasang)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {}

  // 3. Fallback ke Spreadsheet Operasional Cikembar
  if (DEFAULT_SPREADSHEET_ID && DEFAULT_SPREADSHEET_ID !== rawId) {
    try {
      var defSs = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
      if (defSs) return defSs;
    } catch (e) {}
  }

  return null;
}

/**
 * Cari atau buat tab Sheet dengan toleransi nama
 */
function resolveSheet(spreadsheet, targetSheetName) {
  var cleanName = (targetSheetName || 'Data').trim();

  // Coba pencarian persis
  var sheet = spreadsheet.getSheetByName(cleanName);
  if (sheet) return sheet;

  // Coba pencarian dengan spasi awal (misal: " StockOpname")
  sheet = spreadsheet.getSheetByName(' ' + cleanName);
  if (sheet) return sheet;

  // Coba pencarian case-insensitive
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === cleanName.toLowerCase()) {
      return sheets[i];
    }
  }

  // Jika belum ada, buat sheet baru
  try {
    return spreadsheet.insertSheet(cleanName);
  } catch (e) {
    // Jika nama tidak valid untuk tab, gunakan tab aktif atau sheet pertama
    return spreadsheet.getActiveSheet() || sheets[0];
  }
}

/**
 * Pastikan Sheet memiliki jumlah baris dan kolom yang cukup sebelum getRange/setValues
 */
function ensureSheetCapacity(sheet, neededRows, neededCols) {
  try {
    var curRows = sheet.getMaxRows();
    if (curRows < neededRows) {
      sheet.insertRowsAfter(curRows, Math.max(neededRows - curRows, 10));
    }
    var curCols = sheet.getMaxColumns();
    if (curCols < neededCols) {
      sheet.insertColumnsAfter(curCols, Math.max(neededCols - curCols, 5));
    }
  } catch (e) {}
}

/**
 * Sanitasi 1 baris array agar tidak ada nilai undefined/null dan panjangnya pas
 */
function sanitizeRow(row, targetLen) {
  var clean = [];
  for (var c = 0; c < targetLen; c++) {
    var val = (row && row[c] !== undefined && row[c] !== null) ? row[c] : '';
    // Hindari objek JS bersarang yang tidak didukung oleh setValues
    if (typeof val === 'object' && !(val instanceof Date)) {
      try {
        val = JSON.stringify(val);
      } catch (e) {
        val = String(val);
      }
    }
    clean.push(val);
  }
  return clean;
}

/**
 * Buat respons JSON standar Google Apps Script
 */
function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
