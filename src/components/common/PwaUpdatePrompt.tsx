import React, { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  ArrowUpCircle, 
  X, 
  CheckCircle2, 
  Info, 
  Layers, 
  Calendar, 
  Check, 
  Zap, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

export function PwaUpdatePrompt() {
  const { 
    isUpdateAvailable, 
    updateInfo, 
    isUpdating, 
    currentVersion, 
    applyUpdate, 
    dismissUpdate,
    showUpdateModal,
    setShowUpdateModal
  } = usePwa();

  const [toastDismissed, setToastDismissed] = useState(false);

  // If no update is available, don't show toast (modal can still be opened manually)
  if (!isUpdateAvailable && !showUpdateModal) {
    return null;
  }

  const targetVersion = updateInfo?.version || 'Terbaru';
  const changelog = updateInfo?.changelog || [
    'Pembaruan kode aplikasi dan modul sistem logistik',
    'Penyempurnaan cache offline dan sinkronisasi data',
    'Perbaikan performa pemindaian scanner dan cetak label Honeywell'
  ];

  return (
    <>
      {/* 1. FLOATING UPDATE BANNER / TOAST (Bottom-Right / Mobile-Bottom) */}
      {isUpdateAvailable && !toastDismissed && !showUpdateModal && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[260] animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl border-2 border-cyan-400/60 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-start gap-3 relative z-10">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30 animate-pulse">
                <ArrowUpCircle size={22} />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-xs font-black text-white uppercase tracking-tight m-0 truncate">
                    Pembaruan Kode Tersedia!
                  </h4>
                  <span className="px-1.5 py-0.2 bg-cyan-400 text-slate-950 text-[9px] font-black rounded-md tracking-wider">
                    v{targetVersion}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium m-0 leading-snug">
                  Versi terbaru aplikasi LogistikApps siap dipasang. Muat ulang sekarang untuk mendapatkan fitur terbaru.
                </p>

                {/* Buttons Row */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => applyUpdate()}
                    disabled={isUpdating}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                    <span>{isUpdating ? 'Memperbarui...' : 'Perbarui Sekarang'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(true)}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors cursor-pointer"
                  >
                    Detail
                  </button>
                </div>
              </div>

              {/* Close / Dismiss Floating Toast */}
              <button
                type="button"
                onClick={() => {
                  setToastDismissed(true);
                  dismissUpdate();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Tunda (Perbarui Nanti)"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. UPDATE DETAIL & CHANGELOG MODAL */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200 text-slate-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-blue-200 text-left relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-900 to-cyan-700 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-900/20">
                  <ArrowUpCircle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0 uppercase tracking-tight">
                    Pembaruan Sistem PWA
                  </h3>
                  <p className="text-xs text-blue-900 font-bold m-0 flex items-center gap-1.5 mt-0.5">
                    <span>Versi {currentVersion}</span>
                    <ChevronRight size={12} className="text-slate-400" />
                    <span className="text-cyan-600 bg-cyan-50 px-1.5 py-0.2 rounded-md font-extrabold border border-cyan-200">
                      v{targetVersion}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Status Banner */}
              <div className="p-3.5 bg-gradient-to-r from-blue-50 via-cyan-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-cyan-600" />
                    <span>Kode Baru Telah Siap Digunakan</span>
                  </div>
                  <p className="text-[11px] text-slate-600 m-0">
                    Klik tombol perbarui untuk membersihkan memori cache lama dan memuat kode terbaru.
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg border border-emerald-300">
                    Siap Update
                  </span>
                </div>
              </div>

              {/* Release Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={11} />
                    <span>Rilis Versi</span>
                  </div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {updateInfo?.releaseDate || '28 Oktober 2026'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck size={11} />
                    <span>Integritas Sesi</span>
                  </div>
                  <div className="font-bold text-slate-800 mt-0.5 text-emerald-700">
                    Aman & Terjaga
                  </div>
                </div>
              </div>

              {/* Changelog Section */}
              <div className="space-y-2">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider m-0 flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-700" />
                  <span>Catatan Perubahan (Changelog):</span>
                </h5>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {changelog.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">
                        ✓
                      </div>
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanatory note */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <Info size={15} className="text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Proses pembaruan hanya membutuhkan 1-2 detik untuk memuat aset terbaru. Sesi login dan formulir lokal Anda tidak akan hilang.
                </span>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Nanti Saja
              </button>

              <button
                type="button"
                onClick={() => applyUpdate()}
                disabled={isUpdating}
                className="flex-[2] py-2.5 px-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-800 hover:from-blue-950 hover:to-cyan-900 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
                <span>{isUpdating ? 'Sedang Memperbarui...' : 'Perbarui & Muat Ulang Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
