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
  Lock,
  Share2,
  Trash2,
  HelpCircle,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';
import { 
  isSupabaseConfigured, 
  supabaseUrl, 
  testSupabaseConnection, 
  ConnectionTestResult,
  saveCustomSupabaseCredentials,
  isSharedBroadcastConfigured,
  sharedBroadcastUrl,
  testSharedBroadcastConnection,
  saveSharedBroadcastCredentials,
  removeSharedBroadcastCredentials
} from '../../supabase';

interface SupabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'primary' | 'bridge';
}

export function SupabaseConnectionModal({ isOpen, onClose, initialTab = 'primary' }: SupabaseConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<'primary' | 'bridge'>(initialTab);

  // Primary Server State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [inputUrl, setInputUrl] = useState(() => {
    return isSupabaseConfigured && !supabaseUrl.includes('placeholder') ? supabaseUrl : '';
  });
  const [inputKey, setInputKey] = useState('');

  // Secondary Bridge Server State
  const [testingBridge, setTestingBridge] = useState(false);
  const [bridgeTestResult, setBridgeTestResult] = useState<ConnectionTestResult | null>(null);
  const [inputBridgeUrl, setInputBridgeUrl] = useState(() => {
    return isSharedBroadcastConfigured ? sharedBroadcastUrl : '';
  });
  const [inputBridgeKey, setInputBridgeKey] = useState('');

  const runTest = async () => {
    setTesting(true);
    const res = await testSupabaseConnection();
    setTestResult(res);
    setTesting(false);
  };

  const runBridgeTest = async () => {
    setTestingBridge(true);
    const res = await testSharedBroadcastConnection();
    setBridgeTestResult(res);
    setTestingBridge(false);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      runTest();
      if (isSharedBroadcastConfigured) {
        runBridgeTest();
      }
    }
  }, [isOpen, initialTab]);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      alert('Harap isi URL Server dan Access Key!');
      return;
    }
    saveCustomSupabaseCredentials(inputUrl.trim(), inputKey.trim());
  };

  const handleSaveBridgeCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputBridgeUrl.trim() || !inputBridgeKey.trim()) {
      alert('Harap isi URL Server Aplikasi ke-2 dan Access Key!');
      return;
    }
    saveSharedBroadcastCredentials(inputBridgeUrl.trim(), inputBridgeKey.trim());
  };

  const handleRemoveBridge = () => {
    if (confirm('Apakah Anda yakin ingin melepas Jembatan Siaran Antar-Aplikasi? Aplikasi ini akan kembali beroperasi secara mandiri.')) {
      removeSharedBroadcastCredentials();
    }
  };

  if (!isOpen) return null;

  return typeof document !== "undefined" ? createPortal(
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white p-5 sm:p-7 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 relative text-left max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all z-20 cursor-pointer"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-200 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shrink-0">
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 m-0 uppercase tracking-tight flex items-center gap-2">
              Koneksi Server & Jembatan Siaran
            </h2>
            <p className="text-xs text-slate-500 m-0 font-medium">
              Monitoring Database Utama & Penghubung Antar 2 Aplikasi
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('primary')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'primary' 
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server size={14} />
            <span>Database Utama Aplikasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bridge')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'bridge' 
                ? 'bg-blue-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>Jembatan Siaran 2 Aplikasi</span>
            {isSharedBroadcastConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {/* TAB 1: DATABASE UTAMA */}
          {activeTab === 'primary' && (
            <div className="space-y-4">
              {/* Live Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-900" />
                    <span>Status Database Utama</span>
                  </span>
                  <button
                    onClick={runTest}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
                    <span>{testing ? 'Menguji...' : 'Uji Respon'}</span>
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
                        ? 'Server Cloud Utama Aktif'
                        : isSupabaseConfigured
                        ? 'Server Terdeteksi (Memeriksa Respon)'
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
              <form onSubmit={handleSaveCredentials} className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Lock size={13} className="text-blue-900" />
                    <span>Ubah Kredensial Database Utama</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Pengaturan URL & Key Utama</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    URL Server Cloud / Database Utama
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://your-cloud-database.co"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Access Public API Key
                  </label>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Masukkan public access key..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Simpan Kredensial Database</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: JEMBATAN SIARAN 2 APLIKASI */}
          {activeTab === 'bridge' && (
            <div className="space-y-4">
              {/* How it works info card */}
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <Sparkles size={16} className="text-blue-700 shrink-0" />
                  <span>Jembatan Realtime Multi-Database (Dual-Sync Bridge)</span>
                </div>
                <p className="leading-relaxed m-0 text-[11px] text-blue-800">
                  Fitur ini memungkinkan <strong>Aplikasi 1</strong> dan <strong>Aplikasi 2</strong> saling mengirim dan menerima Pesan Siaran secara langsung (realtime & berbunyi di kedua aplikasi), meskipun masing-masing aplikasi memakai server database yang berbeda.
                </p>
                <div className="p-2.5 rounded-xl bg-white/80 border border-blue-200/80 font-mono text-[10px] text-slate-700">
                  <strong>Cara Mudah:</strong> Masukkan URL & Access Key Server Aplikasi Pasangan Anda di bawah ini. Aplikasi akan otomatis mensinkronkan pesan siaran ke kedua server data sekaligus!
                </div>
              </div>

              {/* Bridge Connection Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Share2 size={14} className="text-blue-900" />
                    <span>Status Jembatan Siaran</span>
                  </span>
                  {isSharedBroadcastConfigured && (
                    <button
                      onClick={runBridgeTest}
                      disabled={testingBridge}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={12} className={testingBridge ? 'animate-spin' : ''} />
                      <span>{testingBridge ? 'Menguji...' : 'Uji Jembatan'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isSharedBroadcastConfigured && bridgeTestResult?.connected ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={22} />
                    </div>
                  ) : isSharedBroadcastConfigured ? (
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Radio size={22} className="animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <ArrowRightLeft size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
                      {isSharedBroadcastConfigured && bridgeTestResult?.connected
                        ? 'Jembatan Siaran Aktif & Tersambung'
                        : isSharedBroadcastConfigured
                        ? 'Jembatan Terpasang (Memeriksa...)'
                        : 'Jembatan Belum Dihubungkan (Mode Mandiri)'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {isSharedBroadcastConfigured ? sharedBroadcastUrl : 'Siaran hanya berjalan di database aplikasi ini'}
                    </div>
                  </div>

                  {bridgeTestResult?.latencyMs !== undefined && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                        {bridgeTestResult.latencyMs}ms
                      </span>
                    </div>
                  )}
                </div>

                {bridgeTestResult?.details && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700">
                    {bridgeTestResult.details}
                  </div>
                )}
              </div>

              {/* Form Input Bridge */}
              <form onSubmit={handleSaveBridgeCredentials} className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <ArrowRightLeft size={13} className="text-blue-900" />
                    <span>Kredensial Server Data Aplikasi ke-2</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    URL Server Aplikasi Pasangan (Aplikasi ke-2)
                  </label>
                  <input
                    type="text"
                    value={inputBridgeUrl}
                    onChange={(e) => setInputBridgeUrl(e.target.value)}
                    placeholder="https://app2-cloud-server.co"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Access Key Aplikasi Pasangan
                  </label>
                  <input
                    type="password"
                    value={inputBridgeKey}
                    onChange={(e) => setInputBridgeKey(e.target.value)}
                    placeholder="Masukkan access key dari aplikasi pasangan..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Hubungkan Jembatan Siaran</span>
                  </button>

                  {isSharedBroadcastConfigured && (
                    <button
                      type="button"
                      onClick={handleRemoveBridge}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Lepas jembatan siaran"
                    >
                      <Trash2 size={13} />
                      <span>Lepas</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Enkripsi Aman & Realtime WebSockets</span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  , document.body) : null;
}

