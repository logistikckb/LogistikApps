import React from 'react';
import { QrCode, Wrench, Sparkles, Layers, Calendar, Barcode, ArrowRightLeft, PackageCheck, FileText, ExternalLink, Download, Smartphone } from 'lucide-react';
import { MainToolTab } from './EmbeddedToolsWorkspace';
import { usePwa } from '../context/PwaContext';
import { InstallPwaButton } from './common/InstallPwaButton';

interface ToolsGridProps {
  activeTool?: MainToolTab | null;
  onSelectTool: (tool: MainToolTab) => void;
  onOpenModal: (tool: MainToolTab) => void;
}

export function ToolsGrid({ activeTool, onSelectTool, onOpenModal }: ToolsGridProps) {
  const { isStandalone, canInstall, promptInstall } = usePwa();
  const tools: {
    id: MainToolTab;
    title: string;
    category: string;
    icon: React.ReactNode;
    style: string;
  }[] = [
    {
      id: 'qr-generator',
      title: 'Generator QR Code',
      category: 'Satuan & Massal',
      icon: <QrCode size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-950 text-white shadow-indigo-600/35 ring-1 ring-indigo-400/30'
    },
    {
      id: 'ed-checker',
      title: 'Cek Expired Date',
      category: 'ED & DOY Calculator',
      icon: <Calendar size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-950 text-white shadow-emerald-600/35 ring-1 ring-emerald-400/30'
    },
    {
      id: 'stock-opname',
      title: 'Stock Opname Suite',
      category: 'LARGO to SAP & BA SO',
      icon: <Layers size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-white shadow-blue-700/35 ring-1 ring-blue-400/30'
    },
    {
      id: 'sn-generator',
      title: 'Generator Serial No',
      category: 'Unique Anti-Duplicate',
      icon: <Barcode size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-purple-600 via-violet-800 to-slate-950 text-white shadow-purple-600/35 ring-1 ring-purple-400/30'
    },
    {
      id: 'batch-checker',
      title: 'Batch Checker',
      category: 'LARGO vs SAP Compare',
      icon: <ArrowRightLeft size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-amber-600 via-orange-700 to-amber-950 text-white shadow-amber-600/35 ring-1 ring-amber-400/30'
    },
    {
      id: 'promosi',
      title: 'Promosi',
      category: 'Penerimaan Barang Promosi',
      icon: <PackageCheck size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-orange-600 via-amber-600 to-slate-900 text-white shadow-orange-600/35 ring-1 ring-orange-400/30'
    },
    {
      id: 'surat-jalan',
      title: 'Surat Jalan',
      category: 'Buat, Cetak & Rekap SJ',
      icon: <FileText size={26} className="text-white drop-shadow-sm" />,
      style: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 text-white shadow-blue-600/35 ring-1 ring-blue-400/30'
    }
  ];

  return (
    <div className="mt-10 pt-6 border-t border-slate-300/60">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-900/10 text-blue-900 flex items-center justify-center">
            <Wrench size={18} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 m-0 drop-shadow-sm">
            Daftar Tools & Utilitas
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 bg-white/40 border border-white/60 px-3 py-1 rounded-full hidden sm:inline-block">
            Klik untuk Buka di Halaman Utama
          </span>
          <InstallPwaButton variant="pill" />
          <div className="bg-white/50 border border-white/60 shadow-sm rounded-full px-3.5 py-1 font-bold text-[11px] text-blue-900 tracking-wider backdrop-blur-sm flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Tools Internal</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5 pb-2">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <div
              key={t.id}
              onClick={() => {
                onSelectTool(t.id);
                setTimeout(() => {
                  const elem = document.getElementById('main-page-tool-workspace');
                  if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              title={`${t.title} - Klik untuk Buka di Halaman Utama`}
              className={`glass-box p-3.5 sm:p-4 flex flex-col items-center justify-center relative min-h-[125px] sm:min-h-[140px] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl hover:bg-white/90 hover:border-blue-400 cursor-pointer group overflow-hidden text-slate-800 rounded-2xl sm:rounded-3xl ${
                isActive 
                  ? 'bg-white/95 border-2 border-blue-600 ring-4 ring-blue-400/30 shadow-lg' 
                  : 'bg-white/30 border-white/60'
              }`}
            >
              {/* Active Badge Marker */}
              {isActive && (
                <div className="absolute top-2 right-2 bg-blue-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-xs">
                  AKTIF
                </div>
              )}

              {/* Visual shine gradient effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/0 via-white/30 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Main Icon Tile */}
              <div className={`relative w-13 h-13 sm:w-15 sm:h-15 rounded-[18px] sm:rounded-[20px] flex items-center justify-center shrink-0 shadow-md ${t.style} transition-all duration-300 ease-out group-hover:scale-105 group-hover:-translate-y-1 group-hover:shadow-lg border border-white/40 overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none rounded-[20px]" />
                <div className="absolute -top-5 -left-5 w-10 h-10 bg-white/35 rounded-full blur-md pointer-events-none" />
                <span className="relative z-10">{t.icon}</span>
              </div>

              {/* Title Info */}
              <div className="w-full text-center mt-2.5 px-1 pointer-events-none">
                <h4 className="font-bold text-xs sm:text-[13px] text-slate-800 m-0 tracking-wide leading-snug break-words group-hover:text-blue-900 transition-colors duration-200 capitalize">
                  {t.title}
                </h4>
              </div>

              {/* Pop-Up Button on Hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(t.id);
                }}
                className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-blue-900 hover:text-blue-950 bg-white/90 hover:bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1"
                title="Buka Pop-Up Modal"
              >
                <span>Pop-Up</span>
                <ExternalLink size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
