import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown, 
  RefreshCw, 
  Database 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, DataBarang } from '../../../types';
import { getEdIsoDateString, normalizeToIsoDate } from '../../../utils/logisticsCalculations';

interface InventoryExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (rows: InventoryItem[]) => Promise<void>;
  existingItems: InventoryItem[];
  barangList: DataBarang[];
  currentUser: any;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InventoryExcelModal({
  isOpen,
  onClose,
  onImportSuccess,
  existingItems,
  barangList,
  currentUser,
  showToast
}: InventoryExcelModalProps) {
  const [excelFileName, setExcelFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<InventoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      {
        'Item Code': 'SKU-001',
        'Item Name': 'Contoh Nama Produk A',
        'Category': 'Finished Good',
        'Location': 'WH-INV-01',
        'Location Type': 'Rack',
        'First Qty': 100,
        'Last Qty': 100,
        'Uom': 'CTN',
        'Qty Convert': 2400,
        'Uom Convert': 'PCS',
        'LPN/Serial Number': 'LPN-INV-001',
        'Batch': '1234',
        'Vendor Batch': 'VB-9988',
        'SLOC': 'SL01',
        'Expired Date': '2026-12-31',
        'Destination Code': 'DST-INV',
        'QC Code': 'QC-PASS',
        'User Tally': 'Tally Inventory',
        'Shelf Life': '24 Bulan',
        'Source': 'Stok Gudang',
        'Status': 'Ada',
        'Note': 'Catatan inventory',
        'Tujuan': 'Stok Inventory Gudang'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateHeaders);
    ws['!cols'] = [
      { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 20 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Inventory');
    XLSX.writeFile(wb, 'Template_Upload_Inventory_data_inventory.xlsx');
    showToast('Template Terunduh', 'Template Excel Inventory sesuai kolom format berhasil diunduh.', 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        
        // Find sheet with data
        let wsname = wb.SheetNames[0];
        let ws = wb.Sheets[wsname];
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          if (sheet && sheet['!ref']) {
            wsname = name;
            ws = sheet;
            break;
          }
        }

        // Convert to array of arrays first to find the true header row
        const sheetRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!sheetRows || sheetRows.length === 0) {
          showToast('File Kosong', 'File Excel tidak memiliki baris data!', 'warning');
          setParsedRows([]);
          return;
        }

        const normalizeKey = (k: any) => String(k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // Detect header row index
        let headerRowIndex = 0;
        const headerKeywords = ['item', 'sku', 'kode', 'nama', 'barang', 'deskripsi', 'lokasi', 'location', 'qty', 'batch', 'sloc', 'expired', 'ed'];
        for (let i = 0; i < Math.min(sheetRows.length, 10); i++) {
          const rowValues = (sheetRows[i] || []).map(v => normalizeKey(v));
          const matchCount = headerKeywords.filter(kw => rowValues.some(v => v.includes(kw))).length;
          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        // Parse with detected header range
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { 
          defval: '', 
          raw: false,
          range: headerRowIndex
        });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'Tidak ditemukan baris data di bawah judul kolom!', 'warning');
          setParsedRows([]);
          return;
        }

        const nowIso = new Date().toISOString();
        const dateStrPrefix = nowIso.slice(0, 10).replace(/-/g, '');
        const randomSeed = Math.random().toString(36).substring(2, 6).toUpperCase();

        const converted: InventoryItem[] = [];

        rawJson.forEach((row, idx) => {
          // Normalize row keys
          const rowObj: Record<string, any> = {};
          Object.keys(row).forEach(origKey => {
            const cleanKey = normalizeKey(origKey);
            if (cleanKey) {
              rowObj[cleanKey] = row[origKey];
            }
          });

          // Helper to get value matching multiple candidate keys
          const getVal = (aliases: string[]): any => {
            for (const alias of aliases) {
              const cleanAlias = normalizeKey(alias);
              if (rowObj[cleanAlias] !== undefined && String(rowObj[cleanAlias]).trim() !== '') {
                return rowObj[cleanAlias];
              }
            }
            return '';
          };

          // Check if row is completely empty
          const hasAnyContent = Object.values(rowObj).some(v => String(v).trim() !== '');
          if (!hasAnyContent) return;

          let itemCode = String(getVal([
            'itemcode', 'item_code', 'sku', 'kodebarang', 'kodeitem', 'kode_barang', 'kode_item', 
            'material', 'partnumber', 'materialnumber', 'barcode', 'id_barang', 'kode'
          ])).trim();

          let itemName = String(getVal([
            'itemname', 'item_name', 'namabarang', 'namaitem', 'nama_barang', 'nama_item', 
            'deskripsi', 'description', 'namaproduk', 'productname', 'materialdesc', 'nama', 'barang'
          ])).trim();

          // Auto-match itemName if only itemCode is present
          if (!itemName && itemCode) {
            const matchMaster = barangList.find(b => 
              (b.item_code && b.item_code.toLowerCase() === itemCode.toLowerCase()) ||
              (b.barcode && b.barcode.toLowerCase() === itemCode.toLowerCase())
            );
            if (matchMaster) {
              itemName = matchMaster.item_name;
            } else {
              itemName = itemCode;
            }
          }

          // Auto-match itemCode if only itemName is present
          if (!itemCode && itemName) {
            const matchMaster = barangList.find(b => 
              b.item_name && b.item_name.toLowerCase() === itemName.toLowerCase()
            );
            if (matchMaster) {
              itemCode = matchMaster.item_code;
            } else {
              itemCode = 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            }
          }

          // If still neither, skip non-data rows
          if (!itemCode && !itemName) return;

          const batch = String(getVal([
            'batch', 'nobatch', 'lot', 'nolot', 'batchno', 'lotno', 'batchnumber', 'batch_no', 'no_batch'
          ])).trim();

          const rawEd = getVal([
            'expireddate', 'expired_date', 'ed', 'exp', 'expdate', 'exp_date', 
            'kadaluarsa', 'tanggalkadaluarsa', 'tglkadaluarsa', 'tgl_ed', 'tanggal_ed', 
            'sled', 'kadaluwarsa', 'tgl_exp'
          ]);
          let expiredDate = normalizeToIsoDate(rawEd) || '';
          
          if (!expiredDate && batch && batch.length >= 4) {
            const edResult = getEdIsoDateString(itemCode, itemName || itemCode, batch);
            if (edResult?.isoDate) expiredDate = edResult.isoDate;
          }

          const firstQtyRaw = getVal([
            'firstqty', 'first_qty', 'qtyawal', 'qty_awal', 'qty', 'jumlah', 'stock', 'stok', 
            'quantity', 'saldoawal', 'saldo_awal', 'currentqty', 'qtyonhand', 'onhand'
          ]);
          const lastQtyRaw = getVal([
            'lastqty', 'last_qty', 'qtyakhir', 'qty_akhir', 'saldoakhir', 'saldo_akhir', 
            'totalqty', 'sisa', 'qtyreal', 'qty_real'
          ]);

          const firstQty = Number(firstQtyRaw || lastQtyRaw || 0) || 0;
          const lastQty = Number(lastQtyRaw !== '' ? lastQtyRaw : (firstQtyRaw || 0)) || 0;
          const uom = String(getVal(['uom', 'satuan', 'unit', 'kemasan', 'uom1']) || 'CTN').trim().toUpperCase();

          const qtyConvertRaw = getVal(['qtyconvert', 'qtyconvertpcs', 'qty_convert', 'konversi', 'qtykonversi', 'pcs', 'totalpcs']);
          let qtyConvert = Number(qtyConvertRaw || 0) || 0;
          const uomConvert = String(getVal(['uomconvert', 'satuanconvert', 'uom_convert', 'satuan_convert', 'uom2', 'satuankonversi']) || 'PCS').trim().toUpperCase();

          if (qtyConvert === 0 && lastQty > 0) {
            qtyConvert = uom === 'CTN' ? lastQty * 24 : lastQty;
          }

          const location = String(getVal([
            'location', 'lokasi', 'rak', 'bin', 'storage', 'storagelocation', 'alokasi', 'rack', 'kd_lokasi', 'kodelokasi', 'posisi'
          ]) || 'WH-INV-01').trim();

          const locationType = String(getVal(['locationtype', 'location_type', 'jenislokasi', 'tipe_lokasi', 'tipelokasi']) || 'Rack').trim();
          const sloc = String(getVal(['sloc', 'storageloc', 'storage_location', 'gudang', 'sloccode', 'sloc_code']) || 'SL01').trim();
          const category = String(getVal(['category', 'kategori', 'kelompok', 'jenis', 'group', 'itemcategory']) || 'Finished Good').trim();
          const status = String(getVal(['status', 'kondisi', 'state']) || 'Ada').trim();
          const note = String(getVal(['note', 'catatan', 'keterangan', 'remark', 'remarks']) || '').trim();
          const tujuan = String(getVal(['tujuan', 'destinasi', 'destination']) || 'Stok Inventory Gudang').trim();

          const lpn = String(getVal(['lpnserialnumber', 'lpn', 'serialnumber', 'lpn_serial_number', 'sn']) || '').trim();
          const vendorBatch = String(getVal(['vendorbatch', 'vendor_batch', 'batchvendor', 'lotvendor']) || batch || '').trim();
          const destinationCode = String(getVal(['destinationcode', 'destination_code', 'kodedestinasi']) || 'DST-INV').trim();
          const qcCode = String(getVal(['qccode', 'qc_code', 'statusqc', 'qc']) || 'QC-PASS').trim();
          const userTally = String(getVal(['usertally', 'user_tally', 'petugastally', 'tally', 'checker', 'operator']) || currentUser?.nama || 'Tally Inventory').trim();
          const shelfLife = String(getVal(['shelflife', 'shelf_life', 'masasimpan', 'masa_simpan']) || '24 Bulan').trim();
          const source = String(getVal(['source', 'sumber', 'asal']) || 'Stok Gudang').trim();

          // Retain existing ID from excel if provided, or generate unique ID
          const existingId = String(getVal(['id_inventory', 'idinventory', 'id', 'no_inv', 'id_inv', 'no_inventory'])).trim();
          const idInventory = existingId || `INV-${dateStrPrefix}-${randomSeed}-${String(idx + 1).padStart(4, '0')}`;

          converted.push({
            id_inventory: idInventory,
            item_code: itemCode,
            item_name: itemName || itemCode,
            category,
            location,
            location_type: locationType,
            first_qty: firstQty,
            last_qty: lastQty,
            uom,
            qty_convert: qtyConvert,
            uom_convert: uomConvert,
            lpn_serial_number: lpn,
            batch,
            vendor_batch: vendorBatch,
            sloc,
            expired_date: expiredDate,
            destination_code: destinationCode,
            qc_code: qcCode,
            user_tally: userTally,
            shelf_life: shelfLife,
            source,
            user_input: currentUser?.nama || 'Admin',
            status,
            note,
            tujuan,
            created_at: nowIso,
            updated_at: nowIso
          });
        });

        if (converted.length === 0) {
          showToast('Data Tidak Ditemukan', 'Tidak ada baris data barang yang valid ditemukan pada file Excel.', 'warning');
          setParsedRows([]);
          return;
        }

        setParsedRows(converted);
        showToast('File Terbaca', `Berhasil memproses ${converted.length} baris data dari file ${file.name}.`, 'success');
      } catch (err: any) {
        console.error('Excel parse error:', err);
        showToast('Gagal Parsing Excel', err.message || 'Format file Excel tidak valid.', 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveImport = async () => {
    if (parsedRows.length === 0) {
      showToast('Data Kosong', 'Tidak ada data untuk diimpor!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const sanitized = parsedRows.map(r => ({
        ...r,
        expired_date: normalizeToIsoDate(r.expired_date) || null,
        first_qty: Number(r.first_qty) || 0,
        last_qty: Number(r.last_qty) || 0,
        qty_convert: Number(r.qty_convert) || 0
      }));
      await onImportSuccess(sanitized);
      onClose();
    } catch (err: any) {
      console.error('Import save error:', err);
      showToast('Gagal Simpan', err.message || 'Gagal menyimpan data ke Supabase.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-teal-300">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight m-0">
                Upload Data Excel Massal (Inventory)
              </h3>
              <p className="text-[11px] text-teal-200 m-0 font-medium">
                Tabel Supabase: public.data_inventory
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Action Download Template */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-teal-50/80 border border-teal-200 rounded-xl">
            <div>
              <span className="font-bold text-teal-900 text-xs block">Format Kolom Excel Standar</span>
              <p className="text-[11px] text-teal-700 m-0">
                Gunakan template standar agar nama kolom terpetakan otomatis tanpa kolom tanggal update.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <FileDown size={14} />
              <span>Download Template Excel</span>
            </button>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-2xl p-6 text-center bg-slate-50/60 transition-colors">
            <input
              type="file"
              id="excel-file-input-inv"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="excel-file-input-inv"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Upload size={24} />
              </div>
              <span className="font-bold text-slate-800 text-xs">
                {excelFileName ? excelFileName : 'Klik atau Drag file Excel (.xlsx, .xls, .csv) ke sini'}
              </span>
              <span className="text-[11px] text-slate-500">
                Mendukung auto-decode Batch Unix & Kalkulasi Qty PCS otomatis
              </span>
            </label>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Pratinjau Data ({parsedRows.length} Baris Siap Diimpor)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  ID Prefix: INV-YYYYMMDD-XXXX
                </span>
              </div>

              <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 text-[10px]">
                    <tr>
                      <th className="px-2.5 py-1.5">No</th>
                      <th className="px-2.5 py-1.5">ID Inventory</th>
                      <th className="px-2.5 py-1.5">Status</th>
                      <th className="px-2.5 py-1.5">Location</th>
                      <th className="px-2.5 py-1.5">Item Name</th>
                      <th className="px-2.5 py-1.5 text-right">Last Qty</th>
                      <th className="px-2.5 py-1.5 text-center">UOM</th>
                      <th className="px-2.5 py-1.5">Batch</th>
                      <th className="px-2.5 py-1.5">Expired Date</th>
                      <th className="px-2.5 py-1.5">Note</th>
                      <th className="px-2.5 py-1.5">Tujuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={row.id_inventory || idx} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                        <td className="px-2.5 py-1 font-mono font-bold text-teal-800 text-[11px]">{row.id_inventory}</td>
                        <td className="px-2.5 py-1">
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {row.status || 'Ada'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1 font-bold text-slate-700">{row.location}</td>
                        <td className="px-2.5 py-1 font-semibold text-slate-800 max-w-xs truncate">{row.item_name}</td>
                        <td className="px-2.5 py-1 text-right font-mono font-bold text-emerald-800">
                          {Number(row.last_qty || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-2.5 py-1 text-center font-bold text-slate-600">{row.uom}</td>
                        <td className="px-2.5 py-1 font-mono">{row.batch || '-'}</td>
                        <td className="px-2.5 py-1 font-mono">{row.expired_date || '-'}</td>
                        <td className="px-2.5 py-1 max-w-xs truncate text-slate-500">{row.note || '-'}</td>
                        <td className="px-2.5 py-1 text-teal-900 font-semibold">{row.tujuan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center italic m-0">
                  Menampilkan 50 baris pertama dari total {parsedRows.length} baris...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveImport}
            disabled={parsedRows.length === 0 || isSaving || isProcessing}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Menyimpan ke Supabase...</span>
              </>
            ) : (
              <>
                <Database size={14} />
                <span>Simpan {parsedRows.length} Data ke Inventory</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
