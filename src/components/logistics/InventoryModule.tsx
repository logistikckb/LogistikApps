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
  Mic, 
  MicOff, 
  Share2, 
  Printer, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Eye, 
  FileSpreadsheet, 
  Send,
  ScanBarcode,
  QrCode,
  Scan,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, DataBarang } from '../../types';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { InventoryFormModal } from './inventory/InventoryFormModal';
import { InventoryDetailModal } from './inventory/InventoryDetailModal';
import { InventoryExcelModal } from './inventory/InventoryExcelModal';
import { InventoryScannerModal } from './inventory/InventoryScannerModal';
import { 
  InventoryBulkTransferModal, 
  TransferDestination 
} from './inventory/InventoryBulkTransferModal';
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
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');

  // Inline Note Edit State in table
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<keyof InventoryItem>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Voice Search
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // Bulk Import Excel
  const handleImportExcelSuccess = async (newRows: InventoryItem[]) => {
    const sanitizedRows: InventoryItem[] = newRows.map(row => ({
      ...row,
      expired_date: normalizeToIsoDate(row.expired_date) || null as any,
      first_qty: Number(row.first_qty) || 0,
      last_qty: Number(row.last_qty) || 0,
      qty_convert: Number(row.qty_convert) || 0,
      updated_at: new Date().toISOString()
    }));

    if (isSupabaseConfigured) {
      // Chunk inserts/upserts in batches of 50 to prevent payload size or timeout limits
      const chunkSize = 50;
      for (let i = 0; i < sanitizedRows.length; i += chunkSize) {
        const chunk = sanitizedRows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('data_inventory')
          .upsert(chunk, { onConflict: 'id_inventory' });
        if (error) {
          console.error('Supabase upsert chunk error:', error);
          throw error;
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

    showToast('Upload Sukses', `Berhasil menyimpan ${sanitizedRows.length} baris data ke tabel Inventory.`, 'success');
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

    const nowIso = new Date().toISOString();
    const updatedItem: InventoryItem = {
      ...item,
      status: newStatus,
      updated_at: nowIso
    };

    // 1. Optimistic Local State Update
    setInventoryList(prev => {
      const updated = prev.map(p => p.id_inventory === item.id_inventory ? updatedItem : p);
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
          .eq('id_inventory', item.id_inventory);

        if (error) throw error;
        // Silent on success to keep workflow fast and distraction-free
      } catch (err: any) {
        console.error('Failed to update inventory status:', err);
        showToast('Gagal Simpan Status', err.message || 'Terjadi kesalahan saat mengupdate status di database.', 'error');
        // Rollback state on error
        setInventoryList(prev => {
          const reverted = prev.map(p => p.id_inventory === item.id_inventory ? { ...p, status: oldStatus } : p);
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
    if (oldNote === newNote) {
      setEditingNoteId(null);
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedItem: InventoryItem = {
      ...item,
      note: newNote,
      updated_at: nowIso
    };

    setInventoryList(prev => {
      const updated = prev.map(p => p.id_inventory === item.id_inventory ? updatedItem : p);
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
          .update({ note: newNote, updated_at: nowIso })
          .eq('id_inventory', item.id_inventory);

        if (error) throw error;
        showToast('Catatan Disimpan', `Catatan untuk ${item.item_name} berhasil diperbarui.`, 'success');
      } catch (err: any) {
        console.error('Failed to update inventory note:', err);
        showToast('Gagal Simpan Catatan', err.message || 'Terjadi kesalahan sistem.', 'error');
        setInventoryList(prev => {
          const reverted = prev.map(p => p.id_inventory === item.id_inventory ? { ...p, note: oldNote } : p);
          try {
            localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(reverted));
          } catch {}
          return reverted;
        });
      }
    }
  };

  // Bulk Set Status
  const handleBulkUpdateStatus = async (targetStatus: string) => {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const nowIso = new Date().toISOString();
    const previousList = [...inventoryList];

    // Optimistic Update
    setInventoryList(prev => {
      const updated = prev.map(i => selectedIds.includes(i.id_inventory) ? { ...i, status: targetStatus, updated_at: nowIso } : i);
      try {
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        const chunkSize = 50;
        for (let i = 0; i < selectedIds.length; i += chunkSize) {
          const chunk = selectedIds.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('data_inventory')
            .update({ status: targetStatus, updated_at: nowIso })
            .in('id_inventory', chunk);
          if (error) throw error;
        }
      } catch (err: any) {
        console.error('Bulk update status error:', err);
        showToast('Gagal Update Status', err.message || 'Terjadi kesalahan sistem.', 'error');
        setInventoryList(previousList);
        try {
          localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(previousList));
        } catch {}
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
        'Item Name': item.item_name || '-',
        'Last Qty': item.last_qty ?? 0,
        'UOM': item.uom || 'CTN',
        'Qty Convert': item.qty_convert ?? 0,
        'UOM Convert': item.uom_convert || 'PCS',
        'Note': item.note || '-',
        'Item Code': item.item_code || '-',
        'Batch': item.batch || '-',
        'Expired Date': item.expired_date || '-',
        'SLOC': item.sloc || 'SL01',
        'ID Inventory': item.id_inventory
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 6 },  // No
        { wch: 12 }, // Status
        { wch: 16 }, // Location
        { wch: 36 }, // Item Name
        { wch: 12 }, // Last Qty
        { wch: 10 }, // UOM
        { wch: 14 }, // Qty Convert
        { wch: 14 }, // UOM Convert
        { wch: 28 }, // Note
        { wch: 16 }, // Item Code
        { wch: 16 }, // Batch
        { wch: 16 }, // Expired Date
        { wch: 10 }, // SLOC
        { wch: 22 }  // ID Inventory
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock_Opname_Inventory');
      const fileName = `Stock_Opname_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Ekspor Berhasil', `Laporan Stock Opname berhasil diunduh (${filteredData.length} baris).`, 'success');
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

  // Voice Search Handler
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Tidak Didukung', 'Browser Anda tidak mendukung Web Speech API.', 'warning');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        showToast('Pencarian Suara', `Mencari: "${transcript}"`, 'info');
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Scan Barcode / QR Handler
  const handleScanResult = (scannedText: string, metadata?: { sku?: string; batch?: string; lpn?: string }) => {
    const q = scannedText.trim();
    if (!q) return;

    setSearchQuery(q);
    setCurrentPage(1);

    const matches = inventoryList.filter(item => {
      const target = q.toLowerCase();
      return (item.item_code || '').toLowerCase().includes(target) ||
             (item.item_name || '').toLowerCase().includes(target) ||
             (item.batch || '').toLowerCase().includes(target) ||
             (item.lpn_serial_number || '').toLowerCase().includes(target) ||
             (item.location || '').toLowerCase().includes(target);
    });

    if (matches.length > 0) {
      showToast(
        'Scan Barcode Berhasil',
        `Menemukan ${matches.length} baris untuk "${q}"${metadata?.sku ? ` (SKU: ${metadata.sku})` : ''}`,
        'success'
      );
    } else {
      showToast(
        'Barcode Dipindai',
        `Mencari "${q}". Belum ada stok dengan data ini di inventory.`,
        'info'
      );
    }
  };

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    return inventoryList.filter(item => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (item.status || '').toLowerCase().trim();
        if (statusFilter === 'UNCHECKED') {
          if (s !== '' && s !== '-') return false;
        } else if (statusFilter.toLowerCase() !== s) {
          return false;
        }
      }

      // 2. Location Filter
      if (locationFilter !== 'ALL') {
        if (item.location !== locationFilter) return false;
      }

      // 3. SLoc Filter
      if (slocFilter !== 'ALL') {
        if (item.sloc !== slocFilter) return false;
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (item.item_code || '').toLowerCase().includes(q);
        const matchName = (item.item_name || '').toLowerCase().includes(q);
        const matchLoc = (item.location || '').toLowerCase().includes(q);
        const matchBatch = (item.batch || '').toLowerCase().includes(q);
        const matchStatus = (item.status || '').toLowerCase().includes(q);
        const matchId = (item.id_inventory || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        const matchTujuan = (item.tujuan || '').toLowerCase().includes(q);
        const matchLpn = (item.lpn_serial_number || '').toLowerCase().includes(q);

        if (!matchCode && !matchName && !matchLoc && !matchBatch && !matchStatus && !matchId && !matchNote && !matchTujuan && !matchLpn) {
          return false;
        }
      }

      return true;
    });
  }, [inventoryList, statusFilter, locationFilter, slocFilter, searchQuery]);

  // Sort Logic
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortField, sortOrder]);

  // Pagination Logic
  const paginatedData = useMemo(() => {
    if (pageSize === 'ALL') return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pageSize, currentPage]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(sortedData.length / pageSize) || 1;

  // Sorting Handler
  const handleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Multi-Selection Handlers
  const isAllFilteredSelected = paginatedData.length > 0 && paginatedData.every(i => selectedIds.includes(i.id_inventory));
  const isSomeFilteredSelected = paginatedData.some(i => selectedIds.includes(i.id_inventory)) && !isAllFilteredSelected;

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const pageIds = paginatedData.map(i => i.id_inventory);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedData.map(i => i.id_inventory);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
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

    // Aggregate by Location + Item/SKU: { "LOC - ITEM": { location, item_name, item_code, totalLastQty, totalQtyConvert, uom, uom_convert, count, batches: [] } }
    const skuByLocMap: Record<string, {
      location: string;
      item_name: string;
      item_code: string;
      totalLastQty: number;
      totalQtyConvert: number;
      uom: string;
      uom_convert: string;
      count: number;
      batches: string[];
    }> = {};

    selectedItems.forEach(item => {
      const loc = item.location || 'Tanpa Lokasi';
      const itemName = item.item_name || 'Tanpa Nama Item';
      const itemCode = item.item_code || '';
      const key = `${loc}__${itemCode || itemName}`;

      if (!skuByLocMap[key]) {
        skuByLocMap[key] = {
          location: loc,
          item_name: itemName,
          item_code: itemCode,
          totalLastQty: 0,
          totalQtyConvert: 0,
          uom: item.uom || 'CTN',
          uom_convert: item.uom_convert || 'PCS',
          count: 0,
          batches: []
        };
      }

      skuByLocMap[key].totalLastQty += Number(item.last_qty || 0);
      skuByLocMap[key].totalQtyConvert += Number(item.qty_convert || item.last_qty || 0);
      skuByLocMap[key].count += 1;
      if (item.batch && !skuByLocMap[key].batches.includes(item.batch)) {
        skuByLocMap[key].batches.push(item.batch);
      }
    });

    const skuByLocationList = Object.values(skuByLocMap).sort((a, b) => {
      if (a.location !== b.location) return a.location.localeCompare(b.location);
      return a.item_name.localeCompare(b.item_name);
    });

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
      skuByLocationList,
      selectedItems
    };
  }, [selectedIds, inventoryList]);

  // Distinct Lists for Filters
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(inventoryList.map(i => i.location).filter(Boolean))).sort();
  }, [inventoryList]);

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
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* Mode Switcher Buttons */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => handleToggleViewMode('stock_opname')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'stock_opname'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan hanya kolom: Location, Item Name, Last Qty, Qty Convert, Note dan Status Selector"
            >
              <ClipboardList size={13} className={viewMode === 'stock_opname' ? 'text-teal-700' : 'text-slate-400'} />
              <span>Stock Opname</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode('standard')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'standard'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan semua kolom data inventory lengkap"
            >
              <Layers size={13} className={viewMode === 'standard' ? 'text-teal-700' : 'text-slate-400'} />
              <span>Standar</span>
            </button>
          </div>

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

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Unduh laporan ke file Excel (.xlsx)"
          >
            <Download size={13} className="text-emerald-700" />
            <span>Export Excel</span>
          </button>

          {/* Upload Excel (Admin Only) */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 text-teal-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              title="Upload file Excel massal khusus Admin"
            >
              <Upload size={13} className="text-teal-700" />
              <span>Upload Excel</span>
            </button>
          )}

          {/* Tambah Data */}
          <button
            type="button"
            onClick={() => {
              setItemToEdit(null);
              setShowFormModal(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STATUS FILTER PILLS & QUICK METRICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-tight">
            <span>Semua Stok</span>
            <Package size={13} className="text-teal-700" />
          </div>
          <div className="text-base font-black text-slate-900 font-mono mt-0.5">
            {statusStats.total}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('Ada'); setCurrentPage(1); }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'ada'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase tracking-tight">
            <span>Status "Ada"</span>
            <CheckCircle2 size={13} className="text-emerald-700" />
          </div>
          <div className="text-base font-black text-emerald-900 font-mono mt-0.5">
            {statusStats.ada}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('Tidak'); setCurrentPage(1); }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'tidak'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 uppercase tracking-tight">
            <span>Status "Tidak"</span>
            <AlertCircle size={13} className="text-amber-700" />
          </div>
          <div className="text-base font-black text-amber-900 font-mono mt-0.5">
            {statusStats.tidak}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('Beda'); setCurrentPage(1); }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'beda'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-blue-800 uppercase tracking-tight">
            <span>Status "Beda"</span>
            <AlertTriangle size={13} className="text-blue-700" />
          </div>
          <div className="text-base font-black text-blue-900 font-mono mt-0.5">
            {statusStats.beda}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('UNCHECKED'); setCurrentPage(1); }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === 'UNCHECKED'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-tight">
            <span>Belum Dicek</span>
            <RotateCcw size={13} className="text-slate-400" />
          </div>
          <div className="text-base font-black text-slate-600 font-mono mt-0.5">
            {statusStats.belumDicek}
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & FILTER BAR */}
      {/* ========================================================================= */}
      <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Lokasi, SKU, Nama Barang, Batch, LPN, Note..."
              className="w-full pl-9 pr-24 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  title="Hapus teks pencarian"
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-1 rounded transition-colors ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-teal-700'
                }`}
                title={isListening ? 'Mendengarkan...' : 'Pencarian Suara'}
              >
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                className="p-1 rounded text-slate-500 hover:text-teal-800 hover:bg-teal-50 transition-colors"
                title="Scan QR / Barcode Kamera"
              >
                <ScanBarcode size={14} className="text-teal-700" />
              </button>
            </div>
          </div>

          {/* Quick Scan Button beside search */}
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 text-teal-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Buka Kamera Scan QR & Barcode"
          >
            <ScanBarcode size={13} className="text-teal-700" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </button>

          {/* Location Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Lokasi:</span>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-700 focus:outline-none max-w-[140px] truncate"
            >
              <option value="ALL">Semua Lokasi</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* SLoc Filter */}
          <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BULK ACTION BAR KETIKA PILIH BARIS */}
      {/* ========================================================================= */}
      {selectedSummary && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-teal-200/90 shadow-2xs space-y-2 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 text-[11px] font-black border border-teal-300">
                <CheckCheck size={13} className="text-teal-700" />
                <span>{selectedSummary.selectedCount} Baris Terpilih</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                • {selectedSummary.distinctSkuCount} SKU • {selectedSummary.distinctBatchCount} Batch • {selectedSummary.distinctLocationCount} Lokasi
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {/* Set Status Ada */}
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('Ada')}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ubah status semua baris terpilih menjadi 'Ada'"
              >
                <Check size={12} className="text-emerald-700" />
                <span>Set "Ada"</span>
              </button>

              {/* Set Status Tidak */}
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('Tidak')}
                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ubah status semua baris terpilih menjadi 'Tidak'"
              >
                <AlertCircle size={12} className="text-amber-700" />
                <span>Set "Tidak"</span>
              </button>

              {/* Set Status Beda */}
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('Beda')}
                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ubah status semua baris terpilih menjadi 'Beda'"
              >
                <AlertTriangle size={12} className="text-blue-700" />
                <span>Set "Beda"</span>
              </button>

              {/* Reset Status */}
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('')}
                className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Kosongkan status baris terpilih"
              >
                <RotateCcw size={12} className="text-slate-500" />
                <span>Reset Status</span>
              </button>

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

          {/* Mini KPI Cards for Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">Baris Terpilih</span>
                <div className="text-xs font-black text-slate-900 font-mono mt-0.5">
                  {selectedSummary.selectedCount} / {selectedSummary.totalRows}
                </div>
              </div>
              <Layers size={14} className="text-slate-400" />
            </div>

            <div className="p-2 rounded-lg bg-teal-50/70 border border-teal-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-800 uppercase tracking-tight block">Total Last Qty</span>
                <div className="text-xs font-black text-teal-900 font-mono mt-0.5">
                  {selectedSummary.totalLastQty.toLocaleString('id-ID')} {selectedSummary.displayUom}
                </div>
              </div>
              <Package size={14} className="text-teal-600" />
            </div>

            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight block">Total Qty Convert</span>
                <div className="text-xs font-black text-emerald-900 font-mono mt-0.5">
                  {selectedSummary.totalQtyConvert.toLocaleString('id-ID')} {selectedSummary.displayUomConvert}
                </div>
              </div>
              <Boxes size={14} className="text-emerald-600" />
            </div>
          </div>

          {/* Rangkuman SKU per Lokasi (Khusus membantu Stock Opname Rak) */}
          {selectedSummary.skuByLocationList && selectedSummary.skuByLocationList.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                  <MapPin size={12} className="text-teal-700" />
                  <span>Rincian Total Last Qty SKU per Lokasi:</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {selectedSummary.skuByLocationList.length} kelompok lokasi & barang terpilih
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {selectedSummary.skuByLocationList.map((group, gIdx) => (
                  <div
                    key={`${group.location}_${group.item_code || group.item_name}_${gIdx}`}
                    className="p-2 rounded-lg bg-slate-50/90 border border-slate-200 flex flex-col justify-between gap-1 shadow-2xs hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1 text-slate-800 font-bold font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        <MapPin size={11} className="text-teal-700 shrink-0" />
                        <span className="truncate max-w-[120px]" title={group.location}>{group.location}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                        {group.count} baris {group.batches.length > 1 ? `(${group.batches.length} batch)` : ''}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-1" title={group.item_name}>
                      {group.item_name}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-0.5 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Total Last Qty:</span>
                      <div className="flex items-center gap-1 font-mono font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                        <span>{group.totalLastQty.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-semibold text-emerald-700 uppercase">{group.uom}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              {viewMode === 'stock_opname' ? 'Tabel Stock Opname' : 'Tabel Inventory'} ({filteredData.length} item)
            </span>
            {selectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[10px] font-extrabold border border-teal-200">
                {selectedIds.length} dipilih
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Tampilkan:</span>
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

                <th className="px-2 py-1.5 text-center w-10">No</th>

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
                  <td colSpan={viewMode === 'stock_opname' ? 9 : 12} className="p-8 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-teal-800" />
                      <span>Memuat data inventory dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'stock_opname' ? 9 : 12} className="p-8 text-center text-slate-500">
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
                  const isSelected = selectedIds.includes(row.id_inventory);
                  const rowNumber = pageSize === 'ALL' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  
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
                      <td className="px-2 py-1.5 text-center" onClick={(e) => handleToggleSelectRow(row.id_inventory, e)}>
                        <div className="p-1 rounded text-slate-600 hover:text-teal-900 cursor-pointer">
                          {isSelected ? (
                            <CheckSquare size={14} className="text-teal-800" />
                          ) : (
                            <Square size={14} className="text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* No */}
                      <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-400">
                        {rowNumber}
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
                      <td className={`px-2.5 py-1.5 min-w-[100px] rounded-sm ${locationCellClass}`}>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className={`shrink-0 ${locationIconClass}`} />
                          <span>{row.location || '-'}</span>
                        </div>
                      </td>

                      {/* Item Name */}
                      <td className={`px-2.5 py-1.5 min-w-[180px] max-w-xs ${isAda ? 'bg-emerald-50/40' : isBeda ? 'bg-blue-50/40' : isTidak ? 'bg-amber-50/40' : ''}`}>
                        <div className={`text-xs truncate ${itemNameClass}`} title={row.item_name}>
                          {row.item_name || '-'}
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
                        className="px-2.5 py-1.5 max-w-xs min-w-[140px]" 
                        onClick={(e) => {
                          if (viewMode === 'stock_opname') {
                            e.stopPropagation();
                            setEditingNoteId(row.id_inventory);
                            setEditingNoteValue(row.note || '');
                          }
                        }}
                      >
                        {viewMode === 'stock_opname' && editingNoteId === row.id_inventory ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              onBlur={() => handleUpdateNote(row, editingNoteValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateNote(row, editingNoteValue);
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }}
                              className="px-1.5 py-0.5 text-xs rounded border border-teal-400 bg-white font-medium text-slate-800 outline-none w-full shadow-2xs"
                              placeholder="Tulis catatan..."
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateNote(row, editingNoteValue)}
                              className="p-1 rounded bg-teal-600 text-white hover:bg-teal-700 shrink-0"
                              title="Simpan Catatan"
                            >
                              <Check size={11} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className={`truncate ${viewMode === 'stock_opname' ? 'hover:text-teal-700 hover:underline cursor-text text-slate-600' : 'text-slate-500'}`}
                            title={row.note || (viewMode === 'stock_opname' ? 'Klik untuk tambah catatan' : '-')}
                          >
                            {row.note || (viewMode === 'stock_opname' ? <span className="text-slate-300 italic text-[11px]">+ Tambah Catatan</span> : '-')}
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
        onEdit={(item) => {
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

      <InventoryScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanResult={handleScanResult}
        inventoryList={inventoryList}
      />

    </div>
  );
}
