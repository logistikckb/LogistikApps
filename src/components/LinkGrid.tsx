import React, { useState, useMemo, useEffect, DragEvent } from 'react';
import { Search, Plus, Edit2, Trash2, ExternalLink, Move, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { LinkData } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useMenuOrder } from '../hooks/useSupabase';

interface LinkGridProps {
  links: LinkData[];
  loading: boolean;
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (link: LinkData) => void;
  onDelete: (id: string) => void;
}

const NATIVE_ICON_STYLES = [
  'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-900 text-white shadow-blue-600/35 ring-1 ring-blue-400/30',
  'bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 text-white shadow-orange-500/35 ring-1 ring-orange-400/30',
  'bg-gradient-to-br from-emerald-400 via-teal-600 to-emerald-800 text-white shadow-emerald-600/35 ring-1 ring-emerald-400/30',
  'bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-900 text-white shadow-purple-600/35 ring-1 ring-purple-400/30',
  'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 text-white shadow-sky-500/35 ring-1 ring-sky-400/30',
  'bg-gradient-to-br from-rose-400 via-pink-500 to-rose-700 text-white shadow-pink-500/35 ring-1 ring-pink-400/30',
  'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 text-amber-300 shadow-slate-900/35 ring-1 ring-slate-600/30',
  'bg-gradient-to-br from-cyan-400 via-teal-500 to-blue-700 text-white shadow-cyan-500/35 ring-1 ring-cyan-400/30',
];

