import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Clock, RefreshCw, LogOut, Lock, Smartphone } from 'lucide-react';

export function InactivityWarningModal() {
  const { sessionExpiryWarning, resetInactivityTimer, logout } = useAuth();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (sessionExpiryWarning?.isWarning) {
      const interval = setInterval(() => {
        setPulse((p) => !p);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionExpiryWarning?.isWarning]);

  if (!sessionExpiryWarning || !sessionExpiryWarning.isWarning) {
    return null;
  }

  const seconds = Math.max(0, sessionExpiryWarning.secondsRemaining);
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  const formattedTime = `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`;

  // Calculate percentage of 2-minute warning (120s max)
  const totalWarningSeconds = 120;
  const progressPercent = Math.min(100, Math.max(0, (seconds / totalWarningSeconds) * 100));

  return (
    <div 
      id="inactivity-warning-backdrop"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
    >
      <div 
        id="inactivity-warning-card"
        className="glass-box !bg-white/95 max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-2xl border-2 border-amber-400 relative overflow-hidden text-center space-y-4"
      >
        {/* Ambient Glows */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-red-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Security Badge Header */}
        <div className="flex items-center justify-center gap-2">
          <span className="bg-amber-500 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1.5">
            <ShieldAlert size={14} className={pulse ? 'animate-bounce' : ''} />
            Proteksi Keamanan Perangkat Bersama
          </span>
        </div>

        {/* Big Countdown Display */}
        <div className="py-2">
          <div className="inline-flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-inner">
            <div className="flex items-center gap-2 text-amber-900 mb-1">
              <Clock size={18} className="animate-spin" />
              <span className="text-xs font-black uppercase tracking-wider">Sesi Akan Berakhir Dalam</span>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-black text-red-600 tracking-wider">
              {formattedTime}
            </div>
            {/* Progress Bar */}
            <div className="w-48 h-2 bg-amber-200 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Explanation Text */}
        <div className="space-y-1.5">
          <h2 id="inactivity-warning-title" className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight m-0">
            Peringatan Tidak Ada Aktivitas
          </h2>
          <p className="text-xs text-slate-600 font-medium leading-relaxed m-0 max-w-sm mx-auto">
            Tidak terdeteksi aktivitas selama hampir <strong>30 menit</strong>. Untuk mengamankan data stok, expired date, dan informasi logistik sensitif pada tablet / HP bersama, akun akan otomatis keluar.
          </p>
        </div>

        {/* Device Safety Note */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <Smartphone size={14} className="text-blue-900 shrink-0" />
          <span>Sentuh tombol di bawah atau gerakkan layar untuk tetap aktif</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            id="btn-extend-session"
            type="button"
            onClick={resetInactivityTimer}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-700 hover:from-blue-800 hover:to-indigo-600 active:bg-blue-950 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
          >
            <RefreshCw size={15} />
            <span>Tetap Masuk & Lanjutkan</span>
          </button>

          <button
            id="btn-logout-now"
            type="button"
            onClick={() => logout('manual')}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-red-50 active:bg-red-100 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut size={15} />
            <span>Keluar Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
