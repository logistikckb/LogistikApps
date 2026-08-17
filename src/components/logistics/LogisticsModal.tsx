import React, { lazy, Suspense } from 'react';
import { X, Calendar, Layers, Barcode, ArrowRightLeft, PackageCheck, FileText } from 'lucide-react';
import { LazyFallback } from '../common/LazyFallback';

const EdCheckerModule = lazy(() => import('./EdCheckerModule').then(m => ({ default: m.EdCheckerModule })));
const StockOpnameModule = lazy(() => import('./StockOpnameModule').then(m => ({ default: m.StockOpnameModule })));
const SnGeneratorModule = lazy(() => import('./SnGeneratorModule').then(m => ({ default: m.SnGeneratorModule })));
const BatchCheckerModule = lazy(() => import('./BatchCheckerModule').then(m => ({ default: m.BatchCheckerModule })));
const PromosiModule = lazy(() => import('./PromosiModule').then(m => ({ default: m.PromosiModule })));
const SuratJalanModule = lazy(() => import('./SuratJalanModule').then(m => ({ default: m.SuratJalanModule })));

export type LogisticsTab = 'ed-checker' | 'stock-opname' | 'sn-generator' | 'batch-checker' | 'promosi' | 'surat-jalan';

interface LogisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LogisticsTab;
}

export function LogisticsModal({ isOpen, onClose, initialTab = 'ed-checker' }: LogisticsModalProps) {
  if (!isOpen) return null;

  const toolConfig = {
    'ed-checker': {
      title: 'Form Cek Expired Date & DOY Calculator',
      subtitle: 'Kalkulator tanggal kadaluarsa, hitung H-Days, Day of Year (DOY), dan tanggal produksi',
      icon: <Calendar size={22} className="text-white" />,
      bgGradient: 'from-emerald-600 via-teal-700 to-emerald-950',
      component: <EdCheckerModule />
    },
    'stock-opname': {
      title: 'Form Stock Opname Suite (LARGO to SAP & BA SO)',
      subtitle: 'Konversi data stok LARGO ke format upload SAP & buat Berita Acara Stock Opname otomatis',
      icon: <Layers size={22} className="text-white" />,
      bgGradient: 'from-blue-700 via-indigo-800 to-slate-900',
      component: <StockOpnameModule />
    },
    'sn-generator': {
      title: 'Form Generator Serial Number (Anti-Duplicate)',
      subtitle: 'Generate nomor seri unik otomatis anti-duplikat untuk inbound & outbound WMS',
      icon: <Barcode size={22} className="text-white" />,
      bgGradient: 'from-purple-600 via-violet-800 to-slate-950',
      component: <SnGeneratorModule />
    },
    'batch-checker': {
      title: 'Form Batch Reconciliation Checker (LARGO vs SAP)',
      subtitle: 'Komparasi otomatis status batch produk antara LARGO vs SAP dengan 5 klasifikasi status',
      icon: <ArrowRightLeft size={22} className="text-white" />,
      bgGradient: 'from-amber-600 via-orange-700 to-amber-950',
      component: <BatchCheckerModule />
    },
    'promosi': {
      title: 'Form & Rekap Penerimaan Barang Promosi',
      subtitle: 'Pencatatan, rekapitulasi data, serta impor & ekspor Excel penerimaan barang promosi inbound gudang',
      icon: <PackageCheck size={22} className="text-white" />,
      bgGradient: 'from-orange-600 via-amber-700 to-slate-950',
      component: <PromosiModule />
    },
    'surat-jalan': {
      title: 'Surat Jalan Studio & Rekapitulasi',
      subtitle: 'Pembuatan surat jalan pengiriman gudang, cetak A4/Letter, rekapitulasi barang, & master data',
      icon: <FileText size={22} className="text-white" />,
      bgGradient: 'from-blue-600 via-indigo-700 to-slate-950',
      component: <SuratJalanModule />
    }
  };

  const currentTool = toolConfig[initialTab] || toolConfig['ed-checker'];

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-box !bg-white/95 p-5 sm:p-7 rounded-3xl max-w-5xl w-full shadow-2xl border border-blue-300 relative max-h-[92vh] flex flex-col overflow-hidden text-left">
        {/* Header - Dedicated to Selected Tool */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${currentTool.bgGradient} text-white flex items-center justify-center shadow-md shrink-0`}>
              {currentTool.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 m-0">{currentTool.title}</h3>
              <p className="text-xs text-slate-500 m-0">{currentTool.subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer shrink-0"
            title="Tutup Form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dedicated Tool Content Form with Suspense */}
        <div className="flex-1 overflow-y-auto pr-1">
          <Suspense fallback={<LazyFallback title={`Memuat ${currentTool.title}...`} />}>
            {currentTool.component}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
