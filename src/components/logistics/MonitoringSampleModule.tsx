import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Package,
  Layers,
  Sparkles,
  Clock,
  User,
  Database,
  Eye,
  SlidersHorizontal,
  FileCheck2,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MonitoringSampleItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';

const CACHE_KEY = 'LOGISTIK_MONITORING_SAMPLE_CACHE';
const CLOUD_SETTING_KEY = 'monitoring_sample_items';

export const SAMPLE_HEADERS = [
  'STATUS',
  'TANGGAL',
  'NO. SPPJ',
  'ID',
  'DESKRIPSI',
  'QTY',
  'UNIT',
  'WMS',
  'SAP',
  'PIC',
  'NOTE'
];

export function MonitoringSampleModule() {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  // Data State
  const [items, setItems] = useState<MonitoringSampleItem[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [wmsFilter, setWmsFilter] = useState<string>('ALL');
  const [sapFilter, setSapFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof MonitoringSampleItem | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);

  // Modals
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<MonitoringSampleItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<MonitoringSampleItem>({
    status: 'OPEN',
    tanggal: new Date().toISOString().split('T')[0],
    no_sppj: '',
    id_barang: '',
    deskripsi: '',
    qty: 1,
    unit: 'CAR',
    wms: 'PENDING',
    sap: 'PENDING',
    pic: currentUser?.nama || currentUser?.username || 'Staff Logistik',
    note: ''
  });

  // Fetch Data from Cloud Database
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const cloudItems = await getAppSettingFromSupabase<MonitoringSampleItem[]>(CLOUD_SETTING_KEY, []);
      if (Array.isArray(cloudItems) && cloudItems.length > 0) {
        setItems(cloudItems);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cloudItems));
        } catch {}
      }
      setLastUpdated(new Date());
      if (isManual) {
        showToast('Berhasil menyinkronkan data sample dari database cloud!', 'success');
      }
    } catch (err: any) {
      console.error('Error fetching sample data:', err);
      setErrorMessage(err.message || 'Gagal memuat data dari database cloud.');
      if (isManual) {
        showToast('Gagal memuat data dari database cloud.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save dataset to Cloud Database
  const syncToCloud = async (newItems: MonitoringSampleItem[]): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result = await saveAppSettingToSupabase(
        CLOUD_SETTING_KEY,
        newItems,
        currentUser?.nama || currentUser?.username || 'Admin'
      );

      if (result.success) {
        showToast('Data berhasil disimpan ke database cloud!', 'success');
        return true;
      } else {
        showToast('Data tersimpan di browser.', 'warning');
        return false;
      }
    } catch (err: any) {
      console.warn('Gagal sync ke cloud:', err);
      showToast(`Data tersimpan lokal: ${err.message}`, 'warning');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Form (Add or Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.no_sppj.trim() && !formData.id_barang.trim()) {
      showToast('Mohon isi Nomor SPPJ atau ID Barang.', 'error');
      return;
    }

    let updatedList: MonitoringSampleItem[];

    if (formMode === 'add') {
      const newItem: MonitoringSampleItem = {
        ...formData,
        status: formData.status.trim() || 'OPEN',
        qty: formData.qty || 1,
        unit: formData.unit.trim().toUpperCase() || 'CAR'
      };
      updatedList = [newItem, ...items];
    } else {
      if (editingIndex === null || editingIndex < 0 || editingIndex >= items.length) return;
      updatedList = [...items];
      updatedList[editingIndex] = {
        ...formData,
        status: formData.status.trim() || 'OPEN',
        qty: formData.qty || 1,
        unit: formData.unit.trim().toUpperCase() || 'CAR'
      };
    }

    setItems(updatedList);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
    } catch {}

    setShowFormModal(false);
    await syncToCloud(updatedList);
  };

  // Handle Toggle Status (OPEN <-> CLOSE)
  const handleToggleStatus = async (index: number) => {
    const item = items[index];
    if (!item) return;

    const currentUpper = (item.status || '').trim().toUpperCase();
    const newStatus = currentUpper === 'CLOSE' ? 'OPEN' : 'CLOSE';

    const updatedList = [...items];
    updatedList[index] = {
      ...item,
      status: newStatus
    };

    setItems(updatedList);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
    } catch {}

    showToast(`Status SPPJ ${item.no_sppj || item.id_barang} diubah menjadi ${newStatus}.`, 'info');
    await syncToCloud(updatedList);
  };

  // Handle Delete Item
  const handleDeleteItem = async (index: number) => {
    const item = items[index];
    if (!item) return;

    if (!window.confirm(`Hapus baris sample NO. SPPJ "${item.no_sppj || item.id_barang}"?`)) {
      return;
    }

    const updatedList = items.filter((_, i) => i !== index);
    setItems(updatedList);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
    } catch {}

    showToast('Baris sample berhasil dihapus.', 'success');
    await syncToCloud(updatedList);
  };

  // Open Form for Add
  const handleOpenAdd = () => {
    setFormMode('add');
    setEditingIndex(null);
    setFormData({
      status: 'OPEN',
      tanggal: new Date().toISOString().split('T')[0],
      no_sppj: '',
      id_barang: '',
      deskripsi: '',
      qty: 1,
      unit: 'CAR',
      wms: 'PENDING',
      sap: 'PENDING',
      pic: currentUser?.nama || currentUser?.username || 'Staff Logistik',
      note: ''
    });
    setShowFormModal(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (index: number) => {
    const item = items[index];
    if (!item) return;

    setFormMode('edit');
    setEditingIndex(index);
    setFormData({ ...item });
    setShowFormModal(true);
  };

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Disalin: ${text}`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (items.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    try {
      const exportData = filteredItems.map((item, idx) => ({
        'NO': idx + 1,
        'STATUS': item.status,
        'TANGGAL': item.tanggal,
        'NO. SPPJ': item.no_sppj,
        'ID BARANG': item.id_barang,
        'DESKRIPSI': item.deskripsi,
        'QTY': item.qty,
        'UNIT': item.unit,
        'WMS': item.wms,
        'SAP': item.sap,
        'PIC': item.pic,
        'NOTE': item.note
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Auto width
      const colWidths = [
        { wch: 6 },
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
        { wch: 18 },
        { wch: 35 },
        { wch: 8 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 30 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Sample');
      const filename = `Monitoring_Pengambilan_Sample_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast(`Laporan Excel berhasil diunduh (${exportData.length} baris).`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Gagal mengekspor data ke Excel.', 'error');
    }
  };

  // Unique Units for filter
  const uniqueUnits = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.unit && i.unit.trim()) set.add(i.unit.trim().toUpperCase());
    });
    return Array.from(set);
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const itemStatus = (item.status || '').trim().toUpperCase();
        if (statusFilter === 'OPEN' && itemStatus !== 'OPEN') return false;
        if (statusFilter === 'CLOSE' && itemStatus !== 'CLOSE') return false;
        if (statusFilter === 'OTHER' && (itemStatus === 'OPEN' || itemStatus === 'CLOSE')) return false;
      }

      // WMS filter
      if (wmsFilter !== 'ALL') {
        const itemWms = (item.wms || '').trim().toUpperCase();
        if (wmsFilter === 'DONE' && !itemWms.includes('OK') && !itemWms.includes('DONE') && !itemWms.includes('CLOSE')) return false;
        if (wmsFilter === 'PENDING' && (itemWms.includes('OK') || itemWms.includes('DONE') || itemWms.includes('CLOSE'))) return false;
      }

      // SAP filter
      if (sapFilter !== 'ALL') {
        const itemSap = (item.sap || '').trim().toUpperCase();
        if (sapFilter === 'DONE' && !itemSap.includes('OK') && !itemSap.includes('DONE') && !itemSap.includes('CLOSE') && !itemSap.includes('POST')) return false;
        if (sapFilter === 'PENDING' && (itemSap.includes('OK') || itemSap.includes('DONE') || itemSap.includes('CLOSE') || itemSap.includes('POST'))) return false;
      }

      // Unit filter
      if (unitFilter !== 'ALL') {
        if ((item.unit || '').trim().toUpperCase() !== unitFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (item.no_sppj || '').toLowerCase().includes(q) ||
          (item.id_barang || '').toLowerCase().includes(q) ||
          (item.deskripsi || '').toLowerCase().includes(q) ||
          (item.pic || '').toLowerCase().includes(q) ||
          (item.wms || '').toLowerCase().includes(q) ||
          (item.sap || '').toLowerCase().includes(q) ||
          (item.note || '').toLowerCase().includes(q) ||
          (item.tanggal || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();

      if (sortField === 'qty') {
        const numA = Number(a.qty) || 0;
        const numB = Number(b.qty) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, statusFilter, wmsFilter, sapFilter, unitFilter, searchQuery, sortField, sortDirection]);

  // Pagination slice
  const paginatedItems = useMemo(() => {
    if (pageSize === 'ALL') return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(filteredItems.length / pageSize) || 1;

  // KPI Calculations
  const stats = useMemo(() => {
    let openCount = 0;
    let closeCount = 0;
    let totalQty = 0;
    let wmsPending = 0;
    let sapPending = 0;

    items.forEach(item => {
      const s = (item.status || '').trim().toUpperCase();
      if (s === 'OPEN') openCount++;
      else if (s === 'CLOSE') closeCount++;
      else openCount++;

      const q = Number(item.qty) || 0;
      totalQty += q;

      const w = (item.wms || '').trim().toUpperCase();
      if (!w.includes('OK') && !w.includes('DONE') && !w.includes('CLOSE')) {
        wmsPending++;
      }

      const sap = (item.sap || '').trim().toUpperCase();
      if (!sap.includes('OK') && !sap.includes('DONE') && !sap.includes('CLOSE') && !sap.includes('POST')) {
        sapPending++;
      }
    });

    return {
      total: items.length,
      open: openCount,
      close: closeCount,
      totalQty,
      wmsPending,
      sapPending
    };
  }, [items]);

  // Toggle sort
  const handleSort = (field: keyof MonitoringSampleItem) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').trim().toUpperCase();
    if (s === 'CLOSE' || s === 'DONE' || s === 'SELESAI') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
          <CheckCircle2 size={12} className="text-emerald-600" />
          CLOSE
        </span>
      );
    }
    if (s === 'OPEN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
          <Clock size={12} className="text-amber-600 animate-pulse" />
          OPEN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
        <Sparkles size={12} className="text-sky-600" />
        {status || 'DRAFT'}
      </span>
    );
  };

  const getProcessBadge = (val: string) => {
    const upper = (val || '').trim().toUpperCase();
    if (!upper || upper === '-' || upper === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Pending
        </span>
      );
    }
    if (upper.includes('OK') || upper.includes('DONE') || upper.includes('CLOSE') || upper.includes('POST')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check size={11} className="text-emerald-600" />
          {val}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-teal-700 via-cyan-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-teal-600/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
            <FlaskConical size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white m-0">
                Monitoring Pengambilan Sample
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-400/20 text-teal-200 border border-teal-400/40">
                Database Cloud
              </span>
            </div>
            <p className="text-xs text-teal-100/80 mt-1 max-w-2xl leading-relaxed">
              Database & pemantauan realtime pengambilan sample gudang (SPPJ, status proses WMS, SAP & PIC).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Muat ulang data dari database cloud"
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Menyinkronkan...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
            title="Unduh data dalam format Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 active:from-teal-500 active:to-emerald-500 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shadow-teal-900/30"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Tambah Sample</span>
          </button>
        </div>
      </div>

      {/* Error / Warning Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Peringatan Koneksi:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-400 hover:text-rose-700 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
            <Database size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight block truncate">
              Total Sample
            </span>
            <span className="text-lg font-black text-slate-800 leading-tight">
              {stats.total}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-tight block truncate">
              Status OPEN
            </span>
            <span className="text-lg font-black text-amber-800 leading-tight">
              {stats.open}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-tight block truncate">
              Status CLOSE
            </span>
            <span className="text-lg font-black text-emerald-800 leading-tight">
              {stats.close}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-tight block truncate">
              Total QTY
            </span>
            <span className="text-lg font-black text-blue-800 leading-tight">
              {stats.totalQty.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-tight block truncate">
              WMS Pending
            </span>
            <span className="text-lg font-black text-indigo-800 leading-tight">
              {stats.wmsPending}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
            <FileCheck2 size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-tight block truncate">
              SAP Pending
            </span>
            <span className="text-lg font-black text-purple-800 leading-tight">
              {stats.sapPending}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari NO. SPPJ, ID Barang, Deskripsi, PIC, WMS, SAP, atau Note..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            <button
              type="button"
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('OPEN'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'OPEN'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock size={12} />
              OPEN ({stats.open})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('CLOSE'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'CLOSE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 size={12} />
              CLOSE ({stats.close})
            </button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 text-slate-500 font-semibold mr-1">
            <SlidersHorizontal size={13} />
            <span>Filter:</span>
          </div>

          {/* WMS Filter */}
          <select
            value={wmsFilter}
            onChange={(e) => { setWmsFilter(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">WMS: Semua</option>
            <option value="DONE">WMS: Selesai / OK</option>
            <option value="PENDING">WMS: Pending / Proses</option>
          </select>

          {/* SAP Filter */}
          <select
            value={sapFilter}
            onChange={(e) => { setSapFilter(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">SAP: Semua</option>
            <option value="DONE">SAP: Selesai / OK</option>
            <option value="PENDING">SAP: Pending / Proses</option>
          </select>

          {/* Unit Filter */}
          {uniqueUnits.length > 0 && (
            <select
              value={unitFilter}
              onChange={(e) => { setUnitFilter(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Satuan: Semua</option>
              {uniqueUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}

          {/* Reset Filters */}
          {(statusFilter !== 'ALL' || wmsFilter !== 'ALL' || sapFilter !== 'ALL' || unitFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setWmsFilter('ALL');
                setSapFilter('ALL');
                setUnitFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer ml-auto"
            >
              <RotateCcw size={12} />
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-[11px] text-slate-400 font-medium">
            {lastUpdated && (
              <span>Update: {lastUpdated.toLocaleTimeString('id-ID')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        {/* Table Head Info */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              Tabel Monitoring Sample
            </span>
            <span className="text-slate-400 font-medium">
              (Menampilkan {paginatedItems.length} dari {filteredItems.length} baris)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="ALL">Semua</option>
            </select>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-200 select-none">
                <th className="py-3 px-3 w-12 text-center">No</th>
                
                {/* 1. STATUS */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>STATUS</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 2. TANGGAL */}
                <th
                  onClick={() => handleSort('tanggal')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>TANGGAL</span>
                    {sortField === 'tanggal' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 3. NO. SPPJ */}
                <th
                  onClick={() => handleSort('no_sppj')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>NO. SPPJ</span>
                    {sortField === 'no_sppj' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 4. ID */}
                <th
                  onClick={() => handleSort('id_barang')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ID BARANG</span>
                    {sortField === 'id_barang' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 5. DESKRIPSI */}
                <th
                  onClick={() => handleSort('deskripsi')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors min-w-[200px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>DESKRIPSI</span>
                    {sortField === 'deskripsi' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 6. QTY */}
                <th
                  onClick={() => handleSort('qty')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>QTY</span>
                    {sortField === 'qty' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* 7. UNIT */}
                <th className="py-3 px-3 text-center whitespace-nowrap">UNIT</th>

                {/* 8. WMS */}
                <th className="py-3 px-3 text-center whitespace-nowrap">WMS</th>

                {/* 9. SAP */}
                <th className="py-3 px-3 text-center whitespace-nowrap">SAP</th>

                {/* 10. PIC */}
                <th className="py-3 px-3 whitespace-nowrap">PIC</th>

                {/* 11. NOTE */}
                <th className="py-3 px-3 min-w-[150px]">NOTE</th>

                {/* Aksi */}
                <th className="py-3 px-3 text-center w-28 whitespace-nowrap">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin text-teal-600 mx-auto mb-2" />
                    <p className="font-semibold text-xs">Memuat data dari database cloud...</p>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center border border-teal-200">
                        <FlaskConical size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {items.length === 0
                          ? 'Belum ada data pengambilan sample'
                          : 'Tidak ada data yang sesuai filter / pencarian'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {items.length === 0
                          ? 'Klik tombol di bawah untuk menambahkan catatan pengambilan sample baru.'
                          : 'Coba ubah kata kunci pencarian atau reset filter yang dipilih.'}
                      </p>
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Plus size={15} />
                          <span>Tambah Sample Pertama</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                            setWmsFilter('ALL');
                            setSapFilter('ALL');
                            setUnitFilter('ALL');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Reset Semua Filter</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const actualIndex = items.findIndex(i => i === item);
                  const isClose = (item.status || '').trim().toUpperCase() === 'CLOSE';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-teal-50/40 transition-colors ${
                        isClose ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      {/* NO */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {pageSize === 'ALL' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* 1. STATUS */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(actualIndex)}
                          title={`Klik untuk ubah status ke ${isClose ? 'OPEN' : 'CLOSE'}`}
                          className="cursor-pointer transition-transform hover:scale-105 active:scale-95 text-left"
                        >
                          {getStatusBadge(item.status)}
                        </button>
                      </td>

                      {/* 2. TANGGAL */}
                      <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{item.tanggal || '-'}</span>
                        </div>
                      </td>

                      {/* 3. NO. SPPJ */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                          <span>{item.no_sppj || '-'}</span>
                          {item.no_sppj && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.no_sppj, `sppj-${idx}`)}
                              className="text-slate-400 hover:text-teal-600 p-0.5 rounded cursor-pointer"
                              title="Salin No SPPJ"
                            >
                              {copiedId === `sppj-${idx}` ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 4. ID BARANG */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-700">
                        <div className="flex items-center gap-1">
                          <span>{item.id_barang || '-'}</span>
                          {item.id_barang && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.id_barang, `id-${idx}`)}
                              className="text-slate-400 hover:text-teal-600 p-0.5 rounded cursor-pointer"
                              title="Salin ID Barang"
                            >
                              {copiedId === `id-${idx}` ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. DESKRIPSI */}
                      <td className="py-2.5 px-3 font-medium text-slate-800 text-xs">
                        <span className="line-clamp-2" title={item.deskripsi}>
                          {item.deskripsi || '-'}
                        </span>
                      </td>

                      {/* 6. QTY */}
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 text-xs whitespace-nowrap">
                        {item.qty || '0'}
                      </td>

                      {/* 7. UNIT */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.unit || 'CAR'}
                        </span>
                      </td>

                      {/* 8. WMS */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {getProcessBadge(item.wms)}
                      </td>

                      {/* 9. SAP */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {getProcessBadge(item.sap)}
                      </td>

                      {/* 10. PIC */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User size={12} className="text-slate-400" />
                          <span>{item.pic || '-'}</span>
                        </div>
                      </td>

                      {/* 11. NOTE */}
                      <td className="py-2.5 px-3 text-slate-500 text-xs">
                        <span className="line-clamp-2" title={item.note}>
                          {item.note || '-'}
                        </span>
                      </td>

                      {/* AKSI */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                            title="Lihat Detail"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(actualIndex)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(actualIndex)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Baris"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-500">
              Halaman <b>{currentPage}</b> dari <b>{totalPages}</b>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT SAMPLE */}
      {showFormModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-cyan-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  {formMode === 'add' ? <Plus size={20} /> : <Edit2 size={18} />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white m-0">
                    {formMode === 'add' ? 'Tambah Catatan Pengambilan Sample' : 'Edit Data Sample'}
                  </h3>
                  <p className="text-[11px] text-teal-100/80 m-0">
                    Data akan otomatis disimpan ke Database Cloud Terpusat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. STATUS */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    STATUS PROSES <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold text-slate-800"
                    required
                  >
                    <option value="OPEN">OPEN (Sedang Berjalan)</option>
                    <option value="CLOSE">CLOSE (Selesai)</option>
                    <option value="ON PROCESS">ON PROCESS (Dalam Pengerjaan)</option>
                    <option value="PENDING">PENDING (Menunggu)</option>
                  </select>
                </div>

                {/* 2. TANGGAL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TANGGAL TRANSAKSI / PROSES <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    required
                  />
                </div>

                {/* 3. NO. SPPJ */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NO. SPPJ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.no_sppj}
                    onChange={(e) => setFormData({ ...formData, no_sppj: e.target.value })}
                    placeholder="Contoh: SPPJ/2026/09/001"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                    required
                  />
                </div>

                {/* 4. ID BARANG */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID BARANG / SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.id_barang}
                    onChange={(e) => setFormData({ ...formData, id_barang: e.target.value })}
                    placeholder="Contoh: FG11026.218.0050.C"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* 5. DESKRIPSI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DESKRIPSI BARANG ATAU PEKERJAAN <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  placeholder="Nama barang lengkap atau keterangan pekerjaan sample..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 6. QTY */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    JUMLAH (QTY) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold"
                    required
                  />
                </div>

                {/* 7. UNIT */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SATUAN (UNIT) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value.toUpperCase() })}
                    placeholder="CAR / PCS"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold uppercase"
                    required
                  />
                </div>

                {/* 8. WMS */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    STATUS WMS
                  </label>
                  <input
                    type="text"
                    value={formData.wms}
                    onChange={(e) => setFormData({ ...formData, wms: e.target.value })}
                    placeholder="OK / PENDING / CLOSE"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 uppercase"
                  />
                </div>

                {/* 9. SAP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    STATUS SAP
                  </label>
                  <input
                    type="text"
                    value={formData.sap}
                    onChange={(e) => setFormData({ ...formData, sap: e.target.value })}
                    placeholder="POSTED / PENDING"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 uppercase"
                  />
                </div>
              </div>

              {/* 10. PIC */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIC (PERSON IN CHARGE) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pic}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  placeholder="Nama petugas penanggung jawab sample..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
                  required
                />
              </div>

              {/* 11. NOTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CATATAN / KETERANGAN TAMBAHAN (NOTE)
                </label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Catatan pengambilan sample, lokasi gudang, alasan pengambilan, nomor dokumen, dll..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>{formMode === 'add' ? 'Simpan Data Sample' : 'Perbarui Data'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL SAMPLE */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-cyan-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical size={20} />
                <h3 className="text-sm sm:text-base font-bold text-white m-0">
                  Detail Pengambilan Sample
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Status Proses:</span>
                <div>{getStatusBadge(selectedItem.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Tanggal:</span>
                  <span className="font-bold text-slate-800">{selectedItem.tanggal || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Nomor SPPJ:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.no_sppj || '-'}</span>
                </div>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-semibold block mb-0.5">ID Barang:</span>
                <span className="font-mono font-bold text-teal-800 text-sm">{selectedItem.id_barang || '-'}</span>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-semibold block mb-0.5">Deskripsi:</span>
                <span className="font-medium text-slate-800">{selectedItem.deskripsi || '-'}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Jumlah:</span>
                  <span className="font-black text-slate-900 text-sm">{selectedItem.qty || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Satuan:</span>
                  <span className="font-bold text-slate-700">{selectedItem.unit || 'CAR'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Status WMS:</span>
                  <div>{getProcessBadge(selectedItem.wms)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Status SAP:</span>
                  <div>{getProcessBadge(selectedItem.sap)}</div>
                </div>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-semibold block mb-0.5">Person in Charge (PIC):</span>
                <span className="font-bold text-slate-800">{selectedItem.pic || '-'}</span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">Catatan / Note:</span>
                <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium whitespace-pre-wrap">
                  {selectedItem.note || 'Tidak ada catatan tambahan.'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
