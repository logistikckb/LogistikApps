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
  PackageCheck,
  MessageSquare,
  Share2,
  ExternalLink,
  CheckSquare,
  Square,
  MinusSquare,
  FileText,
  Globe,
  Settings
} from 'lucide-react';
import Fuse from 'fuse.js';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase, getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { RepackItem, DataBarang } from '../../types';
import { getEdIsoDateString, normalizeToIsoDate } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

interface RepackModuleProps {
  onNavigateToPenyiapan?: () => void;
}

export function RepackModule({ onNavigateToPenyiapan }: RepackModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

  // Primary Data State
  const [repackList, setRepackList] = useState<RepackItem[]>([]);
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
  const [sortField, setSortField] = useState<keyof RepackItem>('created_at');
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
  const [showGSheetModal, setShowGSheetModal] = useState(false);

  // Google Sheets Webhook Sync State
  const [gSheetConfig, setGSheetConfig] = useState(() => {
    const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
    const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';
    const defaultEnvSheetName = 'Repack';

    try {
      const specificSaved = localStorage.getItem('REPACK_GSHEET_WEBHOOK_CONFIG');
      const generalSaved = localStorage.getItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      const saved = specificSaved || generalSaved;
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawSheet = parsed.sheetName?.trim();
        const safeSheetName = (!rawSheet || rawSheet.toLowerCase() === 'incoming' || rawSheet.toLowerCase() === 'penyiapan')
          ? 'Repack'
          : rawSheet;

        return {
          webhookUrl: parsed.webhookUrl || defaultEnvUrl,
          spreadsheetId: parsed.spreadsheetId || defaultEnvSpreadsheetId,
          sheetName: safeSheetName,
          secretToken: parsed.secretToken || '',
          mode: (specificSaved && parsed.mode ? parsed.mode : 'append') as 'overwrite' | 'append'
        };
      }
    } catch {}
    return {
      webhookUrl: defaultEnvUrl,
      spreadsheetId: defaultEnvSpreadsheetId,
      sheetName: defaultEnvSheetName,
      secretToken: '',
      mode: 'append' as 'overwrite' | 'append'
    };
  });
  const [isConfigFromSupabase, setIsConfigFromSupabase] = useState(false);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [showGSheetAdvanced, setShowGSheetAdvanced] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [gSheetSyncResult, setGSheetSyncResult] = useState<{
    success: boolean;
    message: string;
    spreadsheetUrl?: string;
    updatedRows?: number;
    timestamp?: string;
  } | null>(null);

  // Load Global Webhook Config from Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadGlobalConfig() {
      try {
        const specificConfig = await getAppSettingFromSupabase('gsheet_sync_config_repack', null);
        const generalConfig = await getAppSettingFromSupabase('gsheet_sync_config', null);

        if (!isMounted) return;

        if (specificConfig && specificConfig.webhookUrl) {
          const rawSheet = specificConfig.sheetName?.trim();
          const safeSheetName = (!rawSheet || rawSheet.toLowerCase() === 'incoming' || rawSheet.toLowerCase() === 'penyiapan')
            ? 'Repack'
            : rawSheet;

          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: specificConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: specificConfig.spreadsheetId !== undefined ? specificConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: safeSheetName,
            secretToken: specificConfig.secretToken || prev.secretToken,
            mode: specificConfig.mode || 'append'
          }));
          setIsConfigFromSupabase(true);
        } else if (generalConfig && generalConfig.webhookUrl) {
          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: generalConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: generalConfig.spreadsheetId !== undefined ? generalConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: 'Repack',
            secretToken: generalConfig.secretToken || prev.secretToken,
            mode: 'append'
          }));
          setIsConfigFromSupabase(true);
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud Google Sheet Repack:', e);
      }
    }
    loadGlobalConfig();
    return () => { isMounted = false; };
  }, [showGSheetModal]);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<RepackItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<RepackItem>>({});
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
        dark: '#1e293b',
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBarangDropdownOpen, formData.item_code, formData.item_name]);

  // Voice Search (Speech-to-Text)
  const [isListeningSearch, setIsListeningSearch] = useState(false);
  const [speechFeedbackSearch, setSpeechFeedbackSearch] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const searchRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListeningSearch(true);
        setSpeechFeedbackSearch('Mendengarkan suara... Ucapkan SKU, nama barang, atau batch');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setCurrentPage(1);
        setSpeechFeedbackSearch(`Pencarian: "${transcript}"`);
        setTimeout(() => setSpeechFeedbackSearch(null), 3000);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition search error:', event.error);
        setIsListeningSearch(false);
        setSpeechFeedbackSearch('Gagal mengenali suara. Coba lagi.');
        setTimeout(() => setSpeechFeedbackSearch(null), 2500);
      };

      recognition.onend = () => {
        setIsListeningSearch(false);
      };

      searchRecognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeechToTextSearch = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Fitur Tidak Didukung', 'Browser belum mendukung Web Speech Recognition. Gunakan Chrome atau Edge.', 'warning');
      return;
    }

    if (isListeningSearch) {
      if (searchRecognitionRef.current) {
        try { searchRecognitionRef.current.stop(); } catch {}
      }
      setIsListeningSearch(false);
      setSpeechFeedbackSearch(null);
      return;
    }

    try {
      searchRecognitionRef.current?.start();
    } catch (e) {
      console.warn('Error starting speech search:', e);
    }
  }, [isListeningSearch, isSpeechSupported, showToast]);

  // Excel Upload States
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [parsedExcelRows, setParsedExcelRows] = useState<RepackItem[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [excelUploadTujuan, setExcelUploadTujuan] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    current: 0,
    total: 0,
    percentage: 0,
    statusText: ''
  });

  // Helper ID generator: RPK-YYYYMMDD-XXXX-YY
  const generateRepackId = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    const seq = (repackList.length + 1).toString().padStart(2, '0');
    return `RPK-${dateStr}-${random}-${seq}`;
  };

  // 1. Fetch Master Data Barang
  const fetchMasterData = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('data_barang')
        .select('*')
        .order('item_name', { ascending: true });
      if (!error && data) {
        setBarangList(data);
      }
    } catch (err) {
      console.error('Error loading data_barang:', err);
    }
  };

  // 2. Fetch Repack Data (from Supabase with localStorage cache fallback)
  const fetchRepackData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    setLastSupabaseError(null);

    // Initial cache load
    try {
      const cached = localStorage.getItem('repack_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRepackList(parsed);
          if (!silent) setIsLoading(false);
        }
      }
    } catch (e) {
      console.warn('Gagal membaca cache repack_cache_v1:', e);
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await fetchAllRowsFromSupabase<RepackItem>('data_repack', {
        orderBy: 'created_at',
        ascending: false
      });

      if (data && data.length > 0) {
        setRepackList(data);
        localStorage.setItem('repack_cache_v1', JSON.stringify(data));
      } else if (data && data.length === 0) {
        // Only set if we don't have local cached items or freshly empty
        setRepackList(prev => prev.length > 0 ? prev : []);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setLastSupabaseError(err?.message || 'Gagal terhubung ke database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRepackData();
    fetchMasterData();

    // Supabase Realtime Subscription for data_repack
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:data_repack')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'data_repack' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as RepackItem;
              setRepackList(prev => {
                if (prev.some(x => x.id_repack === newRow.id_repack)) return prev;
                const next = [newRow, ...prev];
                localStorage.setItem('repack_cache_v1', JSON.stringify(next));
                return next;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new as RepackItem;
              setRepackList(prev => {
                const next = prev.map(item => item.id_repack === updatedRow.id_repack ? updatedRow : item);
                localStorage.setItem('repack_cache_v1', JSON.stringify(next));
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { id_repack: string };
              setRepackList(prev => {
                const next = prev.filter(item => item.id_repack !== oldRow.id_repack);
                localStorage.setItem('repack_cache_v1', JSON.stringify(next));
                return next;
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

  // Filter Unique Options
  const uniqueTujuan = useMemo(() => {
    const set = new Set<string>();
    repackList.forEach(item => {
      if (item.tujuan && item.tujuan.trim()) {
        set.add(item.tujuan.trim());
      }
    });
    return Array.from(set).sort();
  }, [repackList]);

  const uniqueStatus = useMemo(() => {
    const set = new Set<string>();
    repackList.forEach(item => {
      if (item.status && item.status.trim()) {
        set.add(item.status.trim());
      }
    });
    return Array.from(set).sort();
  }, [repackList]);

  // Master SKU Filtered for autocomplete
  const filteredMasterBarang = useMemo(() => {
    if (!barangSearchText.trim()) return barangList.slice(0, 15);
    return fuzzySearchDataBarang(barangList, barangSearchText).slice(0, 15);
  }, [barangList, barangSearchText]);

  // Main Filtered & Sorted List
  const filteredRepackList = useMemo(() => {
    let result = [...repackList];

    // Filter Tujuan
    if (tujuanFilter !== 'ALL') {
      result = result.filter(item => (item.tujuan || '').trim() === tujuanFilter);
    }

    // Filter Status
    if (statusFilter !== 'ALL') {
      result = result.filter(item => (item.status || '').trim() === statusFilter);
    }

    // Global Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        (item.id_repack || '').toLowerCase().includes(q) ||
        (item.item_code || '').toLowerCase().includes(q) ||
        (item.item_name || '').toLowerCase().includes(q) ||
        (item.batch || '').toLowerCase().includes(q) ||
        (item.lpn_serial_number || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.sloc || '').toLowerCase().includes(q) ||
        (item.user_tally || '').toLowerCase().includes(q) ||
        (item.source || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q) ||
        (item.tujuan || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField] ?? '';
        let valB = b[sortField] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [repackList, tujuanFilter, statusFilter, searchQuery, sortField, sortOrder]);

  // Paginated List
  const paginatedRepackList = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredRepackList;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredRepackList.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRepackList, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    if (rowsPerPage === 'ALL' || filteredRepackList.length === 0) return 1;
    return Math.ceil(filteredRepackList.length / rowsPerPage);
  }, [filteredRepackList.length, rowsPerPage]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalLots = repackList.length;
    const totalPcs = repackList.reduce((acc, curr) => acc + (Number(curr.qty_convert) || Number(curr.last_qty) || 0), 0);
    const totalCtn = repackList.reduce((acc, curr) => acc + (Number(curr.last_qty) || 0), 0);
    const distinctSkus = new Set(repackList.map(i => (i.item_code || '').trim()).filter(Boolean)).size;
    const distinctBatches = new Set(repackList.map(i => (i.batch || '').trim()).filter(Boolean)).size;
    const fromPenyiapan = repackList.filter(i => (i.source || '').toLowerCase().includes('penyiapan')).length;
    const completedCount = repackList.filter(i => (i.status || '').toLowerCase().includes('selesai') || (i.status || '').toLowerCase().includes('completed')).length;

    return {
      totalLots,
      totalPcs,
      totalCtn,
      distinctSkus,
      distinctBatches,
      fromPenyiapan,
      completedCount
    };
  }, [repackList]);

  // Handlers for Form
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setBarangSearchText('');
    setIsBarangDropdownOpen(false);
    fetchMasterData();

    setFormData({
      id_repack: generateRepackId(),
      tujuan: 'Repacking Promo Bundle 2in1',
      item_code: '',
      item_name: '',
      category: 'Repack',
      location: 'WH-REPACK-01',
      location_type: 'Rack',
      first_qty: 0,
      last_qty: 0,
      uom: 'CTN',
      qty_convert: 0,
      uom_convert: 'PCS',
      lpn_serial_number: '-',
      batch: '',
      vendor_batch: '-',
      sloc: 'SL04',
      expired_date: '',
      destination_code: 'PROMO-BUNDLING',
      qc_code: 'QC-PASS',
      user_tally: 'Tally Repack',
      shelf_life: '24 Bulan',
      source: 'Penyiapan',
      user_input: currentUser?.nama || currentUser?.username || 'Team Promo',
      status: 'Completed',
      note: '-'
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: RepackItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setBarangSearchText(item.item_code ? `${item.item_code} - ${item.item_name}` : '');
    setIsBarangDropdownOpen(false);
    fetchMasterData();
    setFormData({ ...item });
    setShowFormModal(true);
  };

  const handleOpenDetailModal = (item: RepackItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleSelectBarangItem = (b: DataBarang) => {
    setFormData(prev => {
      const nextCode = b.item_code;
      const nextName = b.item_name;
      const currentBatch = (prev.batch || '').trim();
      let autoEd = prev.expired_date;
      let autoShelf = prev.shelf_life;

      if (currentBatch) {
        const comp = getEdIsoDateString(nextCode, nextName, currentBatch);
        if (comp && comp.isoDate) {
          autoEd = comp.isoDate;
          autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
        }
      }

      return {
        ...prev,
        item_code: nextCode,
        item_name: nextName,
        category: b.category || prev.category || 'Repack',
        uom: b.uom || prev.uom || 'CTN',
        expired_date: autoEd,
        shelf_life: autoShelf
      };
    });
    setBarangSearchText(`${b.item_code} - ${b.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  const handleBatchChange = (newBatch: string) => {
    const currentCode = (formData.item_code || '').trim();
    const currentName = (formData.item_name || '').trim();
    let autoEd = formData.expired_date;
    let autoShelf = formData.shelf_life;

    if (newBatch.trim()) {
      const comp = getEdIsoDateString(currentCode, currentName, newBatch.trim());
      if (comp && comp.isoDate) {
        autoEd = comp.isoDate;
        autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
      }
    }

    setFormData(prev => ({
      ...prev,
      batch: newBatch,
      expired_date: autoEd,
      shelf_life: autoShelf
    }));
  };

  // Save Add / Edit Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_code || !formData.item_name) {
      showToast('Data Belum Lengkap', 'Item code dan nama barang wajib diisi!', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const payload: RepackItem = {
      id_repack: formData.id_repack || generateRepackId(),
      tujuan: formData.tujuan || 'Repacking Promo Bundle 2in1',
      item_code: formData.item_code.trim(),
      item_name: formData.item_name.trim(),
      category: formData.category || 'Repack',
      location: formData.location || 'WH-REPACK-01',
      location_type: formData.location_type || 'Rack',
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || 0,
      uom: formData.uom || 'CTN',
      qty_convert: Number(formData.qty_convert) || Number(formData.last_qty) || 0,
      uom_convert: formData.uom_convert || 'PCS',
      lpn_serial_number: formData.lpn_serial_number || '-',
      batch: formData.batch || '-',
      vendor_batch: formData.vendor_batch || '-',
      sloc: formData.sloc || 'SL04',
      expired_date: normalizeToIsoDate(formData.expired_date),
      destination_code: formData.destination_code || 'PROMO-BUNDLING',
      qc_code: formData.qc_code || 'QC-PASS',
      user_tally: formData.user_tally || 'Tally Repack',
      shelf_life: formData.shelf_life || '24 Bulan',
      source: formData.source || 'Penyiapan',
      user_input: formData.user_input || currentUser?.nama || 'Admin',
      tanggal_update: nowIso,
      status: formData.status || 'Completed',
      note: formData.note || '-',
      created_at: formData.created_at || nowIso,
      updated_at: nowIso
    };

    // Optimistic local update
    if (isEditMode) {
      setRepackList(prev => prev.map(item => item.id_repack === payload.id_repack ? payload : item));
    } else {
      setRepackList(prev => [payload, ...prev]);
    }

    // Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_repack')
          .upsert(payload as any, { onConflict: 'id_repack' });
        if (error) {
          console.warn('Upsert warning data_repack:', error);
          showToast('Tersimpan Lokal', `Data tersimpan di perangkat. (Cloud sync: ${error.message})`, 'info');
        } else {
          showToast('Berhasil Disimpan', `Data Repack ${payload.id_repack} tersinkron ke cloud!`, 'success');
        }
      } catch (err: any) {
        showToast('Tersimpan Lokal', 'Data tersimpan di penyimpanan lokal.', 'info');
      }
    } else {
      showToast('Berhasil Disimpan', 'Data tersimpan di penyimpanan lokal.', 'success');
    }

    setShowFormModal(false);
  };

  // Delete Single Item
  const handleDeleteItem = async (id: string) => {
    showConfirm({
      title: 'Hapus Data Repack',
      message: `Apakah Anda yakin ingin menghapus data dengan No. Repack "${id}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        setRepackList(prev => prev.filter(item => item.id_repack !== id));
        if (isSupabaseConfigured) {
          try {
            await supabase.from('data_repack').delete().eq('id_repack', id);
          } catch (e) {
            console.error('Error deleting from supabase:', e);
          }
        }
        showToast('Data Dihapus', `Data ${id} berhasil dihapus.`, 'success');
        if (selectedItem?.id_repack === id) {
          setShowDetailModal(false);
        }
      }
    });
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    showConfirm({
      title: 'Hapus Massal Data Repack',
      message: `Hapus ${ids.length} data repack terpilih secara permanen?`,
      confirmText: `Ya, Hapus (${ids.length})`,
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        setIsDeletingBulk(true);
        setRepackList(prev => prev.filter(item => !selectedIds.has(item.id_repack)));
        if (isSupabaseConfigured) {
          try {
            await supabase.from('data_repack').delete().in('id_repack', ids);
          } catch (e) {
            console.error('Error bulk deleting from supabase:', e);
          }
        }
        setSelectedIds(new Set());
        setIsDeletingBulk(false);
        showToast('Hapus Massal Selesai', `${ids.length} data berhasil dihapus.`, 'success');
      }
    });
  };

  // Bulk Update Status
  const handleExecuteBulkStatus = async () => {
    if (selectedIds.size === 0 || !bulkStatusInput.trim()) return;
    const ids = Array.from(selectedIds);
    const newStatus = bulkStatusInput.trim();
    const nowIso = new Date().toISOString();

    setIsUpdatingBulkStatus(true);
    setRepackList(prev => prev.map(item => selectedIds.has(item.id_repack) ? { ...item, status: newStatus, updated_at: nowIso } : item));

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('data_repack')
          .update({ status: newStatus, updated_at: nowIso })
          .in('id_repack', ids);
      } catch (e) {
        console.error('Error updating bulk status:', e);
      }
    }

    setIsUpdatingBulkStatus(false);
    setShowBulkStatusModal(false);
    setSelectedIds(new Set());
    showToast('Status Diperbarui', `Status ${ids.length} data diubah menjadi "${newStatus}"`, 'success');
  };

  // Push All Local Data to Supabase Cloud
  const handlePushAllToCloud = async () => {
    if (!isSupabaseConfigured) {
      showToast('Koneksi Database', 'Supabase belum dikonfigurasi di file environment.', 'warning');
      return;
    }
    if (repackList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data repack untuk dikirim ke cloud.', 'info');
      return;
    }

    setIsPushing(true);
    try {
      const { error } = await supabase
        .from('data_repack')
        .upsert(repackList as any, { onConflict: 'id_repack' });

      if (error) {
        showToast('Gagal Push Cloud', error.message, 'danger');
      } else {
        showToast('Sukses Sinkron Cloud', `Semua (${repackList.length}) data repack berhasil tersinkron ke tabel data_repack!`, 'success');
      }
    } catch (err: any) {
      showToast('Error Cloud', err?.message || 'Terjadi kesalahan sinkronisasi', 'danger');
    } finally {
      setIsPushing(false);
    }
  };

  // Selection Checkbox Logic
  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedRepackList.length && paginatedRepackList.length > 0) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      paginatedRepackList.forEach(item => next.add(item.id_repack));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRepackList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    const dataToExport = filteredRepackList.map(item => ({
      'ID Repack': item.id_repack,
      'Tujuan': item.tujuan || '',
      'Item Code (SKU)': item.item_code,
      'Item Name': item.item_name,
      'Kategori': item.category || 'Repack',
      'Lokasi': item.location || '',
      'Tipe Lokasi': item.location_type || '',
      'First Qty': item.first_qty ?? 0,
      'Last Qty': item.last_qty ?? 0,
      'UOM': item.uom || 'CTN',
      'Qty Convert (PCS)': item.qty_convert ?? 0,
      'UOM Convert': item.uom_convert || 'PCS',
      'LPN / Serial No': item.lpn_serial_number || '',
      'Batch': item.batch || '',
      'Vendor Batch': item.vendor_batch || '',
      'SLoc': item.sloc || 'SL04',
      'Expired Date': item.expired_date || '',
      'Destination Code': item.destination_code || 'PROMO-BUNDLING',
      'QC Code': item.qc_code || 'QC-PASS',
      'User Tally': item.user_tally || 'Tally Repack',
      'Shelf Life': item.shelf_life || '24 Bulan',
      'Source': item.source || 'Penyiapan',
      'User Input': item.user_input || '',
      'Status': item.status || '',
      'Catatan': item.note || '',
      'Waktu Dibuat': item.created_at || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Repack');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Data_Repack_${dateStr}.xlsx`);
    showToast('Download Selesai', `File Laporan_Data_Repack_${dateStr}.xlsx berhasil diunduh.`, 'success');
  };

  // Download Template Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ID Repack (Opsional)': 'RPK-20260826-0001-01',
        'Tujuan': 'Repacking Promo Bundle 2in1',
        'Item Code': 'SKU-SAMPLE-01',
        'Item Name': 'SAMPLE PRODUK REPACK BUNDLING',
        'Category': 'Repack',
        'Location': 'WH-REPACK-01',
        'Location Type': 'Rack',
        'First Qty': 10,
        'Last Qty': 10,
        'UOM': 'CTN',
        'Qty Convert': 240,
        'UOM Convert': 'PCS',
        'LPN Serial Number': 'LPN-RPK-20260826-001',
        'Batch': '2386',
        'Vendor Batch': '-',
        'SLoc': 'SL04',
        'Expired Date (YYYY-MM-DD)': '2028-08-25',
        'Destination Code': 'PROMO-BUNDLING',
        'QC Code': 'QC-PASS',
        'User Tally': 'Tally Repack',
        'Shelf Life': '24 Bulan',
        'Source': 'Penyiapan',
        'User Input': 'Team Promo',
        'Status': 'Completed',
        'Note': 'Contoh format upload repack'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Repack');
    XLSX.writeFile(wb, 'Template_Upload_Data_Repack.xlsx');
    showToast('Template Siap', 'Template_Upload_Data_Repack.xlsx berhasil diunduh.', 'info');
  };

  // Parse Excel Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setExcelFileName(file.name);
    setIsProcessingExcel(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'File Excel tidak memiliki baris data.', 'warning');
          setParsedExcelRows([]);
          setIsProcessingExcel(false);
          return;
        }

        const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nowIso = new Date().toISOString();
        const dateStr = nowIso.slice(0, 10).replace(/-/g, '');

        const parsedList: RepackItem[] = rawJson.map((row, idx) => {
          const normalized: Record<string, any> = {};
          for (const k of Object.keys(row)) {
            normalized[normalizeKey(k)] = row[k];
          }

          const getVal = (candidates: string[]) => {
            for (const c of candidates) {
              const n = normalizeKey(c);
              if (normalized[n] !== undefined && normalized[n] !== null && String(normalized[n]).trim() !== '') {
                return normalized[n];
              }
            }
            return '';
          };

          const rawId = String(getVal(['id_repack', 'idrepack', 'no_repack', 'id']) || '').trim();
          const generatedId = rawId || `RPK-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}-${idx + 1}`;

          const itemCode = String(getVal(['item_code', 'itemcode', 'sku', 'kode_barang']) || '').trim();
          const itemName = String(getVal(['item_name', 'itemname', 'nama_barang', 'deskripsi']) || '').trim();

          const rawBatch = String(getVal(['batch', 'kode_batch', 'batch_no']) || '-').trim();
          let expDate = String(getVal(['expired_date', 'expireddate', 'ed', 'kadaluarsa']) || '').trim();

          if (!expDate && rawBatch && rawBatch !== '-') {
            const comp = getEdIsoDateString(itemCode, itemName, rawBatch);
            if (comp && comp.isoDate) {
              expDate = comp.isoDate;
            }
          }

          return {
            id_repack: generatedId,
            tujuan: excelUploadTujuan.trim() || String(getVal(['tujuan', 'destination', 'keperluan']) || 'Repacking Promo Bundle').trim(),
            item_code: itemCode,
            item_name: itemName,
            category: String(getVal(['category', 'kategori']) || 'Repack').trim(),
            location: String(getVal(['location', 'lokasi', 'rak']) || 'WH-REPACK-01').trim(),
            location_type: String(getVal(['location_type', 'tipe_lokasi']) || 'Rack').trim(),
            first_qty: Number(getVal(['first_qty', 'qty_awal', 'qty'])) || 0,
            last_qty: Number(getVal(['last_qty', 'qty_akhir', 'qty'])) || 0,
            uom: String(getVal(['uom', 'satuan']) || 'CTN').trim(),
            qty_convert: Number(getVal(['qty_convert', 'qty_pcs', 'konversi'])) || Number(getVal(['last_qty', 'qty'])) || 0,
            uom_convert: String(getVal(['uom_convert', 'satuan_konversi']) || 'PCS').trim(),
            lpn_serial_number: String(getVal(['lpn_serial_number', 'lpn', 'serial_number']) || `LPN-${generatedId}`).trim(),
            batch: rawBatch,
            vendor_batch: String(getVal(['vendor_batch', 'batch_vendor']) || '-').trim(),
            sloc: String(getVal(['sloc', 'storage_location']) || 'SL04').trim(),
            expired_date: normalizeToIsoDate(expDate),
            destination_code: String(getVal(['destination_code', 'kode_tujuan']) || 'PROMO-BUNDLING').trim(),
            qc_code: String(getVal(['qc_code', 'status_qc']) || 'QC-PASS').trim(),
            user_tally: String(getVal(['user_tally', 'tally']) || 'Tally Repack').trim(),
            shelf_life: String(getVal(['shelf_life', 'masa_simpan']) || '24 Bulan').trim(),
            source: String(getVal(['source', 'sumber_data', 'asal']) || 'Penyiapan').trim(),
            user_input: currentUser?.nama || 'Admin',
            tanggal_update: nowIso,
            status: String(getVal(['status', 'kondisi']) || 'Completed').trim(),
            note: String(getVal(['note', 'catatan', 'keterangan']) || '-').trim(),
            created_at: nowIso,
            updated_at: nowIso
          };
        });

        setParsedExcelRows(parsedList);
        showToast('File Terbaca', `${parsedList.length} baris siap diimpor ke database Repack.`, 'success');
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        showToast('Gagal Membaca File', err?.message || 'Format file Excel tidak valid.', 'danger');
        setParsedExcelRows([]);
      } finally {
        setIsProcessingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Commit Excel Upload
  const handleCommitExcelUpload = async () => {
    if (parsedExcelRows.length === 0) return;
    setUploadProgress({
      isUploading: true,
      current: 0,
      total: parsedExcelRows.length,
      percentage: 0,
      statusText: 'Menyimpan data repack ke database...'
    });

    try {
      const mergedList = [...parsedExcelRows, ...repackList.filter(item => !parsedExcelRows.some(p => p.id_repack === item.id_repack))];
      setRepackList(mergedList);
      localStorage.setItem('repack_cache_v1', JSON.stringify(mergedList));

      if (isSupabaseConfigured) {
        // Chunk batch upload (50 per batch)
        const chunkSize = 50;
        for (let i = 0; i < parsedExcelRows.length; i += chunkSize) {
          const chunk = parsedExcelRows.slice(i, i + chunkSize);
          await supabase.from('data_repack').upsert(chunk as any, { onConflict: 'id_repack' });
          const processed = Math.min(i + chunkSize, parsedExcelRows.length);
          setUploadProgress({
            isUploading: true,
            current: processed,
            total: parsedExcelRows.length,
            percentage: Math.round((processed / parsedExcelRows.length) * 100),
            statusText: `Tersinkron ${processed} dari ${parsedExcelRows.length} baris...`
          });
        }
      }

      showToast('Import Selesai', `${parsedExcelRows.length} data repack berhasil ditambahkan ke database!`, 'success');
      setShowExcelModal(false);
      setParsedExcelRows([]);
      setExcelFileName('');
    } catch (err: any) {
      showToast('Gagal Simpan', err?.message || 'Terjadi kesalahan saat menyimpan data.', 'danger');
    } finally {
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
    }
  };

  // Google Sheets Webhook Sync Handler
  const handleExecuteGSheetSync = async () => {
    const rawUrl = gSheetConfig.webhookUrl ? gSheetConfig.webhookUrl.trim() : '';
    if (!rawUrl) {
      showToast('URL Kosong', 'Harap isi URL Webhook Google Sheet / Apps Script.', 'warning');
      return;
    }

    setIsSyncingGSheet(true);
    setGSheetSyncResult(null);

    const itemsToSync = filteredRepackList.length > 0 ? filteredRepackList : repackList;
    const payload = {
      action: 'sync_logistik_repack',
      source: 'repack_module',
      module: 'repack',
      sheetName: gSheetConfig.sheetName || 'Repack',
      spreadsheetId: gSheetConfig.spreadsheetId || '',
      secretToken: gSheetConfig.secretToken || '',
      mode: gSheetConfig.mode || 'append',
      timestamp: new Date().toISOString(),
      user: currentUser?.nama || currentUser?.username || 'Admin',
      totalRows: itemsToSync.length,
      data: itemsToSync
    };

    try {
      localStorage.setItem('REPACK_GSHEET_WEBHOOK_CONFIG', JSON.stringify(gSheetConfig));
      const res = await fetch(rawUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      let resJson: any = null;
      try { resJson = await res.json(); } catch { resJson = { status: 'success' }; }

      const updatedCount = resJson?.updatedRows || itemsToSync.length;
      const sheetUrl = resJson?.spreadsheetUrl || (gSheetConfig.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${gSheetConfig.spreadsheetId.trim()}` : undefined);

      setGSheetSyncResult({
        success: true,
        message: `Berhasil sinkronisasi ${updatedCount} data repack ke Google Sheet "${gSheetConfig.sheetName}"!`,
        spreadsheetUrl: sheetUrl,
        updatedRows: updatedCount,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });
      showToast('Sinkronisasi Sukses', `Berhasil mengirim ${updatedCount} baris data ke Google Sheets.`, 'success');
    } catch (err: any) {
      // Fallback no-cors
      try {
        await fetch(rawUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        setGSheetSyncResult({
          success: true,
          message: `Berhasil mengirim ${itemsToSync.length} baris data ke Google Apps Script.`,
          updatedRows: itemsToSync.length,
          timestamp: new Date().toLocaleTimeString('id-ID')
        });
        showToast('Sinkronisasi Terkirim', 'Data berhasil dikirim ke Google Apps Script.', 'success');
      } catch (subErr: any) {
        setGSheetSyncResult({
          success: false,
          message: err?.message || 'Gagal menghubungi Webhook Google Sheet.'
        });
        showToast('Gagal Sinkronisasi', err?.message || 'Koneksi ke webhook gagal.', 'danger');
      }
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  return (
    <div className="space-y-3 text-slate-800 animate-fade-in">
      
      {/* HEADER BANNER - POLOS NO FILL / LIGHTWEIGHT */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80 shrink-0">
            <Boxes size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-800 m-0 uppercase">
                REPACK & BUNDLING
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold border border-slate-200">
                public.data_repack
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0 font-medium leading-relaxed">
              Manajemen Data Repacking Produk / Bundling Promo (Diterima & Ditransfer dari Modul Penyiapan)
            </p>
          </div>
        </div>

        {/* Navigation & Cloud Status Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onNavigateToPenyiapan && (
            <button
              onClick={onNavigateToPenyiapan}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Buka Modul Penyiapan Outbound"
            >
              <PackageCheck size={14} className="text-amber-700" />
              <span>Buka Penyiapan</span>
            </button>
          )}

          {isSupabaseConfigured && (
            <button
              onClick={handlePushAllToCloud}
              disabled={isPushing}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 text-xs font-bold border border-amber-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Push semua data lokal ke Supabase table: public.data_repack"
            >
              <Database size={13} className={isPushing ? 'animate-spin' : ''} />
              <span>{isPushing ? 'Menyinkronkan...' : 'Sync Cloud'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Lot / Baris</div>
          <div className="text-lg font-black text-slate-800 mt-0.5">{summaryMetrics.totalLots.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Qty (PCS)</div>
          <div className="text-lg font-black text-amber-700 mt-0.5">{summaryMetrics.totalPcs.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Karton (CTN)</div>
          <div className="text-lg font-black text-slate-700 mt-0.5">{summaryMetrics.totalCtn.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKU Berbeda</div>
          <div className="text-lg font-black text-indigo-700 mt-0.5">{summaryMetrics.distinctSkus}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dari Penyiapan</div>
          <div className="text-lg font-black text-blue-700 mt-0.5">{summaryMetrics.fromPenyiapan}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Selesai</div>
          <div className="text-lg font-black text-emerald-700 mt-0.5">{summaryMetrics.completedCount}</div>
        </div>
      </div>

      {/* ACTION TOOLBAR: BUTTONS & SEARCH */}
      <div className="p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5">
        
        {/* Top Button Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleOpenAddModal}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Tambah Data Repack Manual"
            >
              <Plus size={14} />
              <span>Tambah Data</span>
            </button>

            <button
              onClick={() => setShowExcelModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Unggah File Excel ke Database Repack"
            >
              <Upload size={14} className="text-amber-700" />
              <span>Upload Excel</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Export Laporan Excel Data Repack"
            >
              <Download size={14} className="text-blue-700" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
              title="Unduh Template Excel Format Kolom data_repack"
            >
              <FileSpreadsheet size={13} className="text-emerald-700" />
              <span>Template</span>
            </button>

            <button
              onClick={() => setShowGSheetModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sinkronisasi dengan Google Sheet via Webhook"
            >
              <Share2 size={13} />
              <span>Sync Google Sheets</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => {
                    setBulkStatusInput('');
                    setShowBulkStatusModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1 cursor-pointer"
                  title="Ubah Status Massal"
                >
                  <Edit2 size={12} />
                  <span>Ubah Status ({selectedIds.size})</span>
                </button>

                <button
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Hapus Massal Data Terpilih"
                >
                  <Trash2 size={12} />
                  <span>Hapus ({selectedIds.size})</span>
                </button>
              </>
            )}

            <button
              onClick={() => fetchRepackData(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-amber-600' : ''} />
            </button>
          </div>
        </div>

        {/* Search Bar & Voice Input */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <div className="md:col-span-6 relative flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SKU, Nama Barang, Batch, No. Repack, LPN, Lokasi, User..."
              className="w-full pl-9 pr-18 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={toggleSpeechToTextSearch}
                className={`p-1 rounded-lg text-xs font-bold transition-all flex items-center cursor-pointer ${
                  isListeningSearch
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
                title="Pencarian Suara (Speech-to-Text)"
              >
                {isListeningSearch ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
            </div>
          </div>

          {/* Filter Tujuan Dropdown */}
          <div className="md:col-span-3">
            <select
              value={tujuanFilter}
              onChange={(e) => {
                setTujuanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
            >
              <option value="ALL">Semua Tujuan Repack</option>
              {uniqueTujuan.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filter Status Dropdown */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
            >
              <option value="ALL">Semua Status</option>
              {uniqueStatus.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {speechFeedbackSearch && (
          <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Radio size={13} className="text-amber-600 animate-pulse" />
            <span>{speechFeedbackSearch}</span>
          </div>
        )}
      </div>

      {/* REPACK DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="p-2.5 text-center w-8">
                  <input
                    type="checkbox"
                    checked={paginatedRepackList.length > 0 && selectedIds.size === paginatedRepackList.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                <th className="p-2.5 whitespace-nowrap">No. Repack / LPN</th>
                <th className="p-2.5 whitespace-nowrap">SKU & Nama Barang</th>
                <th className="p-2.5 whitespace-nowrap">Lokasi</th>
                <th className="p-2.5 whitespace-nowrap text-right">Qty (CTN)</th>
                <th className="p-2.5 whitespace-nowrap text-right">Qty (PCS)</th>
                <th className="p-2.5 whitespace-nowrap">Batch & Expired</th>
                <th className="p-2.5 whitespace-nowrap">SLOC & QC</th>
                <th className="p-2.5 whitespace-nowrap">Tujuan / Keperluan</th>
                <th className="p-2.5 whitespace-nowrap">Status</th>
                <th className="p-2.5 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-amber-600" />
                      <span>Memuat data repack...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRepackList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Boxes size={24} className="text-slate-300" />
                      <p className="text-xs font-semibold text-slate-500 m-0">Belum ada data repack yang sesuai.</p>
                      <p className="text-[11px] text-slate-400 m-0">
                        Transfer data dari Modul Penyiapan atau klik "Tambah Data" / "Upload Excel".
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRepackList.map((item) => {
                  const isSelected = selectedIds.has(item.id_repack);
                  return (
                    <tr
                      key={item.id_repack}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        isSelected ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectItem(item.id_repack)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* No Repack & LPN */}
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-amber-800 text-[11px] flex items-center gap-1">
                          <span>{item.id_repack}</span>
                        </div>
                        {item.lpn_serial_number && item.lpn_serial_number !== '-' && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Barcode size={11} /> {item.lpn_serial_number}
                          </div>
                        )}
                      </td>

                      {/* SKU & Name */}
                      <td className="p-2.5">
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <span>{item.item_code}</span>
                          {item.category && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-1 max-w-xs" title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                          <MapPin size={11} className="text-amber-600" />
                          <span>{item.location || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.location_type || '-'}</div>
                      </td>

                      {/* Qty CTN */}
                      <td className="p-2.5 whitespace-nowrap text-right font-bold text-slate-700">
                        {item.last_qty !== undefined ? Number(item.last_qty).toLocaleString('id-ID') : 0} {item.uom || 'CTN'}
                      </td>

                      {/* Qty PCS Convert */}
                      <td className="p-2.5 whitespace-nowrap text-right font-black text-amber-700">
                        {item.qty_convert !== undefined ? Number(item.qty_convert).toLocaleString('id-ID') : 0} {item.uom_convert || 'PCS'}
                      </td>

                      {/* Batch & ED */}
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800 text-[11px]">
                          {item.batch || '-'}
                        </div>
                        {item.expired_date && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Calendar size={10} className="text-slate-400" /> {item.expired_date}
                          </div>
                        )}
                      </td>

                      {/* SLoc & QC */}
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                            {item.sloc || 'SL04'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                            {item.qc_code || 'QC-PASS'}
                          </span>
                        </div>
                      </td>

                      {/* Tujuan & Source */}
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-800 text-xs line-clamp-1 max-w-[180px]" title={item.tujuan}>
                          {item.tujuan || '-'}
                        </div>
                        {item.source && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={item.source}>
                            Asal: {item.source}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {item.status || 'Completed'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-2.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(item)}
                            className="p-1 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Detail"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id_repack)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus"
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

        {/* PAGINATION BAR */}
        <div className="p-2.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Baris per halaman:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setRowsPerPage(val === 'ALL' ? 'ALL' : Number(val));
                setCurrentPage(1);
              }}
              className="py-1 px-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700"
            >
              <option value="ALL">Semua ({filteredRepackList.length})</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500 font-medium">
              Menampilkan {paginatedRepackList.length} dari {filteredRepackList.length} data
            </span>
          </div>

          {rowsPerPage !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT REPACK FORM */}
      {/* ========================================================================= */}
      {showFormModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-2xl w-full shadow-2xl border border-amber-300 relative max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">
                    {isEditMode ? 'Edit Data Repack' : 'Tambah Data Repack'}
                  </h3>
                  <p className="text-xs text-slate-500 m-0">Tabel: public.data_repack</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. ID Repack:</label>
                  <input
                    type="text"
                    value={formData.id_repack || ''}
                    onChange={(e) => setFormData(p => ({ ...p, id_repack: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-amber-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tujuan Repack / Promo:</label>
                  <input
                    type="text"
                    value={formData.tujuan || ''}
                    onChange={(e) => setFormData(p => ({ ...p, tujuan: e.target.value }))}
                    placeholder="Contoh: Repacking Promo Bundle 2in1"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium"
                  />
                </div>
              </div>

              {/* Autocomplete SKU Master Barang */}
              <div ref={barangSearchContainerRef} className="relative">
                <label className="block font-bold text-slate-700 mb-1">
                  Item Code (SKU) & Nama Barang: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={barangSearchText}
                    onChange={(e) => {
                      setBarangSearchText(e.target.value);
                      setIsBarangDropdownOpen(true);
                      setFormData(p => ({ ...p, item_code: e.target.value }));
                    }}
                    onFocus={() => setIsBarangDropdownOpen(true)}
                    placeholder="Ketik kode SKU atau nama barang untuk memilih..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium"
                    required
                  />
                  {barangSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setBarangSearchText('');
                        setFormData(p => ({ ...p, item_code: '', item_name: '' }));
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {isBarangDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredMasterBarang.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">Tidak ada barang yang cocok</div>
                    ) : (
                      filteredMasterBarang.map(b => (
                        <div
                          key={b.item_code}
                          onClick={() => handleSelectBarangItem(b)}
                          className="p-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800">{b.item_code}</span>
                            <span className="text-slate-600 ml-2">{b.item_name}</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{b.uom || 'CTN'}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Barang Lengkap:</label>
                <input
                  type="text"
                  value={formData.item_name || ''}
                  onChange={(e) => setFormData(p => ({ ...p, item_name: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium"
                  required
                />
              </div>

              {/* Quantities */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Qty (CTN):</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? 0}
                    onChange={(e) => setFormData(p => ({ ...p, last_qty: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan (UOM):</label>
                  <input
                    type="text"
                    value={formData.uom || 'CTN'}
                    onChange={(e) => setFormData(p => ({ ...p, uom: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Qty Convert (PCS):</label>
                  <input
                    type="number"
                    value={formData.qty_convert ?? 0}
                    onChange={(e) => setFormData(p => ({ ...p, qty_convert: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">UOM Convert:</label>
                  <input
                    type="text"
                    value={formData.uom_convert || 'PCS'}
                    onChange={(e) => setFormData(p => ({ ...p, uom_convert: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
              </div>

              {/* Batch & ED */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch:</label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={(e) => handleBatchChange(e.target.value)}
                    placeholder="Contoh: 2386"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expired Date:</label>
                  <input
                    type="date"
                    value={formData.expired_date || ''}
                    onChange={(e) => setFormData(p => ({ ...p, expired_date: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shelf Life:</label>
                  <input
                    type="text"
                    value={formData.shelf_life || '24 Bulan'}
                    onChange={(e) => setFormData(p => ({ ...p, shelf_life: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
              </div>

              {/* Location & SLOC */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi:</label>
                  <input
                    type="text"
                    value={formData.location || 'WH-REPACK-01'}
                    onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Lokasi:</label>
                  <input
                    type="text"
                    value={formData.location_type || 'Rack'}
                    onChange={(e) => setFormData(p => ({ ...p, location_type: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLoc:</label>
                  <input
                    type="text"
                    value={formData.sloc || 'SL04'}
                    onChange={(e) => setFormData(p => ({ ...p, sloc: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">QC Code:</label>
                  <input
                    type="text"
                    value={formData.qc_code || 'QC-PASS'}
                    onChange={(e) => setFormData(p => ({ ...p, qc_code: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>
              </div>

              {/* LPN & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">LPN / Serial Number:</label>
                  <input
                    type="text"
                    value={formData.lpn_serial_number || ''}
                    onChange={(e) => setFormData(p => ({ ...p, lpn_serial_number: e.target.value }))}
                    placeholder="LPN-..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status:</label>
                  <input
                    type="text"
                    value={formData.status || 'Completed'}
                    onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Petugas Tally:</label>
                  <input
                    type="text"
                    value={formData.user_tally || 'Tally Repack'}
                    onChange={(e) => setFormData(p => ({ ...p, user_tally: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Note:</label>
                <textarea
                  rows={2}
                  value={formData.note || ''}
                  onChange={(e) => setFormData(p => ({ ...p, note: e.target.value }))}
                  placeholder="Keterangan tambahan..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md"
                >
                  {isEditMode ? 'Simpan Perubahan' : 'Tambah Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: DETAIL DATA REPACK */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl border border-amber-300 relative max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Rincian Data Repack</h3>
                  <p className="text-xs text-slate-500 m-0 font-mono">{selectedItem.id_repack}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Tujuan Repack</div>
                  <div className="text-sm font-black text-amber-950 mt-0.5">{selectedItem.tujuan || '-'}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-600 text-white shadow-2xs">
                  {selectedItem.status || 'Completed'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Item Code (SKU)</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">{selectedItem.item_code}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Kategori</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedItem.category || 'Repack'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Nama Barang</span>
                <span className="font-bold text-slate-800 text-xs">{selectedItem.item_name}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Qty Karton</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedItem.last_qty} {selectedItem.uom || 'CTN'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Qty Konversi</span>
                  <span className="font-black text-amber-800 text-xs">{selectedItem.qty_convert} {selectedItem.uom_convert || 'PCS'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Lokasi & SLOC</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedItem.location} ({selectedItem.sloc})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Batch & ED</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">{selectedItem.batch || '-'} | {selectedItem.expired_date || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">QC & Petugas</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedItem.qc_code} | {selectedItem.user_tally}</span>
                </div>
              </div>

              {selectedItem.note && selectedItem.note !== '-' && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Catatan</span>
                  <span className="font-medium text-slate-700 text-xs">{selectedItem.note}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenEditModal(selectedItem);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Edit Data
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD EXCEL FILE */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-xl w-full shadow-2xl border border-amber-300 relative max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Upload Excel Data Repack</h3>
                  <p className="text-xs text-slate-500 m-0">Impor data massal ke public.data_repack</p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Setel Tujuan Repack Seragam (Opsional):</label>
                <input
                  type="text"
                  value={excelUploadTujuan}
                  onChange={(e) => setExcelUploadTujuan(e.target.value)}
                  placeholder="Kosongkan jika menggunakan kolom Tujuan dari Excel"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-amber-500 transition-colors bg-slate-50/50">
                <Upload size={28} className="mx-auto text-amber-600 mb-2" />
                <p className="font-bold text-slate-700 mb-1">Pilih atau Seret File Excel (.xlsx / .xls)</p>
                <p className="text-slate-500 text-[11px] mb-3">Kolom: ID Repack, Item Code, Item Name, Qty, Batch, SLoc, Lokasi, dll.</p>
                <label className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                  <FileSpreadsheet size={15} />
                  <span>Pilih File</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
                </label>
                {excelFileName && (
                  <div className="mt-2 text-xs font-mono font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200 inline-block">
                    {excelFileName} ({parsedExcelRows.length} baris terbaca)
                  </div>
                )}
              </div>

              {uploadProgress.isUploading && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>{uploadProgress.statusText}</span>
                    <span>{uploadProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-600 h-2 transition-all duration-200" style={{ width: `${uploadProgress.percentage}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={handleDownloadTemplate}
                className="text-amber-800 hover:underline font-bold inline-flex items-center gap-1"
              >
                <Download size={13} /> Unduh Template Excel
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleCommitExcelUpload}
                  disabled={parsedExcelRows.length === 0 || uploadProgress.isUploading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  Simpan ({parsedExcelRows.length} Baris)
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: SYNC GOOGLE SHEETS */}
      {/* ========================================================================= */}
      {showGSheetModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl border border-emerald-300 relative max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Share2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Sinkronisasi Google Sheets</h3>
                  <p className="text-xs text-slate-500 m-0">Kirim data Repack ke Google Spreadsheet</p>
                </div>
              </div>
              <button
                onClick={() => setShowGSheetModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">URL Webhook Google Apps Script / Worker:</label>
                <input
                  type="url"
                  value={gSheetConfig.webhookUrl}
                  onChange={(e) => setGSheetConfig(p => ({ ...p, webhookUrl: e.target.value }))}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Sheet Tab:</label>
                  <input
                    type="text"
                    value={gSheetConfig.sheetName}
                    onChange={(e) => setGSheetConfig(p => ({ ...p, sheetName: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mode Kirim:</label>
                  <select
                    value={gSheetConfig.mode}
                    onChange={(e) => setGSheetConfig(p => ({ ...p, mode: e.target.value as any }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold"
                  >
                    <option value="append">Append (Tambahkan ke Bawah)</option>
                    <option value="overwrite">Overwrite (Timpa Penuh)</option>
                  </select>
                </div>
              </div>

              {gSheetSyncResult && (
                <div className={`p-3 rounded-xl border ${gSheetSyncResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                  <div className="font-bold mb-1">{gSheetSyncResult.success ? 'Sinkronisasi Berhasil!' : 'Gagal Sinkronisasi'}</div>
                  <p className="m-0 text-xs">{gSheetSyncResult.message}</p>
                  {gSheetSyncResult.spreadsheetUrl && (
                    <a
                      href={gSheetSyncResult.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-emerald-700 font-bold underline"
                    >
                      Buka Google Sheet <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowGSheetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Tutup
              </button>
              <button
                onClick={handleExecuteGSheetSync}
                disabled={isSyncingGSheet || !gSheetConfig.webhookUrl.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSyncingGSheet ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>{isSyncingGSheet ? 'Mengirim...' : `Kirim (${filteredRepackList.length} Baris)`}</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: BULK STATUS UPDATE */}
      {/* ========================================================================= */}
      {showBulkStatusModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-blue-300 relative text-left">
            <h3 className="text-base font-bold text-slate-800 mb-2">Ubah Status Massal</h3>
            <p className="text-xs text-slate-500 mb-3">
              Ubah status untuk {selectedIds.size} data repack terpilih:
            </p>
            <input
              type="text"
              value={bulkStatusInput}
              onChange={(e) => setBulkStatusInput(e.target.value)}
              placeholder="Contoh: Selesai Repack / Dalam Proses / Ready"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 mb-4 focus:bg-white outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBulkStatusModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkStatus}
                disabled={!bulkStatusInput.trim() || isUpdatingBulkStatus}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                {isUpdatingBulkStatus ? 'Menyimpan...' : 'Perbarui Status'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
