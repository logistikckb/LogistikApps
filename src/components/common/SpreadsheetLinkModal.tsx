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
  RotateCcw,
  Code2,
  CheckCircle2,
  XCircle,
  Activity
} from 'lucide-react';
import { getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';
import { 
  APPS_SCRIPT_TEMPLATE, 
  DEFAULT_LOGISTIK_SPREADSHEET_ID,
  getGlobalSpreadsheetConfig,
  saveGlobalSpreadsheetConfig,
  testSpreadsheetWebhook,
  validateWebhookUrl,
  WebhookTestResult
} from '../../services/spreadsheetSyncService';

export { DEFAULT_LOGISTIK_SPREADSHEET_ID };

export interface SpreadsheetLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
  defaultSpreadsheetId?: string;
  defaultSheetName?: string;
}

const SYNCED_SHEETS = [
  { name: 'Incoming', label: 'Kedatangan (Inbound)', icon: Truck, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'Penyiapan', label: 'Penyiapan Outbound', icon: PackageCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { name: 'Picking', label: 'Picking Outbound', icon: PackageCheck, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
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
  const globalConf = getGlobalSpreadsheetConfig();
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => defaultSpreadsheetId || globalConf.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID);
  const [webhookUrl, setWebhookUrl] = useState<string>(() => globalConf.webhookUrl || '');
  const [selectedSheet, setSelectedSheet] = useState<string>(defaultSheetName || 'StockOpname');
  const [copied, setCopied] = useState(false);
  const [showAppsScript, setShowAppsScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempId, setTempId] = useState('');
  const [tempWebhookUrl, setTempWebhookUrl] = useState('');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

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
          const url = general?.webhookUrl || specific?.webhookUrl;
          if (url && typeof url === 'string' && url.trim()) {
            setWebhookUrl(url.trim());
          }
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud spreadsheet:', e);
      }
    }

    if (isOpen) {
      const conf = getGlobalSpreadsheetConfig();
      setSpreadsheetId(defaultSpreadsheetId || conf.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID);
      setWebhookUrl(conf.webhookUrl || '');
      loadConfig();
      setIsEditing(false);
      setCopied(false);
      setTestResult(null);
    }
    return () => { isMounted = false; };
  }, [isOpen, defaultSpreadsheetId]);

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
    setTempWebhookUrl(webhookUrl);
    setIsEditing(true);
  };

  const handleSaveConfig = async () => {
    let clean = tempId.trim();
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      clean = match[1];
    }

    if (!clean) {
      clean = DEFAULT_LOGISTIK_SPREADSHEET_ID;
    }

    const { cleanUrl, warning, valid } = validateWebhookUrl(tempWebhookUrl);
    if (tempWebhookUrl.trim() && !valid && warning) {
      showToast('Perhatian Webhook', warning, 'warning');
    }

    setIsSaving(true);
    try {
      const finalUrl = valid ? cleanUrl : tempWebhookUrl.trim();
      setSpreadsheetId(clean);
      setWebhookUrl(finalUrl);

      // Simpan global ke seluruh modul
      saveGlobalSpreadsheetConfig({
        spreadsheetId: clean,
        webhookUrl: finalUrl
      });

      // Simpan ke Supabase Cloud Setting
      const curGeneral = await getAppSettingFromSupabase('gsheet_sync_config', {});
      await saveAppSettingToSupabase('gsheet_sync_config', {
        ...curGeneral,
        spreadsheetId: clean,
        webhookUrl: finalUrl
      });

      showToast('Tersimpan', 'Pengaturan Spreadsheet & Webhook berhasil diperbarui di seluruh modul!', 'success');
      setIsEditing(false);
      setTestResult(null);
    } catch (err: any) {
      showToast('Gagal Menyimpan', err?.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl || !webhookUrl.trim()) {
      showToast('URL Kosong', 'Silakan isi URL Webhook Apps Script terlebih dahulu.', 'warning');
      return;
    }

    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await testSpreadsheetWebhook({
        webhookUrl: webhookUrl.trim(),
        spreadsheetId: spreadsheetId.trim()
      });
      setTestResult(res);
      if (res.success) {
        showToast('Koneksi Webhook Sukses', res.message, 'success');
      } else {
        showToast('Koneksi Webhook Bermasalah', res.message, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal menghubungi Webhook';
      setTestResult({
        success: false,
        message: errMsg
      });
      showToast('Uji Webhook Gagal', errMsg, 'error');
    } finally {
      setIsTestingWebhook(false);
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
                  <Lock size={10} /> PIN Terverifikasi
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
                <span>Spreadsheet ID belum disetting. Silakan klik <strong>Ubah Pengaturan</strong> di bawah.</span>
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

          {/* Webhook Connection & Test Status Box */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={13} className="text-blue-600" /> Status Webhook Google Apps Script
              </span>
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !webhookUrl}
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 border border-blue-200"
              >
                {isTestingWebhook ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <Activity size={11} />
                    <span>Uji Koneksi Webhook</span>
                  </>
                )}
              </button>
            </div>

            {webhookUrl ? (
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-[10px] text-slate-600 truncate" title={webhookUrl}>
                {webhookUrl}
              </div>
            ) : (
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                <span>URL Webhook belum diisi. Data tidak dapat masuk ke Spreadsheet otomatis tanpa Webhook.</span>
              </div>
            )}

            {/* Test Result Display */}
            {testResult && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-bold">{testResult.success ? 'Koneksi Normal' : 'Koneksi Gagal / Tertahan'}</div>
                  <div className="text-[11px] leading-relaxed">{testResult.message}</div>
                  {testResult.isHtml && (
                    <div className="text-[10px] text-rose-800 bg-white/80 p-2 rounded border border-rose-200 mt-1">
                      <strong>Cara Perbaiki:</strong> Buka spreadsheet tujuan &gt; Ekstensi &gt; Apps Script &gt; Deploy &gt; Manage Deployments &gt; Edit (Pensil) &gt; Version: <em>New version</em> &gt; Who has access: <strong>Anyone (Siapa saja)</strong> &gt; Deploy.
                    </div>
                  )}
                </div>
              </div>
            )}
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

          {/* Bagian Script Webhook Apps Script */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Code2 size={13} className="text-indigo-600" /> Script Webhook Google Spreadsheet
              </span>
              <button
                type="button"
                onClick={() => setShowAppsScript(!showAppsScript)}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold underline cursor-pointer"
              >
                {showAppsScript ? 'Sembunyikan Kode' : 'Lihat / Salin Script'}
              </button>
            </div>

            {showAppsScript && (
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">Kode Apps Script untuk Sheet Ini</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                      setCopiedScript(true);
                      showToast('Tersalin', 'Kode Google Apps Script disalin ke clipboard!', 'success');
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedScript ? 'Tersalin!' : 'Salin Kode Script'}</span>
                  </button>
                </div>
                <pre className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-700 max-h-36 overflow-y-auto leading-relaxed">
                  {APPS_SCRIPT_TEMPLATE}
                </pre>
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <div>1. Buka spreadsheet &gt; menu <strong>Ekstensi &gt; Apps Script</strong>.</div>
                  <div>2. Tempel kode di atas &gt; Simpan &gt; klik <strong>Deploy &gt; New Deployment &gt; Web App</strong>.</div>
                  <div>3. Set <em>Execute as: Me</em> dan <em>Who has access: Anyone (Siapa saja)</em>.</div>
                  <div>4. Salin Web App URL dan tempelkan ke form sinkronisasi modul.</div>
                </div>
              </div>
            )}
          </div>

          {/* Edit Configuration Section */}
          {isEditing ? (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 animate-in fade-in space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Spreadsheet ID atau Full URL
                </label>
                <input
                  type="text"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  placeholder="Contoh: 1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420"
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  URL Webhook Google Apps Script (Web App URL)
                </label>
                <input
                  type="url"
                  value={tempWebhookUrl}
                  onChange={(e) => setTempWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  URL Webhook otomatis disinkronkan ke seluruh modul (Picking, Incoming, Penyiapan, dll).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
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
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  <span>Simpan Pengaturan</span>
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
                Ubah ID &amp; Webhook
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
