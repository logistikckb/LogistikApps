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
    <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 shadow-2xs">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
          <BellRing size={16} />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-900">
              Aktifkan Notifikasi Layar & Suara
            </span>
            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 text-[9px] font-bold">
              Semua Browser
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed m-0">
            Izinkan notifikasi agar siaran logistik berdering & muncul otomatis saat berada di tab lain.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-1 md:pt-0 justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
        >
          Nanti
        </button>
        <button
          type="button"
          onClick={handleActivate}
          className="flex-1 md:flex-none px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ShieldCheck size={14} />
          <span>Izinkan Notifikasi</span>
        </button>
      </div>
    </div>
  );
}
