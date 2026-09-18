import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  MapPin, 
  ArrowRight, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Search, 
  RefreshCw, 
  Scan, 
  ClipboardList, 
  CheckSquare, 
  Square, 
  Save, 
  Package, 
  Layers, 
  Filter,
  Check,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
  History
} from 'lucide-react';
import { InventoryItem } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../supabase';

export type LocationUpdateSourceMode = 'selected' | 'source_location' | 'scan_lpn';

interface InventoryBulkLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryList: InventoryItem[];
  selectedIds: string[];
  initialSourceLocation?: string;
  currentUser: any;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
  onUpdateSuccess: (updatedItems: InventoryItem[], newLocation: string) => Promise<void> | void;
}

export function InventoryBulkLocationModal({
  isOpen,
  onClose,
  inventoryList,
  selectedIds,
  initialSourceLocation = '',
  currentUser,
  showToast,
  onUpdateSuccess
}: InventoryBulkLocationModalProps) {
  // Source Mode: 'selected' | 'source_location' | 'scan_lpn'
  const [sourceMode, setSourceMode] = useState<LocationUpdateSourceMode>('selected');

  // Mode 2: Source Location Filter
  const [sourceLocation, setSourceLocation] = useState<string>(initialSourceLocation);
  const [isSourceLocDropdownOpen, setIsSourceLocDropdownOpen] = useState(false);
  const sourceLocRef = useRef<HTMLDivElement>(null);

  // Mode 3: Scan / Paste text input
  const [scanTextInput, setScanTextInput] = useState<string>('');

  // Target Location Settings
  const [targetLocation, setTargetLocation] = useState<string>('');
  const [targetLocationType, setTargetLocationType] = useState<string>('KEEP');
  const [targetSloc, setTargetSloc] = useState<string>('KEEP');
  const [noteUpdateMode, setNoteUpdateMode] = useState<'keep' | 'append' | 'replace'>('append');
  const [customNoteText, setCustomNoteText] = useState<string>('');

  // Checkbox selection within modal preview
  const [excludedItemIds, setExcludedItemIds] = useState<Set<string>>(new Set());
  const [previewSearch, setPreviewSearch] = useState<string>('');

  // Target Location Autocomplete Dropdown
  const [isTargetLocDropdownOpen, setIsTargetLocDropdownOpen] = useState(false);
  const targetLocRef = useRef<HTMLDivElement>(null);

  // Loading & Progress State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // List of all unique locations currently in inventory
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(inventoryList.map(i => (i.location || '').trim()).filter(Boolean))).sort((a, b) => 
      a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' })
    );
  }, [inventoryList]);

  // List of unique SLOCs
  const uniqueSlocs = useMemo(() => {
    return Array.from(new Set(inventoryList.map(i => (i.sloc || '').trim()).filter(Boolean))).sort();
  }, [inventoryList]);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSourceLocation) {
        setSourceLocation(initialSourceLocation);
        setSourceMode('source_location');
      } else if (selectedIds.length > 0) {
        setSourceMode('selected');
      } else {
        setSourceMode('source_location');
      }
      setTargetLocation('');
      setTargetLocationType('KEEP');
      setTargetSloc('KEEP');
      setNoteUpdateMode('append');
      setCustomNoteText('');
      setExcludedItemIds(new Set());
      setPreviewSearch('');
      setScanTextInput('');
    }
  }, [isOpen, selectedIds, initialSourceLocation]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceLocRef.current && !sourceLocRef.current.contains(e.target as Node)) {
        setIsSourceLocDropdownOpen(false);
      }
      if (targetLocRef.current && !targetLocRef.current.contains(e.target as Node)) {
        setIsTargetLocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute matched items depending on sourceMode
  const rawTargetItems = useMemo(() => {
    if (sourceMode === 'selected') {
      const idSet = new Set(selectedIds);
      return inventoryList.filter(i => idSet.has(i.id_inventory));
    }

    if (sourceMode === 'source_location') {
      if (!sourceLocation.trim()) return [];
      const q = sourceLocation.trim().toUpperCase();
      return inventoryList.filter(i => (i.location || '').trim().toUpperCase() === q);
    }

    if (sourceMode === 'scan_lpn') {
      if (!scanTextInput.trim()) return [];
      const tokens = scanTextInput
        .split(/[\n,;\t]+/)
        .map(t => t.trim().toUpperCase())
        .filter(Boolean);

      if (tokens.length === 0) return [];
      const tokenSet = new Set(tokens);

      return inventoryList.filter(i => {
        const id = (i.id_inventory || '').trim().toUpperCase();
        const lpn = (i.lpn_serial_number || '').trim().toUpperCase();
        const code = (i.item_code || '').trim().toUpperCase();
        const batch = (i.batch || '').trim().toUpperCase();
        return tokenSet.has(id) || tokenSet.has(lpn) || tokenSet.has(code) || tokenSet.has(batch);
      });
    }

    return [];
  }, [sourceMode, selectedIds, sourceLocation, scanTextInput, inventoryList]);

  // Final list of items to be updated (excluding any unchecked items)
  const itemsToUpdate = useMemo(() => {
    return rawTargetItems.filter(i => !excludedItemIds.has(i.id_inventory));
  }, [rawTargetItems, excludedItemIds]);

  // Filtered items for preview search
  const previewFilteredItems = useMemo(() => {
    if (!previewSearch.trim()) return rawTargetItems;
    const q = previewSearch.toLowerCase().trim();
    return rawTargetItems.filter(i => 
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.item_name || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q) ||
      (i.batch || '').toLowerCase().includes(q) ||
      (i.lpn_serial_number || '').toLowerCase().includes(q)
    );
  }, [rawTargetItems, previewSearch]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = itemsToUpdate.length;
    const totalLastQty = itemsToUpdate.reduce((sum, i) => sum + Number(i.last_qty || 0), 0);
    const totalQtyConvert = itemsToUpdate.reduce((sum, i) => sum + Number(i.qty_convert ?? i.last_qty ?? 0), 0);
    const distinctSkus = new Set(itemsToUpdate.map(i => i.item_code).filter(Boolean)).size;
    const distinctBatches = new Set(itemsToUpdate.map(i => i.batch).filter(Boolean)).size;
    const distinctSourceLocations = new Set(itemsToUpdate.map(i => i.location).filter(Boolean)).size;
    const uom = itemsToUpdate[0]?.uom || 'CTN';
    const uomConvert = itemsToUpdate[0]?.uom_convert || 'PCS';

    return {
      totalCount,
      totalLastQty,
      totalQtyConvert,
      distinctSkus,
      distinctBatches,
      distinctSourceLocations,
      uom,
      uomConvert
    };
  }, [itemsToUpdate]);

  // Target Location Auto-suggestions
  const filteredTargetSuggestions = useMemo(() => {
    if (!targetLocation.trim()) return uniqueLocations;
    const q = targetLocation.toLowerCase().trim();
    return uniqueLocations.filter(loc => loc.toLowerCase().includes(q));
  }, [targetLocation, uniqueLocations]);

  // Toggle selection inside modal
  const handleToggleItemCheck = (id: string) => {
    setExcludedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllPreview = () => {
    setExcludedItemIds(new Set());
  };

  const handleDeselectAllPreview = () => {
    setExcludedItemIds(new Set(rawTargetItems.map(i => i.id_inventory)));
  };

  // Execution: Submit Bulk Location Update
  const handleExecuteLocationUpdate = async () => {
    const cleanTarget = targetLocation.trim().toUpperCase();
    if (!cleanTarget) {
      showToast('Lokasi Belum Diisi', 'Silakan masukkan atau pilih nama lokasi tujuan baru.', 'warning');
      return;
    }

    if (itemsToUpdate.length === 0) {
      showToast('Tidak Ada Item', 'Tidak ada item terpilih yang akan diperbarui lokasinya.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress({ current: 0, total: itemsToUpdate.length });

    try {
      const nowIso = new Date().toISOString();
      const dateIdStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const userTag = currentUser?.nama || 'Admin';

      // Prepare updated item records
      const updatedItemList: InventoryItem[] = itemsToUpdate.map(item => {
        let finalNote = item.note || '';
        if (noteUpdateMode === 'replace') {
          finalNote = customNoteText.trim() || `Relokasi ke ${cleanTarget} (${dateIdStr} oleh ${userTag})`;
        } else if (noteUpdateMode === 'append') {
          const appendMsg = customNoteText.trim() 
            ? customNoteText.trim() 
            : `Relokasi ke ${cleanTarget} (${dateIdStr} oleh ${userTag})`;
          finalNote = finalNote ? `${finalNote}; ${appendMsg}` : appendMsg;
        }

        return {
          ...item,
          location: cleanTarget,
          location_type: targetLocationType !== 'KEEP' ? targetLocationType : item.location_type || 'Rack',
          sloc: targetSloc !== 'KEEP' ? targetSloc : item.sloc || 'SL01',
          note: finalNote,
          updated_at: nowIso
        };
      });

      // Update Supabase in chunks of 50 to prevent query limits
      if (isSupabaseConfigured) {
        const chunkSize = 50;
        const totalItems = updatedItemList.length;
        
        for (let i = 0; i < totalItems; i += chunkSize) {
          const chunk = updatedItemList.slice(i, i + chunkSize);
          const chunkIds = chunk.map(c => c.id_inventory);

          // We can update records in Supabase
          // If all fields in chunk share the exact same values, a single .update().in() is extremely fast
          // Since targetLocation, location_type, sloc are identical:
          const updatePayload: Record<string, any> = {
            location: cleanTarget,
            updated_at: nowIso
          };
          if (targetLocationType !== 'KEEP') {
            updatePayload.location_type = targetLocationType;
          }
          if (targetSloc !== 'KEEP') {
            updatePayload.sloc = targetSloc;
          }

          // If notes are individual, we can either do per-item or uniform note
          if (noteUpdateMode !== 'keep') {
            // If every item in chunk gets its note updated:
            // For best performance and reliability:
            for (const singleItem of chunk) {
              const { error } = await supabase
                .from('data_inventory')
                .update({
                  location: cleanTarget,
                  location_type: singleItem.location_type,
                  sloc: singleItem.sloc,
                  note: singleItem.note,
                  updated_at: nowIso
                })
                .eq('id_inventory', singleItem.id_inventory);
              if (error) throw error;
            }
          } else {
            // Uniform batch update
            const { error } = await supabase
              .from('data_inventory')
              .update(updatePayload)
              .in('id_inventory', chunkIds);

            if (error) throw error;
          }

          setSubmitProgress({ current: Math.min(i + chunkSize, totalItems), total: totalItems });
        }
      }

      // Notify parent to update state and localStorage
      await onUpdateSuccess(updatedItemList, cleanTarget);

      showToast(
        'Update Lokasi Berhasil',
        `${updatedItemList.length} item berhasil dipindahkan ke lokasi "${cleanTarget}".`,
        'success'
      );

      onClose();
    } catch (err: any) {
      console.error('Error updating bulk location:', err);
      showToast('Gagal Update Lokasi', err.message || 'Terjadi kesalahan sistem saat menyimpan ke database.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-indigo-300 shadow-inner">
              <MapPin size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white m-0">
                  Update Massal Lokasi Inventory
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Bulk Relocation
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 m-0 font-medium">
                Pindahkan stok barang ke rak atau lokasi baru di gudang secara serentak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 disabled:opacity-50"
            title="Tutup dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-slate-800 text-xs">
          
          {/* 1. Sumber Data / Mode Tab */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Filter size={13} className="text-indigo-600" />
                <span>1. Tentukan Barang yang Akan Dipindahkan</span>
              </label>
              <span className="text-[11px] font-bold text-slate-400">
                Total Ditemukan: <strong className="text-indigo-950 font-black">{rawTargetItems.length}</strong> baris
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Tab Mode 1: Selected from Table */}
              <button
                type="button"
                onClick={() => setSourceMode('selected')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  sourceMode === 'selected'
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-black text-xs ${sourceMode === 'selected' ? 'text-indigo-950' : 'text-slate-800'}`}>
                    Baris Terpilih di Tabel
                  </span>
                  {sourceMode === 'selected' ? (
                    <CheckCircle2 size={15} className="text-indigo-600" />
                  ) : (
                    <CheckSquare size={14} className="text-slate-400" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] text-slate-500 m-0">Dari centang checkbox tabel</p>
                  <span className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded ${
                    selectedIds.length > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedIds.length} item
                  </span>
                </div>
              </button>

              {/* Tab Mode 2: Source Location (Relokasi Antar Rak) */}
              <button
                type="button"
                onClick={() => setSourceMode('source_location')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  sourceMode === 'source_location'
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-black text-xs ${sourceMode === 'source_location' ? 'text-indigo-950' : 'text-slate-800'}`}>
                    Pindah Antar Rak / Lokasi
                  </span>
                  {sourceMode === 'source_location' ? (
                    <CheckCircle2 size={15} className="text-indigo-600" />
                  ) : (
                    <MapPin size={14} className="text-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 m-0">Kosongkan/pindah rak asal ke rak baru</p>
              </button>

              {/* Tab Mode 3: Scan / Paste LPN */}
              <button
                type="button"
                onClick={() => setSourceMode('scan_lpn')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  sourceMode === 'scan_lpn'
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-black text-xs ${sourceMode === 'scan_lpn' ? 'text-indigo-950' : 'text-slate-800'}`}>
                    Scan / Tempel Barcode LPN
                  </span>
                  {sourceMode === 'scan_lpn' ? (
                    <CheckCircle2 size={15} className="text-indigo-600" />
                  ) : (
                    <Scan size={14} className="text-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 m-0">Input banyak LPN / SN sekaligus</p>
              </button>
            </div>

            {/* Sub-inputs depending on mode */}
            {sourceMode === 'source_location' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-fade-in">
                <label className="block text-[11px] font-bold text-slate-700">
                  Pilih Lokasi Rak Asal (Sumber yang ingin dipindahkan):
                </label>
                <div className="relative" ref={sourceLocRef}>
                  <div className="relative flex items-center">
                    <MapPin size={14} className="absolute left-3 text-indigo-600" />
                    <input
                      type="text"
                      value={sourceLocation}
                      onChange={(e) => {
                        setSourceLocation(e.target.value);
                        setIsSourceLocDropdownOpen(true);
                      }}
                      onFocus={() => setIsSourceLocDropdownOpen(true)}
                      placeholder="Ketik atau pilih lokasi asal (contoh: WH-INV-01, RACK-A-01)..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                    {sourceLocation && (
                      <button
                        type="button"
                        onClick={() => setSourceLocation('')}
                        className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions */}
                  {isSourceLocDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-30 w-full max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                        <span>Lokasi Terdaftar di Gudang ({uniqueLocations.length})</span>
                        <span className="text-indigo-600 font-normal">Klik untuk memilih</span>
                      </div>
                      {uniqueLocations
                        .filter(loc => !sourceLocation || loc.toLowerCase().includes(sourceLocation.toLowerCase().trim()))
                        .map(loc => {
                          const countInLoc = inventoryList.filter(i => (i.location || '').trim().toUpperCase() === loc.toUpperCase()).length;
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => {
                                setSourceLocation(loc);
                                setIsSourceLocDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-indigo-50 cursor-pointer font-mono ${
                                sourceLocation.toUpperCase() === loc.toUpperCase() ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-indigo-500 shrink-0" />
                                {loc}
                              </span>
                              <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {countInLoc} item stok
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {sourceLocation && rawTargetItems.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium m-0 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Tidak ada stok barang yang saat ini tercatat di lokasi "{sourceLocation}".
                  </p>
                )}
              </div>
            )}

            {sourceMode === 'scan_lpn' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tempel / Scan Daftar LPN, Serial Number, atau ID Inventory:
                  </label>
                  <span className="text-[10px] text-slate-400">Pisahkan dengan Enter atau Koma</span>
                </div>
                <textarea
                  rows={3}
                  value={scanTextInput}
                  onChange={(e) => setScanTextInput(e.target.value)}
                  placeholder={`Contoh:\nLPN-2026-001\nLPN-2026-002\nINV-20260917-0001`}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>
            )}

            {sourceMode === 'selected' && selectedIds.length === 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-amber-600" />
                <span>
                  Belum ada baris yang dicentang di tabel. Silakan centang baris di tabel terlebih dahulu, atau pilih tab <strong>Pindah Antar Rak / Lokasi</strong> di atas.
                </span>
              </div>
            )}
          </div>

          {/* 2. Lokasi Tujuan Baru & Atribut Relokasi */}
          <div className="space-y-3 p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-700" />
                <span>2. Atur Lokasi Tujuan & Parameter Baru</span>
              </label>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                Target Mutasi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lokasi Baru (Wajib) */}
              <div className="sm:col-span-1 space-y-1" ref={targetLocRef}>
                <label className="block text-[11px] font-bold text-slate-700">
                  Lokasi Tujuan Baru <span className="text-rose-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={targetLocation}
                    onChange={(e) => {
                      setTargetLocation(e.target.value.toUpperCase());
                      setIsTargetLocDropdownOpen(true);
                    }}
                    onFocus={() => setIsTargetLocDropdownOpen(true)}
                    placeholder="misal: WH-B-02, RACK-03..."
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-indigo-300 bg-white text-xs font-mono font-black text-indigo-950 focus:ring-2 focus:ring-indigo-600 focus:outline-none shadow-2xs uppercase"
                  />
                  {targetLocation ? (
                    <button
                      type="button"
                      onClick={() => setTargetLocation('')}
                      className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsTargetLocDropdownOpen(prev => !prev)}
                      className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown size={12} />
                    </button>
                  )}
                </div>

                {/* Quick Prefix Shortcut Tags */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[9px] font-bold text-slate-400">Prefix:</span>
                  {['WH-', 'RACK-', 'FLOOR-', 'STAGE-'].map(pfx => (
                    <button
                      key={pfx}
                      type="button"
                      onClick={() => setTargetLocation(prev => prev.startsWith(pfx) ? prev : `${pfx}${prev}`)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer shadow-2xs"
                    >
                      +{pfx}
                    </button>
                  ))}
                </div>

                {/* Target Dropdown Suggestions */}
                {isTargetLocDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 w-64 max-h-44 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Pilih dari Lokasi Tersedia:
                    </div>
                    {filteredTargetSuggestions.slice(0, 20).map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setTargetLocation(loc);
                          setIsTargetLocDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-indigo-50 cursor-pointer font-mono ${
                          targetLocation === loc ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'
                        }`}
                      >
                        <span>{loc}</span>
                        {targetLocation === loc && <Check size={12} className="text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Jenis Lokasi (Location Type) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Jenis Lokasi (Location Type)
                </label>
                <select
                  value={targetLocationType}
                  onChange={(e) => setTargetLocationType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="KEEP">-- Biarkan Sama (Tidak Berubah) --</option>
                  <option value="Rack">Rack (Rak Susun)</option>
                  <option value="Floor">Floor (Lantai Gudang)</option>
                  <option value="Bulk">Bulk (Area Pallet Massal)</option>
                  <option value="Staging">Staging (Area Penyiapan)</option>
                  <option value="Quarantine">Quarantine (Karantina)</option>
                  <option value="Return">Return (Barang Kembali)</option>
                </select>
                <span className="text-[10px] text-slate-400 block">
                  {targetLocationType === 'KEEP' ? 'Mempertahankan jenis tiap item asal' : `Ubah menjadi ${targetLocationType}`}
                </span>
              </div>

              {/* Storage Location (SLOC) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Storage Location (SLOC)
                </label>
                <select
                  value={targetSloc}
                  onChange={(e) => setTargetSloc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="KEEP">-- Biarkan Sama (Tidak Berubah) --</option>
                  {uniqueSlocs.map(sl => (
                    <option key={sl} value={sl}>{sl}</option>
                  ))}
                  <option value="SL01">SL01 (Utama)</option>
                  <option value="SL02">SL02 (Penyiapan)</option>
                  <option value="SL03">SL03 (Reco)</option>
                  <option value="SL04">SL04 (Promo/Repack)</option>
                  <option value="SL99">SL99 (Pemusnahan)</option>
                </select>
                <span className="text-[10px] text-slate-400 block">
                  {targetSloc === 'KEEP' ? 'Mempertahankan SLOC asal' : `Ubah ke ${targetSloc}`}
                </span>
              </div>
            </div>

            {/* Opsi Update Catatan / Note */}
            <div className="pt-2 border-t border-indigo-100 space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Riwayat / Catatan Mutasi (Note):
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="note_mode"
                    checked={noteUpdateMode === 'append'}
                    onChange={() => setNoteUpdateMode('append')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Tambahkan riwayat ke catatan lama (Rekomendasi)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="note_mode"
                    checked={noteUpdateMode === 'keep'}
                    onChange={() => setNoteUpdateMode('keep')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Biarkan catatan asli (Jangan ubah)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="note_mode"
                    checked={noteUpdateMode === 'replace'}
                    onChange={() => setNoteUpdateMode('replace')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ganti catatan sepenuhnya</span>
                </label>
              </div>

              {noteUpdateMode !== 'keep' && (
                <input
                  type="text"
                  value={customNoteText}
                  onChange={(e) => setCustomNoteText(e.target.value)}
                  placeholder={`Catatan kustom (kosongkan untuk otomatis: "Relokasi ke ${targetLocation || '[Lokasi]'} tgl ...")`}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* 3. Preview & Review List */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Boxes size={13} className="text-indigo-600" />
                  <span>3. Verifikasi Item yang Akan Diperbarui</span>
                </label>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                  {itemsToUpdate.length} item aktif
                </span>
              </div>

              {/* Quick Actions & Search */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Filter pratinjau..."
                    className="w-36 sm:w-48 pl-7 pr-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllPreview}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllPreview}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                >
                  Lepas Semua
                </button>
              </div>
            </div>

            {/* Metrics Summary Strip */}
            {summaryMetrics.totalCount > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Package size={13} className="text-indigo-600" />
                    <span>Total Baris: <strong className="font-mono text-indigo-950 font-black">{summaryMetrics.totalCount}</strong></span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-slate-700">
                    Total Last Qty: <strong className="font-mono text-teal-800 font-black">{summaryMetrics.totalLastQty.toLocaleString('id-ID')} {summaryMetrics.uom}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-slate-700">
                    Total Qty Convert: <strong className="font-mono text-emerald-800 font-black">{summaryMetrics.totalQtyConvert.toLocaleString('id-ID')} {summaryMetrics.uomConvert}</strong>
                  </span>
                  <span className="text-slate-300 hidden sm:inline">|</span>
                  <span className="text-slate-500 font-medium hidden sm:inline">
                    {summaryMetrics.distinctSkus} SKU • {summaryMetrics.distinctBatches} Batch • {summaryMetrics.distinctSourceLocations} Lokasi Asal
                  </span>
                </div>

                {targetLocation && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-700 text-white font-mono font-black text-xs shadow-2xs">
                    <span>Tujuan:</span>
                    <span>{targetLocation}</span>
                  </div>
                )}
              </div>
            )}

            {/* Table Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 z-10">
                  <tr>
                    <th className="p-2 w-8 text-center">
                      <CheckSquare size={13} className="text-indigo-600 mx-auto" />
                    </th>
                    <th className="p-2">Item Code & Name</th>
                    <th className="p-2">Batch / ED</th>
                    <th className="p-2">Lokasi Asal</th>
                    <th className="p-2 text-center w-8"></th>
                    <th className="p-2">Lokasi Baru</th>
                    <th className="p-2 text-right">Last Qty</th>
                    <th className="p-2 text-right">Convert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                        {rawTargetItems.length === 0 
                          ? 'Belum ada item yang cocok dengan kriteria sumber di atas.'
                          : 'Tidak ada item yang cocok dengan pencarian filter.'}
                      </td>
                    </tr>
                  ) : (
                    previewFilteredItems.map((item, idx) => {
                      const isExcluded = excludedItemIds.has(item.id_inventory);
                      return (
                        <tr 
                          key={item.id_inventory || idx}
                          onClick={() => handleToggleItemCheck(item.id_inventory)}
                          className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                            isExcluded ? 'opacity-40 bg-slate-50' : ''
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => handleToggleItemCheck(item.id_inventory)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2">
                            <div className="font-mono font-black text-indigo-950 text-[11px]">{item.item_code}</div>
                            <div className="text-slate-600 truncate max-w-xs">{item.item_name}</div>
                          </td>
                          <td className="p-2 font-mono text-[11px]">
                            <div>{item.batch || '-'}</div>
                            <div className="text-[10px] text-slate-400">{item.expired_date || '-'}</div>
                          </td>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] border border-slate-200">
                              <MapPin size={10} className="text-slate-500" />
                              {item.location || '-'}
                            </span>
                          </td>
                          <td className="p-2 text-center text-slate-400">
                            <ArrowRight size={12} className="text-indigo-600 mx-auto" />
                          </td>
                          <td className="p-2">
                            <span className={`inline-flex items-center gap-1 font-mono font-black px-2 py-0.5 rounded text-[10px] ${
                              targetLocation 
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse' 
                                : 'bg-slate-100 text-slate-400 italic'
                            }`}>
                              <MapPin size={10} className={targetLocation ? 'text-indigo-600' : 'text-slate-400'} />
                              {targetLocation || 'Belum diisi'}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-800">
                            {Number(item.last_qty || 0).toLocaleString('id-ID')} {item.uom || 'CTN'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-700">
                            {Number(item.qty_convert ?? item.last_qty ?? 0).toLocaleString('id-ID')} {item.uom_convert || 'PCS'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="text-slate-500 text-xs">
            {isSubmitting ? (
              <span className="flex items-center gap-2 font-bold text-indigo-700">
                <RefreshCw size={14} className="animate-spin" />
                <span>Menyimpan: {submitProgress.current} dari {submitProgress.total} item...</span>
              </span>
            ) : (
              <span>
                Akan memindahkan <strong>{itemsToUpdate.length}</strong> baris ke <strong>{targetLocation || '-'}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteLocationUpdate}
              disabled={isSubmitting || itemsToUpdate.length === 0 || !targetLocation.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white font-black text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Memproses Relokasi...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Terapkan Relokasi ({itemsToUpdate.length} Item)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
