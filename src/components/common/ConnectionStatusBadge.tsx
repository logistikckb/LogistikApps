import React, { useState } from 'react';
import { useConnectionStatus } from '../../context/ConnectionStatusContext';
import { Activity, RefreshCw, Wifi, WifiOff, CheckCircle2, XCircle, Clock, Server, AlertTriangle, X } from 'lucide-react';

interface ConnectionStatusBadgeProps {
  className?: string;
  showLatency?: boolean;
}

export function ConnectionStatusBadge({ className = '', showLatency = true }: ConnectionStatusBadgeProps) {
  const { status, latencyMs, lastCheckTime, isChecking, errorMessage, checkConnection } = useConnectionStatus();
  const [showModal, setShowModal] = useState(false);

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      {status === 'Live' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ${className}`}
          title={`Status Koneksi: Live (${latencyMs ? `${latencyMs}ms` : 'Aktif'}). Klik untuk melihat diagnostik server.`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold text-[11px] sm:text-xs tracking-wider">Live</span>
          {showLatency && latencyMs !== null && (
            <span className="text-[10px] text-emerald-700/80 font-mono hidden md:inline">
              {latencyMs}ms
            </span>
          )}
        </button>
      ) : status === 'Offline' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 ring-1 ring-rose-200 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 animate-pulse ${className}`}
          title="Koneksi Server Terputus (Offline). Klik untuk melihat detail & hubungkan ulang."
        >
          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
          <span className="font-extrabold text-[11px] sm:text-xs tracking-wider">Offline</span>
          <RefreshCw size={11} className={`text-rose-600 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          disabled
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold ${className}`}
        >
          <RefreshCw size={11} className="animate-spin text-slate-500" />
          <span className="text-[11px]">Memeriksa...</span>
        </button>
      )}

      {/* Modal Diagnostik Koneksi Server */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Tutup */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                status === 'Live' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {status === 'Live' ? <Wifi size={22} /> : <WifiOff size={22} />}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 m-0 uppercase tracking-tight">
                  Status Jaringan Server Cloud
                </h3>
                <p className="text-xs text-slate-500 m-0 font-medium">
                  Heartbeat Pemantauan Koneksi Realtime
                </p>
              </div>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              status === 'Live' 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50/80 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>Kondisi Saat Ini:</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                  status === 'Live' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}>
                  {status}
                </span>
              </div>

              <div className="text-xs space-y-1.5 font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Server size={12} /> Server Cloud Pusat:
                  </span>
                  <span className="font-bold font-mono">
                    {status === 'Live' ? 'Terhubung & Aktif' : 'Terputus'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Activity size={12} /> Waktu Respon (Latency):
                  </span>
                  <span className="font-bold font-mono">
                    {latencyMs !== null ? `${latencyMs} ms` : '--'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Clock size={12} /> Terakhir Diperiksa:
                  </span>
                  <span className="font-bold font-mono">
                    {formatTime(lastCheckTime)}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-white/90 rounded-xl border border-rose-200 text-xs text-rose-800 font-sans flex items-start gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Read Capability Verification */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1 text-slate-700">
              <span className="font-bold block text-slate-800 mb-1">
                Integritas Data Transaksi:
              </span>
              <div className="flex items-center gap-2">
                {status === 'Live' ? (
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                ) : (
                  <XCircle size={15} className="text-rose-600 shrink-0" />
                )}
                <span>
                  {status === 'Live' 
                    ? 'Pembacaan data database server terverifikasi berhasil. Transaksi tersinkron otomatis ke seluruh perangkat tim.' 
                    : 'Koneksi database tidak terverifikasi. Jangan menginput data saat offline untuk menghindari kegagalan sinkronisasi.'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await checkConnection();
                }}
                disabled={isChecking}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
                <span>{isChecking ? 'Menguji Respon Server...' : 'Uji Koneksi Server Sekarang'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConnectionStatusBadge;
