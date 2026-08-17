import React, { useState } from 'react';
import { Download, Smartphone, X, WifiOff } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

export function PwaInstallPrompt() {
  const { isStandalone, canInstall, isOnline, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  // If already running standalone or user dismissed floating bar
  if (isStandalone || dismissed || !canInstall) {
    if (!isOnline) {
      return (
        <div className="fixed bottom-4 left-4 z-50 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-lg animate-pulse">
          <WifiOff size={14} />
          <span>Mode Offline (PWA Cache)</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[150] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3.5 rounded-2xl border border-blue-500/40 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-inner border border-white/20 shrink-0 bg-slate-950 flex items-center justify-center p-0.5">
            <img src="/icons/icon.svg" alt="LogistikApps Shield Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white truncate m-0 leading-tight">
                Pasang LogistikApps
              </h4>
              <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 text-[9px] font-black rounded-md border border-cyan-400/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 m-0 truncate mt-0.5">
              Aplikasi Logistik Terintegrasi & Cepat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={promptInstall}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1 transition-all active:scale-95"
          >
            <Download size={13} />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
