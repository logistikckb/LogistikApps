import { useState, useEffect } from 'react';
import { BellRing, ShieldCheck, X, Smartphone, Laptop, Check } from 'lucide-react';
import { initAudioUnlock } from '../../utils/broadcastSound';

interface NotificationPermissionBannerProps {
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  isSupported: boolean;
}

export function NotificationPermissionBanner({
  permission,
  onRequestPermission,
  isSupported
}: NotificationPermissionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed today
    const dismissedUntil = localStorage.getItem('ckb_notif_banner_dismissed');
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setDismissed(true);
    }
  }, []);

  if (!isSupported || permission === 'granted' || dismissed) {
    if (justGranted) {
      return (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check size={18} className="stroke-[3]" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-950">Notifikasi Perangkat Berhasil Diaktifkan!</p>
              <p className="text-[11px] text-emerald-800 font-medium">Perangkat ini akan otomatis berdering dan memunculkan pesan siaran secara langsung.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setJustGranted(false)}
            className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-200/50 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      );
    }
    return null;
  }

  const handleActivate = async () => {
    initAudioUnlock();
    const res = await onRequestPermission();
    if (res === 'granted') {
      setJustGranted(true);
      setTimeout(() => setJustGranted(false), 6000);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 12 hours
    localStorage.setItem('ckb_notif_banner_dismissed', String(Date.now() + 12 * 60 * 60 * 1000));
  };

  return (
    <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-blue-500/15 border border-amber-400/40 shadow-md backdrop-blur-md animate-fade-in relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
            <BellRing size={20} className="animate-bounce" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>Aktifkan Notifikasi Layar & Getar Perangkat</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider">
                Semua Browser
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
              Izinkan browser agar pesan siaran pos logistik langsung bersuara, bergetar, dan muncul melayang di layar HP / Laptop Anda saat membuka tab lain.
            </p>
            <div className="flex items-center gap-3 pt-0.5 text-[10px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <Smartphone size={11} className="text-pink-600" /> Android & iPhone
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Laptop size={11} className="text-blue-600" /> Windows, Mac & Linux
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 text-xs font-bold transition-all cursor-pointer"
          >
            Nanti
          </button>
          <button
            type="button"
            onClick={handleActivate}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 hover:from-amber-700 hover:to-pink-700 text-white text-xs font-black shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck size={14} className="stroke-[2.5]" />
            <span>Aktifkan Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
