import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Lock, 
  Save, 
  Globe, 
  Layers, 
  AlertCircle,
  RefreshCw,
  Truck,
  PackageCheck,
  Flame,
  Boxes,
  RotateCcw
} from 'lucide-react';
import { getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';

export const DEFAULT_LOGISTIK_SPREADSHEET_ID = '1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420';

export interface SpreadsheetLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
  defaultSpreadsheetId?: string;
  defaultSheetName?: string;
}

const SYNCED_SHEETS = [
  { name: 'Incoming', label: 'Kedatangan (Inbound)', icon: Truck, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'Penyiapan', label: 'Penyiapan & Picking', icon: PackageCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { name: 'StockOpname', label: 'Stok Inventory', icon: Layers, color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { name: 'Pemusnahan', label: 'Pemusnahan / BS', icon: Flame, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { name: 'Repack', label: 'Repacking Barang', icon: Boxes, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { name: 'Reco', label: 'Rekondisi (Reco)', icon: RotateCcw, color: 'text-amber-700 bg-amber-50 border-amber-200' },
];

export function SpreadsheetLinkModal({
  isOpen,
  onClose,
  showToast,
  defaultSpreadsheetId = '',
  defaultSheetName = ''
}: SpreadsheetLinkModalProps) {
  const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';

  const getSavedSpreadsheetId = (): string => {
    const storageKeys = [
      'LOGISTIK_GSHEET_WEBHOOK_CONFIG',
      'INVENTORY_GSHEET_WEBHOOK_CONFIG',
      'PENYIAPAN_GSHEET_WEBHOOK_CONFIG',
      'PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG',
      'REPACK_GSHEET_WEBHOOK_CONFIG',
      'RECO_GSHEET_WEBHOOK_CONFIG'
    ];

    for (const key of storageKeys) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.spreadsheetId && typeof parsed.spreadsheetId === 'string' && parsed.spreadsheetId.trim()) {
            return parsed.spreadsheetId.trim();
          }
        }
      } catch {}
    }

    return defaultSpreadsheetId || defaultEnvSpreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID;
  };

  const [spreadsheetId, setSpreadsheetId] = useState<string>(getSavedSpreadsheetId);
  const [selectedSheet, setSelectedSheet] = useState<string>(defaultSheetName || 'StockOpname');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempId, setTempId] = useState('');

  // Sinkronisasi data dari Supabase jika ada
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const general = await getAppSettingFromSupabase('gsheet_sync_config', null);
        const specific = await getAppSettingFromSupabase('gsheet_sync_config_inventory', null);
        if (isMounted) {
          const id = general?.spreadsheetId || specific?.spreadsheetId;
          if (id && typeof id === 'string' && id.trim()) {
            setSpreadsheetId(id.trim());
          }
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud spreadsheet:', e);
      }
    }

    if (isOpen) {
      setSpreadsheetId(getSavedSpreadsheetId());
      loadConfig();
      setIsEditing(false);
      setCopied(false);
    }
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Bangun link URL Google Spreadsheet
  const cleanId = spreadsheetId.trim();
  let fullUrl = '';
  if (cleanId) {
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      fullUrl = cleanId;
    } else {
      fullUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    }
  }

  const handleCopyLink = () => {
    if (!fullUrl) {
      showToast('Link Kosong', 'Spreadsheet ID belum diisi.', 'warning');
      return;
    }
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    showToast('Link Disalin', 'Link Google Spreadsheet berhasil disalin ke clipboard.', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartEdit = () => {
    setTempId(spreadsheetId);
    setIsEditing(true);
  };

  const handleSaveId = async () => {
    let clean = tempId.trim();
    // Ekstrak ID jika user memasukkan full URL
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      clean = match[1];
    }

    if (!clean) {
      showToast('ID Wajib Diisi', 'Silakan masukkan Spreadsheet ID atau URL yang valid.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      setSpreadsheetId(clean);

      // Simpan ke seluruh storage config
      const updateStorage = (key: string) => {
        try {
          const cur = JSON.parse(localStorage.getItem(key) || '{}');
          localStorage.setItem(key, JSON.stringify({ ...cur, spreadsheetId: clean }));
        } catch {}
      };
      
      updateStorage('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      updateStorage('INVENTORY_GSHEET_WEBHOOK_CONFIG');
      updateStorage('PENYIAPAN_GSHEET_WEBHOOK_CONFIG');
      updateStorage('PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG');
      updateStorage('REPACK_GSHEET_WEBHOOK_CONFIG');
      updateStorage('RECO_GSHEET_WEBHOOK_CONFIG');

      // Simpan ke Supabase Cloud Setting agar seluruh perangkat otomatis tersinkron
      const curGeneral = await getAppSettingFromSupabase('gsheet_sync_config', {});
      await saveAppSettingToSupabase('gsheet_sync_config', {
        ...curGeneral,
        spreadsheetId: clean
      });

      const curInventory = await getAppSettingFromSupabase('gsheet_sync_config_inventory', {});
      await saveAppSettingToSupabase('gsheet_sync_config_inventory', {
        ...curInventory,
        spreadsheetId: clean
      });

      showToast('Tersimpan', 'ID Spreadsheet sinkron data berhasil diperbarui & disinkronkan ke seluruh perangkat.', 'success');
      setIsEditing(false);
    } catch (err: any) {
      showToast('Gagal Menyimpan', err?.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 relative text-left max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-800 m-0">Spreadsheet Sinkron Data</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                  <Lock size={10} /> PIN 399339 OK
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0">Google Spreadsheet resmi operasional logistik</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-4 pr-0.5 flex-1 min-h-0">
          
          {/* Link Card Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} className="text-slate-400" /> Link Spreadsheet
              </span>
              {cleanId && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  Tersambung
                </span>
              )}
            </div>

            {fullUrl ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 mb-3 break-all text-xs font-mono text-slate-700 select-all leading-relaxed shadow-2xs">
                {fullUrl}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-3 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-amber-600" />
                <span>Spreadsheet ID belum disetting. Silakan klik <strong>Ubah ID / URL</strong> di bawah.</span>
              </div>
            )}

            {/* Action Buttons: Buka Spreadsheet & Salin Link */}
            <div className="flex flex-col sm:flex-row gap-2">
              {fullUrl && (
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-center"
                >
                  <FileSpreadsheet size={15} />
                  <span>Buka Spreadsheet di Tab Baru</span>
                  <ExternalLink size={14} />
                </a>
              )}

              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!fullUrl}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
              </button>
            </div>
          </div>

          {/* Daftar Sheet Tab yang Sinkron Otomatis */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-emerald-600" /> Sheet Tab yang Disinkronkan
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{SYNCED_SHEETS.length} Modul</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SYNCED_SHEETS.map((sheet) => {
                const IconComponent = sheet.icon;
                const isSelected = selectedSheet === sheet.name;
                return (
                  <div
                    key={sheet.name}
                    onClick={() => setSelectedSheet(sheet.name)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border shrink-0 ${sheet.color}`}>
                      <IconComponent size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-800 truncate">{sheet.name}</div>
                      <div className="text-[9px] text-slate-500 truncate">{sheet.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 m-0 leading-normal">
              Seluruh data dari modul Kedatangan, Penyiapan, StockOpname, Pemusnahan, Repack & Reco disinkronkan ke dokumen Google Spreadsheet ini.
            </p>
          </div>

          {/* Edit Spreadsheet ID Section */}
          {isEditing ? (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 animate-in fade-in">
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Spreadsheet ID atau Full URL
              </label>
              <input
                type="text"
                value={tempId}
                onChange={(e) => setTempId(e.target.value)}
                placeholder="Contoh: 1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 mb-2"
              />
              <p className="text-[10px] text-slate-500 mb-3">
                Bisa langsung paste link lengkap Spreadsheet, ID akan diekstrak secara otomatis dan disinkronkan ke database cloud tim.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveId}
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  <span>Simpan ID</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-slate-500 text-[11px]">
                ID: <span className="font-mono font-semibold text-slate-700">{cleanId ? cleanId.slice(0, 16) + '...' : '(Belum diset)'}</span>
              </span>
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] underline cursor-pointer"
              >
                Ubah ID / URL
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>,
    document.body
  ) : null;
}
