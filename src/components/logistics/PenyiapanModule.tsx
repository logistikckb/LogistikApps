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
  MessageSquare,
  Flame,
  ArrowRight,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Truck,
  Share2,
  CheckCheck
} from 'lucide-react';
import Fuse from 'fuse.js';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { PenyiapanItem, DataBarang } from '../../types';
import { getEdIsoDateString } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

// Pilihan Tujuan Transfer Database Massal
export interface DestinationOption {
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
  appModuleId?: string;
}

export const BULK_DESTINATIONS: DestinationOption[] = [
  {
    id: 'pemusnahan',
    name: 'Menu Pemusnahan (Menu E)',
    tableName: 'data_pemusnahan',
    idPrefix: 'PMS-',
    idField: 'id_pemusnahan',
    defaultSloc: 'SL99',
    defaultLocation: 'WH-REJECT-01',
    defaultLocationType: 'Quarantine',
    defaultQcCode: 'QC-REJECT',
    defaultDestinationCode: 'INCINERATOR',
    defaultStatus: 'Siap Dimusnahkan',
    defaultTujuan: 'Pemusnahan Limbah Terkontrol',
    defaultCategory: 'Damaged',
    sourceStatusDefault: 'Terkirim ke Pemusnahan',
    cacheKey: 'pemusnahan_cache_v1',
    description: 'Tabel: public.data_pemusnahan - Karantina limbah / scrap / expired barang',
    colorClass: 'from-rose-600 to-red-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900 border-rose-300',
    borderColor: 'border-rose-500',
    appModuleId: 'menu-e'
  },
  {
    id: 'incoming',
    name: 'Menu Kedatangan / Inbound (Menu B)',
    tableName: 'incoming',
    idPrefix: 'INC-',
    idField: 'id_incoming',
    defaultSloc: 'SL01',
    defaultLocation: 'WH-IN-01',
    defaultLocationType: 'Rack',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-01',
    defaultStatus: 'Received',
    defaultTujuan: 'Warehouse Utama (Inbound)',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Kedatangan',
    cacheKey: 'ckb_incoming_cache_v1',
    description: 'Tabel: public.incoming - Pengembalian atau pencatatan inbound',
    colorClass: 'from-blue-600 to-indigo-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900 border-blue-300',
    borderColor: 'border-blue-500',
    appModuleId: 'menu-b'
  },
  {
    id: 'surat_jalan',
    name: 'Database Surat Jalan',
    tableName: 'data_surat_jalan',
    idPrefix: 'SJ-',
    idField: 'id_surat_jalan',
    defaultSloc: 'SL02',
    defaultLocation: 'STAGING-OUT',
    defaultLocationType: 'Dock',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'CUSTOMER-EXPEDITION',
    defaultStatus: 'Shipped',
    defaultTujuan: 'Pengiriman Cabang / Ekspedisi',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Surat Jalan',
    cacheKey: 'surat_jalan_cache_v1',
    description: 'Tabel: public.data_surat_jalan - Transaksi pengiriman outbound',
    colorClass: 'from-emerald-600 to-teal-800',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900 border-emerald-300',
    borderColor: 'border-emerald-500'
  }
];

interface PenyiapanModuleProps {
  onNavigateToPemusnahan?: () => void;
  onNavigateToIncoming?: () => void;
  onNavigateToModule?: (moduleId: string) => void;
}

