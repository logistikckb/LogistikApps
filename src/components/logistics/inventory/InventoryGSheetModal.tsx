import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  Share2, 
  Send, 
  ExternalLink, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Calendar, 
  Database, 
  Layers,
  Save,
  Check
} from 'lucide-react';
import { InventoryItem } from '../../../types';
import { getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../../supabase';
import { MenuPinAuthModal } from '../../admin/MenuPinAuthModal';
import { SpreadsheetLinkModal } from './SpreadsheetLinkModal';

export const INVENTORY_STOCK_OPNAME_HEADERS = [
  'Tujuan',
  'Item Code',
  'Item Name',
  'Category',
  'Location',
  'Location Type',
  'First Qty',
  'Last Qty',
  'Uom',
  'Qty Convert',
  'Uom Convert',
  'LPN/Serial Number',
  'Batch',
  'Vendor Batch',
  'SLOC',
  'Expired Date',
  'Destination Code',
  'QC Code',
  'User Tally',
  'Shelf Life',
  'Source',
  'Status',
  'Note'
];

interface InventoryGSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryList: InventoryItem[];
  filteredList: InventoryItem[];
  currentUser: any;
  isSuperAdmin: boolean;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InventoryGSheetModal({
  isOpen,
  onClose,
  inventoryList,
  filteredList,
  currentUser,
  isSuperAdmin,
  showToast
}: InventoryGSheetModalProps) {
  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const now = new Date();
  const [selectedMonthName, setSelectedMonthName] = useState<string>(MONTH_NAMES[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  );
  const [useOriginalTujuanIfSet, setUseOriginalTujuanIfSet] = useState(false);
  const [dataScope, setDataScope] = useState<'filtered' | 'all'>('filtered');

  // GSheet Configuration State
  const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
  const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';
  const defaultSheetName = ' StockOpname';

  const [gSheetConfig, setGSheetConfig] = useState(() => {
    try {
      const savedSpecific = localStorage.getItem('INVENTORY_GSHEET_WEBHOOK_CONFIG');
      const savedGeneral = localStorage.getItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      const saved = savedSpecific || savedGeneral;
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawSheet = parsed.sheetName;
        // Hanya pakai parsed.sheetName jika eksplisit berhubungan dengan stock opname
        const isValidStockSheet = rawSheet && (
          rawSheet.toLowerCase().includes('stock') ||
          rawSheet === ' StockOpname' ||
          rawSheet === 'StockOpname'
        );
        return {
          webhookUrl: parsed.webhookUrl || defaultEnvUrl,
          spreadsheetId: parsed.spreadsheetId || defaultEnvSpreadsheetId,
          sheetName: isValidStockSheet ? rawSheet : defaultSheetName,
          secretToken: parsed.secretToken || '',
          mode: (parsed.mode || 'overwrite') as 'overwrite' | 'append'
        };
      }
    } catch {}
    return {
      webhookUrl: defaultEnvUrl,
      spreadsheetId: defaultEnvSpreadsheetId,
      sheetName: defaultSheetName,
      secretToken: '',
      mode: 'overwrite' as 'overwrite' | 'append'
    };
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCloudConfig, setIsSavingCloudConfig] = useState(false);
  const [isConfigFromCloud, setIsConfigFromCloud] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    spreadsheetUrl?: string;
    updatedRows?: number;
    timestamp?: string;
  } | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [showSpreadsheetLinkModal, setShowSpreadsheetLinkModal] = useState(false);

  // Load configuration from Supabase if available
  useEffect(() => {
    let isMounted = true;
    async function loadCloudConfig() {
      try {
        const specificConfig = await getAppSettingFromSupabase('gsheet_sync_config_inventory', null);
        const generalConfig = await getAppSettingFromSupabase('gsheet_sync_config', null);

        if (isMounted && specificConfig && specificConfig.webhookUrl) {
          const rawSheet = specificConfig.sheetName;
          const isValidStockSheet = rawSheet && (
            rawSheet.toLowerCase().includes('stock') ||
            rawSheet === ' StockOpname' ||
            rawSheet === 'StockOpname'
          );
          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: specificConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: specificConfig.spreadsheetId !== undefined ? specificConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: isValidStockSheet ? rawSheet : defaultSheetName,
            secretToken: specificConfig.secretToken || prev.secretToken,
            mode: specificConfig.mode || prev.mode
          }));
          setIsConfigFromCloud(true);
        } else if (isMounted && generalConfig && generalConfig.webhookUrl) {
          // JANGAN menimpa sheetName dengan "Incoming" dari generalConfig, otomatis selalu gunakan ' StockOpname'
          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: generalConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: generalConfig.spreadsheetId !== undefined ? generalConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: defaultSheetName,
            secretToken: generalConfig.secretToken || prev.secretToken,
            mode: generalConfig.mode || prev.mode
          }));
          setIsConfigFromCloud(true);
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud Google Sheets:', e);
      }
    }

    if (isOpen) {
      loadCloudConfig();
    }
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine items to sync
  const itemsToSync = dataScope === 'filtered' 
    ? (filteredList.length > 0 ? filteredList : inventoryList) 
    : inventoryList;

  // Save config to Cloud (Admin)
  const handleSaveCloudConfig = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Terbatas', 'Hanya Admin yang dapat menyimpan setting ke cloud.', 'warning');
      return;
    }
    setIsSavingCloudConfig(true);
    try {
      await saveAppSettingToSupabase('gsheet_sync_config_inventory', gSheetConfig);
      localStorage.setItem('INVENTORY_GSHEET_WEBHOOK_CONFIG', JSON.stringify(gSheetConfig));
      setIsConfigFromCloud(true);
      showToast('Setting Tersimpan', 'Konfigurasi Spreadsheet berhasil disimpan ke cloud untuk semua pengguna.', 'success');
    } catch (err: any) {
      showToast('Gagal Menyimpan', err?.message || 'Gagal menyimpan konfigurasi ke cloud.', 'error');
    } finally {
      setIsSavingCloudConfig(false);
    }
  };

  // Execute Webhook Sync
  const handleExecuteSync = async () => {
    const rawUrl = gSheetConfig.webhookUrl ? gSheetConfig.webhookUrl.trim() : '';
    if (!rawUrl) {
      showToast('URL Kosong', 'Harap isi URL Webhook Google Apps Script / Cloudflare Worker terlebih dahulu.', 'warning');
      return;
    }

    if (itemsToSync.length === 0) {
      showToast('Data Kosong', 'Tidak ada data inventory yang dipilih untuk diunggah.', 'warning');
      return;
    }

    const effectiveMonth = selectedMonth.trim();
    if (!effectiveMonth && !useOriginalTujuanIfSet) {
      showToast('Bulan Belum Diisi', 'Harap pilih atau isi Tujuan / Bulan Stock Opname.', 'warning');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    // Save to local storage for quick access next time
    try {
      localStorage.setItem('INVENTORY_GSHEET_WEBHOOK_CONFIG', JSON.stringify(gSheetConfig));
    } catch {}

    // Build rows according to INVENTORY_STOCK_OPNAME_HEADERS
    // Column 1: Tujuan (Bulan Stock Opname)
    // Followed by exact inventory table fields, ending with Status & Note
    const rows = itemsToSync.map(item => {
      let tujuanValue = effectiveMonth;
      if (useOriginalTujuanIfSet && item.tujuan && item.tujuan.trim()) {
        tujuanValue = item.tujuan.trim();
      }
      if (!tujuanValue) {
        tujuanValue = item.tujuan || 'Stock Opname';
      }

      return [
        tujuanValue,                                          // 1. Tujuan (Bulan SO)
        item.item_code || '',                                 // 2. Item Code
        item.item_name || '',                                 // 3. Item Name
        item.category || 'Finished Good',                     // 4. Category
        item.location || '',                                  // 5. Location
        item.location_type || 'Rack',                         // 6. Location Type
        Number(item.first_qty ?? item.last_qty) || 0,        // 7. First Qty
        Number(item.last_qty) || 0,                           // 8. Last Qty
        item.uom || 'CTN',                                    // 9. Uom
        Number(item.qty_convert) || 0,                        // 10. Qty Convert
        item.uom_convert || 'PCS',                            // 11. Uom Convert
        item.lpn_serial_number || '',                         // 12. LPN/Serial Number
        item.batch || '',                                     // 13. Batch
        item.vendor_batch || '',                              // 14. Vendor Batch
        item.sloc || 'SL01',                                  // 15. SLOC
        item.expired_date || '',                              // 16. Expired Date
        item.destination_code || 'DST-INV',                  // 17. Destination Code
        item.qc_code || 'QC-PASS',                            // 18. QC Code
        item.user_tally || '',                                // 19. User Tally
        item.shelf_life || '',                                // 20. Shelf Life
        item.source || 'Stok Gudang',                         // 21. Source
        item.status || 'Ada',                                 // 22. Status
        item.note || ''                                       // 23. Note
      ];
    });

    const targetSheet = gSheetConfig.sheetName || ' StockOpname';

    const payload = {
      action: 'sync_logistik_inventory_stockopname',
      source: 'inventory_module',
      module: 'stockopname',
      sheetName: targetSheet,
      spreadsheetId: gSheetConfig.spreadsheetId ? gSheetConfig.spreadsheetId.trim() : '',
      secretToken: gSheetConfig.secretToken ? gSheetConfig.secretToken.trim() : '',
      mode: gSheetConfig.mode || 'overwrite',
      tujuanBulan: effectiveMonth,
      timestamp: new Date().toISOString(),
      user: currentUser?.nama || currentUser?.username || 'Admin',
      totalRows: itemsToSync.length,
      headers: INVENTORY_STOCK_OPNAME_HEADERS,
      rows: rows
    };

    try {
      const res = await fetch(rawUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      let resJson: any = null;
      try {
        resJson = await res.json();
      } catch {
        resJson = { status: 'success' };
      }

      const updatedCount = resJson?.updatedRows || itemsToSync.length;
      const sheetUrl = resJson?.spreadsheetUrl || (
        gSheetConfig.spreadsheetId && gSheetConfig.spreadsheetId.trim()
          ? `https://docs.google.com/spreadsheets/d/${gSheetConfig.spreadsheetId.trim()}`
          : undefined
      );

      setSyncResult({
        success: true,
        message: `Berhasil mengunggah ${updatedCount} baris data ke sheet "${targetSheet}" dengan Tujuan: "${effectiveMonth}"!`,
        spreadsheetUrl: sheetUrl,
        updatedRows: updatedCount,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      showToast(
        'Upload Berhasil',
        `${updatedCount} data inventory berhasil dikirim ke Google Spreadsheet "${targetSheet}".`,
        'success'
      );
    } catch (err: any) {
      console.warn('Fetch standar gagal, mencoba fallback no-cors...', err);
      // Fallback mode no-cors for Apps Script without explicit CORS headers
      try {
        await fetch(rawUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const sheetUrl = gSheetConfig.spreadsheetId && gSheetConfig.spreadsheetId.trim()
          ? `https://docs.google.com/spreadsheets/d/${gSheetConfig.spreadsheetId.trim()}`
          : undefined;

        setSyncResult({
          success: true,
          message: `Permintaan upload ${itemsToSync.length} baris telah dikirim ke Google Apps Script (mode no-cors).`,
          spreadsheetUrl: sheetUrl,
          updatedRows: itemsToSync.length,
          timestamp: new Date().toLocaleTimeString('id-ID')
        });

        showToast('Data Dikirim', 'Data berhasil dikirim ke Webhook Spreadsheet.', 'success');
      } catch (subErr: any) {
        setSyncResult({
          success: false,
          message: err?.message || 'Gagal menghubungi Webhook Spreadsheet. Periksa URL dan koneksi Anda.'
        });
        showToast('Upload Gagal', err?.message || 'Gagal mengunggah data ke Spreadsheet.', 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonthName(newMonth);
    setSelectedMonth(`${newMonth} ${selectedYear}`);
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(`${selectedMonthName} ${newYear}`);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-xl w-full shadow-2xl border border-teal-200 relative max-h-[92vh] flex flex-col overflow-hidden text-left">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-800 m-0">Upload ke Spreadsheet</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                  StockOpname
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0">Sinkronisasi data Inventory ke sheet tujuan StockOpname</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Buka file Google Spreadsheet (Memerlukan PIN 399339)"
            >
              <ExternalLink size={13} className="text-emerald-700" />
              <span className="hidden sm:inline">Buka Link Spreadsheet</span>
              <span className="sm:hidden">Link Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
          
          {/* SECTION 1: PILIHAN TUJUAN / BULAN STOCK OPNAME */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/80 to-emerald-50/50 border border-teal-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-teal-700" />
                <label className="font-extrabold text-slate-800 text-xs">
                  Tujuan (Bulan Stock Opname) <span className="text-rose-500">*</span>
                </label>
              </div>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md">
                Kolom 1 (Paling Awal)
              </span>
            </div>

            <p className="text-[11px] text-slate-600 m-0">
              Nilai ini akan mengisi kolom <strong>Tujuan</strong> di urutan paling awal pada sheet Spreadsheet untuk setiap baris data yang diunggah.
            </p>

            {/* Pemilihan Dinamis Bulan & Tahun (Mendukung 2026, 2027, 2028, dst.) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pilih Bulan:
                </label>
                <select
                  value={selectedMonthName}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tahun (Ketik Bebas):
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2050"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10) || selectedYear)}
                  className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>

            {/* Nilai Teks Tujuan Hasil Gabungan (Bisa Diedit Manual) */}
            <div className="pt-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Teks Kolom Tujuan yang Akan Dikirim:
              </label>
              <input
                type="text"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                placeholder="Contoh: September 2026, Januari 2027, SO 2027..."
                className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* Checkbox fallback */}
            <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useOriginalTujuanIfSet}
                onChange={(e) => setUseOriginalTujuanIfSet(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>Pertahankan nilai tujuan asli data barang (jika kosong, gunakan bulan di atas)</span>
            </label>
          </div>

          {/* SECTION 2: SHEET TAB & MODE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Sheet Tab: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={gSheetConfig.sheetName}
                onChange={(e) => setGSheetConfig(p => ({ ...p, sheetName: e.target.value }))}
                placeholder=" StockOpname"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 font-mono"
              />
              <span className="text-[10px] text-teal-700 font-semibold mt-1 block">
                ✓ Otomatis ke sheet: <strong>"{gSheetConfig.sheetName}"</strong>
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mode Kirim:</label>
              <select
                value={gSheetConfig.mode}
                onChange={(e) => setGSheetConfig(p => ({ ...p, mode: e.target.value as any }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="overwrite">Overwrite (Timpa Penuh + Header Styling)</option>
                <option value="append">Append (Tambahkan ke Baris Terakhir)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {gSheetConfig.mode === 'overwrite' ? 'Menghapus data lama & menyusun ulang' : 'Menambah data baru di bawah'}
              </span>
            </div>
          </div>

          {/* SECTION 3: CAKUPAN DATA */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Pilih Cakupan Data yang Dikirim:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDataScope('filtered')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  dataScope === 'filtered'
                    ? 'border-teal-600 bg-teal-50/70 text-teal-900 shadow-2xs ring-1 ring-teal-600'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Layers size={13} className="text-teal-700" />
                  <span>Data Filtered Saat Ini</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {filteredList.length} baris data sesuai pencarian/filter
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDataScope('all')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  dataScope === 'all'
                    ? 'border-teal-600 bg-teal-50/70 text-teal-900 shadow-2xs ring-1 ring-teal-600'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Database size={13} className="text-teal-700" />
                  <span>Semua Data Inventory</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Total {inventoryList.length} baris data inventory tersimpan
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 4: WEBHOOK URL & SPREADSHEET ID */}
          <div className="space-y-2.5 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  URL Webhook Google Apps Script / Cloudflare Worker: <span className="text-rose-500">*</span>
                </label>
                {isConfigFromCloud && (
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Sinkron Cloud
                  </span>
                )}
              </div>
              <input
                type="url"
                value={gSheetConfig.webhookUrl}
                onChange={(e) => setGSheetConfig(p => ({ ...p, webhookUrl: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Spreadsheet ID (Opsional jika script terpasang di sheet lain):
              </label>
              <input
                type="text"
                value={gSheetConfig.spreadsheetId}
                onChange={(e) => setGSheetConfig(p => ({ ...p, spreadsheetId: e.target.value }))}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* Simpan Setting ke Cloud (Admin Only) */}
            {isSuperAdmin && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Simpan setting ini agar otomatis digunakan oleh seluruh anggota tim:
                </span>
                <button
                  type="button"
                  onClick={handleSaveCloudConfig}
                  disabled={isSavingCloudConfig || !gSheetConfig.webhookUrl.trim()}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  title="Simpan webhook dan ID ke Supabase"
                >
                  {isSavingCloudConfig ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                  <span>Simpan ke Cloud</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 5: SUSUNAN 23 KOLOM RESMI */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info size={13} className="text-teal-700" />
              <span>Susunan 23 Kolom Spreadsheet Sesuai Kesepakatan:</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto pr-1">
              {INVENTORY_STOCK_OPNAME_HEADERS.map((col, idx) => (
                <span 
                  key={col} 
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    idx === 0 
                      ? 'bg-teal-700 text-white' 
                      : col === 'Status' || col === 'Note'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {idx + 1}. {col} {idx === 0 ? `("${selectedMonth}")` : ''}
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 6: HASIL SYNC */}
          {syncResult && (
            <div className={`p-3.5 rounded-2xl border ${
              syncResult.success 
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900' 
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {syncResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-700" />
                ) : (
                  <AlertCircle size={16} className="text-rose-700" />
                )}
                <span>{syncResult.success ? 'Upload Berhasil!' : 'Upload Gagal'}</span>
                {syncResult.timestamp && (
                  <span className="text-[10px] font-normal text-slate-500 ml-auto">
                    {syncResult.timestamp}
                  </span>
                )}
              </div>
              <p className="m-0 text-xs">{syncResult.message}</p>
              {syncResult.spreadsheetUrl && (
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  className="inline-flex items-center gap-1 mt-2 text-emerald-700 font-extrabold hover:underline cursor-pointer bg-transparent border-0 p-0 text-xs"
                >
                  <span>Buka Google Spreadsheet</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          )}

        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-3.5 mt-2 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            Siap kirim: <strong className="text-slate-900">{itemsToSync.length} baris</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExecuteSync}
              disabled={isSyncing || !gSheetConfig.webhookUrl.trim() || itemsToSync.length === 0}
              className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold shadow-md shadow-teal-700/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Upload ke Spreadsheet</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Modal Lihat & Buka Link Spreadsheet (setelah PIN 399339) */}
      <SpreadsheetLinkModal
        isOpen={showSpreadsheetLinkModal}
        onClose={() => setShowSpreadsheetLinkModal(false)}
        showToast={showToast}
        defaultSpreadsheetId={gSheetConfig.spreadsheetId}
        defaultSheetName=" StockOpname"
      />

      {/* Modal Verifikasi PIN 399339 */}
      <MenuPinAuthModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          setShowSpreadsheetLinkModal(true);
          showToast('PIN Terverifikasi', 'Akses link Google Spreadsheet dibuka.', 'success');
        }}
        title="Verifikasi PIN Spreadsheet"
        description="Masukkan PIN keamanan 399339 untuk membuka link Google Spreadsheet."
      />
    </div>,
    document.body
  ) : null;
}
