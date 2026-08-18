import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Truck,
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
  Building2,
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
  Volume2,
  Radio
} from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllRowsFromSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { IncomingItem, DataBarang, DataDistributor } from '../../types';
import { edComputeExpiredRow, getEdIsoDateString, EdComputeResult } from '../../utils/logisticsCalculations';

export function IncomingModule() {
  const { currentUser, isAdmin } = useAuth();
  const { showToast } = useNotification();

  // Helper to load all cached master data from multiple local storage keys and merge with incoming history
  const loadAllMasterDataLocally = useCallback(() => {
    let loadedBarang: DataBarang[] = [];
    let loadedDist: DataDistributor[] = [];

    try {
      const keysBarang = ['ckb_master_data_barang_cache', 'ckb_data_barang', 'master_barang'];
      for (const k of keysBarang) {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedBarang = [...loadedBarang, ...parsed];
          }
        }
      }

      const keysDist = ['ckb_master_data_distributor_cache', 'ckb_data_distributor', 'master_distributor'];
      for (const k of keysDist) {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedDist = [...loadedDist, ...parsed];
          }
        }
      }
    } catch (e) {
      console.warn('Error reading local master cache:', e);
    }

    // Deduplicate barang by item_code
    const barangMap = new Map<string, DataBarang>();
    loadedBarang.forEach(b => {
      if (b.item_code) {
        barangMap.set(b.item_code.trim().toLowerCase(), b);
      }
    });

    // Deduplicate distributor by kode_ld or nama_distributor
    const distMap = new Map<string, DataDistributor>();
    loadedDist.forEach(d => {
      const key = (d.kode_ld || d.nama_distributor || '').trim().toLowerCase();
      if (key) {
        distMap.set(key, d);
      }
    });

    return {
      barang: Array.from(barangMap.values()),
      distributors: Array.from(distMap.values())
    };
  }, []);

  // Primary Data State
  const [incomingList, setIncomingList] = useState<IncomingItem[]>([]);
  const [barangList, setBarangList] = useState<DataBarang[]>(() => {
    const initial = loadAllMasterDataLocally();
    return initial.barang;
  });
  const [distributorList, setDistributorList] = useState<DataDistributor[]>(() => {
    const initial = loadAllMasterDataLocally();
    return initial.distributors;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [qcFilter, setQcFilter] = useState<string>('ALL');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof IncomingItem>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination & Display (Tampilkan semua data sampai bawah secara default)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showSqlSetupModal, setShowSqlSetupModal] = useState(false);

  // Selected & Form Data
  const [selectedItem, setSelectedItem] = useState<IncomingItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<IncomingItem>>({});

  // Searchable Autocomplete States for Form
  const [distributorSearchText, setDistributorSearchText] = useState('');
  const [isDistributorDropdownOpen, setIsDistributorDropdownOpen] = useState(false);
  const [barangSearchText, setBarangSearchText] = useState('');
  const [isBarangDropdownOpen, setIsBarangDropdownOpen] = useState(false);

  // Speech-to-Text Voice Recognition States
  const [isListeningBarang, setIsListeningBarang] = useState(false);
  const [speechFeedbackBarang, setSpeechFeedbackBarang] = useState<string | null>(null);
  const barangRecognitionRef = useRef<any>(null);

  const [isListeningSearch, setIsListeningSearch] = useState(false);
  const [speechFeedbackSearch, setSpeechFeedbackSearch] = useState<string | null>(null);
  const searchRecognitionRef = useRef<any>(null);

  // Check if browser supports Web Speech API
  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

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

  // Voice handler for Produk Search in Form
  const toggleSpeechToTextBarang = useCallback(() => {
    if (!isSpeechSupported) {
      showToast(
        'Fitur Tidak Didukung',
        'Browser Anda belum mendukung Web Speech Recognition. Gunakan browser modern seperti Google Chrome atau Microsoft Edge.',
        'warning'
      );
      return;
    }

    if (isListeningBarang) {
      if (barangRecognitionRef.current) {
        try {
          barangRecognitionRef.current.stop();
        } catch {}
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
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsListeningBarang(true);
        setIsBarangDropdownOpen(true);
        setSpeechFeedbackBarang('Mendengarkan suara... Sebutkan nama produk atau kode barang');
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
        console.warn('Speech recognition error:', event.error);
        setIsListeningBarang(false);
        if (event.error === 'not-allowed') {
          showToast(
            'Izin Mikrofon Diperlukan',
            'Izinkan akses mikrofon di browser untuk menggunakan fitur pencarian suara (Speech to Text).',
            'danger'
          );
        } else if (event.error === 'no-speech') {
          setSpeechFeedbackBarang('Tidak ada suara terdeteksi. Silakan coba klik mikrofon lagi.');
          setTimeout(() => setSpeechFeedbackBarang(null), 2500);
        } else {
          showToast('Info Mikrofon', `Status suara: ${event.error}`, 'info');
        }
      };

      recognition.onend = () => {
        setIsListeningBarang(false);
        setTimeout(() => {
          setSpeechFeedbackBarang(null);
        }, 3000);
      };

      barangRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListeningBarang(false);
      showToast('Gagal Memulai Suara', 'Tidak dapat mengaktifkan mikrofon.', 'danger');
    }
  }, [isSpeechSupported, isListeningBarang, showToast]);

  // Voice handler for Main Table Search
  const toggleSpeechToTextSearch = useCallback(() => {
    if (!isSpeechSupported) {
      showToast(
        'Fitur Tidak Didukung',
        'Browser ini belum mendukung Web Speech Recognition. Gunakan Chrome atau browser modern.',
        'warning'
      );
      return;
    }

    if (isListeningSearch) {
      if (searchRecognitionRef.current) {
        try {
          searchRecognitionRef.current.stop();
        } catch {}
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
        if (event.error === 'not-allowed') {
          showToast('Izin Mikrofon Ditolak', 'Izinkan akses mikrofon pada browser Anda.', 'danger');
        }
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

  // Multi-token intelligent filtered master lists displaying ALL matching items
  const filteredDistributors = useMemo(() => {
    if (!distributorSearchText.trim()) return distributorList;
    const tokens = distributorSearchText
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return distributorList.filter(d => {
      const combined = `${d.kode_ld || ''} ${d.nama_distributor || ''} ${d.status || ''}`.toLowerCase();
      return tokens.every(token => combined.includes(token));
    });
  }, [distributorList, distributorSearchText]);

  const filteredBarangList = useMemo(() => {
    if (!barangSearchText.trim()) return barangList;
    const tokens = barangSearchText
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return barangList.filter(b => {
      const combined = `${b.item_code || ''} ${b.item_name || ''} ${b.barcode || ''} ${b.category || ''} ${b.uom || ''}`.toLowerCase();
      return tokens.every(token => combined.includes(token));
    });
  }, [barangList, barangSearchText]);

  // Helper formatting Tanggal Input for table & filtering
  const getItemDateFormatted = useCallback((item: IncomingItem) => {
    if (item.created_at) {
      try {
        const d = new Date(item.created_at);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('id-ID');
        }
      } catch {}
    }
    if (item.tanggal_update && item.tanggal_update !== '-') {
      try {
        const d = new Date(item.tanggal_update);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('id-ID');
        }
      } catch {}
      return item.tanggal_update;
    }
    return '-';
  }, []);

  // Dynamic filter options generated directly from table records
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    incomingList.forEach(item => {
      const formatted = getItemDateFormatted(item);
      if (formatted && formatted !== '-') {
        datesSet.add(formatted);
      }
    });
    return Array.from(datesSet).sort((a, b) => {
      const parseDate = (s: string) => {
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime();
          return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        }
        return 0;
      };
      return parseDate(b) - parseDate(a);
    });
  }, [incomingList, getItemDateFormatted]);

  const uniqueQcStatuses = useMemo(() => {
    const qcSet = new Set<string>();
    incomingList.forEach(item => {
      const qc = item.qc_code?.trim();
      if (qc && qc !== '-') {
        qcSet.add(qc);
      }
    });
    if (qcSet.size === 0) {
      return ['Lulus', 'Karantina', 'Repack', 'Reject'];
    }
    return Array.from(qcSet).sort();
  }, [incomingList]);

  const uniqueJenisList = useMemo(() => {
    const jenisSet = new Set<string>();
    incomingList.forEach(item => {
      const j = item.jenis?.trim();
      if (j && j !== '-') {
        jenisSet.add(j);
      }
    });
    if (jenisSet.size === 0) {
      return ['ADMK', 'BTB', 'RETUR', 'Reguler', 'Retur Distributor'];
    }
    return Array.from(jenisSet).sort();
  }, [incomingList]);

  // Excel Import States
  const [parsedExcelRows, setParsedExcelRows] = useState<IncomingItem[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // FETCH MASTER & INCOMING DATA (PAGINATED CHUNKS - NO 1000 ROWS LIMIT)
  // =========================================================================
  const fetchMasterData = useCallback(async () => {
    // 1. Sync from local cache first
    const local = loadAllMasterDataLocally();
    if (local.barang.length > 0) setBarangList(local.barang);
    if (local.distributors.length > 0) setDistributorList(local.distributors);

    if (!isSupabaseConfigured) return;
    try {
      const [resBarangData, resDistData] = await Promise.all([
        fetchAllRowsFromSupabase<DataBarang>('data_barang', { orderBy: 'item_name', ascending: true }),
        fetchAllRowsFromSupabase<DataDistributor>('data_distributor', { orderBy: 'nama_distributor', ascending: true })
      ]);

      if (resBarangData && resBarangData.length > 0) {
        // Merge with existing local data
        const mergedBarangMap = new Map<string, DataBarang>();
        local.barang.forEach(b => {
          if (b.item_code) mergedBarangMap.set(b.item_code.trim().toLowerCase(), b);
        });
        resBarangData.forEach((b: DataBarang) => {
          if (b.item_code) mergedBarangMap.set(b.item_code.trim().toLowerCase(), b);
        });
        const finalBarang = Array.from(mergedBarangMap.values());
        setBarangList(finalBarang);
        try {
          localStorage.setItem('ckb_master_data_barang_cache', JSON.stringify(finalBarang));
        } catch {}
      }

      if (resDistData && resDistData.length > 0) {
        // Merge with existing local data
        const mergedDistMap = new Map<string, DataDistributor>();
        local.distributors.forEach(d => {
          const key = (d.kode_ld || d.nama_distributor || '').trim().toLowerCase();
          if (key) mergedDistMap.set(key, d);
        });
        resDistData.forEach((d: DataDistributor) => {
          const key = (d.kode_ld || d.nama_distributor || '').trim().toLowerCase();
          if (key) mergedDistMap.set(key, d);
        });
        const finalDist = Array.from(mergedDistMap.values());
        setDistributorList(finalDist);
        try {
          localStorage.setItem('ckb_master_data_distributor_cache', JSON.stringify(finalDist));
        } catch {}
      }
    } catch (err) {
      console.warn('Error fetching master lookup data:', err);
    }
  }, [loadAllMasterDataLocally]);

  const fetchIncomingData = useCallback(async () => {
    setIsLoading(true);
    setLastSupabaseError(null);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAllRowsFromSupabase<IncomingItem>('incoming', {
        orderBy: 'created_at',
        ascending: false
      });

      if (data && data.length > 0) {
        setIncomingList(data);
        localStorage.setItem('incoming_cache_v1', JSON.stringify(data));
      }
    } catch (err: any) {
      console.error('Unexpected error fetching incoming:', err);
      setLastSupabaseError(err?.message || 'Gagal terhubung ke database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Local Storage Sync
  useEffect(() => {
    // 1. Try loading cached data from LocalStorage first for instant UI response
    const cachedIncoming = localStorage.getItem('incoming_cache_v1');
    if (cachedIncoming) {
      try {
        const parsed = JSON.parse(cachedIncoming);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setIncomingList(parsed);
        }
      } catch (e) {
        console.error('Error loading incoming cache:', e);
      }
    }

    // 2. Fetch master data and incoming records from Supabase
    fetchMasterData();
    fetchIncomingData();

    // Listen to local storage events if master data updated in another tab/window
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'ckb_master_data_barang_cache' ||
        e.key === 'ckb_master_data_distributor_cache' ||
        e.key === 'ckb_data_barang' ||
        e.key === 'ckb_data_distributor'
      ) {
        fetchMasterData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Supabase Realtime channel for master data updates
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('incoming_master_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_barang' }, () => {
          fetchMasterData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_distributor' }, () => {
          fetchMasterData();
        })
        .subscribe();

      return () => {
        window.removeEventListener('storage', handleStorage);
        supabase.removeChannel(channel);
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchMasterData, fetchIncomingData]);

  // Save to local storage whenever incomingList changes
  useEffect(() => {
    if (incomingList.length > 0) {
      localStorage.setItem('incoming_cache_v1', JSON.stringify(incomingList));
    }
  }, [incomingList]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMasterData();
    fetchIncomingData();
    showToast('Memperbarui Data', 'Mengambil data kedatangan terbaru dari database...', 'info');
  };

  // =========================================================================
  // HELPER: GENERATE UNIQUE ID INCOMING
  // =========================================================================
  const generateIncomingId = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INC-${yyyy}${mm}${dd}-${randomSuffix}`;
  };

  // Helper chunking for safe Supabase upsert
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  // Safe Batch Upsert with guaranteed distinct keys per chunk + fallback item-by-item
  const safeBatchUpsert = async <T extends Record<string, any>>(
    tableName: string,
    items: T[],
    keyField: keyof T,
    chunkSize = 50
  ): Promise<{ successCount: number; error: any }> => {
    // Deduplicate by keyField to eliminate 21000 ON CONFLICT DO UPDATE command cannot affect row a second time
    const uniqueMap = new Map<string, T>();
    for (const item of items) {
      const rawKey = item[keyField];
      if (rawKey !== undefined && rawKey !== null) {
        const cleanKey = String(rawKey).trim();
        if (cleanKey) {
          uniqueMap.set(cleanKey.toLowerCase(), {
            ...item,
            [keyField]: cleanKey
          });
        }
      }
    }

    const cleanItems = Array.from(uniqueMap.values());
    if (cleanItems.length === 0) return { successCount: 0, error: null };

    const chunks = chunkArray(cleanItems, chunkSize);
    let totalSuccess = 0;
    let lastErr: any = null;

    for (const chunk of chunks) {
      const { error } = await supabase
        .from(tableName)
        .upsert(chunk as any, { onConflict: String(keyField) });

      if (error) {
        console.warn(`Upsert warning on ${tableName} chunk, trying fallback item-by-item:`, error);
        let fallbackSuccess = 0;
        for (const singleItem of chunk) {
          const { error: singleErr } = await supabase
            .from(tableName)
            .upsert([singleItem] as any, { onConflict: String(keyField) });

          if (!singleErr) {
            fallbackSuccess++;
          } else {
            lastErr = singleErr;
            console.error(`Single upsert failed on ${tableName}:`, singleErr);
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

  // =========================================================================
  // CRUD OPERATIONS
  // =========================================================================
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setDistributorSearchText('');
    setIsDistributorDropdownOpen(false);
    setBarangSearchText('');
    setIsBarangDropdownOpen(false);
    fetchMasterData(); // Refresh master data immediately on open

    // Ambil data Rak dan Tujuan terakhir yang pernah diisi jika ada, atau kosongkan
    const lastLocation = incomingList.find(i => i.location && i.location !== '-' && i.location.trim() !== '')?.location || '';
    const lastTujuan = incomingList.find(i => i.tujuan && i.tujuan !== '-' && i.tujuan.trim() !== '')?.tujuan || '';

    setFormData({
      id_incoming: generateIncomingId(),
      jenis: 'ADMK',
      id_distributor: '',
      distributor: '',
      item_code: '',
      item_name: '',
      category: '-',
      location: lastLocation,
      location_type: '-',
      first_qty: 0,
      last_qty: 0,
      uom: 'CTN',
      qty_convert: 0,
      uom_convert: '-',
      lpn_serial_number: '-',
      batch: '',
      vendor_batch: '-',
      sloc: '-',
      expired_date: '',
      destination_code: '-',
      qc_code: 'Lulus',
      user_tally: currentUser?.nama || '-',
      shelf_life: '-',
      source: '-',
      user_input: currentUser?.nama || '-',
      status: '-',
      tujuan: lastTujuan
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: IncomingItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setDistributorSearchText(item.distributor || '');
    setIsDistributorDropdownOpen(false);
    setBarangSearchText(item.item_code ? `${item.item_code} - ${item.item_name}` : '');
    setIsBarangDropdownOpen(false);
    fetchMasterData(); // Refresh master data immediately on open
    setFormData({ ...item });
    setShowFormModal(true);
  };

  const handleOpenDetailModal = (item: IncomingItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleOpenDeleteModal = (item: IncomingItem) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  // Handle SKU autocomplete selection
  const handleSelectBarang = (itemCode: string) => {
    const found = barangList.find(b => b.item_code.toLowerCase() === itemCode.toLowerCase());
    if (found) {
      handleSelectBarangItem(found);
    } else {
      setFormData(prev => {
        const nextItemCode = itemCode;
        const nextItemName = prev.item_name || '';
        const currentBatch = (prev.batch || '').trim();
        let autoEd = prev.expired_date;
        let autoShelf = prev.shelf_life;
        if (currentBatch && nextItemName) {
          const comp = getEdIsoDateString(nextItemCode, nextItemName, currentBatch);
          if (comp && comp.isoDate) {
            autoEd = comp.isoDate;
            autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
          }
        }
        return { ...prev, item_code: itemCode, expired_date: autoEd, shelf_life: autoShelf };
      });
    }
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
        category: b.category || prev.category || '-',
        uom: b.uom || prev.uom || 'CTN',
        expired_date: autoEd,
        shelf_life: autoShelf
      };
    });
    setBarangSearchText(`${b.item_code} - ${b.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  // Handle Distributor autocomplete selection
  const handleSelectDistributor = (kodeLd: string) => {
    const found = distributorList.find(d => d.kode_ld.toLowerCase() === kodeLd.toLowerCase());
    if (found) {
      setFormData(prev => ({
        ...prev,
        id_distributor: found.kode_ld,
        distributor: found.nama_distributor
      }));
      setDistributorSearchText(found.nama_distributor);
      setIsDistributorDropdownOpen(false);
    } else {
      setFormData(prev => ({ ...prev, id_distributor: kodeLd }));
    }
  };

  const handleSelectDistributorItem = (d: DataDistributor) => {
    setFormData(prev => ({
      ...prev,
      id_distributor: d.kode_ld,
      distributor: d.nama_distributor
    }));
    setDistributorSearchText(d.nama_distributor);
    setIsDistributorDropdownOpen(false);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-resolve distributor if user typed in search box without clicking item
    let finalDistributor = formData.distributor?.trim() || '';
    let finalIdDistributor = formData.id_distributor?.trim() || '';
    if (!finalDistributor && distributorSearchText.trim()) {
      const match = distributorList.find(
        d =>
          d.nama_distributor.toLowerCase() === distributorSearchText.trim().toLowerCase() ||
          d.kode_ld.toLowerCase() === distributorSearchText.trim().toLowerCase()
      );
      if (match) {
        finalDistributor = match.nama_distributor;
        finalIdDistributor = match.kode_ld;
      } else {
        finalDistributor = distributorSearchText.trim();
      }
    }

    // Auto-resolve item if user typed in search box without clicking item
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

    if (!finalDistributor) {
      showToast('Form Belum Lengkap', 'Pilih atau ketik Distributor / Supplier terlebih dahulu!', 'warning');
      return;
    }

    if (!finalItemCode || !finalItemName) {
      showToast('Form Belum Lengkap', 'Pilih atau cari Master Barang terlebih dahulu!', 'warning');
      return;
    }

    const idIncoming = formData.id_incoming?.trim() || (isEditMode && selectedItem?.id_incoming ? selectedItem.id_incoming : generateIncomingId());
    const nowIso = new Date().toISOString();
    const cleanBatch = formData.batch?.trim() || '-';
    const cleanQty = Number(formData.last_qty) || 0;

    const recordToSave: IncomingItem = {
      id_incoming: idIncoming,
      jenis: formData.jenis?.trim() || 'ADMK',
      id_distributor: finalIdDistributor || '-',
      distributor: finalDistributor || '-',
      item_code: finalItemCode || '-',
      item_name: finalItemName || '-',
      category: formData.category?.trim() || '-',
      location: formData.location?.trim() || '-',
      location_type: formData.location_type?.trim() || '-',
      first_qty: cleanQty,
      last_qty: cleanQty,
      uom: formData.uom?.trim() || 'CTN',
      qty_convert: cleanQty,
      uom_convert: formData.uom_convert?.trim() || '-',
      lpn_serial_number: formData.lpn_serial_number?.trim() || '-',
      batch: cleanBatch,
      vendor_batch: formData.vendor_batch?.trim() || cleanBatch || '-',
      sloc: formData.sloc?.trim() || '-',
      expired_date: formData.expired_date?.trim() || '-',
      destination_code: formData.destination_code?.trim() || '-',
      qc_code: formData.qc_code?.trim() || 'Lulus',
      user_tally: currentUser?.nama || formData.user_tally?.trim() || '-',
      shelf_life: formData.shelf_life?.trim() || '-',
      source: formData.source?.trim() || '-',
      user_input: currentUser?.nama || formData.user_input?.trim() || '-',
      tanggal_update: nowIso,
      status: formData.status?.trim() || '-',
      tujuan: formData.tujuan?.trim() || '-',
      created_at: isEditMode ? selectedItem?.created_at || nowIso : nowIso,
      updated_at: nowIso
    };

    // 1. Update Local State immediately
    setIncomingList(prev => {
      if (isEditMode) {
        return prev.map(item => item.id_incoming === idIncoming ? recordToSave : item);
      } else {
        return [recordToSave, ...prev.filter(item => item.id_incoming !== idIncoming)];
      }
    });

    setShowFormModal(false);
    showToast('Tersimpan', `Data kedatangan ${idIncoming} berhasil disimpan!`, 'success');

    // 2. Persist to Supabase if online
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('incoming')
          .upsert(recordToSave, { onConflict: 'id_incoming' });

        if (error) {
          console.error('Error saving incoming to database:', error);
          setLastSupabaseError(error.message);
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setShowSqlSetupModal(true);
          }
          showToast('Peringatan Database', 'Tersimpan lokal, namun gagal ke database cloud. Cek Setup Database.', 'warning');
        } else {
          fetchIncomingData();
        }
      } catch (err: any) {
        console.error('Database save error:', err);
      }
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    const idToDelete = selectedItem.id_incoming;

    // Update Local State
    setIncomingList(prev => prev.filter(item => item.id_incoming !== idToDelete));
    setShowDeleteModal(false);
    showToast('Terhapus', `Data kedatangan ${idToDelete} berhasil dihapus`, 'info');

    // Delete from Database
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('incoming')
          .delete()
          .eq('id_incoming', idToDelete);

        if (error) {
          console.error('Error deleting incoming from database:', error);
          showToast('Error Database', error.message, 'danger');
        }
      } catch (err: any) {
        console.error('Database delete error:', err);
      }
    }
  };

  // Push all local items to Cloud Database
  const handlePushAllToSupabase = async () => {
    if (!isSupabaseConfigured) {
      showToast('Koneksi Diperlukan', 'Koneksi database cloud belum aktif!', 'warning');
      return;
    }

    if (incomingList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data kedatangan untuk disinkronkan', 'info');
      return;
    }

    setIsPushing(true);
    try {
      const payload = incomingList.map(item => ({
        ...item,
        updated_at: new Date().toISOString()
      }));

      const { successCount, error } = await safeBatchUpsert('incoming', payload, 'id_incoming', 50);

      if (error && successCount === 0) {
        console.error('Push error on incoming:', error);
        setLastSupabaseError(error.message || JSON.stringify(error));
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setShowSqlSetupModal(true);
        }
        showToast('Gagal Sinkronisasi', `Terjadi kendala: ${lastSupabaseError || 'Periksa Setup Database'}`, 'danger');
      } else {
        showToast('Sinkronisasi Sukses', `Semua ${successCount} data kedatangan berhasil disinkronkan ke Database Cloud!`, 'success');
        fetchIncomingData();
      }
    } catch (err: any) {
      console.error('Unexpected error pushing incoming:', err);
      showToast('Error Sinkronisasi', err?.message || 'Gagal mengirim data ke database cloud', 'danger');
    } finally {
      setIsPushing(false);
    }
  };

  // =========================================================================
  // EXCEL TEMPLATE & EXPORT
  // =========================================================================
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'id_incoming': 'INC-20260816-001',
        'jenis': 'ADMK',
        'id_distributor': 'LD-001',
        'distributor': 'PT SINAR NIAGA LOGISTIK',
        'item_code': '21104508',
        'item_name': 'KINO CANDY MINT 150G',
        'category': '-',
        'location': 'WH-A-01',
        'location_type': '-',
        'first_qty': 100,
        'last_qty': 100,
        'uom': 'CTN',
        'qty_convert': 100,
        'uom_convert': '-',
        'lpn_serial_number': '-',
        'batch': '0456',
        'vendor_batch': '-',
        'sloc': '-',
        'expired_date': '2027-02-14',
        'destination_code': '-',
        'qc_code': 'QC-PASS',
        'user_tally': 'Budi Santoso',
        'shelf_life': '-',
        'source': '-',
        'user_input': currentUser?.nama || '-',
        'tanggal_update': '2026-08-16',
        'status': '-',
        'tujuan': 'Warehouse Utama'
      },
      {
        'id_incoming': 'INC-20260816-002',
        'jenis': 'BTB',
        'id_distributor': 'LD-002',
        'distributor': 'PT MITRA DISTRIBUSI SEJAHTERA',
        'item_code': '21104509',
        'item_name': 'CAP KAKI TIGA GUAVA 320ML',
        'category': '-',
        'location': 'WH-A-02',
        'location_type': '-',
        'first_qty': 50,
        'last_qty': 50,
        'uom': 'CTN',
        'qty_convert': 50,
        'uom_convert': '-',
        'lpn_serial_number': '-',
        'batch': '1126',
        'vendor_batch': '-',
        'sloc': '-',
        'expired_date': '2027-04-22',
        'destination_code': '-',
        'qc_code': 'QC-PASS',
        'user_tally': 'Ahmad Fauzi',
        'shelf_life': '-',
        'source': '-',
        'user_input': currentUser?.nama || '-',
        'tanggal_update': '2026-08-16',
        'status': '-',
        'tujuan': 'Warehouse Utama'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wscols = [
      { wch: 20 }, // id_incoming
      { wch: 16 }, // jenis
      { wch: 16 }, // id_distributor
      { wch: 32 }, // distributor
      { wch: 16 }, // item_code
      { wch: 35 }, // item_name
      { wch: 16 }, // category
      { wch: 14 }, // location
      { wch: 14 }, // location_type
      { wch: 10 }, // first_qty
      { wch: 12 }, // last_qty
      { wch: 10 }, // uom
      { wch: 14 }, // qty_convert
      { wch: 16 }, // uom_convert
      { wch: 18 }, // lpn_serial_number
      { wch: 14 }, // batch
      { wch: 16 }, // vendor_batch
      { wch: 10 }, // sloc
      { wch: 16 }, // expired_date
      { wch: 16 }, // destination_code
      { wch: 14 }, // qc_code
      { wch: 18 }, // user_tally
      { wch: 14 }, // shelf_life
      { wch: 14 }, // source
      { wch: 16 }, // user_input
      { wch: 16 }, // tanggal_update
      { wch: 14 }, // status
      { wch: 22 }  // tujuan
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Incoming');
    XLSX.writeFile(wb, 'Template_Import_Kedatangan_incoming.xlsx');
    showToast('Template Terunduh', 'Template Excel Kedatangan (tabel incoming) siap diisi dan diupload kembali', 'info');
  };

  const handleExportExcel = () => {
    if (filteredIncoming.length === 0) {
      showToast('Data Kosong', 'Tidak ada data kedatangan yang sesuai filter untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredIncoming.map((item) => ({
      'id_incoming': item.id_incoming || '-',
      'jenis': item.jenis || '-',
      'tujuan': item.tujuan || '-',
      'id_distributor': item.id_distributor || '-',
      'distributor': item.distributor || '-',
      'item_code': item.item_code || '-',
      'item_name': item.item_name || '-',
      'category': item.category || '-',
      'location': item.location || '-',
      'location_type': item.location_type || '-',
      'first_qty': item.first_qty !== undefined && item.first_qty !== null ? item.first_qty : '-',
      'last_qty': item.last_qty !== undefined && item.last_qty !== null ? item.last_qty : '-',
      'uom': item.uom || '-',
      'qty_convert': item.qty_convert !== undefined && item.qty_convert !== null ? item.qty_convert : '-',
      'uom_convert': item.uom_convert || '-',
      'lpn_serial_number': item.lpn_serial_number || '-',
      'batch': item.batch || '-',
      'vendor_batch': item.vendor_batch || '-',
      'sloc': item.sloc || '-',
      'expired_date': item.expired_date || '-',
      'destination_code': item.destination_code || '-',
      'qc_code': item.qc_code || '-',
      'user_tally': item.user_tally || '-',
      'shelf_life': item.shelf_life || '-',
      'source': item.source || '-',
      'user_input': item.user_input || '-',
      'tanggal_update': item.tanggal_update || '-',
      'status': item.status || '-',
      'created_at': item.created_at || '-',
      'updated_at': item.updated_at || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wscols = [
      { wch: 22 }, // id_incoming
      { wch: 16 }, // jenis
      { wch: 22 }, // tujuan
      { wch: 16 }, // id_distributor
      { wch: 32 }, // distributor
      { wch: 16 }, // item_code
      { wch: 35 }, // item_name
      { wch: 16 }, // category
      { wch: 14 }, // location
      { wch: 14 }, // location_type
      { wch: 12 }, // first_qty
      { wch: 12 }, // last_qty
      { wch: 10 }, // uom
      { wch: 14 }, // qty_convert
      { wch: 16 }, // uom_convert
      { wch: 18 }, // lpn_serial_number
      { wch: 14 }, // batch
      { wch: 16 }, // vendor_batch
      { wch: 10 }, // sloc
      { wch: 16 }, // expired_date
      { wch: 16 }, // destination_code
      { wch: 14 }, // qc_code
      { wch: 18 }, // user_tally
      { wch: 14 }, // shelf_life
      { wch: 14 }, // source
      { wch: 16 }, // user_input
      { wch: 22 }, // tanggal_update
      { wch: 14 }, // status
      { wch: 24 }, // created_at
      { wch: 24 }  // updated_at
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'incoming');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_incoming_${dateStr}.xlsx`);
    showToast('Download Selesai', `File Laporan_incoming_${dateStr}.xlsx berhasil diunduh!`, 'success');
  };

  // =========================================================================
  // EXCEL UPLOAD & IMPORT
  // =========================================================================
  const handleOpenExcelModal = () => {
    setParsedExcelRows([]);
    setExcelFileName('');
    setShowExcelModal(true);
  };

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

        const rawList: IncomingItem[] = rawJson.map((row, idx) => {
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          // Helper to extract field by matching variations
          const getVal = (candidates: string[]) => {
            for (const c of candidates) {
              const norm = normalizeKey(c);
              if (normalizedRow[norm] !== undefined && normalizedRow[norm] !== '') {
                return normalizedRow[norm];
              }
            }
            return '';
          };

          const rawId = String(getVal(['id_incoming', 'idincoming', 'ID Incoming', 'no_kedatangan', 'nokedatangan', 'id', 'kode_transaksi']) || '').trim();
          const itemCode = String(getVal(['item_code', 'itemcode', 'Item Code', 'sku', 'kode_barang', 'kodebarang', 'kode_item', 'item']) || '').trim();
          const itemName = String(getVal(['item_name', 'itemname', 'Nama Barang', 'namabarang', 'deskripsi', 'nama_item']) || '').trim();
          const idDist = String(getVal(['id_distributor', 'iddistributor', 'Kode Distributor', 'kodedistributor', 'kode_ld', 'kodeld', 'id_supplier']) || '-').trim();
          const distName = String(getVal(['distributor', 'Nama Distributor', 'namadistributor', 'supplier', 'vendor']) || '-').trim();
          const jenis = String(getVal(['jenis', 'Jenis', 'jenis_kedatangan', 'tipe', 'type']) || 'ADMK').trim();
          const category = String(getVal(['category', 'Kategori', 'kategori']) || '-').trim();
          const location = String(getVal(['location', 'Lokasi', 'rak', 'bin', 'posisi']) || '-').trim();
          const locationType = String(getVal(['location_type', 'locationtype', 'Tipe Lokasi', 'tipe']) || '-').trim();
          const firstQty = Number(getVal(['first_qty', 'firstqty', 'Qty Awal', 'qtyawal', 'po_qty', 'qtysj'])) || 0;
          const lastQty = Number(getVal(['last_qty', 'lastqty', 'Qty Diterima', 'qtyditerima', 'qty_masuk', 'qty_aktual', 'qty'])) || firstQty || 0;
          const uom = String(getVal(['uom', 'Satuan', 'unit']) || 'CTN').trim();
          const qtyConvert = Number(getVal(['qty_convert', 'qtyconvert', 'Qty Konversi', 'qtykonversi', 'qty_pcs', 'total_pcs'])) || lastQty || 0;
          const uomConvert = String(getVal(['uom_convert', 'uomconvert', 'Satuan Konversi', 'satuankonversi', 'satuan_terkecil']) || '-').trim();
          const lpn = String(getVal(['lpn_serial_number', 'lpnserialnumber', 'LPN / No Seri', 'lpn', 'no_seri', 'serial_number']) || '-').trim();
          const batch = String(getVal(['batch', 'No Batch', 'nobatch', 'kode_batch', 'lot', 'batch_no']) || '-').trim();
          const vendorBatch = String(getVal(['vendor_batch', 'vendorbatch', 'Batch Vendor', 'batchvendor', 'lot_vendor']) || '-').trim();
          const sloc = String(getVal(['sloc', 'SLoc', 'storage_location']) || '-').trim();
          
          let expDate = String(getVal(['expired_date', 'expireddate', 'Expired Date (YYYY-MM-DD)', 'ed', 'exp_date', 'tanggal_ed', 'kadaluwarsa']) || '').trim();
          // Handle numeric Excel date serial if passed
          if (/^\d{5}$/.test(expDate)) {
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + Number(expDate) * 86400000);
            expDate = dateObj.toISOString().slice(0, 10);
          }

          let shelfLife = String(getVal(['shelf_life', 'shelflife', 'Shelf Life', 'masa_simpan']) || '').trim();
          // Auto-compute ED from Batch & Item Name if missing in Excel
          if (!expDate && batch && batch !== '-' && itemName) {
            const autoCalc = getEdIsoDateString(itemCode, itemName, batch);
            if (autoCalc && autoCalc.isoDate) {
              expDate = autoCalc.isoDate;
              if (!shelfLife) {
                shelfLife = autoCalc.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${autoCalc.result.lamaEdTahun * 12} Bulan`;
              }
            }
          }
          if (!shelfLife) shelfLife = '-';

          const destCode = String(getVal(['destination_code', 'destinationcode', 'Kode Tujuan', 'kodetujuan', 'dst']) || '-').trim();
          const qcCode = String(getVal(['qc_code', 'qccode', 'Status QC', 'statusqc', 'qc', 'kondisi_qc']) || 'QC-PASS').trim().toUpperCase();
          const userTally = String(getVal(['user_tally', 'usertally', 'Petugas Tally', 'petugastally', 'tally', 'checker']) || currentUser?.nama || '-').trim();
          const source = String(getVal(['source', 'Sumber', 'asal']) || '-').trim();
          const userInput = String(getVal(['user_input', 'userinput', 'User Input']) || currentUser?.nama || '-').trim();
          const tanggalUpdate = String(getVal(['tanggal_update', 'tanggalupdate', 'Tanggal Update']) || new Date().toISOString().slice(0, 10)).trim();
          const status = String(getVal(['status', 'Status', 'status_transaksi']) || '-').trim();
          const tujuan = String(getVal(['tujuan', 'Gudang Tujuan', 'destination']) || 'Warehouse Utama').trim();

          const idGenerated = rawId || `INC-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${String(idx + 1).padStart(4, '0')}`;

          return {
            id_incoming: idGenerated,
            jenis,
            id_distributor: idDist,
            distributor: distName,
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
            user_input: userInput,
            tanggal_update: tanggalUpdate,
            status,
            tujuan,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }).filter(r => r.item_code && r.item_name);

        // Deduplicate rows by id_incoming to prevent Postgres ON CONFLICT error
        const incomingMap = new Map<string, IncomingItem>();
        rawList.forEach(item => {
          const key = item.id_incoming.trim().toLowerCase();
          incomingMap.set(key, { ...item, id_incoming: item.id_incoming.trim() });
        });
        const formatted = Array.from(incomingMap.values());

        setParsedExcelRows(formatted);
        if (formatted.length > 0) {
          showToast('Excel Terbaca', `${formatted.length} baris data incoming valid ditemukan`, 'info');
        } else {
          showToast('Format Kolom Tidak Cocok', 'Kolom item_code dan item_name tidak ditemukan. Silakan unduh Template Excel.', 'warning');
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

  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) return;

    setIsProcessingExcel(true);
    try {
      const rows = [...parsedExcelRows];

      // 1. Merge into local state immediately
      setIncomingList(prev => {
        const map = new Map<string, IncomingItem>();
        prev.forEach(item => map.set(item.id_incoming.trim().toLowerCase(), item));
        rows.forEach(item => map.set(item.id_incoming.trim().toLowerCase(), item));
        return Array.from(map.values());
      });

      // 2. Upsert to Cloud Database
      if (isSupabaseConfigured) {
        const payload = rows.map(r => ({
          ...r,
          updated_at: new Date().toISOString()
        }));

        const { successCount, error } = await safeBatchUpsert('incoming', payload, 'id_incoming', 50);

        if (error && successCount === 0) {
          console.error('Upsert error on incoming:', error);
          setLastSupabaseError(error.message || JSON.stringify(error));
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setShowSqlSetupModal(true);
          }
          showToast('Peringatan Database', 'Tersimpan di aplikasi, namun gagal masuk ke database cloud. Cek Setup Database.', 'warning');
        } else {
          showToast('Import Selesai', `Berhasil mengimpor & menyimpan ${successCount} data kedatangan ke Database Cloud!`, 'success');
          fetchIncomingData();
        }
      } else {
        showToast('Import Berhasil', `${rows.length} data tersimpan di memori aplikasi (Penyimpanan Lokal)`, 'success');
      }

      setShowExcelModal(false);
      setParsedExcelRows([]);
      setExcelFileName('');
    } catch (err: any) {
      console.error('Commit import error:', err);
      showToast('Gagal Import', err?.message || 'Terjadi kesalahan saat menyimpan data', 'danger');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // =========================================================================
  // FILTERING, SORTING & STATS
  // =========================================================================
  const filteredIncoming = useMemo(() => {
    return incomingList.filter(item => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSearch =
          item.id_incoming.toLowerCase().includes(q) ||
          item.item_code.toLowerCase().includes(q) ||
          item.item_name.toLowerCase().includes(q) ||
          (item.distributor && item.distributor.toLowerCase().includes(q)) ||
          (item.id_distributor && item.id_distributor.toLowerCase().includes(q)) ||
          (item.batch && item.batch.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.user_tally && item.user_tally.toLowerCase().includes(q)) ||
          (item.lpn_serial_number && item.lpn_serial_number.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }

      // Tanggal Input filter
      if (dateFilter !== 'ALL') {
        const itemDate = getItemDateFormatted(item);
        if (itemDate !== dateFilter) return false;
      }

      // QC filter
      if (qcFilter !== 'ALL') {
        const itemQc = (item.qc_code || '').trim().toLowerCase();
        const targetQc = qcFilter.trim().toLowerCase();
        if (targetQc === 'lulus' || targetQc === 'qc-pass') {
          if (itemQc !== 'lulus' && itemQc !== 'qc-pass' && itemQc !== 'pass') return false;
        } else if (targetQc === 'karantina' || targetQc === 'qc-hold') {
          if (itemQc !== 'karantina' && itemQc !== 'qc-hold' && itemQc !== 'hold') return false;
        } else if (targetQc === 'repack' || targetQc === 'qc-reject') {
          if (itemQc !== 'repack' && itemQc !== 'qc-reject' && itemQc !== 'reject') return false;
        } else {
          if (itemQc !== targetQc) return false;
        }
      }

      // Jenis filter
      if (jenisFilter !== 'ALL') {
        const itemJenis = (item.jenis || '').trim().toLowerCase();
        const targetJenis = jenisFilter.trim().toLowerCase();
        if (itemJenis !== targetJenis) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [incomingList, searchQuery, dateFilter, qcFilter, jenisFilter, sortField, sortOrder, getItemDateFormatted]);

  // Statistics KPI
  const stats = useMemo(() => {
    const totalTransactions = incomingList.length;
    let totalCtn = 0;
    let totalPcs = 0;
    let qcPassCount = 0;
    let qcHoldCount = 0;
    let qcRejectCount = 0;

    incomingList.forEach(item => {
      totalCtn += Number(item.last_qty || item.first_qty || 0);
      totalPcs += Number(item.qty_convert || 0);

      const qc = (item.qc_code || 'Lulus').toUpperCase();
      if (qc === 'LULUS' || qc === 'QC-PASS' || qc === 'PASS') qcPassCount++;
      else if (qc === 'KARANTINA' || qc === 'QC-HOLD' || qc === 'HOLD') qcHoldCount++;
      else if (qc === 'REPACK' || qc === 'QC-REJECT' || qc === 'REJECT') qcRejectCount++;
    });

    const passRate = totalTransactions > 0 ? Math.round((qcPassCount / totalTransactions) * 100) : 100;

    return {
      totalTransactions,
      totalCtn,
      totalPcs,
      qcPassCount,
      qcHoldCount,
      qcRejectCount,
      passRate
    };
  }, [incomingList]);

  // Pagination Slice (Mendukung tampilkan semua data sampai bawah)
  const isShowAll = rowsPerPage === 'ALL';
  const limit = isShowAll ? (filteredIncoming.length || 1) : (typeof rowsPerPage === 'number' ? rowsPerPage : 15);
  const totalPages = isShowAll ? 1 : Math.ceil(filteredIncoming.length / limit) || 1;
  
  const paginatedData = useMemo(() => {
    if (rowsPerPage === 'ALL') {
      return filteredIncoming;
    }
    const perPage = typeof rowsPerPage === 'number' ? rowsPerPage : 15;
    const start = (currentPage - 1) * perPage;
    return filteredIncoming.slice(start, start + perPage);
  }, [filteredIncoming, currentPage, rowsPerPage]);

  const handleSort = (field: keyof IncomingItem) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // SQL Setup Script for public.incoming table
  const sqlSetupCode = `-- EKSEKUSI DI SQL EDITOR DATABASE JIKA TABEL INCOMING BELUM ADA
CREATE TABLE IF NOT EXISTS public.incoming (
    id_incoming VARCHAR(100) PRIMARY KEY NOT NULL,
    jenis VARCHAR(100) DEFAULT 'Reguler',
    id_distributor VARCHAR(50),
    distributor VARCHAR(255),
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Finished Good',
    location VARCHAR(100) DEFAULT 'WH-A-01',
    location_type VARCHAR(50) DEFAULT 'Rack',
    first_qty NUMERIC(12,2) DEFAULT 0,
    last_qty NUMERIC(12,2) DEFAULT 0,
    uom VARCHAR(50) DEFAULT 'CTN',
    qty_convert NUMERIC(12,2) DEFAULT 0,
    uom_convert VARCHAR(50) DEFAULT 'PCS',
    lpn_serial_number VARCHAR(100),
    batch VARCHAR(100),
    vendor_batch VARCHAR(100),
    sloc VARCHAR(50) DEFAULT 'SL01',
    expired_date DATE,
    destination_code VARCHAR(100) DEFAULT 'DST-01',
    qc_code VARCHAR(50) DEFAULT 'QC-PASS',
    user_tally VARCHAR(100) DEFAULT 'Petugas Tally',
    shelf_life VARCHAR(50) DEFAULT '24 Bulan',
    source VARCHAR(100) DEFAULT 'Supplier',
    user_input VARCHAR(100) DEFAULT 'Operator',
    tanggal_update TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    status VARCHAR(50) DEFAULT 'Received',
    tujuan VARCHAR(255) DEFAULT 'Warehouse Utama',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_incoming_item_code ON public.incoming(item_code);
CREATE INDEX IF NOT EXISTS idx_incoming_distributor ON public.incoming(id_distributor);
CREATE INDEX IF NOT EXISTS idx_incoming_batch ON public.incoming(batch);
CREATE INDEX IF NOT EXISTS idx_incoming_status ON public.incoming(status);
CREATE INDEX IF NOT EXISTS idx_incoming_created_at ON public.incoming(created_at DESC);`;

  return (
    <div className="space-y-6">
      {/* Warning banner if table is not found or error occurred */}
      {lastSupabaseError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Peringatan Database:</span> {lastSupabaseError}
            </div>
          </div>
          <button
            onClick={() => setShowSqlSetupModal(true)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[11px] shrink-0 cursor-pointer shadow-2xs"
          >
            Lihat SQL Setup
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACTION CONTROLS & SEARCH BAR */}
      {/* ========================================================================= */}
      <div className="glass-box p-4 bg-white/90 border border-slate-200/90 shadow-sm rounded-2xl space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari ID Incoming, Item Code, Nama Barang, Batch, Distributor, Tally..."
              className={`w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-800 text-xs pl-9 pr-16 py-2.5 rounded-xl border focus:ring-2 outline-none transition-all shadow-2xs ${
                isListeningSearch
                  ? 'border-rose-400 ring-2 ring-rose-200 focus:ring-rose-400'
                  : 'border-slate-300/80 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={toggleSpeechToTextSearch}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isListeningSearch
                    ? 'bg-rose-500 text-white shadow-xs animate-pulse'
                    : 'text-slate-500 hover:text-blue-900 hover:bg-slate-200/60'
                }`}
                title={isListeningSearch ? 'Berhenti mendengarkan' : 'Pencarian Suara (Speech to Text)'}
              >
                <Mic size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tombol Tambah Manual */}
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>Input Kedatangan</span>
            </button>

            {/* Tombol Download Template Excel (Tampil hanya di Desktop) */}
            <button
              onClick={downloadExcelTemplate}
              className="hidden lg:flex px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300/80 transition-all items-center gap-1.5 cursor-pointer"
              title="Download Template Excel (.xlsx) Standar"
            >
              <FileDown size={14} className="text-emerald-600" />
              <span>Template Excel</span>
            </button>

            {/* Tombol Upload Excel (Tampil hanya di Desktop) */}
            <button
              onClick={handleOpenExcelModal}
              className="hidden lg:flex px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-sm hover:shadow transition-all items-center gap-1.5 cursor-pointer"
              title="Upload & Import Excel Masal"
            >
              <Upload size={14} />
              <span>Upload Excel</span>
            </button>

            {/* Tombol Export / Download Excel (Tampil hanya di Desktop) */}
            <button
              onClick={handleExportExcel}
              className="hidden lg:flex px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all items-center gap-1.5 cursor-pointer"
              title="Download Seluruh Data Hasil Filter ke Excel"
            >
              <Download size={14} />
              <span>Download Excel</span>
            </button>

            {/* Tombol Sinkronkan ke Database */}
            <button
              onClick={handlePushAllToSupabase}
              disabled={isPushing}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Kirim dan sinkronkan seluruh data lokal ke database cloud"
            >
              <RefreshCw size={13} className={isPushing ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
              <span className="hidden md:inline">{isPushing ? 'Syncing...' : 'Sinkron Database'}</span>
            </button>

            {/* Tombol Refresh Data */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300/80 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Refresh Data dari Database"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-600'} />
              <span className="hidden lg:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Badges Bar */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 text-xs no-scrollbar">
          <div className="flex items-center gap-1 text-slate-500 font-bold text-[11px] shrink-0 mr-1">
            <Filter size={12} /> Filter:
          </div>

          {/* 1. Filter Tanggal Input (Dinamis dari Isi Kolom Tabel) */}
          <select
            value={dateFilter}
            onChange={e => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-slate-300 outline-none cursor-pointer hover:border-slate-400"
          >
            <option value="ALL">Tanggal Input: Semua</option>
            {uniqueDates.map(dateStr => (
              <option key={dateStr} value={dateStr}>
                Tanggal: {dateStr}
              </option>
            ))}
          </select>

          {/* 2. Filter Status QC (Dinamis dari Isi Kolom Tabel) */}
          <select
            value={qcFilter}
            onChange={e => {
              setQcFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-slate-300 outline-none cursor-pointer hover:border-slate-400"
          >
            <option value="ALL">Status QC: Semua</option>
            {uniqueQcStatuses.map(qc => (
              <option key={qc} value={qc}>
                QC: {qc}
              </option>
            ))}
          </select>

          {/* 3. Filter Jenis (Dinamis dari Isi Kolom Tabel) */}
          <select
            value={jenisFilter}
            onChange={e => {
              setJenisFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-slate-300 outline-none cursor-pointer hover:border-slate-400"
          >
            <option value="ALL">Jenis: Semua</option>
            {uniqueJenisList.map(j => (
              <option key={j} value={j}>
                Jenis: {j}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {(dateFilter !== 'ALL' || qcFilter !== 'ALL' || jenisFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setDateFilter('ALL');
                setQcFilter('ALL');
                setJenisFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-[11px] text-red-600 font-bold hover:underline px-2 py-1 shrink-0 cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. INCOMING TABLE & LIST VIEW */}
      {/* ========================================================================= */}
      <div className="glass-box bg-white/95 border border-slate-200/90 shadow-md rounded-2xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">Tampilan Data:</span>
            <div className="inline-flex p-0.5 bg-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setRowsPerPage('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  rowsPerPage === 'ALL'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Data (Sampai Bawah)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRowsPerPage(15);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  rowsPerPage !== 'ALL'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per Halaman (15 / 50)
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 font-medium flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
              Total {filteredIncoming.length} Baris
            </span>
            <span>• Seluruh kolom disesuaikan persis dengan Form Input Kedatangan</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Memuat transaksi kedatangan dari database...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Truck size={36} className="text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">Tidak ada data kedatangan ditemukan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || dateFilter !== 'ALL' || qcFilter !== 'ALL' || jenisFilter !== 'ALL'
                ? 'Tidak ada baris yang cocok dengan kata kunci atau filter yang dipilih.'
                : 'Belum ada transaksi kedatangan barang. Klik tombol "Input Kedatangan" atau "Upload Excel" untuk menambahkan.'}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 cursor-pointer"
              >
                + Tambah Kedatangan
              </button>
              <button
                onClick={downloadExcelTemplate}
                className="hidden lg:inline-flex px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Unduh Template Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/95 text-slate-700 font-black border-b border-slate-200 select-none">
                  {/* 1. No */}
                  <th className="py-3 px-3 w-12 text-center bg-slate-100/95">No</th>

                  {/* 2. Jenis */}
                  <th
                    onClick={() => handleSort('jenis')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Jenis"
                  >
                    <div className="flex items-center gap-1">
                      <span>Jenis</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 3. Distributor */}
                  <th
                    onClick={() => handleSort('distributor')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Distributor"
                  >
                    <div className="flex items-center gap-1">
                      <span>Distributor</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 4. Produk */}
                  <th
                    onClick={() => handleSort('item_name')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Produk"
                  >
                    <div className="flex items-center gap-1">
                      <span>Produk</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 5. Batch */}
                  <th
                    onClick={() => handleSort('batch')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Batch"
                  >
                    <div className="flex items-center gap-1">
                      <span>Batch</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 6. Expired Date */}
                  <th
                    onClick={() => handleSort('expired_date')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Expired Date"
                  >
                    <div className="flex items-center gap-1">
                      <span>Expired Date</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 7. Qty */}
                  <th
                    onClick={() => handleSort('last_qty')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-blue-900"
                    title="Urutkan Qty"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Qty</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 8. Satuan */}
                  <th
                    onClick={() => handleSort('uom')}
                    className="py-3 px-3 text-center cursor-pointer hover:text-blue-900"
                    title="Urutkan Satuan"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Satuan</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 9. Rak */}
                  <th
                    onClick={() => handleSort('location')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Rak"
                  >
                    <div className="flex items-center gap-1">
                      <span>Rak</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 10. Status QC */}
                  <th
                    onClick={() => handleSort('qc_code')}
                    className="py-3 px-3 text-center cursor-pointer hover:text-blue-900"
                    title="Urutkan Status QC"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status QC</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 11. Tanggal Input */}
                  <th
                    onClick={() => handleSort('created_at')}
                    className="py-3 px-3 cursor-pointer hover:text-blue-900"
                    title="Urutkan Tanggal Input"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tanggal Input</span>
                      <ArrowUpDown size={11} className="opacity-60" />
                    </div>
                  </th>

                  {/* 12. Aksi (Paling Belakang, Tanpa Freeze Panes) */}
                  <th className="py-3 px-3 text-center w-24 bg-slate-100/95">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {paginatedData.map((item, index) => {
                  const rowNum = rowsPerPage === 'ALL' 
                    ? index + 1 
                    : (currentPage - 1) * (typeof rowsPerPage === 'number' ? rowsPerPage : 15) + index + 1;
                    
                  const qc = (item.qc_code || 'Lulus').toUpperCase();

                  let qcBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (qc === 'KARANTINA' || qc === 'QC-HOLD' || qc === 'HOLD') qcBadgeClass = 'bg-amber-50 text-amber-800 border-amber-300';
                  else if (qc === 'REPACK' || qc === 'QC-REJECT' || qc === 'REJECT') qcBadgeClass = 'bg-orange-50 text-orange-800 border-orange-300';
                  else if (qc === 'PENDING') qcBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';

                  return (
                    <tr key={item.id_incoming} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. No */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold text-[11px] bg-white/95">{rowNum}</td>

                      {/* 2. Jenis Kedatangan */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.jenis || 'ADMK'}
                        </span>
                      </td>

                      {/* 3. Nama Distributor */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 max-w-[220px] truncate" title={item.distributor || '-'}>
                        {item.distributor || '-'}
                      </td>

                      {/* 4. Nama Barang */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 max-w-[280px] truncate" title={item.item_name}>
                        <div className="flex flex-col">
                          <span className="truncate">{item.item_name}</span>
                          {item.item_code && (
                            <span className="text-[10px] font-mono text-slate-400 font-normal">{item.item_code}</span>
                          )}
                        </div>
                      </td>

                      {/* 5. No. Batch */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.batch || '-'}
                        </span>
                      </td>

                      {/* 6. Expired Date */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {item.expired_date || '-'}
                      </td>

                      {/* 7. Qty Diterima */}
                      <td className="py-2.5 px-3 text-right font-black text-emerald-800 text-sm">
                        {item.last_qty?.toLocaleString('id-ID') ?? 0}
                      </td>

                      {/* 8. Satuan */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                        {item.uom || 'CTN'}
                      </td>

                      {/* 9. Lokasi Penempatan */}
                      <td className="py-2.5 px-3 font-bold text-slate-700">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-blue-600 shrink-0" />
                          {item.location || 'WH-A-01'}
                        </span>
                      </td>

                      {/* 10. Status QC */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${qcBadgeClass}`}>
                          {qc}
                        </span>
                      </td>

                      {/* 11. Tanggal Input */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 font-semibold">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : (item.tanggal_update || '-')}
                      </td>

                      {/* 12. Aksi (Paling Belakang, Tanpa Freeze Panes) */}
                      <td className="py-2.5 px-3 text-center bg-white/95">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(item)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Lihat Detail Transaksi"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Edit Transaksi"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredIncoming.length > 0 && (
          <div className="p-3 bg-slate-50/90 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold flex-wrap">
              <span>
                {rowsPerPage === 'ALL'
                  ? `Menampilkan seluruh ${filteredIncoming.length} data kedatangan (semua baris ditampilkan)`
                  : `Menampilkan ${(currentPage - 1) * (typeof rowsPerPage === 'number' ? rowsPerPage : 15) + 1} - ${Math.min(currentPage * (typeof rowsPerPage === 'number' ? rowsPerPage : 15), filteredIncoming.length)} dari ${filteredIncoming.length} data`}
              </span>
              <span className="text-slate-300">|</span>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">Mode Tampilan:</span>
                <select
                  value={rowsPerPage}
                  onChange={e => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setRowsPerPage(val);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs outline-none cursor-pointer focus:border-blue-500"
                >
                  <option value="ALL">Semua Data (Sampai Bawah)</option>
                  <option value={15}>15 Baris per Hal</option>
                  <option value={25}>25 Baris per Hal</option>
                  <option value={50}>50 Baris per Hal</option>
                  <option value={100}>100 Baris per Hal</option>
                </select>
              </label>
            </div>

            {rowsPerPage !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-black text-slate-800 text-xs">
                  Hal {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: INPUT / EDIT KEDATANGAN BARANG */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black m-0 leading-tight">
                    {isEditMode ? 'Edit Transaksi Kedatangan' : 'Input Kedatangan Barang Baru'}
                  </h3>
                  <p className="text-xs text-emerald-100 m-0">
                    Form pencatatan penerimaan barang & verifikasi tally inbound
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-4 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Row 1: Jenis Kedatangan & Tujuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Jenis Kedatangan *</label>
                  <select
                    value={formData.jenis || 'ADMK'}
                    onChange={e => setFormData({ ...formData, jenis: e.target.value })}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-bold cursor-pointer text-xs"
                  >
                    <option value="ADMK">ADMK</option>
                    <option value="BTB">BTB</option>
                    <option value="RETUR">RETUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tujuan</label>
                  <input
                    type="text"
                    value={formData.tujuan || ''}
                    onChange={e => setFormData({ ...formData, light_tujuan: e.target.value, tujuan: e.target.value })}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    placeholder="Contoh: Warehouse Utama"
                  />
                </div>
              </div>

              {/* Row 2: Distributor (Pencarian Interaktif Tanpa Field Nama Terpisah) */}
              <div className="relative">
                <label className="block text-slate-700 font-bold mb-1">
                  Distributor
                </label>

                {formData.distributor ? (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        <Building2 size={15} />
                      </div>
                      <div className="truncate">
                        <div className="font-extrabold text-slate-900 text-xs truncate">
                          {formData.distributor}
                        </div>
                        <div className="text-[10px] font-mono text-blue-900 font-bold">
                          Kode LD: {formData.id_distributor || 'Manual / Custom'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, id_distributor: '', distributor: '' }));
                        setDistributorSearchText('');
                        setIsDistributorDropdownOpen(true);
                      }}
                      className="px-3 py-1 text-[11px] font-bold text-blue-900 hover:text-blue-700 bg-white hover:bg-blue-100/50 border border-blue-300 rounded-xl shrink-0 cursor-pointer transition-all shadow-2xs"
                    >
                      Ganti Distributor
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={distributorSearchText}
                        onChange={e => {
                          setDistributorSearchText(e.target.value);
                          setIsDistributorDropdownOpen(true);
                        }}
                        onFocus={() => {
                          fetchMasterData();
                          setIsDistributorDropdownOpen(true);
                        }}
                        placeholder="Ketik untuk mencari distributor (nama atau kode LD)..."
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl pl-8.5 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-blue-600 font-semibold text-xs shadow-2xs"
                      />
                      {distributorSearchText && (
                        <button
                          type="button"
                          onClick={() => {
                            setDistributorSearchText('');
                            setIsDistributorDropdownOpen(true);
                          }}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {isDistributorDropdownOpen && (
                      <div 
                        onMouseDown={e => e.stopPropagation()}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-300 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100"
                      >
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-blue-900" />
                            Master Data Distributor ({filteredDistributors.length} dari {distributorList.length} Total)
                          </span>
                          <div className="flex items-center gap-2">
                            {distributorSearchText && (
                              <button
                                type="button"
                                onClick={() => setDistributorSearchText('')}
                                className="text-[10px] text-blue-700 hover:underline font-semibold"
                              >
                                Tampilkan Semua
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsDistributorDropdownOpen(false)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 font-normal"
                            >
                              Tutup ✕
                            </button>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                          {filteredDistributors.length > 0 ? (
                            filteredDistributors.map(d => (
                              <button
                                key={d.kode_ld}
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleSelectDistributorItem(d)}
                                className="w-full text-left p-3 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer group"
                              >
                                <div className="truncate">
                                  <div className="font-bold text-slate-800 group-hover:text-blue-900 truncate">
                                    {d.nama_distributor}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>Kode LD: <span className="font-bold text-blue-900">{d.kode_ld}</span></span>
                                    {d.status && (
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        d.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {d.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight size={13} className="text-slate-400 group-hover:text-blue-900 shrink-0" />
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                              <p className="m-0 mb-2 font-semibold">Distributor tidak ditemukan di Master</p>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {distributorSearchText.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        id_distributor: '',
                                        distributor: distributorSearchText.trim()
                                      }));
                                      setIsDistributorDropdownOpen(false);
                                    }}
                                    className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-[11px] cursor-pointer shadow-2xs transition-all"
                                  >
                                    Gunakan "{distributorSearchText}"
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setDistributorSearchText('')}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-all"
                                >
                                  Tampilkan Semua ({distributorList.length})
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 3: Produk (Pencarian Interaktif dengan Suara / Speech-to-Text) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Produk *
                  </label>
                  <div className="flex items-center gap-1.5">
                    {/* Speech to text indicator / button */}
                    <button
                      type="button"
                      onClick={toggleSpeechToTextBarang}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                        isListeningBarang
                          ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-300'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                      }`}
                      title={isListeningBarang ? 'Klik untuk menghentikan pendengaran suara' : 'Klik untuk berbicara (Speech to Text) mencari produk'}
                    >
                      {isListeningBarang ? (
                        <>
                          <Radio size={12} className="animate-spin text-white" />
                          <span>Mendengarkan Suara...</span>
                        </>
                      ) : (
                        <>
                          <Mic size={12} className="text-emerald-700" />
                          <span>Bicara / Suara</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Speech feedback banner when listening or just detected */}
                {speechFeedbackBarang && (
                  <div className="mb-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs animate-fade-in shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold overflow-hidden">
                      <Volume2 size={14} className={`shrink-0 ${isListeningBarang ? 'animate-bounce text-emerald-600' : 'text-emerald-600'}`} />
                      <span className="truncate">{speechFeedbackBarang}</span>
                    </div>
                    {isListeningBarang && (
                      <span className="flex h-2 w-2 relative shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                )}

                {formData.item_name && formData.item_code ? (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        <Package size={16} />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-100 text-emerald-900 font-mono font-black px-1.5 py-0.5 rounded text-[10px] border border-emerald-300">
                            {formData.item_code}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {formData.category || 'Finished Good'} • UOM: {formData.uom || 'CTN'}
                          </span>
                        </div>
                        <div className="font-extrabold text-slate-900 text-xs truncate mt-0.5" title={formData.item_name}>
                          {formData.item_name}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, item_code: '', item_name: '' }));
                        setBarangSearchText('');
                        setIsBarangDropdownOpen(true);
                      }}
                      className="px-3 py-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-xl shrink-0 cursor-pointer transition-all shadow-2xs"
                    >
                      Ganti Barang
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={barangSearchText}
                        onChange={e => {
                          setBarangSearchText(e.target.value);
                          setIsBarangDropdownOpen(true);
                        }}
                        onFocus={() => {
                          fetchMasterData();
                          setIsBarangDropdownOpen(true);
                        }}
                        placeholder="Ketik atau klik mikrofon untuk sebutkan nama produk..."
                        className={`w-full bg-white text-slate-800 border rounded-xl pl-8.5 pr-16 py-2.5 outline-none focus:ring-2 font-semibold text-xs shadow-2xs transition-all ${
                          isListeningBarang
                            ? 'border-rose-400 ring-2 ring-rose-200 focus:ring-rose-400'
                            : 'border-slate-300 focus:ring-emerald-500'
                        }`}
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        {barangSearchText && (
                          <button
                            type="button"
                            onClick={() => {
                              setBarangSearchText('');
                              setIsBarangDropdownOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                            title="Hapus teks"
                          >
                            <X size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={toggleSpeechToTextBarang}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isListeningBarang
                              ? 'bg-rose-500 text-white shadow-xs animate-pulse'
                              : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900'
                          }`}
                          title={isListeningBarang ? 'Berhenti mendengarkan' : 'Pencarian Suara (Speech to Text)'}
                        >
                          <Mic size={14} />
                        </button>
                      </div>
                    </div>

                    {isBarangDropdownOpen && (
                      <div 
                        onMouseDown={e => e.stopPropagation()}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-300 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100"
                      >
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Package size={13} className="text-emerald-600" />
                            Master Data Barang ({filteredBarangList.length} dari {barangList.length} Total)
                          </span>
                          <div className="flex items-center gap-2">
                            {barangSearchText && (
                              <button
                                type="button"
                                onClick={() => setBarangSearchText('')}
                                className="text-[10px] text-emerald-700 hover:underline font-semibold"
                              >
                                Tampilkan Semua
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsBarangDropdownOpen(false)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 font-normal"
                            >
                              Tutup ✕
                            </button>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                          {filteredBarangList.length > 0 ? (
                            filteredBarangList.map(b => (
                              <button
                                key={b.item_code}
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleSelectBarangItem(b)}
                                className="w-full text-left p-3 hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer group"
                              >
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-200">
                                      {b.item_code}
                                    </span>
                                    {b.barcode && (
                                      <span className="text-[10px] font-mono text-slate-500">
                                        Barcode: {b.barcode}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400">• {b.category || 'Finished Good'}</span>
                                    {b.uom && (
                                      <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1 py-0.2 rounded">
                                        {b.uom}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-bold text-slate-800 group-hover:text-emerald-800 truncate mt-1">
                                    {b.item_name}
                                  </div>
                                </div>
                                <ChevronRight size={13} className="text-slate-400 group-hover:text-emerald-600 shrink-0" />
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                              <p className="m-0 mb-2 font-semibold">Barang tidak ditemukan di Master Barang</p>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {barangSearchText.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const customName = barangSearchText.trim();
                                      const customCode = 'SKU-' + Date.now().toString().slice(-6);
                                      setFormData(prev => {
                                        const currentBatch = (prev.batch || '').trim().toUpperCase();
                                        let autoEd = prev.expired_date;
                                        let autoShelf = prev.shelf_life;
                                        if (currentBatch && customName) {
                                          const comp = getEdIsoDateString(customCode, customName, currentBatch);
                                          if (comp && comp.isoDate) {
                                            autoEd = comp.isoDate;
                                            autoShelf = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
                                          }
                                        }
                                        return {
                                          ...prev,
                                          item_code: customCode,
                                          item_name: customName,
                                          expired_date: autoEd,
                                          shelf_life: autoShelf
                                        };
                                      });
                                      setIsBarangDropdownOpen(false);
                                    }}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] cursor-pointer shadow-2xs transition-all"
                                  >
                                    Gunakan "{barangSearchText}"
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setBarangSearchText('')}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-all"
                                >
                                  Tampilkan Semua ({barangList.length})
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 4: Batch & ED (Otomatis Dihitung dari Aturan Cek Expired Date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">Batch</label>
                    {formData.batch && (
                      <span className="text-[10px] text-blue-900 font-semibold font-mono">
                        Batch: {formData.batch}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={e => {
                      const newBatch = e.target.value.toUpperCase();
                      const currentItemName = formData.item_name || barangSearchText || '';
                      const currentItemCode = formData.item_code || '';
                      
                      let nextEd = formData.expired_date;
                      let nextShelfLife = formData.shelf_life;
                      
                      if (newBatch.trim() && currentItemName.trim()) {
                        const comp = getEdIsoDateString(currentItemCode, currentItemName, newBatch.trim());
                        if (comp && comp.isoDate) {
                          nextEd = comp.isoDate;
                          nextShelfLife = comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`;
                        }
                      }
                      
                      setFormData(prev => ({
                        ...prev,
                        batch: newBatch,
                        vendor_batch: newBatch,
                        expired_date: nextEd,
                        shelf_life: nextShelfLife
                      }));
                    }}
                    placeholder="Contoh: L911346N atau 0456"
                    className="w-full bg-white font-mono font-bold text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold flex items-center gap-1">
                      <span>ED</span>
                      {formData.expired_date && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                          <Sparkles size={10} /> Auto
                        </span>
                      )}
                    </label>
                    {formData.batch && (formData.item_name || barangSearchText) && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentBatch = (formData.batch || '').trim().toUpperCase();
                          const currentItemName = formData.item_name || barangSearchText || '';
                          const currentItemCode = formData.item_code || '';
                          if (currentBatch && currentItemName) {
                            const comp = getEdIsoDateString(currentItemCode, currentItemName, currentBatch);
                            if (comp && comp.isoDate) {
                              setFormData(prev => ({
                                ...prev,
                                expired_date: comp.isoDate,
                                shelf_life: comp.result.sledEd?.getFullYear() === 9999 ? 'Non-Expired' : `${comp.result.lamaEdTahun * 12} Bulan`
                              }));
                              showToast('ED Dihitung Ulang', `Expired date: ${comp.isoDate}`, 'info');
                            }
                          }
                        }}
                        className="text-[10px] text-blue-900 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                        title="Hitung ulang Expired Date berdasarkan Batch & Nama Barang"
                      >
                        <RefreshCw size={10} /> Hitung Ulang
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.expired_date || ''}
                    onChange={e => setFormData({ ...formData, expired_date: e.target.value })}
                    className="w-full bg-white font-bold text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Row 5: Quantities (Qty & Unit) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200">
                <div>
                  <label className="block text-emerald-900 font-bold mb-1">Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.last_qty === 0 || formData.last_qty === undefined || formData.last_qty === null ? '' : formData.last_qty}
                    onChange={e => {
                      const raw = e.target.value;
                      const val = raw === '' ? 0 : parseFloat(raw) || 0;
                      setFormData({ ...formData, last_qty: val, first_qty: val, qty_convert: val });
                    }}
                    placeholder="0"
                    className="w-full bg-white text-emerald-900 font-black border border-emerald-400 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Unit</label>
                  <select
                    value={formData.uom || 'CTN'}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    <option value="CTN">CTN</option>
                    <option value="PCS">PCS</option>
                    {formData.uom && formData.uom !== 'CTN' && formData.uom !== 'PCS' && (
                      <option value={formData.uom}>{formData.uom}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 6: Rak & Status QC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Rak</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Contoh: WH-A-01"
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Status QC</label>
                  <select
                    value={formData.qc_code || 'Lulus'}
                    onChange={e => setFormData({ ...formData, qc_code: e.target.value })}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Lulus">Lulus</option>
                    <option value="Karantina">Karantina</option>
                    <option value="Repack">Repack</option>
                    <option value="Reject">Reject</option>
                    {formData.qc_code && !['Lulus', 'Karantina', 'Repack', 'Reject'].includes(formData.qc_code) && (
                      <option value={formData.qc_code}>{formData.qc_code}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan Transaksi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: DETAIL TRANSAKSI KEDATANGAN */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider uppercase">
                    DETAIL TRANSAKSI INBOUND
                  </span>
                  <h3 className="text-base font-black m-0 leading-tight">
                    {selectedItem.id_incoming}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Product Highlight Banner */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    SKU: {selectedItem.item_code}
                  </span>
                  <h4 className="text-sm font-black text-slate-800 mt-1">{selectedItem.item_name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">Distributor: {selectedItem.distributor || '-'}</p>
                </div>
                <div className="text-right sm:text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Qty Fisik Masuk</span>
                  <span className="text-xl font-black text-emerald-700">
                    {selectedItem.last_qty?.toLocaleString('id-ID')} {selectedItem.uom || 'CTN'}
                  </span>
                </div>
              </div>

              {/* Spec Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Jenis Inbound:</span>
                  <span className="font-bold text-slate-800">{selectedItem.jenis || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">No Batch:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.batch || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Expired Date:</span>
                  <span className="font-bold text-slate-800">{selectedItem.expired_date || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Lokasi Rak:</span>
                  <span className="font-bold text-slate-800">{selectedItem.location || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">SLoc:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.sloc || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Status QC:</span>
                  <span className="font-black text-emerald-700">{selectedItem.qc_code || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Petugas Tally:</span>
                  <span className="font-bold text-slate-800">{selectedItem.user_tally || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">LPN / Seri:</span>
                  <span className="font-mono text-slate-800">{selectedItem.lpn_serial_number || '-'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Tujuan:</span>
                  <span className="font-bold text-slate-800">{selectedItem.tujuan || '-'}</span>
                </div>
              </div>

              {/* Footer Timestamp */}
              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200 flex justify-between items-center">
                <span>Dibuat: {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('id-ID') : '-'}</span>
                <span>User Input: {selectedItem.user_input || '-'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenEditModal(selectedItem);
                }}
                className="px-4 py-2 rounded-xl bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 size={13} /> Edit Data Ini
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: UPLOAD EXCEL BATCH IMPORT */}
      {/* ========================================================================= */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black m-0 leading-tight">
                    Import Excel Kedatangan Barang
                  </h3>
                  <p className="text-xs text-blue-200 m-0">
                    Upload file .xlsx / .xls / .csv untuk memasukkan data secara massal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Template Download Box */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-blue-700 shrink-0" />
                  <span className="text-blue-900 text-[11px]">
                    Gunakan template standar agar nama kolom terbaca dengan sempurna.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <Download size={12} /> Unduh Template
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/60 hover:bg-blue-50/40 space-y-2"
              >
                <Upload size={32} className="text-slate-400 mx-auto" />
                <div className="font-bold text-slate-700 text-xs">
                  {excelFileName ? (
                    <span className="text-blue-900 font-extrabold">{excelFileName}</span>
                  ) : (
                    'Klik di sini untuk memilih file Excel (.xlsx, .xls, .csv)'
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Maksimal 5.000 baris per file</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Parsed Rows Preview */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Pratinjau Data ({parsedExcelRows.length} baris siap diimpor):</span>
                    <span className="text-emerald-600 flex items-center gap-1 text-[11px]">
                      <CheckCircle2 size={13} /> Format Valid
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 text-[11px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-200/80 sticky top-0 font-bold text-slate-700">
                        <tr>
                          <th className="p-2">ID Incoming</th>
                          <th className="p-2">Item Code</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2">Batch</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-center">QC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedExcelRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-white">
                            <td className="p-2 font-mono">{r.id_incoming}</td>
                            <td className="p-2 font-mono font-bold">{r.item_code}</td>
                            <td className="p-2 truncate max-w-[150px]">{r.item_name}</td>
                            <td className="p-2 font-mono">{r.batch || '-'}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{r.last_qty} {r.uom}</td>
                            <td className="p-2 text-center font-bold text-slate-700">{r.qc_code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedExcelRows.length > 10 && (
                    <p className="text-[10px] text-slate-400 text-center">
                      ...dan {parsedExcelRows.length - 10} baris lainnya
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitExcelImport}
                disabled={parsedExcelRows.length === 0 || isProcessingExcel}
                className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold shadow-md hover:shadow-lg disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <Check size={15} />
                <span>{isProcessingExcel ? 'Memproses...' : `Impor ${parsedExcelRows.length} Data`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 m-0">Hapus Data Kedatangan?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Anda yakin ingin menghapus transaksi <span className="font-mono font-bold text-slate-800">{selectedItem.id_incoming}</span> ({selectedItem.item_name})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: SQL SETUP HELPER */}
      {/* ========================================================================= */}
      {showSqlSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database size={20} className="text-emerald-400" />
                <div>
                  <h3 className="text-base font-black m-0 leading-tight">
                    Setup Skema Tabel Database (public.incoming)
                  </h3>
                  <p className="text-xs text-slate-400 m-0">
                    Salin script SQL di bawah dan eksekusi pada SQL Editor database jika tabel belum tersedia.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlSetupModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Script SQL DDL public.incoming:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sqlSetupCode);
                    showToast('Tersalin', 'Script SQL berhasil disalin ke clipboard!', 'success');
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={12} /> Salin SQL
                </button>
              </div>

              <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-64 border border-slate-800 leading-relaxed">
                {sqlSetupCode}
              </pre>
            </div>

            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSqlSetupModal(false)}
                className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-900 cursor-pointer"
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
