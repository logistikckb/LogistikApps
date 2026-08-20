/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT WEBHOOK UNTUK LOGISTIKAPPS
 * ==============================================================================
 * Petunjuk Pemasangan:
 * 1. Buka Google Spreadsheet tujuan Anda di browser.
 * 2. Klik menu "Extensions" > "Apps Script".
 * 3. Hapus semua kode yang ada, lalu salin (paste) seluruh isi file ini.
 * 4. Klik "Deploy" > "New deployment".
 * 5. Pilih jenis "Web app".
 * 6. Atur:
 *    - Description: "Logistik Webhook"
 *    - Execute as: "Me" (email Anda)
 *    - Who has access: "Anyone" (Siapa saja - agar bisa diakses dari Cloudflare Worker / Web App)
 * 7. Klik "Deploy", izinkan hak akses (Review Permissions > Advanced > Go to Untitled (unsafe) > Allow).
 * 8. Salin "Web app URL" (contoh: https://script.google.com/macros/s/.../exec)
 * 9. Tempelkan URL tersebut ke tombol "Sync Google Sheets" di aplikasi Logistik!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); // Kunci selama 30 detik untuk mencegah race condition

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Payload data kosong.' }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var spreadsheet;

    // Jika spreadsheetId disertakan di payload, gunakan SpreadsheetApp.openById
    if (payload.spreadsheetId && payload.spreadsheetId.trim() !== '') {
      try {
        spreadsheet = SpreadsheetApp.openById(payload.spreadsheetId.trim());
      } catch (err) {
        return createJsonResponse({ 
          status: 'error', 
          message: 'Spreadsheet ID tidak valid atau script tidak memiliki izin: ' + err.message 
        }, 404);
      }
    } else {
      // Gunakan spreadsheet aktif tempat script ini terpasang
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!spreadsheet) {
      return createJsonResponse({ status: 'error', message: 'Spreadsheet tidak ditemukan.' }, 404);
    }

    var targetSheetName = payload.sheetName || 'Incoming';
    var sheet = spreadsheet.getSheetByName(targetSheetName);

    // Jika sheet belum ada, buat sheet baru
    if (!sheet) {
      sheet = spreadsheet.insertSheet(targetSheetName);
    }

    var mode = payload.mode || 'overwrite'; // 'overwrite' | 'append'
    var headers = payload.headers || [];
    var rows = payload.rows || [];

    if (rows.length === 0 && payload.data && payload.data.length > 0) {
      // Fallback jika rows belum diformat
      rows = payload.data.map(function(item) {
        return Object.values(item);
      });
    }

    if (mode === 'overwrite') {
      // Bersihkan seluruh data sheet lama
      sheet.clearContents();

      var allData = [];
      if (headers.length > 0) {
        allData.push(headers);
      }
      if (rows.length > 0) {
        allData = allData.concat(rows);
      }

      if (allData.length > 0) {
        var numRows = allData.length;
        var numCols = allData[0].length;
        var range = sheet.getRange(1, 1, numRows, numCols);
        range.setValues(allData);

        // Berikan styling header profesional (Background biru tua & teks putih tebal)
        if (headers.length > 0) {
          var headerRange = sheet.getRange(1, 1, 1, numCols);
          headerRange.setBackground('#1e3a8a');
          headerRange.setFontColor('#ffffff');
          headerRange.setFontWeight('bold');
          sheet.setFrozenRows(1);
        }
      }
    } else {
      // Mode: append (tambahkan baris baru di bawah baris terakhir)
      var lastRow = sheet.getLastRow();
      
      // Jika sheet masih kosong dan ada headers, buat header dulu
      if (lastRow === 0 && headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#1e3a8a');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
        sheet.setFrozenRows(1);
        lastRow = 1;
      }

      if (rows.length > 0) {
        var startRow = lastRow + 1;
        var numCols = rows[0].length;
        sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
      }
    }

    // Auto-fit kolom agar rapi
    try {
      if (sheet.getLastColumn() > 0) {
        sheet.autoResizeColumns(1, sheet.getLastColumn());
      }
    } catch (e) {}

    return createJsonResponse({
      status: 'success',
      message: 'Berhasil menyimpan ' + rows.length + ' baris ke sheet "' + targetSheetName + '".',
      updatedRows: rows.length,
      spreadsheetUrl: spreadsheet.getUrl(),
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return createJsonResponse({
    status: 'ok',
    message: 'LogistikApps Google Sheets Webhook siap menerima POST request.'
  }, 200);
}

function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
