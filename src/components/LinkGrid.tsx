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
  'bg-blue-50 text-blue-600 border border-blue-200/80',
  'bg-amber-50 text-amber-700 border border-amber-200/80',
  'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
  'bg-purple-50 text-purple-600 border border-purple-200/80',
  'bg-sky-50 text-sky-600 border border-sky-200/80',
  'bg-rose-50 text-rose-600 border border-rose-200/80',
  'bg-slate-100 text-slate-700 border border-slate-200/80',
  'bg-teal-50 text-teal-600 border border-teal-200/80',
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
      <div className="flex items-center mb-5 p-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs focus-within:border-slate-400 transition-colors">
        <div className="pl-3 pr-2 text-slate-400 flex items-center">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari Aplikasi atau Sistem..." 
          className="flex-1 border-none bg-transparent py-1.5 px-2 text-xs sm:text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex justify-center gap-2 mb-6 flex-wrap items-center">
        {categories.map(cat => {
          const count = (cat === 'Semua' || cat === 'All') 
            ? links.length 
            : links.filter(l => (l.category || '').toLowerCase() === cat.toLowerCase()).length;
          const isActive = category === cat || (cat === 'Semua' && category === 'All');
          return (
            <button 
              key={cat} 
              onClick={() => setCategory(cat)} 
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive 
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
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
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isReordering 
                ? 'bg-emerald-600 text-white border-emerald-700 font-bold' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Atur Urutan Tata Letak Menu"
          >
            {isReordering ? <Check size={14} /> : <Move size={14} />}
            <span>{isReordering ? 'Selesai Atur' : 'Atur Tata Letak'}</span>
          </button>
        )}

        {isAdmin && (
          <button 
            onClick={onAdd} 
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> Tambah Aplikasi
          </button>
        )}
      </div>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 m-0">
          {category === 'Semua' || category === 'All' ? 'Daftar Aplikasi' : `Aplikasi ${category}`}
        </h2>
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-[11px] text-slate-700">
          {filteredLinks.length} Item
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 pb-4">
        {loading ? (
          <div className="col-span-full text-center py-10 bg-white border border-slate-200 rounded-2xl font-bold text-slate-400 text-xs">
            Memuat Data...
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="col-span-full text-center py-10 bg-white border border-slate-200 rounded-2xl font-bold text-slate-400 text-xs">
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
                className={`p-3.5 flex flex-col items-center justify-center relative min-h-[115px] sm:min-h-[125px] transition-colors ease-out group bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs rounded-2xl no-underline text-slate-800 block ${
                  isReordering ? 'ring-2 ring-amber-400 bg-amber-50/40 cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${isDraggingThis ? 'opacity-40' : ''} ${
                  isDragOverThis ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
                }`}
              >
                {/* Control bar for Reordering */}
                {isReordering && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 z-30 flex justify-between items-center pointer-events-auto bg-slate-900 rounded-lg px-1 py-0.5 text-white text-[10px]">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveLinkPosition(l.id, 'prev'); }}
                      disabled={index === 0}
                      className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer"
                      title="Geser Kiri"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[9px] font-bold text-slate-200">Geser</span>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveLinkPosition(l.id, 'next'); }}
                      disabled={index === filteredLinks.length - 1}
                      className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer"
                      title="Geser Kanan"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}

                {/* Admin Actions or External Link Badge on Hover */}
                {!isReordering && (
                  <div className="absolute top-2 right-2 z-20 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isAdmin && (
                      <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                        <ExternalLink size={12} />
                      </div>
                    )}
                    
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(l); }} 
                          className="p-1 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                          title="Edit Aplikasi"
                        >
                          <Edit2 size={12} />
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
                          className="p-1 rounded-md bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 transition-colors cursor-pointer"
                          title="Hapus Aplikasi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Icon Tile */}
                <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0 ${nativeStyle} transition-transform ${
                  isReordering ? 'mt-2' : ''
                }`}>
                  <span className="flex items-center justify-center">
                    {isEmoji ? (
                      <span>{l.icon || '📱'}</span>
                    ) : (
                      <i className={`${l.icon || 'fas fa-cubes'} text-lg sm:text-xl`} />
                    )}
                  </span>
                </div>

                {/* Title Info */}
                <div className="w-full text-center mt-2 px-1 pointer-events-none">
                  <h4 className="font-medium text-xs text-slate-800 m-0 leading-tight break-words capitalize">
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

