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
  CheckCheck,
  Target,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  ClipboardPaste,
  Globe,
  Settings,
  ExternalLink
} from 'lucide-react';
import Fuse from 'fuse.js';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase, getAppSettingFromSupabase, saveAppSettingToSupabase } from '../../supabase';
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
    name: 'Pemusnahan',
    tableName: 'data_pemusnahan',
    idPrefix: 'PMS-',
    idField: 'id_pemusnahan',
    defaultSloc: '',
    defaultLocation: '',
    defaultLocationType: '',
    defaultQcCode: '',
    defaultDestinationCode: '',
    defaultStatus: 'Siap Dimusnahkan',
    defaultTujuan: 'Pemusnahan Limbah Terkontrol',
    defaultCategory: '',
    sourceStatusDefault: 'Terkirim ke Pemusnahan',
    cacheKey: 'pemusnahan_cache_v1',
    description: 'Tabel: public.data_pemusnahan - Karantina limbah / scrap / expired barang',
    colorClass: 'from-rose-600 to-red-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900 border-rose-300',
    borderColor: 'border-rose-500',
    appModuleId: 'pemusnahan'
  },
  {
    id: 'reco',
    name: 'Reco',
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
    borderColor: 'border-purple-500',
    appModuleId: 'reco'
  },
  {
    id: 'repack',
    name: 'Repack',
    tableName: 'data_repack',
    idPrefix: 'RPK-',
    idField: 'id_repack',
    defaultSloc: 'SL04',
    defaultLocation: 'WH-REPACK-01',
    defaultLocationType: 'Rack',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'PROMO-BUNDLING',
    defaultStatus: '',
    defaultTujuan: 'Repacking Promo Bundle',
    defaultCategory: 'Repack',
    sourceStatusDefault: 'Terkirim ke Repack',
    cacheKey: 'repack_cache_v1',
    description: 'Tabel: public.data_repack - Repacking / Bundling Produk',
    colorClass: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900 border-amber-300',
    borderColor: 'border-amber-500',
    appModuleId: 'repack'
  }
];

interface PenyiapanModuleProps {
  onNavigateToPemusnahan?: () => void;
  onNavigateToIncoming?: () => void;
  onNavigateToReco?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToRepack?: () => void;
  onNavigateToModule?: (moduleId: string) => void;
}

