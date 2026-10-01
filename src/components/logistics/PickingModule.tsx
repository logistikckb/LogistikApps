import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  PackageCheck,
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
  Flame,
  ArrowRight,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Truck,
  Share2,
  Target,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  ClipboardPaste,
  Globe,
  Settings,
  ExternalLink,
  CloudDownload,
  CloudUpload,
  Code2,
  Table
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { PickingItem } from '../../types';
import { SEED_PICKING_ITEMS } from '../../data/seedPickingData';
import {
  syncDataToSpreadsheet,
  readDataFromSpreadsheet,
  validateWebhookUrl,
  testSpreadsheetWebhook,
  exportToExcelFile,
  APPS_SCRIPT_TEMPLATE,
  DEFAULT_LOGISTIK_SPREADSHEET_ID,
  getGlobalSpreadsheetConfig,
  saveGlobalSpreadsheetConfig,
  PICKING_DEFAULT_HEADERS,
  deleteRowsFromSpreadsheet,
  clearSheetDataFromSpreadsheet
} from '../../services/spreadsheetSyncService';

// Destination options for bulk transfer from Picking
export interface DestinationOption {
  id: string;
  name: string;
  sheetName: string;
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
  storageKey: string;
  description: string;
}

export const PICKING_BULK_DESTINATIONS: DestinationOption[] = [
  {
    id: 'penyiapan',
    name: 'Penyiapan',
    sheetName: 'Penyiapan',
    idPrefix: 'PEN-',
    idField: 'id_penyiapan',
    defaultSloc: 'SL02',
    defaultLocation: 'WH-B-01',
    defaultLocationType: 'Floor',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-02',
    defaultStatus: 'Ready',
    defaultTujuan: 'Pengiriman Cabang',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Penyiapan',
    storageKey: 'penyiapan_cache_v1',
    description: 'Sheet: Penyiapan - Outbound Staging'
  },
  {
    id: 'pemusnahan',
    name: 'Pemusnahan',
    sheetName: 'Pemusnahan',
    idPrefix: 'PMS-',
    idField: 'id_pemusnahan',
    defaultSloc: 'SL99',
    defaultLocation: 'WH-REJECT-01',
    defaultLocationType: 'Quarantine',
    defaultQcCode: 'QC-REJECT',
    defaultDestinationCode: 'INCINERATOR',
    defaultStatus: 'Disposed',
    defaultTujuan: 'Pemusnahan Limbah Terkontrol',
    defaultCategory: 'Damaged',
    sourceStatusDefault: 'Terkirim ke Pemusnahan',
    storageKey: 'pemusnahan_cache_v1',
    description: 'Sheet: Pemusnahan - Karantina limbah / scrap / expired barang'
  },
  {
    id: 'reco',
    name: 'Reco',
    sheetName: 'Reco',
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
    storageKey: 'reco_cache_v1',
    description: 'Sheet: Reco - Permintaan Barang'
  },
  {
    id: 'repack',
    name: 'Repack',
    sheetName: 'Repack',
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
    storageKey: 'repack_cache_v1',
    description: 'Sheet: Repack - Repacking / Bundling Produk'
  }
];

const LOCAL_STORAGE_DB_KEY = 'picking_spreadsheet_db';

interface PickingModuleProps {
  onNavigateToPenyiapan?: () => void;
  onNavigateToPemusnahan?: () => void;
  onNavigateToReco?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToRepack?: () => void;
}

