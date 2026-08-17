import React from 'react';
import { Download, Smartphone, CheckCircle } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

interface InstallPwaButtonProps {
  variant?: 'header' | 'sidebar' | 'banner' | 'pill';
  className?: string;
  showInstalledStatus?: boolean;
}

export function InstallPwaButton({
  variant = 'header',
  className = '',
  showInstalledStatus = false,
}: InstallPwaButtonProps) {
  const { isStandalone, canInstall, promptInstall } = usePwa();

  // If app is already installed & running in standalone mode
  if (isStandalone) {
    if (!showInstalledStatus) return null;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 shadow-2xs ${className}`}
        title="Aplikasi CKBLogistic terpasang (Mode Standalone)"
      >
        <CheckCircle size={12} className="text-emerald-600" />
        <span>App Terpasang</span>
      </div>
    );
  }

  // If not standalone, show install button
  if (!canInstall) return null;

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className={`glass-btn !py-1 !px-2.5 !text-[10px] !rounded-lg text-blue-900 bg-blue-500/15 hover:bg-blue-500/25 border-blue-400/40 hover:border-blue-500 font-extrabold flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95 animate-pulse ${className}`}
        title="Pasang CKBLogistic sebagai Aplikasi (PWA)"
      >
        <Download size={12} className="text-blue-900 animate-bounce" />
        <span>Install App</span>
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer ${className}`}
        title="Install Aplikasi CKBLogistic ke Layar Utama"
      >
        <Smartphone size={14} className="animate-bounce" />
        <span>Install Aplikasi PWA</span>
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className={`w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer border border-blue-700/50 ${className}`}
        title="Pasang aplikasi di layar utama perangkat Anda"
      >
        <Download size={14} className="animate-bounce" />
        <span>Pasang Aplikasi (PWA)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={promptInstall}
      className={`px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 ${className}`}
    >
      <Download size={13} />
      <span>Install PWA</span>
    </button>
  );
}
