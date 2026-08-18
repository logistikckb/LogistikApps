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
  MessageSquare
} from 'lucide-react';
import Fuse from 'fuse.js';
import QRCode from 'qrcode';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { PenyiapanItem, DataBarang } from '../../types';
import { getEdIsoDateString } from '../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../utils/fuseSearch';

export function PenyiapanModule() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const fetchPenyiapanData = useCallback(async () => {
    setIsLoading(true);
    setLastSupabaseError(null);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAllRowsFromSupabase<PenyiapanItem>('data_penyiapan', {
        orderBy: 'created_at',
        ascending: false
      });

      if (data && data.length > 0) {
        setPenyiapanList(data);
        localStorage.setItem('penyiapan_cache_v1', JSON.stringify(data));
      }
    } catch (err: any) {
      console.error('Unexpected error fetching data_penyiapan:', err);
      setLastSupabaseError(err?.message || 'Gagal terhubung ke tabel data_penyiapan');
    } finally {
      setIsLoading(false);
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
          fetchPenyiapanData();
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
      localStorage.setItem('penyiapan_cache_v1', JSON.stringify(penyiapanList));
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
    chunkSize = 50
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

    const cleanItems = Array.from(uniqueMap.values()).map(item => {
      const { ed, ...rest } = item as any;
      if (rest.expired_date === '-' || !rest.expired_date) {
        rest.expired_date = null;
      }
      return rest;
    });
    if (cleanItems.length === 0) return { successCount: 0, error: null };

    const chunks = chunkArray(cleanItems, chunkSize);
    let totalSuccess = 0;
    let lastErr: any = null;

    for (const chunk of chunks) {
      const { error } = await supabase
        .from('data_penyiapan')
        .upsert(chunk as any, { onConflict: 'id_penyiapan' });

      if (error) {
        console.warn('Upsert warning on data_penyiapan chunk, trying single upsert fallback:', error);
        let fallbackSuccess = 0;
        for (const singleItem of chunk) {
          const { error: singleErr } = await supabase
            .from('data_penyiapan')
            .upsert([singleItem] as any, { onConflict: 'id_penyiapan' });

          if (!singleErr) {
            fallbackSuccess++;
          } else {
            lastErr = singleErr;
            console.error('Single upsert failed on data_penyiapan:', singleErr);
          }
        }
        totalSuccess += fallbackSuccess;
        if (fallbackSuccess === 0) {
          lastErr = error;
          break;
        }
      } else {
        totalSuccess += chunk.length;
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
    const set = new Set<string>();
    penyiapanList.forEach(item => {
      if (item.qc_code && item.qc_code !== '-') set.add(item.qc_code.trim());
    });
    if (set.size === 0) return ['QC-PASS', 'QC-HOLD', 'QC-REJECT', 'Lulus'];
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

  // Check if location is filtered via location filter input or via search query matching a location
  const isLocationFiltered = useMemo(() => {
    if (locationFilter.trim() !== '') return true;
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim().toLowerCase();
    return uniqueLocationsList.some(
      loc => loc.toLowerCase() === q || (q.length >= 3 && loc.toLowerCase().includes(q))
    );
  }, [locationFilter, searchQuery, uniqueLocationsList]);

  // Check if any filters are currently active
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    locationFilter.trim() ||
    categoryFilter !== 'ALL' ||
    qcFilter !== 'ALL' ||
    slocFilter !== 'ALL' ||
    statusFilter !== 'ALL'
  );

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
      qc_code: 'QC-PASS',
      user_tally: currentUser?.nama || 'Tally 2',
      shelf_life: '24 Bulan',
      source: 'Stok Gudang',
      tujuan: 'Pengiriman Cabang',
      user_input: currentUser?.nama || 'Admin',
      status: 'Ready',
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
      qc_code: formData.qc_code?.trim() || 'QC-PASS',
      user_tally: formData.user_tally?.trim() || currentUser?.nama || '-',
      shelf_life: formData.shelf_life?.trim() || '-',
      source: formData.source?.trim() || 'Stok Gudang',
      tujuan: formData.tujuan?.trim() || 'Pengiriman Cabang',
      destination_code: formData.destination_code?.trim() || '-',
      user_input: currentUser?.nama || formData.user_input?.trim() || '-',
      tanggal_update: nowIso,
      status: formData.status?.trim() || 'Ada',
      note: formData.note?.trim() || '',
      created_at: isEditMode ? selectedItem?.created_at || nowIso : nowIso,
      updated_at: nowIso
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
        if (dbRecord.expired_date === '-' || !dbRecord.expired_date) {
          dbRecord.expired_date = null;
        }

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

  const handleUpdateStatus = async (item: PenyiapanItem, newStatus: string) => {
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

  // Clear All Data
  const handleClearAllData = async () => {
    showConfirm({
      title: 'Hapus Semua Data',
      message: 'Apakah Anda yakin ingin menghapus SEMUA data penyiapan? Tindakan ini tidak dapat dibatalkan.',
      confirmText: 'Ya, Hapus Semua',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        if (isSupabaseConfigured) {
          try {
            const { error } = await supabase
              .from('data_penyiapan')
              .delete()
              .neq('id_penyiapan', 'some_dummy_value'); // Delete all rows

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
        localStorage.removeItem('penyiapan_cache_v1');
        showToast('Terhapus', 'Semua data penyiapan berhasil dihapus', 'success');
      }
    });
  };

  // Download Excel Template (Exact columns from user request & image)
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
        'Source': 'Stok Gudang'
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
        'Source': 'Stok Gudang'
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
      { wch: 16 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 16 }  // Source
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
      'Tanggal Update': item.tanggal_update || item.created_at || '-'
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
      { wch: 16 }, // Destination Code
      { wch: 14 }, // QC Code
      { wch: 18 }, // User Tally
      { wch: 14 }, // Shelf Life
      { wch: 16 }, // Source
      { wch: 14 }, // Status
      { wch: 16 }, // User Input
      { wch: 22 }  // Tanggal Update
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

  // Handle Excel Upload Parsing with all column variations
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
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'File Excel tidak memiliki baris data!', 'warning');
          setParsedExcelRows([]);
          return;
        }

        const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const rawList: PenyiapanItem[] = rawJson.map((row, idx) => {
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          const getVal = (candidates: string[]) => {
            for (const c of candidates) {
              const norm = normalizeKey(c);
              if (normalizedRow[norm] !== undefined && normalizedRow[norm] !== '') {
                return normalizedRow[norm];
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
          let expDate = String(getVal(['expired_date', 'expireddate', 'Expired Date', 'exp_date', 'tanggal_ed', 'kadaluwarsa']) || '').trim();
          if (/^\d{5}$/.test(expDate)) {
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + Number(expDate) * 86400000);
            expDate = dateObj.toISOString().slice(0, 10);
          }

          // 16. destination_code
          const destCode = String(getVal(['destination_code', 'destinationcode', 'Destination Code', 'kode_tujuan']) || 'DST-02').trim();

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
          if (!shelfLife) shelfLife = '24 Bulan';

          // 17. qc_code
          const qcCode = String(getVal(['qc_code', 'qccode', 'QC Code', 'Status QC', 'qc', 'kondisi_qc']) || 'QC-PASS').trim().toUpperCase();
          // 18. user_tally
          const userTally = String(getVal(['user_tally', 'usertally', 'User Tally', 'Petugas Tally', 'tally', 'checker']) || currentUser?.nama || 'Tally 2').trim();
          // 20. source
          const source = String(getVal(['source', 'Source', 'Sumber', 'asal', 'source_location']) || 'Stok Gudang').trim();

          const rawId = String(getVal(['id_penyiapan', 'idpenyiapan', 'ID Penyiapan', 'id', 'kode_penyiapan']) || '').trim();
          const idGenerated = rawId || `PEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(idx + 1).padStart(4, '0')}`;

          const tujuan = String(getVal(['tujuan', 'Tujuan', 'destination', 'tujuan_pengiriman']) || 'Pengiriman Cabang').trim();
          const status = String(getVal(['status', 'Status', 'status_penyiapan']) || 'Ada').trim();
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
            tanggal_update: new Date().toISOString(),
            status,
            note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }).filter(r => r.item_code && r.item_name);

        // Deduplicate rows
        const penyiapanMap = new Map<string, PenyiapanItem>();
        rawList.forEach(item => {
          const key = item.id_penyiapan.trim().toLowerCase();
          penyiapanMap.set(key, { ...item, id_penyiapan: item.id_penyiapan.trim() });
        });
        const formatted = Array.from(penyiapanMap.values());

        setParsedExcelRows(formatted);
        if (formatted.length > 0) {
          showToast('Excel Terbaca', `${formatted.length} baris data penyiapan valid ditemukan`, 'info');
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
      // 1. Merge locally
      const mergedMap = new Map<string, PenyiapanItem>();
      penyiapanList.forEach(item => {
        mergedMap.set(item.id_penyiapan.toLowerCase(), item);
      });
      parsedExcelRows.forEach(item => {
        mergedMap.set(item.id_penyiapan.toLowerCase(), item);
      });
      const finalMerged = Array.from(mergedMap.values());
      setPenyiapanList(finalMerged);

      // 2. Persist to Supabase if online
      if (isSupabaseConfigured) {
        const { successCount, error } = await safeBatchUpsertPenyiapan(parsedExcelRows, 50);
        if (error && successCount === 0) {
          showToast('Peringatan Database', `Tersimpan di memori lokal, namun gagal sync ke cloud: ${error.message}`, 'warning');
        } else {
          showToast('Import Berhasil', `${successCount} data penyiapan berhasil diunggah ke Database Supabase!`, 'success');
          fetchPenyiapanData();
        }
      } else {
        showToast('Import Lokal Selesai', `${parsedExcelRows.length} data penyiapan berhasil disimpan di penyimpanan lokal!`, 'success');
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

  // Helper copy text
  const handleCopyText = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast('Tersalin', `${label} "${text}" disalin ke clipboard`, 'info');
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-800">
      
      {/* ========================================================================= */}
      {/* ACTION TOOLBAR BUTTONS */}
      {/* ========================================================================= */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left Side: CRUD & Import Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tambah Penyiapan Manual */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
            title="Tambah Data Penyiapan Manual"
          >
            <Plus size={15} />
            <span>Tambah Data</span>
          </button>

          {/* Upload Excel Button (Admin role privileged) */}
          <button
            onClick={handleOpenExcelModal}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              isSuperAdmin
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md hover:shadow-lg'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
            }`}
            title={isSuperAdmin ? 'Upload Data Excel (data_penyiapan)' : 'Upload Excel Khusus Admin'}
          >
            <Upload size={14} />
            <span>Upload Excel</span>
            {isSuperAdmin && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-800 text-[9px] font-extrabold uppercase text-white">
                Admin
              </span>
            )}
          </button>

          {/* Download Template Excel */}
          <button
            onClick={downloadExcelTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Download Template Format Excel Sesuai Kolom"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span className="hidden sm:inline">Template Excel</span>
          </button>

          {/* Export Excel Data */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Ekspor Data Penyiapan ke File Excel (.xlsx)"
          >
            <Download size={14} className="text-blue-700" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>

        {/* Right Side: Refresh & Sync Database */}
        <div className="flex items-center gap-2">
          {/* Push/Sync All to Cloud Database */}
          <button
            onClick={handlePushAllToSupabase}
            disabled={isPushing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 text-indigo-900 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Sinkronkan Semua Data Lokal ke Supabase (tabel data_penyiapan)"
          >
            <Database size={14} className={isPushing ? 'animate-spin' : ''} />
            <span className="hidden md:inline">{isPushing ? 'Menyinkronkan...' : 'Sinkron Supabase'}</span>
          </button>

          {/* Refresh Live */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data dari Cloud"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Clear All Data */}
          {isSuperAdmin && (
            <button
              onClick={handleClearAllData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer"
              title="Hapus Semua Data Penyiapan"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear All Data</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH BAR & DYNAMIC FILTERS */}
      {/* ========================================================================= */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
        {/* Search Input with Voice Search Recognition */}
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari Item Code, Item Name, Batch, LPN, Lokasi, SLOC, Petugas Tally, QC Code..."
            className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 text-xs sm:text-sm font-medium transition-all"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}

            {/* Speech to Text Microphone for Table Search */}
            <button
              type="button"
              onClick={toggleSpeechToTextSearch}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isListeningSearch
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
              }`}
              title="Pencarian Suara (Speech to Text)"
            >
              {isListeningSearch ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          </div>
        </div>

        {/* Speech Recognition Feedback Banner */}
        {speechFeedbackSearch && (
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
            <Radio size={14} className="text-rose-600 animate-pulse" />
            <span className="font-semibold">{speechFeedbackSearch}</span>
          </div>
        )}

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {/* Filter Kategori */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kategori</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua ({penyiapanList.length})</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filter Lokasi (Ketik & Dropdown) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lokasi</label>
            <div className="relative flex items-center">
              <input
                list="location-options"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari Lokasi..."
                className="w-full p-2 pr-7 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-slate-700"
              />
              {locationFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Clear Filter Lokasi"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <datalist id="location-options">
              {uniqueLocationsList.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          {/* Filter QC Code */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status QC</label>
            <select
              value={qcFilter}
              onChange={(e) => {
                setQcFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua Status QC</option>
              {uniqueQcCodes.map(qc => (
                <option key={qc} value={qc}>{qc}</option>
              ))}
            </select>
          </div>

          {/* Filter SLOC */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SLOC</label>
            <select
              value={slocFilter}
              onChange={(e) => {
                setSlocFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua SLOC</option>
              {uniqueSlocs.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Penyiapan</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              {uniqueStatuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
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
                <span className="text-[9px] bg-indigo-200/80 px-1 py-0.2 rounded text-indigo-800 font-semibold">(Kolom Disembunyikan)</span>
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

            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                <span>Kategori: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-slate-900 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {qcFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                <span>QC: {qcFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setQcFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-emerald-700 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {slocFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                <span>SLOC: {slocFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSlocFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-amber-700 cursor-pointer"
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
      {/* DATA TABLE (APPSHEET STYLE) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-md overflow-hidden">
        
        {/* Table Top Status Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <Boxes size={15} className="text-blue-900" />
            <span>Daftar Data Penyiapan ({filteredPenyiapan.length} item)</span>
            {isLocationFiltered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-[10px] font-extrabold border border-indigo-200">
                <MapPin size={11} />
                <span>Lokasi Terwakili: {locationFilter || searchQuery} (Kolom Disembunyikan)</span>
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
                  title="Tampilkan kembali kolom lokasi (Reset filter lokasi)"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {searchQuery && !isLocationFiltered && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px]">
                Filter aktif: "{searchQuery}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Tampilkan:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua (Semua Baris)</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        {/* Responsive Table Wrapper with Horizontal Scroll */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-tight text-[11px] border-b border-slate-200 select-none">
                <th className="p-3 text-center w-12">No</th>
                <th className="p-3 text-center sticky left-0 bg-slate-100 z-10 w-28">Status</th>
                <th className="p-3 text-center w-24">Aksi</th>
                {!isLocationFiltered && (
                  <th onClick={() => handleSort('location')} className="p-3 cursor-pointer hover:bg-slate-200/80 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('item_name')} className="p-3 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Item Name</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('last_qty')} className="p-3 text-right cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Qty</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3">Uom</th>
                <th onClick={() => handleSort('expired_date')} className="p-3 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Expired Date</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {isLoading ? (
                <tr>
                  <td colSpan={isLocationFiltered ? 7 : 8} className="p-8 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-blue-900" />
                      <span>Memuat data penyiapan dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isLocationFiltered ? 7 : 8} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes size={32} className="text-slate-300" />
                      <span className="font-extrabold text-slate-700">Belum Ada Data Penyiapan</span>
                      <p className="text-xs text-slate-400 max-w-md m-0">
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
                  const isQcPass = (item.qc_code || '').toUpperCase().includes('PASS') || (item.qc_code || '').toLowerCase().includes('lulus');
                  const isQcHold = (item.qc_code || '').toUpperCase().includes('HOLD') || (item.qc_code || '').toLowerCase().includes('karantina');
                  const isQcReject = (item.qc_code || '').toUpperCase().includes('REJECT') || (item.qc_code || '').toLowerCase().includes('reject');

                  return (
                    <tr
                      key={item.id_penyiapan || index}
                      className="hover:bg-blue-50/50 transition-colors group"
                    >
                      {/* No */}
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* Status Sticky Column */}
                      <td className="p-2 text-center sticky left-0 bg-white group-hover:bg-blue-50/90 transition-colors z-10 shadow-xs border-r border-slate-100">
                        <select
                          value={item.status || ''}
                          onChange={(e) => handleUpdateStatus(item, e.target.value)}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-bold border outline-none cursor-pointer text-center appearance-none w-full ${
                            (item.status || '').toLowerCase() === 'ada' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            (item.status || '').toLowerCase() === 'beda' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            (item.status || '').toLowerCase() === 'tidak' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="">- Status -</option>
                          <option value="Ada">Ada</option>
                          <option value="Beda">Beda</option>
                          <option value="Tidak">Tidak</option>
                        </select>
                      </td>

                      {/* Aksi */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 transition-colors cursor-pointer"
                            title="Edit / Lihat Data"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Aksi Hapus khusus Admin */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 transition-colors cursor-pointer"
                              title="Hapus Data (Khusus Admin)"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Location (Hidden when location is filtered) */}
                      {!isLocationFiltered && (
                        <td className="p-3 font-bold text-slate-700">
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{item.location || '-'}</span>
                          </div>
                        </td>
                      )}

                      {/* Item Name & Note */}
                      <td className="p-3 max-w-xs" title={item.item_name}>
                        <div className="font-extrabold text-slate-800 truncate">
                          {item.item_name}
                        </div>
                        {item.note && (
                          <div
                            className="text-[10px] text-blue-800 font-semibold flex items-center gap-1 mt-0.5 max-w-xs truncate bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                            title={`Catatan: ${item.note}`}
                          >
                            <MessageSquare size={10} className="shrink-0 text-blue-600" />
                            <span className="truncate">{item.note}</span>
                          </div>
                        )}
                      </td>

                      {/* Last Qty */}
                      <td className="p-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                        {item.last_qty !== undefined && item.last_qty !== null ? Number(item.last_qty).toLocaleString('id-ID') : '-'}
                      </td>

                      {/* Uom */}
                      <td className="p-3 font-bold text-slate-700">
                        {item.uom || 'CTN'}
                      </td>

                      {/* Expired Date */}
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {item.expired_date || '-'}
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
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">
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

              {/* 3. Location, Last Qty, Batch, Expired Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Qty</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_qty: Number(e.target.value) }))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-black text-emerald-800"
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
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
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

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-700" />
                  <span>Download Template Excel</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExcelModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={parsedExcelRows.length === 0 || isProcessingExcel}
                    onClick={handleCommitExcelImport}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingExcel ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{isProcessingExcel ? 'Mengunggah...' : `Simpan ${parsedExcelRows.length} Data Penyiapan`}</span>
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

    </div>
  );
}
