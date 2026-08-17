import React from 'react';
import { LucideIcon, Sparkles, PlusCircle, Construction } from 'lucide-react';

interface PlaceholderToolProps {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: LucideIcon;
  colorClass: string;
  plannedFeatures: string[];
}

export function PlaceholderTool({
  title,
  subtitle,
  category,
  icon: Icon,
  colorClass,
  plannedFeatures,
}: PlaceholderToolProps) {
  return (
    <div className="space-y-4">
      {/* Top Banner Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
            <Construction size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                {title} (Menu Kosong)
              </span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                Siap Dibangun
              </span>
            </div>
            <p className="text-xs text-slate-600 m-0 mt-0.5">
              Halaman ini masih kosong. Silakan instruksikan fitur atau form apa yang ingin Anda isi pada modul ini.
            </p>
          </div>
        </div>

        <div className="px-3 py-1 bg-white/80 border border-amber-200 text-amber-900 text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs">
          <Sparkles size={13} className="text-amber-600" />
          <span>Status: Menunggu Permintaan</span>
        </div>
      </div>

      {/* Lembar Kerja Kosong */}
      <div className="p-8 sm:p-12 rounded-2xl bg-white/60 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
        <div className={`w-16 h-16 rounded-2xl ${colorClass} flex items-center justify-center shadow-md`}>
          <Icon size={32} className="text-white" />
        </div>
        
        <div>
          <h4 className="text-base font-extrabold text-slate-800 m-0 uppercase">
            Halaman Kerja {title}
          </h4>
          <span className="inline-block mt-1 text-[11px] font-bold text-slate-500 bg-slate-200/70 px-3 py-0.5 rounded-full">
            Kategori: {category}
          </span>
        </div>

        <p className="text-xs text-slate-500 max-w-md m-0 leading-relaxed">
          {subtitle}. Modul ini disediakan sebagai template kosong untuk dibangun bertahap sesuai kebutuhan operasional Anda.
        </p>

        <div className="pt-3 flex items-center gap-1.5 text-xs text-blue-900 font-bold bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
          <PlusCircle size={15} />
          <span>Ketik perintah di chat untuk mengisi modul {title}</span>
        </div>
      </div>
    </div>
  );
}
