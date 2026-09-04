import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Database,
  Layers,
  Calendar,
  UserCheck,
  MapPin,
  Barcode,
  Package,
  ArrowUpDown,
  FileDown,
  Info,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Copy,
  Mic,
  MicOff,
  Radio,
  Send,
  Building2,
  Archive,
  QrCode,
  RotateCcw,
  Zap,
  Flame,
  ArrowRight,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Share2,
  CheckCheck,
  Target,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Globe,
  Settings,
  ExternalLink,
  Code,
  ClipboardPaste
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase, getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { CekFisikPemusnahanItem, PemusnahanItem, DataBarang } from '../../types';
import { getEdIsoDateString, normalizeToIsoDate } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

// Pilihan Tujuan Transfer Database Massal dari Cek Fisik
export interface BulkDestinationOption {
  id: string;
  name: string;
  tableName: string;
  idPrefix: string;
  idField: string;
  defaultSloc: string;
  defaultLocation: string;
  defaultLocationType: string;
  defaultQcCode: string;
  defaultDestinationCode: string;
  defaultStatus: string;
  defaultTujuan: string;
  defaultCategory: string;
  sourceStatusDefault: string;
  cacheKey: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export const BULK_DESTINATIONS_CEK_FISIK: BulkDestinationOption[] = [
  {
    id: 'pemusnahan_final',
    name: 'Pemusnahan Final (Disposal)',
    tableName: 'data_pemusnahan',
    idPrefix: 'PMS-',
    idField: 'id_pemusnahan',
    defaultSloc: '',
    defaultLocation: '',
    defaultLocationType: '',
    defaultQcCode: '',
    defaultDestinationCode: '',
    defaultStatus: '',
    defaultTujuan: 'Pemusnahan Limbah Terkontrol',
    defaultCategory: '',
    sourceStatusDefault: 'Terkirim ke Pemusnahan',
    cacheKey: 'pemusnahan_cache_v1',
    description: 'Tabel: public.data_pemusnahan - Karantina limbah / scrap / expired barang',
    colorClass: 'from-rose-600 to-red-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900 border-rose-300',
    borderColor: 'border-rose-500'
  },
  {
    id: 'reco',
    name: 'Reco (Permintaan Barang)',
    tableName: 'data_reco',
    idPrefix: 'REC-',
    idField: 'id_reco',
    defaultSloc: 'SL03',
    defaultLocation: 'WH-RECO-01',
    defaultLocationType: 'Floor',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-RECO',
    defaultStatus: 'Permintaan Reco',
    defaultTujuan: 'Permintaan Barang',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Reco',
    cacheKey: 'reco_cache_v1',
    description: 'Tabel: public.data_reco - Permintaan Barang (Reco)',
    colorClass: 'from-purple-600 to-indigo-800',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900 border-purple-300',
    borderColor: 'border-purple-500'
  },
  {
    id: 'repack',
    name: 'Repack',
    tableName: 'data_repack',
    idPrefix: 'RPK-',
    idField: 'id_repack',
    defaultSloc: 'SL02',
    defaultLocation: 'WH-REPACK-01',
    defaultLocationType: 'Staging',
    defaultQcCode: 'QC-REPACK',
    defaultDestinationCode: 'DST-REPACK',
    defaultStatus: 'Siap Repack',
    defaultTujuan: 'Repacking Produk',
    defaultCategory: 'Raw Material',
    sourceStatusDefault: 'Terkirim ke Repack',
    cacheKey: 'repack_cache_v1',
    description: 'Tabel: public.data_repack - Proses Repacking Barang',
    colorClass: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900 border-amber-300',
    borderColor: 'border-amber-500'
  }
];

interface CekFisikPemusnahanModuleProps {
  onNavigateToPemusnahanFinal?: () => void;
  onDataTransferred?: () => void;
}

export function CekFisikPemusnahanModule({ onNavigateToPemusnahanFinal, onDataTransferred }: CekFisikPemusnahanModuleProps) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

  // Primary Data State
  const [cekFisikList, setCekFisikList] = useState<CekFisikPemusnahanItem[]>([]);
  const [barangList, setBarangList] = useState<DataBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [qcFilter, setQcFilter] = useState<string>('ALL');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tujuanFilter, setTujuanFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [itemNameFilter, setItemNameFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof CekFisikPemusnahanItem>('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string>('pemusnahan_final');
  const [bulkSourceAction, setBulkSourceAction] = useState<'update_status' | 'delete' | 'keep'>('update_status');
  const [bulkSourceStatus, setBulkSourceStatus] = useState<string>('Cek');
  const [isBulkTransferring, setIsBulkTransferring] = useState(false);

  // Bulk Status Update Modal State
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusInput, setBulkStatusInput] = useState<string>('Cek');
  const [isUpdatingBulkStatus, setIsUpdatingBulkStatus] = useState(false);

  // Pagination & Display
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showGSheetModal, setShowGSheetModal] = useState(false);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<CekFisikPemusnahanItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CekFisikPemusnahanItem>>({});
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Autocomplete Master Barang
  const [barangSearchText, setBarangSearchText] = useState('');
  const [isBarangDropdownOpen, setIsBarangDropdownOpen] = useState(false);
  const barangSearchContainerRef = useRef<HTMLDivElement>(null);

  // Voice Recognition
  const [isListeningSearch, setIsListeningSearch] = useState(false);
  const [speechFeedbackSearch, setSpeechFeedbackSearch] = useState<string | null>(null);
  const searchRecognitionRef = useRef<any>(null);

