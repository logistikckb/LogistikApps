import { createPortal } from 'react-dom';
import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Save, 
  Radio, 
  Check, 
  Activity,
  Lock
} from 'lucide-react';
import { 
  isSupabaseConfigured, 
  supabaseUrl, 
  testSupabaseConnection, 
  ConnectionTestResult,
  saveCustomSupabaseCredentials 
} from '../../supabase';

interface SupabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseConnectionModal({ isOpen, onClose }: SupabaseConnectionModalProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  
  const [inputUrl, setInputUrl] = useState(() => {
    return isSupabaseConfigured && !supabaseUrl.includes('placeholder') ? supabaseUrl : '';
  });
  const [inputKey, setInputKey] = useState('');

  const runTest = async () => {
    setTesting(true);
    const res = await testSupabaseConnection();
    setTestResult(res);
    setTesting(false);
  };

  useEffect(() => {
    if (isOpen) {
      runTest();
    }
  }, [isOpen]);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      alert('Harap isi URL Server dan Access Key!');
      return;
    }
    saveCustomSupabaseCredentials(inputUrl.trim(), inputKey.trim());
  };

  if (!isOpen) return null;

  return typeof document !== "undefined" ? createPortal(
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="glass-box !bg-white/95 p-5 sm:p-7 rounded-3xl max-w-xl w-full shadow-2xl border border-blue-400 relative overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Background */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all z-20 cursor-pointer"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shrink-0">
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 m-0 uppercase tracking-tight flex items-center gap-2">
              Status Server & Sinkronisasi
            </h2>
            <p className="text-xs text-slate-500 m-0 font-medium">
              Monitoring Koneksi Server Cloud & Sinkronisasi Data Realtime
            </p>
          </div>
        </div>

        {/* Live Status Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Activity size={14} className="text-blue-900" />
              <span>Status Koneksi Server</span>
            </span>
            <button
              onClick={runTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
              <span>{testing ? 'Menguji...' : 'Uji Respon Server'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {testResult?.connected ? (
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
            ) : isSupabaseConfigured ? (
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Radio size={22} className="animate-pulse" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <XCircle size={22} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
                {testResult?.connected
                  ? 'Server Cloud Terhubung Aktif'
                  : isSupabaseConfigured
                  ? 'Server Terdeteksi (Memeriksa Data)'
                  : 'Mode Penyimpanan Lokal (Offline)'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {testResult?.url || (isSupabaseConfigured ? supabaseUrl : 'Penyimpanan Perangkat Lokal')}
              </div>
            </div>

            {testResult?.latencyMs !== undefined && (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  {testResult.latencyMs}ms
                </span>
              </div>
            )}
          </div>

          {/* Details / Feedback */}
          {testResult?.details && (
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700">
              {testResult.details}
            </div>
          )}

          {/* Table Verification Grid */}
          <div className="pt-2 border-t border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
              Status Sinkronisasi Modul Data:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.users ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <span className="font-bold">Akun User</span>
                {testResult?.tables.users ? <Check size={14} /> : <span className="text-[10px]">--</span>}
              </div>
              <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.broadcasts ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <span className="font-bold">Pesan Siaran</span>
                {testResult?.tables.broadcasts ? <Check size={14} /> : <span className="text-[10px]">--</span>}
              </div>
              <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.links ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <span className="font-bold">Menu Cepat</span>
                {testResult?.tables.links ? <Check size={14} /> : <span className="text-[10px]">--</span>}
              </div>
              <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.todos ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <span className="font-bold">Tugas Tim</span>
                {testResult?.tables.todos ? <Check size={14} /> : <span className="text-[10px]">--</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Configuration Form */}
        <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Lock size={13} className="text-blue-900" />
              <span>Konfigurasi Server Cloud</span>
            </label>
            <span className="text-[10px] text-slate-400">Pengaturan Kredensial Server</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Server Endpoint URL
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://server-endpoint.company.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Access Secret Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Masukkan kunci otorisasi akses API..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              <span>Simpan & Sinkronkan Server</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </form>

        {/* Security & Reliability Footer Notice */}
        <div className="mt-4 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-700 shrink-0" />
          <span>Seluruh transmisi data terlindungi dengan enkripsi end-to-end HTTPS dan sinkronisasi instan multi-perangkat.</span>
        </div>
      </div>
    </div>
  , document.body) : null;
}
