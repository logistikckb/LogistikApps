import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Trash2,
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
  Flame,
  Boxes,
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
import { PemusnahanItem, DataBarang } from '../../types';
import { getEdIsoDateString, normalizeToIsoDate } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

interface PemusnahanModuleProps {
  onNavigateToPenyiapan?: () => void;
}

export function PemusnahanModule({ onNavigateToPenyiapan }: PemusnahanModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

  // Primary Data State
  const [pemusnahanList, setPemusnahanList] = useState<PemusnahanItem[]>([]);
  const [barangList, setBarangList] = useState<DataBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filter State (Only Filter Tujuan as requested)
  const [searchQuery, setSearchQuery] = useState('');
  const [tujuanFilter, setTujuanFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof PemusnahanItem>('created_at');
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

  // Google Sheets / Cloudflare Worker Webhook Sync State
  const [gSheetConfig, setGSheetConfig] = useState(() => {
    const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
    const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';
    const defaultEnvSheetName = (import.meta.env.VITE_GSHEET_SHEET_NAME_PEMUSNAHAN as string) || 'pemusnahan';

    try {
      const specificSaved = localStorage.getItem('PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG');
      const generalSaved = localStorage.getItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      const saved = specificSaved || generalSaved;
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawSheet = parsed.sheetName?.trim();
        const safeSheetName = (!rawSheet || rawSheet.toLowerCase() === 'incoming' || rawSheet.toLowerCase() === 'penyiapan')
          ? 'pemusnahan'
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
      sheetName: defaultEnvSheetName || 'pemusnahan',
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

  // Load Global Webhook Config from Supabase when mount or modal opened
  useEffect(() => {
    let isMounted = true;
    async function loadGlobalConfig() {
      try {
        const specificConfig = await getAppSettingFromSupabase('gsheet_sync_config_pemusnahan', null);
        const generalConfig = await getAppSettingFromSupabase('gsheet_sync_config', null);

        if (!isMounted) return;

        if (specificConfig && specificConfig.webhookUrl) {
          const rawSheet = specificConfig.sheetName?.trim();
          const safeSheetName = (!rawSheet || rawSheet.toLowerCase() === 'incoming' || rawSheet.toLowerCase() === 'penyiapan')
            ? 'pemusnahan'
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
          // Inherit the connection URL and spreadsheet ID, but keep sheetName as 'pemusnahan' and mode as 'append'
          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: generalConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: generalConfig.spreadsheetId !== undefined ? generalConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: 'pemusnahan',
            secretToken: generalConfig.secretToken || prev.secretToken,
            mode: 'append'
          }));
          setIsConfigFromSupabase(true);
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud Google Sheet pemusnahan:', e);
      }
    }
    loadGlobalConfig();
    return () => { isMounted = false; };
  }, [showGSheetModal]);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<PemusnahanItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<PemusnahanItem>>({});
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
  const [parsedExcelRows, setParsedExcelRows] = useState<PemusnahanItem[]>([]);
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

  // Fetch data_pemusnahan from Supabase
  const fetchPemusnahanData = useCallback(async () => {
    setIsLoading(true);
    setLastSupabaseError(null);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAllRowsFromSupabase<PemusnahanItem>('data_pemusnahan', {
        orderBy: 'created_at',
        ascending: false
      });

      if (Array.isArray(data)) {
        setPemusnahanList(data);
        if (data.length > 0) {
          localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(data));
        } else {
          localStorage.removeItem('pemusnahan_cache_v1');
        }
      }
    } catch (err: any) {
      console.error('Unexpected error fetching data_pemusnahan:', err);
      setLastSupabaseError(err?.message || 'Gagal terhubung ke tabel data_pemusnahan');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Realtime Sync
  useEffect(() => {
    // 1. Load cached data from localStorage
    const cached = localStorage.getItem('pemusnahan_cache_v1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPemusnahanList(parsed);
        }
      } catch (e) {
        console.error('Error loading pemusnahan cache:', e);
      }
    }

    // 2. Fetch live data
    fetchMasterData();
    fetchPemusnahanData();

    // Supabase Realtime channel
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('pemusnahan_realtime_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_pemusnahan' }, () => {
          fetchPemusnahanData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchMasterData, fetchPemusnahanData]);

  // Save to local storage whenever pemusnahanList changes
  useEffect(() => {
    if (pemusnahanList.length > 0) {
      try {
        localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(pemusnahanList));
      } catch {}
    } else {
      try {
        localStorage.removeItem('pemusnahan_cache_v1');
      } catch {}
    }
  }, [pemusnahanList]);

  // Safe Batch Upsert for Supabase
  const safeBatchUpsertPemusnahan = async (records: PemusnahanItem[], batchSize = 50) => {
    if (!isSupabaseConfigured || records.length === 0) return { successCount: 0, error: null };

    let totalSuccess = 0;
    let lastErr: any = null;

    const sanitizedRecords = records.map(item => ({
      ...item,
      expired_date: normalizeToIsoDate(item.expired_date) || null as any,
      first_qty: Number(item.first_qty) || 0,
      last_qty: Number(item.last_qty) || 0,
      qty_convert: Number(item.qty_convert) || 0
    }));

    for (let i = 0; i < sanitizedRecords.length; i += batchSize) {
      const batch = sanitizedRecords.slice(i, i + batchSize);
      try {
        const { error } = await supabase
          .from('data_pemusnahan')
          .upsert(batch, { onConflict: 'id_pemusnahan' });

        if (error) {
          console.error(`Batch ${i / batchSize + 1} upsert error:`, error);
          lastErr = error;
        } else {
          totalSuccess += batch.length;
        }
      } catch (e: any) {
        lastErr = e;
      }
    }

    return { successCount: totalSuccess, error: lastErr };
  };

  // Voice Search Handler
  const toggleSpeechToTextSearch = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Fitur Tidak Didukung', 'Browser belum mendukung Web Speech Recognition.', 'warning');
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
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningSearch(true);
        setSpeechFeedbackSearch('Mendengarkan... Silakan bicara');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const spoken = (finalTranscript || interimTranscript).trim();
        if (spoken) {
          setSearchQuery(spoken);
          setSpeechFeedbackSearch(`Mencari: "${spoken}"`);
          setCurrentPage(1);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListeningSearch(false);
        setSpeechFeedbackSearch(null);
      };

      recognition.onend = () => {
        setIsListeningSearch(false);
        setTimeout(() => setSpeechFeedbackSearch(null), 3000);
      };

      searchRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech search:', err);
      setIsListeningSearch(false);
    }
  }, [isSpeechSupported, isListeningSearch, showToast]);

  // Voice handler for Product in Form
  const toggleSpeechToTextBarang = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Fitur Tidak Didukung', 'Browser belum mendukung Web Speech Recognition.', 'warning');
      return;
    }

    if (isListeningBarang) {
      if (barangRecognitionRef.current) {
        try { barangRecognitionRef.current.stop(); } catch {}
      }
      setIsListeningBarang(false);
      setSpeechFeedbackBarang(null);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningBarang(true);
        setIsBarangDropdownOpen(true);
        setSpeechFeedbackBarang('Mendengarkan... Sebutkan nama barang atau kode');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const spoken = (finalTranscript || interimTranscript).trim();
        if (spoken) {
          setBarangSearchText(spoken);
          setIsBarangDropdownOpen(true);
          setSpeechFeedbackBarang(`Terdeteksi: "${spoken}"`);
        }
      };

      recognition.onerror = () => {
        setIsListeningBarang(false);
        setSpeechFeedbackBarang(null);
      };

      recognition.onend = () => {
        setIsListeningBarang(false);
        setTimeout(() => setSpeechFeedbackBarang(null), 3000);
      };

      barangRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListeningBarang(false);
    }
  }, [isSpeechSupported, isListeningBarang, showToast]);

  // Filtered Master Barang for Autocomplete with Fuse.js Fuzzy Matching
  const filteredBarangList = useMemo(() => {
    const clean = barangSearchText.trim();
    if (!clean) return barangList;

    const tokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
    const directMatches = barangList.filter(b => {
      const combined = `${b.item_code || ''} ${b.item_name || ''} ${b.barcode || ''} ${b.category || ''} ${b.uom || ''}`.toLowerCase();
      return tokens.every(t => combined.includes(t));
    });

    if (directMatches.length > 0) {
      return directMatches;
    }

    return fuzzySearchDataBarang(barangList, clean, 0.38);
  }, [barangList, barangSearchText]);

  // Dynamic filter options: Unique Tujuan List
  const uniqueTujuans = useMemo(() => {
    const set = new Set<string>();
    pemusnahanList.forEach(item => {
      if (item.tujuan && item.tujuan !== '-') set.add(item.tujuan.trim());
    });
    return Array.from(set).sort();
  }, [pemusnahanList]);

  // Filtered & Sorted Pemusnahan Data (Filter dropdown strictly only Tujuan and Search Query)
  const filteredPemusnahan = useMemo(() => {
    return pemusnahanList.filter(item => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const combined = `${item.id_pemusnahan || ''} ${item.item_code || ''} ${item.item_name || ''} ${item.category || ''} ${item.location || ''} ${item.lpn_serial_number || ''} ${item.batch || ''} ${item.vendor_batch || ''} ${item.sloc || ''} ${item.destination_code || ''} ${item.qc_code || ''} ${item.user_tally || ''} ${item.user_input || ''} ${item.tujuan || ''} ${item.source || ''} ${item.status || ''} ${item.note || ''}`.toLowerCase();
        
        if (!combined.includes(q)) {
          return false;
        }
      }

      // 2. Filter Tujuan Only (as requested)
      if (tujuanFilter !== 'ALL') {
        if ((item.tujuan || '').toLowerCase().trim() !== tujuanFilter.toLowerCase().trim()) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [
    pemusnahanList,
    searchQuery,
    tujuanFilter,
    sortField,
    sortOrder
  ]);

  // KPI Calculations (Flexible based on filtered data, total qty in PCS)
  const metrics = useMemo(() => {
    let totalLots = filteredPemusnahan.length;
    let totalQtyPcs = 0;
    let disposedCount = 0;
    let readyDisposalCount = 0;
    const uniqueItems = new Set<string>();
    const uniqueBatches = new Set<string>();
    let fromPenyiapanCount = 0;

    filteredPemusnahan.forEach(item => {
      // Calculate Total Qty in PCS: prioritize qty_convert if set, otherwise last_qty or first_qty
      const qtyPcs = Number(item.qty_convert) || Number(item.last_qty) || Number(item.first_qty) || 0;
      totalQtyPcs += qtyPcs;

      if (item.item_code) uniqueItems.add(item.item_code.trim());
      if (item.batch && item.batch !== '-') uniqueBatches.add(item.batch.trim());

      const src = (item.source || '').toLowerCase();
      if (src.includes('penyiapan') || (item.note || '').toLowerCase().includes('penyiapan')) {
        fromPenyiapanCount++;
      }

      const st = (item.status || '').toLowerCase();
      if (st.includes('disposed') || st.includes('musnah') || st.includes('selesai') || /^\d+$/.test(st)) {
        disposedCount++;
      } else {
        readyDisposalCount++;
      }
    });

    return {
      totalLots,
      totalQtyPcs,
      uniqueSkuCount: uniqueItems.size,
      uniqueBatchCount: uniqueBatches.size,
      fromPenyiapanCount,
      disposedCount,
      readyDisposalCount
    };
  }, [filteredPemusnahan]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredPemusnahan;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPemusnahan.slice(start, start + rowsPerPage);
  }, [filteredPemusnahan, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === 'ALL' ? 1 : Math.ceil(filteredPemusnahan.length / rowsPerPage);

  // Sort toggle handler
  const handleSort = (field: keyof PemusnahanItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Reset Filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setTujuanFilter('ALL');
    setCurrentPage(1);
    showToast('Filter Direset', 'Semua kriteria filter telah dikembalikan ke kondisi awal', 'info');
  };

  // Selection handlers
  const handleToggleSelectRow = (id: string) => {
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

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPemusnahan.length && filteredPemusnahan.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPemusnahan.map(item => item.id_pemusnahan)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk Delete from Table AND Database (Supabase)
  const handleBulkDelete = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus massal data pemusnahan hanya dapat dilakukan oleh Admin!', 'danger');
      setShowBulkDeleteModal(false);
      return;
    }

    const targetIds = selectedIds.size > 0 
      ? Array.from(selectedIds)
      : filteredPemusnahan.map(i => i.id_pemusnahan);

    if (targetIds.length === 0) {
      showToast('Data Kosong', 'Tidak ada data pemusnahan yang dipilih untuk dihapus.', 'warning');
      setShowBulkDeleteModal(false);
      return;
    }

    setIsDeletingBulk(true);
    const targetIdSet = new Set(targetIds);

    // 1. Optimistic Local State & Cache Update
    setPemusnahanList(prev => prev.filter(item => !targetIdSet.has(item.id_pemusnahan)));
    try {
      const remaining = pemusnahanList.filter(item => !targetIdSet.has(item.id_pemusnahan));
      localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(remaining));
    } catch (e) {
      console.warn('Error saving pemusnahan cache:', e);
    }

    // 2. Supabase Cloud Deletion in chunks
    let cloudError = false;
    if (isSupabaseConfigured) {
      try {
        const chunkSize = 50;
        for (let i = 0; i < targetIds.length; i += chunkSize) {
          const chunk = targetIds.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('data_pemusnahan')
            .delete()
            .in('id_pemusnahan', chunk);

          if (error) {
            console.error('Error deleting chunk from data_pemusnahan:', error);
            cloudError = true;
          }
        }
      } catch (err: any) {
        console.error('Unexpected error in bulk delete:', err);
        cloudError = true;
      }
    }

    if (cloudError) {
      showToast('Peringatan', `Data dihapus dari tabel lokal, namun terjadi kendala koneksi cloud database.`, 'warning');
    } else {
      showToast('Hapus Massal Berhasil', `Sebanyak ${targetIds.length} data pemusnahan berhasil dihapus permanen dari TABEL & DATABASE!`, 'success');
    }

    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
    setIsDeletingBulk(false);
  };

  // Bulk Update Status / No. Dokumen (e.g. 49000000)
  const handleBulkUpdateStatus = async (statusValueToSet?: string) => {
    const rawVal = statusValueToSet !== undefined ? statusValueToSet : bulkStatusInput;
    const finalStatus = rawVal.trim();

    if (!finalStatus) {
      showToast('Status Kosong', 'Silakan masukkan nomor dokumen (contoh: 49000000) atau status pemusnahan.', 'warning');
      return;
    }

    // Target items: if specific items are checked, use them. Otherwise, use all currently filtered items!
    const targetItems = selectedIds.size > 0
      ? filteredPemusnahan.filter(item => selectedIds.has(item.id_pemusnahan))
      : filteredPemusnahan;

    if (targetItems.length === 0) {
      showToast('Data Kosong', 'Tidak ada data pemusnahan yang memenuhi filter / dipilih untuk diupdate.', 'warning');
      return;
    }

    const targetIds = targetItems.map(i => i.id_pemusnahan);
    const targetIdSet = new Set(targetIds);
    const nowIso = new Date().toISOString();

    setIsUpdatingBulkStatus(true);

    // 1. Optimistic Local State & Cache Update
    setPemusnahanList(prev => prev.map(item => {
      if (targetIdSet.has(item.id_pemusnahan)) {
        return { ...item, status: finalStatus, updated_at: nowIso };
      }
      return item;
    }));

    try {
      const updated = pemusnahanList.map(item => {
        if (targetIdSet.has(item.id_pemusnahan)) {
          return { ...item, status: finalStatus, updated_at: nowIso };
        }
        return item;
      });
      localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving pemusnahan cache:', e);
    }

    // 2. Supabase Cloud Update in chunks
    let cloudError = false;
    if (isSupabaseConfigured) {
      try {
        const chunkSize = 50;
        for (let i = 0; i < targetIds.length; i += chunkSize) {
          const chunk = targetIds.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('data_pemusnahan')
            .update({ status: finalStatus, updated_at: nowIso })
            .in('id_pemusnahan', chunk);

          if (error) {
            console.error('Error updating status chunk in data_pemusnahan:', error);
            cloudError = true;
          }
        }
      } catch (err: any) {
        console.error('Unexpected error updating status:', err);
        cloudError = true;
      }
    }

    if (cloudError) {
      showToast('Peringatan', `Status diperbarui di tabel lokal, namun terjadi kendala saat sync ke database cloud.`, 'warning');
    } else {
      showToast('Status Massal Diperbarui', `Status ${targetIds.length} baris data berhasil diubah menjadi "${finalStatus}" di TABEL & DATABASE!`, 'success');
    }

    setIsUpdatingBulkStatus(false);
    setShowBulkStatusModal(false);
    setBulkStatusInput('');
  };

  // Open Form Modal: Add New
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `PMS-${dateStr}-${randomSuffix}`;

    setFormData({
      id_pemusnahan: generatedId,
      item_code: '',
      item_name: '',
      category: 'Damaged',
      location: 'WH-REJECT-01',
      location_type: 'Quarantine',
      first_qty: 1,
      last_qty: 1,
      uom: 'CTN',
      qty_convert: 1,
      uom_convert: 'PCS',
      lpn_serial_number: `LPN-PMS-${dateStr}-${randomSuffix}`,
      batch: '',
      vendor_batch: '-',
      sloc: 'SL99',
      expired_date: '',
      destination_code: 'INCINERATOR',
      qc_code: 'QC-REJECT',
      user_tally: currentUser?.nama || 'Tally QC',
      shelf_life: 'Expired',
      source: 'Pemusnahan Langsung',
      tujuan: 'Pemusnahan Limbah Terkontrol',
      user_input: currentUser?.nama || 'QA Officer',
      tanggal_update: now.toISOString(),
      status: 'Siap Dimusnahkan',
      note: ''
    });
    setBarangSearchText('');
    setIsBarangDropdownOpen(false);
    setShowFormModal(true);
  };

  // Open Form Modal: Edit Item
  const handleOpenEditModal = (item: PemusnahanItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setFormData({ ...item });
    setBarangSearchText(`${item.item_code} - ${item.item_name}`);
    setIsBarangDropdownOpen(false);
    setShowFormModal(true);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (item: PemusnahanItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  // Select Master SKU from Autocomplete
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

  // Handle Form Change with Auto ED Calculation on Batch Input
  const handleFormInputChange = (field: keyof PemusnahanItem, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'first_qty' && (prev.last_qty === undefined || prev.last_qty === prev.first_qty)) {
        updated.last_qty = value;
      }

      if (field === 'batch' && value && value !== '-' && updated.item_code && updated.item_name) {
        const autoCalc = getEdIsoDateString(updated.item_code, updated.item_name, String(value));
        if (autoCalc && autoCalc.isoDate) {
          updated.expired_date = autoCalc.isoDate;
          updated.shelf_life = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
        }
      }

      return updated;
    });
  };

  // Save Form (Create or Update)
  const handleSaveFormData = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_code || !formData.item_name) {
      showToast('Data Tidak Lengkap', 'Item Code dan Item Name wajib diisi!', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const finalItem: PemusnahanItem = {
      id_pemusnahan: formData.id_pemusnahan || `PMS-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      tujuan: formData.tujuan || 'Pemusnahan Limbah Terkontrol',
      item_code: formData.item_code.trim(),
      item_name: formData.item_name.trim(),
      category: formData.category || 'Damaged',
      location: formData.location || 'WH-REJECT-01',
      location_type: formData.location_type || 'Quarantine',
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || 0,
      uom: formData.uom || 'CTN',
      qty_convert: Number(formData.qty_convert) || 0,
      uom_convert: formData.uom_convert || 'PCS',
      lpn_serial_number: formData.lpn_serial_number || '-',
      batch: formData.batch || '-',
      vendor_batch: formData.vendor_batch || '-',
      sloc: formData.sloc || 'SL99',
      expired_date: formData.expired_date || '-',
      destination_code: formData.destination_code || 'INCINERATOR',
      qc_code: formData.qc_code || 'QC-REJECT',
      user_tally: formData.user_tally || currentUser?.nama || 'Tally QC',
      shelf_life: formData.shelf_life || 'Expired',
      source: formData.source || 'Pemusnahan Langsung',
      user_input: currentUser?.nama || 'QA Officer',
      tanggal_update: nowIso,
      status: formData.status || 'Siap Dimusnahkan',
      note: formData.note || '',
      created_at: isEditMode && selectedItem?.created_at ? selectedItem.created_at : nowIso,
      updated_at: nowIso
    };

    // Optimistic UI Update
    if (isEditMode) {
      setPemusnahanList(prev => prev.map(item => item.id_pemusnahan === finalItem.id_pemusnahan ? finalItem : item));
      showToast('Data Diperbarui', `Data pemusnahan ${finalItem.id_pemusnahan} berhasil diperbarui`, 'success');
    } else {
      setPemusnahanList(prev => [finalItem, ...prev]);
      showToast('Data Ditambahkan', `Data pemusnahan ${finalItem.id_pemusnahan} berhasil disimpan`, 'success');
    }

    setShowFormModal(false);

    // Save to Supabase
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_pemusnahan')
          .upsert(finalItem, { onConflict: 'id_pemusnahan' });

        if (error) {
          console.error('Error saving to Supabase data_pemusnahan:', error);
          showToast('Peringatan Database', `Tersimpan secara lokal, namun gagal sync ke cloud: ${error.message}`, 'warning');
        } else {
          fetchPemusnahanData();
        }
      } catch (err: any) {
        console.error('Database save error:', err);
      }
    }
  };

  // Delete Handler (Admin only)
  const handleDeleteItem = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus data pemusnahan hanya dapat dilakukan oleh Admin!', 'danger');
      setShowDeleteModal(false);
      return;
    }

    if (!selectedItem) return;
    const idToDelete = selectedItem.id_pemusnahan;

    setPemusnahanList(prev => prev.filter(item => item.id_pemusnahan !== idToDelete));
    setShowDeleteModal(false);
    showToast('Terhapus', `Data pemusnahan ${idToDelete} berhasil dihapus`, 'info');

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_pemusnahan')
          .delete()
          .eq('id_pemusnahan', idToDelete);

        if (error) {
          console.error('Error deleting from data_pemusnahan:', error);
          showToast('Error Database', error.message, 'danger');
        }
      } catch (err: any) {
        console.error('Database delete error:', err);
      }
    }
  };

  // Sync All to Cloud
  const handlePushAllToSupabase = async () => {
    if (!isSupabaseConfigured) {
      showToast('Koneksi Diperlukan', 'Koneksi database Supabase belum aktif!', 'warning');
      return;
    }

    if (pemusnahanList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data pemusnahan untuk disinkronkan', 'info');
      return;
    }

    setIsPushing(true);
    try {
      const payload = pemusnahanList.map(item => ({
        ...item,
        updated_at: new Date().toISOString()
      }));

      const { successCount, error } = await safeBatchUpsertPemusnahan(payload, 50);

      if (error && successCount === 0) {
        console.error('Push error on data_pemusnahan:', error);
        setLastSupabaseError(error.message || JSON.stringify(error));
        showToast('Gagal Sinkronisasi', `Terjadi kendala: ${error.message || 'Periksa koneksi'}`, 'danger');
      } else {
        showToast('Sinkronisasi Sukses', `Semua ${successCount} data pemusnahan berhasil disinkronkan ke Database Supabase!`, 'success');
        fetchPemusnahanData();
      }
    } catch (err: any) {
      console.error('Unexpected error pushing pemusnahan:', err);
      showToast('Error Sinkronisasi', err?.message || 'Gagal mengirim data ke cloud', 'danger');
    } finally {
      setIsPushing(false);
    }
  };

  // Inline Cell Update directly from Table (Qty, Batch, Exp Date, Tujuan, Note, Uom, etc.)
  const handleInlineCellUpdate = async (item: PemusnahanItem, field: keyof PemusnahanItem, newValue: any) => {
    const oldValue = item[field];
    if (oldValue === newValue) return;

    let processedValue = newValue;
    if (field === 'last_qty' || field === 'first_qty' || field === 'qty_convert') {
      processedValue = Number(newValue) || 0;
    }

    const nowIso = new Date().toISOString();
    const updatedItem = { ...item, [field]: processedValue, updated_at: nowIso };

    // Auto calculate Expired Date if batch changed and item code/name exists
    if (field === 'batch' && processedValue && processedValue !== '-' && item.item_code && item.item_name) {
      const autoCalc = getEdIsoDateString(item.item_code, item.item_name, String(processedValue));
      if (autoCalc && autoCalc.isoDate) {
        updatedItem.expired_date = autoCalc.isoDate;
        updatedItem.shelf_life = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
      }
    }

    // 1. Optimistic Local State Update
    setPemusnahanList(prev => prev.map(p => p.id_pemusnahan === item.id_pemusnahan ? updatedItem : p));

    // Update Local Storage Cache
    try {
      const currentCache = localStorage.getItem('pemusnahan_cache_v1');
      if (currentCache) {
        const parsed = JSON.parse(currentCache);
        const nextCache = parsed.map((p: PemusnahanItem) => p.id_pemusnahan === item.id_pemusnahan ? updatedItem : p);
        localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(nextCache));
      }
    } catch (e) {
      console.warn('Cache write warning:', e);
    }

    // 2. Sync to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_pemusnahan')
          .update({
            [field]: processedValue,
            ...(updatedItem.expired_date !== item.expired_date ? { expired_date: updatedItem.expired_date, shelf_life: updatedItem.shelf_life } : {}),
            updated_at: nowIso
          })
          .eq('id_pemusnahan', item.id_pemusnahan);

        if (error) throw error;
      } catch (err: any) {
        console.error(`Failed to inline update ${String(field)} on Supabase:`, err);
        showToast('Peringatan Sync', `Gagal menyimpan perubahan ${String(field)} ke database: ${err.message}`, 'warning');
        // Revert on error
        setPemusnahanList(prev => prev.map(p => p.id_pemusnahan === item.id_pemusnahan ? item : p));
      }
    }
  };

  // Update Status directly from row
  const handleUpdateStatus = async (item: PemusnahanItem, newStatus: string) => {
    const oldStatus = item.status;
    
    setPemusnahanList(prev => prev.map(p => p.id_pemusnahan === item.id_pemusnahan ? { ...p, status: newStatus } : p));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_pemusnahan')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id_pemusnahan', item.id_pemusnahan);

        if (error) throw error;
        showToast('Status Diperbarui', `Status ${item.id_pemusnahan} diubah menjadi "${newStatus}"`, 'success');
      } catch (err: any) {
        console.error('Failed to update status', err);
        showToast('Error', 'Gagal mengubah status di server', 'danger');
        setPemusnahanList(prev => prev.map(p => p.id_pemusnahan === item.id_pemusnahan ? { ...p, status: oldStatus } : p));
      }
    }
  };

  // Download Excel Template
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Item Code': '21104508',
        'Item Name': 'KINO CANDY MINT 150G (EXPIRED)',
        'Category': 'Damaged',
        'Location': 'WH-REJECT-01',
        'Location Type': 'Quarantine',
        'First Qty': 50,
        'Last Qty': 50,
        'Uom': 'CTN',
        'Qty Convert': 50,
        'Uom Convert': 'PCS',
        'LPN/Serial Number': 'LPN-PMS-0001',
        'Batch': '0454',
        'Vendor Batch': 'VB-REJ-01',
        'SLOC': 'SL99',
        'Expired Date': '2025-02-14',
        'Destination Code': 'INCINERATOR',
        'QC Code': 'QC-REJECT',
        'User Tally': 'Budi Santoso',
        'Shelf Life': 'Expired',
        'Source': 'Penyiapan (PEN-20260301-0001)',
        'Tujuan': 'Pemusnahan Limbah Terkontrol',
        'Status': 'Siap Dimusnahkan',
        'Note': 'Barang rusak kemasan & kadaluwarsa dari penyiapan'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 16 }, // Item Code
      { wch: 35 }, // Item Name
      { wch: 18 }, // Category
      { wch: 16 }, // Location
      { wch: 16 }, // Location Type
      { wch: 12 }, // First Qty
      { wch: 12 }, // Last Qty
      { wch: 10 }, // Uom
      { wch: 14 }, // Qty Convert
      { wch: 14 }, // Uom Convert
      { wch: 22 }, // LPN/Serial Number
      { wch: 14 }, // Batch
      { wch: 16 }, // Vendor Batch
      { wch: 12 }, // SLOC
      { wch: 16 }, // Expired Date
      { wch: 16 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 24 }, // Source
      { wch: 24 }, // Tujuan
      { wch: 18 }, // Status
      { wch: 30 }  // Note
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Pemusnahan');
    XLSX.writeFile(wb, 'Template_Upload_Pemusnahan_Barang.xlsx');
    showToast('Template Terunduh', 'File Template_Upload_Pemusnahan_Barang.xlsx siap digunakan (tanpa ID Pemusnahan, ID dibuat otomatis oleh sistem)', 'success');
  };

  // Export Data to Excel
  const exportDataToExcel = () => {
    if (filteredPemusnahan.length === 0) {
      showToast('Data Kosong', 'Tidak ada data pemusnahan yang memenuhi filter untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredPemusnahan.map((item, idx) => ({
      'No': idx + 1,
      'ID Pemusnahan': item.id_pemusnahan || '',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Pemusnahan');
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Pemusnahan_Barang_${timestamp}.xlsx`);
    showToast('Ekspor Berhasil', `${exportRows.length} baris data pemusnahan berhasil diekspor ke Excel`, 'success');
  };

  // Open Excel Import Modal
  const handleOpenExcelModal = () => {
    setParsedExcelRows([]);
    setExcelFileName('');
    setShowExcelModal(true);
  };

  // Handle File Input Selection
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
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'Tidak ada baris data yang terbaca di file Excel.', 'warning');
          setIsProcessingExcel(false);
          return;
        }

        const rawList: PemusnahanItem[] = rawJson.map((row: any, idx: number) => {
          const getVal = (aliases: string[]): any => {
            for (const alias of aliases) {
              if (row[alias] !== undefined && row[alias] !== '') return row[alias];
              const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === alias.trim().toLowerCase());
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
            }
            return '';
          };

          const itemCode = String(getVal(['item_code', 'itemcode', 'Item Code', 'Kode Barang', 'SKU', 'kode_barang']) || '').trim();
          const itemName = String(getVal(['item_name', 'itemname', 'Item Name', 'Nama Barang', 'nama_barang', 'description']) || '').trim();
          const category = String(getVal(['category', 'Category', 'kategori', 'Jenis', 'kelompok', 'group']) || '').trim();
          const location = String(getVal(['location', 'Location', 'lokasi', 'rak', 'bin', 'wh_location', 'storage_location']) || '').trim();
          const locationType = String(getVal(['location_type', 'locationtype', 'Location Type', 'tipe_lokasi', 'jenislokasi']) || '').trim();
          const firstQtyRaw = getVal(['first_qty', 'firstqty', 'First Qty', 'Qty Awal', 'qty_awal', 'qty', 'jumlah']);
          const lastQtyRaw = getVal(['last_qty', 'lastqty', 'Last Qty', 'Qty Akhir', 'qty_akhir']);
          const firstQty = firstQtyRaw !== '' ? Number(firstQtyRaw) || 0 : (lastQtyRaw !== '' ? Number(lastQtyRaw) || 0 : 0);
          const lastQty = lastQtyRaw !== '' ? Number(lastQtyRaw) || 0 : (firstQtyRaw !== '' ? Number(firstQtyRaw) || 0 : 0);
          const uom = String(getVal(['uom', 'Uom', 'UOM', 'Satuan', 'satuan', 'unit']) || '').trim();
          const qtyConvertRaw = getVal(['qty_convert', 'qtyconvert', 'Qty Convert', 'Konversi Qty', 'qty_konversi']);
          const qtyConvert = qtyConvertRaw !== '' ? Number(qtyConvertRaw) || 0 : (lastQty !== undefined ? lastQty : 0);
          const uomConvert = String(getVal(['uom_convert', 'uomconvert', 'Uom Convert', 'Satuan Konversi', 'satuan_konversi']) || '').trim();
          const lpn = String(getVal(['lpn_serial_number', 'lpn', 'LPN', 'LPN/Serial Number', 'Serial Number', 'serial_number', 'sn']) || '').trim();
          const batch = String(getVal(['batch', 'Batch', 'No Batch', 'nobatch', 'kode_batch', 'lot', 'batch_no']) || '').trim();
          const vendorBatch = String(getVal(['vendor_batch', 'vendorbatch', 'Vendor Batch', 'Batch Vendor', 'batchvendor']) || '').trim();
          const sloc = String(getVal(['sloc', 'SLOC', 'SLoc', 'storage_location', 'gudang']) || '').trim();

          let expDate = String(getVal(['expired_date', 'expireddate', 'Expired Date', 'exp_date', 'tanggal_ed', 'ed', 'exp', 'kadaluarsa']) || '').trim();
          if (/^\d{5}$/.test(expDate)) {
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + Number(expDate) * 86400000);
            if (!isNaN(dateObj.getTime())) {
              expDate = dateObj.toISOString().slice(0, 10);
            }
          }

          const destCode = String(getVal(['destination_code', 'destinationcode', 'Destination Code', 'kode_tujuan', 'destination_loc']) || '').trim();
          let shelfLife = String(getVal(['shelf_life', 'shelflife', 'Shelf Life', 'masa_simpan']) || '').trim();

          const qcCode = String(getVal(['qc_code', 'qccode', 'QC Code', 'Status QC', 'qc', 'statusqc']) || '').trim().toUpperCase();
          const userTally = String(getVal(['user_tally', 'usertally', 'User Tally', 'Petugas Tally', 'tally', 'checker']) || '').trim();
          const source = String(getVal(['source', 'Source', 'Sumber', 'asal', 'asal_barang']) || '').trim();
          const rawId = String(getVal(['id_pemusnahan', 'idpemusnahan', 'ID Pemusnahan', 'id']) || '').trim();
          const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randSuffix = Math.floor(1000 + Math.random() * 9000);
          const idGenerated = rawId || `PMS-${dateTag}-${randSuffix}-${String(idx + 1).padStart(4, '0')}`;
          const tujuan = String(getVal(['tujuan', 'Tujuan', 'destination', 'tujuan_pemusnahan', 'destinasi']) || '').trim();
          const status = String(getVal(['status', 'Status', 'status_pemusnahan', 'kondisi']) || '').trim();
          const note = String(getVal(['note', 'Note', 'catatan', 'keterangan', 'remark']) || '').trim();

          return {
            id_pemusnahan: idGenerated,
            item_code: itemCode,
            item_name: itemName,
            category,
            location,
            location_type: locationType,
            first_qty: firstQty,
            last_qty: lastQty,
            uom,
            qty_convert: qtyConvert,
            uom_convert: uomConvert,
            lpn_serial_number: lpn,
            batch,
            vendor_batch: vendorBatch,
            sloc,
            expired_date: expDate,
            destination_code: destCode,
            qc_code: qcCode,
            user_tally: userTally,
            shelf_life: shelfLife,
            source,
            tujuan,
            user_input: currentUser?.nama || currentUser?.username || '',
            tanggal_update: new Date().toISOString(),
            status,
            note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }).filter(r => (r.item_code && r.item_code.trim() !== '') || (r.item_name && r.item_name.trim() !== '') || (r.batch && r.batch.trim() !== ''));

        const pemusnahanMap = new Map<string, PemusnahanItem>();
        rawList.forEach(item => {
          pemusnahanMap.set(item.id_pemusnahan.toLowerCase(), item);
        });
        const formatted = Array.from(pemusnahanMap.values());

        setParsedExcelRows(formatted);
        if (formatted.length > 0) {
          showToast('Excel Terbaca', `${formatted.length} baris data pemusnahan valid ditemukan`, 'info');
        } else {
          showToast('Format Kolom Tidak Cocok', 'Kolom Item Code dan Item Name tidak ditemukan. Silakan unduh Template Excel.', 'warning');
        }
      } catch (err) {
        console.error('Error parsing Excel:', err);
        showToast('Gagal Membaca File', 'Terjadi kesalahan saat memproses file Excel.', 'danger');
      } finally {
        setIsProcessingExcel(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Commit Parsed Excel to Database & Local State
  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) return;

    setIsProcessingExcel(true);
    try {
      const mergedMap = new Map<string, PemusnahanItem>();
      pemusnahanList.forEach(item => {
        mergedMap.set(item.id_pemusnahan.toLowerCase(), item);
      });
      parsedExcelRows.forEach(item => {
        mergedMap.set(item.id_pemusnahan.toLowerCase(), item);
      });
      const finalMerged = Array.from(mergedMap.values());
      setPemusnahanList(finalMerged);

      if (isSupabaseConfigured) {
        const { successCount, error } = await safeBatchUpsertPemusnahan(parsedExcelRows, 50);
        if (error && successCount === 0) {
          showToast('Peringatan Database', `Tersimpan di memori lokal, namun gagal sync ke cloud: ${error.message}`, 'warning');
        } else {
          showToast('Import Berhasil', `${successCount} data pemusnahan berhasil diunggah ke Database Supabase!`, 'success');
          fetchPemusnahanData();
        }
      } else {
        showToast('Import Lokal Selesai', `${parsedExcelRows.length} data pemusnahan berhasil disimpan di penyimpanan lokal!`, 'success');
      }

      setShowExcelModal(false);
      setParsedExcelRows([]);
      setExcelFileName('');
    } catch (err: any) {
      console.error('Error committing excel import:', err);
      showToast('Gagal Import', err?.message || 'Terjadi kesalahan saat menyimpan data import', 'danger');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Google Sheets Config & Sync Handlers
  const handleSaveGSheetConfig = (newConfig: typeof gSheetConfig) => {
    setGSheetConfig(newConfig);
    try {
      localStorage.setItem('PEMUSNAHAN_GSHEET_WEBHOOK_CONFIG', JSON.stringify(newConfig));
    } catch {}
  };

  const handleSaveConfigToSupabase = async () => {
    const rawUrl = gSheetConfig.webhookUrl ? gSheetConfig.webhookUrl.trim() : '';
    if (!rawUrl) {
      showToast('URL Webhook Kosong', 'Harap masukkan URL Webhook sebelum menyimpan ke cloud.', 'warning');
      return;
    }

    setIsSavingToSupabase(true);
    handleSaveGSheetConfig(gSheetConfig);

    const res = await saveAppSettingToSupabase(
      'gsheet_sync_config_pemusnahan',
      gSheetConfig,
      currentUser?.nama || currentUser?.username || 'Admin'
    );
    setIsSavingToSupabase(false);

    if (res.success) {
      setIsConfigFromSupabase(true);
      showToast('Tersimpan di Cloud Database', res.message || 'Konfigurasi aktif untuk semua perangkat!', 'success');
    } else {
      showToast('Perhatian', res.message || 'Gagal menyimpan ke Supabase.', 'warning');
      if (res.message?.includes('app_settings')) {
        setShowSqlHelp(true);
      }
    }
  };

  const handleExecuteGSheetSync = async () => {
    const rawUrl = gSheetConfig.webhookUrl ? gSheetConfig.webhookUrl.trim() : '';
    if (!rawUrl) {
      showToast('URL Webhook Kosong', 'Harap masukkan URL Webhook Google Apps Script atau Cloudflare Worker.', 'warning');
      return;
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      showToast('Format URL Tidak Valid', 'URL Webhook harus diawali dengan https:// atau http://', 'warning');
      return;
    }

    const itemsToSync = filteredPemusnahan.length > 0 ? filteredPemusnahan : pemusnahanList;
    if (itemsToSync.length === 0) {
      showToast('Data Kosong', 'Tidak ada data pemusnahan untuk dikirim ke Google Sheets.', 'warning');
      return;
    }

    setIsSyncingGSheet(true);
    setGSheetSyncResult(null);

    try {
      const headers = [
        'ID Pemusnahan',
        'Item Code',
        'Nama Barang',
        'Kategori',
        'Lokasi',
        'Tipe Lokasi',
        'Qty Awal',
        'Qty Akhir',
        'UOM',
        'Qty Convert',
        'UOM Convert',
        'LPN / SN',
        'Batch',
        'Vendor Batch',
        'SLOC',
        'Expired Date',
        'Kode Tujuan',
        'Status QC',
        'User Tally',
        'Shelf Life',
        'Sumber',
        'Tujuan',
        'User Input',
        'Tanggal Update',
        'Status',
        'Catatan / Note'
      ];

      const rows = itemsToSync.map(item => [
        item.id_pemusnahan || '-',
        item.item_code || '-',
        item.item_name || '-',
        item.category || '-',
        item.location || '-',
        item.location_type || '-',
        Number(item.first_qty) || 0,
        Number(item.last_qty) || 0,
        item.uom || '-',
        Number(item.qty_convert) || 0,
        item.uom_convert || '-',
        item.lpn_serial_number || '-',
        item.batch || '-',
        item.vendor_batch || '-',
        item.sloc || '-',
        item.expired_date || '-',
        item.destination_code || '-',
        item.qc_code || '-',
        item.user_tally || '-',
        item.shelf_life || '-',
        item.source || '-',
        item.tujuan || '-',
        item.user_input || '-',
        item.tanggal_update ? item.tanggal_update.substring(0, 10) : (item.created_at ? item.created_at.substring(0, 10) : '-'),
        item.status || '-',
        item.note || '-'
      ]);

      const payload = {
        action: 'sync_pemusnahan',
        mode: gSheetConfig.mode || 'append',
        sheetName: gSheetConfig.sheetName || 'pemusnahan',
        spreadsheetId: gSheetConfig.spreadsheetId?.trim() || '',
        secretToken: gSheetConfig.secretToken || '',
        timestamp: new Date().toISOString(),
        totalRows: itemsToSync.length,
        headers,
        rows,
        data: itemsToSync
      };

      handleSaveGSheetConfig(gSheetConfig);

      const isDirectGoogleScript = rawUrl.includes('script.google.com');
      let responseJson: any = null;
      let syncSucceeded = false;
      let executionMode: 'cors' | 'no-cors' = 'cors';

      try {
        const res = await fetch(rawUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          try {
            responseJson = await res.json();
          } catch {
            responseJson = { status: 'success' };
          }
          syncSucceeded = true;
          executionMode = 'cors';
        } else {
          let errMsg = `HTTP Error ${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody.message) errMsg = errBody.message;
          } catch {}
          throw new Error(errMsg);
        }
      } catch (directErr: any) {
        if (isDirectGoogleScript || directErr?.message?.includes('Failed to fetch') || directErr?.name === 'TypeError') {
          try {
            await fetch(rawUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: {
                'Content-Type': 'text/plain;charset=utf-8'
              },
              body: JSON.stringify(payload)
            });
            syncSucceeded = true;
            executionMode = 'no-cors';
            responseJson = {
              status: 'success',
              message: `Data ${itemsToSync.length} baris pemusnahan berhasil dikirim ke Google Apps Script Webhook.`
            };
          } catch (noCorsErr: any) {
            throw directErr;
          }
        } else {
          throw directErr;
        }
      }

      if (!syncSucceeded) {
        throw new Error('Gagal mengirim data ke Webhook tujuan.');
      }

      const updatedCount = responseJson?.updatedRows || itemsToSync.length;
      const sheetUrl = responseJson?.spreadsheetUrl || (gSheetConfig.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${gSheetConfig.spreadsheetId.trim()}` : undefined);

      const successMsg = executionMode === 'no-cors'
        ? `Berhasil mengirim ${updatedCount} baris data ke Google Apps Script (Sheet: "${gSheetConfig.sheetName || 'pemusnahan'}").`
        : (responseJson?.message || `Berhasil sinkronisasi ${updatedCount} baris data ke Google Sheet "${gSheetConfig.sheetName || 'pemusnahan'}"!`);

      setGSheetSyncResult({
        success: true,
        message: successMsg,
        spreadsheetUrl: sheetUrl,
        updatedRows: updatedCount,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      showToast('Sinkronisasi Berhasil', `Berhasil upload ${updatedCount} data pemusnahan ke Google Sheets!`, 'success');
    } catch (err: any) {
      console.error('Pemusnahan GSheet sync error:', err);
      const isGoogleUrl = gSheetConfig.webhookUrl?.includes('script.google.com');
      const guidance = isGoogleUrl
        ? 'Pastikan Deployment Web App di Google Apps Script telah diset "Who has access: Anyone" (Siapa saja).'
        : 'Pastikan URL Webhook / Cloudflare Worker aktif dan dapat diakses.';

      setGSheetSyncResult({
        success: false,
        message: `${err?.message || 'Terjadi kesalahan jaringan/CORS'}. ${guidance}`,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      showToast('Gagal Sinkronisasi', err?.message || 'Gagal mengirim data ke Google Sheets.', 'danger');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast('Tersalin', `${label} "${text}" disalin ke clipboard`, 'info');
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 animate-fade-in text-slate-800">
      
      {/* ========================================================================= */}
      {/* ACTION TOOLBAR BUTTONS */}
      {/* ========================================================================= */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-1.5">
        
        {/* Left Side: CRUD & Import Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tambah Pemusnahan Manual */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Tambah Data Pemusnahan Manual"
          >
            <Plus size={14} />
            <span>Tambah Pemusnahan</span>
          </button>

          {/* Upload Excel Button */}
          <button
            onClick={handleOpenExcelModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer bg-slate-800 hover:bg-slate-900 active:bg-black text-white shadow-2xs hover:shadow-xs"
            title="Upload Data Excel (data_pemusnahan)"
          >
            <Upload size={13} />
            <span>Upload Excel</span>
          </button>

          {/* Download Template Excel */}
          <button
            onClick={downloadExcelTemplate}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Download Template Format Excel Sesuai Database"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            <span>Template Excel</span>
          </button>

          {/* Export Excel Data */}
          <button
            onClick={exportDataToExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Ekspor Data Pemusnahan ke File Excel (.xlsx)"
          >
            <Download size={13} className="text-blue-700" />
            <span>Ekspor Excel</span>
          </button>

          {/* Tombol Sinkron ke Google Sheets / Cloudflare Worker */}
          <button
            type="button"
            onClick={() => setShowGSheetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Kirim dan sinkronkan data pemusnahan langsung ke Google Sheets"
          >
            <Share2 size={13} />
            <span>Sync Google Sheets</span>
          </button>
        </div>

        {/* Right Side: Cloud Sync & Refresh */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchPemusnahanData();
            }}
            disabled={isLoading || isRefreshing}
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data dari Database"
          >
            <RefreshCw size={13} className={isLoading || isRefreshing ? 'animate-spin text-rose-600' : ''} />
          </button>

          <button
            onClick={handlePushAllToSupabase}
            disabled={isPushing || pemusnahanList.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Sinkronkan Semua Data Lokal ke Database Supabase"
          >
            <Database size={13} className={isPushing ? 'animate-pulse text-amber-400' : 'text-blue-300'} />
            <span>{isPushing ? 'Menyinkronkan...' : 'Sinkron Cloud'}</span>
          </button>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* FILTER BAR: FILTER TUJUAN & SEARCH ONLY */}
      {/* ========================================================================= */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          
          {/* Main Search Input with Speech-to-Text */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SKU, Nama Barang, Batch, Status, No Dokumen, Note, Tujuan..."
              className="w-full pl-8 pr-16 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-rose-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Hapus Pencarian"
              >
                <X size={12} />
              </button>
            )}
            {/* Voice Search Button */}
            <button
              type="button"
              onClick={toggleSpeechToTextSearch}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all cursor-pointer ${
                isListeningSearch 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title={isListeningSearch ? 'Sedang Mendengarkan...' : 'Pencarian Suara (Voice Search)'}
            >
              {isListeningSearch ? <Radio size={13} className="animate-spin" /> : <Mic size={13} />}
            </button>
          </div>

          {/* Filter Dropdown: Tujuan Only (as strictly requested) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Tujuan:</span>
            <select
              value={tujuanFilter}
              onChange={(e) => {
                setTujuanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/40 text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-1.5 focus:ring-rose-500 min-w-[220px]"
            >
              <option value="ALL">Semua Tujuan ({pemusnahanList.length} baris)</option>
              {uniqueTujuans.map(tujuan => (
                <option key={tujuan} value={tujuan}>
                  🎯 {tujuan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Speech Recognition Feedback Banner */}
        {speechFeedbackSearch && (
          <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-rose-600 animate-spin" />
              <span>{speechFeedbackSearch}</span>
            </div>
            <button
              onClick={() => setSpeechFeedbackSearch(null)}
              className="text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Quick Filter Active Tags */}
        {(searchQuery || tujuanFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Filter Aktif:</span>

            {tujuanFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[11px] font-bold">
                🎯 Tujuan: {tujuanFilter}
                <button onClick={() => setTujuanFilter('ALL')} className="hover:text-rose-950 cursor-pointer"><X size={11} /></button>
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold">
                Pencarian: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-slate-950 cursor-pointer"><X size={11} /></button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200"
            >
              <RotateCcw size={11} />
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BULK ACTIONS TOOLBAR (UPDATE STATUS MASSAL & HAPUS MASSAL) */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-rose-50/90 via-slate-50 to-rose-50/60 border border-rose-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Selection Controller */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedIds.size === filteredPemusnahan.length && filteredPemusnahan.length > 0
                ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                : selectedIds.size > 0
                ? 'bg-rose-100 border-rose-300 text-rose-900 font-black'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {selectedIds.size === filteredPemusnahan.length && filteredPemusnahan.length > 0 ? (
              <CheckSquare size={14} className="text-white" />
            ) : selectedIds.size > 0 ? (
              <MinusSquare size={14} className="text-rose-700" />
            ) : (
              <Square size={14} className="text-slate-400" />
            )}
            <span>
              {selectedIds.size > 0
                ? `${selectedIds.size} Baris Dipilih`
                : `Pilih Semua Data (${filteredPemusnahan.length})`}
            </span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline px-1 cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          )}

          {tujuanFilter !== 'ALL' && (
            <span className="text-[11px] font-bold text-rose-800 bg-rose-100/80 px-2 py-1 rounded-md">
              Filter: {tujuanFilter} ({filteredPemusnahan.length} baris)
            </span>
          )}
        </div>

        {/* Quick Bulk Update Status / No. Dokumen Input & Bulk Delete Button */}
        <div className="flex items-center gap-2 flex-wrap flex-1 max-w-2xl justify-start md:justify-end">
          <div className="relative flex-1 min-w-[220px]">
            <FileText size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={bulkStatusInput}
              onChange={(e) => setBulkStatusInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBulkUpdateStatus();
                }
              }}
              placeholder="Isi No. Dokumen / Status Pemusnahan..."
              className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1.5 focus:ring-rose-500 shadow-2xs"
            />
          </div>

          {/* Bulk Update Status Button */}
          <button
            type="button"
            onClick={() => handleBulkUpdateStatus()}
            disabled={isUpdatingBulkStatus}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            title="Update status semua baris yang dipilih / terfilter sekaligus ke tabel & database"
          >
            {isUpdatingBulkStatus ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            <span>Update Status Massal {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredPemusnahan.length})`}</span>
          </button>

          {/* Bulk Delete Button (Tabel & Database) */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-900 text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Hapus massal data terpilih dari TABEL & DATABASE Supabase"
            >
              <Trash2 size={13} className="text-rose-600" />
              <span>Hapus Massal {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredPemusnahan.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DATA TABLE (APPSHEET STYLE) */}
      {/* ========================================================================= */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Table Top Status Bar */}
        <div className="p-2 sm:p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Trash2 size={14} className="text-rose-600" />
            <span>Daftar Data Pemusnahan ({filteredPemusnahan.length} item)</span>
            {tujuanFilter !== 'ALL' && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] font-extrabold">
                Tujuan: {tujuanFilter}
              </span>
            )}
            {searchQuery && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[10px]">
                Filter: "{searchQuery}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Tampilkan:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-700"
            >
              <option value="ALL">Semua (Semua Baris)</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-tight text-[10px] border-b border-slate-200 select-none">
                {/* Select All Checkbox Column */}
                <th className="px-2 py-1.5 text-center w-8">
                  <input
                    type="checkbox"
                    checked={filteredPemusnahan.length > 0 && selectedIds.size === filteredPemusnahan.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-3.5 h-3.5"
                    title="Pilih Semua Baris"
                  />
                </th>
                <th className="px-2 py-1.5 text-center w-10">No</th>
                <th onClick={() => handleSort('tujuan')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Tujuan</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('item_name')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Item Name</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('last_qty')} className="px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-end gap-1">
                    <span>Qty</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('uom')} className="px-2.5 py-1.5 text-center cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    <span>UOM</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('batch')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Batch</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('expired_date')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Expired Date</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className="px-2.5 py-1.5 text-center cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('note')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Note</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-rose-600" />
                      <span>Memuat data pemusnahan dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Trash2 size={28} className="text-slate-300" />
                      <span className="font-extrabold text-slate-700 text-xs">Belum Ada Data Pemusnahan</span>
                      <p className="text-[11px] text-slate-400 max-w-md m-0">
                        {searchQuery || tujuanFilter !== 'ALL'
                          ? 'Tidak ditemukan data yang cocok dengan kriteria filter tujuan atau pencarian.'
                          : 'Data pemusnahan dapat dikirim dari modul Penyiapan jika status telah Ada/Selesai, atau ditambah secara manual / upload Excel.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const rowNumber = rowsPerPage === 'ALL' ? index + 1 : (currentPage - 1) * rowsPerPage + index + 1;
                  const isChecked = selectedIds.has(item.id_pemusnahan);

                  return (
                    <tr
                      key={item.id_pemusnahan || index}
                      onClick={() => handleOpenDetailModal(item)}
                      className={`transition-colors group cursor-pointer ${
                        isChecked ? 'bg-rose-50/80 hover:bg-rose-100/70' : 'hover:bg-rose-50/50'
                      }`}
                      title="Klik baris untuk melihat detail / edit data"
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(item.id_pemusnahan)}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-3.5 h-3.5"
                          title="Pilih Baris"
                        />
                      </td>

                      {/* No */}
                      <td className="px-2 py-1.5 text-center text-slate-400 font-mono text-[10px]">
                        {rowNumber}
                      </td>

                      {/* Tujuan */}
                      <td className="px-2.5 py-1.5 text-xs font-bold text-slate-800 min-w-[140px] max-w-[200px] truncate" title={item.tujuan || '-'}>
                        {item.tujuan || '-'}
                      </td>

                      {/* Item Name */}
                      <td className="px-2.5 py-1.5 min-w-[180px] max-w-xs" title={item.item_name}>
                        <div className="font-extrabold text-slate-800 text-xs truncate">
                          {item.item_name}
                        </div>
                        {item.item_code && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {item.item_code}
                          </div>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-2.5 py-1.5 text-right font-mono font-black text-rose-800 text-xs min-w-[80px]">
                        {Number(item.last_qty !== undefined && item.last_qty !== null ? item.last_qty : (item.first_qty ?? 0)).toLocaleString('id-ID')}
                      </td>

                      {/* Uom */}
                      <td className="px-2 py-1.5 text-center font-bold text-slate-700 text-xs min-w-[60px] uppercase">
                        {item.uom || '-'}
                      </td>

                      {/* Batch */}
                      <td className="px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700 min-w-[90px]">
                        {item.batch || '-'}
                      </td>

                      {/* Expired Date */}
                      <td className="px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700 min-w-[100px]">
                        {item.expired_date || '-'}
                      </td>

                      {/* Status Column (Badge) */}
                      <td className="px-2 py-1.5 text-center min-w-[130px]">
                        {item.status ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                            /^\d+$/.test(item.status) 
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-mono'
                              : item.status.toLowerCase().includes('disposed') || item.status.toLowerCase().includes('musnah')
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : item.status.toLowerCase().includes('proses')
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}>
                            {item.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">-</span>
                        )}
                      </td>

                      {/* Note (Direct inline cell editing) */}
                      <td className="px-2 py-1 text-xs text-slate-600 min-w-[150px] max-w-[240px]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          defaultValue={item.note || ''}
                          key={`note-${item.id_pemusnahan}-${item.note}`}
                          placeholder="Klik untuk isi catatan..."
                          onBlur={(e) => {
                            if (e.target.value !== (item.note || '')) {
                              handleInlineCellUpdate(item, 'note', e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full px-2 py-1 text-xs text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1.5 focus:ring-rose-500 rounded border border-transparent hover:border-slate-300 focus:border-rose-400 outline-none transition-all truncate placeholder:text-slate-300 font-medium"
                          title="Klik untuk edit Note / Catatan langsung di cell"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {rowsPerPage !== 'ALL' && totalPages > 1 && (
          <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium text-[11px]">
              Halaman {currentPage} dari {totalPages} ({filteredPemusnahan.length} total baris)
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>

              <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FORM TAMBAH / EDIT PEMUSNAHAN */}
      {/* ========================================================================= */}
      {showFormModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-rose-700 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight m-0">
                    {isEditMode ? 'Edit Data Pemusnahan' : 'Tambah Data Pemusnahan Baru'}
                  </h3>
                  <p className="text-[11px] text-rose-200 m-0 font-medium">
                    Tabel: public.data_pemusnahan (Supabase)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveFormData} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              
              {/* Row 1: ID Pemusnahan & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Pemusnahan (Primary Key)</label>
                  <input
                    type="text"
                    value={formData.id_pemusnahan || ''}
                    onChange={(e) => handleFormInputChange('id_pemusnahan', e.target.value)}
                    required
                    disabled={isEditMode}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Pemusnahan</label>
                  <select
                    value={formData.status || 'Siap Dimusnahkan'}
                    onChange={(e) => handleFormInputChange('status', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  >
                    <option value="Siap Dimusnahkan">Siap Dimusnahkan</option>
                    <option value="Dalam Proses">Dalam Proses</option>
                    <option value="Disposed">Disposed (Musnah)</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sumber / Asal Data</label>
                  <input
                    type="text"
                    value={formData.source || ''}
                    onChange={(e) => handleFormInputChange('source', e.target.value)}
                    placeholder="Contoh: Penyiapan (PEN-001) / Gudang"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Master Barang Autocomplete */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Barcode size={14} className="text-rose-600" />
                    <span>Pilih Master Barang / SKU Produk</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {barangList.length} SKU terdaftar
                  </span>
                </div>

                <div className="relative" ref={barangSearchContainerRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={barangSearchText}
                      onChange={(e) => {
                        setBarangSearchText(e.target.value);
                        setIsBarangDropdownOpen(true);
                      }}
                      onFocus={() => setIsBarangDropdownOpen(true)}
                      placeholder="Ketik kode SKU, barcode, atau nama produk..."
                      className="w-full pl-3 pr-16 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={toggleSpeechToTextBarang}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all cursor-pointer ${
                        isListeningBarang ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title="Sebutkan Nama Barang dengan Suara"
                    >
                      <Mic size={13} />
                    </button>
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {isBarangDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-300 shadow-xl z-50 divide-y divide-slate-100">
                      {filteredBarangList.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 font-medium">
                          Tidak ditemukan SKU yang cocok. Anda tetap dapat mengetik manual di bawah.
                        </div>
                      ) : (
                        filteredBarangList.slice(0, 15).map(b => (
                          <div
                            key={b.item_code}
                            onClick={() => handleSelectMasterBarang(b)}
                            className="p-2.5 hover:bg-rose-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                          >
                            <div>
                              <div className="font-extrabold text-slate-800">{b.item_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                <span>SKU: {b.item_code}</span>
                                {b.barcode && <span>Barcode: {b.barcode}</span>}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {b.uom || 'CTN'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Manual Item Code & Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Item Code (SKU)</label>
                    <input
                      type="text"
                      value={formData.item_code || ''}
                      onChange={(e) => handleFormInputChange('item_code', e.target.value)}
                      required
                      placeholder="Contoh: 21104508"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Item Name (Nama Produk)</label>
                    <input
                      type="text"
                      value={formData.item_name || ''}
                      onChange={(e) => handleFormInputChange('item_name', e.target.value)}
                      required
                      placeholder="Nama lengkap barang"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Quantities, UOM & Batch */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Qty</label>
                  <input
                    type="number"
                    value={formData.first_qty ?? 0}
                    onChange={(e) => handleFormInputChange('first_qty', Number(e.target.value))}
                    min="0"
                    step="any"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Qty</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? 0}
                    onChange={(e) => handleFormInputChange('last_qty', Number(e.target.value))}
                    min="0"
                    step="any"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs text-right text-rose-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Uom</label>
                  <input
                    type="text"
                    value={formData.uom || 'CTN'}
                    onChange={(e) => handleFormInputChange('uom', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Code</label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={(e) => handleFormInputChange('batch', e.target.value)}
                    placeholder="Contoh: 0456"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {/* Row 4: Expired Date, QC, Location & SLoc */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expired Date (ED)</label>
                  <input
                    type="date"
                    value={formData.expired_date && formData.expired_date !== '-' ? formData.expired_date : ''}
                    onChange={(e) => handleFormInputChange('expired_date', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">QC Code</label>
                  <select
                    value={formData.qc_code || 'QC-REJECT'}
                    onChange={(e) => handleFormInputChange('qc_code', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs"
                  >
                    <option value="QC-REJECT">QC-REJECT</option>
                    <option value="QC-HOLD">QC-HOLD</option>
                    <option value="QC-PASS">QC-PASS</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location (Quarantine)</label>
                  <input
                    type="text"
                    value={formData.location || 'WH-REJECT-01'}
                    onChange={(e) => handleFormInputChange('location', e.target.value)}
                    placeholder="Contoh: WH-REJECT-01"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLOC</label>
                  <input
                    type="text"
                    value={formData.sloc || 'SL99'}
                    onChange={(e) => handleFormInputChange('sloc', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Row 5: Destination Code & Tujuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destination Code (Tempat Pemusnahan)</label>
                  <input
                    type="text"
                    value={formData.destination_code || 'INCINERATOR'}
                    onChange={(e) => handleFormInputChange('destination_code', e.target.value)}
                    placeholder="Contoh: INCINERATOR / SCRAP YARD / VENDOR"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tujuan / Deskripsi Pemusnahan</label>
                  <input
                    type="text"
                    value={formData.tujuan || 'Pemusnahan Limbah Terkontrol'}
                    onChange={(e) => handleFormInputChange('tujuan', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>

              {/* Row 6: Catatan / Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Alasan Pemusnahan</label>
                <textarea
                  value={formData.note || ''}
                  onChange={(e) => handleFormInputChange('note', e.target.value)}
                  rows={2}
                  placeholder="Contoh: Kemasan bocor saat pengiriman / kadaluwarsa dari penyiapan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              {/* Modal Actions */}
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>{isEditMode ? 'Simpan Perubahan' : 'Tambah Pemusnahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL VIEW MODAL */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-rose-700 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 size={18} />
                <div>
                  <h3 className="text-sm font-black uppercase m-0">Detail Data Pemusnahan</h3>
                  <p className="text-[11px] text-rose-200 m-0 font-mono">{selectedItem.id_pemusnahan}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-3.5 text-xs">
              
              {/* Product Info Block */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Produk / SKU</span>
                  <h4 className="text-sm font-black text-slate-800 m-0">{selectedItem.item_name}</h4>
                  <div className="flex items-center gap-2 mt-1 font-mono text-slate-500">
                    <span>SKU: {selectedItem.item_code}</span>
                    <span>•</span>
                    <span>Batch: {selectedItem.batch || '-'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Jumlah Dimusnahkan</span>
                  <div className="text-lg font-black text-rose-700">
                    {Number(selectedItem.last_qty || 0).toLocaleString('id-ID')} {selectedItem.uom || 'CTN'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Konversi: {selectedItem.qty_convert || selectedItem.last_qty} {selectedItem.uom_convert || 'PCS'}
                  </span>
                </div>
              </div>

              {/* QR Code & Disposal Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* QR Code Box */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">LPN QR Code</span>
                  {selectedItem.lpn_serial_number && selectedItem.lpn_serial_number !== '-' ? (
                    <div className="space-y-1">
                      <div className="w-24 h-24 bg-white p-1 rounded-lg border border-slate-200 mx-auto flex items-center justify-center">
                        <QrCode size={80} className="text-slate-800" />
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-700 block truncate max-w-[140px]">
                        {selectedItem.lpn_serial_number}
                      </span>
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center text-slate-400 text-[11px]">
                      Tanpa LPN
                    </div>
                  )}
                </div>

                {/* Details Table */}
                <div className="sm:col-span-2 space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Status Pemusnahan</span>
                      <span className="font-bold text-rose-800">{selectedItem.status || 'Siap Dimusnahkan'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">QC Code</span>
                      <span className="font-bold text-slate-800">{selectedItem.qc_code || 'QC-REJECT'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Lokasi Karantina</span>
                      <span className="font-bold text-slate-800">{selectedItem.location || 'WH-REJECT-01'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">SLoc</span>
                      <span className="font-bold text-slate-800">{selectedItem.sloc || 'SL99'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Destinasi</span>
                      <span className="font-bold text-slate-800">{selectedItem.destination_code || 'INCINERATOR'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Expired Date</span>
                      <span className="font-bold text-slate-800">{selectedItem.expired_date || '-'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Sumber / Asal Relasi</span>
                    <span className="font-semibold text-slate-700">{selectedItem.source || 'Pemusnahan Langsung'}</span>
                  </div>

                  {selectedItem.note && (
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 font-bold block">Catatan / Alasan</span>
                      <p className="text-slate-700 m-0 font-medium">{selectedItem.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Diperbarui: {selectedItem.tanggal_update ? new Date(selectedItem.tanggal_update).toLocaleString('id-ID') : '-'}
              </span>

              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowDeleteModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer flex items-center gap-1 transition-colors"
                    title="Hapus Data (Admin)"
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenEditModal(selectedItem);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Edit2 size={13} />
                  <span>Edit Data</span>
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EXCEL IMPORT PREVIEW */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={18} />
                <div>
                  <h3 className="text-sm font-black uppercase m-0">Upload File Excel Pemusnahan Barang</h3>
                  <p className="text-[11px] text-emerald-200 m-0 font-medium">
                    Mendukung format .xlsx, .xls, .csv dengan validasi template otomatis
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 block text-sm">
                    {excelFileName || 'Klik atau Tarik File Excel ke Sini'}
                  </span>
                  <p className="text-[11px] text-slate-500 m-0">
                    File akan otomatis diproses dan dipetakan sesuai kolom tabel database
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>Pratinjau Data ({parsedExcelRows.length} baris siap disimpan)</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase sticky top-0">
                        <tr>
                          <th className="p-2">Item Code</th>
                          <th className="p-2">Item Name</th>
                          <th className="p-2">Batch</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2">UOM</th>
                          <th className="p-2">QC</th>
                          <th className="p-2">Lokasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedExcelRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono">{r.item_code}</td>
                            <td className="p-2 font-bold max-w-xs truncate">{r.item_name}</td>
                            <td className="p-2 font-mono">{r.batch}</td>
                            <td className="p-2 text-right font-mono font-bold text-rose-700">{r.last_qty}</td>
                            <td className="p-2">{r.uom}</td>
                            <td className="p-2">{r.qc_code}</td>
                            <td className="p-2">{r.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <Download size={13} />
                <span>Unduh Template Excel</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCommitExcelImport}
                  disabled={parsedExcelRows.length === 0 || isProcessingExcel}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Simpan ke Database ({parsedExcelRows.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL (SINGLE) */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-800 m-0">Hapus Data Pemusnahan?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus data pemusnahan <span className="font-bold text-slate-700">{selectedItem.id_pemusnahan}</span> ({selectedItem.item_name})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BULK DELETE CONFIRMATION MODAL (TABEL & DATABASE) */}
      {/* ========================================================================= */}
      {showBulkDeleteModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 size={26} />
            </div>

            <div>
              <h3 className="text-base font-black text-rose-900 m-0">Hapus Massal Data Pemusnahan?</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Anda akan menghapus sebanyak <span className="font-extrabold text-rose-700">{selectedIds.size > 0 ? selectedIds.size : filteredPemusnahan.length} baris data</span> secara permanen dari <strong>Tabel UI dan Database Cloud Supabase</strong>.
              </p>
              {tujuanFilter !== 'ALL' && selectedIds.size === 0 && (
                <div className="mt-2 p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-[11px] font-bold">
                  Target Filter: Tujuan "{tujuanFilter}" ({filteredPemusnahan.length} item)
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isDeletingBulk}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleBulkDelete()}
                disabled={isDeletingBulk}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingBulk ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeletingBulk ? 'Menghapus...' : 'Ya, Hapus Semua Terpilih'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: GOOGLE SHEETS / CLOUDFLARE WORKER WEBHOOK SYNC MODAL */}
      {/* ========================================================================= */}
      {showGSheetModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Share2 size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight m-0 text-white flex items-center gap-2">
                    <span>Sinkronisasi Google Sheets</span>
                    {isConfigFromSupabase && (
                      <span className="px-2 py-0.5 bg-emerald-800/80 text-emerald-200 text-[10px] font-bold rounded-full border border-emerald-400/40">
                        Cloud Synchronized
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-emerald-100 mt-0.5 m-0">
                    Ekspor & sinkronkan data pemusnahan barang ke lembar kerja Google Sheets
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGSheetModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Summary of Data to Sync */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Data yang akan dikirim:</div>
                  <div className="text-sm font-black text-slate-800">
                    {(filteredPemusnahan.length > 0 ? filteredPemusnahan.length : pemusnahanList.length).toLocaleString('id-ID')} Baris Pemusnahan
                  </div>
                  {tujuanFilter !== 'ALL' && (
                    <div className="text-[11px] text-rose-600 font-bold mt-0.5">
                      Target Filter: Tujuan "{tujuanFilter}"
                    </div>
                  )}
                </div>
                <div className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black border border-emerald-200">
                  Tab: {gSheetConfig.sheetName || 'pemusnahan'}
                </div>
              </div>

              {/* Status Webhook Config Summary */}
              {gSheetConfig.webhookUrl ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>Webhook Terkonfigurasi</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowGSheetAdvanced(!showGSheetAdvanced)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Settings size={12} className="text-slate-500" />
                      <span>{showGSheetAdvanced ? 'Tutup' : 'Pengaturan'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-full m-0" title={gSheetConfig.webhookUrl}>
                    {gSheetConfig.webhookUrl}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-amber-900">URL Webhook Belum Diatur: </span>
                    <span className="text-slate-600">
                      Silakan isi URL Webhook di bawah ini. Anda dapat menyimpannya ke database cloud Supabase agar otomatis terpasang di seluruh perangkat tim.
                    </span>
                  </div>
                </div>
              )}

              {/* Form Settings (Collapsible or visible if empty) */}
              {(!gSheetConfig.webhookUrl || showGSheetAdvanced) && (
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3.5 animate-fade-in">
                  
                  {/* Settings Sub-Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Settings size={14} className="text-slate-500" />
                      <span>Konfigurasi Webhook & Spreadsheet</span>
                    </span>

                    <button
                      type="button"
                      disabled={isSavingToSupabase || !gSheetConfig.webhookUrl.trim()}
                      onClick={handleSaveConfigToSupabase}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      title="Simpan ke Cloud Supabase agar otomatis aktif di semua HP/Laptop tim"
                    >
                      {isSavingToSupabase ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Database size={12} />
                          <span>Simpan ke Cloud</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Input: URL Webhook */}
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1">
                      URL Webhook / Cloudflare Worker <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={gSheetConfig.webhookUrl}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, webhookUrl: e.target.value })}
                        placeholder="https://script.google.com/... atau https://worker.dev/..."
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                      />
                      <Globe size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 m-0">
                      URL Web App Deployment dari Google Apps Script atau Cloudflare Worker.
                    </p>
                  </div>

                  {/* Input: Spreadsheet ID & Sheet Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        Spreadsheet ID <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="text"
                        value={gSheetConfig.spreadsheetId}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, spreadsheetId: e.target.value })}
                        placeholder="1BxiMVs0XRA5nFMd..."
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 m-0">
                        ID dari URL spreadsheet (kosongkan jika script melekat pada sheet).
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        Nama Tab / Sheet
                      </label>
                      <input
                        type="text"
                        value={gSheetConfig.sheetName}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, sheetName: e.target.value })}
                        placeholder="pemusnahan"
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 m-0">
                        Nama lembar kerja target (default: <span className="font-mono font-bold">pemusnahan</span>).
                      </p>
                    </div>
                  </div>

                  {/* Input: Mode & Secret Token */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        Mode Pengiriman Data
                      </label>
                      <select
                        value={gSheetConfig.mode || 'append'}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, mode: e.target.value as any })}
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer transition-all"
                      >
                        <option value="append">➕ Append (Tambah di Bawah) - Standar</option>
                        <option value="overwrite">🔄 Replace / Overwrite (Ganti Semua)</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1 m-0">
                        Standar: <span className="font-semibold text-emerald-700">Append</span> (menambahkan baris data baru di bawah).
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        Secret Token <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="password"
                        value={gSheetConfig.secretToken}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, secretToken: e.target.value })}
                        placeholder="Token otorisasi jika ada..."
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  {/* SQL Setup Helper Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSqlHelp(!showSqlHelp)}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Info size={13} />
                      <span>{showSqlHelp ? 'Sembunyikan Script SQL Supabase' : 'Petunjuk Tabel Supabase (app_settings)'}</span>
                    </button>

                    {showSqlHelp && (
                      <div className="mt-2.5 p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] space-y-2 animate-fade-in border border-slate-800">
                        <div className="flex items-center justify-between text-slate-400 font-sans text-xs pb-1 border-b border-slate-800">
                          <span>Jalankan di Supabase SQL Editor:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const sql = `CREATE TABLE IF NOT EXISTS app_settings (\n  key TEXT PRIMARY KEY,\n  value JSONB NOT NULL,\n  updated_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_by TEXT\n);\nALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all on app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);`;
                              navigator.clipboard.writeText(sql);
                              showToast('SQL Disalin', 'Query SQL telah disalin ke clipboard!', 'success');
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Copy size={11} />
                            <span>Salin SQL</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-400 text-[10px] leading-relaxed m-0">
{`CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);`}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sync Result Status Box */}
              {gSheetSyncResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs animate-fade-in ${
                    gSheetSyncResult.success
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/90 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {gSheetSyncResult.success ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="font-bold flex items-center justify-between gap-2">
                        <span>{gSheetSyncResult.success ? 'Sinkronisasi Berhasil!' : 'Gagal Sinkronisasi'}</span>
                        {gSheetSyncResult.timestamp && (
                          <span className="text-[10px] font-normal text-slate-500 shrink-0">
                            {gSheetSyncResult.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed m-0 text-slate-700">
                        {gSheetSyncResult.message}
                      </p>
                      {gSheetSyncResult.spreadsheetUrl && (
                        <div className="pt-1">
                          <a
                            href={gSheetSyncResult.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-2xs"
                          >
                            <span>Buka Google Spreadsheet</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowGSheetModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold transition-all cursor-pointer text-xs shadow-2xs"
              >
                Tutup
              </button>

              <button
                type="button"
                disabled={isSyncingGSheet || !gSheetConfig.webhookUrl.trim()}
                onClick={handleExecuteGSheetSync}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-extrabold shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-2 text-xs"
              >
                {isSyncingGSheet ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Mengirim Data ({filteredPemusnahan.length > 0 ? filteredPemusnahan.length : pemusnahanList.length} Item)...</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Kirim Sekarang ke Google Sheets</span>
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
