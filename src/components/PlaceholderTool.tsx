import React from 'react';
import { LucideIcon, Sparkles, PlusCircle, Construction } from 'lucide-react';

interface PlaceholderToolProps {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: LucideIcon | React.ElementType;
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
      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Construction size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                {title} (Menu Kosong)
              </span>
              <span className="bg-amber-100/80 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-200">
                Siap Dibangun
              </span>
            </div>
            <p className="text-xs text-slate-600 m-0 mt-0.5">
              Halaman ini masih kosong. Silakan instruksikan fitur atau form apa yang ingin Anda isi pada modul ini.
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 text-xs font-semibold shrink-0 flex items-center gap-1.5 shadow-2xs rounded-xl">
          <Sparkles size={13} className="text-amber-600" />
          <span>Status: Menunggu Permintaan</span>
        </div>
      </div>

      {/* Lembar Kerja Kosong */}
      <div className="p-8 sm:p-12 rounded-2xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-3 min-h-[240px]">
        <div className={`w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center`}>
          <Icon size={28} />
        </div>
        
        <div>
          <h4 className="text-sm sm:text-base font-bold text-slate-800 m-0 uppercase">
            Halaman Kerja {title}
          </h4>
          <span className="inline-block mt-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200/80">
            Kategori: {category}
          </span>
        </div>

        <p className="text-xs text-slate-500 max-w-md m-0 leading-relaxed">
          {subtitle}. Modul ini disediakan sebagai template kosong untuk dibangun bertahap sesuai kebutuhan operasional Anda.
        </p>

        <div className="pt-2 flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl">
          <PlusCircle size={15} />
          <span>Ketik perintah di chat untuk mengisi modul {title}</span>
        </div>
      </div>
    </div>
  );
}
