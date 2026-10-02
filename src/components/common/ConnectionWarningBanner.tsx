import React from 'react';
import { useConnectionStatus } from '../../context/ConnectionStatusContext';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

export function ConnectionWarningBanner() {
  const { status, isChecking, checkConnection } = useConnectionStatus();

  if (status !== 'Offline') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white p-3 sm:p-3.5 rounded-2xl shadow-md border border-red-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in my-2">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-white font-bold shadow-2xs">
          <WifiOff size={20} className="animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-white">
              Peringatan: Koneksi Server Terputus (Offline)
            </span>
            <span className="bg-white/25 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
              Sinkronisasi Terhenti
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-rose-100 font-medium m-0 mt-0.5 leading-snug">
            Perangkat tidak tersambung ke server cloud. <strong>Harap jangan melakukan input atau update data transaksi baru</strong> saat kondisi ini agar data Anda tidak hilang atau gagal tersinkronisasi antar perangkat.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={() => checkConnection()}
          disabled={isChecking}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-800 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
          <span>{isChecking ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}</span>
        </button>
      </div>
    </div>
  );
}

export default ConnectionWarningBanner;