export function LinkGrid({ links, loading, isAdmin, onAdd, onEdit, onDelete }: LinkGridProps) {
  const { showConfirm, showToast } = useNotification();
  const { menuOrder, saveMenuOrder } = useMenuOrder();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [isReordering, setIsReordering] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    links.forEach(l => {
      if (l.category) {
        // Format to Title Case
        const formatted = l.category.charAt(0).toUpperCase() + l.category.slice(1).toLowerCase();
        cats.add(formatted);
      }
    });
    return ['Semua', ...Array.from(cats)];
  }, [links]);

  const orderedLinks = useMemo(() => {
    if (menuOrder.length === 0) return links;
    const map = new Map(links.map(l => [l.id, l]));
    const result: LinkData[] = [];
    
    // Add links in custom order
    menuOrder.forEach(id => {
      if (map.has(id)) {
        result.push(map.get(id)!);
        map.delete(id);
      }
    });
    
    // Append any newly added links not yet in custom order
    map.forEach(l => result.push(l));
    return result;
  }, [links, menuOrder]);

  const filteredLinks = useMemo(() => {
    return orderedLinks.filter(l => {
      const catMatch = category === 'Semua' || category === 'All' || 
                       (l.category || '').toLowerCase() === category.toLowerCase();
      const searchMatch = l.title.toLowerCase().includes(search.toLowerCase()) || 
                          (l.category || '').toLowerCase().includes(search.toLowerCase());
      return catMatch && searchMatch;
    });
  }, [orderedLinks, category, search]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const moveLinkPosition = (id: string, direction: 'prev' | 'next') => {
    const filteredIndex = filteredLinks.findIndex(l => l.id === id);
    if (filteredIndex === -1) return;

    const targetFilteredIndex = direction === 'prev' ? filteredIndex - 1 : filteredIndex + 1;
    if (targetFilteredIndex < 0 || targetFilteredIndex >= filteredLinks.length) return;

    const currentId = id;
    const targetId = filteredLinks[targetFilteredIndex].id;

    const currentFullOrder = orderedLinks.map(l => l.id);
    const idx1 = currentFullOrder.indexOf(currentId);
    const idx2 = currentFullOrder.indexOf(targetId);

    if (idx1 === -1 || idx2 === -1) return;

    // Swap items in full order
    const newFullOrder = [...currentFullOrder];
    newFullOrder[idx1] = targetId;
    newFullOrder[idx2] = currentId;

    saveMenuOrder(newFullOrder);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isReordering) return;
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (!isReordering || !draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!isReordering || !draggedId || draggedId === targetId) return;

    const currentFullOrder = orderedLinks.map(l => l.id);
    const fromIdx = currentFullOrder.indexOf(draggedId);
    const toIdx = currentFullOrder.indexOf(targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newFullOrder = [...currentFullOrder];
      const [movedItem] = newFullOrder.splice(fromIdx, 1);
      newFullOrder.splice(toIdx, 0, movedItem);

      saveMenuOrder(newFullOrder);
      showToast('Posisi Dipindahkan', 'Tata letak baru telah disimpan secara permanen', 'success');
    }
    setDraggedId(null);
  };

  return (
    <>
      <div className="glass-box flex items-center mb-6 p-2 !rounded-full bg-white/40 border border-white/60 focus-within:border-blue-400 focus-within:bg-white/70 focus-within:shadow-lg transition-all duration-300">
        <div className="pl-4 pr-2 text-slate-500 flex items-center">
          <Search size={22} className="transition-transform duration-300 group-focus-within:scale-110" />
        </div>
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari Aplikasi atau Sistem..." 
          className="flex-1 border-none bg-transparent py-3 px-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex justify-center gap-2.5 mb-8 flex-wrap items-center">
        {categories.map(cat => {
          const count = (cat === 'Semua' || cat === 'All') 
            ? links.length 
            : links.filter(l => (l.category || '').toLowerCase() === cat.toLowerCase()).length;
          const isActive = category === cat || (cat === 'Semua' && category === 'All');
          return (
            <button 
              key={cat} 
              onClick={() => setCategory(cat)} 
              className={`glass-btn !rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? '!bg-blue-900 !text-white !border-blue-800 shadow-md' : 'hover:shadow-md'}`}
            >
              {cat} <span className={`glass-badge ml-2 ${isActive ? '!bg-white/20 !text-white !border-white/30' : ''}`}>{count}</span>
            </button>
          );
        })}

        {isAdmin && (
          <button 
            onClick={() => {
              const nextReordering = !isReordering;
              setIsReordering(nextReordering);
              if (nextReordering) {
                showToast('Atur Tata Letak', 'Seret & lepas icon atau gunakan tombol panah kiri/kanan untuk menggeser posisi aplikasi', 'info');
              } else {
                showToast('Tersimpan', 'Tata letak menu aplikasi telah disimpan secara permanen', 'success');
              }
            }} 
            className={`glass-btn !px-4 !rounded-full transition-all duration-300 shadow-sm border ${
              isReordering 
                ? '!bg-emerald-600 !text-white !border-emerald-700 animate-pulse' 
                : 'hover:!bg-white/80 text-slate-700'
            }`}
            title="Atur Urutan Tata Letak Menu"
          >
            {isReordering ? <Check size={16} /> : <Move size={16} />}
            <span>{isReordering ? 'Selesai Atur' : 'Atur Tata Letak'}</span>
          </button>
        )}

        {isAdmin && (
          <button onClick={onAdd} className="glass-btn !bg-orange-500/90 !text-white hover:!bg-orange-600 !border-orange-400 !px-5 !rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-md">
            <Plus size={18} /> Tambah Aplikasi
          </button>
        )}
      </div>

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3 m-0 drop-shadow-sm">
          {category === 'Semua' || category === 'All' ? 'Daftar Aplikasi' : `Aplikasi ${category}`}
        </h2>
        <div className="bg-white/50 border border-white/60 shadow-sm rounded-full px-4 py-1.5 font-bold text-[11px] text-blue-900 tracking-wider backdrop-blur-sm">
          {filteredLinks.length} Item
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5 pb-4">
        {loading ? (
          <div className="col-span-full text-center py-12 glass-box font-bold text-slate-500 text-sm">
            Memuat Data...
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-box font-bold text-slate-500 text-sm">
            Tidak Ditemukan
          </div>
        ) : (
          filteredLinks.map((l, index) => {
            const isEmoji = l.icon && !l.icon.startsWith('fa');
            const nativeStyle = NATIVE_ICON_STYLES[index % NATIVE_ICON_STYLES.length];
            const targetUrl = l.url ? (l.url.startsWith('http://') || l.url.startsWith('https://') ? l.url : `https://${l.url}`) : '#';
            
            const isDraggingThis = draggedId === l.id;
            const isDragOverThis = dragOverId === l.id;

            return (
              <a 
                key={l.id} 
                href={isReordering ? undefined : targetUrl}
                target={isReordering ? undefined : "_blank"}
                rel={isReordering ? undefined : "noopener noreferrer"}
                title={`${l.title} - ${l.category || ''}`}
                draggable={isReordering}
                onDragStart={(e) => handleDragStart(e, l.id)}
                onDragOver={(e) => handleDragOver(e, l.id)}
                onDragLeave={(e) => handleDragLeave(e, l.id)}
                onDrop={(e) => handleDrop(e, l.id)}
                onClick={(e) => {
                  if (isReordering) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className={`glass-box p-3.5 sm:p-4 flex flex-col items-center justify-center relative min-h-[120px] sm:min-h-[135px] transition-all duration-300 ease-out group bg-white/30 overflow-hidden no-underline text-slate-800 block rounded-2xl sm:rounded-3xl ${
                  isReordering ? 'ring-2 ring-orange-400/80 bg-orange-50/30 cursor-grab active:cursor-grabbing' : 'hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl hover:bg-white/90 hover:border-blue-400 cursor-pointer'
                } ${isDraggingThis ? 'opacity-40 scale-95' : ''} ${
                  isDragOverThis ? '!ring-4 !ring-blue-500 !bg-blue-100/50 scale-105 shadow-xl' : ''
                }`}
              >
                {/* Visual shine gradient effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/0 via-white/30 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Control bar for Reordering */}
                {isReordering && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 z-30 flex justify-between items-center pointer-events-auto bg-slate-900/80 backdrop-blur-md rounded-xl px-1 py-0.5 text-white shadow-md">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveLinkPosition(l.id, 'prev'); }}
                      disabled={index === 0}
                      className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="Geser Kiri"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[9px] font-bold text-slate-200">Geser</span>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveLinkPosition(l.id, 'next'); }}
                      disabled={index === filteredLinks.length - 1}
                      className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="Geser Kanan"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Admin Actions or External Link Badge on Hover */}
                {!isReordering && (
                  <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {!isAdmin && (
                      <div className="w-7 h-7 rounded-lg bg-blue-900/10 text-blue-900 flex items-center justify-center">
                        <ExternalLink size={14} />
                      </div>
                    )}
                    
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(l); }} 
                          className="glass-btn !p-1.5 !rounded-lg !bg-blue-900/10 hover:!bg-blue-900 hover:!text-white !text-blue-900 transition-all cursor-pointer"
                          title="Edit Aplikasi"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            showConfirm({
                              title: 'Hapus Aplikasi',
                              message: `Apakah Anda yakin ingin menghapus "${l.title}"?`,
                              confirmText: 'Hapus',
                              cancelText: 'Batal',
                              type: 'danger',
                              onConfirm: () => {
                                onDelete(l.id);
                                showToast('Dihapus', `Aplikasi "${l.title}" telah dihapus`, 'info');
                              }
                            });
                          }} 
                          className="glass-btn !p-1.5 !rounded-lg !bg-red-500/10 hover:!bg-red-600 hover:!text-white !text-red-600 transition-all cursor-pointer"
                          title="Hapus Aplikasi"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Icon Tile (Always Visible) */}
                <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-[20px] flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-md ${nativeStyle} transition-all duration-300 ease-out group-hover:scale-105 group-hover:-translate-y-1 group-hover:shadow-lg border border-white/40 overflow-hidden ${
                  isReordering ? 'mt-3' : ''
                }`}>
                  {/* Glossy top-down glass shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none rounded-[20px]" />
                  <div className="absolute -top-5 -left-5 w-10 h-10 bg-white/35 rounded-full blur-md pointer-events-none" />

                  <span className="relative z-10 drop-shadow-md flex items-center justify-center">
                    {isEmoji ? (
                      <span className="drop-shadow-sm">{l.icon || '📱'}</span>
                    ) : (
                      <i className={`${l.icon || 'fas fa-cubes'} text-white text-xl sm:text-2xl drop-shadow-sm`} />
                    )}
                  </span>
                </div>

                {/* Title Info (Directly Visible, Smaller Font, Non-Bold, Title Case) */}
                <div className="w-full text-center mt-2.5 px-1 pointer-events-none">
                  <h4 className="font-medium text-xs sm:text-[13px] text-slate-800 m-0 tracking-wide leading-snug break-words group-hover:text-blue-900 transition-colors duration-200 capitalize">
                    {l.title}
                  </h4>
                </div>
              </a>
            );
          })
        )}
      </div>
    </>
  );
}

