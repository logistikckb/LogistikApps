import React from 'react';
import { Loader2 } from 'lucide-react';

interface LazyFallbackProps {
  title?: string;
  minHeight?: string;
}

export function LazyFallback({ title = 'Memuat modul...', minHeight = 'min-h-[220px]' }: LazyFallbackProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${minHeight} bg-white rounded-2xl border border-slate-200/90 shadow-2xs`}>
      <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-900 shadow-2xs mb-3">
        <Loader2 size={20} className="animate-spin text-blue-900" />
      </div>
      <p className="text-xs font-bold text-slate-800 m-0">{title}</p>
      <p className="text-[11px] text-slate-500 font-medium m-0 mt-0.5">Menyiapkan modul & data...</p>
    </div>
  );
}
