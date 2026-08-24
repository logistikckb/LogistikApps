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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'File Excel tidak memiliki baris data!', 'warning');
          setParsedRows([]);
          return;
        }

        const normalizeKey = (k: string) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const nowIso = new Date().toISOString();
        const dateStrPrefix = nowIso.slice(0, 10).replace(/-/g, '');

        // Calculate sequence number
        let maxSeq = 0;
        const prefixRegex = new RegExp(`^INV-${dateStrPrefix}-(\\d+)$`, 'i');
        for (const item of existingItems) {
          const match = (item.id_inventory || '').match(prefixRegex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }

        const converted: InventoryItem[] = [];

        rawJson.forEach((row, idx) => {
          const rowObj: Record<string, any> = {};
          Object.keys(row).forEach(origKey => {
            rowObj[normalizeKey(origKey)] = row[origKey];
          });

          const itemCode = String(rowObj['itemcode'] || rowObj['sku'] || rowObj['kodebarang'] || rowObj['item_code'] || '').trim();
          let itemName = String(rowObj['itemname'] || rowObj['namabarang'] || rowObj['deskripsi'] || rowObj['item_name'] || '').trim();

          if (!itemName && itemCode) {
            const matchMaster = barangList.find(b => b.item_code?.toLowerCase() === itemCode.toLowerCase());
            if (matchMaster) itemName = matchMaster.item_name;
          }

          if (!itemCode && !itemName) return;

          const batch = String(rowObj['batch'] || rowObj['nobatch'] || rowObj['lot'] || '').trim();
          const rawEd = rowObj['expireddate'] || rowObj['ed'] || rowObj['tanggalkadaluarsa'] || rowObj['expired_date'] || '';
          let expiredDate = normalizeToIsoDate(rawEd) || '';
          
          if (!expiredDate && batch && batch.length >= 4) {
            const edResult = getEdIsoDateString(itemCode, itemName || itemCode, batch);
            if (edResult?.isoDate) expiredDate = edResult.isoDate;
          }

          const firstQty = Number(rowObj['firstqty'] || rowObj['qtyawal'] || rowObj['first_qty'] || rowObj['qty'] || 0) || 0;
          const lastQty = Number(rowObj['lastqty'] || rowObj['qtyakhir'] || rowObj['last_qty'] || firstQty) || firstQty;
          const uom = String(rowObj['uom'] || rowObj['satuan'] || 'CTN').trim().toUpperCase();

          let qtyConvert = Number(rowObj['qtyconvert'] || rowObj['qtyconvertpcs'] || rowObj['qty_convert'] || 0) || 0;
          const uomConvert = String(rowObj['uomconvert'] || rowObj['satuanconvert'] || rowObj['uom_convert'] || 'PCS').trim().toUpperCase();

          if (qtyConvert === 0 && lastQty > 0) {
            qtyConvert = uom === 'CTN' ? lastQty * 24 : lastQty;
          }

          const location = String(rowObj['location'] || rowObj['lokasi'] || 'WH-INV-01').trim();
          const locationType = String(rowObj['locationtype'] || rowObj['jenislokasi'] || 'Rack').trim();
          const sloc = String(rowObj['sloc'] || 'SL01').trim();
          const category = String(rowObj['category'] || rowObj['kategori'] || 'Finished Good').trim();
          const status = String(rowObj['status'] || 'Ada').trim();
          const note = String(rowObj['note'] || rowObj['catatan'] || rowObj['keterangan'] || '').trim();
          const tujuan = String(rowObj['tujuan'] || rowObj['destinasi'] || 'Stok Inventory Gudang').trim();

          const lpn = String(rowObj['lpnserialnumber'] || rowObj['lpn'] || rowObj['serialnumber'] || rowObj['lpn_serial_number'] || '').trim();
          const vendorBatch = String(rowObj['vendorbatch'] || rowObj['vendor_batch'] || '').trim();
          const destinationCode = String(rowObj['destinationcode'] || rowObj['kodedestinasi'] || 'DST-INV').trim();
          const qcCode = String(rowObj['qccode'] || rowObj['statusqc'] || 'QC-PASS').trim();
          const userTally = String(rowObj['usertally'] || rowObj['petugastally'] || currentUser?.nama || 'Tally Inventory').trim();
          const shelfLife = String(rowObj['shelflife'] || rowObj['masasimpan'] || '24 Bulan').trim();
          const source = String(rowObj['source'] || rowObj['sumber'] || 'Stok Gudang').trim();

          maxSeq += 1;
          const seqStr = String(maxSeq).padStart(4, '0');
          const idInventory = `INV-${dateStrPrefix}-${seqStr}`;

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
