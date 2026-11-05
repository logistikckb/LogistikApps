import React from 'react';
import { 
  Calendar, Layers, Barcode, ArrowRightLeft, PackageCheck, FileText, 
  X, Maximize2, Sparkles
} from 'lucide-react';
import { LogisticsTab } from './logistics/LogisticsModal';

// Logistics Modules - Direct imports
import { EdCheckerModule } from './logistics/EdCheckerModule';
import { StockOpnameModule } from './logistics/StockOpnameModule';
import { SnGeneratorModule } from './logistics/SnGeneratorModule';
import { BatchCheckerModule } from './logistics/BatchCheckerModule';
import { PromosiModule } from './logistics/PromosiModule';
import { SuratJalanModule } from './logistics/SuratJalanModule';

export type MainToolTab = LogisticsTab;

interface EmbeddedToolsWorkspaceProps {
  activeTool: MainToolTab;
  onSelectTool: (tool: MainToolTab) => void;
  onOpenModal: (tool: MainToolTab) => void;
  onCloseWorkspace?: () => void;
}

export function EmbeddedToolsWorkspace({ 
  activeTool, 
  onSelectTool, 
  onOpenModal, 
  onCloseWorkspace
}: EmbeddedToolsWorkspaceProps) {
  const toolsList: { id: MainToolTab; title: string; icon: React.ReactNode; style: string }[] = [
    {
      id: 'ed-checker',
      title: 'Cek Expired Date',
      icon: <Calendar size={16} />,
      style: 'from-emerald-600 to-teal-800'
    },
    {
      id: 'stock-opname',
      title: 'Stock Opname Suite',
      icon: <Layers size={16} />,
      style: 'from-blue-700 to-slate-900'
    },
    {
      id: 'sn-generator',
      title: 'Generator Serial No',
      icon: <Barcode size={16} />,
      style: 'from-purple-600 to-violet-900'
    },
    {
      id: 'batch-checker',
      title: 'Batch Checker',
      icon: <ArrowRightLeft size={16} />,
      style: 'from-amber-600 to-orange-800'
    },
    {
      id: 'promosi',
      title: 'Barang Promosi',
      icon: <PackageCheck size={16} />,
      style: 'from-orange-600 to-amber-800'
    },
    {
      id: 'surat-jalan',
      title: 'Surat Jalan Studio',
      icon: <FileText size={16} />,
      style: 'from-blue-600 to-indigo-800'
    }
  ];

  const currentToolInfo = toolsList.find(t => t.id === activeTool) || toolsList[0];

  return (
    <div id="main-page-tool-workspace" className="mt-8 scroll-mt-6 animate-fade-in">
      <div className="glass-box p-4 sm:p-6 bg-white/95 border border-blue-300/80 shadow-xl rounded-3xl relative overflow-hidden">
        
        {/* Workspace Top Header & Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${currentToolInfo.style} text-white flex items-center justify-center shadow-md shrink-0`}>
              {currentToolInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="bg-blue-900 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  HALAMAN UTAMA WORKSPACE
                </span>
                <Sparkles size={13} className="text-amber-500" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 m-0 leading-tight">
                {currentToolInfo.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenModal(activeTool)}
              className="glass-btn !py-1.5 !px-3 !rounded-xl text-xs font-bold bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Buka dalam Jendela Pop-Up Modal"
            >
              <Maximize2 size={14} />
              <span>Layar Pop-Up</span>
            </button>

            {onCloseWorkspace && (
              <button
                onClick={onCloseWorkspace}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                title="Sembunyikan Workspace Tools"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Tool Switcher Tab Bar directly on Main Page */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {toolsList.map(t => {
            const isActive = t.id === activeTool;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTool(t.id)}
                className={`py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  isActive
                    ? 'bg-blue-900 text-white border-blue-950 ring-2 ring-blue-400/50 shadow-md'
                    : 'bg-slate-100/80 text-slate-700 border-slate-200/90 hover:bg-white hover:text-blue-900'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.title}</span>
              </button>
            );
          })}
        </div>

        {/* ACTIVE TOOL MODULE RENDERING */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-inner">
          {activeTool === 'ed-checker' && <EdCheckerModule />}
          {activeTool === 'stock-opname' && <StockOpnameModule />}
          {activeTool === 'sn-generator' && <SnGeneratorModule />}
          {activeTool === 'batch-checker' && <BatchCheckerModule />}
          {activeTool === 'promosi' && <PromosiModule />}
          {activeTool === 'surat-jalan' && <SuratJalanModule />}
        </div>
      </div>
    </div>
  );
}
