import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Eye, 
  EyeOff, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  Radio, 
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Monitor,
  Lock
} from 'lucide-react';
import { ToolId, ToolItem, TOOLS_LIST } from '../ToolsNavigation';

interface MenuVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLock?: () => void;
  hiddenMenuIds: ToolId[];
  onToggleVisibility: (id: ToolId) => Promise<any>;
  onUnhideAll: () => Promise<any>;
  isSyncing: boolean;
  lastSyncTime: string | null;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function MenuVisibilityModal({
  isOpen,
  onClose,
  onLock,
  hiddenMenuIds,
  onToggleVisibility,
  onUnhideAll,
  isSyncing,
  lastSyncTime,
  showToast
}: MenuVisibilityModalProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'visible' | 'hidden'>('all');
  const [actionInProgressId, setActionInProgressId] = useState<ToolId | null>(null);

  if (!isOpen) return null;

  const totalHidden = hiddenMenuIds.length;
  const totalVisible = TOOLS_LIST.length - totalHidden;

  const filteredTools = TOOLS_LIST.filter(tool => {
    const isHidden = hiddenMenuIds.includes(tool.id);
    if (filterMode === 'visible' && isHidden) return false;
    if (filterMode === 'hidden' && !isHidden) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = tool.title.toLowerCase().includes(q);
      const matchDesc = tool.shortDesc.toLowerCase().includes(q);
      const matchCat = tool.category.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchCat;
    }
    return true;
  });

  const handleToggle = async (tool: ToolItem) => {
    setActionInProgressId(tool.id);
    const wasHidden = hiddenMenuIds.includes(tool.id);
    try {
      const res = await onToggleVisibility(tool.id);
      if (res && res.success === false) {
        showToast('Peringatan Cloud', res.message || 'Perubahan disimpan di lokal perangkat ini.', 'warning');
      } else {
        showToast(
          wasHidden ? 'Menu Ditampilkan' : 'Menu Disembunyikan',
          `Menu "${tool.title}" kini ${wasHidden ? 'tampil' : 'disembunyikan'} di SEMUA perangkat tim.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast('Gagal Mengubah Visibilitas', err?.message || 'Terjadi kesalahan jaringan.', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResetAll = async () => {
    if (hiddenMenuIds.length === 0) {
      showToast('Sudah Tampil Semua', 'Semua menu saat ini sudah dalam keadaan aktif/tampil.', 'info');
      return;
    }

    try {
      await onUnhideAll();
      showToast('Semua Menu Ditampilkan', 'Seluruh menu aplikasi kini aktif dan dapat diakses di semua perangkat.', 'success');
    } catch (err: any) {
      showToast('Gagal Mereset', err?.message || 'Terjadi kesalahan.', 'error');
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white p-4 sm:p-6 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col overflow-hidden text-left">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Eye size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-800 m-0 truncate">
                  Pengaturan Visibilitas Menu
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1 shrink-0">
                  <Lock size={10} /> PIN Terverifikasi
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 truncate">
                Hide atau Unhide menu untuk <strong>seluruh perangkat</strong> secara realtime melalui server cloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full cursor-pointer transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Realtime Multi-Device Sync Banner */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 mb-3 shrink-0 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Radio size={14} className="animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>Sinkronisasi Otomatis Antar-Perangkat</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-ping" />
              </div>
              <p className="text-[11px] text-slate-600 m-0">
                Menu yang disembunyikan (Hide) langsung hilang seketika di HP, tablet, dan PC anggota tim lain tanpa perlu refresh.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white/80 px-2.5 py-1 rounded-xl border border-blue-100 shrink-0">
            <Smartphone size={12} className="text-blue-600" />
            <span>+</span>
            <Monitor size={12} className="text-indigo-600" />
            <span>Semua Device</span>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama menu..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({TOOLS_LIST.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('visible')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'visible'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktif ({totalVisible})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('hidden')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'hidden'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tersembunyi ({totalHidden})
            </button>
          </div>
        </div>

        {/* List of Menus */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {filteredTools.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <EyeOff size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-xs m-0">Tidak ada menu yang sesuai dengan filter.</p>
            </div>
          ) : (
            filteredTools.map((tool) => {
              const isHidden = hiddenMenuIds.includes(tool.id);
              const isUpdating = actionInProgressId === tool.id || isSyncing;
              const Icon = tool.icon;

              return (
                <div
                  key={tool.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isHidden
                      ? 'bg-rose-50/40 border-rose-200 text-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${tool.colorBg} flex items-center justify-center shrink-0 ${
                      isHidden ? 'opacity-50 grayscale-40' : ''
                    }`}>
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-xs ${isHidden ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                          {tool.title}
                        </span>
                        {tool.requiresAdmin && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold">
                            ADMIN
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                          ({tool.category})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0 truncate">
                        {tool.shortDesc}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status & Action Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status Pill */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                      isHidden
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {isHidden ? (
                        <>
                          <EyeOff size={11} />
                          <span>Tersembunyi</span>
                        </>
                      ) : (
                        <>
                          <Eye size={11} />
                          <span>Aktif (Tampil)</span>
                        </>
                      )}
                    </span>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggle(tool)}
                      disabled={isUpdating}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                        isHidden
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200'
                      }`}
                      title={isHidden ? 'Tampilkan menu ini untuk semua perangkat' : 'Sembunyikan menu ini untuk semua perangkat'}
                    >
                      {isUpdating && actionInProgressId === tool.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : isHidden ? (
                        <>
                          <Eye size={13} />
                          <span>Unhide</span>
                        </>
                      ) : (
                        <>
                          <EyeOff size={13} />
                          <span>Hide</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              disabled={hiddenMenuIds.length === 0 || isSyncing}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Kembalikan semua menu agar aktif dan terlihat di semua perangkat"
            >
              <RotateCcw size={12} />
              <span>Tampilkan Semua Menu</span>
            </button>
            {lastSyncTime && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Sinkron: {lastSyncTime}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onLock && (
              <button
                type="button"
                onClick={() => {
                  onLock();
                  onClose();
                  showToast('Akses Dikunci', 'PIN diperlukan kembali untuk mengubah menu.', 'info');
                }}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-amber-200 shadow-2xs"
                title="Kunci kembali akses pengaturan menu"
              >
                <Lock size={12} />
                <span>Kunci PIN</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  ) : null;
}