export function PenyiapanModule({ onNavigateToPemusnahan, onNavigateToIncoming, onNavigateToModule }: PenyiapanModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin' || currentUser?.username?.toLowerCase() === 'superadmin';

  // Primary Data State
  const [penyiapanList, setPenyiapanList] = useState<PenyiapanItem[]>([]);
  const [barangList, setBarangList] = useState<DataBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Multi-Selection State for Bulk Transfer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkTargetModuleId, setBulkTargetModuleId] = useState<string>('pemusnahan');
  const [bulkFormData, setBulkFormData] = useState<any>({
    sloc: 'SL99',
    location: 'WH-REJECT-01',
    location_type: 'Quarantine',
    qc_code: 'QC-REJECT',
    destination_code: 'INCINERATOR',
    target_status: 'Siap Dimusnahkan',
    tujuan: 'Pemusnahan Limbah Terkontrol',
    category: 'Damaged',
    note: ''
  });
  const [bulkSourceAction, setBulkSourceAction] = useState<'update_status' | 'delete' | 'keep'>('update_status');
  const [bulkSourceStatus, setBulkSourceStatus] = useState<string>('Terkirim ke Pemusnahan');
  const [isBulkTransferring, setIsBulkTransferring] = useState(false);
  const [bulkTransferProgress, setBulkTransferProgress] = useState({ current: 0, total: 0, percentage: 0 });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [qcFilter, setQcFilter] = useState<string>('ALL');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof PenyiapanItem>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination & Display
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showPemusnahanModal, setShowPemusnahanModal] = useState(false);
  const [pemusnahanTargetItem, setPemusnahanTargetItem] = useState<PenyiapanItem | null>(null);
  const [pemusnahanFormData, setPemusnahanFormData] = useState<any>({});
  const [isSendingPemusnahan, setIsSendingPemusnahan] = useState(false);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<PenyiapanItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<PenyiapanItem>>({});
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
          // Kembalikan ke nilai awal jika user tidak jadi memilih master SKU
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

  // Check if browser supports Web Speech API
  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Excel Import States
  const [parsedExcelRows, setParsedExcelRows] = useState<PenyiapanItem[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    current: number;
    total: number;
    percentage: number;
    statusText: string;
  }>({
    isUploading: false,
    current: 0,
    total: 0,
    percentage: 0,
    statusText: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isImportingRef = useRef(false);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (barangRecognitionRef.current) {
        try {
          barangRecognitionRef.current.abort();
        } catch {}
      }
      if (searchRecognitionRef.current) {
        try {
          searchRecognitionRef.current.abort();
        } catch {}
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

  // Fetch data_penyiapan from Supabase
  const fetchPenyiapanData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setLastSupabaseError(null);

    if (!isSupabaseConfigured) {
      if (!silent) setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAllRowsFromSupabase<PenyiapanItem>('data_penyiapan', {
        orderBy: 'created_at',
        ascending: false
      });

      if (Array.isArray(data)) {
        setPenyiapanList(data);
        if (data.length > 0) {
          try {
            localStorage.setItem('penyiapan_cache_v1', JSON.stringify(data));
          } catch {}
        } else {
          localStorage.removeItem('penyiapan_cache_v1');
        }
      }
    } catch (err: any) {
      console.error('Unexpected error fetching data_penyiapan:', err);
      setLastSupabaseError(err?.message || 'Gagal terhubung ke tabel data_penyiapan');
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Realtime Sync
  useEffect(() => {
    // 1. Load cached data from localStorage
    const cached = localStorage.getItem('penyiapan_cache_v1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPenyiapanList(parsed);
        }
      } catch (e) {
        console.error('Error loading penyiapan cache:', e);
      }
    }

    // 2. Fetch live data
    fetchMasterData();
    fetchPenyiapanData();

    // Supabase Realtime channel
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('penyiapan_realtime_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_penyiapan' }, () => {
          // If currently performing bulk import, suppress realtime updates to avoid screen flickering & high load
          if (isImportingRef.current) return;
          // Silent refresh so existing table rows do not unmount or flash
          fetchPenyiapanData(true);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchMasterData, fetchPenyiapanData]);

  // Save to local storage whenever penyiapanList changes
  useEffect(() => {
    if (penyiapanList.length > 0) {
      try {
        localStorage.setItem('penyiapan_cache_v1', JSON.stringify(penyiapanList));
      } catch {}
    } else {
      localStorage.removeItem('penyiapan_cache_v1');
    }
  }, [penyiapanList]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMasterData();
    fetchPenyiapanData();
    showToast('Memperbarui Data', 'Mengambil data penyiapan terbaru dari database...', 'info');
  };

  // Helper ID generator
  const generatePenyiapanId = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PEN-${yyyy}${mm}${dd}-${randomSuffix}`;
  };

  // Chunking for safe Supabase upsert
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  const safeBatchUpsertPenyiapan = async (
    items: PenyiapanItem[],
    chunkSize = 500,
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ successCount: number; error: any }> => {
    const uniqueMap = new Map<string, PenyiapanItem>();
    for (const item of items) {
      const rawKey = item.id_penyiapan;
      if (rawKey) {
        const cleanKey = String(rawKey).trim();
        uniqueMap.set(cleanKey.toLowerCase(), {
          ...item,
          id_penyiapan: cleanKey
        });
      }
    }

    const normalizeToDbDate = (val: any): string | null => {
      if (!val) return null;
      const str = String(val).trim();
      if (!str || str === '-' || str === 'null' || str === 'undefined' || str === 'Invalid Date') return null;

      // Handle Excel integer serial date if passed as number or numeric string (e.g. 45678)
      if (/^\d{5}$/.test(str)) {
        const excelEpoch = new Date(1899, 11, 30);
        const dateObj = new Date(excelEpoch.getTime() + Number(str) * 86400000);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().slice(0, 10);
        }
      }

      // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
      const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      // Handle YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
      const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (ymdMatch) {
        const [, y, m, d] = ymdMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      // Fallback: Date parse
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      return null;
    };

    const nowIso = new Date().toISOString();
    const cleanItems = Array.from(uniqueMap.values()).map(item => {
      const { ed, tanggal_update, updated_at, ...rest } = item as any;
      const expDate = normalizeToDbDate(rest.expired_date);
      return {
        id_penyiapan: String(rest.id_penyiapan || '').trim(),
        item_code: String(rest.item_code || '').trim(),
        item_name: String(rest.item_name || '').trim(),
        category: String(rest.category || 'Finished Good').trim(),
        location: String(rest.location || '-').trim(),
        location_type: String(rest.location_type || '-').trim(),
        first_qty: Number(rest.first_qty) || 0,
        last_qty: Number(rest.last_qty) || 0,
        uom: String(rest.uom || 'CTN').trim(),
        qty_convert: Number(rest.qty_convert) || 0,
        uom_convert: String(rest.uom_convert || '-').trim(),
        lpn_serial_number: String(rest.lpn_serial_number || '-').trim(),
        batch: String(rest.batch || '-').trim(),
        vendor_batch: String(rest.vendor_batch || '-').trim(),
        sloc: String(rest.sloc || '-').trim(),
        expired_date: expDate,
        destination_code: rest.destination_code ? String(rest.destination_code).trim() : '',
        qc_code: rest.qc_code ? String(rest.qc_code).trim() : '',
        user_tally: rest.user_tally ? String(rest.user_tally).trim() : '',
        shelf_life: rest.shelf_life ? String(rest.shelf_life).trim() : '',
        source: rest.source ? String(rest.source).trim() : '',
        tujuan: rest.tujuan ? String(rest.tujuan).trim() : '',
        user_input: rest.user_input ? String(rest.user_input).trim() : '',
        status: rest.status ? String(rest.status).trim() : '',
        note: rest.note ? String(rest.note).trim() : '',
        created_at: rest.created_at || nowIso
      };
    });
    if (cleanItems.length === 0) return { successCount: 0, error: null };

    const chunks = chunkArray(cleanItems, chunkSize);
    let totalSuccess = 0;
    let lastErr: any = null;

    // Concurrent batch processing (2 concurrent chunks for maximum throughput without server overload)
    const concurrency = 2;
    for (let i = 0; i < chunks.length; i += concurrency) {
      const currentBatch = chunks.slice(i, i + concurrency);
      const results = await Promise.all(
        currentBatch.map(async (chunk) => {
          const { error } = await supabase
            .from('data_penyiapan')
            .upsert(chunk as any, { onConflict: 'id_penyiapan' });
          return { chunkLength: chunk.length, error };
        })
      );

      for (const res of results) {
        if (res.error) {
          lastErr = res.error;
          console.warn('Upsert warning on data_penyiapan chunk:', res.error);
        } else {
          totalSuccess += res.chunkLength;
        }
      }

      if (onProgress) {
        onProgress(Math.min(totalSuccess, cleanItems.length), cleanItems.length);
      }
    }

    return { successCount: totalSuccess, error: totalSuccess === cleanItems.length ? null : lastErr };
  };

  // Voice handler for Search
  const toggleSpeechToTextSearch = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Fitur Tidak Didukung', 'Browser belum mendukung Web Speech Recognition. Gunakan Chrome atau browser modern.', 'warning');
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
        setSpeechFeedbackSearch('Mendengarkan... Sebutkan kata kunci pencarian');
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
          setCurrentPage(1);
          setSpeechFeedbackSearch(`Mencari: "${spoken}"`);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech search error:', event.error);
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

      recognition.onerror = (event: any) => {
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

    // 1. Direct Multi-token Substring Match
    const tokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
    const directMatches = barangList.filter(b => {
      const combined = `${b.item_code || ''} ${b.item_name || ''} ${b.barcode || ''} ${b.category || ''} ${b.uom || ''}`.toLowerCase();
      return tokens.every(t => combined.includes(t));
    });

    if (directMatches.length > 0) {
      return directMatches;
    }

    // 2. Fuse.js Fuzzy Match fallback (especially powerful for voice speech input typos)
    return fuzzySearchDataBarang(barangList, clean, 0.38);
  }, [barangList, barangSearchText]);

  // Dynamic filter options
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.category && item.category !== '-') set.add(item.category.trim());
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueQcCodes = useMemo(() => {
    const set = new Set<string>(['QC-PASS', 'QC-HOLD', 'QC-REJECT', 'Lulus', 'PHE']);
    penyiapanList.forEach(item => {
      if (item.qc_code && item.qc_code !== '-') set.add(item.qc_code.trim());
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueSlocs = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.sloc && item.sloc !== '-') set.add(item.sloc.trim());
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.status && item.status !== '-') set.add(item.status.trim());
    });
    if (set.size === 0) return ['Ada', 'Beda', 'Tidak'];
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueLocationsList = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.location && item.location !== '-') set.add(item.location.trim());
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalFirstQty = 0;
    let totalLastQty = 0;
    let totalConvertQty = 0;
    const uniqueItems = new Set<string>();
    const uniqueBatches = new Set<string>();
    const uniqueLocations = new Set<string>();

    penyiapanList.forEach(item => {
      totalFirstQty += Number(item.first_qty) || 0;
      totalLastQty += Number(item.last_qty) || 0;
      totalConvertQty += Number(item.qty_convert) || 0;
      if (item.item_code) uniqueItems.add(item.item_code);
      if (item.batch && item.batch !== '-') uniqueBatches.add(item.batch);
      if (item.location && item.location !== '-') uniqueLocations.add(item.location);
    });

    return {
      totalRows: penyiapanList.length,
      totalFirstQty,
      totalLastQty,
      totalConvertQty,
      uniqueSkuCount: uniqueItems.size,
      uniqueBatchCount: uniqueBatches.size,
      uniqueLocationCount: uniqueLocations.size
    };
  }, [penyiapanList]);

  // Filtered & Sorted Penyiapan Data with Fuse.js Intelligent Fuzzy Match
  const filteredPenyiapan = useMemo(() => {
    // 1. Initial category/QC/SLoc/Status/Location baseline filtering
    let baseList = penyiapanList.filter(item => {
      // Category
      if (categoryFilter !== 'ALL' && (item.category || '').trim().toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // QC Code
      if (qcFilter !== 'ALL' && (item.qc_code || '').trim().toLowerCase() !== qcFilter.toLowerCase()) {
        return false;
      }

      // SLoc
      if (slocFilter !== 'ALL' && (item.sloc || '').trim().toLowerCase() !== slocFilter.toLowerCase()) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && (item.status || '').trim().toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Location
      if (locationFilter && !(item.location || '').toLowerCase().includes(locationFilter.toLowerCase())) {
        return false;
      }

      return true;
    });

    // 2. Search Query Filtering (Multi-token Substring with Fuse.js Fuzzy Fallback)
    const cleanSearch = searchQuery.trim();
    let searchedList = baseList;

    if (cleanSearch) {
      const tokens = cleanSearch.toLowerCase().split(/\s+/).filter(Boolean);
      
      // Step A: Try exact multi-token substring match
      const exactMatches = baseList.filter(item => {
        const combined = [
          item.id_penyiapan,
          item.item_code,
          item.item_name,
          item.category,
          item.location,
          item.location_type,
          item.lpn_serial_number,
          item.batch,
          item.vendor_batch,
          item.sloc,
          item.expired_date,
          item.destination_code,
          item.qc_code,
          item.user_tally,
          item.shelf_life,
          item.source,
          item.status,
          item.tujuan
        ].filter(Boolean).join(' ').toLowerCase();

        return tokens.every(token => combined.includes(token));
      });

      if (exactMatches.length > 0) {
        searchedList = exactMatches;
      } else {
        // Step B: Fuse.js Fuzzy Search fallback (handles voice recognition typos/accents)
        const fuse = new Fuse(baseList, {
          threshold: 0.38,
          ignoreLocation: true,
          keys: [
            { name: 'item_name', weight: 0.4 },
            { name: 'item_code', weight: 0.25 },
            { name: 'location', weight: 0.15 },
            { name: 'batch', weight: 0.1 },
            { name: 'lpn_serial_number', weight: 0.05 },
            { name: 'user_tally', weight: 0.05 }
          ]
        });
        const results = fuse.search(cleanSearch);
        searchedList = results.map(r => r.item);
      }
    }

    // 3. Sorting
    return searchedList.sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [penyiapanList, searchQuery, categoryFilter, locationFilter, qcFilter, slocFilter, statusFilter, sortField, sortOrder]);

  // Paginated View
  const paginatedData = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredPenyiapan;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPenyiapan.slice(start, start + rowsPerPage);
  }, [filteredPenyiapan, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredPenyiapan.length / rowsPerPage));

  // Check if location is filtered via location filter input
  const isLocationFiltered = useMemo(() => {
    return Boolean(locationFilter.trim());
  }, [locationFilter]);

  // Check if any filters are currently active (Lokasi & Status Penyiapan)
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    locationFilter.trim() ||
    statusFilter !== 'ALL'
  );

  // Quick count of items with status "Ada"
  const adaCount = useMemo(() => {
    return penyiapanList.filter(item => (item.status || '').trim().toLowerCase() === 'ada').length;
  }, [penyiapanList]);

  // Selected items full data objects
  const selectedItemsData = useMemo(() => {
    return penyiapanList.filter(item => selectedIds.includes(item.id_penyiapan));
  }, [penyiapanList, selectedIds]);

  // Total quantity of selected items
  const selectedTotalQty = useMemo(() => {
    return selectedItemsData.reduce((acc, curr) => acc + (Number(curr.last_qty) || 0), 0);
  }, [selectedItemsData]);

  // Summary of Total Qty PCS for the selected SKU at the filtered / item location
  const skuLocationSummary = useMemo(() => {
    // Current SKU
    const targetItemCode = (formData.item_code || selectedItem?.item_code || '').trim();
    const targetItemName = (formData.item_name || selectedItem?.item_name || '').trim();
    if (!targetItemCode && !targetItemName) return null;

    const targetCodeLower = targetItemCode.toLowerCase();
    const targetNameLower = targetItemName.toLowerCase();

    // Current Location (prioritize active locationFilter if present, otherwise formData.location or selectedItem.location)
    const filterLoc = locationFilter.trim();
    const itemLoc = (formData.location || selectedItem?.location || '').trim();
    const activeLoc = filterLoc || itemLoc;
    if (!activeLoc || activeLoc === '-') return null;

    const activeLocLower = activeLoc.toLowerCase();

    // Find all matching rows from penyiapanList
    const matchingRows = penyiapanList.filter(item => {
      // Match SKU by item_code or item_name
      const rowCode = (item.item_code || '').trim().toLowerCase();
      const rowName = (item.item_name || '').trim().toLowerCase();
      const isSkuMatch = (targetCodeLower && rowCode === targetCodeLower) ||
                         (targetNameLower && rowName === targetNameLower);
      if (!isSkuMatch) return false;

      // Match Location
      const rowLoc = (item.location || '').trim().toLowerCase();
      if (!rowLoc || rowLoc === '-') return false;

      if (filterLoc) {
        return rowLoc.includes(filterLoc.toLowerCase());
      }
      return rowLoc === activeLocLower;
    });

    if (matchingRows.length === 0) return null;

    let totalQtyConvertPcs = 0;
    let totalLastQty = 0;
    let totalFirstQty = 0;
    const batchDetails: Array<{
      id_penyiapan: string;
      batch: string;
      last_qty: number;
      uom: string;
      qty_convert: number;
      uom_convert: string;
      expired_date: string;
      status: string;
      isCurrent: boolean;
    }> = [];

    matchingRows.forEach(item => {
      const lQty = Number(item.last_qty) || 0;
      const fQty = Number(item.first_qty) || 0;
      const cQty = Number(item.qty_convert) || lQty || fQty || 0;

      totalLastQty += lQty;
      totalFirstQty += fQty;
      totalQtyConvertPcs += cQty;

      const isCurrent = Boolean(
        (formData.id_penyiapan && item.id_penyiapan === formData.id_penyiapan) ||
        (selectedItem?.id_penyiapan && item.id_penyiapan === selectedItem.id_penyiapan)
      );

      batchDetails.push({
        id_penyiapan: item.id_penyiapan,
        batch: item.batch || '-',
        last_qty: lQty,
        uom: item.uom || 'CTN',
        qty_convert: cQty,
        uom_convert: item.uom_convert || 'PCS',
        expired_date: item.expired_date || '-',
        status: item.status || '-',
        isCurrent
      });
    });

    const distinctBatches = Array.from(new Set(matchingRows.map(m => (m.batch || '-').trim()))).length;

    return {
      location: activeLoc,
      isFilterActive: Boolean(filterLoc),
      itemCode: targetItemCode || '-',
      itemName: targetItemName || '-',
      totalRows: matchingRows.length,
      distinctBatches,
      totalQtyConvertPcs,
      totalLastQty,
      totalFirstQty,
      uom: formData.uom || selectedItem?.uom || 'CTN',
      uom_convert: formData.uom_convert || selectedItem?.uom_convert || 'PCS',
      batchDetails
    };
  }, [formData.item_code, formData.item_name, formData.location, formData.id_penyiapan, formData.uom, formData.uom_convert, selectedItem, locationFilter, penyiapanList]);

  // Checkbox master toggle states
  const isAllFilteredSelected = useMemo(() => {
    if (filteredPenyiapan.length === 0) return false;
    return filteredPenyiapan.every(item => selectedIds.includes(item.id_penyiapan));
  }, [filteredPenyiapan, selectedIds]);

  const isSomeFilteredSelected = useMemo(() => {
    return filteredPenyiapan.some(item => selectedIds.includes(item.id_penyiapan)) && !isAllFilteredSelected;
  }, [filteredPenyiapan, selectedIds, isAllFilteredSelected]);

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setLocationFilter('');
    setCategoryFilter('ALL');
    setQcFilter('ALL');
    setSlocFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  // Sort Toggle
  const handleSort = (field: keyof PenyiapanItem) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Form Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setBarangSearchText('');
    setIsBarangDropdownOpen(false);
    fetchMasterData();

    setFormData({
      id_penyiapan: generatePenyiapanId(),
      item_code: '',
      item_name: '',
      category: 'Finished Good',
      location: 'WH-B-01',
      location_type: 'Floor',
      first_qty: 0,
      last_qty: 0,
      uom: 'CTN',
      qty_convert: 0,
      uom_convert: 'PCS',
      lpn_serial_number: '-',
      batch: '',
      vendor_batch: '-',
      sloc: 'SL02',
      expired_date: '',
      ed: '',
      destination_code: '',
      qc_code: '',
      user_tally: '',
      shelf_life: '',
      source: '',
      tujuan: '',
      user_input: currentUser?.nama || '',
      status: '',
      note: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: PenyiapanItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setBarangSearchText(item.item_code ? `${item.item_code} - ${item.item_name}` : '');
    setIsBarangDropdownOpen(false);
    fetchMasterData();
    setFormData({ ...item });
    setShowFormModal(true);
  };

  const handleSelectBarangItem = (b: DataBarang) => {
    setFormData(prev => {
      const nextItemCode = b.item_code;
      const nextItemName = b.item_name;
      const currentBatch = (prev.batch || '').trim();
      let autoEd = prev.expired_date;
      let autoShelf = prev.shelf_life;

      if (currentBatch) {
        const comp = getEdIsoDateString(nextItemCode, nextItemName, currentBatch);
        if (comp && comp.isoDate) {
          autoEd = comp.isoDate;
          autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
        }
      }

      return {
        ...prev,
        item_code: nextItemCode,
        item_name: nextItemName,
        category: b.category || prev.category || 'Finished Good',
        uom: b.uom || prev.uom || 'CTN',
        expired_date: autoEd,
        ed: autoEd,
        shelf_life: autoShelf
      };
    });
    setBarangSearchText(`${b.item_code} - ${b.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  // Save Form Handler
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalItemCode = formData.item_code?.trim() || '';
    let finalItemName = formData.item_name?.trim() || '';

    if ((!finalItemCode || !finalItemName) && barangSearchText.trim()) {
      const match = barangList.find(
        b =>
          b.item_name.toLowerCase() === barangSearchText.trim().toLowerCase() ||
          b.item_code.toLowerCase() === barangSearchText.trim().toLowerCase()
      );
      if (match) {
        finalItemCode = match.item_code;
        finalItemName = match.item_name;
      } else {
        finalItemName = barangSearchText.trim();
        finalItemCode = 'SKU-' + Date.now().toString().slice(-6);
      }
    }

    if (!finalItemCode || !finalItemName) {
      showToast('Form Belum Lengkap', 'Pilih atau masukkan Kode dan Nama Barang terlebih dahulu!', 'warning');
      return;
    }

    const idPenyiapan = formData.id_penyiapan?.trim() || (isEditMode && selectedItem?.id_penyiapan ? selectedItem.id_penyiapan : generatePenyiapanId());
    const nowIso = new Date().toISOString();

    const recordToSave: PenyiapanItem = {
      id_penyiapan: idPenyiapan,
      item_code: finalItemCode,
      item_name: finalItemName,
      category: formData.category?.trim() || 'Finished Good',
      location: formData.location?.trim() || '-',
      location_type: formData.location_type?.trim() || '-',
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || 0,
      uom: formData.uom?.trim() || 'CTN',
      qty_convert: Number(formData.qty_convert) || 0,
      uom_convert: formData.uom_convert?.trim() || '-',
      lpn_serial_number: formData.lpn_serial_number?.trim() || '-',
      batch: formData.batch?.trim() || '-',
      vendor_batch: formData.vendor_batch?.trim() || '-',
      sloc: formData.sloc?.trim() || '-',
      expired_date: formData.expired_date?.trim() || '-',
      destination_code: formData.destination_code?.trim() || '',
      qc_code: formData.qc_code?.trim() || '',
      user_tally: formData.user_tally?.trim() || '',
      shelf_life: formData.shelf_life?.trim() || '',
      source: formData.source?.trim() || '',
      tujuan: formData.tujuan?.trim() || '',
      user_input: currentUser?.nama || formData.user_input?.trim() || '',
      status: formData.status !== undefined ? formData.status.trim() : '',
      note: formData.note?.trim() || '',
      created_at: isEditMode ? selectedItem?.created_at || nowIso : nowIso
    };

    // 1. Update Local State immediately
    setPenyiapanList(prev => {
      if (isEditMode) {
        return prev.map(item => item.id_penyiapan === idPenyiapan ? recordToSave : item);
      } else {
        return [recordToSave, ...prev.filter(item => item.id_penyiapan !== idPenyiapan)];
      }
    });

    setShowFormModal(false);
    showToast('Tersimpan', `Data penyiapan ${idPenyiapan} berhasil disimpan!`, 'success');

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { ed, ...dbRecord } = recordToSave as any;
        let expDateVal: string | null = null;
        const rawDate = dbRecord.expired_date ? String(dbRecord.expired_date).trim() : '';
        if (rawDate && rawDate !== '-' && rawDate !== 'null' && rawDate !== 'undefined') {
          if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(rawDate)) {
            const delimiter = rawDate.includes('/') ? '/' : (rawDate.includes('-') ? '-' : '.');
            const [d, m, y] = rawDate.split(delimiter);
            expDateVal = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(rawDate)) {
            const delimiter = rawDate.includes('/') ? '/' : (rawDate.includes('-') ? '-' : '.');
            const [y, m, d] = rawDate.split(delimiter);
            expDateVal = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) {
              const y = parsed.getFullYear();
              const m = String(parsed.getMonth() + 1).padStart(2, '0');
              const d = String(parsed.getDate()).padStart(2, '0');
              expDateVal = `${y}-${m}-${d}`;
            }
          }
        }
        dbRecord.expired_date = expDateVal;

        const { error } = await supabase
          .from('data_penyiapan')
          .upsert(dbRecord, { onConflict: 'id_penyiapan' });

        if (error) {
          console.error('Error saving data_penyiapan to database:', error);
          setLastSupabaseError(error.message);
          showToast('Peringatan Database', `Tersimpan lokal, sinkronisasi DB: ${error.message}`, 'warning');
        } else {
          fetchPenyiapanData();
        }
      } catch (err: any) {
        console.error('Database save error:', err);
      }
    }
  };

  // Delete Handler (Akses Khusus Admin)
  const handleDeleteItem = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus data hanya dapat dilakukan oleh pengguna dengan role Admin!', 'danger');
      setShowDeleteModal(false);
      return;
    }

    if (!selectedItem) return;
    const idToDelete = selectedItem.id_penyiapan;

    setPenyiapanList(prev => prev.filter(item => item.id_penyiapan !== idToDelete));
    setShowDeleteModal(false);
    showToast('Terhapus', `Data penyiapan ${idToDelete} berhasil dihapus`, 'info');

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_penyiapan')
          .delete()
          .eq('id_penyiapan', idToDelete);

        if (error) {
          console.error('Error deleting from data_penyiapan:', error);
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

    if (penyiapanList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data penyiapan untuk disinkronkan', 'info');
      return;
    }

    setIsPushing(true);
    try {
      const payload = penyiapanList.map(item => ({
        ...item,
        updated_at: new Date().toISOString()
      }));

      const { successCount, error } = await safeBatchUpsertPenyiapan(payload, 50);

      if (error && successCount === 0) {
        console.error('Push error on data_penyiapan:', error);
        setLastSupabaseError(error.message || JSON.stringify(error));
        showToast('Gagal Sinkronisasi', `Terjadi kendala: ${error.message || 'Periksa koneksi'}`, 'danger');
      } else {
        showToast('Sinkronisasi Sukses', `Semua ${successCount} data penyiapan berhasil disinkronkan ke Database Supabase!`, 'success');
        fetchPenyiapanData();
      }
    } catch (err: any) {
      console.error('Unexpected error pushing penyiapan:', err);
      showToast('Error Sinkronisasi', err?.message || 'Gagal mengirim data ke cloud', 'danger');
    } finally {
      setIsPushing(false);
    }
  };

  // Open Transfer to Pemusnahan Modal (Relasi ke Menu Pemusnahan)
  const handleOpenSendToPemusnahan = (item: PenyiapanItem) => {
    setPemusnahanTargetItem(item);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `PMS-${dateStr}-${randomSuffix}`;

    setPemusnahanFormData({
      id_pemusnahan: generatedId,
      tujuan: 'Pemusnahan Limbah Terkontrol',
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category || 'Damaged',
      location: 'WH-REJECT-01',
      location_type: 'Quarantine',
      first_qty: item.first_qty ?? 0,
      last_qty: item.last_qty ?? 0,
      uom: item.uom || 'CTN',
      qty_convert: item.qty_convert ?? item.last_qty ?? 0,
      uom_convert: item.uom_convert || 'PCS',
      lpn_serial_number: item.lpn_serial_number && item.lpn_serial_number !== '-' ? item.lpn_serial_number : `LPN-PMS-${dateStr}-${randomSuffix}`,
      batch: item.batch || '-',
      vendor_batch: item.vendor_batch || '-',
      sloc: 'SL99',
      expired_date: item.expired_date || '-',
      destination_code: 'INCINERATOR',
      qc_code: 'QC-REJECT',
      user_tally: currentUser?.nama || item.user_tally || 'Tally QC',
      shelf_life: item.shelf_life || 'Expired',
      source: `Penyiapan (${item.id_penyiapan})`,
      user_input: currentUser?.nama || 'Admin',
      tanggal_update: now.toISOString(),
      status: 'Siap Dimusnahkan',
      note: item.note ? `${item.note} - Dari Penyiapan ${item.id_penyiapan}` : `Ditransfer dari Penyiapan ID: ${item.id_penyiapan}`
    });
    setShowPemusnahanModal(true);
  };

  // Confirm Transfer to Pemusnahan (Inserts to public.data_pemusnahan and updates data_penyiapan)
  const handleConfirmSendToPemusnahan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pemusnahanTargetItem || !pemusnahanFormData.id_pemusnahan) return;

    setIsSendingPemusnahan(true);
    const nowIso = new Date().toISOString();
    const payload = {
      id_pemusnahan: pemusnahanFormData.id_pemusnahan,
      tujuan: pemusnahanFormData.tujuan || 'Pemusnahan Limbah Terkontrol',
      item_code: pemusnahanFormData.item_code,
      item_name: pemusnahanFormData.item_name,
      category: pemusnahanFormData.category || 'Damaged',
      location: pemusnahanFormData.location || 'WH-REJECT-01',
      location_type: pemusnahanFormData.location_type || 'Quarantine',
      first_qty: Number(pemusnahanFormData.first_qty) || 0,
      last_qty: Number(pemusnahanFormData.last_qty) || 0,
      uom: pemusnahanFormData.uom || 'CTN',
      qty_convert: Number(pemusnahanFormData.qty_convert) || 0,
      uom_convert: pemusnahanFormData.uom_convert || 'PCS',
      lpn_serial_number: pemusnahanFormData.lpn_serial_number || '-',
      batch: pemusnahanFormData.batch || '-',
      vendor_batch: pemusnahanFormData.vendor_batch || '-',
      sloc: pemusnahanFormData.sloc || 'SL99',
      expired_date: pemusnahanFormData.expired_date || '-',
      destination_code: pemusnahanFormData.destination_code || 'INCINERATOR',
      qc_code: pemusnahanFormData.qc_code || 'QC-REJECT',
      user_tally: pemusnahanFormData.user_tally || currentUser?.nama || 'Tally QC',
      shelf_life: pemusnahanFormData.shelf_life || 'Expired',
      source: pemusnahanFormData.source || `Penyiapan (${pemusnahanTargetItem.id_penyiapan})`,
      user_input: currentUser?.nama || 'Admin',
      tanggal_update: nowIso,
      status: pemusnahanFormData.status || 'Siap Dimusnahkan',
      note: pemusnahanFormData.note || '',
      created_at: nowIso,
      updated_at: nowIso
    };

    try {
      // 1. Insert into data_pemusnahan in Supabase
      if (isSupabaseConfigured) {
        const { error: pmsError } = await supabase
          .from('data_pemusnahan')
          .upsert(payload, { onConflict: 'id_pemusnahan' });

        if (pmsError) {
          console.error('Error inserting into data_pemusnahan:', pmsError);
        }
      }

      // 2. Append to local pemusnahan_cache_v1
      try {
        const cached = localStorage.getItem('pemusnahan_cache_v1');
        const list = cached ? JSON.parse(cached) : [];
        const merged = [payload, ...list.filter((x: any) => x.id_pemusnahan !== payload.id_pemusnahan)];
        localStorage.setItem('pemusnahan_cache_v1', JSON.stringify(merged));
      } catch (err) {
        console.warn('Error updating local pemusnahan cache:', err);
      }

      // 3. Update status in Penyiapan to 'Terkirim ke Pemusnahan'
      const updatedStatus = 'Terkirim ke Pemusnahan';
      setPenyiapanList(prev => prev.map(p => p.id_penyiapan === pemusnahanTargetItem.id_penyiapan ? { ...p, status: updatedStatus } : p));

      if (isSupabaseConfigured) {
        await supabase
          .from('data_penyiapan')
          .update({ status: updatedStatus, updated_at: nowIso })
          .eq('id_penyiapan', pemusnahanTargetItem.id_penyiapan);
      }

      setShowPemusnahanModal(false);
      showToast(
        'Berhasil Dikirim ke Pemusnahan',
        `Item ${payload.item_name} berhasil dicatat di Menu Pemusnahan (${payload.id_pemusnahan})`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to transfer to pemusnahan:', err);
      showToast('Gagal Transfer', err?.message || 'Terjadi kesalahan saat memindahkan data', 'danger');
    } finally {
      setIsSendingPemusnahan(false);
    }
  };

  const handleUpdateStatus = async (item: PenyiapanItem, newStatus: string) => {
    if (newStatus === 'Oke' || newStatus === 'Siap Dimusnahkan') {
      handleOpenSendToPemusnahan(item);
      return;
    }

    const oldStatus = item.status;
    
    // Optimistic UI update
    setPenyiapanList(prev => prev.map(p => p.id_penyiapan === item.id_penyiapan ? { ...p, status: newStatus } : p));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_penyiapan')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id_penyiapan', item.id_penyiapan);

        if (error) {
          throw error;
        }
      } catch (err: any) {
        console.error('Failed to update status', err);
        showToast('Error', 'Gagal mengubah status', 'danger');
        // Revert on failure
        setPenyiapanList(prev => prev.map(p => p.id_penyiapan === item.id_penyiapan ? { ...p, status: oldStatus } : p));
      }
    }
  };

  // Inline Cell Update directly from Table in Penyiapan (Location, Qty, Expired Date, Note, etc.)
  const handleInlineCellUpdate = async (item: PenyiapanItem, field: keyof PenyiapanItem, newValue: any) => {
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

    // 1. Optimistic Local State & Cache Update
    setPenyiapanList(prev => prev.map(p => p.id_penyiapan === item.id_penyiapan ? updatedItem : p));

    try {
      const currentCache = localStorage.getItem('penyiapan_cache_v1');
      if (currentCache) {
        const parsed = JSON.parse(currentCache);
        const nextCache = parsed.map((p: PenyiapanItem) => p.id_penyiapan === item.id_penyiapan ? updatedItem : p);
        localStorage.setItem('penyiapan_cache_v1', JSON.stringify(nextCache));
      }
    } catch (e) {
      console.warn('Cache write warning:', e);
    }

    // 2. Sync to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('data_penyiapan')
          .update({
            [field]: processedValue,
            ...(updatedItem.expired_date !== item.expired_date ? { expired_date: updatedItem.expired_date, shelf_life: updatedItem.shelf_life } : {}),
            updated_at: nowIso
          })
          .eq('id_penyiapan', item.id_penyiapan);

        if (error) throw error;
      } catch (err: any) {
        console.error(`Failed to inline update ${String(field)} on Supabase data_penyiapan:`, err);
        showToast('Peringatan Sync', `Gagal menyimpan perubahan ${String(field)}: ${err.message}`, 'warning');
        setPenyiapanList(prev => prev.map(p => p.id_penyiapan === item.id_penyiapan ? item : p));
      }
    }
  };

  // =========================================================================
  // MULTI-SELECTION & BULK TRANSFER HANDLERS
  // =========================================================================
  const handleToggleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllFiltered = () => {
    const filteredIds = filteredPenyiapan.map(item => item.id_penyiapan);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Quick Action: Select All items with status "Ada"
  const handleSelectAllAda = () => {
    const adaItems = penyiapanList.filter(
      item => (item.status || '').trim().toLowerCase() === 'ada'
    );
    if (adaItems.length === 0) {
      showToast('Tidak Ada Data', 'Tidak ditemukan data penyiapan dengan status "Ada"', 'warning');
      return;
    }
    const adaIds = adaItems.map(item => item.id_penyiapan);
    setSelectedIds(adaIds);
    showToast(
      'Pilih Otomatis Status "Ada"',
      `${adaIds.length} item berstatus "Ada" terpilih siap dipindahkan`,
      'info'
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleOpenBulkTransferModal = () => {
    if (selectedIds.length === 0) {
      showToast('Pilih Data', 'Pilih minimal 1 data penyiapan untuk dipindahkan massal', 'warning');
      return;
    }
    const initialDest = BULK_DESTINATIONS.find(d => d.id === bulkTargetModuleId) || BULK_DESTINATIONS[0];
    setBulkFormData({
      sloc: initialDest.defaultSloc,
      location: initialDest.defaultLocation,
      location_type: initialDest.defaultLocationType,
      qc_code: initialDest.defaultQcCode,
      destination_code: initialDest.defaultDestinationCode,
      target_status: initialDest.defaultStatus,
      tujuan: initialDest.defaultTujuan,
      category: initialDest.defaultCategory,
      note: `Transfer massal ${selectedIds.length} item dari Penyiapan`
    });
    setBulkSourceStatus(initialDest.sourceStatusDefault);
    setShowBulkTransferModal(true);
  };

  const handleDestinationChange = (destId: string) => {
    setBulkTargetModuleId(destId);
    const dest = BULK_DESTINATIONS.find(d => d.id === destId);
    if (dest) {
      setBulkFormData((prev: any) => ({
        ...prev,
        sloc: dest.defaultSloc,
        location: dest.defaultLocation,
        location_type: dest.defaultLocationType,
        qc_code: dest.defaultQcCode,
        destination_code: dest.defaultDestinationCode,
        target_status: dest.defaultStatus,
        tujuan: dest.defaultTujuan,
        category: dest.defaultCategory,
        note: `Transfer massal ${selectedIds.length} item dari Penyiapan ke ${dest.name}`
      }));
      setBulkSourceStatus(dest.sourceStatusDefault);
    }
  };

  // Bulk update status directly in Penyiapan
  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    const nowIso = new Date().toISOString();
    
    // Update local state optimistically
    setPenyiapanList(prev =>
      prev.map(item => (selectedIds.includes(item.id_penyiapan) ? { ...item, status: newStatus } : item))
    );

    if (isSupabaseConfigured) {
      try {
        const idChunks = chunkArray(selectedIds, 50);
        for (const ids of idChunks) {
          await supabase
            .from('data_penyiapan')
            .update({ status: newStatus, updated_at: nowIso })
            .in('id_penyiapan', ids);
        }
      } catch (err) {
        console.error('Error updating bulk status in Supabase:', err);
      }
    }

    showToast('Status Diperbarui', `${selectedIds.length} data penyiapan diubah statusnya menjadi "${newStatus}"`, 'success');
  };

  // Execute Bulk Transfer to Selected Destination Database
  const handleExecuteBulkTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    const targetConfig = BULK_DESTINATIONS.find(d => d.id === bulkTargetModuleId) || BULK_DESTINATIONS[0];
    const itemsToTransfer = penyiapanList.filter(item => selectedIds.includes(item.id_penyiapan));
    if (itemsToTransfer.length === 0) return;

    setIsBulkTransferring(true);
    setBulkTransferProgress({ current: 0, total: itemsToTransfer.length, percentage: 0 });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const nowIso = now.toISOString();

    // Construct target payload
    const targetPayloads = itemsToTransfer.map((item, idx) => {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedId = `${targetConfig.idPrefix}${dateStr}-${randomSuffix}-${idx + 1}`;

      return {
        [targetConfig.idField]: generatedId,
        tujuan: bulkFormData.tujuan || targetConfig.defaultTujuan,
        item_code: item.item_code,
        item_name: item.item_name,
        category: item.category || targetConfig.defaultCategory,
        location: targetConfig.defaultLocation || item.location || 'WH-01',
        location_type: targetConfig.defaultLocationType || item.location_type || 'Rack',
        first_qty: Number(item.first_qty) || 0,
        last_qty: Number(item.last_qty) || 0,
        uom: item.uom || 'CTN',
        qty_convert: Number(item.qty_convert) || Number(item.last_qty) || 0,
        uom_convert: item.uom_convert || 'PCS',
        lpn_serial_number: item.lpn_serial_number && item.lpn_serial_number !== '-' ? item.lpn_serial_number : `LPN-${targetConfig.idPrefix}${dateStr}-${randomSuffix}`,
        batch: item.batch || '-',
        vendor_batch: item.vendor_batch || '-',
        sloc: targetConfig.defaultSloc || item.sloc || 'SL01',
        expired_date: (item.expired_date && item.expired_date !== '-') ? item.expired_date : null,
        destination_code: targetConfig.defaultDestinationCode || item.destination_code || 'DST-01',
        qc_code: targetConfig.defaultQcCode || item.qc_code || 'QC-PASS',
        user_tally: item.user_tally || currentUser?.nama || 'Tally QC',
        shelf_life: item.shelf_life || '24 Bulan',
        source: `Penyiapan (${item.id_penyiapan})`,
        user_input: currentUser?.nama || 'Admin',
        tanggal_update: nowIso,
        status: bulkFormData.target_status || targetConfig.defaultStatus,
        note: bulkFormData.note || '',
        created_at: nowIso,
        updated_at: nowIso
      };
    });

    try {
      // 1. Batch upsert into Supabase target table
      if (isSupabaseConfigured) {
        const chunks = chunkArray(targetPayloads, 50);
        let processed = 0;
        for (const chunk of chunks) {
          const { error } = await supabase
            .from(targetConfig.tableName)
            .upsert(chunk as any, { onConflict: targetConfig.idField });

          if (error) {
            console.warn(`Batch upsert error on ${targetConfig.tableName}, trying single item fallback:`, error);
            for (const single of chunk) {
              await supabase
                .from(targetConfig.tableName)
                .upsert([single] as any, { onConflict: targetConfig.idField });
            }
          }
          processed += chunk.length;
          setBulkTransferProgress({
            current: processed,
            total: targetPayloads.length,
            percentage: Math.round((processed / targetPayloads.length) * 100)
          });
        }
      }

      // 2. Update local storage cache for destination table
      try {
        const cachedTarget = localStorage.getItem(targetConfig.cacheKey);
        const targetList = cachedTarget ? JSON.parse(cachedTarget) : [];
        const mergedTargetList = [...targetPayloads, ...targetList.filter((x: any) => !targetPayloads.some(p => p[targetConfig.idField] === x[targetConfig.idField]))];
        localStorage.setItem(targetConfig.cacheKey, JSON.stringify(mergedTargetList));
      } catch (e) {
        console.warn('Error updating local target cache:', e);
      }

      // 3. Handle action on source (data_penyiapan)
      if (bulkSourceAction === 'update_status') {
        const newStatus = bulkSourceStatus || targetConfig.sourceStatusDefault;
        setPenyiapanList(prev =>
          prev.map(p => (selectedIds.includes(p.id_penyiapan) ? { ...p, status: newStatus } : p))
        );

        if (isSupabaseConfigured) {
          const idChunks = chunkArray(selectedIds, 50);
          for (const ids of idChunks) {
            await supabase
              .from('data_penyiapan')
              .update({ status: newStatus, updated_at: nowIso })
              .in('id_penyiapan', ids);
          }
        }
      } else if (bulkSourceAction === 'delete') {
        setPenyiapanList(prev => prev.filter(p => !selectedIds.includes(p.id_penyiapan)));

        if (isSupabaseConfigured) {
          const idChunks = chunkArray(selectedIds, 50);
          for (const ids of idChunks) {
            await supabase
              .from('data_penyiapan')
              .delete()
              .in('id_penyiapan', ids);
          }
        }
      }

      showToast(
        'Pindah Data Massal Berhasil!',
        `${targetPayloads.length} item berhasil ditransfer ke ${targetConfig.name}`,
        'success'
      );

      setSelectedIds([]);
      setShowBulkTransferModal(false);
    } catch (err: any) {
      console.error('Bulk transfer failed:', err);
      showToast('Gagal Pindah Data', err?.message || 'Terjadi kesalahan saat memproses transfer massal', 'danger');
    } finally {
      setIsBulkTransferring(false);
    }
  };

  // Bulk Delete Penyiapan (Khusus Admin)
  const handleBulkDeletePenyiapan = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus massal data penyiapan hanya dapat dilakukan oleh Admin!', 'danger');
      return;
    }

    if (selectedIds.length === 0) {
      showToast('Data Kosong', 'Pilih minimal satu baris data penyiapan untuk dihapus', 'warning');
      return;
    }

    const count = selectedIds.length;
    showConfirm({
      title: 'Hapus Massal Data Penyiapan',
      message: `Apakah Anda yakin ingin menghapus ${count} data penyiapan terpilih secara permanen dari tabel dan database? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: `Ya, Hapus ${count} Data`,
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const idsToDelete = [...selectedIds];
        const idSet = new Set(idsToDelete);

        setPenyiapanList(prev => prev.filter(item => !idSet.has(item.id_penyiapan)));
        setSelectedIds([]);

        if (isSupabaseConfigured) {
          try {
            const chunkSize = 50;
            for (let i = 0; i < idsToDelete.length; i += chunkSize) {
              const chunk = idsToDelete.slice(i, i + chunkSize);
              const { error } = await supabase
                .from('data_penyiapan')
                .delete()
                .in('id_penyiapan', chunk);

              if (error) {
                console.error('Error batch deleting from data_penyiapan:', error);
              }
            }
          } catch (err: any) {
            console.error('Database batch delete error:', err);
          }
        }

        showToast('Hapus Massal Sukses', `${count} data penyiapan berhasil dihapus`, 'success');
      }
    });
  };

  // Clear All Data (Khusus Admin)
  const handleClearAllData = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus semua data penyiapan hanya dapat dilakukan oleh pengguna dengan role Admin!', 'danger');
      return;
    }

    if (penyiapanList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data penyiapan untuk dihapus', 'info');
      return;
    }

    showConfirm({
      title: 'Hapus Semua Data Penyiapan',
      message: `PERINGATAN TINGGI: Apakah Anda yakin ingin menghapus SEMUA (${penyiapanList.length}) data penyiapan dari aplikasi dan database cloud? Tindakan ini TIDAK DAPAT DIBATALKAN.`,
      confirmText: `Ya, Kosongkan Semua (${penyiapanList.length} Item)`,
      cancelText: 'Batal / Amankan Data',
      type: 'danger',
      onConfirm: async () => {
        if (isSupabaseConfigured) {
          try {
            const { error } = await supabase
              .from('data_penyiapan')
              .delete()
              .neq('id_penyiapan', '___NON_EXISTENT_ID___'); // Delete all rows

            if (error) {
              showToast('Error Database', error.message, 'danger');
              return;
            }
          } catch (err: any) {
            showToast('Error Database', 'Gagal menghapus data di database', 'danger');
            return;
          }
        }
        setPenyiapanList([]);
        setSelectedIds([]);
        localStorage.removeItem('penyiapan_cache_v1');
        showToast('Terhapus', 'Semua data penyiapan berhasil dibersihkan dari database', 'success');
      }
    });
  };

  // Download Excel Template (Exact columns from user request)
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Item Code': '21104508',
        'Item Name': 'KINO CANDY MINT 150G',
        'Category': 'Finished Good',
        'Location': 'WH-B-01',
        'Location Type': 'Floor',
        'First Qty': 100,
        'Last Qty': 100,
        'Uom': 'CTN',
        'Qty Convert': 100,
        'Uom Convert': 'PCS',
        'LPN/Serial Number': 'LPN-2026-0081',
        'Batch': '0456',
        'Vendor Batch': 'VB-9912',
        'SLOC': 'SL02',
        'Expired Date': '2027-02-14',
        'Destination Code': 'DST-02',
        'QC Code': 'QC-PASS',
        'User Tally': 'Budi Santoso',
        'Shelf Life': '24 Bulan',
        'Source': 'Stok Gudang',
        'Status': '',
        'Note': ''
      },
      {
        'Item Code': '21104509',
        'Item Name': 'CAP KAKI TIGA GUAVA 320ML',
        'Category': 'Finished Good',
        'Location': 'WH-B-02',
        'Location Type': 'Rack',
        'First Qty': 50,
        'Last Qty': 50,
        'Uom': 'CTN',
        'Qty Convert': 50,
        'Uom Convert': 'PCS',
        'LPN/Serial Number': 'LPN-2026-0082',
        'Batch': '1126',
        'Vendor Batch': 'VB-9913',
        'SLOC': 'SL02',
        'Expired Date': '2027-04-22',
        'Destination Code': 'DST-02',
        'QC Code': 'QC-PASS',
        'User Tally': 'Ahmad Fauzi',
        'Shelf Life': '24 Bulan',
        'Source': 'Stok Gudang',
        'Status': '',
        'Note': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 16 }, // Item Code
      { wch: 35 }, // Item Name
      { wch: 18 }, // Category
      { wch: 15 }, // Location
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
      { wch: 18 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 16 }, // Source
      { wch: 14 }, // Status
      { wch: 20 }  // Note
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Penyiapan');
    XLSX.writeFile(wb, 'Template_Upload_Penyiapan_data_penyiapan.xlsx');
    showToast('Template Terunduh', 'Template Excel Penyiapan sesuai kolom format berhasil diunduh.', 'info');
  };

  // Export Filtered / All Penyiapan Data to Excel
  const handleExportExcel = () => {
    if (filteredPenyiapan.length === 0) {
      showToast('Data Kosong', 'Tidak ada data penyiapan yang sesuai filter untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredPenyiapan.map((item, idx) => ({
      'No': idx + 1,
      'ID Penyiapan': item.id_penyiapan || '-',
      'Item Code': item.item_code || '-',
      'Item Name': item.item_name || '-',
      'Category': item.category || '-',
      'Location': item.location || '-',
      'Location Type': item.location_type || '-',
      'First Qty': item.first_qty ?? 0,
      'Last Qty': item.last_qty ?? 0,
      'Uom': item.uom || '-',
      'Qty Convert': item.qty_convert ?? 0,
      'Uom Convert': item.uom_convert || '-',
      'LPN/Serial Number': item.lpn_serial_number || '-',
      'Batch': item.batch || '-',
      'Vendor Batch': item.vendor_batch || '-',
      'SLOC': item.sloc || '-',
      'Expired Date': item.expired_date || '-',
      'Destination Code': item.destination_code || '-',
      'QC Code': item.qc_code || '-',
      'User Tally': item.user_tally || '-',
      'Shelf Life': item.shelf_life || '-',
      'Source': item.source || '-',
      'Status': item.status || '-',
      'User Input': item.user_input || '-',
      'Catatan': item.note || '-',
      'Created At': item.created_at || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 22 }, // ID Penyiapan
      { wch: 16 }, // Item Code
      { wch: 35 }, // Item Name
      { wch: 18 }, // Category
      { wch: 14 }, // Location
      { wch: 16 }, // Location Type
      { wch: 12 }, // First Qty
      { wch: 12 }, // Last Qty
      { wch: 10 }, // Uom
      { wch: 14 }, // Qty Convert
      { wch: 14 }, // Uom Convert
      { wch: 20 }, // LPN/Serial Number
      { wch: 14 }, // Batch
      { wch: 16 }, // Vendor Batch
      { wch: 12 }, // SLOC
      { wch: 16 }, // Expired Date
      { wch: 18 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 16 }, // Source
      { wch: 14 }, // Status
      { wch: 16 }, // User Input
      { wch: 22 }, // Catatan
      { wch: 22 }  // Created At
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data_penyiapan');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Data_Penyiapan_${dateStr}.xlsx`);
    showToast('Download Selesai', `File Laporan_Data_Penyiapan_${dateStr}.xlsx berhasil diunduh!`, 'success');
  };

  // Open Excel Modal (Check Admin Role)
  const handleOpenExcelModal = () => {
    if (!isSuperAdmin) {
      showToast('Akses Dibatasi', 'Hanya pengguna dengan Role Admin yang diizinkan mengupload file Excel.', 'warning');
      return;
    }
    setParsedExcelRows([]);
    setExcelFileName('');
    setShowExcelModal(true);
  };

  // Handle High-Speed Excel Upload Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          showToast('File Kosong', 'File Excel tidak memiliki baris data!', 'warning');
          setParsedExcelRows([]);
          return;
        }

        const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const nowIso = new Date().toISOString();
        const dateStrPrefix = nowIso.slice(0, 10).replace(/-/g, '');

        const rawList: PenyiapanItem[] = rawJson.map((row, idx) => {
          const normalizedRow: Record<string, any> = {};
          for (const k of Object.keys(row)) {
            normalizedRow[normalizeKey(k)] = row[k];
          }

          const getVal = (candidates: string[]) => {
            for (const c of candidates) {
              const norm = normalizeKey(c);
              const val = normalizedRow[norm];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return val;
              }
            }
            return '';
          };

          // 1. item_code
          const itemCode = String(getVal(['item_code', 'itemcode', 'Item Code', 'sku', 'kode_barang', 'kodebarang', 'kode_item', 'item']) || '').trim();
          // 2. item_name
          const itemName = String(getVal(['item_name', 'itemname', 'Item Name', 'Nama Barang', 'namabarang', 'deskripsi', 'nama_item']) || '').trim();
          // 3. category
          const category = String(getVal(['category', 'Category', 'Kategori', 'kategori']) || 'Finished Good').trim();
          // 4. location
          const location = String(getVal(['location', 'Location', 'Lokasi', 'rak', 'bin', 'posisi']) || '-').trim();
          // 5. location_type
          const locationType = String(getVal(['location_type', 'locationtype', 'Location Type', 'Tipe Lokasi', 'tipe']) || '-').trim();
          // 6. first_qty
          const firstQty = Number(getVal(['first_qty', 'firstqty', 'First Qty', 'Qty Awal', 'qtyawal', 'po_qty', 'qtysj'])) || 0;
          // 7. last_qty
          const lastQty = Number(getVal(['last_qty', 'lastqty', 'Last Qty', 'Qty Akhir', 'qty_penyiapan', 'qty_aktual', 'qty'])) || firstQty || 0;
          // 8. uom
          const uom = String(getVal(['uom', 'Uom', 'UOM', 'Satuan', 'unit']) || 'CTN').trim();
          // 9. qty_convert
          const qtyConvert = Number(getVal(['qty_convert', 'qtyconvert', 'Qty Convert', 'Qty Konversi', 'qtykonversi', 'qty_pcs', 'total_pcs'])) || lastQty || 0;
          // 10. uom_convert
          const uomConvert = String(getVal(['uom_convert', 'uomconvert', 'Uom Convert', 'Satuan Konversi', 'satuankonversi', 'satuan_terkecil']) || 'PCS').trim();
          // 11. lpn_serial_number
          const lpn = String(getVal(['lpn_serial_number', 'lpnserialnumber', 'LPN/Serial Number', 'LPN Serial Number', 'LPN', 'Serial Number', 'lpn', 'no_seri', 'serial_number']) || '-').trim();
          // 12. batch
          const batch = String(getVal(['batch', 'Batch', 'No Batch', 'nobatch', 'kode_batch', 'lot', 'batch_no']) || '-').trim();
          // 13. vendor_batch
          const vendorBatch = String(getVal(['vendor_batch', 'vendorbatch', 'Vendor Batch', 'Batch Vendor', 'batchvendor', 'lot_vendor']) || '-').trim();
          // 14. sloc
          const sloc = String(getVal(['sloc', 'SLOC', 'SLoc', 'storage_location']) || 'SL02').trim();

          // 15. expired_date
          let expDate = String(getVal(['expired_date', 'expireddate', 'Expired Date', 'exp_date', 'tanggal_ed', 'kadaluwarsa', 'ed']) || '').trim();
          if (/^\d{5}$/.test(expDate)) {
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + Number(expDate) * 86400000);
            if (!isNaN(dateObj.getTime())) {
              expDate = dateObj.toISOString().slice(0, 10);
            }
          } else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(expDate)) {
            const delimiter = expDate.includes('/') ? '/' : (expDate.includes('-') ? '-' : '.');
            const [d, m, y] = expDate.split(delimiter);
            expDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(expDate)) {
            const delimiter = expDate.includes('/') ? '/' : (expDate.includes('-') ? '-' : '.');
            const [y, m, d] = expDate.split(delimiter);
            expDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }

          // 16. destination_code
          const destCode = String(getVal(['destination_code', 'destinationcode', 'Destination Code', 'dest_code', 'destcode', 'kode_tujuan']) || '').trim();
          // 17. qc_code
          const qcCode = String(getVal(['qc_code', 'qccode', 'QC Code', 'Status QC', 'qc', 'kondisi_qc']) || '').trim().toUpperCase();
          // 18. user_tally
          const userTally = String(getVal(['user_tally', 'usertally', 'User Tally', 'Petugas Tally', 'tally', 'checker']) || '').trim();

          // 19. shelf_life
          let shelfLife = String(getVal(['shelf_life', 'shelflife', 'Shelf Life', 'masa_simpan']) || '').trim();
          if (!expDate && batch && batch !== '-' && itemName) {
            const autoCalc = getEdIsoDateString(itemCode, itemName, batch);
            if (autoCalc && autoCalc.isoDate) {
              expDate = autoCalc.isoDate;
              if (!shelfLife) {
                shelfLife = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
              }
            }
          }

          // 20. source
          const source = String(getVal(['source', 'Source', 'Sumber', 'asal', 'source_location']) || '').trim();

          const rawId = String(getVal(['id_penyiapan', 'idpenyiapan', 'ID Penyiapan', 'id', 'kode_penyiapan']) || '').trim();
          const idGenerated = rawId || `PEN-${dateStrPrefix}-${String(idx + 1).padStart(4, '0')}`;

          const tujuan = String(getVal(['tujuan', 'Tujuan', 'destination', 'tujuan_pengiriman']) || '').trim();

          // 21. status: Kosong atau isi status dari excel
          const rawStatus = String(getVal(['status', 'Status', 'status_penyiapan']) || '').trim();
          const status = rawStatus;

          const note = String(getVal(['note', 'Note', 'catatan', 'keterangan']) || '').trim();

          return {
            id_penyiapan: idGenerated,
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
            expired_date: expDate || '-',
            destination_code: destCode,
            qc_code: qcCode,
            user_tally: userTally,
            shelf_life: shelfLife,
            source,
            tujuan,
            user_input: currentUser?.nama || 'Admin',
            status,
            note,
            created_at: nowIso
          };
        }).filter(r => r.item_code && r.item_name);

        // Fast Deduplication
        const penyiapanMap = new Map<string, PenyiapanItem>();
        for (const item of rawList) {
          const key = item.id_penyiapan.trim().toLowerCase();
          penyiapanMap.set(key, { ...item, id_penyiapan: item.id_penyiapan.trim() });
        }
        const formatted = Array.from(penyiapanMap.values());

        setParsedExcelRows(formatted);
        if (formatted.length > 0) {
          showToast('Excel Terbaca Cepat', `${formatted.length} baris data penyiapan valid ditemukan`, 'info');
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

    reader.readAsArrayBuffer(file);
  };

  // Commit Parsed Excel to Database & Local State (High Speed Batching & Seamless Sync)
  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) return;

    isImportingRef.current = true;
    setIsProcessingExcel(true);
    setUploadProgress({
      isUploading: true,
      current: 0,
      total: parsedExcelRows.length,
      percentage: 0,
      statusText: 'Mempersiapkan data penyiapan...'
    });

    try {
      // 1. Merge locally for instant display
      const mergedMap = new Map<string, PenyiapanItem>();
      for (const item of penyiapanList) {
        mergedMap.set(item.id_penyiapan.toLowerCase(), item);
      }
      for (const item of parsedExcelRows) {
        mergedMap.set(item.id_penyiapan.toLowerCase(), item);
      }
      const finalMerged = Array.from(mergedMap.values());
      setPenyiapanList(finalMerged);

      // 2. Persist to Supabase with chunk size 500 & live progress indicator
      if (isSupabaseConfigured) {
        setUploadProgress(prev => ({
          ...prev,
          statusText: `Mengunggah ${parsedExcelRows.length.toLocaleString('id-ID')} data ke Database Supabase...`
        }));

        const { successCount, error } = await safeBatchUpsertPenyiapan(
          parsedExcelRows,
          500,
          (processed, total) => {
            const pct = Math.round((processed / total) * 100);
            setUploadProgress({
              isUploading: true,
              current: processed,
              total,
              percentage: pct,
              statusText: `Mengunggah ${processed.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} baris (${pct}%)...`
            });
          }
        );

        if (error && successCount === 0) {
          showToast('Peringatan Database', `Tersimpan di memori lokal, namun gagal sync ke cloud: ${error.message}`, 'warning');
        } else {
          setUploadProgress({
            isUploading: true,
            current: parsedExcelRows.length,
            total: parsedExcelRows.length,
            percentage: 100,
            statusText: 'Unggah selesai! Memfinalisasi data...'
          });
          showToast('Import Selesai', `${successCount.toLocaleString('id-ID')} data penyiapan berhasil diunggah ke Database Supabase!`, 'success');
          // Silent refresh: background fetch without unmounting table or blinking screen
          await fetchPenyiapanData(true);
        }
      } else {
        setUploadProgress({
          isUploading: true,
          current: parsedExcelRows.length,
          total: parsedExcelRows.length,
          percentage: 100,
          statusText: 'Tersimpan di penyimpanan lokal!'
        });
        showToast('Import Lokal Selesai', `${parsedExcelRows.length} data penyiapan berhasil disimpan di penyimpanan lokal!`, 'success');
      }

      // Smooth transition to close modal without screen flash
      setTimeout(() => {
        setShowExcelModal(false);
        setParsedExcelRows([]);
        setExcelFileName('');
        setUploadProgress({
          isUploading: false,
          current: 0,
          total: 0,
          percentage: 0,
          statusText: ''
        });
        setIsProcessingExcel(false);
        isImportingRef.current = false;
      }, 400);

    } catch (err: any) {
      console.error('Error committing excel import:', err);
      showToast('Gagal Import', err?.message || 'Terjadi kesalahan saat menyimpan data import', 'danger');
      setIsProcessingExcel(false);
      isImportingRef.current = false;
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
    }
  };

  // Helper copy text
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
          {/* Tambah Penyiapan Manual */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Tambah Data Penyiapan Manual"
          >
            <Plus size={14} />
            <span>Tambah Data</span>
          </button>

          {/* Upload Excel Button (Admin role privileged) */}
          <button
            onClick={handleOpenExcelModal}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              isSuperAdmin
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs hover:shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
            }`}
            title={isSuperAdmin ? 'Upload Data Excel (data_penyiapan)' : 'Upload Excel Khusus Admin'}
          >
            <Upload size={13} />
            <span>Upload Excel</span>
            {isSuperAdmin && (
              <span className="px-1 py-0.2 rounded bg-emerald-800 text-[8px] font-extrabold uppercase text-white">
                Admin
              </span>
            )}
          </button>

          {/* Download Template Excel */}
          <button
            onClick={downloadExcelTemplate}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Download Template Format Excel Sesuai Kolom"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            <span>Template Excel</span>
          </button>

          {/* Export Excel Data */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Ekspor Data Penyiapan ke File Excel (.xlsx)"
          >
            <Download size={13} className="text-blue-700" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>

        {/* Right Side: Refresh & Sync Database */}
        <div className="flex items-center gap-1.5">
          {/* Refresh Live */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Clear All Data */}
          {isSuperAdmin && (
            <button
              onClick={handleClearAllData}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer"
              title="Hapus Semua Data Penyiapan"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear All Data</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH BAR & DYNAMIC FILTERS */}
      {/* ========================================================================= */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
        {/* Search Input with Voice Search Recognition */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari Item Code, Item Name, Batch, LPN, Lokasi, SLOC, Petugas Tally..."
            className="w-full pl-8 pr-20 py-1.5 rounded-lg border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 text-xs font-medium transition-all"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}

            {/* Speech to Text Microphone for Table Search */}
            <button
              type="button"
              onClick={toggleSpeechToTextSearch}
              className={`p-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isListeningSearch
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
              }`}
              title="Pencarian Suara (Speech to Text)"
            >
              {isListeningSearch ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          </div>
        </div>

        {/* Speech Recognition Feedback Banner */}
        {speechFeedbackSearch && (
          <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
            <Radio size={13} className="text-rose-600 animate-pulse" />
            <span className="font-semibold text-xs">{speechFeedbackSearch}</span>
          </div>
        )}

        {/* Filter Dropdowns (Hanya Lokasi & Status Penyiapan) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Filter Lokasi (Ketik & Dropdown) */}
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Lokasi</label>
            <div className="relative flex items-center">
              <input
                list="location-options"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari Lokasi..."
                className="w-full p-1.5 pr-6 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-slate-700"
              />
              {locationFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Clear Filter Lokasi"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <datalist id="location-options">
              {uniqueLocationsList.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Status Penyiapan</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              {uniqueStatuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Action Strip for Status "Ada" & Bulk Selection */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center gap-1">
              <Zap size={11} className="text-amber-500" />
              Aksi Cepat:
            </span>

            {/* Quick Filter Status Ada Button */}
            <button
              type="button"
              onClick={() => {
                if (statusFilter === 'Ada') {
                  setStatusFilter('ALL');
                } else {
                  setStatusFilter('Ada');
                }
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                statusFilter === 'Ada'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
              title="Filter tabel hanya untuk data dengan status Ada"
            >
              <Check size={12} />
              <span>{statusFilter === 'Ada' ? 'Filter Aktif: Status "Ada"' : 'Filter Status "Ada"'}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${statusFilter === 'Ada' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-900 font-bold'}`}>
                {adaCount}
              </span>
            </button>

            {/* Select All "Ada" Items Button */}
            <button
              type="button"
              onClick={handleSelectAllAda}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-900 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
              title="Pilih dan centang semua item dengan status 'Ada' untuk transfer massal"
            >
              <CheckSquare size={12} className="text-blue-700" />
              <span>Pilih Semua "Ada"</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-950 font-extrabold text-[10px]">
                {adaCount}
              </span>
            </button>

            {/* If items are selected, show clear button */}
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                title="Batalkan semua pilihan centang"
              >
                <X size={12} />
                <span>Batal Pilih ({selectedIds.length})</span>
              </button>
            )}
          </div>

          {/* Quick Bulk Transfer Trigger when items selected */}
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBulkTransferModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-black shadow-xs cursor-pointer animate-pulse"
            >
              <Share2 size={13} />
              <span>Pindah Massal ({selectedIds.length} Item)</span>
            </button>
          )}
        </div>

        {/* Active Filter Badges & Clear Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Filter size={12} className="text-blue-900" />
              Filter Aktif:
            </span>

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[11px] font-bold">
                <span>Cari: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-blue-700 cursor-pointer"
                  title="Hapus filter pencarian"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {locationFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[11px] font-bold border border-indigo-200">
                <MapPin size={11} />
                <span>Lokasi: {locationFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-indigo-700 cursor-pointer"
                  title="Hapus filter lokasi"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-bold">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-purple-700 cursor-pointer"
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

      {/* ========================================================================= */}
      {/* BULK ACTION STICKY BAR (APPSHEET BATCH OPERATIONS) */}
      {/* ========================================================================= */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white shadow-lg border border-blue-500/30 flex flex-wrap items-center justify-between gap-2.5 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <CheckCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs sm:text-sm text-white">
                  {selectedIds.length} Item Dipilih
                </span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500 text-emerald-950 font-black text-[10px]">
                  Total: {selectedTotalQty.toLocaleString('id-ID')} CTN
                </span>
              </div>
              <p className="text-[11px] text-blue-200/80 m-0 font-medium hidden sm:block">
                Pilih menu / database tujuan untuk memindahkan seluruh data terpilih secara bersamaan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {/* Set Status Ada Direct Button */}
            <button
              type="button"
              onClick={() => handleBulkUpdateStatus('Ada')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Ubah status semua item terpilih menjadi 'Ada'"
            >
              <Check size={13} />
              <span className="hidden sm:inline">Set Status:</span>
              <span>"Ada"</span>
            </button>

            {/* Pindah Data Massal Button */}
            <button
              type="button"
              onClick={handleOpenBulkTransferModal}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-700 active:to-amber-600 text-amber-950 text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              title="Buka dialog pemilihan database tujuan untuk memindahkan data massal"
            >
              <Share2 size={14} />
              <span>Pindah Data Massal</span>
            </button>

            {/* Hapus Terpilih Button (Khusus Admin) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleBulkDeletePenyiapan}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                title="Hapus permanen semua data penyiapan terpilih (Akses Khusus Admin)"
              >
                <Trash2 size={14} />
                <span>Hapus Terpilih ({selectedIds.length})</span>
              </button>
            )}

            {/* Clear Selection */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
              title="Batal pilih semua item"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATA TABLE (APPSHEET STYLE) */}
      {/* ========================================================================= */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Table Top Status Bar */}
        <div className="p-2 sm:p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Boxes size={14} className="text-blue-900" />
            <span>Daftar Data Penyiapan ({filteredPenyiapan.length} item)</span>
            {selectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-extrabold border border-blue-200">
                {selectedIds.length} dipilih
              </span>
            )}
            {isLocationFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-[9px] font-extrabold border border-indigo-200">
                <MapPin size={10} />
                <span>Lokasi: {locationFilter || searchQuery}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('');
                    if (uniqueLocationsList.some(loc => loc.toLowerCase() === searchQuery.toLowerCase().trim() || (searchQuery.trim().length >= 3 && loc.toLowerCase().includes(searchQuery.toLowerCase().trim())))) {
                      setSearchQuery('');
                    }
                    setCurrentPage(1);
                  }}
                  className="ml-1 p-0.5 rounded-full hover:bg-indigo-200 text-indigo-800 cursor-pointer"
                  title="Reset filter lokasi"
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {searchQuery && !isLocationFiltered && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[9px]">
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

        {/* Responsive Table Wrapper with Horizontal Scroll */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-tight text-[10px] border-b border-slate-200 select-none">
                {/* Master Select Checkbox Column */}
                <th className="px-2 py-1.5 text-center w-8">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllFiltered}
                    className="p-1 rounded text-slate-600 hover:text-blue-900 cursor-pointer transition-colors"
                    title={isAllFilteredSelected ? "Batalkan pilihan semua baris" : "Pilih semua baris dalam filter"}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare size={14} className="text-blue-800" />
                    ) : isSomeFilteredSelected ? (
                      <Square size={14} className="text-blue-600 fill-blue-100" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-center w-10">No</th>
                <th className="px-2 py-1.5 text-center sticky left-0 bg-slate-100 z-10 w-24">Status</th>
                {!isLocationFiltered && (
                  <th onClick={() => handleSort('location')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      <ArrowUpDown size={11} className="text-slate-400" />
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('item_name')} className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Item Name</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('last_qty')} className="px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Qty</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('uom')} className="px-2.5 py-1.5 text-center cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    <span>Uom</span>
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
                  <td colSpan={isLocationFiltered ? 9 : 10} className="p-6 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-blue-900" />
                      <span>Memuat data penyiapan dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isLocationFiltered ? 9 : 10} className="p-6 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Boxes size={28} className="text-slate-300" />
                      <span className="font-extrabold text-slate-700 text-xs">Belum Ada Data Penyiapan</span>
                      <p className="text-[11px] text-slate-400 max-w-md m-0">
                        {searchQuery || locationFilter
                          ? 'Tidak ditemukan data yang cocok dengan kriteria pencarian.'
                          : 'Klik tombol "Tambah Data" atau "Upload Excel" (Admin) untuk mengisi data penyiapan.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const rowNumber = rowsPerPage === 'ALL' ? index + 1 : (currentPage - 1) * rowsPerPage + index + 1;
                  const isItemSelected = selectedIds.includes(item.id_penyiapan);

                  return (
                    <tr
                      key={item.id_penyiapan || index}
                      onClick={() => handleOpenEditModal(item)}
                      className={`transition-colors group cursor-pointer ${
                        isItemSelected ? 'bg-blue-50/80 hover:bg-blue-100/70 font-semibold' : 'hover:bg-blue-50/40'
                      }`}
                      title="Klik baris untuk melihat / edit detail data"
                    >
                      {/* Checkbox Select Row */}
                      <td 
                        className="px-2 py-1.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id_penyiapan)}
                          className="p-1 rounded text-slate-500 hover:text-blue-900 cursor-pointer"
                          title={isItemSelected ? "Batalkan pilihan item ini" : "Pilih item ini"}
                        >
                          {isItemSelected ? (
                            <CheckSquare size={14} className="text-blue-800 fill-blue-50" />
                          ) : (
                            <Square size={14} className="text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* No */}
                      <td className="px-2 py-1.5 text-center text-slate-400 font-mono text-[10px]">
                        {rowNumber}
                      </td>

                      {/* Status Sticky Column */}
                      <td 
                        className={`px-1.5 py-1 text-center sticky left-0 transition-colors z-10 shadow-2xs border-r border-slate-100 ${
                          isItemSelected ? 'bg-blue-50 group-hover:bg-blue-100/80' : 'bg-white group-hover:bg-slate-50'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.status || ''}
                          onChange={(e) => handleUpdateStatus(item, e.target.value)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold border outline-none cursor-pointer text-center appearance-none w-full ${
                            (item.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            (item.status || '').toLowerCase() === 'beda' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            (item.status || '').toLowerCase() === 'tidak' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="">- Status -</option>
                          <option value="Ada">Ada</option>
                          <option value="Beda">Beda</option>
                          <option value="Tidak">Tidak</option>
                        </select>
                      </td>

                      {/* Location (Sembunyikan jika lokasi sedang di-filter) */}
                      {!isLocationFiltered && (
                        <td className="px-2.5 py-1.5 font-bold text-slate-700 text-xs min-w-[100px]">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>{item.location || '-'}</span>
                          </div>
                        </td>
                      )}

                      {/* Item Name */}
                      <td className="px-2.5 py-1.5 min-w-[180px] max-w-xs">
                        <div className="font-extrabold text-slate-800 text-xs truncate" title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>

                      {/* Last Qty */}
                      <td className="px-2.5 py-1.5 text-right min-w-[80px]">
                        <span className="font-mono font-black text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200/60 text-xs inline-block">
                          {Number(item.last_qty || 0).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Uom */}
                      <td className="px-2.5 py-1.5 text-center min-w-[65px]">
                        <span className="font-bold text-slate-700 text-xs uppercase">
                          {item.uom || 'CTN'}
                        </span>
                      </td>

                      {/* Batch */}
                      <td className="px-2.5 py-1.5 min-w-[90px] font-mono text-xs font-semibold text-slate-700">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                          {item.batch || '-'}
                        </span>
                      </td>

                      {/* Expired Date */}
                      <td className="px-2.5 py-1.5 min-w-[100px] font-mono text-xs font-semibold text-slate-700">
                        {item.expired_date || '-'}
                      </td>

                      {/* Note */}
                      <td className="px-2.5 py-1.5 min-w-[140px] max-w-xs text-xs text-slate-600 truncate" title={item.note || '-'}>
                        {item.note || '-'}
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
              Halaman {currentPage} dari {totalPages} ({filteredPenyiapan.length} total baris)
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
      {/* MODAL 1: FORM TAMBAH / EDIT PENYIAPAN */}
      {/* ========================================================================= */}
      {showFormModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight m-0">
                    {isEditMode ? 'Edit Data Penyiapan' : 'Tambah Data Penyiapan Baru'}
                  </h3>
                  <p className="text-[11px] text-blue-200 m-0 font-medium">
                    Tabel: public.data_penyiapan (Supabase)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFormModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              
              {/* ========================================================================= */}
              {/* TOTAL QTY PCS SUMMARY FOR SKU AT (FILTERED) LOCATION (LIGHTWEIGHT UI) */}
              {/* ========================================================================= */}
              {skuLocationSummary && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Layers size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-800">
                            Total Akumulasi SKU di Lokasi
                          </span>
                          {skuLocationSummary.isFilterActive ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <Filter size={10} /> Filter: {skuLocationSummary.location}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                              Lokasi: {skuLocationSummary.location}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600 m-0">
                          {skuLocationSummary.itemCode} - {skuLocationSummary.itemName}
                        </p>
                      </div>
                    </div>

                    {/* Location Badge */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                      <MapPin size={13} className="text-blue-600 shrink-0" />
                      <span className="text-[11px] font-bold font-mono text-slate-900">{skuLocationSummary.location}</span>
                    </div>
                  </div>

                  {/* Metric Highlights (Flat & Lightweight) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* Total Qty PCS */}
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-semibold uppercase text-emerald-800 block">Total Qty PCS</span>
                      <div className="text-base sm:text-lg font-bold text-emerald-700 font-mono leading-tight">
                        {skuLocationSummary.totalQtyConvertPcs.toLocaleString('id-ID')} <span className="text-[11px] font-medium text-emerald-800">{skuLocationSummary.uom_convert}</span>
                      </div>
                    </div>

                    {/* Total Qty CTN */}
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <span className="text-[10px] font-semibold uppercase text-blue-800 block">Total Qty ({skuLocationSummary.uom})</span>
                      <div className="text-base sm:text-lg font-bold text-blue-700 font-mono leading-tight">
                        {skuLocationSummary.totalLastQty.toLocaleString('id-ID')} <span className="text-[11px] font-medium text-blue-800">{skuLocationSummary.uom}</span>
                      </div>
                    </div>

                    {/* Jumlah Batch */}
                    <div className="col-span-2 sm:col-span-1 p-2 rounded-lg bg-slate-100 border border-slate-200">
                      <span className="text-[10px] font-semibold uppercase text-slate-600 block">Variasi Batch</span>
                      <div className="text-xs sm:text-sm font-bold text-slate-800 font-mono leading-tight mt-0.5">
                        {skuLocationSummary.totalRows} Baris ({skuLocationSummary.distinctBatches} Batch)
                      </div>
                    </div>
                  </div>

                  {/* Batch Breakdown List if multiple batches exist */}
                  {skuLocationSummary.batchDetails.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                        <span>Daftar Batch di Lokasi {skuLocationSummary.location}:</span>
                        <span>{skuLocationSummary.batchDetails.length} Batch</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-lg bg-white border border-slate-200 divide-y divide-slate-100">
                        {skuLocationSummary.batchDetails.map((b, idx) => (
                          <div
                            key={b.id_penyiapan || idx}
                            onClick={() => {
                              const targetRow = penyiapanList.find(p => p.id_penyiapan === b.id_penyiapan);
                              if (targetRow) {
                                setSelectedItem(targetRow);
                                setFormData({ ...targetRow });
                                setBarangSearchText(targetRow.item_code ? `${targetRow.item_code} - ${targetRow.item_name}` : '');
                              }
                            }}
                            className={`p-1.5 px-2 flex items-center justify-between gap-2 text-[11px] cursor-pointer ${
                              b.isCurrent
                                ? 'bg-blue-50 text-blue-950 font-bold border-l-2 border-blue-600'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                            title="Klik untuk memilih batch ini"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-bold text-slate-900 shrink-0">
                                {b.batch}
                              </span>
                              {b.isCurrent ? (
                                <span className="px-1 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold shrink-0">
                                  Aktif
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-600 underline shrink-0 hidden sm:inline">
                                  Pilih
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                                Exp: {b.expired_date}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-slate-600">
                                {b.last_qty.toLocaleString('id-ID')} {b.uom}
                              </span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                {b.qty_convert.toLocaleString('id-ID')} PCS
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1. Cari Master SKU / Nama Barang */}
              <div ref={barangSearchContainerRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Cari Master SKU / Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  {isBarangDropdownOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBarangDropdownOpen(false);
                        if (formData.item_code && formData.item_name) {
                          setBarangSearchText(`${formData.item_code} - ${formData.item_name}`);
                        } else if (!formData.item_code) {
                          setBarangSearchText('');
                        }
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                    >
                      <X size={12} />
                      <span>Tutup / Batal Cari</span>
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    value={barangSearchText}
                    onChange={(e) => {
                      setBarangSearchText(e.target.value);
                      setIsBarangDropdownOpen(true);
                    }}
                    onFocus={() => setIsBarangDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsBarangDropdownOpen(false);
                        if (formData.item_code && formData.item_name) {
                          setBarangSearchText(`${formData.item_code} - ${formData.item_name}`);
                        } else if (!formData.item_code) {
                          setBarangSearchText('');
                        }
                      }
                    }}
                    placeholder="Ketik SKU atau Nama Barang..."
                    className="w-full pl-9 pr-24 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                  />

                  <div className="absolute right-2 flex items-center gap-1">
                    {barangSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBarangDropdownOpen(false);
                          if (formData.item_code && formData.item_name) {
                            setBarangSearchText(`${formData.item_code} - ${formData.item_name}`);
                          } else {
                            setBarangSearchText('');
                          }
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Batal Cari / Reset ke Nilai Awal"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleSpeechToTextBarang}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        isListeningBarang ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-50 text-blue-900'
                      }`}
                    >
                      <Mic size={12} />
                      <span>Suara</span>
                    </button>
                  </div>
                </div>

                {speechFeedbackBarang && (
                  <div className="mt-1 text-[11px] text-rose-600 font-semibold">{speechFeedbackBarang}</div>
                )}

                {/* Dropdown Results */}
                {isBarangDropdownOpen && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>Pilih dari Master SKU (atau tekan Esc / klik luar untuk batal)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsBarangDropdownOpen(false);
                          if (formData.item_code && formData.item_name) {
                            setBarangSearchText(`${formData.item_code} - ${formData.item_name}`);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {filteredBarangList.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 font-medium">
                        Tidak ditemukan SKU. Masukkan manual pada field di bawah.
                      </div>
                    ) : (
                      filteredBarangList.slice(0, 15).map(b => (
                        <div
                          key={b.item_code}
                          onClick={() => handleSelectBarangItem(b)}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-mono font-bold text-blue-900 mr-2">{b.item_code}</span>
                            <span className="font-extrabold text-slate-800">{b.item_name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{b.uom || 'CTN'}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 2. Item Code & Item Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item Code <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.item_code || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, item_code: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.item_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                  />
                </div>
              </div>

              {/* 3. Location, Last Qty, Qty Convert (PCS), Batch, Expired Date */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Qty ({formData.uom || 'CTN'})</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_qty: Number(e.target.value) }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-black text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty Convert (PCS)</label>
                  <input
                    type="number"
                    value={formData.qty_convert ?? 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, qty_convert: Number(e.target.value) }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-black text-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch</label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={(e) => {
                      const newBatch = e.target.value;
                      let autoEd = formData.expired_date;
                      let autoShelf = formData.shelf_life;
                      if (newBatch && formData.item_name) {
                        const comp = getEdIsoDateString(formData.item_code || '', formData.item_name, newBatch);
                        if (comp && comp.isoDate) {
                          autoEd = comp.isoDate;
                          autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
                        }
                      }
                      setFormData(prev => ({ ...prev, batch: newBatch, expired_date: autoEd, shelf_life: autoShelf }));
                    }}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-amber-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expired Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={formData.expired_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, expired_date: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-800"
                  />
                </div>
              </div>

              {/* 4. LPN / Serial Number & QR Code LPN / Serial */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LPN / Serial Number</label>
                  <input
                    type="text"
                    placeholder="Contoh: LPN-202502-001 / S/N..."
                    value={formData.lpn_serial_number || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lpn_serial_number: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-800"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    QR Code di sebelah kanan akan terbuat secara otomatis berdasarkan LPN / Serial ini.
                  </p>
                </div>

                {/* QR Code LPN / Serial */}
                <div className="sm:col-span-4 p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-600 mb-1.5">
                    <QrCode size={13} className="text-blue-900" />
                    <span>QR Code LPN / Serial</span>
                  </div>

                  {qrCodeDataUrl ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="p-1 bg-white border border-slate-200 rounded-lg shadow-inner">
                        <img
                          src={qrCodeDataUrl}
                          alt={`QR Code ${formData.lpn_serial_number}`}
                          className="w-24 h-24 object-contain rounded"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-700 max-w-[180px] truncate bg-slate-100 px-2 py-0.5 rounded">
                        {formData.lpn_serial_number}
                      </span>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 p-2">
                      <QrCode size={24} className="opacity-40 mb-1" />
                      <span className="text-[9px] leading-tight font-medium text-slate-400">
                        Isi LPN / Serial untuk QR Code
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Status & Note (Catatan Perbedaan Data) */}
              <div className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                (formData.status || '').toLowerCase() === 'beda'
                  ? 'bg-blue-50/80 border-blue-300'
                  : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                      Status Penyiapan & Catatan (Note)
                    </span>
                    {(formData.status || '').toLowerCase() === 'beda' && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[10px] animate-pulse">
                        Status Beda
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Status:</label>
                    <select
                      value={formData.status || 'Ada'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer outline-none ${
                        (formData.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        (formData.status || '').toLowerCase() === 'beda' ? 'bg-blue-100 text-blue-900 border-blue-400 font-extrabold' :
                        (formData.status || '').toLowerCase() === 'tidak' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      <option value="Ada">Ada</option>
                      <option value="Beda">Beda</option>
                      <option value="Tidak">Tidak</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Note / Catatan Perbedaan Data
                  </label>
                  <textarea
                    rows={2}
                    value={formData.note || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder={(formData.status || '').toLowerCase() === 'beda'
                      ? 'Wajib diisi jika status Beda: Jelaskan perbedaan data (misal: Beda batch dari SPK, selisih kuantitas fisik 2 CTN, kondisi barang rusak, dll)...'
                      : 'Isi catatan tambahan / keterangan perbedaan data bila diperlukan...'}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-800 placeholder:text-slate-400"
                  />
                  {(formData.status || '').toLowerCase() === 'beda' && !formData.note?.trim() && (
                    <p className="text-[10px] text-blue-700 font-bold mt-1">
                      💡 Status ditandai "Beda". Mohon cantumkan rincian perbedaan data di kolom note di atas.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div>
                  {isEditMode && isSuperAdmin && selectedItem && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFormModal(false);
                        setShowDeleteModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                      title="Hapus data penyiapan ini (Khusus Admin)"
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
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white font-black shadow-md cursor-pointer"
                  >
                    {isEditMode ? 'Simpan Perubahan' : 'Simpan Penyiapan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 2: UPLOAD EXCEL MODAL (ROLE ADMIN PRIVILEGE) */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            
            <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight m-0">
                    Upload File Excel Penyiapan (data_penyiapan)
                  </h3>
                  <span className="text-[11px] text-emerald-200 font-medium">
                    Akses Khusus Administrator Gudang
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowExcelModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Kolom yang Dikenali Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900">
                <span className="font-black block mb-1">Struktur 20 Kolom Excel yang Didukung:</span>
                <p className="text-[11px] leading-relaxed m-0 text-emerald-800 font-mono">
                  item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/70 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                  <Upload size={22} />
                </div>
                <div>
                  <span className="font-black text-slate-800 text-xs sm:text-sm block">
                    {excelFileName ? excelFileName : 'Klik atau Tarik File Excel (.xlsx / .xls / .csv) ke Sini'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Maksimal 50,000 baris data per upload
                  </span>
                </div>
              </div>

              {/* Preview Parsed Rows */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>Pratinjau Data ({parsedExcelRows.length} Baris Valid)</span>
                    <span className="text-emerald-700 font-mono">Siap disimpan ke Database Supabase</span>
                  </div>

                  <div className="max-h-60 overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                      <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2">No</th>
                          <th className="p-2">Item Code</th>
                          <th className="p-2">Item Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Last Qty</th>
                          <th className="p-2">Uom</th>
                          <th className="p-2">LPN</th>
                          <th className="p-2">Batch</th>
                          <th className="p-2">Expired Date</th>
                          <th className="p-2">Dest. Code</th>
                          <th className="p-2">QC Code</th>
                          <th className="p-2">User Tally</th>
                          <th className="p-2">Shelf Life</th>
                          <th className="p-2">Source</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedExcelRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 text-slate-400">{i + 1}</td>
                            <td className="p-2 font-mono font-bold text-blue-900">{r.item_code}</td>
                            <td className="p-2 font-bold text-slate-800">{r.item_name}</td>
                            <td className="p-2">{r.category}</td>
                            <td className="p-2">{r.location}</td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-800">{r.last_qty}</td>
                            <td className="p-2">{r.uom}</td>
                            <td className="p-2 font-mono">{r.lpn_serial_number}</td>
                            <td className="p-2 font-mono font-bold text-amber-900">{r.batch}</td>
                            <td className="p-2 font-mono">{r.expired_date}</td>
                            <td className="p-2 font-mono">{r.destination_code}</td>
                            <td className="p-2">{r.qc_code}</td>
                            <td className="p-2">{r.user_tally}</td>
                            <td className="p-2">{r.shelf_life}</td>
                            <td className="p-2">{r.source}</td>
                            <td className="p-2">{r.status || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedExcelRows.length > 50 && (
                    <p className="text-[10px] text-slate-400 italic text-right m-0">
                      Menampilkan 50 dari {parsedExcelRows.length} total baris pratinjau.
                    </p>
                  )}
                </div>
              )}

              {/* Upload Progress Bar Indicator (Enterprise Grade) */}
              {uploadProgress.isUploading && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 shadow-sm space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <div className="flex items-center gap-2 text-emerald-950">
                      <RefreshCw size={14} className="animate-spin text-emerald-700" />
                      <span>{uploadProgress.statusText}</span>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      {uploadProgress.percentage}%
                    </span>
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
                    <span>Proses: {uploadProgress.current.toLocaleString('id-ID')} dari {uploadProgress.total.toLocaleString('id-ID')} baris</span>
                    <span className="text-emerald-700 font-semibold">Menggunakan High-Speed Batch Stream</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={uploadProgress.isUploading}
                  onClick={downloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer disabled:opacity-40"
                >
                  <FileSpreadsheet size={14} className="text-emerald-700" />
                  <span>Download Template Excel</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadProgress.isUploading}
                    onClick={() => setShowExcelModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={parsedExcelRows.length === 0 || isProcessingExcel || uploadProgress.isUploading}
                    onClick={handleCommitExcelImport}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingExcel || uploadProgress.isUploading ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>
                      {uploadProgress.isUploading
                        ? `Mengunggah (${uploadProgress.percentage}%)...`
                        : `Simpan ${parsedExcelRows.length.toLocaleString('id-ID')} Data Penyiapan`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW DETAIL MODAL */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight m-0">Detail Data Penyiapan</h3>
                  <span className="text-[11px] font-mono text-slate-300">{selectedItem.id_penyiapan}</span>
                </div>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Box 1: Info Produk */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-blue-900">{selectedItem.item_code}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px]">
                    {selectedItem.category || 'Finished Good'}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-800 m-0">{selectedItem.item_name}</h4>
              </div>

              {/* Grid 20 Properties */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Location</span>
                  <span className="font-bold text-slate-800">{selectedItem.location || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Location Type</span>
                  <span className="font-medium text-slate-800">{selectedItem.location_type || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">SLOC</span>
                  <span className="font-bold text-blue-900">{selectedItem.sloc || 'SL02'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">First Qty</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.first_qty ?? '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase">Last Qty</span>
                  <span className="font-mono font-black text-emerald-900 text-sm">{selectedItem.last_qty ?? '-'} {selectedItem.uom}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                  <span className="text-[10px] text-purple-700 font-bold block uppercase">Qty Convert</span>
                  <span className="font-mono font-bold text-purple-900">{selectedItem.qty_convert ?? '-'} {selectedItem.uom_convert}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">LPN / Serial</span>
                  <span className="font-mono text-slate-800">{selectedItem.lpn_serial_number || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[10px] text-amber-700 font-bold block uppercase">Batch</span>
                  <span className="font-mono font-bold text-amber-900">{selectedItem.batch || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Vendor Batch</span>
                  <span className="font-mono text-slate-800">{selectedItem.vendor_batch || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Expired Date</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.expired_date || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Destination Code</span>
                  <span className="font-mono text-slate-800">{selectedItem.destination_code || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Status QC</span>
                  <span className="font-black text-slate-800">{selectedItem.qc_code || 'QC-PASS'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">User Tally</span>
                  <span className="font-bold text-slate-800">{selectedItem.user_tally || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Shelf Life</span>
                  <span className="font-medium text-slate-800">{selectedItem.shelf_life || '-'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Source</span>
                  <span className="font-medium text-slate-800">{selectedItem.source || 'Stok Gudang'}</span>
                </div>
              </div>

              {/* Status & Catatan Note */}
              <div className={`p-3 rounded-xl border ${
                (selectedItem.status || '').toLowerCase() === 'beda' ? 'bg-blue-50/80 border-blue-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Status & Catatan (Note)</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    (selectedItem.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800' :
                    (selectedItem.status || '').toLowerCase() === 'beda' ? 'bg-blue-600 text-white font-black' :
                    (selectedItem.status || '').toLowerCase() === 'tidak' ? 'bg-rose-100 text-rose-800' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {selectedItem.status || 'Ada'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium m-0">
                  {selectedItem.note || <span className="text-slate-400 italic">Tidak ada catatan perbedaan data.</span>}
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-800 m-0">Hapus Data Penyiapan?</h3>
              <p className="text-xs text-slate-500 mt-1 m-0">
                Data <span className="font-mono font-bold text-rose-600">{selectedItem.id_penyiapan}</span> ({selectedItem.item_name}) akan dihapus secara permanen.
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
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 5: TRANSFER KE PEMUSNAHAN (RELASI PENYIAPAN -> PEMUSNAHAN) */}
      {/* ========================================================================= */}
      {showPemusnahanModal && pemusnahanTargetItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-rose-700 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight m-0">
                    Kirim Item ke Menu Pemusnahan
                  </h3>
                  <p className="text-[11px] text-rose-200 m-0 font-medium">
                    Relasi dari Penyiapan ID: {pemusnahanTargetItem.id_penyiapan} ➔ Tabel public.data_pemusnahan
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPemusnahanModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmSendToPemusnahan} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              
              {/* Product summary card */}
              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Produk yang akan dimusnahkan:</span>
                <div className="font-extrabold text-slate-800 text-sm">{pemusnahanTargetItem.item_name}</div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-slate-600 text-[11px] pt-1">
                  <span>SKU: <strong className="text-slate-800">{pemusnahanTargetItem.item_code}</strong></span>
                  <span>Batch: <strong className="text-slate-800">{pemusnahanTargetItem.batch || '-'}</strong></span>
                  <span>Qty: <strong className="text-rose-700">{pemusnahanTargetItem.last_qty} {pemusnahanTargetItem.uom}</strong></span>
                  <span>Lokasi Asal: <strong>{pemusnahanTargetItem.location || '-'}</strong></span>
                </div>
              </div>

              {/* Row 1: ID Pemusnahan & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Pemusnahan (Auto Generated)</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.id_pemusnahan || ''}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, id_pemusnahan: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Pemusnahan</label>
                  <select
                    value={pemusnahanFormData.status || 'Siap Dimusnahkan'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, status: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-rose-800 text-xs"
                  >
                    <option value="Siap Dimusnahkan">Siap Dimusnahkan</option>
                    <option value="Dalam Proses">Dalam Proses</option>
                    <option value="Disposed">Disposed (Musnah)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Location, SLOC & QC Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Karantina Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.location || 'WH-REJECT-01'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, location: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLOC Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.sloc || 'SL99'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, sloc: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status QC</label>
                  <select
                    value={pemusnahanFormData.qc_code || 'QC-REJECT'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, qc_code: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  >
                    <option value="QC-REJECT">QC-REJECT</option>
                    <option value="QC-HOLD">QC-HOLD</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Destinasi & Tujuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tempat / Destinasi Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.destination_code || 'INCINERATOR'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, destination_code: e.target.value })}
                    placeholder="Contoh: INCINERATOR / SCRAP YARD"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tujuan Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.tujuan || 'Pemusnahan Limbah Terkontrol'}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, tujuan: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Row 4: Catatan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan / Catatan Pemusnahan</label>
                <textarea
                  value={pemusnahanFormData.note || ''}
                  onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, note: e.target.value })}
                  rows={2}
                  placeholder="Keterangan kondisi barang yang perlu dimusnahkan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {onNavigateToPemusnahan && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPemusnahanModal(false);
                      onNavigateToPemusnahan();
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Buka Menu Pemusnahan</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowPemusnahanModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingPemusnahan}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Flame size={15} />
                    <span>{isSendingPemusnahan ? 'Mengirim Data...' : 'Konfirmasi Kirim ke Pemusnahan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL 6: PINDAH DATA MASSAL (BULK TRANSFER KE DATABASE TUJUAN) */}
      {/* ========================================================================= */}
      {showBulkTransferModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight m-0 flex items-center gap-2">
                    <span>Pindah Data Massal ({selectedIds.length} Item)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase">
                      Bulk Transfer
                    </span>
                  </h3>
                  <p className="text-[11px] text-blue-200 m-0 font-medium">
                    Pindahkan {selectedIds.length} item data penyiapan ({selectedTotalQty.toLocaleString('id-ID')} Total Qty) ke Menu / Database Tujuan
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBulkTransferModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleExecuteBulkTransfer} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              
              {/* Step 1: Pilihan Menu / Database Tujuan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>Pilih Menu / Database Tujuan:</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Pilih salah satu database tujuan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {BULK_DESTINATIONS.map(dest => {
                    const isSelected = bulkTargetModuleId === dest.id;
                    return (
                      <div
                        key={dest.id}
                        onClick={() => handleDestinationChange(dest.id)}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-blue-800 bg-blue-50/70 shadow-sm ring-2 ring-blue-800/20'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {dest.id === 'pemusnahan' ? <Flame size={15} className={isSelected ? 'text-amber-300' : ''} /> :
                               dest.id === 'incoming' ? <Package size={15} /> :
                               <Truck size={15} />}
                            </div>
                            <div>
                              <div className="font-black text-slate-800 text-xs leading-tight">{dest.name}</div>
                              <span className="font-mono text-[9px] text-slate-400">{dest.tableName}</span>
                            </div>
                          </div>

                          <input
                            type="radio"
                            name="target_destination"
                            checked={isSelected}
                            onChange={() => handleDestinationChange(dest.id)}
                            className="mt-1 cursor-pointer accent-blue-900"
                          />
                        </div>

                        <p className="text-[10px] text-slate-500 leading-snug m-0">
                          {dest.description}
                        </p>

                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 font-mono text-[9px] text-slate-600">
                          <span>SLoc: <strong className="text-slate-800">{dest.defaultSloc}</strong></span>
                          <span>•</span>
                          <span>QC: <strong className="text-slate-800">{dest.defaultQcCode}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Konfigurasi Parameter Tujuan */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <label className="font-black text-slate-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  <span>Konfigurasi Parameter Target (Disesuaikan Otomatis):</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Tujuan / Deskripsi Transaksi</label>
                    <input
                      type="text"
                      value={bulkFormData.tujuan || ''}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, tujuan: e.target.value })}
                      required
                      placeholder="Contoh: Pemusnahan Limbah Terkontrol / Inbound"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Status di Database Tujuan</label>
                    <input
                      type="text"
                      value={bulkFormData.target_status || ''}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, target_status: e.target.value })}
                      required
                      placeholder="Contoh: Siap Dimusnahkan / Received"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-blue-900 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Catatan (Note)</label>
                  <input
                    type="text"
                    value={bulkFormData.note || ''}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, note: e.target.value })}
                    placeholder="Isi catatan yang akan disalin ke setiap baris data target..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              {/* Step 3: Tindakan pada Data di Penyiapan Asal */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2.5">
                <label className="font-black text-slate-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  <span>Tindakan pada Data di Tabel Penyiapan (Asal):</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 ${
                    bulkSourceAction === 'update_status' ? 'bg-white border-blue-600 shadow-xs' : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="source_action"
                      checked={bulkSourceAction === 'update_status'}
                      onChange={() => setBulkSourceAction('update_status')}
                      className="mt-0.5 accent-blue-900"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Ubah Status (Disarankan)</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Status penyiapan diubah menjadi status transfer
                      </span>
                      {bulkSourceAction === 'update_status' && (
                        <input
                          type="text"
                          value={bulkSourceStatus}
                          onChange={(e) => setBulkSourceStatus(e.target.value)}
                          className="mt-1.5 w-full px-2 py-1 rounded border border-blue-300 text-[10px] font-bold bg-blue-50/50 text-blue-900"
                          placeholder="Status baru"
                        />
                      )}
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 ${
                    bulkSourceAction === 'delete' ? 'bg-white border-rose-600 shadow-xs' : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="source_action"
                      checked={bulkSourceAction === 'delete'}
                      onChange={() => setBulkSourceAction('delete')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <span className="font-bold text-rose-800 block">Hapus dari Penyiapan</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Keluarkan item terpilih dari antrean penyiapan
                      </span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 ${
                    bulkSourceAction === 'keep' ? 'bg-white border-slate-600 shadow-xs' : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="source_action"
                      checked={bulkSourceAction === 'keep'}
                      onChange={() => setBulkSourceAction('keep')}
                      className="mt-0.5 accent-slate-900"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Biarkan Status Asal</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Hanya duplikasi/salin data ke tabel tujuan
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 4: Ringkasan Item Terpilih Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Daftar Item yang Akan Dipindahkan ({selectedItemsData.length} Item):
                  </span>
                  <span className="font-mono font-black text-blue-900">
                    Total Qty: {selectedTotalQty.toLocaleString('id-ID')} CTN
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl bg-slate-50">
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-8">No</th>
                        <th className="p-2">Item Code</th>
                        <th className="p-2">Item Name</th>
                        <th className="p-2">Batch</th>
                        <th className="p-2 text-right">Last Qty</th>
                        <th className="p-2">UOM</th>
                        <th className="p-2">Status Asal</th>
                        <th className="p-2">Lokasi Asal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 bg-white">
                      {selectedItemsData.map((item, idx) => (
                        <tr key={item.id_penyiapan} className="hover:bg-blue-50/50">
                          <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-blue-900">{item.item_code}</td>
                          <td className="p-2 font-bold text-slate-800 max-w-[200px] truncate">{item.item_name}</td>
                          <td className="p-2 font-mono text-amber-900 font-bold">{item.batch || '-'}</td>
                          <td className="p-2 text-right font-mono font-black text-emerald-800">{item.last_qty}</td>
                          <td className="p-2">{item.uom || 'CTN'}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              {item.status || 'Ada'}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600">{item.location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress Bar during transfer */}
              {isBulkTransferring && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-blue-900" />
                      <span>Memproses transfer massal data...</span>
                    </span>
                    <span>{bulkTransferProgress.current} / {bulkTransferProgress.total} ({bulkTransferProgress.percentage}%)</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-900 h-full transition-all duration-300"
                      style={{ width: `${bulkTransferProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBulkTransferModal(false)}
                  disabled={isBulkTransferring}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isBulkTransferring}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 active:from-blue-950 active:to-indigo-950 text-white font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Share2 size={16} />
                  <span>
                    {isBulkTransferring ? 'Memindahkan Data...' : `Proses Pindah ${selectedIds.length} Data Massal`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
