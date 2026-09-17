import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  Filter, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckSquare, 
  Square, 
  CheckCheck, 
  Layers, 
  Boxes, 
  Database, 
  Share2, 
  Printer, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  FileSpreadsheet, 
  Send,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  Scan,
  QrCode
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, DataBarang } from '../../types';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { InventoryFormModal } from './inventory/InventoryFormModal';
import { InventoryDetailModal } from './inventory/InventoryDetailModal';
import { InventoryExcelModal } from './inventory/InventoryExcelModal';
import { 
  InventoryBulkTransferModal, 
  TransferDestination 
} from './inventory/InventoryBulkTransferModal';
import { InventoryScannerModal } from './inventory/InventoryScannerModal';
import { normalizeToIsoDate } from '../../utils/logisticsCalculations';

const INVENTORY_CACHE_KEY = 'ckb_inventory_data_cache_v1';
const INVENTORY_VIEW_MODE_KEY = 'ckb_inventory_view_mode_v1';

interface InventoryModuleProps {
  onNavigateToPenyiapan?: () => void;
  onNavigateToPemusnahan?: () => void;
  onNavigateToReco?: () => void;
}

export function InventoryModule({
  onNavigateToPenyiapan,
  onNavigateToPemusnahan,
  onNavigateToReco
}: InventoryModuleProps) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

  // Mode View: 'stock_opname' vs 'standard'
  const [viewMode, setViewMode] = useState<'stock_opname' | 'standard'>(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_VIEW_MODE_KEY);
      if (saved === 'standard' || saved === 'stock_opname') return saved;
    } catch {}
    return 'stock_opname';
  });

  const handleToggleViewMode = (mode: 'stock_opname' | 'standard') => {
    setViewMode(mode);
    try {
      localStorage.setItem(INVENTORY_VIEW_MODE_KEY, mode);
    } catch {}
  };

  // Primary Data State
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(() => {
    try {
      const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [barangList, setBarangList] = useState<DataBarang[]>(() => {
    try {
      const cached = localStorage.getItem('ckb_master_data_barang_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Scanner Modal State for Floor SN / LPN
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Inline Note Edit State in table
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');

  // Sorting - Standar tampilan tabel urut sesuai location (A-Z)
  const [sortField, setSortField] = useState<keyof InventoryItem>('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Multi-Selection State for Bulk Transfer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Column Visibility: Hide / Unhide Kolom Location
  const [showLocationColumn, setShowLocationColumn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ckb_inventory_show_location_col');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const handleToggleLocationColumn = () => {
    setShowLocationColumn(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ckb_inventory_show_location_col', String(next));
      } catch {}
      return next;
    });
  };

  // 1. Load Data from Supabase with LocalStorage fallback (support pagination for full records)
  const fetchInventoryData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Server cloud belum terkonfigurasi. Menggunakan cache lokal.');
      }

      // Fetch master barang if empty
      if (barangList.length === 0) {
        const { data: bData } = await supabase.from('data_barang').select('*').limit(2000);
        if (bData && Array.isArray(bData)) {
          setBarangList(bData);
          localStorage.setItem('ckb_master_data_barang_cache', JSON.stringify(bData));
        }
      }

      let allData: InventoryItem[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('data_inventory')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) throw error;
        if (pageData && Array.isArray(pageData)) {
          allData = [...allData, ...pageData];
          if (pageData.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setInventoryList(allData);
      localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(allData));
      setLastSupabaseError(null);
      if (isManualRefresh) {
        showToast('Sinkronisasi Sukses', `Berhasil memuat ${allData.length} baris data inventory terbaru.`, 'success');
      }
    } catch (err: any) {
      console.warn('Inventory fetch warning:', err);
      setLastSupabaseError(err.message || 'Gagal tersambung ke cloud database');
      if (isManualRefresh) {
        showToast('Sinkronisasi Offline', err.message || 'Menggunakan data cache offline.', 'warning');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();

    // Supabase Realtime Listener
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('inventory_realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'data_inventory' },
          (payload) => {
            console.log('Realtime inventory update:', payload);
            if (payload.eventType === 'INSERT') {
              setInventoryList(prev => {
                const updated = [payload.new as InventoryItem, ...prev.filter(i => i.id_inventory !== (payload.new as any).id_inventory)];
                localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
                return updated;
              });
            } else if (payload.eventType === 'UPDATE') {
              setInventoryList(prev => {
                const updated = prev.map(i => i.id_inventory === (payload.new as any).id_inventory ? (payload.new as InventoryItem) : i);
                localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
                return updated;
              });
            } else if (payload.eventType === 'DELETE') {
              setInventoryList(prev => {
                const updated = prev.filter(i => i.id_inventory !== (payload.old as any).id_inventory);
                localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
                return updated;
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Save or Update Single Item
  const handleSaveItem = async (item: InventoryItem) => {
    const isExisting = inventoryList.some(i => i.id_inventory === item.id_inventory);
    const cleanItem: InventoryItem = {
      ...item,
      expired_date: normalizeToIsoDate(item.expired_date) || null as any,
      first_qty: Number(item.first_qty) || 0,
      last_qty: Number(item.last_qty) || 0,
      qty_convert: Number(item.qty_convert) || 0,
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('data_inventory')
        .upsert(cleanItem, { onConflict: 'id_inventory' });
      if (error) throw error;
    }

    setInventoryList(prev => {
      let updated: InventoryItem[];
      if (isExisting) {
        updated = prev.map(i => i.id_inventory === cleanItem.id_inventory ? cleanItem : i);
      } else {
        updated = [cleanItem, ...prev];
      }
      localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
      return updated;
    });

    showToast('Data Tersimpan', `Data inventory ${cleanItem.id_inventory} berhasil disimpan.`, 'success');
  };

  // Bulk Import Excel (High-Speed Turbo Batching: 500 rows/batch with concurrency)
  const handleImportExcelSuccess = async (
    newRows: InventoryItem[],
    onProgress?: (processed: number, total: number, speed: number) => void
  ) => {
    const startTime = performance.now();
    const sanitizedRows: InventoryItem[] = newRows.map(row => ({
      ...row,
      expired_date: normalizeToIsoDate(row.expired_date) || null as any,
      first_qty: Number(row.first_qty) || 0,
      last_qty: Number(row.last_qty) || 0,
      qty_convert: Number(row.qty_convert) || 0,
      updated_at: new Date().toISOString()
    }));

    if (isSupabaseConfigured) {
      // Chunk inserts/upserts in high-performance batches of 500 with concurrency 2
      const chunkSize = 500;
      const totalRows = sanitizedRows.length;
      const chunks: InventoryItem[][] = [];
      for (let i = 0; i < totalRows; i += chunkSize) {
        chunks.push(sanitizedRows.slice(i, i + chunkSize));
      }

      let processedCount = 0;
      const concurrency = 2;

      for (let i = 0; i < chunks.length; i += concurrency) {
        const currentBatch = chunks.slice(i, i + concurrency);
        const results = await Promise.all(
          currentBatch.map(async (chunk) => {
            const { error } = await supabase
              .from('data_inventory')
              .upsert(chunk, { onConflict: 'id_inventory' });
            return { chunkLength: chunk.length, error };
          })
        );

        for (const res of results) {
          if (res.error) {
            console.error('Supabase upsert chunk error:', res.error);
            throw res.error;
          }
          processedCount += res.chunkLength;
        }

        const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
        const currentSpeed = Math.round(processedCount / elapsedSec);

        if (onProgress) {
          onProgress(processedCount, totalRows, currentSpeed);
        }
      }
    }

    setInventoryList(prev => {
      const rowMap = new Map(sanitizedRows.map(r => [r.id_inventory, r]));
      const remainingPrev = prev.filter(r => !rowMap.has(r.id_inventory));
      const updated = [...sanitizedRows, ...remainingPrev];
      localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
      return updated;
    });

    const totalSeconds = ((performance.now() - startTime) / 1000).toFixed(1);
    showToast('Upload Sukses', `Berhasil menyimpan ${sanitizedRows.length.toLocaleString('id-ID')} baris data ke tabel Inventory dalam ${totalSeconds} detik.`, 'success');
    fetchInventoryData(false);
  };

  // Delete Single Item
  const handleDeleteItem = async (id: string, itemName: string) => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Hanya Admin yang memiliki hak akses untuk menghapus data inventory!', 'error');
      return;
    }

    const confirmed = await showConfirm(
      'Hapus Data Inventory',
      `Yakin ingin menghapus item "${itemName}" (${id}) dari database inventory?`
    );
    if (!confirmed) return;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('data_inventory')
          .delete()
          .eq('id_inventory', id);
        if (error) throw error;
      }

      setInventoryList(prev => {
        const updated = prev.filter(i => i.id_inventory !== id);
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });

      setSelectedIds(prev => prev.filter(sid => sid !== id));
      showToast('Data Terhapus', `Data inventory ${id} berhasil dihapus.`, 'info');
    } catch (err: any) {
      console.error('Delete item error:', err);
      showToast('Gagal Hapus', err.message || 'Terjadi kesalahan saat menghapus data.', 'error');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Hanya Admin yang memiliki hak akses untuk hapus massal!', 'error');
      return;
    }

    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const confirmed = await showConfirm(
      'Hapus Data Massal',
      `Apakah Anda yakin ingin menghapus ${count} baris data inventory yang dipilih secara permanen?`
    );
    if (!confirmed) return;

    try {
      if (isSupabaseConfigured) {
        // Chunk deletes in batches of 100
        const chunkSize = 100;
        for (let i = 0; i < selectedIds.length; i += chunkSize) {
          const chunk = selectedIds.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('data_inventory')
            .delete()
            .in('id_inventory', chunk);
          if (error) throw error;
        }
      }

      const idSet = new Set(selectedIds);
      setInventoryList(prev => {
        const updated = prev.filter(i => !idSet.has(i.id_inventory));
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });

      setSelectedIds([]);
      showToast('Hapus Massal Selesai', `Berhasil menghapus ${count} baris data inventory.`, 'success');
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      showToast('Gagal Hapus Massal', err.message || 'Terjadi kesalahan sistem saat hapus massal.', 'error');
    }
  };

  // Single Item Status Update (Optimistic UI + Supabase Sync)
  const handleUpdateStatus = async (item: InventoryItem, newStatus: string) => {
    const oldStatus = item.status || '';
    if (oldStatus === newStatus) return;

    const targetIds = item.child_ids && item.child_ids.length > 0 ? item.child_ids : [item.id_inventory];
    const nowIso = new Date().toISOString();

    // 1. Optimistic Local State Update
    setInventoryList(prev => {
      const updated = prev.map(p => targetIds.includes(p.id_inventory) ? { ...p, status: newStatus, updated_at: nowIso } : p);
      try {
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Cloud Supabase Sync
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_inventory')
          .update({ status: newStatus, updated_at: nowIso })
          .in('id_inventory', targetIds);

        if (error) throw error;
        // Silent on success to keep workflow fast and distraction-free
      } catch (err: any) {
        console.error('Failed to update inventory status:', err);
        showToast('Gagal Simpan Status', err.message || 'Terjadi kesalahan saat mengupdate status di database.', 'error');
        // Rollback state on error
        setInventoryList(prev => {
          const reverted = prev.map(p => targetIds.includes(p.id_inventory) ? { ...p, status: oldStatus } : p);
          try {
            localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(reverted));
          } catch {}
          return reverted;
        });
      }
    }
  };

  // Single Item Note Update (Optimistic UI + Supabase Sync)
  const handleUpdateNote = async (item: InventoryItem, newNote: string) => {
    const oldNote = item.note || '';
    const cleanNote = newNote.trim();
    if (oldNote === cleanNote) {
      setEditingNoteId(null);
      return;
    }

    const targetIds = item.child_ids && item.child_ids.length > 0 ? item.child_ids : [item.id_inventory];
    const nowIso = new Date().toISOString();

    setInventoryList(prev => {
      const updated = prev.map(p => targetIds.includes(p.id_inventory) ? { ...p, note: cleanNote, updated_at: nowIso } : p);
      try {
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setEditingNoteId(null);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_inventory')
          .update({ note: cleanNote, updated_at: nowIso })
          .in('id_inventory', targetIds);

        if (error) throw error;
        showToast('Catatan Disimpan', `Catatan untuk ${item.item_name} berhasil diperbarui.`, 'success');
      } catch (err: any) {
        console.error('Failed to update inventory note:', err);
        showToast('Gagal Simpan Catatan', err.message || 'Terjadi kesalahan sistem.', 'error');
        setInventoryList(prev => {
          const reverted = prev.map(p => targetIds.includes(p.id_inventory) ? { ...p, note: oldNote } : p);
          try {
            localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(reverted));
          } catch {}
          return reverted;
        });
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      showToast('Data Kosong', 'Tidak ada data yang sesuai untuk diekspor.', 'warning');
      return;
    }

    if (viewMode === 'stock_opname') {
      const exportRows = filteredData.map((item, idx) => ({
        'No': idx + 1,
        'Status': item.status || '-',
        'Location': item.location || '-',
        'Item Code': item.item_code || '-',
        'Item Name': item.item_name || '-',
        'Last Qty (SUMIFS)': item.last_qty ?? 0,
        'UOM': item.uom || 'CTN',
        'Qty Convert (SUMIFS)': item.qty_convert ?? 0,
        'UOM Convert': item.uom_convert || 'PCS',
        'Batch': item.batch || '-',
        'Expired Date': item.expired_date || '-',
        'Jumlah Batch Tergabung': item.child_count || 1,
        'Note': item.note || '-',
        'SLOC': item.sloc || 'SL01',
        'ID Inventory': item.id_inventory
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 6 },  // No
        { wch: 12 }, // Status
        { wch: 16 }, // Location
        { wch: 16 }, // Item Code
        { wch: 36 }, // Item Name
        { wch: 18 }, // Last Qty (SUMIFS)
        { wch: 10 }, // UOM
        { wch: 20 }, // Qty Convert (SUMIFS)
        { wch: 14 }, // UOM Convert
        { wch: 20 }, // Batch
        { wch: 16 }, // Expired Date
        { wch: 22 }, // Jumlah Batch Tergabung
        { wch: 28 }, // Note
        { wch: 10 }, // SLOC
        { wch: 22 }  // ID Inventory
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock_Opname_Inventory');
      const fileName = `Stock_Opname_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Ekspor Berhasil', `Laporan Stock Opname (SUMIFS) berhasil diunduh (${filteredData.length} baris).`, 'success');
      return;
    }

    const exportRows = filteredData.map((item, idx) => ({
      'No': idx + 1,
      'ID Inventory': item.id_inventory,
      'Status': item.status || 'Ada',
      'Item Code': item.item_code,
      'Item Name': item.item_name,
      'Category': item.category || 'Finished Good',
      'Location': item.location,
      'Location Type': item.location_type || 'Rack',
      'First Qty': item.first_qty ?? item.last_qty,
      'Last Qty': item.last_qty,
      'UOM': item.uom,
      'Qty Convert': item.qty_convert,
      'UOM Convert': item.uom_convert || 'PCS',
      'LPN/Serial Number': item.lpn_serial_number || '',
      'Batch': item.batch || '',
      'Vendor Batch': item.vendor_batch || '',
      'SLOC': item.sloc || 'SL01',
      'Expired Date': item.expired_date || '',
      'Destination Code': item.destination_code || 'DST-INV',
      'QC Code': item.qc_code || 'QC-PASS',
      'User Tally': item.user_tally || '',
      'Shelf Life': item.shelf_life || '',
      'Source': item.source || '',
      'User Input': item.user_input || '',
      'Note': item.note || '',
      'Tujuan': item.tujuan || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 32 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
      { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
      { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Inventory');
    const fileName = `Laporan_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Ekspor Berhasil', `Laporan berhasil diekspor (${filteredData.length} baris).`, 'success');
  };

  // Stock Opname SUMIFS Aggregation: Group by (location + item_code / item_name) and sum QTYs
  const stockOpnameAggregatedData = useMemo<InventoryItem[]>(() => {
    const groupMap = new Map<string, {
      location: string;
      item_code: string;
      item_name: string;
      category?: string;
      location_type?: string;
      sloc?: string;
      uom: string;
      uom_convert: string;
      first_qty: number;
      last_qty: number;
      qty_convert: number;
      statuses: string[];
      notes: string[];
      batches: string[];
      expiredDates: string[];
      child_ids: string[];
      primaryId: string;
      tujuan?: string;
    }>();

    inventoryList.forEach(item => {
      const loc = (item.location || '').trim();
      const code = (item.item_code || '').trim();
      const name = (item.item_name || '').trim();
      const groupKey = `${loc.toUpperCase()}||${code.toUpperCase() || name.toUpperCase()}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          location: loc || '-',
          item_code: code || item.item_code,
          item_name: name || item.item_name,
          category: item.category,
          location_type: item.location_type,
          sloc: item.sloc,
          uom: item.uom || 'CTN',
          uom_convert: item.uom_convert || 'PCS',
          first_qty: 0,
          last_qty: 0,
          qty_convert: 0,
          statuses: [],
          notes: [],
          batches: [],
          expiredDates: [],
          child_ids: [],
          primaryId: item.id_inventory,
          tujuan: item.tujuan
        });
      }

      const g = groupMap.get(groupKey)!;
      g.first_qty += Number(item.first_qty || item.last_qty || 0);
      g.last_qty += Number(item.last_qty || 0);
      g.qty_convert += Number(item.qty_convert || item.last_qty || 0);
      g.child_ids.push(item.id_inventory);

      if (item.status && item.status.trim()) {
        g.statuses.push(item.status.trim());
      }
      if (item.note && item.note.trim() && !g.notes.includes(item.note.trim())) {
        g.notes.push(item.note.trim());
      }
      if (item.batch && item.batch.trim() && !g.batches.includes(item.batch.trim())) {
        g.batches.push(item.batch.trim());
      }
      if (item.expired_date && item.expired_date.trim() && !g.expiredDates.includes(item.expired_date.trim())) {
        g.expiredDates.push(item.expired_date.trim());
      }
    });

    return Array.from(groupMap.values()).map(g => {
      let resolvedStatus = '';
      if (g.statuses.length > 0) {
        const uniqueStatuses = Array.from(new Set(g.statuses));
        resolvedStatus = uniqueStatuses.length === 1 && g.statuses.length === g.child_ids.length ? uniqueStatuses[0] : g.statuses[0];
      }

      return {
        id_inventory: g.primaryId,
        item_code: g.item_code,
        item_name: g.item_name,
        category: g.category,
        location: g.location,
        location_type: g.location_type,
        sloc: g.sloc || 'SL01',
        first_qty: g.first_qty,
        last_qty: g.last_qty,
        qty_convert: g.qty_convert,
        uom: g.uom,
        uom_convert: g.uom_convert,
        status: resolvedStatus,
        note: g.notes.join('; '),
        batch: g.batches.join(', '),
        expired_date: g.expiredDates.join(', '),
        tujuan: g.tujuan,
        child_ids: g.child_ids,
        child_count: g.child_ids.length
      };
    });
  }, [inventoryList]);

  // Base Data depending on Mode (Opname = SUMIFS aggregated, Standard = raw per batch/serial)
  const baseDataList = useMemo(() => {
    return viewMode === 'stock_opname' ? stockOpnameAggregatedData : inventoryList;
  }, [viewMode, stockOpnameAggregatedData, inventoryList]);

  // Child items untuk modal detail (menampilkan semua batch & qty jika terdapat lebih dari 1 batch)
  const detailChildItems = useMemo(() => {
    if (!detailItem) return [];
    if (detailItem.child_ids && detailItem.child_ids.length > 0) {
      const set = new Set(detailItem.child_ids);
      return inventoryList.filter(i => set.has(i.id_inventory));
    }
    if (detailItem.location && (detailItem.item_code || detailItem.item_name)) {
      const matches = inventoryList.filter(i => 
        (i.location || '').trim().toUpperCase() === (detailItem.location || '').trim().toUpperCase() &&
        (detailItem.item_code 
          ? (i.item_code || '').trim().toUpperCase() === (detailItem.item_code || '').trim().toUpperCase()
          : (i.item_name || '').trim().toUpperCase() === (detailItem.item_name || '').trim().toUpperCase())
      );
      if (matches.length > 1) return matches;
    }
    return [];
  }, [detailItem, inventoryList]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    return baseDataList.filter(item => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (item.status || '').toLowerCase().trim();
        if (statusFilter === 'UNCHECKED') {
          if (s !== '' && s !== '-') return false;
        } else if (statusFilter.toLowerCase() !== s) {
          return false;
        }
      }

      // 2. Location Filter (Mendukung ketik untuk mencari lokasi & filter langsung)
      if (locationFilter && locationFilter !== 'ALL' && locationFilter.trim() !== '') {
        const qLoc = locationFilter.toLowerCase().trim();
        const itemLoc = (item.location || '').toLowerCase().trim();
        if (!itemLoc.includes(qLoc)) return false;
      }

      // 3. SLoc Filter
      if (slocFilter !== 'ALL') {
        if (item.sloc !== slocFilter) return false;
      }

      // 4. Text Search (SKU, Nama Barang, Batch, LPN, Note - Tidak lagi mencakup lokasi karena sudah ada filter lokasi khusus)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (item.item_code || '').toLowerCase().includes(q);
        const matchName = (item.item_name || '').toLowerCase().includes(q);
        const matchBatch = (item.batch || '').toLowerCase().includes(q);
        const matchStatus = (item.status || '').toLowerCase().includes(q);
        const matchId = (item.id_inventory || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        const matchTujuan = (item.tujuan || '').toLowerCase().includes(q);
        const matchLpn = (item.lpn_serial_number || '').toLowerCase().includes(q);

        if (!matchCode && !matchName && !matchBatch && !matchStatus && !matchId && !matchNote && !matchTujuan && !matchLpn) {
          return false;
        }
      }

      return true;
    });
  }, [baseDataList, statusFilter, locationFilter, slocFilter, searchQuery]);

  // Sort Logic - Standar tampilan tabel urut sesuai location (A-Z)
  const sortedData = useMemo(() => {
    const effectiveSortField = sortField || 'location';
    const effectiveSortOrder = sortOrder || 'asc';

    return [...filteredData].sort((a, b) => {
      // Sorting Lokasi (dengan tie-breaker Nama Barang)
      if (effectiveSortField === 'location') {
        const locA = String(a.location || '').trim();
        const locB = String(b.location || '').trim();
        const locComp = locA.localeCompare(locB, 'id-ID', { numeric: true, sensitivity: 'base' });
        if (locComp !== 0) {
          return effectiveSortOrder === 'asc' ? locComp : -locComp;
        }
        const nameA = String(a.item_name || '').trim();
        const nameB = String(b.item_name || '').trim();
        const nameComp = nameA.localeCompare(nameB, 'id-ID', { numeric: true, sensitivity: 'base' });
        return effectiveSortOrder === 'asc' ? nameComp : -nameComp;
      }

      // Sorting Nama Barang (dengan tie-breaker Lokasi)
      if (effectiveSortField === 'item_name') {
        const nameA = String(a.item_name || '').trim();
        const nameB = String(b.item_name || '').trim();
        const nameComp = nameA.localeCompare(nameB, 'id-ID', { numeric: true, sensitivity: 'base' });
        if (nameComp !== 0) {
          return effectiveSortOrder === 'asc' ? nameComp : -nameComp;
        }
        const locA = String(a.location || '').trim();
        const locB = String(b.location || '').trim();
        return effectiveSortOrder === 'asc'
          ? locA.localeCompare(locB, 'id-ID', { numeric: true, sensitivity: 'base' })
          : locB.localeCompare(locA, 'id-ID', { numeric: true, sensitivity: 'base' });
      }

      const valA = a[effectiveSortField] ?? '';
      const valB = b[effectiveSortField] ?? '';

      if (effectiveSortField === 'qty_convert' || effectiveSortField === 'last_qty' || effectiveSortField === 'first_qty') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return effectiveSortOrder === 'asc' ? numA - numB : numB - numA;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return effectiveSortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return effectiveSortOrder === 'asc'
        ? strA.localeCompare(strB, 'id-ID', { numeric: true, sensitivity: 'base' })
        : strB.localeCompare(strA, 'id-ID', { numeric: true, sensitivity: 'base' });
    });
  }, [filteredData, sortField, sortOrder]);

  // Pagination Logic
  const paginatedData = useMemo(() => {
    if (pageSize === 'ALL') return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pageSize, currentPage]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(sortedData.length / pageSize) || 1;

  // Sorting Handler (kembali ke standar tampilan tabel urut lokasi A-Z)
  const handleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField('location');
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Selection Check Helpers
  const isRowSelected = (row: InventoryItem) => {
    const ids = row.child_ids && row.child_ids.length > 0 ? row.child_ids : [row.id_inventory];
    return ids.length > 0 && ids.every(id => selectedIds.includes(id));
  };

  const isSomeRowSelected = (row: InventoryItem) => {
    const ids = row.child_ids && row.child_ids.length > 0 ? row.child_ids : [row.id_inventory];
    return ids.some(id => selectedIds.includes(id)) && !isRowSelected(row);
  };

  // Multi-Selection Handlers
  const isAllFilteredSelected = paginatedData.length > 0 && paginatedData.every(i => isRowSelected(i));
  const isSomeFilteredSelected = paginatedData.some(i => i.child_ids ? i.child_ids.some(id => selectedIds.includes(id)) : selectedIds.includes(i.id_inventory)) && !isAllFilteredSelected;

  const handleToggleSelectAllFiltered = () => {
    const pageIds = paginatedData.flatMap(i => (i.child_ids && i.child_ids.length > 0 ? i.child_ids : [i.id_inventory]));
    if (isAllFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (row: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rowIds = row.child_ids && row.child_ids.length > 0 ? row.child_ids : [row.id_inventory];
    const isSelected = rowIds.every(id => selectedIds.includes(id));

    if (isSelected) {
      setSelectedIds(prev => prev.filter(id => !rowIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...rowIds])));
    }
  };

  // Selected Summary Calculation (including SKU per Location breakdown)
  const selectedSummary = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedItems = inventoryList.filter(i => selectedIds.includes(i.id_inventory));
    const totalLastQty = selectedItems.reduce((sum, item) => sum + Number(item.last_qty || 0), 0);
    const totalQtyConvert = selectedItems.reduce((sum, item) => sum + Number(item.qty_convert || 0), 0);
    const distinctSku = new Set(selectedItems.map(i => i.item_code).filter(Boolean)).size;
    const distinctBatch = new Set(selectedItems.map(i => i.batch).filter(Boolean)).size;
    const distinctLocation = new Set(selectedItems.map(i => i.location).filter(Boolean)).size;

    return {
      selectedCount: selectedItems.length,
      totalRows: inventoryList.length,
      totalLastQty,
      totalQtyConvert,
      distinctSkuCount: distinctSku,
      distinctBatchCount: distinctBatch,
      distinctLocationCount: distinctLocation,
      displayUom: selectedItems[0]?.uom || 'CTN',
      displayUomConvert: selectedItems[0]?.uom_convert || 'PCS',
      selectedItems
    };
  }, [selectedIds, inventoryList]);

  // SKU Filter Analytics (Sum Last Qty for same SKU to eliminate manual calculation)
  const skuFilterSummary = useMemo(() => {
    if (filteredData.length === 0) return null;

    const skuMap = new Map<string, {
      item_code: string;
      item_name: string;
      uom: string;
      uom_convert: string;
      totalLastQty: number;
      totalQtyConvert: number;
      locations: Set<string>;
      batches: Set<string>;
      count: number;
    }>();

    filteredData.forEach(item => {
      const rawCode = (item.item_code || '').trim();
      const rawName = (item.item_name || '').trim();
      const key = (rawCode || rawName).toUpperCase();

      if (!skuMap.has(key)) {
        skuMap.set(key, {
          item_code: rawCode || '-',
          item_name: rawName || '-',
          uom: item.uom || 'CTN',
          uom_convert: item.uom_convert || 'PCS',
          totalLastQty: 0,
          totalQtyConvert: 0,
          locations: new Set<string>(),
          batches: new Set<string>(),
          count: 0
        });
      }

      const g = skuMap.get(key)!;
      g.totalLastQty += Number(item.last_qty || 0);
      g.totalQtyConvert += Number(item.qty_convert ?? item.last_qty ?? 0);
      if (item.location) g.locations.add(item.location);
      if (item.batch) g.batches.add(item.batch);
      g.count++;
    });

    const distinctSkuCount = skuMap.size;
    const isSingleSku = distinctSkuCount === 1;
    const singleSku = isSingleSku ? Array.from(skuMap.values())[0] : null;

    const overallLastQty = filteredData.reduce((acc, item) => acc + Number(item.last_qty || 0), 0);
    const overallQtyConvert = filteredData.reduce((acc, item) => acc + Number(item.qty_convert ?? item.last_qty ?? 0), 0);

    return {
      distinctSkuCount,
      isSingleSku,
      singleSku,
      overallLastQty,
      overallQtyConvert,
      totalRows: filteredData.length
    };
  }, [filteredData]);

  // Distinct Lists for Filters
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(inventoryList.map(i => i.location).filter(Boolean))).sort();
  }, [inventoryList]);

  // Suggestions for Location typing search
  const filteredLocationSuggestions = useMemo(() => {
    if (!locationFilter || locationFilter === 'ALL' || !locationFilter.trim()) {
      return uniqueLocations;
    }
    const q = locationFilter.toLowerCase().trim();
    return uniqueLocations.filter(loc => loc.toLowerCase().includes(q));
  }, [uniqueLocations, locationFilter]);

  // Click outside listener for location dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueSlocs = useMemo(() => {
    return Array.from(new Set(inventoryList.map(i => i.sloc).filter(Boolean))).sort();
  }, [inventoryList]);

  // Status Stats
  const statusStats = useMemo(() => {
    const total = inventoryList.length;
    let ada = 0;
    let beda = 0;
    let tidak = 0;
    let belumDicek = 0;
    let totalQty = 0;

    inventoryList.forEach(item => {
      totalQty += Number(item.last_qty || 0);
      const s = (item.status || '').toLowerCase().trim();
      if (s === 'ada') ada++;
      else if (s === 'beda') beda++;
      else if (s === 'tidak') tidak++;
      else belumDicek++;
    });

    return { total, ada, beda, tidak, belumDicek, totalQty };
  }, [inventoryList]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    (locationFilter !== '' && locationFilter !== 'ALL') ||
    slocFilter !== 'ALL'
  );

  // Check if custom sort is active (bukan standar tampilan tabel urut lokasi A-Z)
  const isCustomSortActive = Boolean(sortField && !(sortField === 'location' && sortOrder === 'asc'));

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setLocationFilter('');
    setSlocFilter('ALL');
    setSortField('location');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-3 animate-fade-in text-slate-800 text-xs">
      
      {/* ========================================================================= */}
      {/* TOP HEADER & ACTION CONTROLS */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center shadow-2xs">
            {viewMode === 'stock_opname' ? <ClipboardList size={17} /> : <Package size={17} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-black text-slate-900 m-0 uppercase tracking-tight">
                {viewMode === 'stock_opname' ? 'Stock Opname Inventory' : 'Inventory Gudang'}
              </h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${
                viewMode === 'stock_opname'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {viewMode === 'stock_opname' ? 'Mode Opname Aktif' : 'Mode Standar'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 m-0 font-medium">
              Total {inventoryList.length} item stok • {statusStats.ada} Ada • {statusStats.tidak} Tidak • {statusStats.beda} Beda
            </p>
          </div>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Mode Switcher Dropdown (Stock Opname vs Standar) */}
          <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs transition-colors">
            <span className="text-[11px] font-extrabold text-slate-600 shrink-0 flex items-center gap-1">
              {viewMode === 'stock_opname' ? (
                <ClipboardList size={13} className="text-teal-700" />
              ) : (
                <Layers size={13} className="text-indigo-600" />
              )}
              <span className="hidden sm:inline">Mode:</span>
            </span>
            <select
              value={viewMode}
              onChange={(e) => handleToggleViewMode(e.target.value as 'stock_opname' | 'standard')}
              className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700 cursor-pointer shadow-2xs"
            >
              <option value="stock_opname">📋 Stock Opname</option>
              <option value="standard">📑 Standar (Lengkap)</option>
            </select>
          </div>

          {/* Tombol Scan SN / LPN di Lantai Gudang */}
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs shadow-xs transition-all cursor-pointer"
            title="Scan barcode atau QR SN / LPN di lantai gudang untuk mengetahui lokasi dan SKU detail"
          >
            <Scan size={14} />
            <span>Scan SN / LPN</span>
          </button>

          {/* Refresh / Sync */}
          <button
            type="button"
            onClick={() => fetchInventoryData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Sinkronisasi dengan database cloud pusat"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-teal-700' : 'text-slate-500'} />
            <span className="hidden sm:inline">Sinkron</span>
          </button>

          {/* Export Excel - Desktop Only */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Unduh laporan ke file Excel (.xlsx)"
          >
            <Download size={13} className="text-emerald-700" />
            <span>Export Excel</span>
          </button>

          {/* Upload Excel (Admin Only) - Desktop Only */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 text-teal-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              title="Upload file Excel massal khusus Admin"
            >
              <Upload size={13} className="text-teal-700" />
              <span>Upload Excel</span>
            </button>
          )}

          {/* Tambah Data - Desktop Only */}
          <button
            type="button"
            onClick={() => {
              setItemToEdit(null);
              setShowFormModal(true);
            }}
            className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & FILTER BAR */}
      {/* ========================================================================= */}
      <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Search Input (Tanpa Lokasi karena lokasi punya filter khusus yang bisa diketik) */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SKU, Nama Barang, Batch, LPN, Note..."
              className="w-full pl-9 pr-14 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                  title="Hapus teks pencarian"
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                className="p-1 text-teal-700 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                title="Scan barcode / LPN untuk mencari"
              >
                <Scan size={13} />
              </button>
            </div>
          </div>

          {/* Location Filter: User Bisa Ketik untuk Mencari & Filter Lokasi */}
          <div className="relative flex items-center gap-1" ref={locationDropdownRef}>
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-0.5">
              <MapPin size={12} className="text-indigo-600" />
              <span>Lokasi:</span>
            </span>
            <div className="relative min-w-[145px] sm:min-w-[175px]">
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setIsLocationDropdownOpen(true);
                  setCurrentPage(1);
                }}
                onFocus={() => setIsLocationDropdownOpen(true)}
                placeholder="Ketik cari lokasi..."
                className="w-full pl-2.5 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-2xs font-mono"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                {locationFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationFilter('');
                      setCurrentPage(1);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Bersihkan filter lokasi"
                  >
                    <X size={11} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLocationDropdownOpen(prev => !prev)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Buka daftar lokasi"
                  >
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>

              {/* Location Suggestion Dropdown */}
              {isLocationDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 w-56 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Pilih Lokasi ({filteredLocationSuggestions.length})</span>
                    {locationFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationFilter('');
                          setIsLocationDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="text-indigo-600 hover:underline cursor-pointer font-bold"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLocationFilter('');
                      setIsLocationDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between hover:bg-indigo-50 cursor-pointer font-bold ${
                      !locationFilter ? 'text-indigo-700 bg-indigo-50/60' : 'text-slate-700'
                    }`}
                  >
                    <span>Semua Lokasi</span>
                    {!locationFilter && <Check size={12} className="text-indigo-600" />}
                  </button>

                  {filteredLocationSuggestions.map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setLocationFilter(loc);
                        setIsLocationDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between hover:bg-indigo-50 cursor-pointer font-mono ${
                        locationFilter.toLowerCase() === loc.toLowerCase() ? 'text-indigo-700 bg-indigo-50/70 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{loc}</span>
                      {locationFilter.toLowerCase() === loc.toLowerCase() && (
                        <Check size={12} className="text-indigo-600 shrink-0" />
                      )}
                    </button>
                  ))}

                  {filteredLocationSuggestions.length === 0 && (
                    <div className="px-3 py-2 text-slate-400 text-[11px] italic text-center">
                      "{locationFilter}" difilter sebagai teks pencarian lokasi
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SLoc Filter - Desktop Only */}
          <div className="hidden lg:flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">SLOC:</span>
            <select
              value={slocFilter}
              onChange={(e) => {
                setSlocFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            >
              <option value="ALL">Semua SLOC</option>
              {uniqueSlocs.map(sl => (
                <option key={sl} value={sl}>{sl}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="Ada">Ada</option>
              <option value="Tidak">Tidak</option>
              <option value="Beda">Beda</option>
              <option value="UNCHECKED">Belum Dicek</option>
            </select>
          </div>
        </div>

        {/* Active Filter & Sorting Badges */}
        {(hasActiveFilters || isCustomSortActive) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Filter size={12} className="text-teal-900" />
              Filter Aktif:
            </span>

            {/* Active Sort Badge - Hanya muncul jika sort BUKAN standar urutan lokasi A-Z */}
            {isCustomSortActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-300">
                <ArrowUpDown size={11} className="text-teal-700" />
                <span>
                  Urutan:{' '}
                  {sortField === 'location'
                    ? 'Lokasi (Z-A)'
                    : sortField === 'item_name'
                    ? 'Nama Barang'
                    : sortField === 'last_qty'
                    ? 'Last Qty'
                    : sortField === 'qty_convert'
                    ? 'Qty Convert'
                    : sortField === 'sloc'
                    ? 'SLOC'
                    : sortField === 'status'
                    ? 'Status'
                    : sortField === 'batch'
                    ? 'Batch'
                    : sortField === 'created_at'
                    ? 'Waktu Input'
                    : String(sortField)}{' '}
                  ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSortField('location');
                    setSortOrder('asc');
                  }}
                  className="hover:text-rose-600 cursor-pointer ml-0.5"
                  title="Kembalikan ke standar urutan lokasi (A-Z)"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-900 text-[11px] font-bold border border-teal-200">
                <span>Cari: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-teal-700 cursor-pointer ml-0.5"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {locationFilter && locationFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 text-[11px] font-bold border border-indigo-200">
                <MapPin size={11} />
                <span>Lokasi: {locationFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-indigo-700 cursor-pointer ml-0.5"
                  title="Hapus filter lokasi"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {slocFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 text-[11px] font-bold border border-blue-200">
                <span>SLOC: {slocFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSlocFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-blue-700 cursor-pointer ml-0.5"
                  title="Hapus filter SLOC"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {statusFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                statusFilter === 'UNCHECKED'
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : statusFilter.toLowerCase() === 'ada'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : statusFilter.toLowerCase() === 'beda'
                  ? 'bg-blue-50 text-blue-900 border-blue-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}>
                <span>Status: {statusFilter === 'UNCHECKED' ? 'Belum Dicek' : statusFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:opacity-75 cursor-pointer ml-0.5"
                  title="Hapus filter status"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200"
            >
              <RotateCcw size={11} />
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* BULK ACTION BAR KETIKA PILIH BARIS (INLINE SUMMARY) */}
      {selectedSummary && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-teal-200/90 shadow-2xs space-y-1.5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 text-xs font-black border border-teal-300">
                <CheckCheck size={14} className="text-teal-700" />
                <span>{selectedSummary.selectedCount} Baris Terpilih</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  / {selectedSummary.totalRows}
                </span>
              </span>

              {/* Inline Summary Metrics */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200">
                  <span>Total Last Qty:</span>
                  <strong className="text-teal-900 font-mono font-black">{selectedSummary.totalLastQty.toLocaleString('id-ID')} {selectedSummary.displayUom}</strong>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  <span>Total Qty Convert:</span>
                  <strong className="text-emerald-900 font-mono font-black">{selectedSummary.totalQtyConvert.toLocaleString('id-ID')} {selectedSummary.displayUomConvert}</strong>
                </span>

                {selectedSummary.distinctSkuCount > 0 && (
                  <span className="text-[11px] text-slate-500 font-medium hidden lg:inline">
                    • {selectedSummary.distinctSkuCount} SKU • {selectedSummary.distinctBatchCount} Batch • {selectedSummary.distinctLocationCount} Lokasi
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {/* Pindah Data Massal Button */}
              <button
                type="button"
                onClick={() => setShowBulkTransferModal(true)}
                className="px-2.5 py-1 rounded-lg bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white text-xs font-black shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                title="Buka dialog transfer massal untuk baris terpilih"
              >
                <Share2 size={12} />
                <span>Pindah Massal ({selectedSummary.selectedCount})</span>
              </button>

              {/* Hapus Terpilih (Admin Only) */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="Hapus baris terpilih (Khusus Admin)"
                >
                  <Trash2 size={12} />
                  <span>Hapus</span>
                </button>
              )}

              {/* Clear Selection */}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <X size={12} />
                <span>Batal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SKU FILTER ANALYTICS: HANYA SUM LAST QTY & SUM QTY CONVERT (RINGKAS & LEGA) */}
      {/* ========================================================================= */}
      {skuFilterSummary && skuFilterSummary.isSingleSku && skuFilterSummary.singleSku && (
        <div className="px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 shadow-2xs flex flex-wrap items-center justify-end gap-2 text-slate-800 animate-fade-in">
          {/* SUM LAST QTY */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-xs shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
              SUM LAST QTY:
            </span>
            <span className="font-mono font-black text-emerald-950 text-xs sm:text-sm">
              {skuFilterSummary.singleSku.totalLastQty.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-black text-emerald-700 uppercase">
              {skuFilterSummary.singleSku.uom}
            </span>
          </div>

          {/* SUM QTY CONVERT */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-teal-300 text-xs shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800">
              SUM QTY CONVERT:
            </span>
            <span className="font-mono font-black text-teal-950 text-xs sm:text-sm">
              {skuFilterSummary.singleSku.totalQtyConvert.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-black text-teal-700 uppercase">
              {skuFilterSummary.singleSku.uom_convert}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATA TABLE (DYNAMIC COLUMNS ACCORDING TO VIEW MODE) */}
      {/* ========================================================================= */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Table Top Bar */}
        <div className="p-2 sm:p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            {viewMode === 'stock_opname' ? (
              <ClipboardList size={14} className="text-teal-800" />
            ) : (
              <Package size={14} className="text-teal-800" />
            )}
            <span>
              {viewMode === 'stock_opname' ? 'Tabel Stock Opname (SUMIFS SKU per Lokasi)' : 'Tabel Inventory'} ({filteredData.length} item)
            </span>
            {selectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[10px] font-extrabold border border-teal-200">
                {selectedIds.length} dipilih
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tombol Hide / Unhide Kolom Location */}
            <button
              type="button"
              onClick={handleToggleLocationColumn}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer shadow-2xs ${
                showLocationColumn
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-black'
              }`}
              title={showLocationColumn ? 'Klik untuk sembunyikan kolom Location di tabel' : 'Klik untuk tampilkan kembali kolom Location di tabel'}
            >
              {showLocationColumn ? <EyeOff size={13} className="text-slate-500" /> : <Eye size={13} className="text-amber-800" />}
              <span>{showLocationColumn ? 'Hide Location' : 'Unhide Location'}</span>
            </button>

            <span className="text-[11px] font-semibold text-slate-500 ml-1">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Semua Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-tight text-[10px] border-b border-slate-200 select-none">
                
                {/* Select All Checkbox */}
                <th className="px-2 py-1.5 text-center w-8">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllFiltered}
                    className="p-1 rounded text-slate-600 hover:text-teal-900 cursor-pointer transition-colors"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare size={14} className="text-teal-800" />
                    ) : isSomeFilteredSelected ? (
                      <Square size={14} className="text-teal-600 fill-teal-100" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                  </button>
                </th>

                {/* Status Column - Prominent & Sticky */}
                <th 
                  onClick={() => handleSort('status')}
                  className={`px-2 py-1.5 text-center sticky left-0 bg-slate-100 z-10 w-24 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'status' ? 'bg-teal-50 text-teal-950 font-black' : ''}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-700 font-black" /> : <ArrowDown size={12} className="text-teal-700 font-black" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Location Column */}
                {showLocationColumn && (
                  <th 
                    onClick={() => handleSort('location')} 
                    className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'location' ? 'bg-teal-50 text-teal-950 font-black' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      {sortField === 'location' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-700 font-black" /> : <ArrowDown size={12} className="text-teal-700 font-black" />
                      ) : (
                        <ArrowUpDown size={11} className="text-slate-400" />
                      )}
                    </div>
                  </th>
                )}

                {/* Item Name Column */}
                <th 
                  onClick={() => handleSort('item_name')} 
                  className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'item_name' ? 'bg-teal-50 text-teal-950 font-black' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span>Item Name</span>
                    {sortField === 'item_name' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-700 font-black" /> : <ArrowDown size={12} className="text-teal-700 font-black" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Last Qty Column */}
                <th 
                  onClick={() => handleSort('last_qty')} 
                  className={`px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'last_qty' ? 'bg-slate-200 text-slate-950 font-black' : ''}`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Qty</span>
                    {sortField === 'last_qty' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 font-black" /> : <ArrowDown size={12} className="text-slate-900 font-black" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Qty Convert Column */}
                <th 
                  onClick={() => handleSort('qty_convert')} 
                  className={`px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'qty_convert' ? 'bg-teal-50 text-teal-950 font-black' : ''}`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Qty Convert</span>
                    {sortField === 'qty_convert' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-700 font-black" /> : <ArrowDown size={12} className="text-teal-700 font-black" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Standard Mode Only: Batch & Expired Date */}
                {viewMode === 'standard' && (
                  <>
                    <th 
                      onClick={() => handleSort('batch')} 
                      className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'batch' ? 'bg-slate-200 text-slate-950 font-black' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <span>Batch</span>
                        {sortField === 'batch' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 font-black" /> : <ArrowDown size={12} className="text-slate-900 font-black" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('expired_date')} 
                      className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'expired_date' ? 'bg-slate-200 text-slate-950 font-black' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <span>Expired Date</span>
                        {sortField === 'expired_date' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 font-black" /> : <ArrowDown size={12} className="text-slate-900 font-black" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400" />
                        )}
                      </div>
                    </th>
                  </>
                )}

                {/* Note Column */}
                <th 
                  onClick={() => handleSort('note')} 
                  className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'note' ? 'bg-slate-200 text-slate-950 font-black' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span>Note</span>
                    {sortField === 'note' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 font-black" /> : <ArrowDown size={12} className="text-slate-900 font-black" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Standard Mode Only: Tujuan */}
                {viewMode === 'standard' && (
                  <th 
                    onClick={() => handleSort('tujuan')} 
                    className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'tujuan' ? 'bg-teal-50 text-teal-950 font-black' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>Tujuan</span>
                      {sortField === 'tujuan' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-700 font-black" /> : <ArrowDown size={12} className="text-teal-700 font-black" />
                      ) : (
                        <ArrowUpDown size={11} className="text-slate-400" />
                      )}
                    </div>
                  </th>
                )}

                {/* Action Column */}
                <th className="px-2 py-1.5 text-center w-16">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/70">
              {isLoading ? (
                <tr>
                  <td colSpan={viewMode === 'stock_opname' ? (showLocationColumn ? 8 : 7) : (showLocationColumn ? 11 : 10)} className="p-8 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-teal-800" />
                      <span>Memuat data inventory dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'stock_opname' ? (showLocationColumn ? 8 : 7) : (showLocationColumn ? 11 : 10)} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Package size={32} className="text-slate-300" />
                      <span className="font-extrabold text-slate-700 text-xs">Belum Ada Data Inventory</span>
                      <p className="text-[11px] text-slate-400 max-w-md m-0">
                        {searchQuery || locationFilter !== 'ALL' || slocFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Tidak ditemukan data yang cocok dengan kriteria filter.'
                          : 'Klik tombol "Tambah Data" atau "Upload Excel" (Admin) untuk menambahkan data inventory.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const isSelected = isRowSelected(row);
                  const isPartiallySelected = isSomeRowSelected(row);
                  
                  const statusKey = (row.status || '').toLowerCase().trim();
                  const isAda = statusKey === 'ada';
                  const isBeda = statusKey === 'beda';
                  const isTidak = statusKey === 'tidak';

                  // Row background & styling based on Status & Selection (matching Penyiapan)
                  let rowBgClass = 'hover:bg-slate-50/80';
                  let stickyCellBgClass = 'bg-white group-hover:bg-slate-50';
                  let locationCellClass = 'text-slate-800 font-mono font-bold';
                  let locationIconClass = 'text-slate-400';
                  let itemNameClass = 'text-slate-900 font-semibold';

                  if (isSelected) {
                    rowBgClass = isAda
                      ? 'bg-emerald-100/80 hover:bg-emerald-200/70 font-semibold'
                      : isBeda
                      ? 'bg-blue-100/80 hover:bg-blue-200/70 font-semibold'
                      : isTidak
                      ? 'bg-amber-100/80 hover:bg-amber-200/70 font-semibold'
                      : 'bg-teal-50/80 hover:bg-teal-100/70 font-semibold';
                    stickyCellBgClass = isAda
                      ? 'bg-emerald-100 group-hover:bg-emerald-200/80'
                      : isBeda
                      ? 'bg-blue-100 group-hover:bg-blue-200/80'
                      : isTidak
                      ? 'bg-amber-100 group-hover:bg-amber-200/80'
                      : 'bg-teal-50 group-hover:bg-teal-100/80';
                  } else if (isAda) {
                    rowBgClass = 'bg-emerald-50/60 hover:bg-emerald-100/60';
                    stickyCellBgClass = 'bg-emerald-50 group-hover:bg-emerald-100/80';
                    locationCellClass = 'text-emerald-950 font-bold bg-emerald-100/40';
                    locationIconClass = 'text-emerald-700';
                    itemNameClass = 'text-emerald-950 font-black';
                  } else if (isBeda) {
                    rowBgClass = 'bg-blue-50/60 hover:bg-blue-100/60';
                    stickyCellBgClass = 'bg-blue-50 group-hover:bg-blue-100/80';
                    locationCellClass = 'text-blue-950 font-bold bg-blue-100/40';
                    locationIconClass = 'text-blue-700';
                    itemNameClass = 'text-blue-950 font-black';
                  } else if (isTidak) {
                    rowBgClass = 'bg-amber-50/60 hover:bg-amber-100/60';
                    stickyCellBgClass = 'bg-amber-50 group-hover:bg-amber-100/80';
                    locationCellClass = 'text-amber-950 font-bold bg-amber-100/40';
                    locationIconClass = 'text-amber-700';
                    itemNameClass = 'text-amber-950 font-black';
                  }

                  return (
                    <tr
                      key={row.id_inventory || idx}
                      onClick={() => {
                        setDetailItem(row);
                        setShowDetailModal(true);
                      }}
                      className={`cursor-pointer transition-colors group ${rowBgClass}`}
                      title="Klik baris untuk melihat detail"
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1.5 text-center" onClick={(e) => handleToggleSelectRow(row, e)}>
                        <div className="p-1 rounded text-slate-600 hover:text-teal-900 cursor-pointer">
                          {isSelected ? (
                            <CheckSquare size={14} className="text-teal-800" />
                          ) : isPartiallySelected ? (
                            <Square size={14} className="text-teal-600 fill-teal-100" />
                          ) : (
                            <Square size={14} className="text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Status Sticky Column with Direct Selector */}
                      <td 
                        className={`px-1.5 py-1 text-center sticky left-0 transition-colors z-10 shadow-2xs border-r border-slate-100 ${stickyCellBgClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={row.status || ''}
                          onChange={(e) => handleUpdateStatus(row, e.target.value)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold border outline-none cursor-pointer text-center appearance-none w-full shadow-2xs transition-all ${
                            isAda ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/50' :
                            isBeda ? 'bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-400/50' :
                            isTidak ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-400/50' :
                            'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <option value="">- Status -</option>
                          <option value="Ada">Ada</option>
                          <option value="Tidak">Tidak</option>
                          <option value="Beda">Beda</option>
                        </select>
                      </td>

                      {/* Location */}
                      {showLocationColumn && (
                        <td className={`px-2.5 py-1.5 min-w-[100px] rounded-sm ${locationCellClass}`}>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className={`shrink-0 ${locationIconClass}`} />
                            <span>{row.location || '-'}</span>
                          </div>
                        </td>
                      )}

                      {/* Item Name */}
                      <td className={`px-2.5 py-1.5 min-w-[180px] max-w-xs ${isAda ? 'bg-emerald-50/40' : isBeda ? 'bg-blue-50/40' : isTidak ? 'bg-amber-50/40' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          <div className={`text-xs truncate ${itemNameClass}`} title={row.item_name}>
                            {row.item_name || '-'}
                          </div>
                          {viewMode === 'stock_opname' && (row.child_count || 1) > 1 && (
                            <span 
                              className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-teal-100 text-teal-800 border border-teal-200 shrink-0" 
                              title={`Tergabung dari ${row.child_count} baris/batch di lokasi ini`}
                            >
                              {row.child_count} batch
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Qty */}
                      <td className="px-2.5 py-1.5 text-right min-w-[80px]">
                        <span className="font-mono font-black text-emerald-900 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200/60 text-xs inline-block">
                          {Number(row.last_qty || 0).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Qty Convert */}
                      <td className="px-2.5 py-1.5 text-right min-w-[85px]">
                        <div className="inline-flex items-center gap-1 bg-teal-50/80 px-2 py-0.5 rounded border border-teal-200/60">
                          <span className="font-mono font-black text-teal-900 text-xs">
                            {Number(row.qty_convert ?? row.last_qty ?? 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] font-bold text-teal-700 uppercase">
                            {row.uom_convert || 'PCS'}
                          </span>
                        </div>
                      </td>

                      {/* Standard Mode Only: Batch & Expired Date */}
                      {viewMode === 'standard' && (
                        <>
                          <td className="px-2.5 py-1.5 font-mono text-slate-700">
                            {row.batch || '-'}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-slate-700">
                            {row.expired_date || '-'}
                          </td>
                        </>
                      )}

                      {/* Note Column with Quick / Inline Edit */}
                      <td 
                        className="px-2.5 py-1.5 max-w-xs min-w-[150px] cursor-pointer group/note" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteId(row.id_inventory);
                          setEditingNoteValue(row.note || '');
                        }}
                        title="Klik untuk edit catatan langsung"
                      >
                        {editingNoteId === row.id_inventory ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              onBlur={() => handleUpdateNote(row, editingNoteValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleUpdateNote(row, editingNoteValue);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingNoteId(null);
                                }
                              }}
                              className="px-2 py-1 text-xs rounded border border-teal-500 bg-white font-medium text-slate-800 outline-none w-full shadow-2xs focus:ring-1.5 focus:ring-teal-500"
                              placeholder="Tulis catatan..."
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUpdateNote(row, editingNoteValue);
                              }}
                              className="p-1 rounded bg-teal-700 text-white hover:bg-teal-800 shrink-0 cursor-pointer shadow-2xs transition-colors"
                              title="Simpan Catatan (Enter)"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingNoteId(null);
                              }}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 shrink-0 cursor-pointer shadow-2xs transition-colors"
                              title="Batal (Esc)"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center justify-between gap-1.5 py-0.5 px-1.5 rounded hover:bg-teal-50/80 border border-transparent hover:border-teal-300 transition-all"
                          >
                            <span 
                              className={`truncate text-xs ${row.note ? 'text-slate-700 font-medium' : 'text-slate-400 italic text-[11px]'}`}
                              title={row.note || 'Klik untuk tambah catatan'}
                            >
                              {row.note || '+ Tambah Catatan'}
                            </span>
                            <Edit2 
                              size={11} 
                              className="opacity-0 group-hover/note:opacity-100 text-teal-700 shrink-0 transition-opacity" 
                            />
                          </div>
                        )}
                      </td>

                      {/* Standard Mode Only: Tujuan */}
                      {viewMode === 'standard' && (
                        <td className="px-2.5 py-1.5 font-semibold text-teal-900 max-w-xs truncate" title={row.tujuan || '-'}>
                          {row.tujuan || '-'}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {viewMode === 'standard' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setItemToEdit(row);
                                setShowFormModal(true);
                              }}
                              className="p-1 rounded-md text-slate-500 hover:text-teal-800 hover:bg-teal-50 transition-colors cursor-pointer"
                              title="Edit baris ini"
                            >
                              <Edit2 size={13} />
                            </button>
                          ) : (
                            <span 
                              className="p-1 text-slate-300 cursor-not-allowed select-none inline-flex items-center justify-center"
                              title="Mode Opname Aktif: Fungsi edit dimatikan"
                            >
                              <Edit2 size={13} className="opacity-30" />
                            </span>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(row.id_inventory, row.item_name)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus baris ini"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-semibold">
              Halaman {currentPage} dari {totalPages} (Total {filteredData.length} baris)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL COMPONENTS */}
      {/* ========================================================================= */}
      <InventoryFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setItemToEdit(null);
        }}
        onSave={handleSaveItem}
        itemToEdit={itemToEdit}
        existingItems={inventoryList}
        barangList={barangList}
        currentUser={currentUser}
        showToast={showToast}
      />

      <InventoryDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailItem(null);
        }}
        item={detailItem}
        childItems={detailChildItems}
        isOpnameMode={viewMode === 'stock_opname'}
        onEdit={(item) => {
          if (viewMode === 'stock_opname') {
            showToast('Mode Opname Aktif', 'Fungsi edit dimatikan pada mode Stock Opname.', 'warning');
            return;
          }
          setItemToEdit(item);
          setShowFormModal(true);
        }}
        onDelete={isSuperAdmin ? (item) => {
          handleDeleteItem(item.id_inventory, item.item_name);
        } : undefined}
        showToast={showToast}
      />

      <InventoryExcelModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImportSuccess={handleImportExcelSuccess}
        existingItems={inventoryList}
        barangList={barangList}
        currentUser={currentUser}
        showToast={showToast}
      />

      <InventoryBulkTransferModal
        isOpen={showBulkTransferModal}
        onClose={() => setShowBulkTransferModal(false)}
        selectedItems={selectedSummary?.selectedItems || []}
        currentUser={currentUser}
        showToast={showToast}
        onTransferSuccess={async (destination, updatedItems) => {
          if (updatedItems.length > 0) {
            setInventoryList(prev => {
              const mapUpdated = new Map(updatedItems.map(i => [i.id_inventory, i]));
              const updated = prev.map(i => mapUpdated.has(i.id_inventory) ? mapUpdated.get(i.id_inventory)! : i);
              localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
              return updated;
            });
          } else {
            // Source items deleted
            setInventoryList(prev => {
              const updated = prev.filter(i => !selectedIds.includes(i.id_inventory));
              localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
              return updated;
            });
          }
          setSelectedIds([]);
        }}
      />

      {/* MODAL SCANNER SN / LPN LANTAI GUDANG */}
      <InventoryScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        inventoryList={inventoryList}
        onScanResult={(scannedText, metadata) => {
          if (metadata?.lpn) {
            setSearchQuery(metadata.lpn);
          } else if (metadata?.sku) {
            setSearchQuery(metadata.sku);
          } else {
            setSearchQuery(scannedText);
          }
          setCurrentPage(1);
          showToast('Scan Diterapkan', `Mencari data untuk: "${metadata?.lpn || metadata?.sku || scannedText}"`, 'info');
        }}
        onOpenDetail={(item) => {
          setDetailItem(item);
          setShowDetailModal(true);
        }}
      />

    </div>
  );
}