export function PenyiapanModule({ onNavigateToPemusnahan, onNavigateToIncoming, onNavigateToReco, onNavigateToInventory, onNavigateToRepack, onNavigateToModule }: PenyiapanModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

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
    sloc: '',
    location: '',
    location_type: '',
    qc_code: '',
    destination_code: '',
    target_status: '',
    tujuan: '',
    category: '',
    note: ''
  });
  const [bulkSourceAction, setBulkSourceAction] = useState<'update_status' | 'delete' | 'keep'>('update_status');
  const [bulkSourceStatus, setBulkSourceStatus] = useState<string>('Terkirim ke Pemusnahan');
  const [isBulkTransferring, setIsBulkTransferring] = useState(false);
  const [bulkTransferProgress, setBulkTransferProgress] = useState({ current: 0, total: 0, percentage: 0 });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [itemNameFilter, setItemNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [qcFilter, setQcFilter] = useState<string>('ALL');
  const [slocFilter, setSlocFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tujuanFilter, setTujuanFilter] = useState<string>('ALL');
  // Sort State: Default sort ascending berdasarkan kolom location
  const [sortField, setSortField] = useState<keyof PenyiapanItem | 'location_then_name' | null>('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination & Display
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelUploadTujuan, setExcelUploadTujuan] = useState<string>('');
  
  // Copy-Paste from Excel State (Akses Role User & Admin)
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedRawText, setPastedRawText] = useState('');
  const [pastedRows, setPastedRows] = useState<PenyiapanItem[]>([]);
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);
  const [pasteDefaultTujuan, setPasteDefaultTujuan] = useState<string>('');
  const [pasteDefaultStatus, setPasteDefaultStatus] = useState<string>('');
  const [pasteDefaultLocation, setPasteDefaultLocation] = useState<string>('');
  const [pasteHasHeader, setPasteHasHeader] = useState<boolean>(true);
  const [pasteFormatPreset, setPasteFormatPreset] = useState<'auto' | 'db_full' | 'db_tujuan' | 'export_excel' | 'form_sku'>('auto');
  const [previewColumnView, setPreviewColumnView] = useState<'all_db' | 'compact'>('all_db');
  const [isSavingPastedRows, setIsSavingPastedRows] = useState(false);
  const [pasteSaveProgress, setPasteSaveProgress] = useState({ current: 0, total: 0, percentage: 0, statusText: '' });

  const [showPemusnahanModal, setShowPemusnahanModal] = useState(false);
  const [pemusnahanTargetItem, setPemusnahanTargetItem] = useState<PenyiapanItem | null>(null);
  const [pemusnahanFormData, setPemusnahanFormData] = useState<any>({});
  const [isSendingPemusnahan, setIsSendingPemusnahan] = useState(false);

  // Google Sheets Sync States
  const [showGSheetModal, setShowGSheetModal] = useState(false);
  const [showGSheetAdvanced, setShowGSheetAdvanced] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isConfigFromSupabase, setIsConfigFromSupabase] = useState(false);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [gSheetSyncResult, setGSheetSyncResult] = useState<{
    success: boolean;
    message: string;
    spreadsheetUrl?: string;
    updatedRows?: number;
    timestamp?: string;
  } | null>(null);
  const [gSheetConfig, setGSheetConfig] = useState(() => {
    const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
    const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || '';
    const defaultEnvSheetName = (import.meta.env.VITE_GSHEET_SHEET_NAME as string) || 'Penyiapan';

    try {
      const saved = localStorage.getItem('PENYIAPAN_GSHEET_WEBHOOK_CONFIG') || localStorage.getItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          webhookUrl: parsed.webhookUrl || defaultEnvUrl,
          spreadsheetId: parsed.spreadsheetId || defaultEnvSpreadsheetId,
          sheetName: parsed.sheetName === 'Incoming' ? 'Penyiapan' : (parsed.sheetName || defaultEnvSheetName),
          secretToken: parsed.secretToken || '',
          mode: (parsed.mode || 'overwrite') as 'overwrite' | 'append'
        };
      }
    } catch {}
    return {
      webhookUrl: defaultEnvUrl,
      spreadsheetId: defaultEnvSpreadsheetId,
      sheetName: defaultEnvSheetName,
      secretToken: '',
      mode: 'overwrite' as 'overwrite' | 'append'
    };
  });

  // Muat setting Google Sheet global dari Supabase cloud jika tersedia
  useEffect(() => {
    let isMounted = true;
    async function loadGlobalGSheetConfig() {
      try {
        let cloudConfig = await getAppSettingFromSupabase('gsheet_sync_config_penyiapan', null);
        if (!cloudConfig) {
          cloudConfig = await getAppSettingFromSupabase('gsheet_sync_config', null);
        }
        if (isMounted && cloudConfig && cloudConfig.webhookUrl) {
          setGSheetConfig(prev => ({
            ...prev,
            webhookUrl: cloudConfig.webhookUrl || prev.webhookUrl,
            spreadsheetId: cloudConfig.spreadsheetId !== undefined ? cloudConfig.spreadsheetId : prev.spreadsheetId,
            sheetName: cloudConfig.sheetName === 'Incoming' ? 'Penyiapan' : (cloudConfig.sheetName || 'Penyiapan'),
            secretToken: cloudConfig.secretToken || prev.secretToken,
            mode: cloudConfig.mode || prev.mode
          }));
          setIsConfigFromSupabase(true);
        }
      } catch (e) {
        console.warn('Gagal memuat setting cloud Google Sheet Penyiapan:', e);
      }
    }
    loadGlobalGSheetConfig();
    return () => {
      isMounted = false;
    };
  }, [showGSheetModal]);

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
        ascending: true
      });

      if (Array.isArray(data)) {
        setPenyiapanList(data);

        if (data.length > 0) {
          try {
            localStorage.setItem('penyiapan_cache_v1', JSON.stringify(data));
          } catch {}
        } else {
          try {
            localStorage.removeItem('penyiapan_cache_v1');
          } catch {}
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

    // Supabase Realtime channel (in-place updates to guarantee sync across devices)
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('penyiapan_realtime_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_penyiapan' }, (payload: any) => {
          // If currently performing bulk import, suppress realtime updates to avoid screen flickering & high load
          if (isImportingRef.current) return;
          
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.id_penyiapan) {
            const updated = payload.new as PenyiapanItem;
            setPenyiapanList(prev =>
              prev.map(p => (p.id_penyiapan === updated.id_penyiapan ? { ...p, ...updated } : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id_penyiapan;
            if (deletedId) {
              setPenyiapanList(prev => prev.filter(p => p.id_penyiapan !== deletedId));
            } else {
              // Jika payload.old tidak memuat id_penyiapan secara lengkap, fetch ulang dari Supabase
              fetchPenyiapanData(true);
            }
          } else if (payload.eventType === 'INSERT' && payload.new && payload.new.id_penyiapan) {
            const newItem = payload.new as PenyiapanItem;
            setPenyiapanList(prev => {
              const exists = prev.some(p => p.id_penyiapan === newItem.id_penyiapan);
              if (exists) {
                return prev.map(p => (p.id_penyiapan === newItem.id_penyiapan ? { ...p, ...newItem } : p));
              }
              return [...prev, newItem];
            });
          } else {
            // Fallback silent refresh
            fetchPenyiapanData(true);
          }
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
        category: rest.category !== undefined && rest.category !== null ? String(rest.category).trim() : '',
        location: rest.location !== undefined && rest.location !== null ? String(rest.location).trim() : '',
        location_type: rest.location_type !== undefined && rest.location_type !== null ? String(rest.location_type).trim() : '',
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
          // Attempt 1: Upsert with onConflict: 'id_penyiapan'
          let { error } = await supabase
            .from('data_penyiapan')
            .upsert(chunk as any, { onConflict: 'id_penyiapan' });

          // Fallback 1: If ON CONFLICT fails because no unique constraint exists on id_penyiapan
          if (error && (error.code === '42P10' || error.message?.includes('ON CONFLICT') || error.message?.includes('constraint'))) {
            const insertRes = await supabase
              .from('data_penyiapan')
              .insert(chunk as any);
            error = insertRes.error;
          }

          // Fallback 2: If schema cache has missing column error (e.g. PGRST204)
          if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column'))) {
            const sanitizedChunk = chunk.map((c: any) => ({
              id_penyiapan: c.id_penyiapan,
              item_code: c.item_code,
              item_name: c.item_name,
              category: c.category,
              location: c.location,
              location_type: c.location_type,
              first_qty: c.first_qty,
              last_qty: c.last_qty,
              uom: c.uom,
              qty_convert: c.qty_convert,
              uom_convert: c.uom_convert,
              lpn_serial_number: c.lpn_serial_number,
              batch: c.batch,
              vendor_batch: c.vendor_batch,
              sloc: c.sloc,
              expired_date: c.expired_date,
              destination_code: c.destination_code,
              qc_code: c.qc_code,
              user_tally: c.user_tally,
              shelf_life: c.shelf_life,
              source: c.source,
              tujuan: c.tujuan,
              user_input: c.user_input,
              status: c.status,
              note: c.note,
              created_at: c.created_at
            }));

            const retryUpsert = await supabase
              .from('data_penyiapan')
              .upsert(sanitizedChunk as any, { onConflict: 'id_penyiapan' });

            if (retryUpsert.error) {
              const retryInsert = await supabase
                .from('data_penyiapan')
                .insert(sanitizedChunk as any);
              error = retryInsert.error;
            } else {
              error = null;
            }
          }

          return { chunkLength: chunk.length, error };
        })
      );

      for (const res of results) {
        if (res.error) {
          lastErr = res.error;
          console.error('Database sync error on data_penyiapan chunk:', res.error);
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

  // Helper to check if item status is empty / unassigned
  const isStatusEmpty = (status?: string | null): boolean => {
    if (!status) return true;
    const s = status.trim().toLowerCase();
    return s === '' || s === '-' || s === 'belum ada status' || s === 'belum dicek' || s === 'kosong';
  };

  // Status statistics for Penyiapan items (Belum Ada Status, Ada, Beda, Tidak, dll.)
  const statusStats = useMemo(() => {
    let belumAda = 0;
    let ada = 0;
    let beda = 0;
    let tidak = 0;
    const othersMap: Record<string, number> = {};

    penyiapanList.forEach(item => {
      const raw = (item.status || '').trim();
      const s = raw.toLowerCase();
      if (!raw || s === '-' || s === 'belum ada status' || s === 'belum dicek' || s === 'kosong') {
        belumAda++;
      } else if (s === 'ada') {
        ada++;
      } else if (s === 'beda') {
        beda++;
      } else if (s === 'tidak') {
        tidak++;
      } else {
        othersMap[raw] = (othersMap[raw] || 0) + 1;
      }
    });

    return {
      belumAda,
      ada,
      beda,
      tidak,
      total: penyiapanList.length,
      others: othersMap
    };
  }, [penyiapanList]);

  // Other custom statuses if any (excluding default standard ones)
  const otherStatuses = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      const raw = (item.status || '').trim();
      const s = raw.toLowerCase();
      if (
        raw &&
        s !== '-' &&
        s !== 'ada' &&
        s !== 'beda' &&
        s !== 'tidak' &&
        s !== 'belum ada status' &&
        s !== 'belum dicek' &&
        s !== 'kosong'
      ) {
        set.add(raw);
      }
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>(['Ada', 'Beda', 'Tidak']);
    penyiapanList.forEach(item => {
      const raw = (item.status || '').trim();
      const s = raw.toLowerCase();
      if (raw && s !== '-' && s !== 'belum ada status' && s !== 'belum dicek' && s !== 'kosong') {
        set.add(raw);
      }
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueTujuanList = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.tujuan && item.tujuan.trim() !== '' && item.tujuan.trim() !== '-') {
        set.add(item.tujuan.trim());
      }
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  const uniqueLocationsList = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.location && item.location !== '-') set.add(item.location.trim());
    });
    return Array.from(set).sort();
  }, [penyiapanList]);

  // Unique Item Names for filtering & autocomplete datalist (only item name)
  const uniqueItemNamesList = useMemo(() => {
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.item_name && item.item_name.trim() !== '' && item.item_name.trim() !== '-') {
        set.add(item.item_name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id-ID'));
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
    // 1. Initial category/QC/SLoc/Status/Location/ItemName baseline filtering
    let baseList = penyiapanList.filter(item => {
      // Item Name / SKU Filter
      if (itemNameFilter && itemNameFilter.trim()) {
        const cleanItem = itemNameFilter.trim().toLowerCase();
        const matchCode = (item.item_code || '').toLowerCase().includes(cleanItem);
        const matchName = (item.item_name || '').toLowerCase().includes(cleanItem);
        if (!matchCode && !matchName) {
          return false;
        }
      }

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

      // Status (Mendukung filter: Belum Ada Status / UNCHECKED, Ada, Beda, Tidak, & status lainnya)
      if (statusFilter !== 'ALL') {
        const s = (item.status || '').toLowerCase().trim();
        if (statusFilter === 'BELUM_ADA_STATUS' || statusFilter === 'UNCHECKED') {
          if (s !== '' && s !== '-' && s !== 'belum ada status' && s !== 'belum dicek' && s !== 'kosong') {
            return false;
          }
        } else if (statusFilter.toLowerCase() !== s) {
          return false;
        }
      }

      // Tujuan
      if (tujuanFilter !== 'ALL' && (item.tujuan || '').trim().toLowerCase() !== tujuanFilter.toLowerCase()) {
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

    // 3. Sorting - JANGAN sort otomatis jika sortField null (tampilkan sesuai urutan asli data / upload)
    if (!sortField) {
      return searchedList;
    }

    return [...searchedList].sort((a, b) => {
      // Sorting Kombinasi: Lokasi lalu Nama Barang
      if (sortField === 'location_then_name') {
        const locA = String(a.location || '').trim();
        const locB = String(b.location || '').trim();
        const locComp = locA.localeCompare(locB, 'id-ID', { numeric: true, sensitivity: 'base' });
        if (locComp !== 0) {
          return sortOrder === 'asc' ? locComp : -locComp;
        }
        const nameA = String(a.item_name || '').trim();
        const nameB = String(b.item_name || '').trim();
        const nameComp = nameA.localeCompare(nameB, 'id-ID', { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? nameComp : -nameComp;
      }

      // Sorting Lokasi (dengan tie-breaker Nama Barang)
      if (sortField === 'location') {
        const locA = String(a.location || '').trim();
        const locB = String(b.location || '').trim();
        const locComp = locA.localeCompare(locB, 'id-ID', { numeric: true, sensitivity: 'base' });
        if (locComp !== 0) {
          return sortOrder === 'asc' ? locComp : -locComp;
        }
        const nameA = String(a.item_name || '').trim();
        const nameB = String(b.item_name || '').trim();
        return nameA.localeCompare(nameB, 'id-ID', { numeric: true, sensitivity: 'base' });
      }

      // Sorting Nama Barang (dengan tie-breaker Lokasi)
      if (sortField === 'item_name') {
        const nameA = String(a.item_name || '').trim();
        const nameB = String(b.item_name || '').trim();
        const nameComp = nameA.localeCompare(nameB, 'id-ID', { numeric: true, sensitivity: 'base' });
        if (nameComp !== 0) {
          return sortOrder === 'asc' ? nameComp : -nameComp;
        }
        const locA = String(a.location || '').trim();
        const locB = String(b.location || '').trim();
        return locA.localeCompare(locB, 'id-ID', { numeric: true, sensitivity: 'base' });
      }

      const valA = a[sortField as keyof PenyiapanItem] ?? '';
      const valB = b[sortField as keyof PenyiapanItem] ?? '';

      if (sortField === 'qty_convert' || sortField === 'last_qty' || sortField === 'first_qty') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).trim();
      const strB = String(valB).trim();
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'id-ID', { numeric: true, sensitivity: 'base' })
        : strB.localeCompare(strA, 'id-ID', { numeric: true, sensitivity: 'base' });
    });
  }, [penyiapanList, searchQuery, itemNameFilter, categoryFilter, locationFilter, qcFilter, slocFilter, statusFilter, tujuanFilter, sortField, sortOrder]);

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

  // Check if any filters are currently active (Nama Barang, Search, Lokasi, Status Penyiapan, & Tujuan)
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    itemNameFilter.trim() ||
    locationFilter.trim() ||
    statusFilter !== 'ALL' ||
    tujuanFilter !== 'ALL'
  );

  // Quick count of items with status "Ada"
  const adaCount = statusStats.ada;

  // Selected items full data objects
  const selectedItemsData = useMemo(() => {
    return penyiapanList.filter(item => selectedIds.includes(item.id_penyiapan));
  }, [penyiapanList, selectedIds]);

  // Total quantity of selected items
  const selectedTotalQty = useMemo(() => {
    return selectedItemsData.reduce((acc, curr) => acc + (Number(curr.last_qty) || 0), 0);
  }, [selectedItemsData]);

  // Summary Metrics when rows are selected (Total Last Qty, Total Qty Convert, and Row Count)
  const selectedSummary = useMemo(() => {
    if (selectedIds.length === 0) return null;

    let totalLastQty = 0;
    let totalQtyConvert = 0;
    let totalFirstQty = 0;
    const distinctSkus = new Set<string>();
    const distinctBatches = new Set<string>();
    const distinctLocations = new Set<string>();
    const uomSet = new Set<string>();
    const uomConvertSet = new Set<string>();

    selectedItemsData.forEach(item => {
      const lQty = Number(item.last_qty) || 0;
      const fQty = Number(item.first_qty) || 0;
      const cQty = item.qty_convert !== undefined && item.qty_convert !== null && (item.qty_convert as any) !== ''
        ? (Number(item.qty_convert) || 0)
        : lQty || fQty || 0;

      totalLastQty += lQty;
      totalFirstQty += fQty;
      totalQtyConvert += cQty;

      if (item.item_code) distinctSkus.add(item.item_code.trim().toLowerCase());
      if (item.batch && item.batch !== '-') distinctBatches.add(item.batch.trim());
      if (item.location && item.location !== '-') distinctLocations.add(item.location.trim());
      if (item.uom && item.uom !== '-') uomSet.add(item.uom.trim().toUpperCase());
      if (item.uom_convert && item.uom_convert !== '-') uomConvertSet.add(item.uom_convert.trim().toUpperCase());
    });

    const displayUom = uomSet.size === 1 ? Array.from(uomSet)[0] : 'CTN';
    const displayUomConvert = uomConvertSet.size === 1 ? Array.from(uomConvertSet)[0] : 'PCS';

    return {
      selectedCount: selectedIds.length,
      totalRows: filteredPenyiapan.length,
      totalLastQty,
      totalQtyConvert,
      totalFirstQty,
      displayUom,
      displayUomConvert,
      distinctSkuCount: distinctSkus.size,
      distinctBatchCount: distinctBatches.size,
      distinctLocationCount: distinctLocations.size
    };
  }, [selectedIds, selectedItemsData, filteredPenyiapan.length]);

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

  // Clear all filters & sorting
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setItemNameFilter('');
    setLocationFilter('');
    setCategoryFilter('ALL');
    setQcFilter('ALL');
    setSlocFilter('ALL');
    setStatusFilter('ALL');
    setTujuanFilter('ALL');
    setSortField('location');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Sort Toggle (null -> asc -> desc -> null)
  const handleSort = (field: keyof PenyiapanItem | 'location_then_name') => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        // Toggle off back to unsorted (urutan asli)
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Add Modal (Directly opens Copy-Paste from Excel / Multi-SKU workflow)
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setBarangSearchText('');
    setIsBarangDropdownOpen(false);
    fetchMasterData();
    setShowPasteModal(true);
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
        category: b.category || prev.category || '',
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
      category: formData.category?.trim() || '',
      location: formData.location?.trim() || '',
      location_type: formData.location_type?.trim() || '',
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
        } else if (!isEditMode) {
          fetchPenyiapanData(true);
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
      tujuan: item.tujuan || 'Pemusnahan Limbah Terkontrol',
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category || '',
      location: item.location || '',
      location_type: item.location_type || '',
      first_qty: item.first_qty ?? 0,
      last_qty: item.last_qty ?? 0,
      uom: item.uom || 'CTN',
      qty_convert: item.qty_convert ?? item.last_qty ?? 0,
      uom_convert: item.uom_convert || 'PCS',
      lpn_serial_number: item.lpn_serial_number && item.lpn_serial_number !== '-' ? item.lpn_serial_number : `LPN-PMS-${dateStr}-${randomSuffix}`,
      batch: item.batch || '-',
      vendor_batch: item.vendor_batch || '-',
      sloc: item.sloc || '',
      expired_date: item.expired_date || '-',
      destination_code: item.destination_code || '',
      qc_code: item.qc_code || '',
      user_tally: item.user_tally || currentUser?.nama || '',
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
      tujuan: pemusnahanFormData.tujuan || pemusnahanTargetItem.tujuan || 'Pemusnahan Limbah Terkontrol',
      item_code: pemusnahanFormData.item_code,
      item_name: pemusnahanFormData.item_name,
      category: pemusnahanFormData.category || pemusnahanTargetItem.category || '',
      location: pemusnahanFormData.location || pemusnahanTargetItem.location || '',
      location_type: pemusnahanFormData.location_type || pemusnahanTargetItem.location_type || '',
      first_qty: Number(pemusnahanFormData.first_qty) || 0,
      last_qty: Number(pemusnahanFormData.last_qty) || 0,
      uom: pemusnahanFormData.uom || 'CTN',
      qty_convert: Number(pemusnahanFormData.qty_convert) || 0,
      uom_convert: pemusnahanFormData.uom_convert || 'PCS',
      lpn_serial_number: pemusnahanFormData.lpn_serial_number || '-',
      batch: pemusnahanFormData.batch || '-',
      vendor_batch: pemusnahanFormData.vendor_batch || '-',
      sloc: pemusnahanFormData.sloc || pemusnahanTargetItem.sloc || '',
      expired_date: pemusnahanFormData.expired_date || '-',
      destination_code: pemusnahanFormData.destination_code || pemusnahanTargetItem.destination_code || '',
      qc_code: pemusnahanFormData.qc_code || pemusnahanTargetItem.qc_code || '',
      user_tally: pemusnahanFormData.user_tally || pemusnahanTargetItem.user_tally || currentUser?.nama || '',
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
    const selectedItems = penyiapanList.filter(item => selectedIds.includes(item.id_penyiapan));

    // Ambil nilai Tujuan dan Note dari data terpilih di tabel penyiapan
    const initialTujuan = selectedItems.find(i => i.tujuan && i.tujuan.trim() !== '' && i.tujuan.trim() !== '-')?.tujuan || selectedItems[0]?.tujuan || '';
    const initialNote = selectedItems.find(i => i.note && i.note.trim() !== '' && i.note.trim() !== '-')?.note || selectedItems[0]?.note || '';

    setBulkFormData({
      sloc: initialDest.defaultSloc,
      location: initialDest.defaultLocation,
      location_type: initialDest.defaultLocationType,
      qc_code: initialDest.defaultQcCode,
      destination_code: initialDest.defaultDestinationCode,
      target_status: '', // biarkan kosong saja sesuai permintaan
      tujuan: initialTujuan,
      category: initialDest.defaultCategory,
      note: initialNote
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
        target_status: prev.target_status || '', // biarkan kosong saja
        tujuan: prev.tujuan || '', // pertahankan tujuan dari tabel penyiapan
        category: dest.defaultCategory,
        note: prev.note || '' // pertahankan note dari tabel penyiapan
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

      // Resolve tujuan: gunakan input form atau fallback ke tujuan masing-masing item penyiapan
      const itemTujuan = (item.tujuan && item.tujuan.trim() !== '' && item.tujuan.trim() !== '-') ? item.tujuan : '';
      const resolvedTujuan = bulkFormData.tujuan !== undefined && bulkFormData.tujuan !== ''
        ? bulkFormData.tujuan
        : itemTujuan;

      // Resolve note: gunakan input form atau fallback ke note masing-masing item penyiapan
      const itemNote = (item.note && item.note.trim() !== '' && item.note.trim() !== '-') ? item.note : '';
      const resolvedNote = bulkFormData.note !== undefined && bulkFormData.note !== ''
        ? bulkFormData.note
        : itemNote;

      // Status di database tujuan: kosongkan jika tidak diisi
      const resolvedStatus = bulkFormData.target_status || '';

      // Kolom Category, Location, Location Type, SLOC, Destination Code, QC Code, User Tally
      // Harus diisi sesuai data awal di data penyiapan, JANGAN diisi mock data seperti Finished Good, WH-REJECT-01, Quarantine, SL99, INCINERATOR, QC-REJECT
      const cleanVal = (val?: string) => (val && val.trim() !== '' && val.trim() !== '-') ? val.trim() : '';

      const isTargetPemusnahan = targetConfig.id === 'pemusnahan' || targetConfig.tableName === 'data_pemusnahan';

      const resolvedCategory = cleanVal(item.category) || (isTargetPemusnahan ? '' : (targetConfig.defaultCategory || ''));
      const resolvedLocation = cleanVal(item.location) || (isTargetPemusnahan ? '' : (targetConfig.defaultLocation || ''));
      const resolvedLocationType = cleanVal(item.location_type) || (isTargetPemusnahan ? '' : (targetConfig.defaultLocationType || ''));
      const resolvedSloc = cleanVal(item.sloc) || (isTargetPemusnahan ? '' : (targetConfig.defaultSloc || ''));
      const resolvedDestinationCode = cleanVal(item.destination_code) || (isTargetPemusnahan ? '' : (targetConfig.defaultDestinationCode || ''));
      const resolvedQcCode = cleanVal(item.qc_code) || (isTargetPemusnahan ? '' : (targetConfig.defaultQcCode || ''));
      const resolvedUserTally = cleanVal(item.user_tally) || (currentUser?.nama || '');

      return {
        [targetConfig.idField]: generatedId,
        tujuan: resolvedTujuan,
        item_code: item.item_code,
        item_name: item.item_name,
        category: resolvedCategory,
        location: resolvedLocation,
        location_type: resolvedLocationType,
        first_qty: Number(item.first_qty) || 0,
        last_qty: Number(item.last_qty) || 0,
        uom: item.uom || 'CTN',
        qty_convert: Number(item.qty_convert) || Number(item.last_qty) || 0,
        uom_convert: item.uom_convert || 'PCS',
        lpn_serial_number: item.lpn_serial_number && item.lpn_serial_number !== '-' ? item.lpn_serial_number : `LPN-${targetConfig.idPrefix}${dateStr}-${randomSuffix}`,
        batch: item.batch || '-',
        vendor_batch: item.vendor_batch || '-',
        sloc: resolvedSloc,
        expired_date: (item.expired_date && item.expired_date !== '-') ? item.expired_date : null,
        destination_code: resolvedDestinationCode,
        qc_code: resolvedQcCode,
        user_tally: resolvedUserTally,
        shelf_life: item.shelf_life || '24 Bulan',
        source: `Penyiapan (${item.id_penyiapan})`,
        user_input: currentUser?.nama || 'Admin',
        tanggal_update: nowIso,
        status: resolvedStatus,
        note: resolvedNote,
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
      } else if (bulkSourceAction === 'delete' && isSuperAdmin) {
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
        'Item Code': '',
        'Item Name': '',
        'Category': '',
        'Location': '',
        'Location Type': '',
        'First Qty': '',
        'Last Qty': '',
        'Uom': '',
        'Qty Convert': '',
        'Uom Convert': '',
        'LPN/Serial Number': '',
        'Batch': '',
        'Vendor Batch': '',
        'SLOC': '',
        'Expired Date': '',
        'Destination Code': '',
        'QC Code': '',
        'User Tally': '',
        'Shelf Life': '',
        'Source': '',
        'Status': '',
        'Note': '',
        'Tujuan': ''
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
      { wch: 14 }, // Vendor Batch
      { wch: 12 }, // SLOC
      { wch: 16 }, // Expired Date
      { wch: 18 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 16 }, // Source
      { wch: 12 }, // Status
      { wch: 24 }, // Note
      { wch: 20 }  // Tujuan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Penyiapan');
    XLSX.writeFile(wb, 'Template_Upload_Penyiapan.xlsx');
    showToast('Template Terunduh', 'Template Excel kosong berhasil diunduh.', 'info');
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
      'Tujuan': item.tujuan || '-',
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
      { wch: 20 }, // Tujuan
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

        // Calculate sequence number continuing from existing database rows so data is never overwritten
        const existingIds = new Set(penyiapanList.map(p => (p.id_penyiapan || '').trim().toLowerCase()));

        let maxSeq = 0;
        const prefixRegex = new RegExp(`^PEN-${dateStrPrefix}-(\\d+)$`, 'i');
        for (const item of penyiapanList) {
          const match = (item.id_penyiapan || '').match(prefixRegex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
        if (maxSeq === 0 && penyiapanList.length > 0) {
          maxSeq = penyiapanList.length;
        }

        let runningSeq = maxSeq;

        const rawList: PenyiapanItem[] = rawJson.map((row) => {
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
          const category = String(getVal(['category', 'Category', 'Kategori', 'kategori', 'kelompok', 'group']) || '').trim();
          // 4. location
          const location = String(getVal(['location', 'Location', 'Lokasi', 'rak', 'bin', 'posisi', 'storage_location']) || '').trim();
          // 5. location_type
          const locationType = String(getVal(['location_type', 'locationtype', 'Location Type', 'Tipe Lokasi', 'tipe', 'jenislokasi']) || '').trim();
          // 6. first_qty
          const firstQtyRaw = getVal(['first_qty', 'firstqty', 'First Qty', 'Qty Awal', 'qtyawal', 'po_qty', 'qtysj', 'qty']);
          const lastQtyRaw = getVal(['last_qty', 'lastqty', 'Last Qty', 'Qty Akhir', 'qty_penyiapan', 'qty_aktual']);
          const firstQty = firstQtyRaw !== '' ? Number(firstQtyRaw) || 0 : (lastQtyRaw !== '' ? Number(lastQtyRaw) || 0 : 0);
          // 7. last_qty
          const lastQty = lastQtyRaw !== '' ? Number(lastQtyRaw) || 0 : (firstQtyRaw !== '' ? Number(firstQtyRaw) || 0 : 0);
          // 8. uom
          const uom = String(getVal(['uom', 'Uom', 'UOM', 'Satuan', 'unit']) || '').trim();
          // 9. qty_convert
          const qtyConvertRaw = getVal(['qty_convert', 'qtyconvert', 'Qty Convert', 'Qty Konversi', 'qtykonversi', 'qty_pcs', 'total_pcs']);
          const qtyConvert = qtyConvertRaw !== '' ? Number(qtyConvertRaw) || 0 : (lastQty !== undefined ? lastQty : 0);
          // 10. uom_convert
          const uomConvert = String(getVal(['uom_convert', 'uomconvert', 'Uom Convert', 'Satuan Konversi', 'satuankonversi', 'satuan_terkecil']) || '').trim();
          // 11. lpn_serial_number
          const lpn = String(getVal(['lpn_serial_number', 'lpnserialnumber', 'LPN/Serial Number', 'LPN Serial Number', 'LPN', 'Serial Number', 'lpn', 'no_seri', 'serial_number', 'sn']) || '').trim();
          // 12. batch
          const batch = String(getVal(['batch', 'Batch', 'No Batch', 'nobatch', 'kode_batch', 'lot', 'batch_no']) || '').trim();
          // 13. vendor_batch
          const vendorBatch = String(getVal(['vendor_batch', 'vendorbatch', 'Vendor Batch', 'Batch Vendor', 'batchvendor', 'lot_vendor']) || '').trim();
          // 14. sloc
          const sloc = String(getVal(['sloc', 'SLOC', 'SLoc', 'storage_location', 'gudang']) || '').trim();

          // 15. expired_date
          let expDate = String(getVal(['expired_date', 'expireddate', 'Expired Date', 'exp_date', 'tanggal_ed', 'kadaluwarsa', 'ed', 'exp']) || '').trim();
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

          // 20. source
          const source = String(getVal(['source', 'Source', 'Sumber', 'asal', 'source_location']) || '').trim();

          // Continuous unique ID generation
          const rawId = String(getVal(['id_penyiapan', 'idpenyiapan', 'ID Penyiapan', 'id', 'kode_penyiapan']) || '').trim();
          let idGenerated = rawId;
          if (!idGenerated || existingIds.has(idGenerated.toLowerCase())) {
            runningSeq++;
            idGenerated = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
            while (existingIds.has(idGenerated.toLowerCase())) {
              runningSeq++;
              idGenerated = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
            }
          }
          existingIds.add(idGenerated.toLowerCase());

          const tujuan = String(getVal(['tujuan', 'Tujuan', 'tujuan_penyiapan', 'tujuan_pengiriman', 'tujuankirim', 'alokasi', 'customer', 'delivery_to', 'depo_tujuan', 'outlet']) || '').trim();

          // 21. status: Kosong atau isi status dari excel
          const rawStatus = String(getVal(['status', 'Status', 'status_penyiapan', 'kondisi']) || '').trim();
          const status = rawStatus;

          const note = String(getVal(['note', 'Note', 'catatan', 'keterangan', 'remark']) || '').trim();

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
            expired_date: expDate,
            destination_code: destCode,
            qc_code: qcCode,
            user_tally: userTally,
            shelf_life: shelfLife,
            source,
            tujuan,
            user_input: currentUser?.nama || currentUser?.username || '',
            status,
            note,
            created_at: nowIso
          };
        }).filter(r => (r.item_code && r.item_code.trim() !== '') || (r.item_name && r.item_name.trim() !== '') || (r.batch && r.batch.trim() !== ''));

        setParsedExcelRows(rawList);
        if (rawList.length > 0) {
          showToast('Excel Terbaca Cepat', `${rawList.length} baris data penyiapan valid ditemukan (Lanjut dari baris terakhir)`, 'info');
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

  // Commit Parsed Excel to Database & Local State (Appended to the end without overwriting)
  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) return;

    // Recalculate unique sequential IDs starting after current penyiapanList to guarantee no overwrites
    const existingIds = new Set(penyiapanList.map(p => (p.id_penyiapan || '').trim().toLowerCase()));
    const nowIso = new Date().toISOString();
    const dateStrPrefix = nowIso.slice(0, 10).replace(/-/g, '');

    let maxSeq = 0;
    const prefixRegex = new RegExp(`^PEN-${dateStrPrefix}-(\\d+)$`, 'i');
    for (const item of penyiapanList) {
      const match = (item.id_penyiapan || '').match(prefixRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    if (maxSeq === 0 && penyiapanList.length > 0) {
      maxSeq = penyiapanList.length;
    }

    let runningSeq = maxSeq;

    // Apply destination and ensure unique continuous IDs
    const finalUploadRows: PenyiapanItem[] = parsedExcelRows.map(row => {
      let finalId = (row.id_penyiapan || '').trim();
      if (!finalId || existingIds.has(finalId.toLowerCase())) {
        runningSeq++;
        finalId = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
        while (existingIds.has(finalId.toLowerCase())) {
          runningSeq++;
          finalId = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
        }
      }
      existingIds.add(finalId.toLowerCase());

      return {
        ...row,
        id_penyiapan: finalId,
        tujuan: (row.tujuan && row.tujuan.trim() !== '') ? row.tujuan.trim() : (excelUploadTujuan ? excelUploadTujuan.trim() : '')
      };
    });

    isImportingRef.current = true;
    setIsProcessingExcel(true);
    setUploadProgress({
      isUploading: true,
      current: 0,
      total: finalUploadRows.length,
      percentage: 0,
      statusText: 'Mempersiapkan data penyiapan...'
    });

    try {
      // 1. Strictly append to local list (Lanjut dari baris akhir, tidak tertimpa)
      const finalMerged = [...penyiapanList, ...finalUploadRows];
      setPenyiapanList(finalMerged);

      // 2. Persist to Supabase with chunk size 500 & live progress indicator
      if (isSupabaseConfigured) {
        setUploadProgress(prev => ({
          ...prev,
          statusText: `Mengunggah ${finalUploadRows.length.toLocaleString('id-ID')} data ke Database Supabase...`
        }));

        const { successCount, error } = await safeBatchUpsertPenyiapan(
          finalUploadRows,
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
            current: finalUploadRows.length,
            total: finalUploadRows.length,
            percentage: 100,
            statusText: 'Unggah selesai! Memfinalisasi data...'
          });
          showToast('Import Selesai', `${successCount.toLocaleString('id-ID')} data penyiapan berhasil ditambahkan ke Database Supabase (Lanjut dari baris akhir)!`, 'success');
          // Silent refresh: background fetch without unmounting table or blinking screen
          await fetchPenyiapanData(true);
        }
      } else {
        setUploadProgress({
          isUploading: true,
          current: finalUploadRows.length,
          total: finalUploadRows.length,
          percentage: 100,
          statusText: 'Tersimpan di penyimpanan lokal!'
        });
        showToast('Import Lokal Selesai', `${finalUploadRows.length} data penyiapan berhasil ditambahkan ke penyimpanan lokal!`, 'success');
      }

      // Automatically activate filter for the uploaded tujuan if provided
      if (excelUploadTujuan.trim()) {
        setTujuanFilter(excelUploadTujuan.trim());
        setCurrentPage(1);
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
      }, 500);
    } catch (err: any) {
      console.error('Error committing excel rows:', err);
      showToast('Gagal Mengimpor', err?.message || 'Terjadi kesalahan saat menyimpan data.', 'danger');
      setIsProcessingExcel(false);
      isImportingRef.current = false;
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
    }
  };

  // =========================================================================
  // COPY-PASTE DARI EXCEL HANDLERS (ROLE USER & ADMIN)
  // Format Kolom Sesuai Input Form per SKU:
  // Item Code | Item Name | Location | Last Qty | Uom | Qty Convert | Batch | Expired Date | LPN/Serial Number | Status | Note | Tujuan
  // =========================================================================
  // COPY-PASTE FROM EXCEL MODAL HANDLERS (ROLE USER & ADMIN)
  // Mendukung Penuh Format Kolom Database data_penyiapan & Format Form per SKU
  // =========================================================================
  const handleOpenPasteModal = () => {
    fetchMasterData();
    setShowPasteModal(true);
  };

  // Copy template header format database data_penyiapan to clipboard
  const handleCopyPasteTemplateHeader = (formatType: 'db_full' | 'form_sku' = 'db_full') => {
    let headers: string[] = [];
    if (formatType === 'db_full') {
      // Urutan Persis Sesuai Gambar Tabel Database: Item Code (1), Item Name (2), Category (3), Location (4)...
      headers = [
        'Item Code',
        'Item Name',
        'Category',
        'Location',
        'Location Type',
        'First Qty',
        'Last Qty',
        'Uom',
        'Qty Convert',
        'Uom Convert',
        'LPN/Serial Number',
        'Batch',
        'Vendor Batch',
        'SLOC',
        'Expired Date',
        'Destination Code',
        'QC Code',
        'User Tally',
        'Shelf Life',
        'Source',
        'Status',
        'Note',
        'Tujuan'
      ];
    } else {
      headers = [
        'Item Code',
        'Item Name',
        'Category',
        'Location',
        'Last Qty',
        'Uom',
        'Qty Convert',
        'Batch',
        'Expired Date',
        'LPN/Serial Number',
        'Status',
        'Note',
        'Tujuan'
      ];
    }
    const headerStr = headers.join('\t');
    navigator.clipboard.writeText(headerStr);
    showToast('Format Kolom Disalin', `Format kolom ${formatType === 'db_full' ? 'Tabel Database (23 kolom)' : 'Form Ringkas (13 kolom)'} berhasil disalin ke clipboard! Silakan paste di baris 1 Excel Anda.`, 'success');
  };

  // Helper normalizer
  const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Comprehensive Dictionary for mapping headers to exact data_penyiapan properties
  const fieldSynonyms: { [colKey in keyof PenyiapanItem | 'no']?: string[] } = {
    id_penyiapan: ['idpenyiapan', 'id_penyiapan', 'kodepenyiapan', 'nopenyiapan', 'idtransaksi', 'id', 'nopenyiapanbarang', 'kodepenyiapanbarang'],
    tujuan: ['tujuan', 'tujuanpenyiapan', 'tujuan_penyiapan', 'tujuanpengiriman', 'tujuan_pengiriman', 'tujuankirim', 'alokasi', 'customer', 'deliveryto', 'lokasitujuan', 'kirimke', 'tujuandistribusi', 'outlet', 'depotujuan', 'tujuandepo'],
    item_code: ['itemcode', 'item_code', 'kodesku', 'kodebarang', 'kode_barang', 'sku', 'kode', 'code', 'item', 'kodeitem', 'kode_item', 'material', 'kodeproduk', 'productcode', 'partnumber', 'kodebarangitem'],
    item_name: ['itemname', 'item_name', 'namabarang', 'nama_barang', 'namaproduk', 'deskripsibarang', 'namasku', 'deskripsi', 'nama', 'itemdesc', 'description', 'namaitem', 'productname', 'namabarangproduk'],
    category: ['category', 'kategori', 'kelompok', 'group', 'jenis', 'kategoribarang', 'categoryname', 'kelompokbarang'],
    location: ['location', 'lokasi', 'rak', 'bin', 'loc', 'lokasirak', 'lokasibin', 'storagelocation', 'storage_location', 'posisi', 'tempat', 'locationname', 'nomorrak'],
    location_type: ['locationtype', 'location_type', 'tipelokasi', 'tipe_lokasi', 'jenislokasi', 'loctype', 'type', 'tipetempat', 'jenisposisi'],
    first_qty: ['firstqty', 'first_qty', 'qtyawal', 'qty_awal', 'poqty', 'qtysj', 'stokawal', 'qtyorder', 'qtyplan', 'jumlahawal'],
    last_qty: ['lastqty', 'last_qty', 'qty', 'qtyakhir', 'qty_akhir', 'qtypenyiapan', 'jumlah', 'kuantitas', 'qtyctn', 'ctn', 'totalqty', 'qtyaktual', 'actualqty', 'qtyfisik', 'qtyreal', 'qtypenyiapanbarang', 'jumlahpenyiapan'],
    uom: ['uom', 'satuan', 'unit', 'kemasan', 'satuanutama', 'uomutama', 'satuanbarang'],
    qty_convert: ['qtyconvert', 'qty_convert', 'qtykonversi', 'qty_konversi', 'qtypcs', 'pcs', 'konversi', 'qtyconv', 'totalpcs', 'jumlahpcs', 'totalqtypcs'],
    uom_convert: ['uomconvert', 'uom_convert', 'satuankonversi', 'satuan_konversi', 'uompcs', 'satuanpcs', 'satuanterkecil', 'uomconv', 'satuanpcsbarang'],
    lpn_serial_number: ['lpnserialnumber', 'lpn_serial_number', 'lpn', 'serialnumber', 'serial_number', 'serial', 'lpnserial', 'sn', 'noseri', 'lpnserialno', 'serialno', 'licensplate', 'nomorseri', 'nolpn'],
    batch: ['batch', 'nobatch', 'no_batch', 'nomorbatch', 'batchno', 'batch_no', 'lot', 'lotno', 'lot_no', 'kodebatch', 'batchnumber'],
    vendor_batch: ['vendorbatch', 'vendor_batch', 'batchvendor', 'batch_vendor', 'lotvendor', 'vendorlot', 'vendorbatchno', 'nobatchvendor', 'batchsuplier'],
    sloc: ['sloc', 'storagelocation', 'gudang', 'storageloc', 'storage_location', 'slocid', 'kodesloc'],
    expired_date: ['expireddate', 'expired_date', 'expdate', 'exp_date', 'expired', 'kadaluwarsa', 'ed', 'tanggalkadaluwarsa', 'tgled', 'tgl_ed', 'exp', 'expirydate', 'bbd', 'tglexpired', 'tanggaled'],
    destination_code: ['destinationcode', 'destination_code', 'destcode', 'dest_code', 'kodedestinasi', 'kodetujuan', 'tujuancode', 'destination', 'destinasi'],
    qc_code: ['qccode', 'qc_code', 'statusqc', 'status_qc', 'kondisiqc', 'qc', 'kodeqc', 'qcstatus', 'hasilqc'],
    user_tally: ['usertally', 'user_tally', 'petugastally', 'tally', 'checker', 'userchecker', 'namatally'],
    shelf_life: ['shelflife', 'shelf_life', 'masasimpan', 'masa_simpan', 'shelflifebulan', 'masasimpanbulan', 'shelflife_bulan', 'umursimpan'],
    source: ['source', 'sumber', 'asal', 'sourcelocation', 'source_location', 'sumberbarang', 'asalbarang'],
    user_input: ['userinput', 'user_input', 'operator', 'pembuat', 'admin', 'user', 'inputby', 'dibuatoleh', 'createdby', 'petugasinput'],
    tanggal_update: ['tanggalupdate', 'tanggal_update', 'tglupdate', 'tgl_update', 'updateddate', 'updateat', 'lastupdate'],
    status: ['status', 'statuspenyiapan', 'kondisi', 'status_penyiapan', 'statusbarang'],
    note: ['note', 'catatan', 'keterangan', 'remark', 'perbedaandata', 'ket', 'keteranganselisih', 'remarks', 'memo', 'catatanpenyiapan'],
    created_at: ['createdat', 'created_at', 'tglbuat', 'tanggaldibuat', 'createddate', 'tgl_buat'],
    no: ['no', 'nomor', 'number', 'num', 'nourut']
  };

  // Helper date parser to ISO YYYY-MM-DD
  const parseDateToIso = (rawDateStr: string): string => {
    if (!rawDateStr || rawDateStr.trim() === '' || rawDateStr.trim() === '-' || rawDateStr.trim() === 'null') {
      return '-';
    }
    const val = rawDateStr.trim();
    // Excel numeric date (e.g. 45678)
    if (/^\d{5}$/.test(val)) {
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + Number(val) * 86400000);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
    }
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(val)) {
      const delimiter = val.includes('/') ? '/' : (val.includes('-') ? '-' : '.');
      const parts = val.split(delimiter);
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
    // YYYY/MM/DD or YYYY-MM-DD
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

  // Core Parser for Tabular Text copied from Excel / Google Sheets / CSV / Database Studio
  const parsePastedText = (
    rawText: string,
    forceHasHeader?: boolean,
    presetOverride?: 'auto' | 'db_full' | 'db_tujuan' | 'export_excel' | 'form_sku'
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

    // Determine delimiter (tab, semicolon, or comma)
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';') && !firstLine.includes('\t')) {
      delimiter = ';';
    } else if (firstLine.includes(',') && !firstLine.includes('\t') && !firstLine.includes(';')) {
      delimiter = ',';
    }

    // Split rows into cells
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

    // Check if line 0 looks like a header
    const firstRowNorm = parsedMatrix[0].map(c => normalizeKey(c));
    let detectedHeaderMatches = 0;

    // Count how many header synonyms are found in first row
    firstRowNorm.forEach(cellNorm => {
      for (const fieldKey of Object.keys(fieldSynonyms)) {
        const synonyms = fieldSynonyms[fieldKey as keyof typeof fieldSynonyms] || [];
        if (synonyms.some(s => s === cellNorm || (cellNorm.length >= 4 && (cellNorm.includes(s) || s.includes(cellNorm))))) {
          detectedHeaderMatches++;
          break;
        }
      }
    });

    const detectedHasHeader = forceHasHeader !== undefined ? forceHasHeader : (detectedHeaderMatches >= 2);
    setPasteHasHeader(detectedHasHeader);

    // Identify Column Index Mapping from headers
    const columnMap: { [key: string]: number } = {};

    if (detectedHasHeader) {
      // 1. Exact match first across all headers
      firstRowNorm.forEach((cellNorm, idx) => {
        for (const fieldKey of Object.keys(fieldSynonyms)) {
          if (columnMap[fieldKey] === undefined) {
            const synonyms = fieldSynonyms[fieldKey as keyof typeof fieldSynonyms] || [];
            if (synonyms.includes(cellNorm)) {
              columnMap[fieldKey] = idx;
              break;
            }
          }
        }
      });

      // 2. Safe partial match for remaining unmapped columns
      firstRowNorm.forEach((cellNorm, idx) => {
        if (!Object.values(columnMap).includes(idx) && cellNorm.length >= 3) {
          for (const fieldKey of Object.keys(fieldSynonyms)) {
            if (columnMap[fieldKey] === undefined) {
              const synonyms = fieldSynonyms[fieldKey as keyof typeof fieldSynonyms] || [];
              // Prevent batch and tujuan cross-matching
              if (fieldKey === 'tujuan' && (cellNorm.includes('batch') || cellNorm.includes('lot') || cellNorm.includes('destcode'))) continue;
              if (fieldKey === 'batch' && (cellNorm.includes('tujuan') || cellNorm.includes('dest'))) continue;
              if (fieldKey === 'destination_code' && cellNorm === 'tujuan') continue;

              if (synonyms.some(s => cellNorm === s || (cellNorm.length >= 4 && s.includes(cellNorm)) || (s.length >= 4 && cellNorm.includes(s)))) {
                columnMap[fieldKey] = idx;
                break;
              }
            }
          }
        }
      });
    }

    const dataRows = detectedHasHeader ? parsedMatrix.slice(1) : parsedMatrix;
    const nowIso = new Date().toISOString();
    const activePreset = presetOverride || pasteFormatPreset;

    const parsedResults: PenyiapanItem[] = dataRows
      .filter(row => row.some(cell => cell && cell.trim().length > 0))
      .map((row, rowIdx) => {
        let id_penyiapan = '';
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
        let sloc = 'SL02';
        let expired_date = '-';
        let destination_code = 'DST-02';
        let qc_code = 'QC-PASS';
        let user_tally = 'Tally Penyiapan';
        let shelf_life = '24 Bulan';
        let source = 'Stok Gudang';
        let user_input = currentUser?.nama || 'User';
        let tanggal_update = nowIso;
        let status = pasteDefaultStatus || ''; // Default kosong jika belum di-check statusnya
        let note = '';
        let tujuan = pasteDefaultTujuan || '';

        const getCol = (idx: number | undefined) => (idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : '');

        if (detectedHasHeader && Object.keys(columnMap).length >= 2) {
          // Mapped directly by detected header names
          if (columnMap['id_penyiapan'] !== undefined) id_penyiapan = getCol(columnMap['id_penyiapan']);
          if (columnMap['item_code'] !== undefined) item_code = getCol(columnMap['item_code']);
          if (columnMap['item_name'] !== undefined) item_name = getCol(columnMap['item_name']);
          if (columnMap['category'] !== undefined) category = getCol(columnMap['category']);
          if (columnMap['location'] !== undefined) location = getCol(columnMap['location']);
          if (columnMap['location_type'] !== undefined) location_type = getCol(columnMap['location_type']);
          if (columnMap['first_qty'] !== undefined) first_qty = Number(getCol(columnMap['first_qty']).replace(/[^0-9.-]/g, '')) || 0;
          if (columnMap['last_qty'] !== undefined) last_qty = Number(getCol(columnMap['last_qty']).replace(/[^0-9.-]/g, '')) || 0;
          if (columnMap['uom'] !== undefined) uom = getCol(columnMap['uom']) || 'CTN';
          if (columnMap['qty_convert'] !== undefined) qty_convert = Number(getCol(columnMap['qty_convert']).replace(/[^0-9.-]/g, '')) || 0;
          if (columnMap['uom_convert'] !== undefined) uom_convert = getCol(columnMap['uom_convert']) || 'PCS';
          if (columnMap['lpn_serial_number'] !== undefined) lpn_serial_number = getCol(columnMap['lpn_serial_number']) || '-';
          if (columnMap['batch'] !== undefined) batch = getCol(columnMap['batch']) || '-';
          if (columnMap['vendor_batch'] !== undefined) vendor_batch = getCol(columnMap['vendor_batch']) || '-';
          if (columnMap['sloc'] !== undefined) sloc = getCol(columnMap['sloc']) || 'SL02';
          if (columnMap['expired_date'] !== undefined) expired_date = parseDateToIso(getCol(columnMap['expired_date']));
          if (columnMap['destination_code'] !== undefined) destination_code = getCol(columnMap['destination_code']) || 'DST-02';
          if (columnMap['qc_code'] !== undefined) qc_code = getCol(columnMap['qc_code']) || 'QC-PASS';
          if (columnMap['user_tally'] !== undefined) user_tally = getCol(columnMap['user_tally']) || 'Tally Penyiapan';
          if (columnMap['shelf_life'] !== undefined) shelf_life = getCol(columnMap['shelf_life']) || '24 Bulan';
          if (columnMap['source'] !== undefined) source = getCol(columnMap['source']) || 'Stok Gudang';
          if (columnMap['status'] !== undefined && getCol(columnMap['status'])) status = getCol(columnMap['status']);
          if (columnMap['note'] !== undefined) note = getCol(columnMap['note']);
          if (columnMap['tujuan'] !== undefined) tujuan = getCol(columnMap['tujuan']);
          if (columnMap['user_input'] !== undefined) user_input = getCol(columnMap['user_input']) || currentUser?.nama || 'User';
          if (columnMap['tanggal_update'] !== undefined) tanggal_update = getCol(columnMap['tanggal_update']) || nowIso;
        } else {
          // Positional Mapping according to Preset / Data Shape
          // Check if first cell is row number (1, 2, 3...)
          const rawCell0 = (row[0] || '').trim();
          const rawCell1 = (row[1] || '').trim();
          const isFirstColRowNumber = /^\d{1,4}$/.test(rawCell0) && (
            /^\d{5,}$/.test(rawCell1) || 
            rawCell1.toUpperCase().startsWith('SKU') || 
            rawCell1.toUpperCase().startsWith('PEN-') || 
            rawCell1.length >= 6
          );

          const r = isFirstColRowNumber ? row.slice(1) : row;
          const colCount = r.length;
          
          let determinedMode: 'db_full' | 'db_tujuan' | 'export_excel' | 'form_sku' = 'db_full';
          if (activePreset !== 'auto') {
            determinedMode = activePreset;
          } else {
            // Intelligent shape detector
            const c0 = (r[0] || '').trim();
            const c1 = (r[1] || '').trim();
            if (colCount >= 18) {
              if (c0.toUpperCase().startsWith('PEN-')) {
                determinedMode = 'export_excel';
              } else {
                determinedMode = 'db_full';
              }
            } else if (colCount >= 10 && colCount <= 17) {
              determinedMode = 'form_sku';
            } else {
              determinedMode = 'db_full';
            }
          }

          if (determinedMode === 'db_full') {
            // Urutan Persis Sesuai Tabel Database data_penyiapan (20-25 Kolom):
            // [0] Item Code (Kolom 1)
            // [1] Item Name (Kolom 2)
            // [2] Category (Kolom 3)
            // [3] Location (Kolom 4 - Lokasi sesuai upload user)
            // [4] Location Type
            // [5] First Qty
            // [6] Last Qty
            // [7] Uom
            // [8] Qty Convert
            // [9] Uom Convert
            // [10] LPN/Serial Number
            // [11] Batch
            // [12] Vendor Batch
            // [13] SLOC
            // [14] Expired Date
            // [15] Destination Code
            // [16] QC Code
            // [17] User Tally
            // [18] Shelf Life
            // [19] Source
            // [20] Status (Kosong jika belum di-check)
            // [21] Note / Catatan
            // [22] Tujuan
            // [23] User Input
            // [24] Tanggal Update
            // [25] ID Penyiapan
            const cell0 = (r[0] || '').trim();
            const startsWithId = cell0.toUpperCase().startsWith('PEN-');

            if (startsWithId) {
              // Format jika diawali ID Penyiapan
              id_penyiapan = r[0] || '';
              item_code = r[1] || '';
              item_name = r[2] || '';
              category = r[3] || '';
              location = r[4] || '';
              location_type = r[5] || '';
              first_qty = Number(String(r[6] || '0').replace(/[^0-9.-]/g, '')) || 0;
              last_qty = Number(String(r[7] || '0').replace(/[^0-9.-]/g, '')) || 0;
              uom = r[8] || 'CTN';
              qty_convert = Number(String(r[9] || '0').replace(/[^0-9.-]/g, '')) || 0;
              uom_convert = r[10] || 'PCS';
              lpn_serial_number = r[11] || '-';
              batch = r[12] || '-';
              vendor_batch = r[13] || '-';
              sloc = r[14] || 'SL02';
              expired_date = parseDateToIso(r[15] || '-');
              destination_code = r[16] || 'DST-02';
              qc_code = r[17] || 'QC-PASS';
              user_tally = r[18] || 'Tally Penyiapan';
              shelf_life = r[19] || '24 Bulan';
              source = r[20] || 'Stok Gudang';
              status = r[21] || pasteDefaultStatus || '';
              note = r[22] || '';
              tujuan = r[23] || pasteDefaultTujuan || '';
              user_input = r[24] || currentUser?.nama || 'User';
              tanggal_update = r[25] || nowIso;
            } else {
              // Format Standar Database Sesuai Upload Excel: Mulai dari Item Code (Kolom 1), Item Name (2), Category (3), Location (Kolom 4)...
              item_code = r[0] || '';
              item_name = r[1] || '';
              category = r[2] || '';
              location = r[3] || '';
              location_type = r[4] || '';
              first_qty = Number(String(r[5] || '0').replace(/[^0-9.-]/g, '')) || 0;
              last_qty = Number(String(r[6] || '0').replace(/[^0-9.-]/g, '')) || 0;
              uom = r[7] || 'CTN';
              qty_convert = Number(String(r[8] || '0').replace(/[^0-9.-]/g, '')) || 0;
              uom_convert = r[9] || 'PCS';
              lpn_serial_number = r[10] || '-';
              batch = r[11] || '-';
              vendor_batch = r[12] || '-';
              sloc = r[13] || 'SL02';
              expired_date = parseDateToIso(r[14] || '-');
              destination_code = r[15] || 'DST-02';
              qc_code = r[16] || 'QC-PASS';
              user_tally = r[17] || 'Tally Penyiapan';
              shelf_life = r[18] || '24 Bulan';
              source = r[19] || 'Stok Gudang';
              status = r[20] || pasteDefaultStatus || '';
              note = r[21] || '';
              tujuan = r[22] || pasteDefaultTujuan || '';
              user_input = r[23] || currentUser?.nama || 'User';
              tanggal_update = r[24] || nowIso;
              id_penyiapan = r[25] || '';
            }
          } else if (determinedMode === 'export_excel') {
            // Format Export Laporan Excel
            id_penyiapan = r[0] || '';
            item_code = r[1] || '';
            item_name = r[2] || '';
            category = r[3] || '';
            location = r[4] || '';
            location_type = r[5] || '';
            first_qty = Number(String(r[6] || '0').replace(/[^0-9.-]/g, '')) || 0;
            last_qty = Number(String(r[7] || '0').replace(/[^0-9.-]/g, '')) || 0;
            uom = r[8] || 'CTN';
            qty_convert = Number(String(r[9] || '0').replace(/[^0-9.-]/g, '')) || 0;
            uom_convert = r[10] || 'PCS';
            lpn_serial_number = r[11] || '-';
            batch = r[12] || '-';
            vendor_batch = r[13] || '-';
            sloc = r[14] || 'SL02';
            expired_date = parseDateToIso(r[15] || '-');
            destination_code = r[16] || 'DST-02';
            qc_code = r[17] || 'QC-PASS';
            user_tally = r[18] || 'Tally Penyiapan';
            shelf_life = r[19] || '24 Bulan';
            source = r[20] || 'Stok Gudang';
            status = r[21] || pasteDefaultStatus || '';
            note = r[22] || '';
            tujuan = r[23] || pasteDefaultTujuan || '';
            user_input = r[24] || currentUser?.nama || 'User';
          } else {
            // Format Form Ringkas (Kolom ke-4 adalah Location sesuai data upload user)
            // [0] Item Code, [1] Item Name, [2] Category, [3] Location (Kolom ke-4), [4] Last Qty,
            // [5] Uom, [6] Qty Convert, [7] Batch, [8] Expired Date, [9] LPN/Serial, [10] Status, [11] Note, [12] Tujuan
            const cell0 = (r[0] || '').trim();
            const cell1 = (r[1] || '').trim();
            const cell2 = (r[2] || '').trim();

            if (cell0 && (/^\d{5,}$/.test(cell0) || cell0.toUpperCase().startsWith('SKU') || cell0.length >= 6)) {
              item_code = cell0;
              item_name = cell1 || '';
              category = cell2 || '';
              location = r[3] || '';
              last_qty = Number(String(r[4] || '0').replace(/[^0-9.-]/g, '')) || 0;
              first_qty = last_qty;
              uom = r[5] || 'CTN';
              qty_convert = Number(String(r[6] || '0').replace(/[^0-9.-]/g, '')) || 0;
              batch = r[7] || '-';
              expired_date = parseDateToIso(r[8] || '-');
              lpn_serial_number = r[9] || '-';
              status = r[10] || pasteDefaultStatus || '';
              note = r[11] || '';
              tujuan = r[12] || pasteDefaultTujuan || '';
            } else {
              item_code = cell0 || cell1 || '';
              item_name = cell1 || cell2 || '';
              category = cell2 || '';
              location = r[3] || '';
              last_qty = Number(String(r[4] || '0').replace(/[^0-9.-]/g, '')) || 0;
              first_qty = last_qty;
              uom = r[5] || 'CTN';
              qty_convert = Number(String(r[6] || '0').replace(/[^0-9.-]/g, '')) || 0;
              batch = r[7] || '-';
              expired_date = parseDateToIso(r[8] || '-');
              lpn_serial_number = r[9] || '-';
              status = r[10] || pasteDefaultStatus || '';
              note = r[11] || '';
              tujuan = r[12] || pasteDefaultTujuan || '';
            }
          }
        }

        // Apply defaults if empty
        if (!location || location.trim() === '-' || location.trim() === '') {
          location = pasteDefaultLocation ? pasteDefaultLocation.trim() : '-';
        }
        
        // Priority for Tujuan: If Set Massal Tujuan is specified, strictly use it.
        // Also ensure Tujuan does not accidentally copy the Batch number.
        if (pasteDefaultTujuan && pasteDefaultTujuan.trim()) {
          tujuan = pasteDefaultTujuan.trim();
        } else if (!tujuan || tujuan === '-' || (batch && batch !== '-' && tujuan.trim() === batch.trim())) {
          tujuan = pasteDefaultTujuan ? pasteDefaultTujuan.trim() : '';
        }

        if (!status) {
          status = pasteDefaultStatus || '';
        }
        if (first_qty === 0 && last_qty > 0) {
          first_qty = last_qty;
        }
        if (last_qty === 0 && first_qty > 0) {
          last_qty = first_qty;
        }

        // Auto-match with Master Barang if code or name missing
        if (item_code && !item_name && barangList.length > 0) {
          const match = barangList.find(b => b.item_code.trim().toLowerCase() === item_code.trim().toLowerCase());
          if (match) {
            item_name = match.item_name;
            if (!uom || uom === 'CTN') uom = match.uom || 'CTN';
            if (match.category) category = match.category;
          }
        } else if (!item_code && item_name && barangList.length > 0) {
          const match = barangList.find(b => b.item_name.trim().toLowerCase() === item_name.trim().toLowerCase());
          if (match) {
            item_code = match.item_code;
            if (!uom || uom === 'CTN') uom = match.uom || 'CTN';
            if (match.category) category = match.category;
          }
        }

        // Fallback for code/name
        if (!item_code && item_name) {
          item_code = 'SKU-' + Math.floor(100000 + Math.random() * 900000);
        }
        if (!item_name && item_code) {
          item_name = `Barang ${item_code}`;
        }

        // Auto calculate Qty Convert if not provided or 0
        if (qty_convert <= 0 && last_qty > 0) {
          qty_convert = last_qty;
        }

        // Auto calculate Expired Date if missing or provided as batch
        let normalizedEd = expired_date;
        if ((!normalizedEd || normalizedEd === '-' || normalizedEd === 'null') && batch && batch !== '-' && item_code && item_name) {
          const autoCalc = getEdIsoDateString(item_code, item_name, batch);
          if (autoCalc && autoCalc.isoDate) {
            normalizedEd = autoCalc.isoDate;
            shelf_life = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
          }
        }

        const tempId = id_penyiapan && id_penyiapan.startsWith('PEN-') ? id_penyiapan : `PEN-PASTE-${rowIdx + 1}`;

        return {
          id_penyiapan: tempId,
          item_code: item_code.trim(),
          item_name: item_name.trim(),
          category: category ? category.trim() : '',
          location: location.trim(),
          location_type: location_type ? location_type.trim() : '',
          first_qty: Number(first_qty) || 0,
          last_qty: Number(last_qty) || 0,
          uom: uom.trim() || 'CTN',
          qty_convert: Number(qty_convert) || Number(last_qty) || 0,
          uom_convert: uom_convert.trim() || 'PCS',
          lpn_serial_number: lpn_serial_number.trim() || '-',
          batch: batch.trim() || '-',
          vendor_batch: vendor_batch.trim() || '-',
          sloc: sloc.trim() || 'SL02',
          expired_date: normalizedEd && normalizedEd !== '-' ? normalizedEd : '-',
          destination_code: destination_code.trim() || 'DST-02',
          qc_code: qc_code.trim() || 'QC-PASS',
          user_tally: user_tally.trim() || currentUser?.nama || 'Tally Penyiapan',
          shelf_life: shelf_life.trim() || '24 Bulan',
          source: source.trim() || 'Stok Gudang',
          tujuan: tujuan.trim(),
          user_input: user_input.trim() || currentUser?.nama || 'User',
          status: status ? status.trim() : '',
          note: note.trim(),
          tanggal_update: tanggal_update || nowIso,
          created_at: nowIso
        };
      });

    setPastedRows(parsedResults);
  };

  const handleUpdatePastedRow = (index: number, field: keyof PenyiapanItem, value: any) => {
    setPastedRows(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      let processedVal = value;
      if (field === 'last_qty' || field === 'first_qty' || field === 'qty_convert') {
        processedVal = Number(value) || 0;
      }
      next[index] = { ...next[index], [field]: processedVal };
      return next;
    });
  };

  const handleDeletePastedRow = (index: number) => {
    setPastedRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyBatchSettingsToPasted = (tujuanVal: string, statusVal: string, locationVal: string) => {
    setPastedRows(prev自动 => prev自动.map(row => ({
      ...row,
      tujuan: (tujuanVal !== undefined ? tujuanVal.trim() : (pasteDefaultTujuan || '')),
      status: statusVal !== undefined && statusVal !== '' ? statusVal : row.status,
      location: (locationVal && locationVal.trim()) ? locationVal.trim() : row.location
    })));
    showToast('Pengaturan Diterapkan', `Tujuan "${(tujuanVal || pasteDefaultTujuan || '-').trim()}", Status, dan Lokasi berhasil diterapkan ke semua baris di atas.`, 'info');
  };

  // Commit Pasted Rows to Supabase & Local State (Strictly Appended to the end without overwriting)
  const handleCommitPastedRows = async () => {
    if (pastedRows.length === 0) {
      showToast('Data Kosong', 'Tidak ada data hasil copy-paste untuk disimpan.', 'warning');
      return;
    }

    const validRows = pastedRows.filter(r => r.item_code || r.item_name);
    if (validRows.length === 0) {
      showToast('Data Belum Lengkap', 'Setiap baris harus memiliki minimal Kode Barang atau Nama Barang.', 'warning');
      return;
    }

    // Recalculate unique sequential IDs starting after current penyiapanList to guarantee strictly appending after the last row
    const existingIds拼 = new Set(penyiapanList.map(p => (p.id_penyiapan || '').trim().toLowerCase()));
    const nowIso = new Date().toISOString();
    const dateStrPrefix = nowIso.slice(0, 10).replace(/-/g, '');

    let maxSeq = 0;
    const prefixRegex = new RegExp(`^PEN-${dateStrPrefix}-(\\d+)$`, 'i');
    for (const item of penyiapanList) {
      const match = (item.id_penyiapan || '').match(prefixRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    if (maxSeq === 0 && penyiapanList.length > 0) {
      maxSeq = penyiapanList.length;
    }

    let runningSeq = maxSeq;

    const finalUploadRows: PenyiapanItem[] = validRows.map(row => {
      runningSeq++;
      let finalId = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
      while (existingIds拼.has(finalId.toLowerCase())) {
        runningSeq++;
        finalId = `PEN-${dateStrPrefix}-${String(runningSeq).padStart(5, '0')}`;
      }
      existingIds拼.add(finalId.toLowerCase());

      // Ensure Tujuan priority: Take Set Massal Tujuan if set, otherwise row's tujuan sanitized from batch
      let finalTujuan = row.tujuan ? row.tujuan.trim() : '';
      if (pasteDefaultTujuan && pasteDefaultTujuan.trim()) {
        finalTujuan = pasteDefaultTujuan.trim();
      } else if (!finalTujuan || finalTujuan === '-' || (row.batch && row.batch !== '-' && finalTujuan === row.batch.trim())) {
        finalTujuan = pasteDefaultTujuan ? pasteDefaultTujuan.trim() : '';
      }

      return {
        ...row,
        id_penyiapan: finalId,
        tujuan: finalTujuan,
        user_input: currentUser?.nama || row.user_input || 'User',
        created_at: nowIso
      };
    });

    setIsSavingPastedRows(true);
    setPasteSaveProgress({
      current: 0,
      total: finalUploadRows.length,
      percentage: 0,
      statusText: 'Mempersiapkan data penyiapan...'
    });

    try {
      // 1. Strictly append to local list (Lanjut dari baris akhir, tidak tertimpa)
      const finalMerged = [...penyiapanList, ...finalUploadRows];
      setPenyiapanList(finalMerged);

      // 2. Persist to Supabase with chunk size 500 & live progress indicator
      if (isSupabaseConfigured) {
        setPasteSaveProgress(prev => ({
          ...prev,
          statusText: `Menyimpan ${finalUploadRows.length.toLocaleString('id-ID')} baris data ke Database Supabase...`
        }));

        const { successCount, error } = await safeBatchUpsertPenyiapan(
          finalUploadRows,
          500,
          (processed, total) => {
            const pct = Math.round((processed / total) * 100);
            setPasteSaveProgress({
              current: processed,
              total,
              percentage: pct,
              statusText: `Menyimpan ${processed.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} baris (${pct}%)...`
            });
          }
        );

        if (error && successCount === 0) {
          showToast('Peringatan Database', `Tersimpan di memori lokal, namun gagal sync ke cloud: ${error.message}`, 'warning');
        } else {
          setPasteSaveProgress({
            current: finalUploadRows.length,
            total: finalUploadRows.length,
            percentage: 100,
            statusText: 'Data berhasil disimpan ke baris akhir!'
          });
          showToast('Data Ditambahkan!', `${finalUploadRows.length} data penyiapan dari copy-paste Excel berhasil ditambahkan ke baris terakhir!`, 'success');
          await fetchPenyiapanData(true);
        }
      } else {
        showToast('Tersimpan Lokal', `${finalUploadRows.length} data penyiapan berhasil ditambahkan ke baris terakhir!`, 'success');
      }

      if (pasteDefaultTujuan.trim()) {
        setTujuanFilter(pasteDefaultTujuan.trim());
        setCurrentPage(1);
      }

      setTimeout(() => {
        setShowPasteModal(false);
        setPastedRawText('');
        setPastedRows([]);
        setIsSavingPastedRows(false);
        setPasteSaveProgress({ current: 0, total: 0, percentage: 0, statusText: '' });
      }, 400);
    } catch (err: any) {
      console.error('Error committing pasted rows:', err);
      showToast('Gagal Menyimpan', err?.message || 'Terjadi kesalahan saat menyimpan data.', 'danger');
      setIsSavingPastedRows(false);
    }
  };

  // Helper copy text
  const handleCopyText = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast('Tersalin', `${label} "${text}" disalin ke clipboard`, 'info');
  };

  // Google Sheets Config & Sync Handlers
  const handleSaveGSheetConfig = (newConfig: typeof gSheetConfig) => {
    setGSheetConfig(newConfig);
    try {
      localStorage.setItem('PENYIAPAN_GSHEET_WEBHOOK_CONFIG', JSON.stringify(newConfig));
      localStorage.setItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG', JSON.stringify(newConfig));
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
      'gsheet_sync_config_penyiapan',
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

    const itemsToSync = filteredPenyiapan.length > 0 ? filteredPenyiapan : penyiapanList;
    if (itemsToSync.length === 0) {
      showToast('Data Kosong', 'Tidak ada data penyiapan untuk dikirim ke Google Sheets.', 'warning');
      return;
    }

    setIsSyncingGSheet(true);
    setGSheetSyncResult(null);

    try {
      const headers = [
        'ID Penyiapan',
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
        item.id_penyiapan || '-',
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
        action: 'sync_penyiapan',
        mode: gSheetConfig.mode || 'overwrite',
        sheetName: gSheetConfig.sheetName || 'Penyiapan',
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
              message: `Data ${itemsToSync.length} baris penyiapan berhasil dikirim ke Google Apps Script Webhook.`
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
        ? `Berhasil mengirim ${updatedCount} baris data ke Google Apps Script (Sheet: "${gSheetConfig.sheetName || 'Penyiapan'}").`
        : (responseJson?.message || `Berhasil sinkronisasi ${updatedCount} baris data ke Google Sheet "${gSheetConfig.sheetName || 'Penyiapan'}"!`);

      setGSheetSyncResult({
        success: true,
        message: successMsg,
        spreadsheetUrl: sheetUrl,
        updatedRows: updatedCount,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      showToast('Sinkronisasi Berhasil', `Berhasil upload ${updatedCount} data penyiapan ke Google Sheets!`, 'success');
    } catch (err: any) {
      console.error('Penyiapan GSheet sync error:', err);
      const isGoogleUrl = gSheetConfig.webhookUrl?.includes('script.google.com');
      const guidance = isGoogleUrl
        ? 'Pastikan Deployment Web App di Google Apps Script telah diset "Who has access: Anyone" (Siapa saja).'
        : 'Pastikan URL Webhook / Cloudflare Worker aktif dan dapat diakses.';

      setGSheetSyncResult({
        success: false,
        message: `${err?.message || 'Gagal menghubungi Webhook'}. ${guidance}`
      });
      showToast('Gagal Sinkronisasi', err?.message || 'Gagal mengirim data ke Google Sheets', 'danger');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 animate-fade-in text-slate-800">
      
      {/* ========================================================================= */}
      {/* ACTION TOOLBAR BUTTONS - Only shown on Desktop (hidden on Mobile & Tablet) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex-wrap items-center justify-between gap-1.5">
        
        {/* Left Side: CRUD & Import Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tambah Data (Langsung Copy-Paste dari Excel / Multi SKU) */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Tambah Data Penyiapan (Langsung Paste dari Excel / Spreadsheet)"
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

          {/* Tombol Sinkron ke Google Sheets */}
          <button
            type="button"
            onClick={() => setShowGSheetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Kirim dan sinkronkan data penyiapan ke Google Sheets (Sheet: Penyiapan)"
          >
            <Share2 size={13} />
            <span>Sync Google Sheets</span>
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
      {/* STATUS FILTER KPI CARDS (Hanya Muncul di Mode Desktop, Hidden di Mobile) */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-5 gap-2">
        {/* Card 1: Semua Status */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
          title="Tampilkan semua data penyiapan"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-tight">
            <span>Semua Data</span>
            <Package size={13} className="text-blue-700" />
          </div>
          <div className="text-base font-black text-slate-900 font-mono mt-0.5">
            {statusStats.total.toLocaleString('id-ID')}
          </div>
        </button>

        {/* Card 2: Belum Ada Status */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(prev => prev === 'BELUM_ADA_STATUS' ? 'ALL' : 'BELUM_ADA_STATUS');
            setCurrentPage(1);
          }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'BELUM_ADA_STATUS'
              ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-500/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
          title="Klik untuk memfilter data yang belum memiliki status (kosong / belum dicek)"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 uppercase tracking-tight">
            <span>Belum Ada Status</span>
            <Clock size={13} className="text-amber-700" />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-base font-black text-amber-950 font-mono">
              {statusStats.belumAda.toLocaleString('id-ID')}
            </span>
            {statusStats.belumAda > 0 && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900">
                Pending
              </span>
            )}
          </div>
        </button>

        {/* Card 3: Status Ada */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(prev => prev.toLowerCase() === 'ada' ? 'ALL' : 'Ada');
            setCurrentPage(1);
          }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'ada'
              ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-500/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
          title="Filter data berstatus 'Ada'"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 uppercase tracking-tight">
            <span>Status "Ada"</span>
            <CheckCircle2 size={13} className="text-emerald-700" />
          </div>
          <div className="text-base font-black text-emerald-950 font-mono mt-0.5">
            {statusStats.ada.toLocaleString('id-ID')}
          </div>
        </button>

        {/* Card 4: Status Beda */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(prev => prev.toLowerCase() === 'beda' ? 'ALL' : 'Beda');
            setCurrentPage(1);
          }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'beda'
              ? 'bg-blue-100/90 border-blue-400 ring-2 ring-blue-500/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
          title="Filter data berstatus 'Beda'"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 uppercase tracking-tight">
            <span>Status "Beda"</span>
            <AlertTriangle size={13} className="text-blue-700" />
          </div>
          <div className="text-base font-black text-blue-950 font-mono mt-0.5">
            {statusStats.beda.toLocaleString('id-ID')}
          </div>
        </button>

        {/* Card 5: Status Tidak */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(prev => prev.toLowerCase() === 'tidak' ? 'ALL' : 'Tidak');
            setCurrentPage(1);
          }}
          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter.toLowerCase() === 'tidak'
              ? 'bg-rose-100/90 border-rose-400 ring-2 ring-rose-500/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
          title="Filter data berstatus 'Tidak'"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-900 uppercase tracking-tight">
            <span>Status "Tidak"</span>
            <XCircle size={13} className="text-rose-700" />
          </div>
          <div className="text-base font-black text-rose-950 font-mono mt-0.5">
            {statusStats.tidak.toLocaleString('id-ID')}
          </div>
        </button>
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

        {/* Filter Dropdowns (Nama Barang, Lokasi, Status Penyiapan, & Tujuan Penyiapan) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Filter Nama Barang / SKU */}
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nama Barang / SKU</label>
            <div className="relative flex items-center">
              <input
                list="itemname-options"
                value={itemNameFilter}
                onChange={(e) => {
                  setItemNameFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari / Pilih Nama Barang..."
                className="w-full p-1.5 pr-6 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-slate-700"
              />
              {itemNameFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setItemNameFilter('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Hapus Filter Nama Barang"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <datalist id="itemname-options">
              {uniqueItemNamesList.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

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
            <div className="relative flex items-center">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full p-1.5 rounded-lg border text-xs font-bold transition-all ${
                  statusFilter === 'BELUM_ADA_STATUS' || statusFilter === 'UNCHECKED'
                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-black'
                    : statusFilter.toLowerCase() === 'ada'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900 font-black'
                    : statusFilter.toLowerCase() === 'beda'
                    ? 'border-blue-400 bg-blue-50 text-blue-900 font-black'
                    : statusFilter.toLowerCase() === 'tidak'
                    ? 'border-rose-400 bg-rose-50 text-rose-900 font-black'
                    : statusFilter !== 'ALL'
                    ? 'border-purple-400 bg-purple-50 text-purple-900 font-black'
                    : 'border-slate-200 bg-slate-50 focus:bg-white text-slate-700'
                } pr-6`}
              >
                <option value="ALL">Semua Status ({statusStats.total})</option>
                <option value="BELUM_ADA_STATUS">⏳ Belum Ada Status ({statusStats.belumAda})</option>
                <option value="Ada">✓ Ada ({statusStats.ada})</option>
                <option value="Beda">⚡ Beda ({statusStats.beda})</option>
                <option value="Tidak">✕ Tidak ({statusStats.tidak})</option>
                {otherStatuses.map(st => (
                  <option key={st} value={st}>{st} ({statusStats.others[st] || 0})</option>
                ))}
              </select>
              {statusFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Clear Filter Status"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tujuan Penyiapan */}
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Tujuan Penyiapan</label>
            <div className="relative flex items-center">
              <select
                value={tujuanFilter}
                onChange={(e) => {
                  setTujuanFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-blue-900 pr-6"
              >
                <option value="ALL">Semua Tujuan</option>
                {uniqueTujuanList.map(tuj => (
                  <option key={tuj} value={tuj}>{tuj}</option>
                ))}
              </select>
              {tujuanFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setTujuanFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Clear Filter Tujuan"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter & Sorting Badges */}
        {(hasActiveFilters || sortField !== null) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Filter size={12} className="text-blue-900" />
              Filter & Urutan Aktif:
            </span>

            {/* Active Sort Badge */}
            {sortField !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-300">
                <ArrowUpDown size={11} className="text-indigo-600" />
                <span>
                  Urutan:{' '}
                  {sortField === 'location_then_name'
                    ? 'Lokasi & Nama Barang'
                    : sortField === 'location'
                    ? 'Lokasi'
                    : sortField === 'item_name'
                    ? 'Nama Barang'
                    : sortField === 'last_qty'
                    ? 'Last Qty'
                    : sortField === 'qty_convert'
                    ? 'Qty Convert'
                    : sortField === 'uom'
                    ? 'Uom'
                    : sortField === 'expired_date'
                    ? 'Expired Date'
                    : sortField === 'batch'
                    ? 'Batch'
                    : sortField}{' '}
                  ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSortField(null);
                    setSortOrder('asc');
                  }}
                  className="hover:text-rose-600 cursor-pointer ml-0.5"
                  title="Kembalikan ke urutan asli tanpa sort"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {itemNameFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold border border-emerald-200">
                <Package size={11} className="text-emerald-700" />
                <span>Barang: "{itemNameFilter}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setItemNameFilter('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-emerald-700 cursor-pointer"
                  title="Hapus filter nama barang"
                >
                  <X size={12} />
                </button>
              </span>
            )}

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
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                statusFilter === 'BELUM_ADA_STATUS' || statusFilter === 'UNCHECKED'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : statusFilter.toLowerCase() === 'ada'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : statusFilter.toLowerCase() === 'beda'
                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                  : statusFilter.toLowerCase() === 'tidak'
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : 'bg-purple-100 text-purple-900 border border-purple-300'
              }`}>
                <span>
                  Status:{' '}
                  {statusFilter === 'BELUM_ADA_STATUS' || statusFilter === 'UNCHECKED'
                    ? 'Belum Ada Status'
                    : statusFilter}
                </span>
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

            {tujuanFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[11px] font-bold border border-blue-200">
                <Target size={11} className="text-blue-700" />
                <span>Tujuan: {tujuanFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTujuanFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-blue-700 cursor-pointer"
                  title="Hapus filter tujuan"
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
              Reset Semua Filter & Urutan
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BULK ACTION & KPI SUMMARY CARDS KETIKA PILIH BARIS */}
      {/* ========================================================================= */}
      {selectedSummary && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2 animate-fade-in">
          {/* Header Action & Selection Info */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 text-[11px] font-extrabold border border-blue-200">
                <CheckCheck size={13} className="text-blue-700" />
                <span>{selectedSummary.selectedCount} Baris Terpilih</span>
              </span>
              {selectedSummary.distinctSkuCount > 0 && (
                <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                  • {selectedSummary.distinctSkuCount} SKU • {selectedSummary.distinctBatchCount} Batch • {selectedSummary.distinctLocationCount} Lokasi
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {/* Set Status Ada Direct Button */}
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('Ada')}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ubah status semua baris terpilih menjadi 'Ada'"
              >
                <Check size={12} className="text-emerald-700" />
                <span>Set "Ada"</span>
              </button>

              {/* Pindah Data Massal Button */}
              <button
                type="button"
                onClick={handleOpenBulkTransferModal}
                className="px-2.5 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                title="Buka dialog transfer massal untuk baris terpilih"
              >
                <Share2 size={12} />
                <span>Pindah Massal ({selectedSummary.selectedCount})</span>
              </button>

              {/* Hapus Terpilih Button (Khusus Admin) */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleBulkDeletePenyiapan}
                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="Hapus baris penyiapan terpilih (Khusus Admin)"
                >
                  <Trash2 size={12} />
                  <span>Hapus</span>
                </button>
              )}

              {/* Clear Selection */}
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Batalkan semua pilihan"
              >
                <X size={12} />
                <span>Batal</span>
              </button>
            </div>
          </div>

          {/* Simple Small Lightweight KPI Cards (Total Baris, Total Last Qty, Total Qty Convert) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Card 1: Total Baris */}
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                  Total Baris
                </span>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono leading-tight mt-0.5">
                  {selectedSummary.selectedCount.toLocaleString('id-ID')}
                  <span className="text-[10px] font-semibold text-slate-500 ml-1">
                    / {selectedSummary.totalRows.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-slate-200/70 text-slate-700 flex items-center justify-center shrink-0">
                <Layers size={13} />
              </div>
            </div>

            {/* Card 2: Total Last Qty */}
            <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-tight block">
                  Total Last Qty
                </span>
                <div className="text-xs sm:text-sm font-extrabold text-blue-900 font-mono leading-tight mt-0.5">
                  {selectedSummary.totalLastQty.toLocaleString('id-ID')}
                  <span className="text-[10px] font-bold text-blue-700 ml-1">
                    {selectedSummary.displayUom}
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <Package size={13} />
              </div>
            </div>

            {/* Card 3: Total Qty Convert */}
            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight block">
                  Total Qty Convert
                </span>
                <div className="text-xs sm:text-sm font-extrabold text-emerald-900 font-mono leading-tight mt-0.5">
                  {selectedSummary.totalQtyConvert.toLocaleString('id-ID')}
                  <span className="text-[10px] font-bold text-emerald-700 ml-1">
                    {selectedSummary.displayUomConvert}
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Boxes size={13} />
              </div>
            </div>
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
                <th className="px-2 py-1.5 text-center sticky left-0 bg-slate-100 z-10 w-24">Status</th>
                {!isLocationFiltered && (
                  <th onClick={() => handleSort('location')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'location' ? 'bg-indigo-50/80 text-indigo-950 font-black' : ''}`}>
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      {sortField === 'location' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp size={12} className="text-indigo-700 font-black" />
                        ) : (
                          <ArrowDown size={12} className="text-indigo-700 font-black" />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('item_name')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'item_name' ? 'bg-blue-50/80 text-blue-950 font-black' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span>Item Name</span>
                    {sortField === 'item_name' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-blue-700 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-blue-700 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('last_qty')} className={`px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'last_qty' ? 'bg-slate-200/80 text-slate-950 font-black' : ''}`}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Qty</span>
                    {sortField === 'last_qty' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-slate-900 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-slate-900 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('qty_convert')} className={`px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'qty_convert' ? 'bg-blue-100/80 text-blue-950 font-black' : ''}`}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Qty Convert</span>
                    {sortField === 'qty_convert' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-blue-900 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-blue-900 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('batch')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'batch' ? 'bg-slate-200/80 text-slate-950 font-black' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span>Batch</span>
                    {sortField === 'batch' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-slate-900 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-slate-900 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('expired_date')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'expired_date' ? 'bg-slate-200/80 text-slate-950 font-black' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span>Expired Date</span>
                    {sortField === 'expired_date' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-slate-900 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-slate-900 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('note')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'note' ? 'bg-slate-200/80 text-slate-950 font-black' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span>Note</span>
                    {sortField === 'note' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-slate-900 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-slate-900 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('tujuan')} className={`px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 transition-colors ${sortField === 'tujuan' ? 'bg-blue-50/80 text-blue-950 font-black' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span>Tujuan</span>
                    {sortField === 'tujuan' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-blue-700 font-black" />
                      ) : (
                        <ArrowDown size={12} className="text-blue-700 font-black" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400" />
                    )}
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
                  const statusKey = (item.status || '').toLowerCase().trim();
                  const isAda = statusKey === 'ada';
                  const isBeda = statusKey === 'beda';
                  const isTidak = statusKey === 'tidak';

                  // Row background based on Status & Selection
                  let rowBgClass = 'hover:bg-blue-50/40';
                  let stickyCellBgClass = 'bg-white group-hover:bg-slate-50';
                  let locationCellClass = 'text-slate-700';
                  let locationIconClass = 'text-slate-400';
                  let itemNameClass = 'text-slate-800';

                  if (isItemSelected) {
                    rowBgClass = isAda
                      ? 'bg-emerald-100/80 hover:bg-emerald-200/70 font-semibold'
                      : isBeda
                      ? 'bg-blue-100/80 hover:bg-blue-200/70 font-semibold'
                      : isTidak
                      ? 'bg-amber-100/80 hover:bg-amber-200/70 font-semibold'
                      : 'bg-blue-50/80 hover:bg-blue-100/70 font-semibold';
                    stickyCellBgClass = isAda
                      ? 'bg-emerald-100 group-hover:bg-emerald-200/80'
                      : isBeda
                      ? 'bg-blue-100 group-hover:bg-blue-200/80'
                      : isTidak
                      ? 'bg-amber-100 group-hover:bg-amber-200/80'
                      : 'bg-blue-50 group-hover:bg-blue-100/80';
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
                      key={item.id_penyiapan || index}
                      onClick={() => handleOpenEditModal(item)}
                      className={`transition-colors group cursor-pointer ${rowBgClass}`}
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

                      {/* Status Sticky Column */}
                      <td 
                        className={`px-1.5 py-1 text-center sticky left-0 transition-colors z-10 shadow-2xs border-r border-slate-100 ${stickyCellBgClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.status || ''}
                          onChange={(e) => handleUpdateStatus(item, e.target.value)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold border outline-none cursor-pointer text-center appearance-none w-full shadow-2xs ${
                            isAda ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/50' :
                            isBeda ? 'bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-400/50' :
                            isTidak ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-400/50' :
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
                        <td className={`px-2.5 py-1.5 font-bold text-xs min-w-[100px] rounded-sm ${locationCellClass}`}>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className={`shrink-0 ${locationIconClass}`} />
                            <span>{item.location || '-'}</span>
                          </div>
                        </td>
                      )}

                      {/* Item Name */}
                      <td className={`px-2.5 py-1.5 min-w-[180px] max-w-xs ${isAda ? 'bg-emerald-50/40' : isBeda ? 'bg-blue-50/40' : isTidak ? 'bg-amber-50/40' : ''}`}>
                        <div className={`text-xs truncate ${itemNameClass}`} title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>

                      {/* Last Qty */}
                      <td className="px-2.5 py-1.5 text-right min-w-[80px]">
                        <span className="font-mono font-black text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200/60 text-xs inline-block">
                          {Number(item.last_qty || 0).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Qty Convert */}
                      <td className="px-2.5 py-1.5 text-right min-w-[85px]">
                        <div className="inline-flex items-center gap-1 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/60">
                          <span className="font-mono font-black text-blue-900 text-xs">
                            {Number(item.qty_convert ?? item.last_qty ?? 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 uppercase">
                            {item.uom_convert || 'PCS'}
                          </span>
                        </div>
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

                      {/* Tujuan (Kolom Paling Ujung Setelah Note) */}
                      <td className="px-2.5 py-1.5 min-w-[130px] max-w-xs text-xs">
                        {item.tujuan ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 text-blue-900 border border-blue-200" title={item.tujuan}>
                            {item.tujuan}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
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

            {/* Quick Switch to Copy-Paste Excel Mode (Role User & Admin) */}
            {!isEditMode && (
              <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-indigo-900 text-xs">
                  <ClipboardPaste size={15} className="text-indigo-600 shrink-0" />
                  <span className="font-medium">
                    Ingin input banyak SKU sekaligus dari Excel? Gunakan fitur <strong>Copy-Paste dari Excel</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    handleOpenPasteModal();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <ClipboardPaste size={12} />
                  <span>Buka Mode Copy-Paste Multi SKU</span>
                </button>
              </div>
            )}

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
                      value={formData.status || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer outline-none ${
                        (formData.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        (formData.status || '').toLowerCase() === 'beda' ? 'bg-blue-100 text-blue-900 border-blue-400 font-extrabold' :
                        (formData.status || '').toLowerCase() === 'tidak' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <option value="">- Belum Ada Status (Kosong) -</option>
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

                {/* Input Tujuan Penyiapan */}
                <div className="pt-2 border-t border-slate-200/80">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Tujuan Penyiapan (Tujuan Pengiriman / Alokasi)
                  </label>
                  <input
                    type="text"
                    list="modal-form-tujuan-suggestions"
                    value={formData.tujuan || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, tujuan: e.target.value }))}
                    placeholder="Contoh: SPK Reguler, Pesanan Cabang Surabaya, Order Toko A..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-800 placeholder:text-slate-400"
                  />
                  <datalist id="modal-form-tujuan-suggestions">
                    {uniqueTujuanList.map(t => (
                      <option key={t} value={t} />
                    ))}
                    <option value="SPK Reguler" />
                    <option value="Pesanan Cabang" />
                    <option value="Order Toko" />
                    <option value="Transfer Depo" />
                    <option value="Buffer Picking" />
                  </datalist>
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
              {/* Step 1: Isi Tujuan Upload Penyiapan */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white font-black text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <label className="text-xs font-black text-blue-950 uppercase tracking-tight">
                      Tentukan Tujuan Penyiapan
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="text"
                    list="excel-upload-tujuan-datalist"
                    value={excelUploadTujuan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExcelUploadTujuan(val);
                      if (parsedExcelRows.length > 0) {
                        setParsedExcelRows(prev => prev.map(r => ({
                          ...r,
                          tujuan: val.trim() || r.tujuan
                        })));
                      }
                    }}
                    placeholder="Ketik tujuan penyiapan..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-blue-300 bg-white font-bold text-xs text-blue-950 focus:ring-2 focus:ring-blue-600 outline-none shadow-xs"
                  />
                  <datalist id="excel-upload-tujuan-datalist">
                    {uniqueTujuanList.map(t => (
                      <option key={t} value={t} />
                    ))}
                    <option value="SPK Reguler" />
                    <option value="Pesanan Cabang" />
                    <option value="Order Toko" />
                    <option value="Transfer Depo" />
                    <option value="Buffer Picking" />
                    <option value="Relokasi Gudang" />
                  </datalist>
                </div>

                {/* Quick preset chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-bold text-slate-500">Pilihan:</span>
                  {['SPK Reguler', 'Pesanan Cabang', 'Order Toko', 'Transfer Depo', 'Buffer Picking'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setExcelUploadTujuan(preset);
                        if (parsedExcelRows.length > 0) {
                          setParsedExcelRows(prev => prev.map(r => ({
                            ...r,
                            tujuan: preset
                          })));
                        }
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        excelUploadTujuan === preset
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100/70'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Dropzone Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-black text-[11px] flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                    Pilih File Excel (.xlsx / .xls / .csv)
                  </span>
                </div>

                {/* Upload Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/70 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                    <Upload size={20} />
                  </div>
                  <div>
                    <span className="font-black text-slate-800 text-xs sm:text-sm block">
                      {excelFileName ? excelFileName : 'Klik atau Tarik File Excel ke Sini'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Parsed Rows */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-700 text-white font-black text-[11px] flex items-center justify-center">
                        3
                      </span>
                      <span>Pratinjau ({parsedExcelRows.length} Baris)</span>
                    </div>
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
                          <th className="p-2 bg-blue-50 text-blue-900">Tujuan</th>
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
                            <td className="p-2 font-bold text-blue-900 bg-blue-50/50">
                              {r.tujuan || excelUploadTujuan || '-'}
                            </td>
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

              {/* Upload Progress Bar Indicator */}
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
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
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
                      : `Simpan ${parsedExcelRows.length.toLocaleString('id-ID')} Data`}
                  </span>
                </button>
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
                    {selectedItem.category || '-'}
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

                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 col-span-2 sm:col-span-3">
                  <span className="text-[10px] text-blue-900 font-bold block uppercase">Tujuan Penyiapan</span>
                  <span className="font-bold text-blue-950 text-xs">{selectedItem.tujuan || '-'}</span>
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
                    {selectedItem.status || 'Belum Ada Status'}
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
                    value={pemusnahanFormData.location || ''}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, location: e.target.value })}
                    placeholder="Sesuai data penyiapan / masukkan lokasi"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLOC Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.sloc || ''}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, sloc: e.target.value })}
                    placeholder="Sesuai data penyiapan"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status QC</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.qc_code || ''}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, qc_code: e.target.value })}
                    placeholder="Sesuai data penyiapan"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Row 3: Destinasi & Tujuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tempat / Destinasi Pemusnahan</label>
                  <input
                    type="text"
                    value={pemusnahanFormData.destination_code || ''}
                    onChange={(e) => setPemusnahanFormData({ ...pemusnahanFormData, destination_code: e.target.value })}
                    placeholder="Sesuai data penyiapan (opsional)"
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
                               dest.id === 'reco' ? <ClipboardList size={15} className={isSelected ? 'text-purple-300' : ''} /> :
                               <Boxes size={15} className={isSelected ? 'text-amber-300' : ''} />}
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
                  <span>Konfigurasi Parameter Target (Disesuaikan dari Tabel Penyiapan):</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">
                      <span>Tujuan / Deskripsi Transaksi</span>
                      <span className="text-[9px] font-normal text-slate-400 ml-1">(Dari Tabel Penyiapan)</span>
                    </label>
                    <input
                      type="text"
                      value={bulkFormData.tujuan || ''}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, tujuan: e.target.value })}
                      placeholder="Sesuaikan tujuan transaksi jika perlu..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">
                      <span>Status di Database Tujuan</span>
                      <span className="text-[9px] font-normal text-slate-400 ml-1">(Dikosongkan)</span>
                    </label>
                    <input
                      type="text"
                      value={bulkFormData.target_status || ''}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, target_status: e.target.value })}
                      placeholder="Kosong (biarkan kosong)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-blue-900 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">
                    <span>Catatan (Note)</span>
                    <span className="text-[9px] font-normal text-slate-400 ml-1">(Dari Tabel Penyiapan)</span>
                  </label>
                  <input
                    type="text"
                    value={bulkFormData.note || ''}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, note: e.target.value })}
                    placeholder="Sesuaikan catatan jika perlu..."
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

                  {isSuperAdmin && (
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
                  )}

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
                        <th className="p-2">Tujuan (Penyiapan)</th>
                        <th className="p-2">Catatan Note</th>
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
                          <td className="p-2 font-medium text-blue-900 max-w-[150px] truncate">{item.tujuan || '-'}</td>
                          <td className="p-2 text-slate-600 max-w-[150px] truncate">{item.note || '-'}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              (item.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800' :
                              (item.status || '').toLowerCase() === 'beda' ? 'bg-blue-100 text-blue-800' :
                              (item.status || '').toLowerCase() === 'tidak' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.status || '-'}
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

      {/* ========================================================================= */}
      {/* 8. MODAL SINKRONISASI GOOGLE SHEETS / CLOUDFLARE WORKER */}
      {/* ========================================================================= */}
      {showGSheetModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Share2 size={20} className="text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Sinkronisasi ke Google Sheets</h3>
                  <p className="text-xs text-emerald-200 leading-tight">
                    Kirim data Penyiapan ke Google Spreadsheet via Webhook / Cloudflare Worker
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGSheetModal(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {/* Data Summary Card */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={20} className="text-emerald-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800">
                      Total Data Siap Dikirim
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Tab Target: <span className="font-bold font-mono text-emerald-900">{gSheetConfig.sheetName || 'Penyiapan'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-emerald-900">
                    {(filteredPenyiapan.length > 0 ? filteredPenyiapan.length : penyiapanList.length).toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Baris Data</div>
                </div>
              </div>

              {/* Status Webhook Active Badge */}
              {gSheetConfig.webhookUrl ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>URL Webhook Terhubung</span>
                      {isConfigFromSupabase && (
                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">
                          Cloud Config
                        </span>
                      )}
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
                        placeholder="Penyiapan"
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 m-0">
                        Nama lembar kerja target (default: <span className="font-mono">Penyiapan</span>).
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
                        value={gSheetConfig.mode}
                        onChange={e => setGSheetConfig({ ...gSheetConfig, mode: e.target.value as any })}
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer transition-all"
                      >
                        <option value="overwrite">🔄 Replace / Overwrite (Ganti Semua)</option>
                        <option value="append">➕ Append (Tambah di Bawah)</option>
                      </select>
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
                    <span>Sedang Mengirim ke Google Sheet...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Kirim Data Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: COPY-PASTE DARI EXCEL & DATABASE (ROLE USER & ADMIN) */}
      {/* Kolom Sesuai Database data_penyiapan & Ditambahkan Setelah Baris Terakhir */}
      {/* ========================================================================= */}
      {showPasteModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shadow-inner">
                  <ClipboardPaste size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-tight m-0">
                      Tambah Data Penyiapan (Paste dari Excel)
                    </h3>
                  </div>
                  <p className="text-[11px] text-indigo-200 m-0 font-medium">
                    Tempel data dari Excel / Spreadsheet. Data akan otomatis ditambahkan setelah baris terakhir.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasteModal(false);
                    setShowFormModal(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title="Beralih ke form input manual 1 SKU"
                >
                  <Plus size={12} />
                  <span>Input Form Manual</span>
                </button>

                <button
                  onClick={() => setShowPasteModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              
              {/* Format Presets & Action Toolbar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-600" />
                      <span>Format:</span>
                    </span>

                    {/* Format Selector */}
                    <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setPasteFormatPreset('auto');
                          if (pastedRawText) parsePastedText(pastedRawText, pasteHasHeader, 'auto');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          pasteFormatPreset === 'auto'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Deteksi otomatis"
                      >
                        ⚡ Auto-Detect
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasteFormatPreset('db_full');
                          if (pastedRawText) parsePastedText(pastedRawText, pasteHasHeader, 'db_full');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          pasteFormatPreset === 'db_full'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Format Tabel Database"
                      >
                        📦 Tabel Database (23 Kolom)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasteFormatPreset('form_sku');
                          if (pastedRawText) parsePastedText(pastedRawText, pasteHasHeader, 'form_sku');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          pasteFormatPreset === 'form_sku'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Format Ringkas 13 Kolom"
                      >
                        📋 Form Ringkas (13 Kolom)
                      </button>
                    </div>
                  </div>

                  {/* Actions & Templates */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyPasteTemplateHeader('db_full')}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="Salin deretan header database"
                    >
                      <Copy size={12} className="text-indigo-600" />
                      <span>Salin Header DB</span>
                    </button>

                    {pastedRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          setPastedRawText('');
                          setPastedRows([]);
                        }}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Kosongkan teks dan data preview"
                      >
                        <Trash2 size={11} />
                        <span>Bersihkan</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Area Tempel / Paste Teks dari Excel:</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pasteHasHeader}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPasteHasHeader(val);
                          if (pastedRawText) {
                            parsePastedText(pastedRawText, val);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Baris Pertama Memuat Header</span>
                    </label>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={pastedRawText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setPastedRawText(txt);
                    parsePastedText(txt, pasteHasHeader);
                  }}
                  placeholder="Tempel / Paste data baris dari Excel di sini..."
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-[11px] leading-relaxed bg-white text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 placeholder:text-slate-400 resize-y shadow-inner"
                />
              </div>

              {/* Batch Settings Bar (Apply default Tujuan, Status, Lokasi to all parsed rows) */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-indigo-950 uppercase">Set Massal:</span>
                  </div>

                  {/* Batch Tujuan */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tujuan:</label>
                    <input
                      type="text"
                      list="paste-modal-tujuan-list"
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
                      placeholder="Contoh: SPK Reguler..."
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 text-xs w-36 sm:w-44"
                    />
                    <datalist id="paste-modal-tujuan-list">
                      {uniqueTujuanList.map(t => (
                        <option key={t} value={t} />
                      ))}
                      <option value="SPK Reguler" />
                      <option value="Pesanan Cabang" />
                      <option value="Order Toko" />
                      <option value="Transfer Depo" />
                      <option value="Buffer Picking" />
                    </datalist>
                  </div>

                  {/* Batch Status */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Status:</label>
                    <select
                      value={pasteDefaultStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPasteDefaultStatus(val);
                        if (pastedRows.length > 0) {
                          setPastedRows(prev => prev.map(r => ({
                            ...r,
                            status: val
                          })));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                    >
                      <option value="">- Kosong (Belum Dicek) -</option>
                      <option value="Ada">Ada</option>
                      <option value="Beda">Beda</option>
                      <option value="Tidak">Tidak</option>
                    </select>
                  </div>

                  {/* Batch Location */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Lokasi:</label>
                    <input
                      type="text"
                      value={pasteDefaultLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPasteDefaultLocation(val);
                        if (val.trim() && pastedRows.length > 0) {
                          setPastedRows(prev => prev.map(r => ({
                            ...r,
                            location: val.trim()
                          })));
                        }
                      }}
                      placeholder="WH-B-01"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs w-28"
                    />
                  </div>
                </div>

                {pastedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleApplyBatchSettingsToPasted(pasteDefaultTujuan, pasteDefaultStatus, pasteDefaultLocation)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <Check size={12} />
                    <span>Terapkan ke {pastedRows.length} Baris di Bawah</span>
                  </button>
                )}
              </div>

              {/* Parsed Rows Preview Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs">
                      Preview Data Hasil Copy-Paste ({pastedRows.length} Baris Terdeteksi):
                    </span>
                    {pastedRows.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                        Siap Disimpan
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* View Switcher */}
                    {pastedRows.length > 0 && (
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPreviewColumnView('all_db')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            previewColumnView === 'all_db'
                              ? 'bg-white text-indigo-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🌟 Semua Kolom DB ({Object.keys(pastedRows[0] || {}).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewColumnView('compact')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            previewColumnView === 'compact'
                              ? 'bg-white text-indigo-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📋 Kolom Ringkas
                        </button>
                      </div>
                    )}

                    {/* Summary Metrics */}
                    {pastedRows.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200">
                          Total SKU: <span className="text-indigo-700">{new Set(pastedRows.map(r => r.item_code)).size}</span>
                        </div>
                        <div className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold border border-emerald-200">
                          Total Qty CTN: <span className="text-emerald-700">{pastedRows.reduce((a, b) => a + (Number(b.last_qty) || 0), 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-mono text-[11px] font-bold border border-blue-200">
                          Total Qty PCS: <span className="text-blue-700">{pastedRows.reduce((a, b) => a + (Number(b.qty_convert) || 0), 0).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table View */}
                {pastedRows.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                    <ClipboardPaste size={36} className="text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600 text-xs m-0">
                      Belum ada data yang dimasukkan
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mt-1">
                      Salin data dari Excel lalu paste pada kotak di atas.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[360px] overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[10px] uppercase font-black text-slate-600 tracking-wider">
                        <tr>
                          <th className="p-2 text-center w-10">No</th>
                          <th className="p-2 min-w-[110px]">Item Code</th>
                          <th className="p-2 min-w-[200px]">Item Name</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[110px]">Category</th>
                          )}
                          <th className="p-2 min-w-[90px]">Location (Lokasi)</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[90px]">Location Type</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 text-right min-w-[70px]">First Qty</th>
                          )}
                          <th className="p-2 text-right min-w-[70px]">Last Qty</th>
                          <th className="p-2 text-center min-w-[55px]">UOM</th>
                          <th className="p-2 text-right min-w-[80px]">Qty Convert</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 text-center min-w-[65px]">UOM Conv</th>
                          )}
                          <th className="p-2 min-w-[100px]">LPN / Serial</th>
                          <th className="p-2 min-w-[85px]">Batch</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[85px]">Vendor Batch</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[65px]">SLOC</th>
                          )}
                          <th className="p-2 min-w-[100px]">Expired Date</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[80px]">Dest Code</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[80px]">QC Code</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[90px]">User Tally</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[85px]">Shelf Life</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[90px]">Source</th>
                          )}
                          <th className="p-2 text-center min-w-[85px]">Status</th>
                          <th className="p-2 min-w-[130px]">Note</th>
                          <th className="p-2 min-w-[120px]">Tujuan</th>
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[90px]">User Input</th>
                          )}
                          {previewColumnView === 'all_db' && (
                            <th className="p-2 min-w-[130px]">ID Penyiapan</th>
                          )}
                          <th className="p-2 text-center w-10 sticky right-0 bg-slate-100">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-medium">
                        {pastedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2 text-center font-mono text-[10px] text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.item_code}
                                onChange={(e) => handleUpdatePastedRow(idx, 'item_code', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-mono font-bold text-indigo-950 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.item_name}
                                onChange={(e) => handleUpdatePastedRow(idx, 'item_name', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-semibold text-slate-800 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.category || ''}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'category', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-700 text-[11px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.location}
                                onChange={(e) => handleUpdatePastedRow(idx, 'location', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-bold text-slate-800 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.location_type || ''}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'location_type', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-700 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  value={row.first_qty}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'first_qty', Number(e.target.value))}
                                  className="w-full p-1 rounded border border-slate-200 font-mono text-slate-700 text-[11px] text-right bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5 text-right">
                              <input
                                type="number"
                                value={row.last_qty}
                                onChange={(e) => handleUpdatePastedRow(idx, 'last_qty', Number(e.target.value))}
                                className="w-full p-1 rounded border border-slate-200 font-mono font-black text-emerald-800 text-[11px] text-right bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                type="text"
                                value={row.uom}
                                onChange={(e) => handleUpdatePastedRow(idx, 'uom', e.target.value)}
                                className="w-14 p-1 rounded border border-slate-200 font-mono font-bold text-slate-700 text-[11px] text-center bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-1.5 text-right">
                              <input
                                type="number"
                                value={row.qty_convert}
                                onChange={(e) => handleUpdatePastedRow(idx, 'qty_convert', Number(e.target.value))}
                                className="w-full p-1 rounded border border-slate-200 font-mono font-black text-blue-900 text-[11px] text-right bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.uom_convert || 'PCS'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'uom_convert', e.target.value)}
                                  className="w-14 p-1 rounded border border-slate-200 font-mono text-slate-700 text-[10px] text-center bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.lpn_serial_number}
                                onChange={(e) => handleUpdatePastedRow(idx, 'lpn_serial_number', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-mono text-slate-700 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.batch}
                                onChange={(e) => handleUpdatePastedRow(idx, 'batch', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-mono font-bold text-amber-900 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.vendor_batch || '-'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'vendor_batch', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 font-mono text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.sloc || 'SL02'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'sloc', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 font-mono text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.expired_date}
                                onChange={(e) => handleUpdatePastedRow(idx, 'expired_date', e.target.value)}
                                className="w-full p-1 rounded border border-slate-200 font-mono text-slate-800 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.destination_code || 'DST-02'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'destination_code', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.qc_code || 'QC-PASS'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'qc_code', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.user_tally || ''}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'user_tally', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.shelf_life || '24 Bulan'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'shelf_life', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.source || 'Stok Gudang'}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'source', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5 text-center">
                              <select
                                value={row.status || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'status', e.target.value)}
                                className={`p-1 rounded text-[10px] font-extrabold border cursor-pointer ${
                                  (row.status || '').toLowerCase() === 'ada' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                  (row.status || '').toLowerCase() === 'beda' ? 'bg-blue-50 text-blue-900 border-blue-300' :
                                  (row.status || '').toLowerCase() === 'tidak' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                                  'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                <option value="">- Kosong -</option>
                                <option value="Ada">Ada</option>
                                <option value="Beda">Beda</option>
                                <option value="Tidak">Tidak</option>
                              </select>
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.note || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'note', e.target.value)}
                                placeholder="Catatan..."
                                className="w-full p-1 rounded border border-slate-200 text-slate-700 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.tujuan || ''}
                                onChange={(e) => handleUpdatePastedRow(idx, 'tujuan', e.target.value)}
                                placeholder="Tujuan..."
                                className="w-full p-1 rounded border border-slate-200 font-bold text-slate-800 text-[11px] bg-slate-50 focus:bg-white"
                              />
                            </td>
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.user_input || ''}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'user_input', e.target.value)}
                                  className="w-full p-1 rounded border border-slate-200 text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            {previewColumnView === 'all_db' && (
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.id_penyiapan || ''}
                                  onChange={(e) => handleUpdatePastedRow(idx, 'id_penyiapan', e.target.value)}
                                  placeholder="Auto ID"
                                  className="w-full p-1 rounded border border-slate-200 font-mono text-slate-600 text-[10px] bg-slate-50 focus:bg-white"
                                />
                              </td>
                            )}
                            <td className="p-1.5 text-center sticky right-0 bg-white shadow-l">
                              <button
                                type="button"
                                onClick={() => handleDeletePastedRow(idx)}
                                className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Hapus baris ini dari daftar"
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

              {/* Progress Bar while saving */}
              {isSavingPastedRows && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-indigo-600" />
                      <span>{pasteSaveProgress.statusText}</span>
                    </span>
                    <span>{pasteSaveProgress.percentage}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-indigo-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${pasteSaveProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingPastedRows}
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold transition-all cursor-pointer text-xs shadow-2xs disabled:opacity-50"
                >
                  Batal / Tutup
                </button>
              </div>

              <div className="flex items-center gap-3">
                {pastedRows.length > 0 && (
                  <span className="text-xs font-bold text-slate-600">
                    <strong className="text-indigo-800">{pastedRows.length}</strong> data siap ditambahkan
                  </span>
                )}

                <button
                  type="button"
                  disabled={isSavingPastedRows || pastedRows.length === 0}
                  onClick={handleCommitPastedRows}
                  className="px-5 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 disabled:opacity-50 text-white font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-xs"
                >
                  {isSavingPastedRows ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Simpan {pastedRows.length} Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      , document.body)}

    </div>
  );
}
