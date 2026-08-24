import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ClipboardList,
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
  Boxes,
  MessageSquare,
  Share2,
  ExternalLink,
  CheckSquare,
  Square,
  MinusSquare,
  FileText,
  Truck,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import Fuse from 'fuse.js';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { RecoItem, DataBarang } from '../../types';
import { getEdIsoDateString } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

interface RecoModuleProps {
  onNavigateToPenyiapan?: () => void;
}

export function RecoModule({ onNavigateToPenyiapan }: RecoModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin' || currentUser?.username?.toLowerCase() === 'superadmin';

  // Primary Data State
  const [recoList, setRecoList] = useState<RecoItem[]>([]);
  const [barangList, setBarangList] = useState<DataBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [tujuanFilter, setTujuanFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof RecoItem>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Selection & Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkStatusInput, setBulkStatusInput] = useState('');
  const [isUpdatingBulkStatus, setIsUpdatingBulkStatus] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);

  // Pagination & Display
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<RecoItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<RecoItem>>({});
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Generate QR Code dynamically when LPN / Serial Number changes
  useEffect(() => {
    const rawVal = formData.lpn_serial_number?.trim();
    if (!rawVal || rawVal === '-') {
      setQrCodeDataUrl('');
      return;
    }

    QRCode.toDataURL(rawVal, {
      width: 256,
      margin: 1,
      color: {
        dark: '#4c1d95',
        light: '#ffffff'
      }
    })
      .then((url: string) => setQrCodeDataUrl(url))
      .catch((err: any) => {
        console.warn('Gagal membuat QR Code:', err);
        setQrCodeDataUrl('');
      });
  }, [formData.lpn_serial_number]);

  // Searchable Autocomplete States for Form
  const [barangSearchText, setBarangSearchText] = useState('');
  const [isBarangDropdownOpen, setIsBarangDropdownOpen] = useState(false);
  const barangSearchContainerRef = useRef<HTMLDivElement>(null);

  // Close Master Barang Dropdown and revert text if user clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        barangSearchContainerRef.current &&
        !barangSearchContainerRef.current.contains(event.target as Node)
      ) {
        if (isBarangDropdownOpen) {
          setIsBarangDropdownOpen(false);
          if (formData.item_code && formData.item_name) {
            setBarangSearchText(`${formData.item_code} - ${formData.item_name}`);
          } else if (!formData.item_code) {
            setBarangSearchText('');
          }
        }
      }
    };

    if (isBarangDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBarangDropdownOpen, formData.item_code, formData.item_name]);

  // Speech-to-Text Voice Recognition States
  const [isListeningBarang, setIsListeningBarang] = useState(false);
  const [speechFeedbackBarang, setSpeechFeedbackBarang] = useState<string | null>(null);
  const barangRecognitionRef = useRef<any>(null);

  const [isListeningSearch, setIsListeningSearch] = useState(false);
  const [speechFeedbackSearch, setSpeechFeedbackSearch] = useState<string | null>(null);
  const searchRecognitionRef = useRef<any>(null);

  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Excel Import States
  const [parsedExcelRows, setParsedExcelRows] = useState<RecoItem[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (barangRecognitionRef.current) {
        try { barangRecognitionRef.current.abort(); } catch {}
      }
      if (searchRecognitionRef.current) {
        try { searchRecognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // Load master barang cache
  const loadMasterBarangLocally = useCallback(() => {
    let loaded: DataBarang[] = [];
    try {
      const keys = ['ckb_master_data_barang_cache', 'ckb_data_barang', 'master_barang'];
      for (const k of keys) {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = [...loaded, ...parsed];
          }
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
        local.forEach(b => {
          if (b.item_code) mergedMap.set(b.item_code.trim().toLowerCase(), b);
        });
        resBarangData.forEach((b: DataBarang) => {
          if (b.item_code) mergedMap.set(b.item_code.trim().toLowerCase(), b);
        });
        const finalBarang = Array.from(mergedMap.values());
        setBarangList(finalBarang);
        try {
          localStorage.setItem('ckb_master_data_barang_cache', JSON.stringify(finalBarang));
        } catch {}
      }
    } catch (err) {
      console.warn('Error fetching master barang:', err);
    }
  }, [loadMasterBarangLocally]);

  // Fetch data_reco from Supabase
  const fetchRecoData = useCallback(async () => {
    setIsLoading(true);
    setLastSupabaseError(null);

    // Read local cache first for instant render
    let cachedList: RecoItem[] = [];
    try {
      const cached = localStorage.getItem('reco_cache_v1');
      if (cached) {
        cachedList = JSON.parse(cached);
        if (Array.isArray(cachedList) && cachedList.length > 0) {
          setRecoList(cachedList);
        }
      }
    } catch (e) {
      console.warn('Error reading reco local cache:', e);
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const rows = await fetchAllRowsFromSupabase<RecoItem>('data_reco', {
        orderBy: 'created_at',
        ascending: false
      });

      if (rows) {
        setRecoList(rows);
        try {
          localStorage.setItem('reco_cache_v1', JSON.stringify(rows));
        } catch {}
      }
    } catch (err: any) {
      console.error('Error fetching data_reco:', err);
      setLastSupabaseError(err?.message || 'Gagal memuat data dari database Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Load & Supabase Realtime Subscription
  useEffect(() => {
    fetchRecoData();
    fetchMasterData();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('public:data_reco')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'data_reco' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as RecoItem;
            setRecoList((prev) => [newItem, ...prev.filter((p) => p.id_reco !== newItem.id_reco)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as RecoItem;
            setRecoList((prev) =>
              prev.map((p) => (p.id_reco === updated.id_reco ? updated : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id_reco;
            if (deletedId) {
              setRecoList((prev) => prev.filter((p) => p.id_reco !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecoData, fetchMasterData]);

  // Sync to local storage whenever recoList changes
  useEffect(() => {
    if (recoList.length > 0) {
      try {
        localStorage.setItem('reco_cache_v1', JSON.stringify(recoList));
      } catch {}
    }
  }, [recoList]);

  // Manual Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRecoData(), fetchMasterData()]);
    setIsRefreshing(false);
    showToast('Data Diperbarui', 'Data permintaan barang Reco berhasil disinkronkan.', 'info');
  };

  // Autocomplete search results for Master Data Barang in Form
  const barangSearchResults = useMemo(() => {
    if (!barangSearchText.trim()) return barangList.slice(0, 20);
    return fuzzySearchDataBarang(barangList, barangSearchText, 30);
  }, [barangList, barangSearchText]);

  // Handle select barang from dropdown
  const handleSelectBarang = (b: DataBarang) => {
    const edResult = getEdIsoDateString(b.item_code, b.item_name, formData.batch || '');
    const edIso = edResult?.isoDate || '';
    setFormData((prev) => ({
      ...prev,
      item_code: b.item_code,
      item_name: b.item_name,
      category: b.category || prev.category || 'Finished Good',
      uom: b.uom || prev.uom || 'CTN',
      expired_date: edIso || prev.expired_date
    }));
    setBarangSearchText(`${b.item_code} - ${b.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  // Speech Recognition for Search Box
  const handleToggleVoiceSearch = () => {
    if (!isSpeechSupported) {
      showToast('Tidak Didukung', 'Browser Anda tidak mendukung Web Speech Recognition', 'warning');
      return;
    }

    if (isListeningSearch) {
      if (searchRecognitionRef.current) searchRecognitionRef.current.stop();
      setIsListeningSearch(false);
      return;
    }

    try {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechClass();
      rec.lang = 'id-ID';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningSearch(true);
        setSpeechFeedbackSearch('Mendengarkan suara Anda...');
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setSearchQuery(transcript);
        setSpeechFeedbackSearch(`Mendeteksi: "${transcript}"`);
      };

      rec.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);
        setSpeechFeedbackSearch('Gagal mengenali suara. Coba lagi.');
        setIsListeningSearch(false);
      };

      rec.onend = () => {
        setIsListeningSearch(false);
        setTimeout(() => setSpeechFeedbackSearch(null), 2500);
      };

      searchRecognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn('Failed to start voice search:', e);
      setIsListeningSearch(false);
    }
  };

  // Speech Recognition for Form Item Search
  const handleToggleVoiceBarang = () => {
    if (!isSpeechSupported) {
      showToast('Tidak Didukung', 'Browser Anda tidak mendukung Web Speech Recognition', 'warning');
      return;
    }

    if (isListeningBarang) {
      if (barangRecognitionRef.current) barangRecognitionRef.current.stop();
      setIsListeningBarang(false);
      return;
    }

    try {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechClass();
      rec.lang = 'id-ID';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningBarang(true);
        setIsBarangDropdownOpen(true);
        setSpeechFeedbackBarang('Mendengarkan nama / kode barang...');
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setBarangSearchText(transcript);
        setSpeechFeedbackBarang(`Mendeteksi: "${transcript}"`);
      };

      rec.onerror = (event: any) => {
        console.warn('Voice barang error:', event.error);
        setSpeechFeedbackBarang('Gagal mengenali suara.');
        setIsListeningBarang(false);
      };

      rec.onend = () => {
        setIsListeningBarang(false);
        setTimeout(() => setSpeechFeedbackBarang(null), 2500);
      };

      barangRecognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn('Failed to start voice barang:', e);
      setIsListeningBarang(false);
    }
  };

  // Unique list of options for Filters
  const uniqueTujuanList = useMemo(() => {
    const set = new Set<string>();
    recoList.forEach((item) => {
      if (item.tujuan) set.add(item.tujuan.trim());
    });
    return Array.from(set).sort();
  }, [recoList]);

  const uniqueStatusList = useMemo(() => {
    const set = new Set<string>();
    recoList.forEach((item) => {
      if (item.status) set.add(item.status.trim());
    });
    return Array.from(set).sort();
  }, [recoList]);

  const uniqueSlocList = useMemo(() => {
    const set = new Set<string>();
    recoList.forEach((item) => {
      if (item.sloc) set.add(item.sloc.trim());
    });
    return Array.from(set).sort();
  }, [recoList]);

  // Fuse.js Fuzzy Search on recoList
  const fuse = useMemo(() => {
    return new Fuse(recoList, {
      keys: [
        'id_reco',
        'item_code',
        'item_name',
        'category',
        'location',
        'lpn_serial_number',
        'batch',
        'vendor_batch',
        'sloc',
        'destination_code',
        'qc_code',
        'user_tally',
        'source',
        'status',
        'note',
        'tujuan'
      ],
      threshold: 0.35,
      ignoreLocation: true
    });
  }, [recoList]);

  // Filtered and Sorted Reco List
  const filteredReco = useMemo(() => {
    let result = recoList;

    // Apply Search Query
    if (searchQuery.trim()) {
      result = fuse.search(searchQuery.trim()).map((res) => res.item);
    }

    // Apply Tujuan Filter
    if (tujuanFilter !== 'ALL') {
      result = result.filter((item) => item.tujuan === tujuanFilter);
    }

    // Apply Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => (item.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Apply Category Filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((item) => (item.category || '').toLowerCase() === categoryFilter.toLowerCase());
    }

    // Apply SLoc Filter
    if (slocFilter !== 'ALL') {
      result = result.filter((item) => item.sloc === slocFilter);
    }

    // Apply Sorting
    result = [...result].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [recoList, searchQuery, tujuanFilter, statusFilter, categoryFilter, slocFilter, sortField, sortOrder, fuse]);

  // KPIs / Statistics Calculations
  const stats = useMemo(() => {
    const totalLot = recoList.length;
    let totalCtn = 0;
    let totalPcs = 0;
    let totalPending = 0;
    let totalDone = 0;

    recoList.forEach((item) => {
      totalCtn += Number(item.last_qty || item.first_qty || 0);
      totalPcs += Number(item.qty_convert || 0);
      const st = (item.status || '').toLowerCase();
      if (st.includes('selesai') || st.includes('completed') || st.includes('closed') || st.includes('disetujui')) {
        totalDone++;
      } else {
        totalPending++;
      }
    });

    return {
      totalLot,
      totalCtn,
      totalPcs,
      totalPending,
      totalDone
    };
  }, [recoList]);

  // Multi-Selection Helper
  const allFilteredIds = useMemo(() => filteredReco.map((i) => i.id_reco), [filteredReco]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected = allFilteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Selected Summary Stats for Floating Action Bar
  const selectedSummary = useMemo(() => {
    let totalQty = 0;
    let totalConvert = 0;
    filteredReco.forEach((item) => {
      if (selectedIds.has(item.id_reco)) {
        totalQty += Number(item.last_qty || item.first_qty || 0);
        totalConvert += Number(item.qty_convert || 0);
      }
    });
    return {
      count: selectedIds.size,
      totalQty,
      totalConvert
    };
  }, [filteredReco, selectedIds]);

  // Pagination Slice
  const paginatedList = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredReco;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReco.slice(start, start + rowsPerPage);
  }, [filteredReco, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === 'ALL' ? 1 : Math.ceil(filteredReco.length / rowsPerPage);

  // Open Create Form Modal
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `REC-${dateStr}-${randomSuffix}`;

    setFormData({
      id_reco: generatedId,
      tujuan: 'Permintaan Barang',
      category: 'Finished Good',
      location: 'WH-RECO-01',
      location_type: 'Floor',
      first_qty: 1,
      last_qty: 1,
      uom: 'CTN',
      qty_convert: 1,
      uom_convert: 'PCS',
      lpn_serial_number: `LPN-REC-${dateStr}-${randomSuffix}`,
      batch: '-',
      vendor_batch: '-',
      sloc: 'SL03',
      expired_date: '',
      destination_code: 'DST-RECO',
      qc_code: 'QC-PASS',
      user_tally: currentUser?.nama || 'Tally Reco',
      shelf_life: '24 Bulan',
      source: 'Penyiapan / Permintaan',
      user_input: currentUser?.nama || 'Admin',
      status: 'Permintaan Reco',
      note: ''
    });
    setBarangSearchText('');
    setShowFormModal(true);
  };

  // Open Edit Form Modal
  const handleOpenEditModal = (item: RecoItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setFormData({ ...item });
    setBarangSearchText(`${item.item_code} - ${item.item_name}`);
    setShowFormModal(true);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (item: RecoItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  // Save Form (Create / Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_reco || !formData.item_code || !formData.item_name) {
      showToast('Form Belum Lengkap', 'ID Reco, Kode Barang, dan Nama Barang wajib diisi!', 'warning');
      return;
    }

    setIsPushing(true);
    const nowIso = new Date().toISOString();
    const payload: RecoItem = {
      id_reco: formData.id_reco.trim(),
      tujuan: formData.tujuan?.trim() || 'Permintaan Barang',
      item_code: formData.item_code.trim(),
      item_name: formData.item_name.trim(),
      category: formData.category?.trim() || 'Finished Good',
      location: formData.location?.trim() || 'WH-RECO-01',
      location_type: formData.location_type?.trim() || 'Floor',
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || 0,
      uom: formData.uom?.trim() || 'CTN',
      qty_convert: Number(formData.qty_convert) || 0,
      uom_convert: formData.uom_convert?.trim() || 'PCS',
      lpn_serial_number: formData.lpn_serial_number?.trim() || '-',
      batch: formData.batch?.trim() || '-',
      vendor_batch: formData.vendor_batch?.trim() || '-',
      sloc: formData.sloc?.trim() || 'SL03',
      expired_date: (formData.expired_date && formData.expired_date !== '-') ? formData.expired_date : undefined,
      destination_code: formData.destination_code?.trim() || 'DST-RECO',
      qc_code: formData.qc_code?.trim() || 'QC-PASS',
      user_tally: formData.user_tally?.trim() || currentUser?.nama || 'Tally Reco',
      shelf_life: formData.shelf_life?.trim() || '24 Bulan',
      source: formData.source?.trim() || 'Penyiapan / Permintaan',
      user_input: currentUser?.nama || 'Admin',
      tanggal_update: nowIso,
      status: formData.status?.trim() || 'Permintaan Reco',
      note: formData.note?.trim() || '',
      created_at: isEditMode && formData.created_at ? formData.created_at : nowIso,
      updated_at: nowIso
    };

    // Update state optimistically
    if (isEditMode) {
      setRecoList((prev) => prev.map((item) => (item.id_reco === payload.id_reco ? payload : item)));
    } else {
      setRecoList((prev) => [payload, ...prev.filter((p) => p.id_reco !== payload.id_reco)]);
    }

    setShowFormModal(false);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_reco')
          .upsert(payload, { onConflict: 'id_reco' });

        if (error) throw error;

        showToast(
          isEditMode ? 'Data Diperbarui' : 'Permintaan Ditambahkan',
          `Data permintaan barang ${payload.id_reco} berhasil disimpan di cloud.`,
          'success'
        );
      } catch (err: any) {
        console.error('Error saving data_reco to Supabase:', err);
        showToast('Tersimpan Lokal', `Data tersimpan di offline storage. Error Cloud: ${err.message}`, 'warning');
      }
    } else {
      showToast('Tersimpan Lokal', 'Data tersimpan di offline storage (Supabase belum terkonfigurasi).', 'info');
    }

    setIsPushing(false);
  };

  // Delete Single Item
  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    const idToDelete = selectedItem.id_reco;

    setRecoList((prev) => prev.filter((item) => item.id_reco !== idToDelete));
    setShowDeleteModal(false);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('data_reco').delete().eq('id_reco', idToDelete);
        if (error) throw error;
        showToast('Data Dihapus', `Data ${idToDelete} berhasil dihapus dari cloud.`, 'success');
      } catch (err: any) {
        console.error('Error deleting from data_reco:', err);
        showToast('Gagal Hapus Cloud', err.message, 'danger');
      }
    }
  };

  // Bulk Status Update
  const handleExecuteBulkStatus = async () => {
    if (selectedIds.size === 0 || !bulkStatusInput.trim()) return;
    const newStatus = bulkStatusInput.trim();
    const idsArray = Array.from(selectedIds);
    setIsUpdatingBulkStatus(true);

    const nowIso = new Date().toISOString();
    setRecoList((prev) =>
      prev.map((item) => (selectedIds.has(item.id_reco) ? { ...item, status: newStatus, updated_at: nowIso } : item))
    );

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_reco')
          .update({ status: newStatus, updated_at: nowIso })
          .in('id_reco', idsArray);

        if (error) throw error;

        showToast(
          'Status Diperbarui',
          `${idsArray.length} data berhasil diubah statusnya menjadi "${newStatus}".`,
          'success'
        );
      } catch (err: any) {
        console.error('Bulk status update error:', err);
        showToast('Gagal Update Cloud', err.message, 'danger');
      }
    }

    setIsUpdatingBulkStatus(false);
    setShowBulkStatusModal(false);
    setSelectedIds(new Set());
  };

  // Bulk Delete
  const handleExecuteBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    setIsDeletingBulk(true);

    setRecoList((prev) => prev.filter((item) => !selectedIds.has(item.id_reco)));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('data_reco').delete().in('id_reco', idsArray);
        if (error) throw error;
        showToast('Hapus Massal Sukses', `${idsArray.length} data berhasil dihapus dari database.`, 'success');
      } catch (err: any) {
        console.error('Bulk delete error:', err);
        showToast('Gagal Hapus Cloud', err.message, 'danger');
      }
    }

    setIsDeletingBulk(false);
    setShowBulkDeleteModal(false);
    setSelectedIds(new Set());
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const dataToExport = filteredReco.map((item, idx) => ({
      'No': idx + 1,
      'ID Reco': item.id_reco,
      'Tujuan': item.tujuan || 'Permintaan Barang',
      'Item Code': item.item_code,
      'Item Name': item.item_name,
      'Category': item.category || 'Finished Good',
      'Location': item.location || 'WH-RECO-01',
      'Location Type': item.location_type || 'Floor',
      'First Qty': item.first_qty || 0,
      'Last Qty': item.last_qty || 0,
      'UOM': item.uom || 'CTN',
      'Qty Convert': item.qty_convert || 0,
      'UOM Convert': item.uom_convert || 'PCS',
      'LPN / Serial Number': item.lpn_serial_number || '-',
      'Batch': item.batch || '-',
      'Vendor Batch': item.vendor_batch || '-',
      'SLoc': item.sloc || 'SL03',
      'Expired Date': item.expired_date || '-',
      'Destination Code': item.destination_code || 'DST-RECO',
      'QC Code': item.qc_code || 'QC-PASS',
      'User Tally': item.user_tally || 'Tally Reco',
      'Shelf Life': item.shelf_life || '24 Bulan',
      'Source': item.source || 'Penyiapan',
      'User Input': item.user_input || 'Admin',
      'Status': item.status || 'Permintaan Reco',
      'Catatan / Note': item.note || '',
      'Tanggal Dibuat': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Reco');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Laporan_Data_Reco_${dateStr}.xlsx`);
    showToast('Export Berhasil', `File Laporan_Data_Reco_${dateStr}.xlsx berhasil diunduh.`, 'success');
  };

  // Download Standard Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ID Reco': 'REC-20260824-0001',
        'Tujuan': 'Permintaan Barang',
        'Item Code': 'SKU-SAMPLE-01',
        'Item Name': 'SAMPLE PRODUK RECO 100ML',
        'Category': 'Finished Good',
        'Location': 'WH-RECO-01',
        'Location Type': 'Floor',
        'First Qty': 10,
        'Last Qty': 10,
        'UOM': 'CTN',
        'Qty Convert': 240,
        'UOM Convert': 'PCS',
        'LPN / Serial Number': 'LPN-REC-SAMPLE-01',
        'Batch': '1235',
        'Vendor Batch': 'VB-001',
        'SLoc': 'SL03',
        'Expired Date': '2028-05-15',
        'Destination Code': 'DST-RECO',
        'QC Code': 'QC-PASS',
        'User Tally': 'Tally Reco',
        'Shelf Life': '24 Bulan',
        'Source': 'Penyiapan',
        'Status': 'Permintaan Reco',
        'Catatan / Note': 'Permintaan barang untuk pemenuhan toko'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Reco');
    XLSX.writeFile(workbook, 'Template_Upload_Data_Reco.xlsx');
    showToast('Template Diunduh', 'Template Excel untuk upload Data Reco berhasil diunduh.', 'info');
  };

  // Handle Excel File Upload Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsProcessingExcel(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawData.length === 0) {
          showToast('File Kosong', 'File Excel yang dipilih tidak memiliki baris data.', 'warning');
          setIsProcessingExcel(false);
          return;
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const nowIso = now.toISOString();

        const parsed: RecoItem[] = rawData.map((row, idx) => {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const generatedId = row['ID Reco'] || row['id_reco'] || row['ID'] || `REC-${dateStr}-${randomSuffix}-${idx + 1}`;
          const itemCode = String(row['Item Code'] || row['item_code'] || row['SKU'] || '').trim();
          const itemName = String(row['Item Name'] || row['item_name'] || row['Nama Barang'] || '').trim();

          return {
            id_reco: String(generatedId).trim(),
            tujuan: String(row['Tujuan'] || row['tujuan'] || 'Permintaan Barang').trim(),
            item_code: itemCode || `SKU-${idx + 1}`,
            item_name: itemName || `Barang Reco #${idx + 1}`,
            category: String(row['Category'] || row['category'] || 'Finished Good').trim(),
            location: String(row['Location'] || row['location'] || 'WH-RECO-01').trim(),
            location_type: String(row['Location Type'] || row['location_type'] || 'Floor').trim(),
            first_qty: Number(row['First Qty'] || row['first_qty'] || row['Qty'] || 0),
            last_qty: Number(row['Last Qty'] || row['last_qty'] || row['Qty'] || 0),
            uom: String(row['UOM'] || row['uom'] || 'CTN').trim(),
            qty_convert: Number(row['Qty Convert'] || row['qty_convert'] || 0),
            uom_convert: String(row['UOM Convert'] || row['uom_convert'] || 'PCS').trim(),
            lpn_serial_number: String(row['LPN / Serial Number'] || row['lpn_serial_number'] || `LPN-REC-${dateStr}-${randomSuffix}`).trim(),
            batch: String(row['Batch'] || row['batch'] || '-').trim(),
            vendor_batch: String(row['Vendor Batch'] || row['vendor_batch'] || '-').trim(),
            sloc: String(row['SLoc'] || row['sloc'] || 'SL03').trim(),
            expired_date: row['Expired Date'] || row['expired_date'] || undefined,
            destination_code: String(row['Destination Code'] || row['destination_code'] || 'DST-RECO').trim(),
            qc_code: String(row['QC Code'] || row['qc_code'] || 'QC-PASS').trim(),
            user_tally: String(row['User Tally'] || row['user_tally'] || currentUser?.nama || 'Tally Reco').trim(),
            shelf_life: String(row['Shelf Life'] || row['shelf_life'] || '24 Bulan').trim(),
            source: String(row['Source'] || row['source'] || 'Upload Excel').trim(),
            user_input: currentUser?.nama || 'Admin',
            tanggal_update: nowIso,
            status: String(row['Status'] || row['status'] || 'Permintaan Reco').trim(),
            note: String(row['Catatan / Note'] || row['Catatan'] || row['note'] || '').trim(),
            created_at: nowIso,
            updated_at: nowIso
          };
        });

        setParsedExcelRows(parsed);
        setShowExcelModal(true);
      } catch (err: any) {
        console.error('Error parsing Excel:', err);
        showToast('Gagal Baca Excel', err?.message || 'Format file Excel tidak dapat dibaca.', 'danger');
      } finally {
        setIsProcessingExcel(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // Commit Parsed Excel to Database
  const handleCommitExcelUpload = async () => {
    if (parsedExcelRows.length === 0) return;
    setIsPushing(true);

    // Merge optimistically
    const merged = [...parsedExcelRows, ...recoList.filter((x) => !parsedExcelRows.some((p) => p.id_reco === x.id_reco))];
    setRecoList(merged);

    if (isSupabaseConfigured) {
      try {
        const chunkSize = 50;
        for (let i = 0; i < parsedExcelRows.length; i += chunkSize) {
          const chunk = parsedExcelRows.slice(i, i + chunkSize);
          const { error } = await supabase.from('data_reco').upsert(chunk, { onConflict: 'id_reco' });
          if (error) throw error;
        }

        showToast('Import Excel Berhasil', `${parsedExcelRows.length} data permintaan barang berhasil diimpor ke cloud!`, 'success');
      } catch (err: any) {
        console.error('Error batch uploading to Supabase:', err);
        showToast('Gagal Upload Cloud', err.message, 'danger');
      }
    } else {
      showToast('Tersimpan Lokal', `${parsedExcelRows.length} data berhasil disimpan di storage browser.`, 'info');
    }

    setIsPushing(false);
    setShowExcelModal(false);
    setParsedExcelRows([]);
  };

  // Copy LPN / Serial Number Helper
  const handleCopyLpn = (lpn?: string) => {
    if (!lpn || lpn === '-') return;
    navigator.clipboard.writeText(lpn);
    showToast('Tersalin', `LPN "${lpn}" disalin ke clipboard.`, 'info');
  };

  return (
    <div className="space-y-3">
      {/* Top Banner / Breadcrumb & Navigation Info */}
      <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-300 border border-white/20 shadow-inner">
            <ClipboardList size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight m-0 uppercase">
                Menu Reco (Permintaan Barang)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[10px] font-black uppercase">
                data_reco
              </span>
            </div>
            <p className="text-xs text-purple-200/90 m-0 font-medium">
              Reco adalah modul untuk manajemen & pencatatan permintaan barang (disinkronkan dari modul Penyiapan).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToPenyiapan && (
            <button
              onClick={onNavigateToPenyiapan}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer flex items-center gap-1.5"
              title="Buka Modul Penyiapan Outbound"
            >
              <Boxes size={14} className="text-sky-300" />
              <span>Buka Penyiapan</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh Data dari Cloud Supabase"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Cloud Status Error Alert if Supabase Error */}
      {lastSupabaseError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>Koneksi Cloud Error: {lastSupabaseError}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-2 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 rounded font-bold text-[11px] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* KPI Cards (Statistik Cepat Data Reco) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Total Lot Permintaan */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight block">
              Total Permintaan
            </span>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
              {stats.totalLot.toLocaleString('id-ID')}
              <span className="text-[10px] font-semibold text-slate-500 ml-1">Lot / Baris</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
            <ClipboardList size={16} />
          </div>
        </div>

        {/* Card 2: Total Qty (CTN) */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight block">
              Total Qty (CTN)
            </span>
            <div className="text-base sm:text-xl font-black text-blue-900 font-mono mt-0.5">
              {stats.totalCtn.toLocaleString('id-ID')}
              <span className="text-[10px] font-semibold text-blue-600 ml-1">CTN</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
            <Package size={16} />
          </div>
        </div>

        {/* Card 3: Total Konversi (PCS) */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight block">
              Total Konversi (PCS)
            </span>
            <div className="text-base sm:text-xl font-black text-emerald-800 font-mono mt-0.5">
              {stats.totalPcs.toLocaleString('id-ID')}
              <span className="text-[10px] font-semibold text-emerald-600 ml-1">PCS</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Boxes size={16} />
          </div>
        </div>

        {/* Card 4: Status Permintaan */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight block">
              Status Permintaan
            </span>
            <div className="text-xs sm:text-sm font-black text-purple-900 font-mono mt-0.5">
              <span className="text-amber-700">{stats.totalPending} Menunggu</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-emerald-700">{stats.totalDone} Selesai</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Clock size={16} />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Voice Search, Filters, Add & Excel Actions */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Box with Speech to Text */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SKU, Nama Barang, LPN, Batch, SLoc..."
              className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-600 outline-none"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            ) : isSpeechSupported ? (
              <button
                onClick={handleToggleVoiceSearch}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer ${
                  isListeningSearch ? 'text-rose-600 animate-pulse' : 'text-slate-400 hover:text-purple-700'
                }`}
                title="Voice Search"
              >
                {isListeningSearch ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            ) : null}

            {speechFeedbackSearch && (
              <div className="absolute top-full left-0 mt-1 z-20 px-2 py-1 rounded bg-purple-900 text-white text-[10px] font-bold shadow-md">
                {speechFeedbackSearch}
              </div>
            )}
          </div>

          {/* Action Buttons: Tambah Permintaan, Upload & Export Excel */}
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            <button
              onClick={handleOpenCreateModal}
              className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Tambah Reco</span>
            </button>

            {/* Hidden Input File for Excel Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingExcel}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Upload File Excel"
            >
              <Upload size={13} />
              <span>{isProcessingExcel ? 'Membaca...' : 'Upload Excel'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Download Laporan Excel (.xlsx)"
            >
              <Download size={13} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-bold text-[11px]">
            <Filter size={12} />
            <span>Filter:</span>
          </div>

          {/* Filter Tujuan */}
          <select
            value={tujuanFilter}
            onChange={(e) => {
              setTujuanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 focus:bg-white outline-none"
          >
            <option value="ALL">Semua Tujuan</option>
            {uniqueTujuanList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 focus:bg-white outline-none"
          >
            <option value="ALL">Semua Status</option>
            {uniqueStatusList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Filter SLoc */}
          <select
            value={slocFilter}
            onChange={(e) => {
              setSlocFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 focus:bg-white outline-none"
          >
            <option value="ALL">Semua SLoc</option>
            {uniqueSlocList.map((sl) => (
              <option key={sl} value={sl}>
                {sl}
              </option>
            ))}
          </select>

          {(tujuanFilter !== 'ALL' || statusFilter !== 'ALL' || slocFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setTujuanFilter('ALL');
                setStatusFilter('ALL');
                setSlocFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <span className="ml-auto text-[11px] text-slate-500 font-bold">
            Menampilkan: <strong className="text-slate-800">{filteredReco.length}</strong> data
          </span>
        </div>
      </div>

      {/* Floating Action Bar when Rows are Selected */}
      {selectedIds.size > 0 && (
        <div className="p-2.5 rounded-xl bg-purple-900 text-white shadow-lg flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-purple-700 font-mono font-bold text-[11px]">
              {selectedIds.size} dipilih
            </span>
            <span className="text-purple-200 text-[11px]">
              (Total Qty: <strong>{selectedSummary.totalQty.toLocaleString('id-ID')}</strong> | Konversi:{' '}
              <strong>{selectedSummary.totalConvert.toLocaleString('id-ID')} PCS</strong>)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setBulkStatusInput('');
                setShowBulkStatusModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 font-bold text-xs cursor-pointer flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              <span>Ubah Status</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span>Hapus Terpilih</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 text-xs font-bold cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Data Table (AppSheet Style Responsive Grid) */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-tight text-[10px] border-b border-slate-200 select-none">
                {/* Checkbox All */}
                <th className="px-2 py-2 text-center w-8">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded text-slate-600 hover:text-purple-900 cursor-pointer"
                    title={isAllSelected ? 'Batalkan pilihan semua' : 'Pilih semua baris'}
                  >
                    {isAllSelected ? (
                      <CheckSquare size={14} className="text-purple-800" />
                    ) : isSomeSelected ? (
                      <MinusSquare size={14} className="text-purple-600" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-2 text-center w-10">No</th>
                <th className="px-2 py-2 text-center sticky left-0 bg-slate-100 z-10 w-24">Status</th>
                <th
                  onClick={() => {
                    setSortField('item_code');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="px-2.5 py-2 cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Kode Barang</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('item_name');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="px-2.5 py-2 cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Barang</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-center">UOM</th>
                <th className="px-2 py-2 text-right">Konversi</th>
                <th className="px-2 py-2 text-center">UOM Konv</th>
                <th className="px-2.5 py-2">LPN / Serial No</th>
                <th className="px-2 py-2 text-center">Batch</th>
                <th className="px-2 py-2 text-center">SLoc</th>
                <th className="px-2.5 py-2">Lokasi</th>
                <th className="px-2.5 py-2">Tujuan</th>
                <th className="px-2 py-2 text-center">QC</th>
                <th className="px-2.5 py-2">Petugas Tally</th>
                <th className="px-2 py-2 text-center">Tgl Input</th>
                <th className="px-2 py-2 text-center w-20 sticky right-0 bg-slate-100 z-10">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="text-purple-600 animate-spin" />
                      <span>Memuat data Permintaan Barang (Reco)...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                        <ClipboardList size={24} />
                      </div>
                      <span className="font-bold text-slate-700">Belum ada data permintaan barang (Reco)</span>
                      <p className="text-[11px] text-slate-500 max-w-sm m-0">
                        Gunakan tombol "Tambah Reco", "Upload Excel", atau pindahkan data dari menu Penyiapan melalui fitur Pindah Massal.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const isChecked = selectedIds.has(item.id_reco);
                  const rowNumber = rowsPerPage === 'ALL' ? idx + 1 : (currentPage - 1) * rowsPerPage + idx + 1;
                  const statusText = item.status || 'Permintaan Reco';
                  const isDone = statusText.toLowerCase().includes('selesai') || statusText.toLowerCase().includes('disetujui');

                  return (
                    <tr
                      key={item.id_reco}
                      className={`hover:bg-purple-50/40 transition-colors ${isChecked ? 'bg-purple-50/70 font-semibold' : ''}`}
                    >
                      {/* Select Checkbox */}
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(item.id_reco)}
                          className="cursor-pointer accent-purple-800"
                        />
                      </td>

                      {/* Number */}
                      <td className="px-2 py-1.5 text-center text-[10px] text-slate-400 font-mono">
                        {rowNumber}
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5 text-center sticky left-0 bg-white z-10">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-300'
                          }`}
                        >
                          {statusText}
                        </span>
                      </td>

                      {/* Item Code */}
                      <td className="px-2.5 py-1.5 font-mono text-purple-900 font-bold">
                        {item.item_code}
                      </td>

                      {/* Item Name */}
                      <td className="px-2.5 py-1.5 text-slate-900 max-w-[200px] truncate" title={item.item_name}>
                        {item.item_name}
                      </td>

                      {/* Last Qty */}
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                        {(item.last_qty || item.first_qty || 0).toLocaleString('id-ID')}
                      </td>

                      {/* UOM */}
                      <td className="px-2 py-1.5 text-center font-bold text-slate-600 text-[10px]">
                        {item.uom || 'CTN'}
                      </td>

                      {/* Qty Convert */}
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-800">
                        {(item.qty_convert || 0).toLocaleString('id-ID')}
                      </td>

                      {/* UOM Convert */}
                      <td className="px-2 py-1.5 text-center font-bold text-emerald-700 text-[10px]">
                        {item.uom_convert || 'PCS'}
                      </td>

                      {/* LPN / Serial Number */}
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[11px] text-slate-700">{item.lpn_serial_number || '-'}</span>
                          {item.lpn_serial_number && item.lpn_serial_number !== '-' && (
                            <button
                              onClick={() => handleCopyLpn(item.lpn_serial_number)}
                              className="text-slate-400 hover:text-purple-700 p-0.5 cursor-pointer"
                              title="Salin LPN"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="px-2 py-1.5 text-center font-mono text-[11px]">
                        {item.batch || '-'}
                      </td>

                      {/* SLoc */}
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-800 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100">{item.sloc || 'SL03'}</span>
                      </td>

                      {/* Location */}
                      <td className="px-2.5 py-1.5 text-slate-700 text-[11px]">
                        {item.location || 'WH-RECO-01'}
                      </td>

                      {/* Tujuan */}
                      <td className="px-2.5 py-1.5 text-slate-700 text-[11px]">
                        {item.tujuan || 'Permintaan Barang'}
                      </td>

                      {/* QC Code */}
                      <td className="px-2 py-1.5 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[9px] font-bold border border-emerald-200">
                          {item.qc_code || 'QC-PASS'}
                        </span>
                      </td>

                      {/* User Tally */}
                      <td className="px-2.5 py-1.5 text-slate-600 text-[11px]">
                        {item.user_tally || 'Tally Reco'}
                      </td>

                      {/* Tanggal Input */}
                      <td className="px-2 py-1.5 text-center text-[10px] text-slate-500 font-mono">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(item)}
                            className="p-1 rounded text-slate-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer transition-colors"
                            title="Lihat Detail & QR"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded text-slate-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer transition-colors"
                            title="Edit Data"
                          >
                            <Edit2 size={13} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDeleteModal(true);
                              }}
                              className="p-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                              title="Hapus Data"
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

        {/* Pagination Bar */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Tampilkan per halaman:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white font-bold text-[11px]"
            >
              <option value="ALL">Semua</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {rowsPerPage !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-bold text-[11px]">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FORM TAMBAH / EDIT PERMINTAAN RECO */}
      {/* ========================================================================= */}
      {showFormModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-purple-200">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight m-0 uppercase">
                    {isEditMode ? 'Edit Permintaan Reco' : 'Tambah Permintaan Reco Baru'}
                  </h3>
                  <p className="text-[11px] text-purple-200 m-0">
                    ID: {formData.id_reco || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Autocomplete Master Barang Selector */}
              <div ref={barangSearchContainerRef} className="relative space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                    <span>Pilih Master Barang (SKU / Nama):</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={handleToggleVoiceBarang}
                      className={`text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer ${
                        isListeningBarang ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      {isListeningBarang ? <MicOff size={11} /> : <Mic size={11} />}
                      <span>{isListeningBarang ? 'Mendengarkan...' : 'Voice Autocomplete'}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={barangSearchText}
                    onChange={(e) => {
                      setBarangSearchText(e.target.value);
                      setIsBarangDropdownOpen(true);
                    }}
                    onFocus={() => setIsBarangDropdownOpen(true)}
                    placeholder="Ketik kode SKU atau nama barang untuk autocomplete..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                    required
                  />
                  {barangSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setBarangSearchText('');
                        setFormData((prev) => ({ ...prev, item_code: '', item_name: '' }));
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown Options */}
                {isBarangDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl divide-y divide-slate-100">
                    {barangSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Tidak ada barang yang cocok. Anda tetap dapat menginput manual di bawah.
                      </div>
                    ) : (
                      barangSearchResults.map((b) => (
                        <div
                          key={b.item_code}
                          onClick={() => handleSelectBarang(b)}
                          className="p-2 hover:bg-purple-50 cursor-pointer transition-colors flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-purple-900 font-mono text-[11px] block">
                              {b.item_code}
                            </span>
                            <span className="text-slate-800 text-xs font-semibold">{b.item_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {b.shelf_life || '24 Bulan'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Grid Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Kode SKU */}
                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Kode SKU</label>
                  <input
                    type="text"
                    value={formData.item_code || ''}
                    onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                {/* Nama Barang */}
                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Nama Barang</label>
                  <input
                    type="text"
                    value={formData.item_name || ''}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 text-xs"
                  />
                </div>

                {/* Tujuan */}
                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Tujuan / Permintaan</label>
                  <input
                    type="text"
                    value={formData.tujuan || ''}
                    onChange={(e) => setFormData({ ...formData, tujuan: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 text-xs"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Status Permintaan</label>
                  <select
                    value={formData.status || 'Permintaan Reco'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-purple-900 text-xs bg-white"
                  >
                    <option value="Permintaan Reco">Permintaan Reco</option>
                    <option value="In-Progress">In-Progress</option>
                    <option value="Disetujui">Disetujui</option>
                    <option value="Selesai Diproses">Selesai Diproses</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>

                {/* Qty & UOM */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Last Qty</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.last_qty || 0}
                      onChange={(e) => setFormData({ ...formData, last_qty: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">UOM</label>
                    <input
                      type="text"
                      value={formData.uom || 'CTN'}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Qty Convert & UOM Convert */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Qty Konversi</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.qty_convert || 0}
                      onChange={(e) => setFormData({ ...formData, qty_convert: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-emerald-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">UOM Konversi</label>
                    <input
                      type="text"
                      value={formData.uom_convert || 'PCS'}
                      onChange={(e) => setFormData({ ...formData, uom_convert: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-emerald-800 text-xs"
                    />
                  </div>
                </div>

                {/* SLoc & Lokasi */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">SLoc</label>
                    <input
                      type="text"
                      value={formData.sloc || 'SL03'}
                      onChange={(e) => setFormData({ ...formData, sloc: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Lokasi Gudang</label>
                    <input
                      type="text"
                      value={formData.location || 'WH-RECO-01'}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Batch & Expired Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Batch</label>
                    <input
                      type="text"
                      value={formData.batch || '-'}
                      onChange={(e) => {
                        const bVal = e.target.value;
                        const edResult = getEdIsoDateString(formData.item_code || '', formData.item_name || '', bVal);
                        const ed = edResult?.isoDate || '';
                        setFormData({ ...formData, batch: bVal, expired_date: ed || formData.expired_date });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Expired Date</label>
                    <input
                      type="date"
                      value={formData.expired_date || ''}
                      onChange={(e) => setFormData({ ...formData, expired_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* LPN / Serial Number with QR Live Preview */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-600 text-[10px] uppercase">LPN / Serial Number</label>
                    {qrCodeDataUrl && (
                      <span className="text-[10px] text-purple-700 font-bold flex items-center gap-1">
                        <QrCode size={11} /> QR Code Siap
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.lpn_serial_number || ''}
                      onChange={(e) => setFormData({ ...formData, lpn_serial_number: e.target.value })}
                      placeholder="LPN-REC-..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 text-xs"
                    />
                    {qrCodeDataUrl && (
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Preview"
                        className="w-8 h-8 rounded border border-slate-300 shrink-0"
                      />
                    )}
                  </div>
                </div>

                {/* Catatan / Detail Permintaan */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Catatan / Detail Permintaan</label>
                  <textarea
                    rows={2}
                    value={formData.note || ''}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Tuliskan catatan tambahan mengenai permintaan barang ini..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 text-xs outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPushing}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={15} />
                  <span>{isPushing ? 'Menyimpan...' : 'Simpan Data Reco'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL DATA RECO & QR CODE */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            {/* Detail Header */}
            <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-purple-200">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight m-0 uppercase">
                    Detail Permintaan Reco
                  </h3>
                  <span className="font-mono text-[10px] text-purple-200">{selectedItem.id_reco}</span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Detail Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Product Badge */}
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 uppercase font-mono block">
                  {selectedItem.item_code}
                </span>
                <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {selectedItem.item_name}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] font-semibold text-slate-600">
                  <span>Kategori: <strong>{selectedItem.category || 'Finished Good'}</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-purple-900">{selectedItem.status || 'Permintaan Reco'}</strong></span>
                </div>
              </div>

              {/* Quantities & Location */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Jumlah Qty</span>
                  <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                    {(selectedItem.last_qty || selectedItem.first_qty || 0).toLocaleString('id-ID')}{' '}
                    <span className="text-[10px] font-bold text-slate-500">{selectedItem.uom || 'CTN'}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase">Konversi Satuan</span>
                  <div className="text-sm font-black text-emerald-900 font-mono mt-0.5">
                    {(selectedItem.qty_convert || 0).toLocaleString('id-ID')}{' '}
                    <span className="text-[10px] font-bold text-emerald-700">{selectedItem.uom_convert || 'PCS'}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">SLoc & Lokasi</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    <strong className="font-mono text-purple-900">{selectedItem.sloc || 'SL03'}</strong> - {selectedItem.location || 'WH-RECO-01'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Batch & Expired</span>
                  <div className="font-semibold text-slate-800 font-mono mt-0.5">
                    {selectedItem.batch || '-'} | {selectedItem.expired_date || '-'}
                  </div>
                </div>
              </div>

              {/* LPN / Serial Number and QR Code */}
              {selectedItem.lpn_serial_number && selectedItem.lpn_serial_number !== '-' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">LPN / Serial Number</span>
                    <div className="font-mono font-black text-xs text-purple-900 mt-0.5">
                      {selectedItem.lpn_serial_number}
                    </div>
                    <button
                      onClick={() => handleCopyLpn(selectedItem.lpn_serial_number)}
                      className="mt-1 text-[11px] text-purple-700 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Salin Nomor LPN</span>
                    </button>
                  </div>

                  {qrCodeDataUrl && (
                    <div className="p-1 bg-white rounded-lg border border-slate-300 shadow-2xs">
                      <img src={qrCodeDataUrl} alt="QR LPN" className="w-16 h-16 rounded" />
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedItem.note && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <strong className="block text-[10px] uppercase font-bold text-amber-800 mb-0.5">Catatan:</strong>
                  {selectedItem.note}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 3: KONFIRMASI HAPUS SINGLE ITEM */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 m-0">Hapus Data Reco?</h3>
                <p className="text-xs text-slate-500 m-0">
                  {selectedItem.id_reco} - {selectedItem.item_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed m-0">
              Apakah Anda yakin ingin menghapus data permintaan barang ini secara permanen dari database cloud?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 4: UBAH STATUS MASSAL (BULK UPDATE STATUS) */}
      {/* ========================================================================= */}
      {showBulkStatusModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-purple-700">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 m-0">Ubah Status Massal</h3>
                <p className="text-xs text-slate-500 m-0">
                  {selectedIds.size} baris data terpilih
                </p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1.5">
                Pilih atau Ketik Status Baru:
              </label>
              <input
                type="text"
                value={bulkStatusInput}
                onChange={(e) => setBulkStatusInput(e.target.value)}
                placeholder="Contoh: Selesai Diproses / Disetujui"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-purple-900 focus:ring-2 focus:ring-purple-600 outline-none mb-2"
              />

              <div className="flex flex-wrap gap-1.5">
                {['Permintaan Reco', 'In-Progress', 'Disetujui', 'Selesai Diproses', 'Dibatalkan'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBulkStatusInput(s)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-purple-100 text-[11px] font-bold text-slate-700 hover:text-purple-900 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowBulkStatusModal(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkStatus}
                disabled={isUpdatingBulkStatus || !bulkStatusInput.trim()}
                className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                {isUpdatingBulkStatus ? 'Mengubah...' : 'Terapkan Status'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 5: HAPUS MASSAL (BULK DELETE) */}
      {/* ========================================================================= */}
      {showBulkDeleteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 m-0">Hapus {selectedIds.size} Data Reco?</h3>
                <p className="text-xs text-slate-500 m-0">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed m-0">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.size}</strong> data permintaan barang terpilih secara permanen?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkDelete}
                disabled={isDeletingBulk}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingBulk ? 'Menghapus...' : `Ya, Hapus ${selectedIds.size} Data`}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 6: PREVIEW IMPORT EXCEL */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-200">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight m-0 uppercase">
                    Preview Import Excel ({parsedExcelRows.length} Data)
                  </h3>
                  <p className="text-[11px] text-emerald-200 m-0">File: {excelFileName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  Ditemukan {parsedExcelRows.length} baris siap diimpor:
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-[11px] font-bold text-purple-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download size={12} />
                  <span>Unduh Template Excel Standar</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 font-bold text-slate-700 text-[10px] uppercase">
                    <tr>
                      <th className="p-2">No</th>
                      <th className="p-2">ID Reco</th>
                      <th className="p-2">Kode SKU</th>
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2">UOM</th>
                      <th className="p-2 text-right">Konversi</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedExcelRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="p-2 font-mono text-purple-900 font-bold">{row.id_reco}</td>
                        <td className="p-2 font-mono">{row.item_code}</td>
                        <td className="p-2 font-medium">{row.item_name}</td>
                        <td className="p-2 text-right font-mono font-bold">{row.last_qty}</td>
                        <td className="p-2 font-bold">{row.uom}</td>
                        <td className="p-2 text-right font-mono text-emerald-800 font-bold">{row.qty_convert}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[9px] font-bold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedExcelRows.length > 50 && (
                <p className="text-[11px] text-slate-400 italic m-0">
                  * Menampilkan 50 baris pertama dari total {parsedExcelRows.length} data.
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitExcelUpload}
                disabled={isPushing}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isPushing ? 'Mengimpor...' : `Simpan ${parsedExcelRows.length} Data`}</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