export function PickingModule({
  onNavigateToPenyiapan,
  onNavigateToPemusnahan,
  onNavigateToReco,
  onNavigateToInventory,
  onNavigateToRepack
}: PickingModuleProps = {}) {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  // Role function: identical to Penyiapan
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin';

  // Primary Data State (Database Spreadsheet / Local Cache)
  const [pickingList, setPickingList] = useState<PickingItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DB_KEY) || localStorage.getItem('picking_cache_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Gunakan 90 data awal yang diinput user jika belum ada data tersimpan
    return SEED_PICKING_ITEMS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [slocFilter, setSlocFilter] = useState('');
  const [qcFilter, setQcFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<keyof PickingItem>('tanggal_update');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Speech to text
  const [isListening, setIsListening] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PickingItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGSheetModal, setShowGSheetModal] = useState(false);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [showHeadersModal, setShowHeadersModal] = useState(false);
  const [isCreatingHeaders, setIsCreatingHeaders] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);

  // Bulk Transfer configuration
  const [bulkDestination, setBulkDestination] = useState<DestinationOption>(PICKING_BULK_DESTINATIONS[0]);
  const [bulkTargetTujuan, setBulkTargetTujuan] = useState(PICKING_BULK_DESTINATIONS[0].defaultTujuan);
  const [bulkTargetStatus, setBulkTargetStatus] = useState(PICKING_BULK_DESTINATIONS[0].defaultStatus);
  const [bulkSourceAction, setBulkSourceAction] = useState<'update' | 'delete'>('update');
  const [bulkSourceUpdatedStatus, setBulkSourceUpdatedStatus] = useState(PICKING_BULK_DESTINATIONS[0].sourceStatusDefault);

  // Google Sheet Webhook Sync Config (Target sheet: Picking)
  const [gSheetConfig, setGSheetConfig] = useState(() => {
    const globalConf = getGlobalSpreadsheetConfig();
    const defaultEnvUrl = (import.meta.env.VITE_GSHEET_WEBHOOK_URL as string) || '';
    const defaultEnvSpreadsheetId = (import.meta.env.VITE_GSHEET_SPREADSHEET_ID as string) || DEFAULT_LOGISTIK_SPREADSHEET_ID;

    try {
      const saved = localStorage.getItem('PICKING_GSHEET_WEBHOOK_CONFIG') || localStorage.getItem('LOGISTIK_GSHEET_WEBHOOK_CONFIG');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          webhookUrl: parsed.webhookUrl || globalConf.webhookUrl || defaultEnvUrl,
          spreadsheetId: parsed.spreadsheetId || globalConf.spreadsheetId || defaultEnvSpreadsheetId,
          sheetName: 'Picking',
          secretToken: parsed.secretToken || globalConf.secretToken || '',
          mode: (parsed.mode || 'overwrite') as 'overwrite' | 'append'
        };
      }
    } catch {}
    return {
      webhookUrl: globalConf.webhookUrl || defaultEnvUrl,
      spreadsheetId: globalConf.spreadsheetId || defaultEnvSpreadsheetId,
      sheetName: 'Picking',
      secretToken: globalConf.secretToken || '',
      mode: 'overwrite' as 'overwrite' | 'append'
    };
  });

  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isPullingGSheet, setIsPullingGSheet] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testWebhookResult, setTestWebhookResult] = useState<{
    success: boolean;
    message: string;
    isHtml?: boolean;
  } | null>(null);
  const [showAppsScriptHelp, setShowAppsScriptHelp] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [gSheetSyncResult, setGSheetSyncResult] = useState<{
    success: boolean;
    message: string;
    rows?: number;
    timestamp?: string;
  } | null>(null);

  // Save changes to localStorage database
  const saveToLocalDb = (items: PickingItem[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(items));
      localStorage.setItem('picking_cache_v1', JSON.stringify(items));
    } catch (e) {
      console.warn('Gagal menyimpan ke localStorage:', e);
    }
  };

  // Helper ID generator for Picking
  const generatePickingId = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PCK-${yyyy}${mm}${dd}-${randomSuffix}`;
  };

  // Pengaturan Otomatis Hapus di Spreadsheet saat Hapus di Aplikasi
  const [autoSyncDelete, setAutoSyncDelete] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('PICKING_AUTO_SYNC_DELETE');
      return saved !== 'false'; // Default: AKTIF (true)
    } catch {
      return true;
    }
  });

  const toggleAutoSyncDelete = (enabled: boolean) => {
    setAutoSyncDelete(enabled);
    try {
      localStorage.setItem('PICKING_AUTO_SYNC_DELETE', enabled ? 'true' : 'false');
    } catch {}
  };

  // Helper memetakan item picking menjadi baris 26 kolom Google Sheets
  const mapPickingItemToRow = (item: PickingItem): any[] => [
    item.id_picking || '',
    item.tujuan || 'Picking Outbound',
    item.item_code || '',
    item.item_name || '',
    item.category || 'Finished Good',
    item.location || '',
    item.location_type || 'Floor',
    item.first_qty ?? 0,
    item.last_qty ?? 0,
    item.uom || 'CTN',
    item.qty_convert ?? 0,
    item.uom_convert || 'PCS',
    item.lpn_serial_number || '',
    item.batch || '',
    item.vendor_batch || '',
    item.sloc || 'SL02',
    item.expired_date || '',
    item.destination_code || 'DST-PICK',
    item.qc_code || 'QC-PASS',
    item.user_tally || '',
    item.shelf_life || '36 Bulan',
    item.source || 'Stok Gudang',
    item.user_input || currentUser?.nama || 'Admin',
    item.tanggal_update || new Date().toISOString().slice(0, 10),
    item.status || 'open',
    item.note || ''
  ];

  // Form State
  const initialForm: Partial<PickingItem> = {
    id_picking: '',
    tujuan: 'Picking Outbound',
    item_code: '',
    item_name: '',
    category: 'Finished Good',
    location: 'CKB-FG1-AE-21-1A',
    location_type: 'Floor',
    first_qty: 0,
    last_qty: 1,
    uom: 'CTN',
    qty_convert: 0,
    uom_convert: 'PCS',
    lpn_serial_number: '-',
    batch: '-',
    vendor_batch: '-',
    sloc: 'SL02',
    expired_date: '',
    destination_code: 'DST-PICK',
    qc_code: 'QC-PASS',
    user_tally: currentUser?.nama || 'Riyanto',
    shelf_life: '36 Bulan',
    source: 'Stok Gudang',
    user_input: currentUser?.nama || 'Admin',
    status: 'open',
    note: ''
  };
  const [formData, setFormData] = useState<Partial<PickingItem>>(initialForm);

  // Speech Recognition (Voice Search)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Peringatan', 'Browser Anda tidak mendukung Speech Recognition.', 'warning');
      return;
    }
    if (isListening) {
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
        showToast('Suara Terdeteksi', `Mencari: "${transcript}"`, 'info');
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Filtered & Sorted Picking List
  const filteredPicking = useMemo(() => {
    let result = [...pickingList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        (item.item_code || '').toLowerCase().includes(q) ||
        (item.item_name || '').toLowerCase().includes(q) ||
        (item.batch || '').toLowerCase().includes(q) ||
        (item.id_picking || '').toLowerCase().includes(q) ||
        (item.lpn_serial_number || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.tujuan || '').toLowerCase().includes(q) ||
        (item.qc_code || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter(item => (item.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (categoryFilter) {
      result = result.filter(item => (item.category || '').toLowerCase() === categoryFilter.toLowerCase());
    }
    if (slocFilter) {
      result = result.filter(item => (item.sloc || '').toLowerCase() === slocFilter.toLowerCase());
    }
    if (qcFilter) {
      result = result.filter(item => (item.qc_code || '').toLowerCase() === qcFilter.toLowerCase());
    }

    result.sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [pickingList, searchQuery, statusFilter, categoryFilter, slocFilter, qcFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredPicking.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPicking.slice(start, start + pageSize);
  }, [filteredPicking, currentPage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    const totalRows = pickingList.length;
    const totalQty = pickingList.reduce((acc, curr) => acc + (Number(curr.last_qty) || 0), 0);
    const readyCount = pickingList.filter(i => (i.status || '').toLowerCase() === 'ready' || (i.status || '').toLowerCase() === 'open').length;
    const processCount = pickingList.filter(i => (i.status || '').toLowerCase().includes('proses') || (i.status || '').toLowerCase().includes('repack')).length;
    const doneCount = pickingList.filter(i => (i.status || '').toLowerCase().includes('selesai') || (i.status || '').toLowerCase().includes('picked') || (i.status || '').toLowerCase().includes('close')).length;
    return { totalRows, totalQty, readyCount, processCount, doneCount };
  }, [pickingList]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPicking.map(item => item.id_picking));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Form Handlers
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setFormData({
      ...initialForm,
      id_picking: generatePickingId(),
      user_input: currentUser?.nama || 'Admin',
      user_tally: currentUser?.nama || 'Tally Picking'
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (item: PickingItem) => {
    setIsEditMode(true);
    setSelectedItem(item);
    setFormData({ ...item });
    setShowFormModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_code?.trim() || !formData.item_name?.trim()) {
      showToast('Validasi Gagal', 'Item Code dan Nama Barang wajib diisi!', 'warning');
      return;
    }

    const idPicking = formData.id_picking?.trim() || generatePickingId();
    const nowIso = new Date().toISOString().slice(0, 10);
    const recordToSave: PickingItem = {
      ...initialForm,
      ...formData,
      id_picking: idPicking,
      first_qty: Number(formData.first_qty) || 0,
      last_qty: Number(formData.last_qty) || Number(formData.first_qty) || 0,
      qty_convert: Number(formData.qty_convert) || 0,
      tanggal_update: nowIso,
      updated_at: new Date().toISOString(),
      created_at: selectedItem?.created_at || new Date().toISOString()
    } as PickingItem;

    const updatedList = isEditMode
      ? pickingList.map(p => p.id_picking === idPicking ? recordToSave : p)
      : [recordToSave, ...pickingList.filter(p => p.id_picking !== idPicking)];

    setPickingList(updatedList);
    saveToLocalDb(updatedList);
    setShowFormModal(false);
    showToast('Tersimpan', `Data picking ${idPicking} berhasil disimpan ke database spreadsheet.`, 'success');
  };

  // Delete Single (Role: Admin only)
  const handleDeleteItem = async (item: PickingItem) => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus data hanya dapat dilakukan oleh pengguna dengan role Admin!', 'danger');
      return;
    }

    const { valid: hasWebhook } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    const willSyncSheet = hasWebhook && autoSyncDelete;

    const confirmMsg = willSyncSheet
      ? `Apakah Anda yakin ingin menghapus data picking "${item.id_picking}" (${item.item_name})?\n\nCatatan: Karena sinkronisasi aktif, baris data ini juga akan OTOMATIS DIHAPUS dari Sheet "Picking" di Google Spreadsheet.`
      : `Apakah Anda yakin ingin menghapus data picking "${item.id_picking}" (${item.item_name})?`;

    const confirmed = await showConfirm('Hapus Data Picking', confirmMsg);
    if (!confirmed) return;

    const remaining = pickingList.filter(p => p.id_picking !== item.id_picking);
    setPickingList(remaining);
    setSelectedIds(prev => prev.filter(id => id !== item.id_picking));
    saveToLocalDb(remaining);

    if (willSyncSheet) {
      try {
        const remainingRows = remaining.map(mapPickingItemToRow);
        await deleteRowsFromSpreadsheet(gSheetConfig, {
          sheetName: 'Picking',
          ids: [item.id_picking],
          keyColumnIndex: 1,
          fallbackRemainingData: {
            headers: PICKING_DEFAULT_HEADERS,
            rows: remainingRows
          }
        });
        showToast(
          'Terhapus di Aplikasi & Spreadsheet',
          `Data ${item.id_picking} berhasil dihapus dari aplikasi dan Google Spreadsheet!`,
          'success'
        );
      } catch (err: any) {
        showToast(
          'Terhapus di Aplikasi (Spreadsheet Tertunda)',
          `Data lokal terhapus. Info Spreadsheet: ${err?.message || 'Gagal tersambung'}`,
          'warning'
        );
      }
    } else {
      showToast('Terhapus', `Data ${item.id_picking} berhasil dihapus.`, 'success');
    }
  };

  // Bulk Delete (Role: Admin only)
  const handleBulkDelete = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus massal hanya dapat dilakukan oleh pengguna dengan role Admin!', 'danger');
      return;
    }
    if (selectedIds.length === 0) return;

    const { valid: hasWebhook } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    const willSyncSheet = hasWebhook && autoSyncDelete;

    const confirmMsg = willSyncSheet
      ? `Apakah Anda yakin ingin menghapus ${selectedIds.length} item data picking yang dipilih?\n\nCatatan: Data yang dipilih juga akan OTOMATIS DIHAPUS dari Sheet "Picking" di Google Spreadsheet.`
      : `Apakah Anda yakin ingin menghapus ${selectedIds.length} item data picking yang dipilih?`;

    const confirmed = await showConfirm('Hapus Massal Data Picking', confirmMsg);
    if (!confirmed) return;

    const idsToDelete = [...selectedIds];
    const remaining = pickingList.filter(p => !idsToDelete.includes(p.id_picking));
    setPickingList(remaining);
    setSelectedIds([]);
    saveToLocalDb(remaining);

    if (willSyncSheet) {
      try {
        const remainingRows = remaining.map(mapPickingItemToRow);
        await deleteRowsFromSpreadsheet(gSheetConfig, {
          sheetName: 'Picking',
          ids: idsToDelete,
          keyColumnIndex: 1,
          fallbackRemainingData: {
            headers: PICKING_DEFAULT_HEADERS,
            rows: remainingRows
          }
        });
        showToast(
          'Hapus Massal Berhasil',
          `${idsToDelete.length} baris data berhasil dihapus dari aplikasi dan Google Spreadsheet!`,
          'success'
        );
      } catch (err: any) {
        showToast(
          'Hapus Massal Selesai',
          `${idsToDelete.length} data dihapus lokal. Info Spreadsheet: ${err?.message || 'Gagal tersambung'}`,
          'warning'
        );
      }
    } else {
      showToast('Hapus Massal Berhasil', `${idsToDelete.length} data picking berhasil dihapus.`, 'success');
    }
  };

  // Delete All Data (Role: Admin only)
  const handleDeleteAll = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi reset/hapus semua data hanya dapat dilakukan oleh pengguna dengan role Admin!', 'danger');
      return;
    }

    const { valid: hasWebhook } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    const willSyncSheet = hasWebhook && autoSyncDelete;

    const confirmMsg = willSyncSheet
      ? 'PERINGATAN! Semua data di lembar kerja Picking aplikasi DAN Google Spreadsheet akan dikosongkan (Judul kolom tetap utuh). Lanjutkan?'
      : 'PERINGATAN! Semua data di lembar kerja Picking akan dikosongkan. Lanjutkan?';

    const confirmed = await showConfirm('HAPUS SEMUA DATA PICKING', confirmMsg);
    if (!confirmed) return;

    setPickingList([]);
    setSelectedIds([]);
    saveToLocalDb([]);

    if (willSyncSheet) {
      try {
        await clearSheetDataFromSpreadsheet(gSheetConfig, 'Picking', PICKING_DEFAULT_HEADERS);
        showToast(
          'Dikosongkan',
          'Seluruh data picking di aplikasi dan Google Spreadsheet berhasil dikosongkan (Judul kolom tetap utuh).',
          'success'
        );
      } catch (err: any) {
        showToast(
          'Dikosongkan Lokal',
          `Data lokal bersih. Info Spreadsheet: ${err?.message || 'Gagal tersambung'}`,
          'warning'
        );
      }
    } else {
      showToast('Dikosongkan', 'Seluruh data picking berhasil dikosongkan.', 'info');
    }
  };

  // Hapus baris terpilih langsung di Google Spreadsheet
  const handleDeleteSelectedInSpreadsheet = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi hapus hanya dapat dilakukan oleh Admin!', 'danger');
      return;
    }
    if (selectedIds.length === 0) {
      showToast('Pilih Data', 'Centang minimal satu data di tabel untuk dihapus dari Google Spreadsheet.', 'warning');
      return;
    }

    const { valid: hasWebhook } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    if (!hasWebhook) {
      showToast('Webhook Belum Diisi', 'Isi URL Webhook Google Apps Script terlebih dahulu.', 'warning');
      return;
    }

    const confirmed = await showConfirm(
      'Hapus Baris di Google Spreadsheet',
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} baris data ini dari Sheet "Picking" di Google Spreadsheet? Data di aplikasi juga akan disinkronkan.`
    );
    if (!confirmed) return;

    setIsSyncingGSheet(true);
    try {
      const idsToDelete = [...selectedIds];
      const remaining = pickingList.filter(p => !idsToDelete.includes(p.id_picking));
      const remainingRows = remaining.map(mapPickingItemToRow);

      const res = await deleteRowsFromSpreadsheet(gSheetConfig, {
        sheetName: 'Picking',
        ids: idsToDelete,
        keyColumnIndex: 1,
        fallbackRemainingData: {
          headers: PICKING_DEFAULT_HEADERS,
          rows: remainingRows
        }
      });

      // Sinkronkan ke lokal juga
      setPickingList(remaining);
      setSelectedIds([]);
      saveToLocalDb(remaining);

      showToast(
        'Berhasil Dihapus di Spreadsheet',
        res.message || `${idsToDelete.length} baris berhasil dihapus dari Google Spreadsheet & aplikasi.`,
        'success'
      );
    } catch (err: any) {
      showToast('Gagal Hapus di Spreadsheet', err?.message || 'Terjadi kesalahan saat menghapus di Google Spreadsheet.', 'danger');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  // Kosongkan seluruh baris data di Google Spreadsheet (baris 2 ke bawah, simpan header)
  const handleClearSpreadsheetData = async () => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi ini hanya dapat dilakukan oleh Admin!', 'danger');
      return;
    }

    const { valid: hasWebhook } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    if (!hasWebhook) {
      showToast('Webhook Belum Diisi', 'Isi URL Webhook Google Apps Script terlebih dahulu.', 'warning');
      return;
    }

    const confirmed = await showConfirm(
      'KOSONGKAN DATA SHEET PICKING',
      'PERINGATAN! Seluruh baris data pada Sheet "Picking" di Google Spreadsheet akan DIHAPUS (baris 2 ke bawah). Baris 1 Judul Kolom akan tetap utuh. Lanjutkan?'
    );
    if (!confirmed) return;

    setIsSyncingGSheet(true);
    try {
      const res = await clearSheetDataFromSpreadsheet(gSheetConfig, 'Picking', PICKING_DEFAULT_HEADERS);
      showToast(
        'Data Spreadsheet Dikosongkan',
        res.message || 'Seluruh baris data di Sheet "Picking" berhasil dikosongkan. Header tetap utuh.',
        'success'
      );
    } catch (err: any) {
      showToast('Gagal Mengosongkan Spreadsheet', err?.message || 'Koneksi error.', 'danger');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  // Reset to Initial Provided Data
  const handleResetToInitialData = async () => {
    const confirmed = await showConfirm(
      'Muat Ulang Data Awal',
      'Apakah Anda ingin mereset dan memuat kembali 90 data picking standar?'
    );
    if (!confirmed) return;

    setPickingList(SEED_PICKING_ITEMS);
    saveToLocalDb(SEED_PICKING_ITEMS);
    setSelectedIds([]);
    showToast('Data Awal Dimuat', '90 data picking awal berhasil dipulihkan.', 'success');
  };

  // Bulk Transfer Execution (to other modules local storage)
  const handleExecuteBulkTransfer = async () => {
    if (selectedIds.length === 0) {
      showToast('Perhatian', 'Pilih minimal satu data picking untuk ditransfer.', 'warning');
      return;
    }

    setIsPushing(true);
    const selectedItems = pickingList.filter(p => selectedIds.includes(p.id_picking));
    const nowIso = new Date().toISOString().slice(0, 10);

    const targetItems = selectedItems.map(item => {
      const generatedTargetId = `${bulkDestination.idPrefix}${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        ...item,
        [bulkDestination.idField]: generatedTargetId,
        tujuan: bulkTargetTujuan || bulkDestination.defaultTujuan,
        status: bulkTargetStatus || bulkDestination.defaultStatus || item.status,
        sloc: bulkDestination.defaultSloc || item.sloc,
        location: bulkDestination.defaultLocation || item.location,
        destination_code: bulkDestination.defaultDestinationCode || item.destination_code,
        qc_code: bulkDestination.defaultQcCode || item.qc_code,
        category: bulkDestination.defaultCategory || item.category,
        source: 'Picking',
        user_input: currentUser?.nama || 'Admin',
        tanggal_update: nowIso,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
    });

    // Save to destination storage
    try {
      const existingRaw = localStorage.getItem(bulkDestination.storageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const merged = Array.isArray(existing) ? [...targetItems, ...existing] : targetItems;
      localStorage.setItem(bulkDestination.storageKey, JSON.stringify(merged));
    } catch (e) {
      console.warn('Gagal transfer ke target storage:', e);
    }

    // Source action: delete or update
    if (bulkSourceAction === 'delete' && isSuperAdmin) {
      const remaining = pickingList.filter(p => !selectedIds.includes(p.id_picking));
      setPickingList(remaining);
      saveToLocalDb(remaining);
    } else {
      const updatedStatus = bulkSourceUpdatedStatus || `Terkirim ke ${bulkDestination.name}`;
      const updated = pickingList.map(p => selectedIds.includes(p.id_picking) ? { ...p, status: updatedStatus, tanggal_update: nowIso } : p);
      setPickingList(updated);
      saveToLocalDb(updated);
    }

    setIsPushing(false);
    setShowBulkTransferModal(false);
    setSelectedIds([]);
    showToast('Transfer Berhasil', `Berhasil mentransfer ${selectedItems.length} item ke menu ${bulkDestination.name}.`, 'success');
  };

  // Google Sheets Webhook Sync (Target Sheet: Picking)
  const handleSyncToGoogleSheets = async () => {
    const { valid, cleanUrl, extractedSpreadsheetId, warning } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    if (!valid) {
      showToast('Perhatian', warning || 'URL Webhook Google Apps Script belum diisi.', 'warning');
      return;
    }

    setIsSyncingGSheet(true);
    setGSheetSyncResult(null);

    const dataToExport = filteredPicking.length > 0 ? filteredPicking : pickingList;

    const headers = [
      'ID Picking',
      'Tujuan',
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
      'User Input',
      'Tanggal Update',
      'Status',
      'Catatan / Note'
    ];

    const rows = dataToExport.map(item => [
      item.id_picking || '',
      item.tujuan || 'Picking Outbound',
      item.item_code || '',
      item.item_name || '',
      item.category || 'Finished Good',
      item.location || '',
      item.location_type || 'Floor',
      item.first_qty ?? 0,
      item.last_qty ?? 0,
      item.uom || 'CTN',
      item.qty_convert ?? 0,
      item.uom_convert || 'PCS',
      item.lpn_serial_number || '',
      item.batch || '',
      item.vendor_batch || '',
      item.sloc || 'SL02',
      item.expired_date || '',
      item.destination_code || 'DST-PICK',
      item.qc_code || 'QC-PASS',
      item.user_tally || '',
      item.shelf_life || '36 Bulan',
      item.source || 'Stok Gudang',
      item.user_input || currentUser?.nama || 'Admin',
      item.tanggal_update || new Date().toISOString().slice(0, 10),
      item.status || 'open',
      item.note || ''
    ]);

    const payload = {
      sheetName: 'Picking',
      spreadsheetId: gSheetConfig.spreadsheetId?.trim() || extractedSpreadsheetId || undefined,
      secretToken: gSheetConfig.secretToken || undefined,
      mode: gSheetConfig.mode || 'overwrite',
      module: 'Picking',
      action: 'sync_picking',
      headers,
      rows
    };

    try {
      saveGlobalSpreadsheetConfig({
        webhookUrl: cleanUrl,
        spreadsheetId: gSheetConfig.spreadsheetId?.trim() || extractedSpreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID
      });

      const result = await syncDataToSpreadsheet(
        { ...gSheetConfig, webhookUrl: cleanUrl },
        payload
      );
      setGSheetSyncResult({
        success: true,
        message: result.message,
        rows: result.updatedRows ?? rows.length,
        timestamp: result.timestamp || new Date().toLocaleTimeString('id-ID')
      });
      showToast('Sinkronisasi Sukses', result.message, 'success');
    } catch (err: any) {
      console.error('Picking GSheet sync error:', err);
      const errMsg = err?.message || 'Terjadi kesalahan saat menghubungi Webhook Spreadsheet.';
      setGSheetSyncResult({
        success: false,
        message: errMsg
      });
      showToast('Gagal Sinkronisasi', errMsg, 'danger');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  // Uji koneksi Webhook real-time
  const handleTestWebhook = async () => {
    if (!gSheetConfig.webhookUrl || !gSheetConfig.webhookUrl.trim()) {
      showToast('URL Kosong', 'Harap masukkan URL Webhook terlebih dahulu.', 'warning');
      return;
    }

    setIsTestingWebhook(true);
    setTestWebhookResult(null);
    try {
      const res = await testSpreadsheetWebhook({
        webhookUrl: gSheetConfig.webhookUrl.trim(),
        spreadsheetId: (gSheetConfig.spreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID).trim()
      });
      setTestWebhookResult(res);
      if (res.success) {
        showToast('Koneksi Webhook Normal', res.message, 'success');
      } else {
        showToast('Webhook Bermasalah', res.message, 'error');
      }
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghubungi Webhook';
      setTestWebhookResult({ success: false, message: msg });
      showToast('Uji Webhook Gagal', msg, 'error');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Ekspor langsung ke file Excel (.xlsx) sebagai backup offline & import manual
  const handleExportExcel = () => {
    const dataToExport = filteredPicking.length > 0 ? filteredPicking : pickingList;
    if (dataToExport.length === 0) {
      showToast('Data Kosong', 'Tidak ada data picking untuk diekspor ke Excel.', 'warning');
      return;
    }

    const headers = [
      'ID Picking', 'Tujuan', 'Item Code', 'Nama Barang', 'Kategori', 'Lokasi', 'Tipe Lokasi',
      'Qty Awal', 'Qty Akhir', 'UOM', 'Qty Convert', 'UOM Convert', 'LPN / SN', 'Batch',
      'Vendor Batch', 'SLOC', 'Expired Date', 'Kode Tujuan', 'Status QC', 'User Tally',
      'Shelf Life', 'Sumber', 'User Input', 'Tanggal Update', 'Status', 'Catatan / Note'
    ];

    const rows = dataToExport.map(item => [
      item.id_picking || '', item.tujuan || 'Picking Outbound', item.item_code || '', item.item_name || '',
      item.category || 'Finished Good', item.location || '', item.location_type || 'Floor',
      item.first_qty ?? 0, item.last_qty ?? 0, item.uom || 'CTN', item.qty_convert ?? 0, item.uom_convert || 'PCS',
      item.lpn_serial_number || '', item.batch || '', item.vendor_batch || '', item.sloc || 'SL02',
      item.expired_date || '', item.destination_code || 'DST-PICK', item.qc_code || 'QC-PASS',
      item.user_tally || '', item.shelf_life || '36 Bulan', item.source || 'Stok Gudang',
      item.user_input || currentUser?.nama || 'Admin', item.tanggal_update || new Date().toISOString().slice(0, 10),
      item.status || 'open', item.note || ''
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcelFile(`Data_Picking_${dateStr}`, 'Picking', headers, rows);
    showToast('Download Berhasil', `File Excel berisi ${rows.length} baris data Picking berhasil didownload!`, 'success');
  };

  // 1. Salin 26 Judul Kolom (Tab-Separated) untuk Paste langsung ke Google Sheets (Sel A1)
  const handleCopyHeaders = () => {
    try {
      const headerString = PICKING_DEFAULT_HEADERS.join('\t');
      navigator.clipboard.writeText(headerString);
      setCopiedHeaders(true);
      showToast(
        '26 Judul Kolom Disalin!',
        'Buka tab "Picking" di Google Spreadsheet, klik sel A1, lalu tekan Ctrl+V (Paste). 26 kolom akan terisi rapi!',
        'success'
      );
      setTimeout(() => setCopiedHeaders(false), 3000);
    } catch {
      showToast('Gagal Menyalin', 'Izin clipboard ditolak oleh peramban.', 'warning');
    }
  };

  // 2. Pasang / Buat Judul Kolom langsung ke Google Sheet via Webhook API
  const handleCreateSheetHeaders = async () => {
    const { valid, cleanUrl, extractedSpreadsheetId, warning } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    if (!valid && !gSheetConfig.spreadsheetId) {
      showToast('Perhatian', warning || 'URL Webhook Google Apps Script belum diisi.', 'warning');
      setShowGSheetModal(true);
      return;
    }

    setIsCreatingHeaders(true);
    try {
      const payload = {
        sheetName: 'Picking',
        spreadsheetId: gSheetConfig.spreadsheetId?.trim() || extractedSpreadsheetId || DEFAULT_LOGISTIK_SPREADSHEET_ID,
        secretToken: gSheetConfig.secretToken || undefined,
        mode: 'overwrite' as const,
        module: 'Picking',
        action: 'setup_headers',
        headers: PICKING_DEFAULT_HEADERS,
        rows: [] // Baris data kosong untuk setup header
      };

      const result = await syncDataToSpreadsheet(
        { ...gSheetConfig, webhookUrl: cleanUrl },
        payload
      );

      setGSheetSyncResult({
        success: true,
        message: `26 Judul Kolom pada sheet "Picking" berhasil dibuat dan dirapikan di Google Spreadsheet!`,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      showToast(
        'Judul Kolom Berhasil Dibuat!',
        '26 Judul Kolom telah terpasang di baris 1 Sheet "Picking" Google Spreadsheet dengan format warna biru dongker dan teks putih tebal.',
        'success'
      );
    } catch (err: any) {
      console.error('Error setup picking headers:', err);
      showToast('Gagal Pasang Header', err?.message || 'Gagal membuat judul kolom ke Spreadsheet.', 'danger');
    } finally {
      setIsCreatingHeaders(false);
    }
  };

  // 3. Download File Template Excel Khusus Judul Kolom (.xlsx)
  const handleDownloadHeaderTemplate = () => {
    const sampleRow = [
      'PCK-20260924-0001', 'Picking Outbound', 'FG11026.218.0050.C', 'RESIK V MJK WHITENING 50ML BTL',
      'Finished Good', 'CKB-FG1-AE-21-1A', 'Floor', 10, 10, 'CTN', 240, 'PCS',
      '-', '10RHA2516N', '10RHA2516N', 'SL02', '2029-09-08', 'DST-PICK', 'QC-PASS',
      'Riyanto', '36 Bulan', 'Stok Gudang', currentUser?.nama || 'Admin', new Date().toISOString().slice(0, 10),
      'open', 'Contoh data baris pertama'
    ];
    exportToExcelFile('Template_Header_Sheet_Picking', 'Picking', PICKING_DEFAULT_HEADERS, [sampleRow]);
    showToast('Download Berhasil', 'File Template_Header_Sheet_Picking.xlsx berhasil diunduh.', 'success');
  };

  // Pull Data from Google Spreadsheet (Sheet: Picking)
  const handlePullFromGoogleSheets = async () => {
    const { valid, warning } = validateWebhookUrl(gSheetConfig.webhookUrl || '');
    if (!valid && !gSheetConfig.spreadsheetId) {
      showToast('Perhatian', warning || 'URL Webhook Google Apps Script belum diisi.', 'warning');
      return;
    }

    setIsPullingGSheet(true);
    try {
      const result = await readDataFromSpreadsheet(gSheetConfig, 'Picking');
      if (result.success && result.rows && result.rows.length > 0) {
        // Map rows back to PickingItem
        const fetchedItems: PickingItem[] = result.rows.map((r: any[], idx: number) => ({
          id_picking: r[0] || `PCK-${idx + 1}`,
          tujuan: r[1] || 'Picking Outbound',
          item_code: r[2] || '',
          item_name: r[3] || '',
          category: r[4] || 'Finished Good',
          location: r[5] || '',
          location_type: r[6] || 'Floor',
          first_qty: Number(r[7]) || 0,
          last_qty: Number(r[8]) || 0,
          uom: r[9] || 'CTN',
          qty_convert: Number(r[10]) || 0,
          uom_convert: r[11] || 'PCS',
          lpn_serial_number: r[12] || '-',
          batch: r[13] || '-',
          vendor_batch: r[14] || '-',
          sloc: r[15] || 'SL02',
          expired_date: r[16] || '',
          destination_code: r[17] || 'DST-PICK',
          qc_code: r[18] || 'QC-PASS',
          user_tally: r[19] || '',
          shelf_life: r[20] || '36 Bulan',
          source: r[21] || 'Stok Gudang',
          user_input: r[22] || 'Admin',
          tanggal_update: r[23] || new Date().toISOString().slice(0, 10),
          status: r[24] || 'open',
          note: r[25] || ''
        })).filter(i => i.item_code);

        if (fetchedItems.length > 0) {
          setPickingList(fetchedItems);
          saveToLocalDb(fetchedItems);
          showToast('Data Ditarik', `Berhasil mengambil ${fetchedItems.length} baris dari spreadsheet "Picking"!`, 'success');
        } else {
          showToast('Info', 'Sheet "Picking" kosong atau tidak ada data yang valid.', 'info');
        }
      } else {
        showToast('Info', result.message || 'Tarik data langsung via GET memerlukan handler doGet di Google Apps Script.', 'info');
      }
    } catch (e: any) {
      showToast('Koneksi Selesai', e?.message || 'Tarik data langsung via GET memerlukan handler doGet di Google Apps Script.', 'info');
    } finally {
      setIsPullingGSheet(false);
    }
  };


  // Excel File Upload Import (Role: Admin only)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Aksi upload file Excel hanya diperuntukkan bagi Administrator!', 'danger');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('Data Kosong', 'File Excel tidak memiliki baris data yang valid.', 'warning');
          return;
        }

        const nowIso = new Date().toISOString().slice(0, 10);
        const parsedItems: PickingItem[] = rawJson.map((r, idx) => {
          const idPicking = r['ID Picking'] || r['ID Incoming'] || r['id_picking'] || r['ID'] || `PCK-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(idx + 1000).slice(-4)}`;
          return {
            id_picking: String(idPicking).trim(),
            tujuan: r['Tujuan'] || r['Jenis'] || r['tujuan'] || 'Picking Outbound',
            item_code: String(r['Item Code'] || r['item_code'] || r['SKU'] || '').trim(),
            item_name: String(r['Nama Barang'] || r['Item Name'] || r['item_name'] || '').trim(),
            category: r['Kategori'] || r['category'] || 'Finished Good',
            location: r['Lokasi'] || r['location'] || 'WH-PICKING-01',
            location_type: r['Tipe Lokasi'] || r['location_type'] || 'Floor',
            first_qty: Number(r['Qty Awal'] || r['first_qty'] || r['Qty'] || 0),
            last_qty: Number(r['Qty Akhir'] || r['last_qty'] || r['Qty'] || 0),
            uom: r['UOM'] || r['uom'] || 'CTN',
            qty_convert: Number(r['Qty Convert'] || r['qty_convert'] || 0),
            uom_convert: r['UOM Convert'] || r['uom_convert'] || 'PCS',
            lpn_serial_number: String(r['LPN / SN'] || r['lpn_serial_number'] || '-').trim(),
            batch: String(r['Batch'] || r['batch'] || '-').trim(),
            vendor_batch: String(r['Vendor Batch'] || r['vendor_batch'] || '-').trim(),
            sloc: r['SLOC'] || r['sloc'] || 'SL02',
            expired_date: r['Expired Date'] || r['expired_date'] || '',
            destination_code: r['Kode Tujuan'] || r['destination_code'] || 'DST-PICK',
            qc_code: r['Status QC'] || r['qc_code'] || 'QC-PASS',
            user_tally: r['User Tally'] || r['user_tally'] || currentUser?.nama || 'Tally Picking',
            shelf_life: r['Shelf Life'] || r['shelf_life'] || '36 Bulan',
            source: r['Sumber'] || r['source'] || 'Stok Gudang',
            user_input: currentUser?.nama || 'Admin',
            tanggal_update: nowIso,
            status: r['Status'] || r['status'] || 'open',
            note: r['Catatan'] || r['Catatan / Note'] || r['note'] || ''
          };
        }).filter(item => item.item_code && item.item_name);

        if (parsedItems.length === 0) {
          showToast('Validasi Gagal', 'Tidak ada data valid yang memiliki Item Code dan Nama Barang.', 'warning');
          return;
        }

        const map = new Map(pickingList.map(p => [p.id_picking, p]));
        parsedItems.forEach(item => map.set(item.id_picking, item));
        const updatedList = Array.from(map.values());

        setPickingList(updatedList);
        saveToLocalDb(updatedList);

        setShowUploadModal(false);
        showToast('Upload Berhasil', `Berhasil mengimpor ${parsedItems.length} baris data picking ke database.`, 'success');
      } catch (err: any) {
        showToast('Gagal Parsing Excel', err?.message || 'Format file Excel tidak dikenali.', 'danger');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-3">
      {/* Header Banner - Polos & Ringan (Database: Spreadsheet) */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 text-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                Outbound & Picking
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Database: Spreadsheet Tab "Picking"
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Total: {pickingList.length} Item
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="text-indigo-600 shrink-0" size={22} />
              <span>Manajemen Data Picking (Database Spreadsheet)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Pencatatan data picking barang outbound terintegrasi penuh dengan <strong>Google Spreadsheet</strong> (Sheet: <strong>Picking</strong>), upload Excel massal, dan transfer logistik.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                showToast('Database Segar', `Memuat ${pickingList.length} baris data picking lokal.`, 'info');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw size={13} />
              <span>Segarkan</span>
            </button>
            <button
              onClick={() => setShowGSheetModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Kirim / Tarik dari Google Spreadsheet"
            >
              <Share2 size={13} />
              <span>Sync Sheets</span>
            </button>
            <button
              onClick={() => setShowHeadersModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Buat, Pasang & Salin 26 Judul Kolom Resmi Sheet Picking"
            >
              <Table size={13} />
              <span>Judul Kolom Sheet</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Unduh Laporan Excel (.xlsx)"
            >
              <FileDown size={13} />
              <span>Export Excel</span>
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Upload File Excel (Khusus Admin)"
              >
                <Upload size={13} />
                <span>Upload Excel</span>
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>Tambah Picking</span>
            </button>
          </div>
        </div>

        {/* Stats Row - Polos, Ringan & Cepat */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 font-medium">Total Baris Data</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{stats.totalRows.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 font-medium">Total Qty (Akhir)</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{stats.totalQty.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 font-medium">Status: Open / Ready</div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">{stats.readyCount.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 font-medium">Status: Repack / Proses</div>
            <div className="text-sm font-bold text-amber-700 mt-0.5">{stats.processCount.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 col-span-2 sm:col-span-1">
            <div className="text-[10px] text-slate-500 font-medium">Selesai / Close</div>
            <div className="text-sm font-bold text-blue-700 mt-0.5">{stats.doneCount.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      {/* Navigation Shortcuts to Related Modules */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-bold shrink-0 text-[11px] uppercase tracking-wider">Arahkan ke:</span>
        {onNavigateToPenyiapan && (
          <button
            onClick={onNavigateToPenyiapan}
            className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 font-semibold hover:bg-sky-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Boxes size={12} />
            <span>Penyiapan</span>
          </button>
        )}
        {onNavigateToPemusnahan && (
          <button
            onClick={onNavigateToPemusnahan}
            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Flame size={12} />
            <span>Pemusnahan</span>
          </button>
        )}
        {onNavigateToReco && (
          <button
            onClick={onNavigateToReco}
            className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-semibold hover:bg-purple-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ClipboardList size={12} />
            <span>Reco</span>
          </button>
        )}
        {onNavigateToInventory && (
          <button
            onClick={onNavigateToInventory}
            className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 font-semibold hover:bg-teal-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Layers size={12} />
            <span>Inventory</span>
          </button>
        )}
        {onNavigateToRepack && (
          <button
            onClick={onNavigateToRepack}
            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Boxes size={12} />
            <span>Repack</span>
          </button>
        )}
        <button
          onClick={handleResetToInitialData}
          className="ml-auto px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0 text-[11px]"
          title="Muat ulang 90 baris data bawaan"
        >
          <RotateCcw size={12} />
          <span>Muat Ulang 90 Data Awal</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input with Voice Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Cari SKU, Nama Barang, Batch, LPN, Lokasi, Catatan..."
              className="w-full pl-9 pr-10 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            />
            <button
              onClick={toggleSpeechRecognition}
              className={`absolute right-2 top-1.5 p-1 rounded cursor-pointer transition-colors ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-600'}`}
              title="Voice Search (Speech to Text)"
            >
              {isListening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50 focus:outline-hidden"
            >
              <option value="">Semua Status</option>
              <option value="open">Open</option>
              <option value="closepg">Close PG</option>
              <option value="Ready">Ready</option>
              <option value="Repack">Repack</option>
            </select>

            <select
              value={qcFilter}
              onChange={e => { setQcFilter(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50 focus:outline-hidden"
            >
              <option value="">Semua Status QC</option>
              <option value="Repack">Repack</option>
              <option value="Lulus">Lulus</option>
              <option value="PHE">PHE</option>
              <option value="Reject">Reject</option>
              <option value="QC-PASS">QC-PASS</option>
            </select>

            <select
              value={slocFilter}
              onChange={e => { setSlocFilter(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50 focus:outline-hidden"
            >
              <option value="">Semua SLoc</option>
              <option value="SL01">SL01</option>
              <option value="SL02">SL02</option>
              <option value="SL03">SL03</option>
              <option value="SL04">SL04</option>
              <option value="SL99">SL99</option>
            </select>
          </div>
        </div>

        {/* Selected Batch Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-center justify-between flex-wrap gap-2 text-xs text-indigo-900">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckSquare size={16} className="text-indigo-600" />
              <span className="font-bold">{selectedIds.length} item terpilih</span>
              {autoSyncDelete && (
                <span className="text-[10px] text-emerald-800 bg-emerald-100 font-semibold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  ⚡ Auto-Delete Spreadsheet Aktif
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowBulkTransferModal(true)}
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowRightLeft size={12} />
                <span>Transfer Massal</span>
              </button>
              {isSuperAdmin && (
                <button
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Hapus data terpilih dari aplikasi & otomatis terhapus dari Google Spreadsheet"
                >
                  <Trash2 size={12} />
                  <span>Hapus Terpilih {autoSyncDelete ? '(& Spreadsheet)' : ''}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200 select-none">
              <tr>
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredPicking.length > 0 && selectedIds.length === filteredPicking.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                </th>
                <th className="p-2.5">ID Picking</th>
                <th className="p-2.5">Item Code / SKU</th>
                <th className="p-2.5">Nama Barang</th>
                <th className="p-2.5 text-right">Qty</th>
                <th className="p-2.5">UOM</th>
                <th className="p-2.5">Batch</th>
                <th className="p-2.5">Lokasi</th>
                <th className="p-2.5">Expired Date</th>
                <th className="p-2.5">Status QC</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    <PackageCheck className="mx-auto mb-2 text-slate-300" size={32} />
                    <p className="font-bold text-slate-600">Belum ada data picking</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gunakan tombol "Muat Ulang 90 Data Awal", upload Excel, atau tambah data baru.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => {
                  const isSelected = selectedIds.includes(item.id_picking);
                  return (
                    <tr
                      key={item.id_picking}
                      className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(item.id_picking)}
                          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {item.id_picking}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {item.item_code}
                      </td>
                      <td className="p-2.5 font-medium text-slate-900 min-w-[220px]">
                        <div>{item.item_name}</div>
                        {item.note && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs" title={item.note}>
                            {item.note}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {Number(item.last_qty || item.first_qty || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5 text-slate-600 font-semibold">{item.uom || 'CTN'}</td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">{item.batch || '-'}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{item.location || '-'}</div>
                      </td>
                      <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{item.expired_date || '-'}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          (item.qc_code || '').toLowerCase() === 'lulus' || (item.qc_code || '').toLowerCase() === 'qc-pass'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (item.qc_code || '').toLowerCase() === 'repack'
                            ? 'bg-amber-100 text-amber-800'
                            : (item.qc_code || '').toLowerCase() === 'reject'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {item.qc_code || 'QC-PASS'}
                        </span>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 text-[11px]">
                          {item.status || 'open'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Detail"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 size={14} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Data (Admin)"
                            >
                              <Trash2 size={14} />
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

        {/* Table Footer with Pagination & Delete All (Admin) */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Menampilkan {(paginatedItems.length).toLocaleString('id-ID')} dari {filteredPicking.length.toLocaleString('id-ID')} data</span>
            {isSuperAdmin && pickingList.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="ml-3 text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer text-[11px]"
                title={autoSyncDelete ? 'Kosongkan seluruh data di aplikasi dan Google Spreadsheet' : 'Kosongkan data lokal aplikasi'}
              >
                Kosongkan Semua Data {autoSyncDelete ? '(& Spreadsheet)' : ''}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-bold text-slate-700">
              Hal {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FORM TAMBAH / EDIT PICKING (Polos & Ringan) */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck size={18} className="text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {isEditMode ? 'Edit Data Picking' : 'Tambah Data Picking Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-4 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ID Picking</label>
                  <input
                    type="text"
                    value={formData.id_picking || ''}
                    onChange={e => setFormData({ ...formData, id_picking: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono bg-slate-50 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tujuan / Jenis</label>
                  <input
                    type="text"
                    value={formData.tujuan || ''}
                    onChange={e => setFormData({ ...formData, tujuan: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                    placeholder="Contoh: ADMK / Picking Outbound"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Item Code / SKU *</label>
                  <input
                    type="text"
                    value={formData.item_code || ''}
                    onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                    placeholder="Contoh: FG11026.218.0050.C"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Barang *</label>
                  <input
                    type="text"
                    value={formData.item_name || ''}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-semibold"
                    placeholder="Nama produk lengkap"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Qty</label>
                  <input
                    type="number"
                    value={formData.last_qty ?? formData.first_qty ?? ''}
                    onChange={e => setFormData({ ...formData, last_qty: Number(e.target.value), first_qty: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">UOM</label>
                  <input
                    type="text"
                    value={formData.uom || ''}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 uppercase font-semibold"
                    placeholder="CTN / PCS"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch</label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={e => setFormData({ ...formData, batch: e.target.value, vendor_batch: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                    placeholder="10RHA2516N"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lokasi</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                    placeholder="CKB-FG1-AE-21-1A"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status QC</label>
                  <select
                    value={formData.qc_code || 'QC-PASS'}
                    onChange={e => setFormData({ ...formData, qc_code: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-semibold"
                  >
                    <option value="Repack">Repack</option>
                    <option value="Lulus">Lulus</option>
                    <option value="PHE">PHE</option>
                    <option value="Reject">Reject</option>
                    <option value="QC-PASS">QC-PASS</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expired Date</label>
                  <input
                    type="date"
                    value={formData.expired_date || ''}
                    onChange={e => setFormData({ ...formData, expired_date: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">User Tally</label>
                  <input
                    type="text"
                    value={formData.user_tally || ''}
                    onChange={e => setFormData({ ...formData, user_tally: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                    placeholder="Riyanto"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={formData.status || 'open'}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  >
                    <option value="open">Open</option>
                    <option value="closepg">Close PG</option>
                    <option value="Ready">Ready</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Catatan / Note</label>
                <textarea
                  value={formData.note || ''}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                  className="w-full p-2 rounded-lg border border-slate-300"
                  placeholder="Keterangan tambahan..."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL ITEM */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Info size={16} className="text-indigo-600" />
                <span>Detail Data Picking</span>
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block">ID PICKING</span>
                  <span className="font-bold text-indigo-700">{selectedItem.id_picking}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">STATUS</span>
                  <span className="font-bold text-slate-800">{selectedItem.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">ITEM CODE</span>
                  <span className="font-bold text-slate-800">{selectedItem.item_code}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">BATCH</span>
                  <span className="font-bold text-slate-800">{selectedItem.batch || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">LOKASI</span>
                  <span className="font-bold text-slate-800">{selectedItem.location || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">STATUS QC</span>
                  <span className="font-bold text-slate-800">{selectedItem.qc_code || '-'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">NAMA BARANG</span>
                <span className="font-bold text-sm text-slate-900">{selectedItem.item_name}</span>
              </div>

              {selectedItem.note && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 text-[10px] block mb-0.5">CATATAN / KETERANGAN</span>
                  <p className="text-slate-800 font-medium">{selectedItem.note}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold">Qty</div>
                  <div className="text-sm font-bold text-slate-900">{selectedItem.last_qty || selectedItem.first_qty}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold">Satuan UOM</div>
                  <div className="text-sm font-bold text-slate-900">{selectedItem.uom}</div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: UPLOAD EXCEL / CSV (Role: Admin Only) */}
      {/* ========================================================================= */}
      {showUploadModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Upload size={16} className="text-indigo-600" />
                <span>Upload File Excel / CSV Picking</span>
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-slate-600">
              <p>
                Pilih file spreadsheet (.xlsx / .xls / .csv) untuk mengimpor massal data picking ke database spreadsheet lokal.
              </p>
              <div className="border border-dashed border-slate-300 rounded-lg p-5 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                <FileSpreadsheet size={32} className="mx-auto text-slate-500 mb-2" />
                <label className="font-bold text-indigo-700 hover:underline cursor-pointer">
                  <span>Pilih Dokumen Excel / CSV</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400 mt-1">Mendukung format kolom standar Picking / Incoming</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GOOGLE SHEET SYNC (Target Sheet: Picking) */}
      {/* ========================================================================= */}
      {showGSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-emerald-700" />
                <h3 className="font-bold text-sm text-slate-900">Sinkronisasi Database Spreadsheet</h3>
              </div>
              <button
                onClick={() => setShowGSheetModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-600">Nama Tab Lembar Kerja:</div>
                  <div className="font-mono text-emerald-800 font-bold text-xs">Picking</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Total Baris Siap Sinkron</div>
                  <div className="text-sm font-bold text-slate-900">{filteredPicking.length || pickingList.length}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">Webhook URL (Google Apps Script / Cloudflare)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={isTestingWebhook || !gSheetConfig.webhookUrl}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Periksa apakah Webhook dapat diakses dan siap menyimpan data"
                    >
                      <RefreshCw size={11} className={isTestingWebhook ? 'animate-spin' : ''} />
                      <span>{isTestingWebhook ? 'Menguji...' : 'Uji Koneksi Webhook'}</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setShowAppsScriptHelp(!showAppsScriptHelp)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Code2 size={12} />
                      <span>{showAppsScriptHelp ? 'Sembunyikan' : 'Kode Apps Script'}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={gSheetConfig.webhookUrl}
                  onChange={e => {
                    const val = e.target.value;
                    const { extractedSpreadsheetId } = validateWebhookUrl(val);
                    const newConfig = {
                      ...gSheetConfig,
                      webhookUrl: val,
                      spreadsheetId: gSheetConfig.spreadsheetId || extractedSpreadsheetId || ''
                    };
                    setGSheetConfig(newConfig);
                    saveGlobalSpreadsheetConfig(newConfig);
                    setTestWebhookResult(null);
                  }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono text-[11px] focus:ring-1 focus:ring-indigo-500"
                />

                {testWebhookResult && (
                  <div className={`mt-2 p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                    testWebhookResult.success 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>{testWebhookResult.success ? 'Koneksi Normal: ' : 'Koneksi Gagal: '}</strong>
                      {testWebhookResult.message}
                    </div>
                  </div>
                )}

                {gSheetConfig.webhookUrl?.includes('docs.google.com/spreadsheets') && (
                  <div className="mt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <strong>Perhatian:</strong> Link yang dimasukkan adalah link dokumen Google Sheets, bukan Webhook!
                      Gunakan menu <em>Ekstensi &gt; Apps Script</em> di Google Sheets, lalu klik <strong>Deploy &gt; New Deployment &gt; Web App</strong> (Access: Anyone). Masukkan URL Web App hasil deploy ke kolom di atas.
                    </div>
                  </div>
                )}
              </div>

              {showAppsScriptHelp && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800">Kode Google Apps Script (doPost &amp; doGet)</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                        setCopiedScript(true);
                        showToast('Tersalin', 'Kode Google Apps Script berhasil disalin ke clipboard!', 'success');
                        setTimeout(() => setCopiedScript(false), 2000);
                      }}
                      className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={11} />
                      <span>{copiedScript ? 'Tersalin!' : 'Salin Kode'}</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-700 max-h-36 overflow-y-auto leading-relaxed">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>1. Buka spreadsheet Google Anda &gt; menu <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.</div>
                    <div>2. Tempel kode di atas &gt; Simpan &gt; klik <strong>Deploy</strong> &gt; <strong>New Deployment</strong>.</div>
                    <div>3. Pilih tipe <strong>Web App</strong>, ubah <em>Who has access</em> menjadi <strong>Anyone (Siapa saja)</strong>.</div>
                    <div>4. Salin <strong>Web App URL</strong> dan tempelkan ke kolom Webhook URL di atas.</div>
                  </div>
                </div>
              )}

              {/* Highlight Box: Inisialisasi Judul Kolom Sheet Picking */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Table size={15} className="text-indigo-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Judul Kolom di Sheet "Picking" ({PICKING_DEFAULT_HEADERS.length} Kolom Resmi)
                    </span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    A1 s/d Z1
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed m-0">
                  Jika sheet <strong>Picking</strong> di Google Spreadsheet belum memiliki baris judul kolom di tabelnya, Anda dapat memasangnya otomatis atau menyalinnya langsung:
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateSheetHeaders}
                    disabled={isCreatingHeaders}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                    title="Pasang 26 judul kolom langsung ke baris 1 Sheet Picking Google Spreadsheet"
                  >
                    <Table size={12} className={isCreatingHeaders ? 'animate-spin' : ''} />
                    <span>{isCreatingHeaders ? 'Memasang...' : 'Buat Judul Kolom di Sheet'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyHeaders}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-700 font-bold text-xs border border-indigo-300 flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Salin 26 judul kolom (tab-separated) agar bisa di-paste langsung ke sel A1 Google Sheets"
                  >
                    <Copy size={12} />
                    <span>{copiedHeaders ? 'Tersalin!' : 'Salin 26 Kolom'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadHeaderTemplate}
                    className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center gap-1 cursor-pointer"
                    title="Download template Excel (.xlsx) dengan 26 judul kolom"
                  >
                    <Download size={12} />
                    <span>Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowHeadersModal(true)}
                    className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1 cursor-pointer ml-auto"
                    title="Lihat rincian 26 kolom A sampai Z"
                  >
                    <Eye size={12} />
                    <span>Rincian</span>
                  </button>
                </div>
              </div>

              {/* Highlight Box: Manajemen Hapus Data di Google Spreadsheet */}
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                    <Trash2 size={15} className="text-rose-600" />
                    <span>Fitur Hapus Data di Google Spreadsheet</span>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                    Dua Arah (Two-Way)
                  </span>
                </div>

                <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-rose-200">
                  <input
                    type="checkbox"
                    id="chk-auto-sync-delete"
                    checked={autoSyncDelete}
                    onChange={(e) => toggleAutoSyncDelete(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="chk-auto-sync-delete" className="text-[11px] text-slate-700 leading-snug cursor-pointer select-none">
                    <strong className="text-slate-900">Otomatis Hapus di Spreadsheet saat Data Dihapus di Aplikasi</strong>
                    <p className="text-slate-500 mt-0.5 m-0 text-[10px]">
                      Jika opsi ini aktif, setiap kali Anda menghapus 1 baris, baris terpilih, atau mengosongkan data di tabel aplikasi, baris tersebut akan otomatis terhapus dari Sheet "Picking" Google Spreadsheet secara realtime.
                    </p>
                  </label>
                </div>

                {/* Direct Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleDeleteSelectedInSpreadsheet}
                    disabled={isSyncingGSheet || selectedIds.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
                    title={selectedIds.length === 0 ? 'Centang data di tabel terlebih dahulu' : `Hapus ${selectedIds.length} baris terpilih di Spreadsheet`}
                  >
                    <Trash2 size={12} />
                    <span>Hapus {selectedIds.length > 0 ? `${selectedIds.length} Data Terpilih` : 'Data Terpilih'} di Spreadsheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSpreadsheetData}
                    disabled={isSyncingGSheet}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-300 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40"
                    title="Kosongkan seluruh baris data pada Sheet Picking Google Spreadsheet (Header baris 1 tetap utuh)"
                  >
                    <XCircle size={12} />
                    <span>Kosongkan Seluruh Data Sheet (Simpan Header)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Spreadsheet ID (Opsional jika script terpasang di sheet)</label>
                <input
                  type="text"
                  value={gSheetConfig.spreadsheetId}
                  onChange={e => {
                    const val = e.target.value;
                    const newConfig = { ...gSheetConfig, spreadsheetId: val };
                    setGSheetConfig(newConfig);
                    saveGlobalSpreadsheetConfig(newConfig);
                  }}
                  placeholder="Contoh: 1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420"
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono text-[11px]"
                />
              </div>

              {gSheetSyncResult && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold ${gSheetSyncResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {gSheetSyncResult.message}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePullFromGoogleSheets}
                  disabled={isPullingGSheet}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer flex items-center gap-1.5 text-xs disabled:opacity-50"
                  title="Tarik data dari tab Picking"
                >
                  <CloudDownload size={13} className={isPullingGSheet ? 'animate-spin' : ''} />
                  <span>{isPullingGSheet ? 'Menarik...' : 'Tarik dari Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold cursor-pointer flex items-center gap-1.5 text-xs border border-emerald-300"
                  title="Download data sebagai file Excel (.xlsx) untuk cadangan atau import manual"
                >
                  <FileSpreadsheet size={13} />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGSheetModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer border border-slate-200 text-xs"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSyncToGoogleSheets}
                  disabled={isSyncingGSheet}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50 text-xs shadow-md shadow-emerald-600/20"
                >
                  <CloudUpload size={13} className={isSyncingGSheet ? 'animate-spin' : ''} />
                  <span>{isSyncingGSheet ? 'Mengirim...' : 'Kirim Sekarang ke Sheet "Picking"'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BULK TRANSFER MODAL */}
      {/* ========================================================================= */}
      {showBulkTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-indigo-600" />
                <span>Transfer Massal ({selectedIds.length} Data Terpilih)</span>
              </h3>
              <button
                onClick={() => setShowBulkTransferModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pilih Menu / Lembar Kerja Tujuan</label>
                <div className="grid grid-cols-2 gap-2">
                  {PICKING_BULK_DESTINATIONS.map(dest => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => {
                        setBulkDestination(dest);
                        setBulkTargetTujuan(dest.defaultTujuan);
                        setBulkTargetStatus(dest.defaultStatus);
                        setBulkSourceUpdatedStatus(dest.sourceStatusDefault);
                      }}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${bulkDestination.id === dest.id ? 'bg-slate-100 border-slate-400 font-bold' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="font-bold text-slate-900">{dest.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">Sheet: {dest.sheetName}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status Target</label>
                <input
                  type="text"
                  value={bulkTargetStatus}
                  onChange={e => setBulkTargetStatus(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tindakan Pada Data Asal (Picking)</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceAction"
                      checked={bulkSourceAction === 'update'}
                      onChange={() => setBulkSourceAction('update')}
                    />
                    <span>Perbarui status di Picking menjadi: "{bulkSourceUpdatedStatus}"</span>
                  </label>
                  {isSuperAdmin && (
                    <label className="flex items-center gap-2 cursor-pointer text-rose-700 font-bold">
                      <input
                        type="radio"
                        name="sourceAction"
                        checked={bulkSourceAction === 'delete'}
                        onChange={() => setBulkSourceAction('delete')}
                      />
                      <span>Hapus dari tabel Picking setelah berhasil dipindahkan (Khusus Admin)</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkTransferModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer border border-slate-200 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkTransfer}
                disabled={isPushing}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer flex items-center gap-1 text-xs"
              >
                <Check size={13} />
                <span>{isPushing ? 'Memindahkan...' : `Pindahkan ${selectedIds.length} Data`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: MODAL 26 JUDUL KOLOM RESMI SHEET PICKING */}
      {/* ========================================================================= */}
      {showHeadersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
            {/* Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Table size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">26 Judul Kolom Resmi Sheet "Picking"</h3>
                  <p className="text-[11px] text-blue-200">
                    Standar kolom Kolom A s/d Kolom Z untuk Google Spreadsheet &amp; Sistem Logistik
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHeadersModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* Top Quick Actions Bar */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="font-bold text-indigo-950 text-xs">Aksi Cepat untuk Google Spreadsheet</div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">
                    Gunakan salah satu cara mudah di bawah ini untuk memasang judul kolom di sheet Picking Anda.
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCreateSheetHeaders}
                    disabled={isCreatingHeaders}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Table size={13} className={isCreatingHeaders ? 'animate-spin' : ''} />
                    <span>{isCreatingHeaders ? 'Memasang...' : 'Pasang Otomatis via Webhook'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyHeaders}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-700 font-bold text-xs border border-indigo-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Copy size={13} />
                    <span>{copiedHeaders ? 'Tersalin (Siap Paste)!' : 'Salin 26 Judul Kolom'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadHeaderTemplate}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download size={13} />
                    <span>Download Excel</span>
                  </button>
                </div>
              </div>

              {/* Panduan 3 Langkah Singkat */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 block text-xs mb-1">
                  💡 Cara Memasang Judul Kolom di Google Sheets secara Manual:
                </span>
                <p className="m-0 leading-relaxed text-slate-600">
                  1. Klik tombol <strong>"Salin 26 Judul Kolom"</strong> di atas.<br />
                  2. Buka tab sheet <strong>Picking</strong> di file Google Spreadsheet Anda.<br />
                  3. Klik pada sel <strong>A1</strong> lalu tekan tombol <strong>Ctrl + V</strong> pada keyboard. Seluruh 26 kolom akan terisi otomatis dari Kolom A sampai Kolom Z!
                </p>
              </div>

              {/* Tabel Rincian Kolom A - Z */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white font-bold text-[10px] sticky top-0 uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5 w-12 text-center">No</th>
                        <th className="p-2.5 w-16 text-center">Kolom</th>
                        <th className="p-2.5">Judul Kolom Resmi</th>
                        <th className="p-2.5">Tipe Data</th>
                        <th className="p-2.5">Contoh Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {PICKING_DEFAULT_HEADERS.map((headerName, index) => {
                        const colLetter = String.fromCharCode(65 + index);
                        const sampleMap: Record<string, { type: string; sample: string }> = {
                          'ID Picking': { type: 'String (Auto)', sample: 'PCK-20260924-9603' },
                          'Tujuan': { type: 'String', sample: 'Picking Outbound / ADMK' },
                          'Item Code': { type: 'String (SKU)', sample: 'FG11026.218.0050.C' },
                          'Nama Barang': { type: 'String (Nama)', sample: 'RESIK V MJK WHITENING 50ML' },
                          'Kategori': { type: 'String', sample: 'Finished Good' },
                          'Lokasi': { type: 'String (Bin)', sample: 'CKB-FG1-AE-21-1A' },
                          'Tipe Lokasi': { type: 'Option', sample: 'Floor / Rack' },
                          'Qty Awal': { type: 'Number', sample: '10' },
                          'Qty Akhir': { type: 'Number', sample: '10' },
                          'UOM': { type: 'String (Unit)', sample: 'CTN / PCS' },
                          'Qty Convert': { type: 'Number', sample: '240' },
                          'UOM Convert': { type: 'String (Unit)', sample: 'PCS' },
                          'LPN / SN': { type: 'String (Serial)', sample: '-' },
                          'Batch': { type: 'String (Batch)', sample: '10RHA2516N' },
                          'Vendor Batch': { type: 'String', sample: '10RHA2516N' },
                          'SLOC': { type: 'String (Storage)', sample: 'SL02' },
                          'Expired Date': { type: 'Date (YYYY-MM-DD)', sample: '2029-09-08' },
                          'Kode Tujuan': { type: 'String', sample: 'DST-PICK' },
                          'Status QC': { type: 'Status', sample: 'QC-PASS / Repack' },
                          'User Tally': { type: 'String', sample: 'Riyanto' },
                          'Shelf Life': { type: 'String', sample: '36 Bulan' },
                          'Sumber': { type: 'String', sample: 'Stok Gudang' },
                          'User Input': { type: 'String', sample: currentUser?.nama || 'Admin' },
                          'Tanggal Update': { type: 'Date', sample: new Date().toISOString().slice(0, 10) },
                          'Status': { type: 'Status', sample: 'open / ready / close' },
                          'Catatan / Note': { type: 'Text', sample: 'Keterangan operasional' }
                        };
                        const info = sampleMap[headerName] || { type: 'String', sample: '-' };

                        return (
                          <tr key={index} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center font-sans font-bold text-slate-500">
                              {index + 1}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                {colLetter}
                              </span>
                            </td>
                            <td className="p-2.5 font-sans font-bold text-slate-900">
                              {headerName}
                            </td>
                            <td className="p-2.5 text-slate-500 font-sans text-[10px]">
                              {info.type}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {info.sample}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
              <span className="text-[11px] text-slate-500">
                Total: <strong>26 Kolom Resmi</strong> (Kolom A s/d Kolom Z)
              </span>
              <button
                type="button"
                onClick={() => setShowHeadersModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer text-xs transition-colors"
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
