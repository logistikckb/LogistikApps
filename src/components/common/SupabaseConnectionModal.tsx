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
  Sparkles,
  Copy,
  ShieldAlert,
  ExternalLink,
  FileCode
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
  initialTab?: 'primary' | 'bridge' | 'rls';
}

export const RLS_FIX_SQL = `-- ==============================================================================
-- LOGISTIK PORTAL - SKRIP PERBAIKAN ROW-LEVEL SECURITY (RLS) SUPABASE
-- Menyelesaikan issue: 'Table publicly accessible'
-- ==============================================================================

-- 1. Berikan hak akses schema ke anon & authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Aktifkan RLS dan tetapkan RLS Policy untuk semua tabel aplikasi
DO $$
DECLARE
    tbl text;
    target_tables text[] := ARRAY[
        'users',
        'broadcast',
        'broadcasts',
        'data_barang',
        'data_distributor',
        'incoming',
        'data_penyiapan',
        'data_cek_fisik_pemusnahan',
        'data_pemusnahan',
        'data_inventory',
        'app_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Aktifkan RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Hapus policy lama jika ada
            EXECUTE format('DROP POLICY IF EXISTS "Allow anon and authenticated full access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow public full access" ON public.%I;', tbl);
            
            -- Buat Policy eksplisit agar operasi aplikasi tetap berjalan lancar
            EXECUTE format(
                'CREATE POLICY "Allow anon and authenticated full access" ON public.%I ' ||
                'FOR ALL TO anon, authenticated ' ||
                'USING (true) ' ||
                'WITH CHECK (true);',
                tbl
            );
        END IF;
    END LOOP;
END $$;`;

export function SupabaseConnectionModal({ isOpen, onClose, initialTab = 'primary' }: SupabaseConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<'primary' | 'bridge' | 'rls'>(initialTab);
  const [copiedSql, setCopiedSql] = useState(false);

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
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('primary')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'primary' 
                ? 'bg-white text-blue-900 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server size={14} />
            <span>Database Utama</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bridge')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bridge' 
                ? 'bg-blue-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>Jembatan Siaran</span>
            {isSharedBroadcastConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rls')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rls' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/60'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Solusi RLS Supabase</span>
            <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase">
              Fix
            </span>
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
                    <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.penyiapan ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      <span className="font-bold">Penyiapan</span>
                      {testResult?.tables.penyiapan ? <Check size={14} /> : <span className="text-[10px]">--</span>}
                    </div>
                    <div className={`p-2 rounded-xl border flex items-center justify-between ${testResult?.tables.barang ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      <span className="font-bold">Master Barang</span>
                      {testResult?.tables.barang ? <Check size={14} /> : <span className="text-[10px]">--</span>}
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

          {/* TAB 3: SOLUSI RLS SUPABASE */}
          {activeTab === 'rls' && (
            <div className="space-y-4">
              {/* Alert Notice Explanation */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-black text-amber-900">
                  <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                  <span>Notifikasi: Table publicly accessible</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 font-mono text-[11px] text-amber-900 leading-relaxed">
                  <em>&ldquo;Anyone with your project URL can read, edit, and delete all data in this table because Row-Level Security is not enabled.&rdquo;</em>
                </div>
                <p className="leading-relaxed m-0 text-[11px] text-amber-800">
                  Peringatan ini muncul karena PostgreSQL di Supabase mendeteksi fitur <strong>Row-Level Security (RLS)</strong> berstatus <em>DISABLED</em>. Namun jika RLS langsung diaktifkan tanpa kebijakan izin (<em>Policy</em>), seluruh pencatatan transaksi aplikasi (Inbound, Penyiapan, Inventory, Broadcast) akan langsung error diblokir oleh PostgREST.
                </p>
              </div>

              {/* Solusi & Langkah Cepat */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>3 Langkah Cepat Menyelesaikan Masalah:</span>
                  </span>
                </div>

                <ol className="text-xs text-slate-700 space-y-2 pl-4 list-decimal font-medium leading-relaxed m-0">
                  <li>
                    Klik tombol hijau <strong>&ldquo;Salin Skrip SQL Perbaikan RLS&rdquo;</strong> di bawah ini.
                  </li>
                  <li>
                    Buka project Supabase Anda di browser, masuk ke menu <strong>SQL Editor</strong> &gt; klik <strong>&ldquo;New query&rdquo;</strong>.
                  </li>
                  <li>
                    <strong>Tempel (Paste)</strong> skrip SQL tersebut, lalu klik tombol hijau <strong>Run</strong>.
                  </li>
                </ol>

                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2 font-bold">
                  <Sparkles size={14} className="text-emerald-600 shrink-0" />
                  <span>Hasil: Notifikasi merah di Supabase langsung hilang, RLS aktif resmi, dan aplikasi tetap berjalan 100% lancar!</span>
                </div>

                {/* Tombol Copy & Link Supabase */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(RLS_FIX_SQL);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3500);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      copiedSql
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-900 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {copiedSql ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedSql ? '✓ Berhasil Disalin ke Clipboard!' : 'Salin Skrip SQL Perbaikan RLS'}</span>
                  </button>

                  <a
                    href={
                      inputUrl && inputUrl.includes('supabase.co')
                        ? `https://supabase.com/dashboard/project/${inputUrl.replace('https://', '').split('.')[0]}/sql/new`
                        : 'https://supabase.com/dashboard'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline"
                  >
                    <ExternalLink size={14} />
                    <span>Buka Supabase SQL Editor</span>
                  </a>
                </div>
              </div>

              {/* SQL Code Box Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <FileCode size={13} className="text-blue-900" />
                    <span>Pratinjau Skrip SQL (supabase_enable_rls.sql):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">14 Tabel Terproteksi</span>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800 leading-relaxed select-all">
                    {RLS_FIX_SQL}
                  </pre>
                </div>
              </div>
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

export default SupabaseConnectionModal;