  const [isListeningBarang, setIsListeningBarang] = useState(false);
  const [speechFeedbackBarang, setSpeechFeedbackBarang] = useState<string | null>(null);
  const barangRecognitionRef = useRef<any>(null);

  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Excel Import States
  const [parsedExcelRows, setParsedExcelRows] = useState<CekFisikPemusnahanItem[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelUploadTujuan, setExcelUploadTujuan] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ isUploading: boolean; current: number; total: number; percentage: number; statusText: string }>({
    isUploading: false,
    current: 0,
    total: 0,
    percentage: 0,
    statusText: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy-Paste from Excel State
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedRawText, setPastedRawText] = useState('');
  const [pastedRows, setPastedRows] = useState<CekFisikPemusnahanItem[]>([]);
  const [previewColumnView, setPreviewColumnView] = useState<'all_db' | 'compact'>('all_db');
  const [pasteDefaultTujuan, setPasteDefaultTujuan] = useState<string>('');
  const [isSavingPastedRows, setIsSavingPastedRows] = useState(false);
  const [pasteSaveProgress, setPasteSaveProgress] = useState<{ current: number; total: number; percentage: number; statusText: string }>({
    current: 0,
    total: 0,
    percentage: 0,
    statusText: ''
  });

  // Google Sheets Webhook Sync Config
  const [gSheetConfig, setGSheetConfig] = useState(() => {
    const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
    const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';
    try {
      const saved = localStorage.getItem('CEK_FISIK_PEMUSNAHAN_GSHEET_CONFIG');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          webhookUrl: parsed.webhookUrl || defaultEnvUrl,
          spreadsheetId: parsed.spreadsheetId || defaultEnvSpreadsheetId,
          sheetName: parsed.sheetName || 'cek_fisik_pemusnahan',
          secretToken: parsed.secretToken || '',
          mode: parsed.mode || 'append'
        };
      }
    } catch {}
    return {
      webhookUrl: defaultEnvUrl,
      spreadsheetId: defaultEnvSpreadsheetId,
      sheetName: 'cek_fisik_pemusnahan',
      secretToken: '',
      mode: 'append'
    };
  });
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);

  // Generate QR Code dynamically when LPN / Serial Number changes
  useEffect(() => {
    const rawVal = formData.lpn_serial_number?.trim();
    if (!rawVal || rawVal === '-') {
      setQrCodeDataUrl('');
      return;
    }
    QRCode.toDataURL(rawVal, { width: 256, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } })
      .then((url: string) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [formData.lpn_serial_number]);

  // Load Master Barang Cache
  const loadMasterBarangLocally = useCallback(() => {
    let loaded: DataBarang[] = [];
    try {
      const keys = ['ckb_master_data_barang_cache', 'ckb_data_barang', 'master_barang'];
      for (const k of keys) {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) loaded = [...loaded, ...parsed];
        }
      }
    } catch (e) {
      console.warn('Error reading local master barang cache:', e);
    }
    const map = new Map<string, DataBarang>();
    loaded.forEach(b => {
      if (b.item_code) map.set(b.item_code.trim().toLowerCase(), b);
    });
    return Array.from(map.values());
  }, []);

  // Fetch Master Data Barang
  const fetchMasterData = useCallback(async () => {
    const local = loadMasterBarangLocally();
    if (local.length > 0) setBarangList(local);
    if (!isSupabaseConfigured) return;
    try {
      const resBarangData = await fetchAllRowsFromSupabase<DataBarang>('data_barang', { orderBy: 'item_name', ascending: true });
      if (resBarangData && resBarangData.length > 0) {
        const mergedMap = new Map<string, DataBarang>();
        local.forEach(b => { if (b.item_code) mergedMap.set(b.item_code.trim().toLowerCase(), b); });
        resBarangData.forEach((b: DataBarang) => { if (b.item_code) mergedMap.set(b.item_code.trim().toLowerCase(), b); });
        const finalBarang = Array.from(mergedMap.values());
        setBarangList(finalBarang);
        try { localStorage.setItem('ckb_master_data_barang_cache', JSON.stringify(finalBarang)); } catch {}
      }
    } catch (err) {
      console.warn('Error fetching master barang:', err);
    }
  }, [loadMasterBarangLocally]);

  // Fetch data_cek_fisik_pemusnahan from Supabase
  const fetchCekFisikData = useCallback(async () => {
    setIsLoading(true);
    setLastSupabaseError(null);
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchAllRowsFromSupabase<CekFisikPemusnahanItem>('data_cek_fisik_pemusnahan', {
        orderBy: 'created_at',
        ascending: false
      });
      if (Array.isArray(data)) {
        setCekFisikList(data);
        if (data.length > 0) {
          localStorage.setItem('cek_fisik_pemusnahan_cache_v1', JSON.stringify(data));
        } else {
          localStorage.removeItem('cek_fisik_pemusnahan_cache_v1');
        }
      }
    } catch (err: any) {
      console.error('Error fetching data_cek_fisik_pemusnahan:', err);
      // If table doesn't exist yet, show helpful prompt
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        setLastSupabaseError('Tabel data_cek_fisik_pemusnahan belum dibuat di database. Klik tombol "SQL Schema" di atas untuk membuat tabel secara otomatis.');
      } else {
        setLastSupabaseError(err?.message || 'Gagal terhubung ke tabel data_cek_fisik_pemusnahan');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Realtime Sync
  useEffect(() => {
    const cached = localStorage.getItem('cek_fisik_pemusnahan_cache_v1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setCekFisikList(parsed);
      } catch (e) {
        console.error('Error loading cek fisik cache:', e);
      }
    }
    fetchMasterData();
    fetchCekFisikData();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('cek_fisik_pemusnahan_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_cek_fisik_pemusnahan' }, () => {
          fetchCekFisikData();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchMasterData, fetchCekFisikData]);

  // Save to localStorage whenever list changes
  useEffect(() => {
    if (cekFisikList.length > 0) {
      try { localStorage.setItem('cek_fisik_pemusnahan_cache_v1', JSON.stringify(cekFisikList)); } catch {}
    } else {
      try { localStorage.removeItem('cek_fisik_pemusnahan_cache_v1'); } catch {}
    }
  }, [cekFisikList]);

  // Filter & Unique options
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    cekFisikList.forEach(item => { if (item.category && item.category !== '-') set.add(item.category.trim()); });
    return Array.from(set).sort();
  }, [cekFisikList]);

  const uniqueQcCodes = useMemo(() => {
    const set = new Set<string>();
    cekFisikList.forEach(item => { if (item.qc_code && item.qc_code !== '-') set.add(item.qc_code.trim()); });
    return Array.from(set).sort();
  }, [cekFisikList]);

  const uniqueSlocs = useMemo(() => {
    const set = new Set<string>();
    cekFisikList.forEach(item => { if (item.sloc && item.sloc !== '-') set.add(item.sloc.trim()); });
    return Array.from(set).sort();
  }, [cekFisikList]);

  const uniqueStatuses = useMemo(() => {
    return ['Cek', 'Ada', 'Beda', 'Tidak'];
  }, []);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    cekFisikList.forEach(item => {
      if (item.location && item.location.trim() !== '' && item.location !== '-') {
        set.add(item.location.trim());
      }
    });
    return Array.from(set).sort();
  }, [cekFisikList]);

  const isLocationFiltered = Boolean(locationFilter.trim() && locationFilter.trim().toUpperCase() !== 'ALL');

  const uniqueTujuanList = useMemo(() => {
    const set = new Set<string>();
    cekFisikList.forEach(item => { if (item.tujuan && item.tujuan !== '-') set.add(item.tujuan.trim()); });
    return Array.from(set).sort();
  }, [cekFisikList]);

  // Metrics
  const metrics = useMemo(() => {
    let totalFirstQty = 0;
    let totalLastQty = 0;
    let totalConvertQty = 0;
    let cekCount = 0;
    let adaCount = 0;
    let bedaCount = 0;
    let tidakCount = 0;
    const uniqueItems = new Set<string>();

    cekFisikList.forEach(item => {
      totalFirstQty += Number(item.first_qty) || 0;
      totalLastQty += Number(item.last_qty) || 0;
      totalConvertQty += Number(item.qty_convert) || 0;
      if (item.item_code) uniqueItems.add(item.item_code);
      const st = (item.status || '').trim();
      if (st === 'Ada') adaCount++;
      else if (st === 'Beda') bedaCount++;
      else if (st === 'Tidak') tidakCount++;
      else cekCount++;
    });

    return {
      totalRows: cekFisikList.length,
      totalFirstQty,
      totalLastQty,
      totalConvertQty,
      uniqueSkuCount: uniqueItems.size,
      cekCount,
      adaCount,
      bedaCount,
      tidakCount
    };
  }, [cekFisikList]);

  // Filtered and Sorted list
  const filteredCekFisik = useMemo(() => {
    return cekFisikList.filter(item => {
      if (categoryFilter !== 'ALL' && (item.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (qcFilter !== 'ALL' && (item.qc_code || '').toLowerCase() !== qcFilter.toLowerCase()) return false;
      if (slocFilter !== 'ALL' && (item.sloc || '').toLowerCase() !== slocFilter.toLowerCase()) return false;
      if (statusFilter !== 'ALL') {
        const st = (item.status || '').trim();
        const normSt = st === 'Ada' ? 'Ada' : st === 'Beda' ? 'Beda' : st === 'Tidak' ? 'Tidak' : 'Cek';
        if (normSt.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (tujuanFilter !== 'ALL' && (item.tujuan || '').toLowerCase() !== tujuanFilter.toLowerCase()) return false;
      if (isLocationFiltered) {
        const locQ = locationFilter.trim().toLowerCase();
        if (!(item.location || '').toLowerCase().includes(locQ)) return false;
      }
      if (itemNameFilter && !(item.item_name || '').toLowerCase().includes(itemNameFilter.toLowerCase()) && !(item.item_code || '').toLowerCase().includes(itemNameFilter.toLowerCase())) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${item.id_cek_fisik} ${item.item_code} ${item.item_name} ${item.location || ''} ${item.batch} ${item.lpn_serial_number} ${item.status} ${item.tujuan} ${item.note}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [cekFisikList, categoryFilter, qcFilter, slocFilter, statusFilter, tujuanFilter, locationFilter, itemNameFilter, searchQuery, sortField, sortOrder]);

  const handleSortColumn = (field: keyof CekFisikPemusnahanItem) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Pagination
  const paginatedList = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredCekFisik;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCekFisik.slice(start, start + rowsPerPage);
  }, [filteredCekFisik, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === 'ALL' ? 1 : Math.ceil(filteredCekFisik.length / (rowsPerPage as number));

  // Selection handlers
  const handleSelectAllCurrentPage = () => {
    const pageIds = paginatedList.map(item => item.id_cek_fisik);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredCekFisik.map(item => item.id_cek_fisik);
    setSelectedIds(allIds);
    showToast('Semua Dipilih', `${allIds.length} item terpilih untuk operasi massal`, 'info');
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Open Form Modal
  const handleOpenAddModal = () => {
    const nowIso = new Date().toISOString();
    const newId = `CKF-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      id_cek_fisik: newId,
      tujuan: 'Check Fisik Pemusnahan',
      item_code: '',
      item_name: '',
      category: '',
      location: '',
      location_type: '',
      first_qty: 0,
      last_qty: 0,
      uom: 'CTN',
      qty_convert: 0,
      uom_convert: 'PCS',
      lpn_serial_number: '-',
      batch: '-',
      vendor_batch: '-',
      sloc: '',
      expired_date: nowIso.slice(0, 10),
      destination_code: '',
      qc_code: '',
      user_tally: currentUser?.nama || '',
      shelf_life: 'Expired',
      source: 'Retur Customer',
      user_input: currentUser?.nama || 'QA Officer',
      status: 'Cek',
      note: ''
    });
    setBarangSearchText('');
    setIsEditMode(false);
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: CekFisikPemusnahanItem) => {
    setSelectedItem(item);
    setFormData({ ...item });
    setBarangSearchText(`${item.item_code} - ${item.item_name}`);
    setIsEditMode(true);
    setShowFormModal(true);
  };

  const handleSelectMasterBarang = (barang: DataBarang) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        item_code: barang.item_code,
        item_name: barang.item_name,
        category: barang.category || prev.category || 'Damaged',
        uom: barang.uom || prev.uom || 'CTN'
      };
      if (prev.batch && prev.batch !== '-') {
        const autoCalc = getEdIsoDateString(barang.item_code, barang.item_name, prev.batch);
        if (autoCalc && autoCalc.isoDate) {
          updated.expired_date = autoCalc.isoDate;
          updated.shelf_life = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
        }
      }
      return updated;
    });
    setBarangSearchText(`${barang.item_code} - ${barang.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  // Save Form Data
  const handleSaveFormData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_code || !formData.item_name) {
      showToast('Data Tidak Lengkap', 'Item Code dan Item Name wajib diisi!', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const finalItem: CekFisikPemusnahanItem = {
      id_cek_fisik: formData.id_cek_fisik || `CKF-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      tujuan: formData.tujuan || 'Check Fisik Pemusnahan',
      item_code: formData.item_code.trim(),
      item_name: formData.item_name.trim(),
      category: formData.category || '',
      location: formData.location || '',
      location_type: formData.location_type || '',
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || 0,
      uom: formData.uom || 'CTN',
      qty_convert: Number(formData.qty_convert) || 0,
      uom_convert: formData.uom_convert || 'PCS',
      lpn_serial_number: formData.lpn_serial_number || '-',
      batch: formData.batch || '-',
      vendor_batch: formData.vendor_batch || '-',
      sloc: formData.sloc || '',
      expired_date: normalizeToIsoDate(formData.expired_date) || (formData.expired_date && formData.expired_date !== '-' ? formData.expired_date : null as any),
      destination_code: formData.destination_code || '',
      qc_code: formData.qc_code || '',
      user_tally: formData.user_tally || currentUser?.nama || '',
      shelf_life: formData.shelf_life || 'Expired',
      source: formData.source || 'Retur Customer',
      user_input: currentUser?.nama || 'QA Officer',
      tanggal_update: nowIso,
      status: formData.status === 'Ada' ? 'Ada' : formData.status === 'Beda' ? 'Beda' : formData.status === 'Tidak' ? 'Tidak' : 'Cek',
      note: formData.note || '',
      created_at: isEditMode && selectedItem?.created_at ? selectedItem.created_at : nowIso,
      updated_at: nowIso
    };

    if (isEditMode) {
      setCekFisikList(prev => prev.map(item => item.id_cek_fisik === finalItem.id_cek_fisik ? finalItem : item));
      showToast('Data Diperbarui', `Data cek fisik ${finalItem.id_cek_fisik} berhasil diperbarui`, 'success');
    } else {
      setCekFisikList(prev => [finalItem, ...prev]);
      showToast('Data Ditambahkan', `Data cek fisik ${finalItem.id_cek_fisik} berhasil disimpan`, 'success');
    }

    setShowFormModal(false);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('data_cek_fisik_pemusnahan').upsert(finalItem, { onConflict: 'id_cek_fisik' });
        if (error) {
          console.warn('Upsert fallback update:', error);
          await supabase.from('data_cek_fisik_pemusnahan').update(finalItem).eq('id_cek_fisik', finalItem.id_cek_fisik);
        }
      } catch (err: any) {
        console.error('Error saving to Supabase data_cek_fisik_pemusnahan:', err);
      }
    }
  };

  // Direct Inline Status Update (Ada / Beda / Tidak)
  const handleUpdateStatusInline = async (id: string, newStatus: string) => {
    const nowIso = new Date().toISOString();
    setCekFisikList(prev => prev.map(item => item.id_cek_fisik === id ? { ...item, status: newStatus, tanggal_update: nowIso, updated_at: nowIso } : item));

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('data_cek_fisik_pemusnahan')
          .update({ status: newStatus, tanggal_update: nowIso, updated_at: nowIso })
          .eq('id_cek_fisik', id);
      } catch (e) {
        console.error('Error updating status inline:', e);
      }
    }
  };

  // Bulk Status Update
  const handleExecuteBulkStatusUpdate = async () => {
    if (selectedIds.length === 0) {
      showToast('Pilih Data', 'Pilih minimal satu baris data untuk mengubah status', 'warning');
      return;
    }

    setIsUpdatingBulkStatus(true);
    const nowIso = new Date().toISOString();

    setCekFisikList(prev => prev.map(item => {
      if (selectedIds.includes(item.id_cek_fisik)) {
        return { ...item, status: bulkStatusInput, tanggal_update: nowIso, updated_at: nowIso };
      }
      return item;
    }));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_cek_fisik_pemusnahan')
          .update({ status: bulkStatusInput, tanggal_update: nowIso, updated_at: nowIso })
          .in('id_cek_fisik', selectedIds);
        if (error) console.error('Error updating bulk status in Supabase:', error);
      } catch (e) {
        console.error('Supabase bulk status error:', e);
      }
    }

    setIsUpdatingBulkStatus(false);
    setShowBulkStatusModal(false);
    showToast('Status Diperbarui', `Status ${selectedIds.length} item berhasil diubah menjadi "${bulkStatusInput}"`, 'success');
  };

  // =========================================================================
  // LOGIKA PINDAH MASSAL (BULK TRANSFER) KE DATA PEMUSNAHAN / RECO / REPACK
  // SAMA PERSIS 100% DENGAN LOGIKA TRANSFER PENYIAPAN MODULE
  // =========================================================================
  const handleExecuteBulkTransfer = async () => {
    if (selectedIds.length === 0) {
      showToast('Data Belum Dipilih', 'Pilih minimal satu data cek fisik untuk dipindahkan', 'warning');
      return;
    }

    const targetConfig = BULK_DESTINATIONS_CEK_FISIK.find(d => d.id === selectedDestination);
    if (!targetConfig) {
      showToast('Tujuan Tidak Valid', 'Pilih tabel tujuan transfer yang valid', 'warning');
      return;
    }

    const selectedItems = cekFisikList.filter(item => selectedIds.includes(item.id_cek_fisik));
    if (selectedItems.length === 0) {
      showToast('Data Tidak Ditemukan', 'Item yang dipilih tidak ditemukan dalam daftar aktif', 'warning');
      return;
    }

    setIsBulkTransferring(true);
    const nowIso = new Date().toISOString();

    try {
      // 1. Transform item dari CekFisik ke format tabel tujuan (misal: data_pemusnahan)
      const targetPayloads = selectedItems.map((item, index) => {
        const targetId = `${targetConfig.idPrefix}${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}-${String(index + 1).padStart(3, '0')}`;
        
        // Kolom Category, Location, Location Type, SLOC, Destination Code, QC Code, User Tally
        // Harus diisi sesuai data awal di data cek fisik (penyiapan pemusnahan), JANGAN diisi mock data seperti Finished Good, WH-REJECT-01, Quarantine, SL99, INCINERATOR, QC-REJECT
        const cleanVal = (val?: string) => (val && val.trim() !== '' && val.trim() !== '-') ? val.trim() : '';
        const isPemusnahanFinal = targetConfig.id === 'pemusnahan_final' || targetConfig.tableName === 'data_pemusnahan';

        const resolvedCategory = cleanVal(item.category) || (isPemusnahanFinal ? '' : (targetConfig.defaultCategory || ''));
        const resolvedLocation = cleanVal(item.location) || (isPemusnahanFinal ? '' : (targetConfig.defaultLocation || ''));
        const resolvedLocationType = cleanVal(item.location_type) || (isPemusnahanFinal ? '' : (targetConfig.defaultLocationType || ''));
        const resolvedSloc = cleanVal(item.sloc) || (isPemusnahanFinal ? '' : (targetConfig.defaultSloc || ''));
        const resolvedDestinationCode = cleanVal(item.destination_code) || (isPemusnahanFinal ? '' : (targetConfig.defaultDestinationCode || ''));
        const resolvedQcCode = cleanVal(item.qc_code) || (isPemusnahanFinal ? '' : (targetConfig.defaultQcCode || ''));
        const resolvedUserTally = cleanVal(item.user_tally) || (currentUser?.nama || '');

        return {
          [targetConfig.idField]: targetId,
          tujuan: item.tujuan || targetConfig.defaultTujuan,
          item_code: item.item_code,
          item_name: item.item_name,
          category: resolvedCategory,
          location: resolvedLocation,
          location_type: resolvedLocationType,
          first_qty: Number(item.first_qty) || 0,
          last_qty: Number(item.last_qty) || 0,
          uom: item.uom || 'CTN',
          qty_convert: Number(item.qty_convert) || 0,
          uom_convert: item.uom_convert || 'PCS',
          lpn_serial_number: item.lpn_serial_number || '-',
          batch: item.batch || '-',
          vendor_batch: item.vendor_batch || '-',
          sloc: resolvedSloc,
          expired_date: normalizeToIsoDate(item.expired_date) || (item.expired_date && item.expired_date !== '-' ? item.expired_date : null),
          destination_code: resolvedDestinationCode,
          qc_code: resolvedQcCode,
          user_tally: resolvedUserTally,
          shelf_life: item.shelf_life || 'Expired',
          source: `Cek Fisik (${item.id_cek_fisik})`,
          user_input: currentUser?.nama || 'QA Officer',
          tanggal_update: nowIso,
          status: (item.status && item.status.trim() !== '' && item.status.trim() !== '-') ? item.status : (targetConfig.defaultStatus || ''),
          note: item.note ? `${item.note} [Dari Cek Fisik: ${item.id_cek_fisik}]` : `Ditransfer dari Cek Fisik: ${item.id_cek_fisik}`,
          created_at: nowIso,
          updated_at: nowIso
        };
      });

      // 2. Insert ke tabel tujuan di Supabase
      if (isSupabaseConfigured) {
        const batchSize = 50;
        for (let i = 0; i < targetPayloads.length; i += batchSize) {
          const chunk = targetPayloads.slice(i, i + batchSize);
          const { error } = await supabase.from(targetConfig.tableName).upsert(chunk as any, { onConflict: targetConfig.idField });
          if (error) {
            console.error(`Error batch transferring to ${targetConfig.tableName}:`, error);
          }
        }
      }

      // 3. Update cache local storage untuk target table (misal: pemusnahan_cache_v1)
      try {
        const cachedTarget = localStorage.getItem(targetConfig.cacheKey);
        const targetList = cachedTarget ? JSON.parse(cachedTarget) : [];
        const mergedTargetList = [...targetPayloads, ...targetList.filter((x: any) => !targetPayloads.some(p => p[targetConfig.idField] === x[targetConfig.idField]))];
        localStorage.setItem(targetConfig.cacheKey, JSON.stringify(mergedTargetList));
      } catch (e) {
        console.warn('Error updating local target cache:', e);
      }

      // 4. Update source status atau delete source
      if (bulkSourceAction === 'update_status') {
        const newStatus = bulkSourceStatus || targetConfig.sourceStatusDefault;
        setCekFisikList(prev => prev.map(p => selectedIds.includes(p.id_cek_fisik) ? { ...p, status: newStatus, updated_at: nowIso } : p));
        if (isSupabaseConfigured) {
          await supabase.from('data_cek_fisik_pemusnahan').update({ status: newStatus, updated_at: nowIso }).in('id_cek_fisik', selectedIds);
        }
      } else if (bulkSourceAction === 'delete') {
        setCekFisikList(prev => prev.filter(p => !selectedIds.includes(p.id_cek_fisik)));
        if (isSupabaseConfigured) {
          await supabase.from('data_cek_fisik_pemusnahan').delete().in('id_cek_fisik', selectedIds);
        }
      }

      showToast('Pindah Data Massal Berhasil!', `${targetPayloads.length} item berhasil dipindahkan ke ${targetConfig.name}`, 'success');
      setSelectedIds([]);
      setShowBulkTransferModal(false);

      if (onDataTransferred) onDataTransferred();
    } catch (err: any) {
      console.error('Bulk transfer failed:', err);
      showToast('Gagal Pindah Data', err?.message || 'Terjadi kesalahan saat memproses transfer massal', 'danger');
    } finally {
      setIsBulkTransferring(false);
    }
  };

  // Single Delete Handler
  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    const idToDelete = selectedItem.id_cek_fisik;
    const itemName = selectedItem.item_name || 'Item';

    setCekFisikList(prev => prev.filter(item => item.id_cek_fisik !== idToDelete));
    setSelectedIds(prev => prev.filter(id => id !== idToDelete));
    setShowDeleteModal(false);
    setShowDetailModal(false);
    setShowFormModal(false);
    showToast('Terhapus', `Data Cek Fisik ${idToDelete} (${itemName}) berhasil dihapus`, 'info');

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_cek_fisik_pemusnahan')
          .delete()
          .eq('id_cek_fisik', idToDelete);

        if (error) {
          console.error('Error deleting from data_cek_fisik_pemusnahan:', error);
          showToast('Error Database', error.message, 'danger');
        }
      } catch (err: any) {
        console.error('Database delete error:', err);
      }
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus massal hanya dapat dilakukan oleh Admin!', 'danger');
      return;
    }
    if (selectedIds.length === 0) {
      showToast('Pilih Data', 'Pilih minimal satu data untuk dihapus', 'warning');
      return;
    }

    const count = selectedIds.length;
    showConfirm({
      title: 'Hapus Massal Data Cek Fisik',
      message: `Apakah Anda yakin ingin menghapus ${count} data cek fisik terpilih secara permanen?`,
      confirmText: `Ya, Hapus ${count} Data`,
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const idsToDelete = [...selectedIds];
        setCekFisikList(prev => prev.filter(item => !idsToDelete.includes(item.id_cek_fisik)));
        setSelectedIds([]);

        if (isSupabaseConfigured) {
          try {
            await supabase.from('data_cek_fisik_pemusnahan').delete().in('id_cek_fisik', idsToDelete);
          } catch (e) {
            console.error('Error deleting from Supabase:', e);
          }
        }
        showToast('Hapus Massal Sukses', `${count} data cek fisik berhasil dihapus`, 'success');
      }
    });
  };

  // Export to Excel
  const exportDataToExcel = () => {
    if (filteredCekFisik.length === 0) {
      showToast('Data Kosong', 'Tidak ada data cek fisik yang memenuhi filter untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredCekFisik.map((item, idx) => ({
      'No': idx + 1,
      'ID Cek Fisik': item.id_cek_fisik || '',
      'Status': item.status || '',
      'Item Code': item.item_code || '',
      'Item Name': item.item_name || '',
      'Category': item.category || '',
      'Location': item.location || '',
      'Location Type': item.location_type || '',
      'First Qty': item.first_qty ?? 0,
      'Last Qty': item.last_qty ?? 0,
      'UOM': item.uom || '',
      'Qty Convert': item.qty_convert ?? 0,
      'UOM Convert': item.uom_convert || '',
      'LPN/Serial Number': item.lpn_serial_number || '',
      'Batch': item.batch || '',
      'Vendor Batch': item.vendor_batch || '',
      'SLOC': item.sloc || '',
      'Expired Date': item.expired_date || '',
      'Destination Code': item.destination_code || '',
      'QC Code': item.qc_code || '',
      'User Tally': item.user_tally || '',
      'Shelf Life': item.shelf_life || '',
      'Source / Asal': item.source || '',
      'Tujuan': item.tujuan || '',
      'User Input': item.user_input || '',
      'Tanggal Update': item.tanggal_update ? new Date(item.tanggal_update).toLocaleString('id-ID') : '',
      'Catatan': item.note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Cek_Fisik_Pemusnahan');
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Cek_Fisik_Pemusnahan_${timestamp}.xlsx`);
    showToast('Ekspor Berhasil', `${exportRows.length} baris data berhasil diekspor ke Excel`, 'success');
  };

  // Download Excel Template
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Item Code': '21104501',
        'Item Name': 'KINO SAMANTHA HAIR OIL 50ML',
        'Category': 'Damaged',
        'Location': 'WH-REJECT-01',
        'Location Type': 'Quarantine',
        'First Qty': 10,
        'Last Qty': 10,
        'Uom': 'CTN',
        'Qty Convert': 120,
        'Uom Convert': 'PCS',
        'LPN/Serial Number': 'LPN-CF-001',
        'Batch': 'L911346N',
        'Vendor Batch': 'VB-911',
        'SLOC': 'SL99',
        'Expired Date': '2027-11-20',
        'Destination Code': 'INCINERATOR',
        'QC Code': 'QC-REJECT',
        'User Tally': 'Tally QC',
        'Shelf Life': 'Expired',
        'Source': 'Retur Customer',
        'Tujuan': 'Check Fisik Pemusnahan',
        'Status': 'Siap Dimusnahkan',
        'Note': 'Hasil sortir check fisik gudang reject'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 16 }, { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 },
      { wch: 24 }, { wch: 18 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Cek_Fisik');
    XLSX.writeFile(wb, 'Template_Upload_Cek_Fisik_Pemusnahan.xlsx');
    showToast('Template Terunduh', 'Template Excel Cek Fisik siap digunakan', 'success');
  };

  // =========================================================================
  // LOGIKA TAMBAH CEK FISIK / PASTE DARI EXCEL (PERSIS SEPERTI PENYIAPAN)
  // =========================================================================

  const handleOpenPasteModal = () => {
    setPastedRawText('');
    setPastedRows([]);
    setPasteDefaultTujuan('');
    setPreviewColumnView('all_db');
    setShowPasteModal(true);
  };

  const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const fieldSynonyms: { [colKey in keyof CekFisikPemusnahanItem | 'no']?: string[] } = {
    id_cek_fisik: ['idcekfisik', 'id_cek_fisik', 'kodecekfisik', 'nocekfisik', 'idtransaksi', 'idpemusnahan', 'kodecek', 'id', 'idpenyiapan', 'idreco', 'idrepack'],
    status: ['status', 'statuscekfisik', 'status_cekfisik', 'statusbarang', 'st', 'kondisibarang', 'kondisi', 'qcstatus', 'statusqc'],
    location: ['location', 'lokasi', 'rak', 'bin', 'loc', 'lokasirak', 'posisi', 'tempat', 'nomorrak', 'storageloc', 'storagelocation', 'storage_location'],
    location_type: ['locationtype', 'location_type', 'tipelokasi', 'tipe_lokasi', 'jenislokasi', 'loctype', 'tipe', 'type'],
    item_code: ['itemcode', 'item_code', 'kodesku', 'kodebarang', 'kode_barang', 'sku', 'kode', 'code', 'item', 'kodeitem', 'kode_item', 'material', 'kodeproduk', 'productcode', 'partnumber', 'materialnumber', 'material_number'],
    item_name: ['itemname', 'item_name', 'namabarang', 'nama_barang', 'namaproduk', 'deskripsibarang', 'namasku', 'deskripsi', 'nama', 'itemdesc', 'description', 'namaitem', 'productname', 'itemdescription', 'deskripsi_barang'],
    last_qty: ['lastqty', 'last_qty', 'qty', 'qtyakhir', 'qty_akhir', 'qtycekfisik', 'jumlah', 'kuantitas', 'qtyctn', 'totalqty', 'qtyaktual', 'actualqty', 'qtyfisik', 'qtyreal', 'qty_fisik', 'qty_real', 'qty_aktual'],
    first_qty: ['firstqty', 'first_qty', 'qtyawal', 'qty_awal', 'poqty', 'qtysj', 'stokawal', 'qtyorder', 'qtyplan', 'jumlahawal', 'po_qty', 'qty_sj', 'stok_awal'],
    qty_convert: ['qtyconvert', 'qty_convert', 'qtykonversi', 'qty_konversi', 'qtypcs', 'pcs', 'konversi', 'qtyconv', 'totalpcs', 'jumlahpcs', 'total_pcs', 'jumlah_pcs'],
    uom: ['uom', 'satuan', 'unit', 'kemasan', 'satuanutama', 'uomutama', 'satuanqty', 'satuan_utama', 'uom_utama'],
    uom_convert: ['uomconvert', 'uom_convert', 'satuankonversi', 'satuan_konversi', 'uompcs', 'satuanpcs', 'satuanterkecil', 'uomconv', 'satuan_pcs', 'satuan_terkecil'],
    batch: ['batch', 'nobatch', 'no_batch', 'nomorbatch', 'batchno', 'batch_no', 'lot', 'lotno', 'lot_no', 'kodebatch', 'batchnumber', 'batch_number'],
    vendor_batch: ['vendorbatch', 'vendor_batch', 'batchvendor', 'batch_vendor', 'lotvendor', 'vendorlot', 'vendorbatchno', 'nobatchvendor', 'batch_vendor_no'],
    sloc: ['sloc', 'gudang', 'slocid', 'kodesloc', 'storage_loc', 'sloc_code'],
    expired_date: ['expireddate', 'expired_date', 'expdate', 'exp_date', 'expired', 'kadaluwarsa', 'ed', 'tanggalkadaluwarsa', 'tgled', 'tgl_ed', 'exp', 'expirydate', 'bbd', 'tglexpired', 'tanggaled', 'tanggal_ed', 'tanggal_kadaluwarsa', 'bestbefore', 'expiry_date'],
    destination_code: ['destinationcode', 'destination_code', 'destcode', 'dest_code', 'kodedestinasi', 'tujuancode', 'destination', 'destinasi', 'tujuan_code'],
    tujuan: ['tujuan', 'tujuancekfisik', 'tujuan_cekfisik', 'tujuanpemusnahan', 'tujuan_pemusnahan', 'alokasi', 'customer', 'deliveryto', 'lokasitujuan', 'kirimke', 'tujuandistribusi', 'outlet', 'depotujuan', 'tujuan_alokasi'],
    qc_code: ['qccode', 'qc_code', 'kondisiqc', 'qc', 'kodeqc', 'qcstatus', 'statusqc', 'hasilqc', 'kondisi_qc', 'kode_qc'],
    user_tally: ['usertally', 'user_tally', 'petugastally', 'tally', 'checker', 'userchecker', 'namatally', 'petugas', 'nama_tally'],
    shelf_life: ['shelflife', 'shelf_life', 'masasimpan', 'masa_simpan', 'shelflifebulan', 'sisa_hari', 'sisahari', 'shelf_life_days', 'days'],
    source: ['source', 'sumber', 'asal', 'sourcelocation', 'sumberbarang', 'asalbarang', 'source_asal', 'sumber_asal', 'asal_barang'],
    user_input: ['userinput', 'user_input', 'operator', 'pembuat', 'admin', 'user', 'inputby', 'dibuatoleh', 'created_by', 'input_by'],
    category: ['category', 'kategori', 'kelompok', 'group', 'jenis', 'kategoribarang', 'kategori_barang'],
    lpn_serial_number: ['lpnserialnumber', 'lpn_serial_number', 'lpn', 'serialnumber', 'serial_number', 'serial', 'lpnserial', 'sn', 'noseri', 'lpnserialno', 'licenseplate', 'pallet_id', 'palletid'],
    note: ['note', 'catatan', 'keterangan', 'remark', 'perbedaandata', 'ket', 'remarks', 'memo'],
    tanggal_update: ['tanggalupdate', 'tanggal_update', 'tglupdate', 'tgl_update', 'updateddate', 'updateat', 'lastupdate', 'updated_at'],
    created_at: ['createdat', 'created_at', 'tglbuat', 'tanggaldibuat', 'tanggal_buat'],
    no: ['no', 'nomor', 'number', 'num', 'nourut', 'no.', '#']
  };

  // Helper fungsi pencocokan header 2-tahap yang presisi dan bebas benturan
  const resolveHeaderColumnMap = (headerCells: string[]): { [field: string]: number } => {
    const columnMap: { [key: string]: number } = {};
    const usedColIndices = new Set<number>();
    const usedFields = new Set<string>();

    const normalizedHeaders = headerCells.map(c => normalizeKey(c));

    // Urutan prioritas untuk matching
    const priorityFields: (keyof CekFisikPemusnahanItem)[] = [
      'id_cek_fisik',
      'item_code',
      'item_name',
      'category',
      'location_type',
      'location',
      'first_qty',
      'last_qty',
      'qty_convert',
      'uom_convert',
      'uom',
      'vendor_batch',
      'batch',
      'sloc',
      'expired_date',
      'destination_code',
      'tujuan',
      'qc_code',
      'user_tally',
      'shelf_life',
      'source',
      'user_input',
      'status',
      'note'
    ];

    // FASE 1: Exact Match (100% Cocok nama)
    for (const field of priorityFields) {
      const synonyms = fieldSynonyms[field] || [];
      for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
        if (usedColIndices.has(colIdx)) continue;
        const h = normalizedHeaders[colIdx];
        if (!h) continue;

        if (synonyms.some(s => s === h)) {
          columnMap[field] = colIdx;
          usedColIndices.add(colIdx);
          usedFields.add(field);
          break;
        }
      }
    }

    // FASE 2: Controlled Partial Match (Hanya untuk field yang belum terpetakan)
    for (const field of priorityFields) {
      if (usedFields.has(field)) continue;
      const synonyms = fieldSynonyms[field] || [];

      for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
        if (usedColIndices.has(colIdx)) continue;
        const h = normalizedHeaders[colIdx];
        if (!h || h.length < 3) continue;

        const isMatch = synonyms.some(s => {
          if (s.length < 4) return false;
          // Guard terhadap false-positive
          if (field === 'location' && h.includes('type')) return false;
          if (field === 'uom' && (h.includes('convert') || h.includes('pcs') || h.includes('satuanpcs'))) return false;
          if (field === 'batch' && h.includes('vendor')) return false;
          if (field === 'last_qty' && (h.includes('first') || h.includes('awal') || h.includes('conv') || h.includes('pcs') || h.includes('konversi'))) return false;
          if (field === 'first_qty' && (h.includes('last') || h.includes('akhir') || h.includes('conv') || h.includes('pcs') || h.includes('konversi'))) return false;
          if (field === 'status' && (h.includes('qc') || h.includes('tally'))) return false;
          if (field === 'tujuan' && (h.includes('code') || h.includes('dest'))) return false;

          return h.startsWith(s) || h.includes(s);
        });

        if (isMatch) {
          columnMap[field] = colIdx;
          usedColIndices.add(colIdx);
          usedFields.add(field);
          break;
        }
      }
    }

    return columnMap;
  };

  const cleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str || str === '-' || str === 'null') return 0;
    // Jika format koma desimal tanpa titik ("0,556" atau "12,5")
    if (str.includes(',') && !str.includes('.')) {
      const cleaned = str.replace(/[^0-9,-]/g, '').replace(',', '.');
      return Number(cleaned) || 0;
    }
    // Standar desimal dengan titik ("0.556" atau "1,200.50")
    const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    return Number(cleaned) || 0;
  };

  const normalizeStatus = (rawStatus: string): 'Cek' | 'Ada' | 'Beda' | 'Tidak' => {
    const s = String(rawStatus || '').trim().toLowerCase();
    if (!s || s === '-' || s === 'cek' || s === 'check') return 'Cek';
    if (s === 'ada' || s === 'good' || s === 'ok' || s === 'pass' || s === 'sesuai' || s === 'ready' || s === 'available') return 'Ada';
    if (s === 'beda' || s === 'selisih' || s === 'diff' || s === 'different' || s === 'kurang' || s === 'lebih') return 'Beda';
    if (s === 'tidak' || s === 'reject' || s === 'musnah' || s === 'rusak' || s === 'damaged' || s === 'damage' || s === 'expired' || s === 'bad' || s === 'no') return 'Tidak';
    return 'Cek';
  };

  const parseDateToIso = (rawDateStr: string): string => {
    if (!rawDateStr || rawDateStr.trim() === '' || rawDateStr.trim() === '-' || rawDateStr.trim() === 'null') {
      return '-';
    }
    const val = rawDateStr.trim();
    if (/^\d{5}$/.test(val)) {
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + Number(val) * 86400000);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
    }
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(val)) {
      const delimiter = val.includes('/') ? '/' : (val.includes('-') ? '-' : '.');
      const parts = val.split(delimiter);
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(val)) {
      const delimiter = val.includes('/') ? '/' : (val.includes('-') ? '-' : '.');
      const parts = val.split(delimiter);
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return val;
  };

  const parsePastedText = (
    rawText: string,
    defaultTujuanOverride?: string
  ) => {
    if (!rawText || !rawText.trim()) {
      setPastedRows([]);
      return;
    }

    const lines = rawText
      .split(/\r\n|\n|\r/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      setPastedRows([]);
      return;
    }

    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';') && !firstLine.includes('\t')) {
      delimiter = ';';
    } else if (firstLine.includes(',') && !firstLine.includes('\t') && !firstLine.includes(';')) {
      delimiter = ',';
    }

    const splitRow = (rowStr: string): string[] => {
      if (delimiter === '\t' || delimiter === ';') {
        return rowStr.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      }
      const result: string[] = [];
      let insideQuote = false;
      let currentCell = '';
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(currentCell.trim().replace(/^["']|["']$/g, ''));
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      result.push(currentCell.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const parsedMatrix = lines.map(l => splitRow(l));
    if (parsedMatrix.length === 0) return;

    const nowIso = new Date().toISOString();
    const datePrefix = nowIso.slice(0, 10).replace(/-/g, '');

    const barangMap = new Map<string, DataBarang>();
    barangList.forEach(b => {
      if (b.item_code) barangMap.set(b.item_code.trim().toLowerCase(), b);
    });

    const activeDefaultTujuan = defaultTujuanOverride !== undefined ? defaultTujuanOverride : pasteDefaultTujuan;

    // Semua baris yang dipaste langsung masuk ke tabel dari baris pertama (index 0)
    const dataRows = parsedMatrix.filter(row => row.some(c => c && c.trim().length > 0));

    const resultRows: CekFisikPemusnahanItem[] = dataRows.map((row, rowIdx) => {
      // Cek apakah kolom pertama adalah nomor urut (No: 1, 2, 3, 12, dll)
      const rawCell0 = (row[0] || '').trim();
      const rawCell1 = (row[1] || '').trim();
      const isFirstColRowNumber = /^\d{1,4}$/.test(rawCell0) && (
        /^[A-Za-z0-9._/-]{4,}$/.test(rawCell1) ||
        rawCell1.toUpperCase().startsWith('SKU') ||
        rawCell1.toUpperCase().startsWith('FG') ||
        rawCell1.toUpperCase().startsWith('CKF-') ||
        rawCell1.toUpperCase().startsWith('PEN-') ||
        rawCell1.length >= 4 ||
        barangMap.has(rawCell1.toLowerCase())
      );

      const r = isFirstColRowNumber ? row.slice(1) : row;
      const colCount = r.length;

      let id_cek_fisik = '';
      let tujuan = '';
      let item_code = '';
      let item_name = '';
      let category = '';
      let location = '';
      let location_type = '';
      let first_qty = 0;
      let last_qty = 0;
      let uom = 'CTN';
      let qty_convert = 0;
      let uom_convert = 'PCS';
      let lpn_serial_number = '-';
      let batch = '-';
      let vendor_batch = '-';
      let sloc = '';
      let expired_date = '-';
      let destination_code = '';
      let qc_code = '';
      let user_tally = currentUser?.nama || '';
      let shelf_life = 'Expired';
      let source = 'Retur Customer';
      let status: 'Cek' | 'Ada' | 'Beda' | 'Tidak' = 'Cek';
      let note = '';

      const getCol = (idx: number) => (idx < r.length && r[idx] !== undefined ? String(r[idx]).trim() : '');

      if (colCount >= 16) {
        // Format Database / Export Gudang (20-25 Kolom)
        const cell0 = getCol(0);
        const startsWithId = cell0.toUpperCase().startsWith('CKF-') || cell0.toUpperCase().startsWith('PEN-') || cell0.toUpperCase().startsWith('PMS-');

        if (startsWithId) {
          id_cek_fisik = getCol(0);
          if (['ada', 'beda', 'tidak', 'cek', 'good', 'reject'].includes(getCol(1).toLowerCase())) {
            status = normalizeStatus(getCol(1));
            item_code = getCol(2);
            item_name = getCol(3);
            category = getCol(4) || '';
            location = getCol(5) || '';
            location_type = getCol(6) || '';
            first_qty = cleanNumber(getCol(7));
            last_qty = cleanNumber(getCol(8)) || first_qty;
            uom = getCol(9) || 'CTN';
            qty_convert = cleanNumber(getCol(10));
            uom_convert = getCol(11) || 'PCS';
            lpn_serial_number = getCol(12) || '-';
            batch = getCol(13) || '-';
            vendor_batch = getCol(14) || '-';
            sloc = getCol(15) || '';
            expired_date = parseDateToIso(getCol(16));
            destination_code = getCol(17) || '';
            qc_code = getCol(18) || '';
            user_tally = getCol(19) || currentUser?.nama || '';
            shelf_life = getCol(20) || 'Expired';
            source = getCol(21) || 'Retur Customer';
            note = getCol(22);
            tujuan = getCol(23);
          } else {
            item_code = getCol(1);
            item_name = getCol(2);
            category = getCol(3) || '';
            location = getCol(4) || '';
            location_type = getCol(5) || '';
            first_qty = cleanNumber(getCol(6));
            last_qty = cleanNumber(getCol(7)) || first_qty;
            uom = getCol(8) || 'CTN';
            qty_convert = cleanNumber(getCol(9));
            uom_convert = getCol(10) || 'PCS';
            lpn_serial_number = getCol(11) || '-';
            batch = getCol(12) || '-';
            vendor_batch = getCol(13) || '-';
            sloc = getCol(14) || '';
            expired_date = parseDateToIso(getCol(15));
            destination_code = getCol(16) || '';
            qc_code = getCol(17) || '';
            user_tally = getCol(18) || currentUser?.nama || '';
            shelf_life = getCol(19) || 'Expired';
            source = getCol(20) || 'Retur Customer';
            status = normalizeStatus(getCol(21));
            note = getCol(22);
            tujuan = getCol(23);
          }
        } else {
          // Layout Standar Tabel Database Gudang
          item_code = getCol(0);
          item_name = getCol(1);
          category = getCol(2) || '';
          location = getCol(3) || '';

          const cell4IsNum = /^[0-9.,-]+$/.test(getCol(4)) && getCol(4).length > 0;

          if (cell4IsNum) {
            first_qty = cleanNumber(getCol(4));
            last_qty = cleanNumber(getCol(5)) || first_qty;
            uom = getCol(6) || 'CTN';
            qty_convert = cleanNumber(getCol(7));
            uom_convert = getCol(8) || 'PCS';
            lpn_serial_number = getCol(9) || '-';
            batch = getCol(10) || '-';
            vendor_batch = getCol(11) || '-';
            sloc = getCol(12) || '';
            expired_date = parseDateToIso(getCol(13));
            destination_code = getCol(14) || '';
            qc_code = getCol(15) || '';
            source = getCol(16) || 'Retur Customer';
            status = normalizeStatus(getCol(17));
            user_tally = getCol(18) || currentUser?.nama || '';
            shelf_life = getCol(19) || 'Expired';
            note = getCol(21) || getCol(20);
            tujuan = getCol(22);
          } else {
            location_type = getCol(4) || '';
            first_qty = cleanNumber(getCol(5));
            last_qty = cleanNumber(getCol(6)) || first_qty;
            uom = getCol(7) || 'CTN';
            qty_convert = cleanNumber(getCol(8));
            uom_convert = getCol(9) || 'PCS';
            lpn_serial_number = getCol(10) || '-';
            batch = getCol(11) || '-';
            vendor_batch = getCol(12) || '-';
            sloc = getCol(13) || '';
            expired_date = parseDateToIso(getCol(14));
            destination_code = getCol(15) || '';
            qc_code = getCol(16) || '';
            user_tally = getCol(17) || currentUser?.nama || '';
            shelf_life = getCol(18) || 'Expired';
            source = getCol(19) || 'Retur Customer';
            status = normalizeStatus(getCol(20));
            note = getCol(21);
            tujuan = getCol(22);
          }
        }
      } else if (colCount >= 8 && colCount <= 15) {
        // Format 11 Kolom Form Cek Fisik:
        // [0] STATUS | [1] LOCATION | [2] ITEM CODE | [3] ITEM NAME | [4] LAST QTY | [5] UOM | [6] QTY CONVERT | [7] BATCH | [8] EXPIRED DATE | [9] NOTE | [10] TUJUAN
        const c0 = getCol(0).toLowerCase();
        const c1 = getCol(1).toUpperCase();
        const isStatusFirst = ['ada', 'beda', 'tidak', 'cek', 'good', 'reject', 'ok', 'pass'].includes(c0) ||
          c1.includes('WH') || c1.includes('RAK') || c1.includes('BIN') || c1.includes('CKB') || c1.includes('SL');

        if (isStatusFirst) {
          status = normalizeStatus(getCol(0));
          location = getCol(1) || '';
          item_code = getCol(2);
          item_name = getCol(3);
          last_qty = cleanNumber(getCol(4));
          first_qty = last_qty;
          uom = getCol(5) || 'CTN';
          qty_convert = cleanNumber(getCol(6));
          batch = getCol(7) || '-';
          expired_date = parseDateToIso(getCol(8));
          note = getCol(9);
          tujuan = getCol(10);
        } else {
          item_code = getCol(0);
          item_name = getCol(1);
          location = getCol(2) || '';
          last_qty = cleanNumber(getCol(3));
          first_qty = last_qty;
          uom = getCol(4) || 'CTN';
          qty_convert = cleanNumber(getCol(5));
          batch = getCol(6) || '-';
          expired_date = parseDateToIso(getCol(7));
          status = normalizeStatus(getCol(8));
          note = getCol(9);
          tujuan = getCol(10);
        }
      } else {
        // Short SKU format (1-7 kolom)
        item_code = getCol(0);
        if (colCount >= 2) {
          if (/^[0-9.,-]+$/.test(getCol(1))) {
            last_qty = cleanNumber(getCol(1));
            first_qty = last_qty;
          } else {
            item_name = getCol(1);
          }
        }
        if (colCount >= 3) {
          if (/^[0-9.,-]+$/.test(getCol(2))) {
            last_qty = cleanNumber(getCol(2));
            first_qty = last_qty;
          } else {
            batch = getCol(2);
          }
        }
        if (colCount >= 4) {
          batch = getCol(3) || batch;
        }
        if (colCount >= 5) {
          expired_date = parseDateToIso(getCol(4));
        }
      }

      // Smart Heuristic Scanning Fallbacks
      if (!expired_date || expired_date === '-') {
        for (let i = 0; i < r.length; i++) {
          const cellVal = getCol(i);
          if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(cellVal) || /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(cellVal) || /^\d{5}$/.test(cellVal)) {
            expired_date = parseDateToIso(cellVal);
            break;
          }
        }
      }

      // Lookup Master Barang
      const matchedMaster = item_code ? barangMap.get(item_code.toLowerCase()) : undefined;
      if (matchedMaster) {
        if (!item_name || item_name === 'Item Tanpa Nama') item_name = matchedMaster.item_name;
        if (category === 'Damaged' && matchedMaster.category) category = matchedMaster.category;
        if (uom === 'CTN' && matchedMaster.uom) uom = matchedMaster.uom;
      }

      if ((!expired_date || expired_date === '-') && batch !== '-' && (item_code || item_name)) {
        const calc = getEdIsoDateString(item_code, item_name, batch);
        if (calc && calc.isoDate) {
          expired_date = calc.isoDate;
        }
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const rowId = id_cek_fisik || `CKF-${datePrefix}-${randomSuffix}-${String(rowIdx + 1).padStart(3, '0')}`;

      return {
        id_cek_fisik: rowId,
        tujuan: tujuan || activeDefaultTujuan || '',
        item_code: item_code,
        item_name: item_name || matchedMaster?.item_name || 'Item Tanpa Nama',
        category: category || matchedMaster?.category || '',
        location: location || '',
        location_type: location_type || '',
        first_qty: first_qty || last_qty || 0,
        last_qty: last_qty || 0,
        uom: uom || matchedMaster?.uom || 'CTN',
        qty_convert: qty_convert || 0,
        uom_convert: uom_convert || 'PCS',
        lpn_serial_number: lpn_serial_number || '-',
        batch: batch || '-',
        vendor_batch: vendor_batch || '-',
        sloc: sloc || '',
        expired_date: expired_date || '-',
        destination_code: destination_code || '',
        qc_code: qc_code || '',
        user_tally: user_tally || currentUser?.nama || '',
        shelf_life: shelf_life || 'Expired',
        source: source || 'Retur Customer',
        user_input: currentUser?.nama || 'QA Officer',
        tanggal_update: nowIso,
        status: status || 'Cek',
        note: note || '',
        created_at: nowIso,
        updated_at: nowIso
      };
    });

    // Filter baris kosong
    const validRows = resultRows.filter(r => r.item_code || r.item_name || r.location || (r.batch && r.batch !== '-'));
    setPastedRows(validRows);
  };

  const handleUpdatePastedRow = (index: number, field: keyof CekFisikPemusnahanItem, value: any) => {
    setPastedRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'item_code' && value) {
        const match = barangList.find(b => b.item_code.toLowerCase() === String(value).trim().toLowerCase());
        if (match) {
          row.item_name = match.item_name;
          if (match.category) row.category = match.category;
          if (match.uom) row.uom = match.uom;
        }
      }

      if ((field === 'batch' || field === 'item_code' || field === 'item_name') && row.batch && row.batch !== '-') {
        const calc = getEdIsoDateString(row.item_code, row.item_name, row.batch);
        if (calc && calc.isoDate) {
          row.expired_date = calc.isoDate;
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleDeletePastedRow = (index: number) => {
    setPastedRows(prev => prev.filter((_, i) => i !== index));
  };

  // Safe Batch Upsert Engine
  const safeBatchUpsertCekFisik = async (
    rows: CekFisikPemusnahanItem[],
    chunkSize = 200,
    onProgress?: (processed: number, total: number, pct: number) => void
  ): Promise<{ successCount: number; error: string | null }> => {
    if (!isSupabaseConfigured || rows.length === 0) {
      return { successCount: rows.length, error: null };
    }

    let totalProcessed = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map(r => ({
        ...r,
        expired_date: normalizeToIsoDate(r.expired_date) || (r.expired_date && r.expired_date !== '-' ? r.expired_date : null),
        created_at: r.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      try {
        const { error } = await supabase.from('data_cek_fisik_pemusnahan').upsert(chunk as any, { onConflict: 'id_cek_fisik' });
        if (error) {
          console.warn('Chunk upsert warning, retrying individually:', error);
          for (const item of chunk) {
            try {
              await supabase.from('data_cek_fisik_pemusnahan').upsert(item as any, { onConflict: 'id_cek_fisik' });
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Batch upsert error:', err);
      }
      totalProcessed += chunk.length;
      if (onProgress) {
        const pct = Math.min(100, Math.round((totalProcessed / rows.length) * 100));
        onProgress(totalProcessed, rows.length, pct);
      }
    }

    return { successCount: totalProcessed, error: null };
  };

  // Commit Pasted Rows to DB and State
  const handleCommitPastedRows = async () => {
    if (pastedRows.length === 0) {
      showToast('Data Kosong', 'Tidak ada data untuk disimpan', 'warning');
      return;
    }

    // Validasi Wajib Isi Tujuan: Pastikan setiap baris memiliki kolom Tujuan
    const rowsWithoutTujuan = pastedRows.filter(r => !r.tujuan || !r.tujuan.trim());
    if (rowsWithoutTujuan.length > 0) {
      showToast(
        'Tujuan Wajib Diisi!',
        `Terdapat ${rowsWithoutTujuan.length} baris yang belum memiliki Tujuan. Silakan lengkapi kolom Tujuan terlebih dahulu sebelum menyimpan.`,
        'error'
      );
      return;
    }

    setIsSavingPastedRows(true);
    setPasteSaveProgress({
      current: 0,
      total: pastedRows.length,
      percentage: 0,
      statusText: 'Menyiapkan data cek fisik...'
    });

    const nowIso = new Date().toISOString();
    const datePrefix = nowIso.slice(0, 10).replace(/-/g, '');

    const finalRows: CekFisikPemusnahanItem[] = pastedRows.map((item, idx) => {
      const uniqueSuffix = Math.floor(10000 + Math.random() * 90000);
      const generatedId = `CKF-${datePrefix}-${uniqueSuffix}-${String(idx + 1).padStart(4, '0')}`;

      return {
        ...item,
        id_cek_fisik: item.id_cek_fisik && !item.id_cek_fisik.includes('CKF-') ? generatedId : (item.id_cek_fisik || generatedId),
        category: item.category || '',
        first_qty: Number(item.first_qty) || Number(item.last_qty) || 0,
        vendor_batch: item.vendor_batch || '-',
        destination_code: item.destination_code || '',
        qc_code: item.qc_code || '',
        user_tally: item.user_tally || currentUser?.nama || '',
        source: item.source || 'Retur Customer',
        last_qty: Number(item.last_qty) || 0,
        qty_convert: Number(item.qty_convert) || 0,
        user_input: currentUser?.nama || 'QA Officer',
        tanggal_update: nowIso,
        created_at: nowIso,
        updated_at: nowIso
      };
    });

    setCekFisikList(prev => {
      const existingMap = new Map(prev.map(p => [p.id_cek_fisik, p]));
      finalRows.forEach(item => existingMap.set(item.id_cek_fisik, item));
      return Array.from(existingMap.values());
    });

    if (isSupabaseConfigured) {
      setPasteSaveProgress({
        current: 0,
        total: finalRows.length,
        percentage: 0,
        statusText: 'Mengunggah ke database...'
      });

      await safeBatchUpsertCekFisik(finalRows, 150, (proc, tot, pct) => {
        setPasteSaveProgress({
          current: proc,
          total: tot,
          percentage: pct,
          statusText: `Mengunggah ke database (${proc} / ${tot})...`
        });
      });
    }

    setIsSavingPastedRows(false);
    setShowPasteModal(false);
    setPastedRawText('');
    setPastedRows([]);
    showToast('Data Cek Fisik Berhasil Disimpan!', `${finalRows.length} baris data cek fisik siap diproses`, 'success');
  };

  // =========================================================================
  // LOGIKA UPLOAD EXCEL (FILE IMPORT)
  // =========================================================================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsProcessingExcel(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rawData.length === 0) {
          showToast('File Kosong', 'File Excel yang dipilih tidak memuat data baris', 'warning');
          setIsProcessingExcel(false);
          return;
        }

        const nowIso = new Date().toISOString();
        const datePrefix = nowIso.slice(0, 10).replace(/-/g, '');

        const barangMap = new Map<string, DataBarang>();
        barangList.forEach(b => {
          if (b.item_code) barangMap.set(b.item_code.trim().toLowerCase(), b);
        });

        const keys = rawData.length > 0 ? Object.keys(rawData[0]) : [];
        const fileColMap = resolveHeaderColumnMap(keys);

        const parsed: CekFisikPemusnahanItem[] = rawData.map((row, idx) => {
          const getVal = (field: keyof CekFisikPemusnahanItem): string => {
            const mappedIdx = fileColMap[field];
            if (mappedIdx !== undefined && keys[mappedIdx]) {
              const k = keys[mappedIdx];
              return String(row[k] || '').trim();
            }
            return '';
          };

          let itemCode = getVal('item_code');
          let itemName = getVal('item_name');
          const matchedMaster = itemCode ? barangMap.get(itemCode.toLowerCase()) : undefined;
          if (matchedMaster) {
            if (!itemName) itemName = matchedMaster.item_name;
          }

          const batchVal = getVal('batch') || '-';
          let expDateVal = parseDateToIso(getVal('expired_date'));

          if ((!expDateVal || expDateVal === '-') && batchVal !== '-' && (itemCode || itemName)) {
            const calc = getEdIsoDateString(itemCode, itemName, batchVal);
            if (calc && calc.isoDate) expDateVal = calc.isoDate;
          }

          const lastQtyNum = Number(getVal('last_qty').replace(/[^0-9.-]/g, '')) || 0;
          const firstQtyNum = Number(getVal('first_qty').replace(/[^0-9.-]/g, '')) || lastQtyNum;
          const qtyConvNum = Number(getVal('qty_convert').replace(/[^0-9.-]/g, '')) || 0;

          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const rowId = `CKF-${datePrefix}-${randomSuffix}-${String(idx + 1).padStart(3, '0')}`;

          return {
            id_cek_fisik: getVal('id_cek_fisik') || rowId,
            tujuan: getVal('tujuan') || excelUploadTujuan || 'Check Fisik Pemusnahan',
            item_code: itemCode,
            item_name: itemName || matchedMaster?.item_name || 'Item Tanpa Nama',
            category: getVal('category') || matchedMaster?.category || '',
            location: getVal('location') || '',
            location_type: getVal('location_type') || '',
            first_qty: firstQtyNum,
            last_qty: lastQtyNum,
            uom: getVal('uom') || matchedMaster?.uom || 'CTN',
            qty_convert: qtyConvNum,
            uom_convert: getVal('uom_convert') || 'PCS',
            lpn_serial_number: getVal('lpn_serial_number') || '-',
            batch: batchVal,
            vendor_batch: getVal('vendor_batch') || '-',
            sloc: getVal('sloc') || '',
            expired_date: expDateVal,
            destination_code: getVal('destination_code') || '',
            qc_code: getVal('qc_code') || '',
            user_tally: getVal('user_tally') || currentUser?.nama || '',
            shelf_life: getVal('shelf_life') || 'Expired',
            source: getVal('source') || 'Retur Customer',
            user_input: currentUser?.nama || 'QA Officer',
            tanggal_update: nowIso,
            status: (() => {
              const rawSt = (getVal('status') || '').trim();
              if (rawSt === 'Ada' || rawSt.toLowerCase() === 'ada') return 'Ada';
              if (rawSt === 'Beda' || rawSt.toLowerCase() === 'beda' || rawSt.toLowerCase() === 'selisih') return 'Beda';
              if (rawSt === 'Tidak' || rawSt.toLowerCase() === 'tidak' || rawSt.toLowerCase() === 'reject' || rawSt.toLowerCase() === 'musnah') return 'Tidak';
              return 'Cek';
            })(),
            note: getVal('note') || '',
            created_at: nowIso,
            updated_at: nowIso
          };
        }).filter(r => r.item_code || r.item_name);

        setParsedExcelRows(parsed);
        showToast('File Excel Terbaca', `${parsed.length} baris data berhasil dimuat`, 'info');
      } catch (err: any) {
        console.error('Error reading Excel file:', err);
        showToast('Gagal Membaca Excel', err?.message || 'Pastikan file Excel memiliki format yang valid', 'danger');
      } finally {
        setIsProcessingExcel(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) {
      showToast('Data Kosong', 'Tidak ada data hasil upload yang siap disimpan', 'warning');
      return;
    }

    setUploadProgress({
      isUploading: true,
      current: 0,
      total: parsedExcelRows.length,
      percentage: 0,
      statusText: 'Menyimpan data ke database...'
    });

    const nowIso = new Date().toISOString();
    const datePrefix = nowIso.slice(0, 10).replace(/-/g, '');

    const finalRows: CekFisikPemusnahanItem[] = parsedExcelRows.map((item, idx) => {
      const uniqueSuffix = Math.floor(10000 + Math.random() * 90000);
      const generatedId = `CKF-${datePrefix}-${uniqueSuffix}-${String(idx + 1).padStart(4, '0')}`;

      return {
        ...item,
        id_cek_fisik: item.id_cek_fisik && !item.id_cek_fisik.includes('CKF-') ? generatedId : (item.id_cek_fisik || generatedId),
        tujuan: excelUploadTujuan ? excelUploadTujuan : item.tujuan,
        user_input: currentUser?.nama || 'QA Officer',
        tanggal_update: nowIso,
        created_at: nowIso,
        updated_at: nowIso
      };
    });

    setCekFisikList(prev => {
      const existingMap = new Map(prev.map(p => [p.id_cek_fisik, p]));
      finalRows.forEach(item => existingMap.set(item.id_cek_fisik, item));
      return Array.from(existingMap.values());
    });

    if (isSupabaseConfigured) {
      await safeBatchUpsertCekFisik(finalRows, 150, (proc, tot, pct) => {
        setUploadProgress({
          isUploading: true,
          current: proc,
          total: tot,
          percentage: pct,
          statusText: `Mengunggah ke database (${proc} / ${tot})...`
        });
      });
    }

    setUploadProgress({ isUploading: false, current: 0, total: 0, percentage: 0, statusText: '' });
    setShowExcelModal(false);
    setParsedExcelRows([]);
    setExcelFileName('');
    showToast('Upload Excel Berhasil!', `${finalRows.length} baris data cek fisik berhasil disimpan`, 'success');
  };

  return (
    <div className="space-y-3 text-slate-800">

      {/* ACTION TOOLBAR BUTTONS (Desktop Only) */}
      <div className="hidden lg:flex p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex-wrap items-center justify-between gap-2">
        
        {/* Left Side: CRUD & Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tambah Cek Fisik (Paste dari Excel) */}
          <button
            onClick={handleOpenPasteModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-2xs transition-all cursor-pointer"
            title="Tambah Data Cek Fisik (Paste Massal dari Excel)"
          >
            <ClipboardPaste size={14} />
            <span>Tambah Cek Fisik</span>
          </button>

          {/* Form Input Manual */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer"
            title="Input Data Cek Fisik Satu per Satu (Form Manual)"
          >
            <Plus size={13} />
            <span>Manual Form</span>
          </button>

          {/* Tombol Pindah Massal (Bulk Transfer) */}
          <button
            onClick={() => {
              if (selectedIds.length === 0) {
                showToast('Pilih Data', 'Centang minimal satu data cek fisik untuk dipindahkan massal', 'warning');
                return;
              }
              setShowBulkTransferModal(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer ${
              selectedIds.length > 0
                ? 'bg-rose-700 hover:bg-rose-800 text-white animate-pulse'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
            }`}
            title="Pindahkan Data Terpilih ke Data Pemusnahan Final / Reco / Repack"
          >
            <ArrowRightLeft size={13} />
            <span>Pindah Massal ({selectedIds.length})</span>
          </button>

          {/* Ubah Status Massal */}
          <button
            onClick={() => {
              if (selectedIds.length === 0) {
                showToast('Pilih Data', 'Centang data terlebih dahulu untuk ubah status massal', 'warning');
                return;
              }
              setShowBulkStatusModal(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Ubah Status Massal untuk Data Terpilih"
          >
            <CheckSquare size={13} className="text-emerald-600" />
            <span>Ubah Status ({selectedIds.length})</span>
          </button>

          {/* Upload Excel */}
          <button
            onClick={() => setShowExcelModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
            title="Upload File Excel Cek Fisik"
          >
            <Upload size={13} />
            <span>Upload Excel</span>
          </button>

          {/* Download Template Excel */}
          <button
            onClick={downloadExcelTemplate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Download Template Format Excel Sesuai Kolom Database"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            <span>Template</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={exportDataToExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Ekspor Data Cek Fisik ke File Excel"
          >
            <Download size={13} className="text-blue-700" />
            <span>Ekspor Excel</span>
          </button>
        </div>

        {/* Right Side: Refresh & Sync */}
        <div className="flex items-center gap-1.5">
          {selectedIds.length > 0 && isSuperAdmin && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer"
              title="Hapus Data Terpilih"
            >
              <Trash2 size={13} />
              <span>Hapus ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchCekFisikData();
            }}
            disabled={isLoading || isRefreshing}
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw size={13} className={isLoading || isRefreshing ? 'animate-spin text-rose-600' : ''} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SKU, Nama Barang, Batch, Lokasi, Status, Note, Tujuan..."
              className="w-full pl-8 pr-10 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Searchable Location Filter */}
          <div className="relative min-w-[140px] sm:w-44">
            <MapPin size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors ${isLocationFiltered ? 'text-rose-600' : 'text-slate-400'}`} />
            <input
              type="text"
              list="cekfisik-location-suggestions"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Lokasi..."
              className={`w-full pl-7 pr-7 py-1.5 rounded-lg border text-xs font-bold transition-all focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-rose-500 ${
                isLocationFiltered
                  ? 'border-rose-300 bg-rose-50 text-rose-900 placeholder:text-rose-400'
                  : 'border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400'
              }`}
            />
            <datalist id="cekfisik-location-suggestions">
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
            {locationFilter && (
              <button
                type="button"
                onClick={() => {
                  setLocationFilter('');
                  setCurrentPage(1);
                }}
                title="Reset filter lokasi"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Filter: Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1.5 focus:ring-rose-500"
          >
            <option value="ALL">Semua Status ({uniqueStatuses.length})</option>
            {uniqueStatuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Quick Filter: Tujuan */}
          <select
            value={tujuanFilter}
            onChange={(e) => { setTujuanFilter(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1.5 focus:ring-rose-500"
          >
            <option value="ALL">Semua Tujuan</option>
            {uniqueTujuanList.map(tj => (
              <option key={tj} value={tj}>{tj}</option>
            ))}
          </select>

          {/* Selection Actions & Mobile Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Pilih Semua ({filteredCekFisik.length})
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                Batal ({selectedIds.length})
              </button>
            )}
            {selectedIds.length > 0 && isSuperAdmin && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex lg:hidden items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer"
                title="Hapus Data Terpilih"
              >
                <Trash2 size={13} />
                <span>Hapus ({selectedIds.length})</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsRefreshing(true);
                fetchCekFisikData();
              }}
              disabled={isLoading || isRefreshing}
              className="lg:hidden p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Muat Ulang Data"
            >
              <RefreshCw size={13} className={isLoading || isRefreshing ? 'animate-spin text-rose-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-bold border-b border-slate-700 select-none">
                <th className="px-2 py-1.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedList.length > 0 && paginatedList.every(i => selectedIds.includes(i.id_cek_fisik))}
                    onChange={handleSelectAllCurrentPage}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSortColumn('status')}
                  className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Status"
                >
                  <div className="flex items-center gap-1">
                    <span>STATUS</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                {!isLocationFiltered && (
                  <th
                    onClick={() => handleSortColumn('location')}
                    className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                    title="Klik untuk sort Location"
                  >
                    <div className="flex items-center gap-1">
                      <span>LOCATION</span>
                      {sortField === 'location' ? (
                        sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                      ) : (
                        <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                      )}
                    </div>
                  </th>
                )}
                <th
                  onClick={() => handleSortColumn('item_name')}
                  className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Item Name"
                >
                  <div className="flex items-center gap-1">
                    <span>ITEM NAME</span>
                    {sortField === 'item_name' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn('last_qty')}
                  className="px-2.5 py-1.5 whitespace-nowrap text-right cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Last Qty"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>LAST QTY</span>
                    {sortField === 'last_qty' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn('qty_convert')}
                  className="px-2.5 py-1.5 whitespace-nowrap text-right cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Qty Convert"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>QTY CONVERT</span>
                    {sortField === 'qty_convert' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn('batch')}
                  className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Batch"
                >
                  <div className="flex items-center gap-1">
                    <span>BATCH</span>
                    {sortField === 'batch' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn('expired_date')}
                  className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Expired Date"
                >
                  <div className="flex items-center gap-1">
                    <span>EXPIRED DATE</span>
                    {sortField === 'expired_date' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="px-2.5 py-1.5 whitespace-nowrap">NOTE</th>
                <th
                  onClick={() => handleSortColumn('tujuan')}
                  className="px-2.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk sort Tujuan"
                >
                  <div className="flex items-center gap-1">
                    <span>TUJUAN</span>
                    {sortField === 'tujuan' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-rose-400" /> : <ArrowDown size={12} className="text-rose-400" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="px-2.5 py-1.5 whitespace-nowrap text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={isLocationFiltered ? 10 : 11} className="p-8 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-rose-600 mb-2" />
                    Memuat data cek fisik...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={isLocationFiltered ? 10 : 11} className="p-8 text-center text-slate-400">
                    <Boxes size={32} className="mx-auto text-slate-300 mb-2" />
                    Belum ada data cek fisik.
                  </td>
                </tr>
              ) : (
                paginatedList.map((item) => {
                  const isSelected = selectedIds.includes(item.id_cek_fisik);
                  const isReadyToScrap = (item.status || '').toLowerCase().includes('musnah') || (item.status || '').toLowerCase().includes('siap');

                  return (
                    <tr
                      key={item.id_cek_fisik}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-rose-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(item.id_cek_fisik)}
                          className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>

                      {/* 1. STATUS (Dropdown: Cek, Ada, Beda, Tidak) */}
                      <td className="px-2.5 py-1 whitespace-nowrap">
                        <select
                          value={item.status === 'Ada' ? 'Ada' : item.status === 'Beda' ? 'Beda' : item.status === 'Tidak' ? 'Tidak' : 'Cek'}
                          onChange={(e) => handleUpdateStatusInline(item.id_cek_fisik, e.target.value)}
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-1.5 focus:ring-rose-500 shadow-2xs ${
                            item.status === 'Ada'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : item.status === 'Beda'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : item.status === 'Tidak'
                              ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <option value="Cek">Cek</option>
                          <option value="Ada">Ada</option>
                          <option value="Beda">Beda</option>
                          <option value="Tidak">Tidak</option>
                        </select>
                      </td>

                      {/* 2. LOCATION */}
                      {!isLocationFiltered && (
                        <td className="px-2.5 py-1 text-slate-700 whitespace-nowrap font-medium">
                          {item.location || '-'}
                        </td>
                      )}

                      {/* 3. ITEM NAME */}
                      <td className="px-2.5 py-1 text-slate-900 font-semibold max-w-xs truncate" title={item.item_name}>
                        {item.item_name}
                      </td>

                      {/* 4. LAST QTY */}
                      <td className="px-2.5 py-1 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                        {item.last_qty ?? 0}
                      </td>

                      {/* 5. QTY CONVERT */}
                      <td className="px-2.5 py-1 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                        {item.qty_convert ?? 0} <span className="text-[10px] font-normal text-slate-500">{item.uom_convert || 'PCS'}</span>
                      </td>

                      {/* 6. BATCH */}
                      <td className="px-2.5 py-1 font-mono text-slate-700 whitespace-nowrap">
                        {item.batch || '-'}
                      </td>

                      {/* 7. EXPIRED DATE */}
                      <td className="px-2.5 py-1 font-mono text-slate-600 whitespace-nowrap">
                        {item.expired_date || '-'}
                      </td>

                      {/* 8. NOTE */}
                      <td className="px-2.5 py-1 text-slate-600 max-w-xs truncate" title={item.note || '-'}>
                        {item.note || '-'}
                      </td>

                      {/* 9. TUJUAN */}
                      <td className="px-2.5 py-1 text-slate-600 whitespace-nowrap">
                        {item.tujuan || 'Check Fisik Pemusnahan'}
                      </td>

                      {/* AKSI */}
                      <td className="px-2 py-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDetailModal(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                            title="Detail"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-all cursor-pointer"
                            title="Hapus Data Cek Fisik"
                          >
                            <Trash2 size={13} />
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

        {/* PAGINATION */}
        <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            Menampilkan <span className="font-bold">{paginatedList.length}</span> dari <span className="font-bold">{filteredCekFisik.length}</span> baris
          </div>
          <div className="flex items-center gap-2">
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-xs"
            >
              <option value="15">15 Baris</option>
              <option value="50">50 Baris</option>
              <option value="100">100 Baris</option>
              <option value="ALL">Semua Data</option>
            </select>

            {rowsPerPage !== 'ALL' && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-bold">{currentPage} / {totalPages || 1}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: PINDAH MASSAL (BULK TRANSFER) KE DATA PEMUSNAHAN / LAINNYA */}
      {/* ========================================================================= */}
      {showBulkTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-rose-400" />
                <h3 className="font-bold text-sm">Pindah Massal ke Modul Lain</h3>
              </div>
              <button
                onClick={() => setShowBulkTransferModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                <p className="font-bold mb-1">Konfirmasi Transfer Data Massal</p>
                <p>
                  Sebanyak <span className="font-black text-rose-700">{selectedIds.length} data</span> yang telah dicek fisik akan dipindahkan ke modul tujuan.
                </p>
              </div>

              {/* Target Destination Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Tabel / Modul Tujuan:</label>
                <div className="space-y-2">
                  {BULK_DESTINATIONS_CEK_FISIK.map(dest => (
                    <label
                      key={dest.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedDestination === dest.id
                          ? 'border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="destinationChoice"
                        value={dest.id}
                        checked={selectedDestination === dest.id}
                        onChange={(e) => setSelectedDestination(e.target.value)}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-900">{dest.name}</div>
                        <div className="text-slate-500">{dest.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action on Source Data */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Aksi pada Data Cek Fisik Sumber:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceAction"
                      value="update_status"
                      checked={bulkSourceAction === 'update_status'}
                      onChange={() => setBulkSourceAction('update_status')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Ubah status di Cek Fisik menjadi:</span>
                    <input
                      type="text"
                      value={bulkSourceStatus}
                      onChange={(e) => setBulkSourceStatus(e.target.value)}
                      disabled={bulkSourceAction !== 'update_status'}
                      className="ml-1 px-2 py-0.5 text-xs rounded border border-slate-200 bg-slate-50 font-bold text-rose-700"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceAction"
                      value="delete"
                      checked={bulkSourceAction === 'delete'}
                      onChange={() => setBulkSourceAction('delete')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Hapus data dari Cek Fisik setelah berhasil ditransfer</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceAction"
                      value="keep"
                      checked={bulkSourceAction === 'keep'}
                      onChange={() => setBulkSourceAction('keep')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Biarkan data sumber apa adanya (Duplikat)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkTransferModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkTransfer}
                disabled={isBulkTransferring}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightLeft size={14} className={isBulkTransferring ? 'animate-spin' : ''} />
                <span>{isBulkTransferring ? 'Memproses Transfer...' : `Pindahkan ${selectedIds.length} Item`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UBAH STATUS MASSAL */}
      {/* ========================================================================= */}
      {showBulkStatusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Ubah Status ({selectedIds.length} Data)</h3>
              <button onClick={() => setShowBulkStatusModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">Pilih Status Baru:</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { value: 'Cek', bg: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
                  { value: 'Ada', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' },
                  { value: 'Beda', bg: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' },
                  { value: 'Tidak', bg: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100' }
                ].map(st => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setBulkStatusInput(st.value)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      bulkStatusInput === st.value
                        ? `${st.bg} ring-2 ring-rose-500 shadow-xs font-black`
                        : `${st.bg} opacity-80 hover:opacity-100`
                    }`}
                  >
                    {st.value}
                  </button>
                ))}
              </div>
              <select
                value={bulkStatusInput}
                onChange={(e) => setBulkStatusInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold bg-white cursor-pointer"
              >
                <option value="Cek">Cek</option>
                <option value="Ada">Ada</option>
                <option value="Beda">Beda</option>
                <option value="Tidak">Tidak</option>
              </select>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkStatusModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkStatusUpdate}
                disabled={isUpdatingBulkStatus}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
              >
                {isUpdatingBulkStatus ? 'Menyimpan...' : 'Terapkan Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FORM TAMBAH / EDIT CEK FISIK */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-rose-400" />
                <h3 className="font-bold text-sm">{isEditMode ? 'Edit Data Cek Fisik' : 'Tambah Data Cek Fisik Baru'}</h3>
              </div>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFormData} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ID Cek Fisik */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID Cek Fisik:</label>
                  <input
                    type="text"
                    value={formData.id_cek_fisik || ''}
                    disabled
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-100 font-mono text-slate-600"
                  />
                </div>

                {/* Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tujuan / Staging:</label>
                  <input
                    type="text"
                    value={formData.tujuan || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, tujuan: e.target.value }))}
                    placeholder="Check Fisik Pemusnahan..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500"
                  />
                </div>

                {/* SKU / Item Code Autocomplete */}
                <div className="sm:col-span-2 relative" ref={barangSearchContainerRef}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Item Code / Nama Barang:</label>
                  <input
                    type="text"
                    value={barangSearchText}
                    onChange={(e) => {
                      setBarangSearchText(e.target.value);
                      setIsBarangDropdownOpen(true);
                    }}
                    onFocus={() => setIsBarangDropdownOpen(true)}
                    placeholder="Ketik SKU atau Nama Barang..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-medium"
                  />
                  {isBarangDropdownOpen && barangSearchText && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {barangList
                        .filter(b => `${b.item_code} ${b.item_name}`.toLowerCase().includes(barangSearchText.toLowerCase()))
                        .slice(0, 10)
                        .map(b => (
                          <div
                            key={b.item_code}
                            onClick={() => handleSelectMasterBarang(b)}
                            className="p-2.5 hover:bg-rose-50 cursor-pointer text-xs flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold font-mono text-slate-900">{b.item_code}</span>
                              <p className="text-slate-600">{b.item_name}</p>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{b.uom || 'CTN'}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* First Qty & Last Qty */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Qty:</label>
                  <input
                    type="number"
                    value={formData.first_qty ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_qty: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Qty (Hasil Check):</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_qty: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-mono text-rose-600 font-bold"
                  />
                </div>

                {/* Batch & Sloc */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch:</label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => {
                        const updated = { ...prev, batch: val };
                        if (val && updated.item_code && updated.item_name) {
                          const autoCalc = getEdIsoDateString(updated.item_code, updated.item_name, val);
                          if (autoCalc && autoCalc.isoDate) {
                            updated.expired_date = autoCalc.isoDate;
                          }
                        }
                        return updated;
                      });
                    }}
                    placeholder="Kode Batch..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SLOC:</label>
                  <input
                    type="text"
                    value={formData.sloc || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sloc: e.target.value }))}
                    placeholder="SL99..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-mono"
                  />
                </div>

                {/* Expired Date & Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expired Date:</label>
                  <input
                    type="date"
                    value={formData.expired_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, expired_date: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status:</label>
                  <select
                    value={formData.status === 'Ada' ? 'Ada' : formData.status === 'Beda' ? 'Beda' : formData.status === 'Tidak' ? 'Tidak' : 'Cek'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-bold bg-white cursor-pointer"
                  >
                    <option value="Cek">Cek</option>
                    <option value="Ada">Ada</option>
                    <option value="Beda">Beda</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>

                {/* Note */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catatan / Note:</label>
                  <textarea
                    value={formData.note || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    rows={2}
                    placeholder="Keterangan hasil check fisik..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1.5 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 -mx-5 -mb-5">
                <div>
                  {isEditMode && selectedItem && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFormModal(false);
                        setShowDeleteModal(true);
                      }}
                      className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Hapus data cek fisik ini"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Data</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                  >
                    {isEditMode ? 'Simpan Perubahan' : 'Simpan Cek Fisik'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAIL CEK FISIK */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Detail Cek Fisik: {selectedItem.id_cek_fisik}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    selectedItem.status === 'Ada'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedItem.status === 'Beda'
                      ? 'bg-amber-100 text-amber-800'
                      : selectedItem.status === 'Tidak'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedItem.status === 'Ada' ? 'Ada' : selectedItem.status === 'Beda' ? 'Beda' : selectedItem.status === 'Tidak' ? 'Tidak' : 'Cek'}
                  </span>
                </div>
                <div><span className="text-slate-500">Tujuan:</span> <span className="font-bold">{selectedItem.tujuan}</span></div>
                <div><span className="text-slate-500">SKU:</span> <span className="font-mono font-bold">{selectedItem.item_code}</span></div>
                <div><span className="text-slate-500">Nama:</span> <span className="font-bold">{selectedItem.item_name}</span></div>
                <div><span className="text-slate-500">Batch:</span> <span className="font-mono">{selectedItem.batch}</span></div>
                <div><span className="text-slate-500">Expired:</span> <span className="font-mono">{selectedItem.expired_date}</span></div>
                <div><span className="text-slate-500">Qty Awal:</span> <span className="font-mono">{selectedItem.first_qty} {selectedItem.uom}</span></div>
                <div><span className="text-slate-500">Qty Akhir:</span> <span className="font-mono font-bold text-rose-600">{selectedItem.last_qty} {selectedItem.uom}</span></div>
                <div><span className="text-slate-500">Lokasi:</span> <span>{selectedItem.location} ({selectedItem.location_type})</span></div>
                <div><span className="text-slate-500">SLOC:</span> <span>{selectedItem.sloc}</span></div>
              </div>
              {selectedItem.note && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                  <span className="font-bold">Catatan:</span> {selectedItem.note}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setShowDeleteModal(true);
                }}
                className="px-3 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Hapus data cek fisik ini"
              >
                <Trash2 size={13} />
                <span>Hapus Data</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenEditModal(selectedItem);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit2 size={13} />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION MODAL (SINGLE ITEM) */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-800 m-0">Hapus Data Cek Fisik?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus data cek fisik <span className="font-mono font-bold text-rose-600">{selectedItem.id_cek_fisik}</span> ({selectedItem.item_name})? Data akan dihapus secara permanen dari database.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black shadow-md cursor-pointer text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH DATA CEK FISIK (PASTE DARI EXCEL) - PERSIS LOGIKA PENYIAPAN */}
      {/* ========================================================================= */}
      {showPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <ClipboardPaste size={20} className="text-rose-200" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">Tambah Data Cek Fisik (Paste dari Excel)</h3>
                  <p className="text-[11px] text-rose-200">
                    Copy baris data dari Excel / Spreadsheet lalu paste langsung di area teks di bawah
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100/80 text-rose-800 font-bold text-xs">
                    <ClipboardPaste size={14} />
                    <span>Paste dari Excel / Spreadsheet</span>
                  </span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Semua baris yang di-paste langsung masuk ke tabel mulai dari baris pertama.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {pastedRawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setPastedRawText('');
                        setPastedRows([]);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] transition-all cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>Bersihkan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasteModal(false);
                      handleOpenAddModal();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] transition-all cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>Input Manual Form</span>
                  </button>
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <span>Paste Data Excel di Kotak Ini:</span>
                    <span className="text-[11px] font-normal text-slate-500">(Tekan Ctrl+V / Cmd+V)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {pastedRows.length > 0 ? `${pastedRows.length} baris terdeteksi` : 'Data akan langsung terbaca otomatis'}
                  </span>
                </div>

                <textarea
                  value={pastedRawText}
                  onChange={(e) => {
                    setPastedRawText(e.target.value);
                    parsePastedText(e.target.value);
                  }}
                  rows={5}
                  placeholder={`Contoh Paste (Copy dari Excel):\nAda\tWH-REJECT-01\t21104501\tKINO SAMANTHA 50ML\t10\tCTN\t120\tL911346N\t2027-11-20\tRetur rusak\tCheck Fisik Pemusnahan`}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-slate-50/50"
                />
              </div>

              {/* Batch Settings Bar - Hanya Tujuan (Wajib Isi) */}
              <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-700 text-xs">Set Massal Untuk Semua Baris:</span>
                  
                  {/* Default Tujuan - Wajib Diisi */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-700 font-bold flex items-center gap-1">
                      <span>Tujuan:</span>
                      <span className="text-rose-600 font-black text-xs">*</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">Wajib Diisi</span>
                    </span>
                    <input
                      type="text"
                      list="paste-cek-fisik-tujuan-list"
                      value={pasteDefaultTujuan}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPasteDefaultTujuan(val);
                        if (pastedRows.length > 0) {
                          setPastedRows(prev => prev.map(r => ({
                            ...r,
                            tujuan: val
                          })));
                        }
                      }}
                      placeholder="Pilih / ketik Tujuan (Wajib Diisi)..."
                      className="px-2.5 py-1 text-xs rounded-lg border border-rose-300 focus:border-rose-500 bg-white focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-semibold w-52 sm:w-64"
                      required
                    />
                    <datalist id="paste-cek-fisik-tujuan-list">
                      <option value="Check Fisik Pemusnahan" />
                      <option value="Pemusnahan Scrap" />
                      <option value="Disposal / Destroy" />
                      <option value="Retur Vendor / Reject" />
                      <option value="Karantina Rusak" />
                      {uniqueTujuanList.map(tj => (
                        <option key={tj} value={tj} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 italic">
                  *Tujuan otomatis diterapkan ke seluruh baris data di bawah.
                </span>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs">
                      Preview Data Terbaca ({pastedRows.length} Baris):
                    </span>
                    {pastedRows.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ✓ Siap Disimpan
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPreviewColumnView('all_db')}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          previewColumnView === 'all_db' ? 'bg-white shadow-2xs text-rose-800' : 'text-slate-600'
                        }`}
                      >
                        Semua Kolom DB
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewColumnView('compact')}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          previewColumnView === 'compact' ? 'bg-white shadow-2xs text-rose-800' : 'text-slate-600'
                        }`}
                      >
                        Kolom Ringkas
                      </button>
                    </div>

                    {pastedRows.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <span>Total Qty Akhir: {pastedRows.reduce((a, b) => a + (Number(b.last_qty) || 0), 0)}</span>
                        <span>•</span>
                        <span>Total Qty Konv: {pastedRows.reduce((a, b) => a + (Number(b.qty_convert) || 0), 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {pastedRows.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                    <ClipboardPaste size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs">Belum ada baris data yang terbaca</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Copy data dari Excel lalu paste pada area teks di atas. Header otomatis terdeteksi.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-800 text-white font-bold sticky top-0 z-10">
                        <tr>
                          <th className="p-2 text-center w-10">No</th>
                          <th className="p-2 min-w-[130px]">STATUS</th>
                          <th className="p-2 min-w-[110px]">LOCATION</th>
                          <th className="p-2 min-w-[110px]">ITEM CODE</th>
                          <th className="p-2 min-w-[200px]">ITEM NAME</th>
                          <th className="p-2 text-right min-w-[80px]">LAST QTY</th>
                          <th className="p-2 text-center min-w-[60px]">UOM</th>
                          <th className="p-2 text-right min-w-[90px]">QTY CONVERT</th>
                          <th className="p-2 min-w-[110px]">BATCH</th>
                          <th className="p-2 min-w-[120px]">EXPIRED DATE</th>
                          <th className="p-2 min-w-[150px]">NOTE</th>
                          <th className="p-2 min-w-[140px]">TUJUAN</th>
                          {previewColumnView === 'all_db' && (
                            <>
                              <th className="p-2 min-w-[110px]">CATEGORY</th>
                              <th className="p-2 min-w-[110px]">LOC TYPE</th>
                              <th className="p-2 min-w-[80px]">SLOC</th>
                              <th className="p-2 min-w-[100px]">QC CODE</th>
                              <th className="p-2 min-w-[110px]">USER TALLY</th>
                            </>
                          )}
                          <th className="p-2 text-center w-10">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {pastedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                            <td className="px-2 py-1 text-center font-bold text-slate-500">{idx + 1}</td>
                            
                            {/* Status */}
                            <td className="p-1">
                              <select
                                value={row.status === 'Ada' ? 'Ada' : row.status === 'Beda' ? 'Beda' : row.status === 'Tidak' ? 'Tidak' : 'Cek'}
                                onChange={(e) => handleUpdatePastedRow(idx, 'status', e.target.value)}
                                className={`w-full px-2 py-0.5 rounded border text-xs font-bold transition-all cursor-pointer ${
                                  row.status === 'Ada'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : row.status === 'Beda'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : row.status === 'Tidak'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                <option value="Cek">Cek</option>
                                <option value="Ada">Ada</option>
                                <option value="Beda">Beda</option>
                                <option value="Tidak">Tidak</option>
                              </select>
                            </td>

                            {/* Location */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.location || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'location', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-semibold"
                              />
                            </td>

                            {/* Item Code */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.item_code || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'item_code', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-mono font-bold text-slate-900"
                              />
                            </td>

                            {/* Item Name */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.item_name || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'item_name', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-medium"
                              />
                            </td>

                            {/* Last Qty */}
                            <td className="p-1.5">
                              <input
                                type="number"
                                value={row.last_qty}
                                onChange={(e) => handleUpdatePastedRow(idx, 'last_qty', Number(e.target.value))}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-right font-mono font-bold text-rose-600"
                              />
                            </td>

                            {/* Uom */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.uom || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'uom', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-center font-semibold"
                              />
                            </td>

                            {/* Qty Convert */}
                            <td className="p-1.5">
                              <input
                                type="number"
                                value={row.qty_convert}
                                onChange={(e) => handleUpdatePastedRow(idx, 'qty_convert', Number(e.target.value))}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-right font-mono font-semibold"
                              />
                            </td>

                            {/* Batch */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.batch || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'batch', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-mono"
                              />
                            </td>

                            {/* Expired Date */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.expired_date || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'expired_date', e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full px-2 py-1 rounded border border-slate-200 font-mono text-slate-800"
                              />
                            </td>

                            {/* Note */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.note || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'note', e.target.value)}
                                placeholder="Catatan..."
                                className="w-full px-2 py-1 rounded border border-slate-200"
                              />
                            </td>

                            {/* Tujuan */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.tujuan || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'tujuan', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-semibold"
                              />
                            </td>

                            {/* Extra DB Columns */}
                            {previewColumnView === 'all_db' && (
                              <>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={row.category || ''}
                                    onChange={(e) => handleUpdatePastedRow(idx, 'category', e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-slate-200"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={row.location_type || ''}
                                    onChange={(e) => handleUpdatePastedRow(idx, 'location_type', e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-slate-200"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={row.sloc || ''}
                                    onChange={(e) => handleUpdatePastedRow(idx, 'sloc', e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-slate-200 font-mono"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={row.qc_code || ''}
                                    onChange={(e) => handleUpdatePastedRow(idx, 'qc_code', e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-slate-200 font-mono"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={row.user_tally || ''}
                                    onChange={(e) => handleUpdatePastedRow(idx, 'user_tally', e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-slate-200"
                                  />
                                </td>
                              </>
                            )}

                            {/* Action: Delete Row */}
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePastedRow(idx)}
                                className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Hapus baris ini"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Progress Bar when Saving */}
              {isSavingPastedRows && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={13} className="animate-spin text-rose-600" />
                      <span>{pasteSaveProgress.statusText}</span>
                    </span>
                    <span>{pasteSaveProgress.percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all duration-300"
                      style={{ width: `${pasteSaveProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 font-medium">
                {pastedRows.length > 0
                  ? `Siap menyimpan ${pastedRows.length} data cek fisik ke tabel sistem.`
                  : 'Silakan paste data Excel di kotak di atas.'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  disabled={isSavingPastedRows}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCommitPastedRows}
                  disabled={pastedRows.length === 0 || isSavingPastedRows}
                  className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingPastedRows ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Simpan {pastedRows.length} Data Cek Fisik</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD FILE EXCEL CEK FISIK */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-rose-900 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <Upload size={20} className="text-rose-300" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">Upload File Excel Cek Fisik</h3>
                  <p className="text-[11px] text-slate-300">
                    Import data cek fisik dari file Excel (.xlsx, .xls, .csv) langsung ke database
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExcelModal(false);
                  setParsedExcelRows([]);
                  setExcelFileName('');
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />

              {/* Step 1: Default Tujuan */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs">Default Tujuan / Lokasi Penyiapan:</label>
                  <p className="text-[11px] text-slate-500">Jika kolom 'Tujuan' di file Excel kosong, nilai ini yang akan digunakan.</p>
                </div>
                <input
                  type="text"
                  value={excelUploadTujuan}
                  onChange={(e) => setExcelUploadTujuan(e.target.value)}
                  placeholder="Check Fisik Pemusnahan..."
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-bold min-w-[220px]"
                />
              </div>

              {/* Step 2: Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  excelFileName
                    ? 'border-rose-400 bg-rose-50/40'
                    : 'border-slate-300 hover:border-rose-500 bg-slate-50 hover:bg-rose-50/20'
                }`}
              >
                {isProcessingExcel ? (
                  <div className="space-y-2 py-4">
                    <RefreshCw size={32} className="mx-auto text-rose-600 animate-spin" />
                    <p className="font-bold text-xs text-slate-700">Membaca dan memproses file Excel...</p>
                  </div>
                ) : excelFileName ? (
                  <div className="space-y-2">
                    <FileSpreadsheet size={36} className="mx-auto text-emerald-600" />
                    <div>
                      <p className="font-bold text-sm text-slate-900">{excelFileName}</p>
                      <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        ✓ {parsedExcelRows.length} baris data berhasil terbaca
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-2xs cursor-pointer inline-flex items-center gap-1 mt-1"
                    >
                      <RotateCcw size={12} />
                      <span>Ganti File Excel</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={36} className="mx-auto text-slate-400" />
                    <div>
                      <p className="font-bold text-xs text-slate-800">Klik di sini untuk memilih file Excel</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Mendukung format .xlsx, .xls, dan .csv</p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadExcelTemplate();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-2xs cursor-pointer"
                      >
                        <FileSpreadsheet size={13} className="text-emerald-700" />
                        <span>Download Template Excel Cek Fisik</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Parsed Data Preview */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      Preview Data Hasil Upload ({parsedExcelRows.length} Baris):
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span>Total Qty: {parsedExcelRows.reduce((a, b) => a + (Number(b.last_qty) || 0), 0)}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-56 overflow-y-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-800 text-white font-bold sticky top-0 z-10">
                        <tr>
                          <th className="p-2 text-center w-10">No</th>
                          <th className="p-2">STATUS</th>
                          <th className="p-2">LOCATION</th>
                          <th className="p-2">ITEM CODE</th>
                          <th className="p-2">ITEM NAME</th>
                          <th className="p-2 text-right">LAST QTY</th>
                          <th className="p-2 text-center">UOM</th>
                          <th className="p-2 text-right">QTY CONVERT</th>
                          <th className="p-2">BATCH</th>
                          <th className="p-2">EXPIRED DATE</th>
                          <th className="p-2">NOTE</th>
                          <th className="p-2">TUJUAN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedExcelRows.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-2 py-1 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="px-2 py-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.status === 'Ada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.status === 'Beda'
                                  ? 'bg-amber-100 text-amber-800'
                                  : row.status === 'Tidak'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {row.status === 'Ada' ? 'Ada' : row.status === 'Beda' ? 'Beda' : row.status === 'Tidak' ? 'Tidak' : 'Cek'}
                              </span>
                            </td>
                            <td className="px-2 py-1">{row.location}</td>
                            <td className="px-2 py-1 font-mono font-bold">{row.item_code}</td>
                            <td className="px-2 py-1 font-medium">{row.item_name}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-rose-600">{row.last_qty}</td>
                            <td className="px-2 py-1 text-center">{row.uom}</td>
                            <td className="px-2 py-1 text-right font-mono">{row.qty_convert}</td>
                            <td className="px-2 py-1 font-mono">{row.batch}</td>
                            <td className="px-2 py-1 font-mono">{row.expired_date}</td>
                            <td className="px-2 py-1 text-slate-500">{row.note || '-'}</td>
                            <td className="px-2 py-1 font-semibold">{row.tujuan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedExcelRows.length > 15 && (
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                      Menampilkan 15 dari total {parsedExcelRows.length} baris data yang akan disimpan.
                    </p>
                  )}
                </div>
              )}

              {/* Upload Progress Bar */}
              {uploadProgress.isUploading && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={13} className="animate-spin text-rose-600" />
                      <span>{uploadProgress.statusText}</span>
                    </span>
                    <span>{uploadProgress.percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setParsedExcelRows([]);
                  setExcelFileName('');
                }}
                disabled={uploadProgress.isUploading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleCommitExcelImport}
                disabled={parsedExcelRows.length === 0 || uploadProgress.isUploading}
                className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadProgress.isUploading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Simpan {parsedExcelRows.length} Data Cek Fisik</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
