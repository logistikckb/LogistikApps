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
      icon: <QrCode size={24} className="text-indigo-600" />,
      style: 'bg-indigo-50 border border-indigo-200/80 text-indigo-600'
    },
    {
      id: 'ed-checker',
      title: 'Cek Expired Date',
      category: 'ED & DOY Calculator',
      icon: <Calendar size={24} className="text-emerald-600" />,
      style: 'bg-emerald-50 border border-emerald-200/80 text-emerald-600'
    },
    {
      id: 'stock-opname',
      title: 'Stock Opname Suite',
      category: 'LARGO to SAP & BA SO',
      icon: <Layers size={24} className="text-blue-600" />,
      style: 'bg-blue-50 border border-blue-200/80 text-blue-600'
    },
    {
      id: 'sn-generator',
      title: 'Generator Serial No',
      category: 'Unique Anti-Duplicate',
      icon: <Barcode size={24} className="text-purple-600" />,
      style: 'bg-purple-50 border border-purple-200/80 text-purple-600'
    },
    {
      id: 'batch-checker',
      title: 'Batch Checker',
      category: 'LARGO vs SAP Compare',
      icon: <ArrowRightLeft size={24} className="text-amber-700" />,
      style: 'bg-amber-50 border border-amber-200/80 text-amber-700'
    },
    {
      id: 'promosi',
      title: 'Promosi',
      category: 'Penerimaan Barang Promosi',
      icon: <PackageCheck size={24} className="text-orange-600" />,
      style: 'bg-orange-50 border border-orange-200/80 text-orange-600'
    },
    {
      id: 'surat-jalan',
      title: 'Surat Jalan',
      category: 'Buat, Cetak & Rekap SJ',
      icon: <FileText size={24} className="text-sky-600" />,
      style: 'bg-sky-50 border border-sky-200/80 text-sky-600'
    }
  ];

  return (
    <div className="mt-8 pt-5 border-t border-slate-200/80">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
            <Wrench size={15} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 m-0">
            Daftar Tools & Utilitas
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-lg hidden sm:inline-block">
            Klik untuk Buka di Halaman Utama
          </span>
          <InstallPwaButton variant="pill" />
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-0.5 font-semibold text-[11px] text-blue-700 flex items-center gap-1.5 shadow-2xs">
            <Sparkles size={12} className="text-amber-500" />
            <span>Tools Internal</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-3.5 pb-2">
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
              className={`p-3 sm:p-3.5 flex flex-col items-center justify-center relative min-h-[110px] sm:min-h-[125px] transition-colors cursor-pointer group bg-white hover:bg-slate-50 border rounded-2xl shadow-2xs ${
                isActive 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Active Badge Marker */}
              {isActive && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  AKTIF
                </div>
              )}

              {/* Main Icon Tile */}
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${t.style} transition-transform group-hover:scale-105 shadow-2xs`}>
                {t.icon}
              </div>

              {/* Title Info */}
              <div className="w-full text-center mt-2 px-1 pointer-events-none">
                <h4 className="font-semibold text-xs text-slate-800 m-0 tracking-tight leading-snug break-words group-hover:text-blue-700 transition-colors capitalize">
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
                className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1"
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
