import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  CheckCircle2,
  AlertCircle,
  Settings,
  Download,
  Database,
  Layers,
  Sparkles,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  TrendingUp,
  Clock,
  Activity,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MonitoringConfig {
  spreadsheetId: string;
  sheetName: string;
}

const DEFAULT_CONFIG: MonitoringConfig = {
  spreadsheetId: '1n1AMHYOU-NFxpc8CyJCd8g0OCcAHR2lbLK77Awzy420',
  sheetName: 'MONITORING',
};

const STORAGE_KEY = 'LOGISTIK_MONITORING_PEMUSNAHAN_CONFIG';

// Helper to check if a column should be hidden (ID and TIMESTAMP)
const isExcludedHeader = (headerName: string): boolean => {
  const clean = headerName.trim().toUpperCase();
  return (
    clean === 'ID' ||
    clean === 'TIMESTAMP' ||
    clean === 'TIME_STAMP' ||
    clean === '_ID' ||
    clean === '' // empty / spacer headers
  );
};

// Helper to check if a column contains sensitive financial values (VALUE, COGS, HARGA)
export const isSensitiveColumn = (headerName: string): boolean => {
  const clean = headerName.trim().toUpperCase();
  return (
    clean === 'VALUE' ||
    clean === 'COGS' ||
    clean.includes('VALUE') ||
    clean.includes('COGS') ||
    clean.includes('HARGA') ||
    clean.includes('BIAYA') ||
    clean.includes('NOMINAL') ||
    clean.includes('TOTAL NILAI')
  );
};

// Calculate progress percentage and visual attributes based on STATUS & milestones
export interface ProgressDetail {
  percentage: number;
  label: string;
  sublabel: string;
  barColor: string;
  badgeClass: string;
  badgeText: string;
  statusCategory: 'SELESAI' | 'PROSES' | 'BATAL' | 'DRAFT';
}

export function calculateProgress(row: Record<string, any>): ProgressDetail {
  const statusRaw = String(row['STATUS'] || row['status'] || '').trim();
  const statusUpper = statusRaw.toUpperCase();
  const ketRaw = String(row['KETERANGAN'] || row['keterangan'] || '').trim().toUpperCase();

  // 1. SELESAI / COMPLETED (100%)
  if (
    statusUpper === 'SELESAI' ||
    statusUpper.includes('SELESAI') ||
    statusUpper.includes('DONE') ||
    statusUpper.includes('MUSNAH') ||
    statusUpper.includes('CLOSE')
  ) {
    return {
      percentage: 100,
      label: '100% Selesai',
      sublabel: 'Pemusnahan Tuntas',
      barColor: 'bg-emerald-500',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      badgeText: statusRaw || 'SELESAI',
      statusCategory: 'SELESAI',
    };
  }

  // 2. BATAL / REJECT (0%)
  if (
    statusUpper.includes('BATAL') ||
    statusUpper.includes('CANCEL') ||
    statusUpper.includes('REJECT') ||
    statusUpper.includes('TOLAK')
  ) {
    return {
      percentage: 0,
      label: '0% Batal',
      sublabel: 'Dibatalkan / Ditolak',
      barColor: 'bg-rose-500',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      badgeText: statusRaw || 'BATAL',
      statusCategory: 'BATAL',
    };
  }

  // 3. PROSES: Dihitung berdasarkan tahapan keterangan & milestone persetujuan
  if (statusUpper === 'PROSES' || statusUpper.includes('PROSES') || statusUpper.includes('PROGRESS')) {
    if (ketRaw.includes('MENUNGGU PENGAJUAN')) {
      return {
        percentage: 20,
        label: '20%',
        sublabel: 'Menunggu Pengajuan',
        barColor: 'bg-sky-500',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        badgeText: 'PROSES',
        statusCategory: 'PROSES',
      };
    }
    if (ketRaw.includes('APPRVL') || ketRaw.includes('APPROVAL') || ketRaw.includes('QA')) {
      return {
        percentage: 45,
        label: '45%',
        sublabel: 'Menunggu Approval QA',
        barColor: 'bg-indigo-500',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        badgeText: 'PROSES',
        statusCategory: 'PROSES',
      };
    }
    if (ketRaw.includes('BAP') || ketRaw.includes('BA')) {
      return {
        percentage: 75,
        label: '75%',
        sublabel: 'Menunggu BAP Pemusnahan',
        barColor: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        badgeText: 'PROSES',
        statusCategory: 'PROSES',
      };
    }

    // Periksa status milestone yang terisi / CLOSE
    const milestones = [
      'APPROVED_HEAD_LOG',
      'APPROVED_HO_DIREKSI',
      'SERAH_TERIMA_GUDANG_REJECT',
      'ACC_TEAMS_BAP',
      'KIRIM_DOKUMEN_BAP_KE_HO',
      'COMPLETED_APPROVAL',
      'COMPLETED_BA',
      'COMPLETED_MIGO',
      'CHECK_KAPSUL',
    ];
    let doneCount = 0;
    let totalCount = 0;
    milestones.forEach(m => {
      const v = String(row[m] || '').trim().toUpperCase();
      if (v) {
        totalCount++;
        if (
          v === 'CLOSE' ||
          v.includes('TIDAK ADA') ||
          v.includes('WH-CKB') ||
          v.includes('FORM') ||
          v.includes('TGL')
        ) {
          doneCount++;
        }
      }
    });

    if (totalCount > 0) {
      const pct = Math.min(95, Math.max(25, Math.round(20 + (doneCount / totalCount) * 70)));
      return {
        percentage: pct,
        label: `${pct}%`,
        sublabel: `${doneCount}/${totalCount} Milestone Selesai`,
        barColor: pct >= 70 ? 'bg-teal-500' : 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        badgeText: 'PROSES',
        statusCategory: 'PROSES',
      };
    }

    return {
      percentage: 50,
      label: '50%',
      sublabel: 'Dalam Pelaksanaan',
      barColor: 'bg-amber-500',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      badgeText: 'PROSES',
      statusCategory: 'PROSES',
    };
  }

  // Fallback / Menunggu (15%)
  return {
    percentage: 15,
    label: '15%',
    sublabel: statusRaw || 'Antrean Awal',
    barColor: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    badgeText: statusRaw || 'ANTREAN',
    statusCategory: 'DRAFT',
  };
}

export function MonitoringPemusnahanModule() {
  // Configuration
  const [config, setConfig] = useState<MonitoringConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          spreadsheetId: parsed.spreadsheetId || DEFAULT_CONFIG.spreadsheetId,
          sheetName: parsed.sheetName || DEFAULT_CONFIG.sheetName,
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CONFIG;
  });

  // Data State
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorType, setErrorType] = useState<'NONE' | 'RESTRICTED' | 'NOT_FOUND' | 'NETWORK'>('NONE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [kategoriFilter, setKategoriFilter] = useState<string>('ALL');
  // URUTAN SESUAI SPREADSHEET (JANGAN DI-SORT SECARA DEFAULT)
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);

  // Sensitive Financial Value Masking (VALUE, COGS, TOTAL NILAI BARANG)
  const [hideSensitiveValues, setHideSensitiveValues] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('LOGISTIK_HIDE_SENSITIVE_VALUES');
      return saved !== null ? saved === 'true' : true; // Default to true (aman & terlindungi)
    } catch {
      return true;
    }
  });

  const toggleHideSensitive = useCallback(() => {
    setHideSensitiveValues(prev => {
      const next = !prev;
      try {
        localStorage.setItem('LOGISTIK_HIDE_SENSITIVE_VALUES', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Freeze Pane Height Mode: compact (420px), medium (600px), large (780px), full (auto/no-scroll)
  const [tableHeightMode, setTableHeightMode] = useState<'compact' | 'medium' | 'large' | 'full'>('medium');

  // Modal Settings
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState<string>(config.spreadsheetId);
  const [tempSheetName, setTempSheetName] = useState<string>(config.sheetName);

  // Displayed Headers: EXCLUDE ID and TIMESTAMP as strictly requested!
  const displayedHeaders = useMemo(() => {
    return allHeaders.filter(h => !isExcludedHeader(h));
  }, [allHeaders]);

  // Fetch Data function
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorType('NONE');
    setErrorMessage('');

    try {
      const cleanId = config.spreadsheetId.trim();
      const cleanSheet = config.sheetName.trim();

      if (!cleanId) {
        setErrorType('NOT_FOUND');
        setErrorMessage('Spreadsheet ID belum diisi.');
        return;
      }

      // Google Visualization Query API
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cleanSheet)}`;

      const response = await fetch(gvizUrl);
      const text = await response.text();

      // Check if response redirected to Google Login / Restricted access
      if (
        text.includes('Sign in to your Google Account') ||
        text.includes('accounts.google.com') ||
        text.includes('Allow Google Sheets access') ||
        text.includes('document-root')
      ) {
        setErrorType('RESTRICTED');
        setErrorMessage('Google Spreadsheet masih berstatus privat / restricted.');
        return;
      }

      // Extract JSON from google.visualization.Query.setResponse(...)
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!match || !match[1]) {
        if (text.includes('"status":"error"')) {
          try {
            const errObj = JSON.parse(text);
            setErrorType('NOT_FOUND');
            setErrorMessage(errObj.errors?.[0]?.message || 'Sheet tidak ditemukan.');
            return;
          } catch {
            // ignore
          }
        }
        setErrorType('NETWORK');
        setErrorMessage('Format data respon dari Google Sheets tidak dikenali.');
        return;
      }

      const json = JSON.parse(match[1]);

      if (json.status === 'error') {
        setErrorType('NOT_FOUND');
        const reason = json.errors?.[0]?.detailed_message || json.errors?.[0]?.message || 'Gagal mengambil data sheet.';
        setErrorMessage(reason);
        return;
      }

      const table = json.table;
      if (!table) {
        setErrorType('NOT_FOUND');
        setErrorMessage('Tabel data tidak ditemukan di sheet tersebut.');
        return;
      }

      // Parse Headers: Check if cols have labels, or if first row contains headers
      let colHeaders: string[] = [];
      const hasColLabels = table.cols && table.cols.some((c: any) => c && c.label && c.label.trim() !== '');

      if (hasColLabels) {
        colHeaders = table.cols.map((c: any, idx: number) => {
          if (c && c.label && c.label.trim() !== '') {
            return c.label.trim();
          }
          return `Kolom_${idx + 1}`;
        });
      }

      const rawRows = table.rows || [];
      const parsedRows: Record<string, any>[] = [];

      let startRowIndex = 0;

      if (!hasColLabels && rawRows.length > 0) {
        const firstRowCells = rawRows[0]?.c || [];
        colHeaders = firstRowCells.map((cell: any, idx: number) => {
          const val = cell?.f ?? cell?.v;
          return val ? String(val).trim() : `Kolom_${idx + 1}`;
        });
        startRowIndex = 1;
      }

      // Parse row data
      for (let r = startRowIndex; r < rawRows.length; r++) {
        const rowCells = rawRows[r]?.c || [];
        const hasContent = rowCells.some((cell: any) => cell && (cell.v !== null && cell.v !== undefined && cell.v !== ''));
        if (!hasContent) continue;

        const rowObj: Record<string, any> = { _rowIndex: r + 1 };
        colHeaders.forEach((colName, cIdx) => {
          const cell = rowCells[cIdx];
          let cellValue = '';
          if (cell) {
            if (cell.f !== undefined && cell.f !== null) {
              cellValue = cell.f;
            } else if (cell.v !== undefined && cell.v !== null) {
              if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
                const dateParts = cell.v.match(/\d+/g);
                if (dateParts) {
                  const [y, m, d] = dateParts.map(Number);
                  cellValue = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
                } else {
                  cellValue = cell.v;
                }
              } else {
                cellValue = cell.v;
              }
            }
          }
          rowObj[colName] = cellValue;
        });

        parsedRows.push(rowObj);
      }

      setAllHeaders(colHeaders);
      setRows(parsedRows);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching Google Sheets monitoring data:', err);
      setErrorType('NETWORK');
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan saat mengambil data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [config.spreadsheetId, config.sheetName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Settings
  const handleSaveSettings = () => {
    const newConfig: MonitoringConfig = {
      spreadsheetId: tempSpreadsheetId.trim() || DEFAULT_CONFIG.spreadsheetId,
      sheetName: tempSheetName.trim() || DEFAULT_CONFIG.sheetName,
    };
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {
      // ignore
    }
    setShowSettingsModal(false);
  };

  const handleResetSettings = () => {
    setTempSpreadsheetId(DEFAULT_CONFIG.spreadsheetId);
    setTempSheetName(DEFAULT_CONFIG.sheetName);
  };

  // Status and Progress Analytics
  const progressAnalytics = useMemo(() => {
    let totalItems = rows.length;
    let selesaiCount = 0;
    let prosesCount = 0;
    let batalCount = 0;
    let sumPercentage = 0;
    let totalQty = 0;
    let totalValue = 0;

    rows.forEach(r => {
      const prog = calculateProgress(r);
      sumPercentage += prog.percentage;

      if (prog.statusCategory === 'SELESAI') selesaiCount++;
      else if (prog.statusCategory === 'PROSES') prosesCount++;
      else if (prog.statusCategory === 'BATAL') batalCount++;

      // Sum Qty
      const qtyVal = Number(String(r['QTY_PCS'] || r['qty'] || 0).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(qtyVal)) totalQty += qtyVal;

      // Sum Value
      const valVal = Number(String(r['VALUE'] || r['value'] || 0).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(valVal)) totalValue += valVal;
    });

    const averageProgress = totalItems > 0 ? Math.round(sumPercentage / totalItems) : 0;
    const selesaiPercentage = totalItems > 0 ? Math.round((selesaiCount / totalItems) * 100) : 0;

    return {
      totalItems,
      selesaiCount,
      prosesCount,
      batalCount,
      averageProgress,
      selesaiPercentage,
      totalQty,
      totalValue,
    };
  }, [rows]);

  // Unique values for Kategori filter
  const uniqueKategoriValues = useMemo(() => {
    const values = new Set<string>();
    rows.forEach(r => {
      const val = r['KATEGORI'] || r['kategori'];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        values.add(String(val).trim());
      }
    });
    return Array.from(values).sort();
  }, [rows]);

  // Filtered & Sorted Rows
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // Global Search across displayed headers
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(row => {
        return displayedHeaders.some(h => {
          const cell = row[h];
          if (cell === undefined || cell === null) return false;
          return String(cell).toLowerCase().includes(query);
        });
      });
    }

    // Status Filter (SELESAI, PROSES, BATAL)
    if (statusFilter !== 'ALL') {
      result = result.filter(row => {
        const prog = calculateProgress(row);
        return prog.statusCategory === statusFilter;
      });
    }

    // Kategori Filter
    if (kategoriFilter !== 'ALL') {
      result = result.filter(row => {
        const cat = String(row['KATEGORI'] || row['kategori'] || '').trim();
        return cat === kategoriFilter;
      });
    }

    // Sorting
    if (sortColumn) {
      result.sort((a, b) => {
        // Special sorting if sorting by STATUS (sort by percentage!)
        if (sortColumn === 'STATUS') {
          const progA = calculateProgress(a).percentage;
          const progB = calculateProgress(b).percentage;
          return sortDirection === 'asc' ? progA - progB : progB - progA;
        }

        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === valB) return 0;
        if (valA === undefined || valA === null || valA === '') return 1;
        if (valB === undefined || valB === null || valB === '') return -1;

        // Try numeric sort
        const numA = Number(String(valA).replace(/[^0-9.-]+/g, ''));
        const numB = Number(String(valB).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && String(valA).match(/\d/) && String(valB).match(/\d/)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        // String sort
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === 'asc'
          ? strA.localeCompare(strB, 'id')
          : strB.localeCompare(strA, 'id');
      });
    }

    return result;
  }, [rows, displayedHeaders, searchQuery, statusFilter, kategoriFilter, sortColumn, sortDirection]);

  // Paginated Rows
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(filteredAndSortedRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredAndSortedRows;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  // Adjust page
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Sorting
  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colName);
      setSortDirection('asc');
    }
  };

  // Export to Excel (also excludes ID and TIMESTAMP!)
  const handleExportExcel = () => {
    if (filteredAndSortedRows.length === 0) return;

    const exportData = filteredAndSortedRows.map((r, i) => {
      const obj: Record<string, any> = { 'No': i + 1 };
      const prog = calculateProgress(r);
      obj['PROGRES (%)'] = `${prog.percentage}%`;
      obj['STATUS'] = prog.badgeText;

      displayedHeaders.forEach(h => {
        if (h !== 'STATUS') {
          if (isSensitiveColumn(h) && hideSensitiveValues) {
            obj[h] = 'Rp •••••••• (Sensor)';
          } else {
            obj[h] = r[h] ?? '';
          }
        }
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName || 'Monitoring');

    const fileName = `Monitoring_Pemusnahan_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Format currency or numbers
  const formatCellValue = (header: string, val: any): React.ReactNode => {
    if (val === undefined || val === null || val === '') return <span className="text-slate-300">-</span>;

    const hUpper = header.toUpperCase();

    // Link URL
    if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
      return (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 hover:underline font-bold"
        >
          <ExternalLink size={12} />
          <span>Lihat Tautan</span>
        </a>
      );
    }

    // Sensitive Currency (VALUE, COGS, HARGA)
    if (isSensitiveColumn(header)) {
      if (hideSensitiveValues) {
        return (
          <button
            type="button"
            onClick={toggleHideSensitive}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-800 border border-slate-200/80 transition-colors font-mono text-[11px] cursor-pointer group"
            title="Nilai sensitif disembunyikan. Klik untuk menampilkan seluruh angka."
          >
            <EyeOff size={11} className="text-amber-600" />
            <span className="font-bold tracking-wider">Rp ••••••••</span>
          </button>
        );
      }

      const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(num) && num > 0) {
        return (
          <span className="font-mono font-medium text-slate-800">
            Rp {num.toLocaleString('id-ID')}
          </span>
        );
      }
      return <span className="font-mono text-slate-400">Rp 0</span>;
    }

    // Quantities (QTY_PCS)
    if (hUpper.includes('QTY') || hUpper.includes('JUMLAH')) {
      const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(num)) {
        return (
          <span className="font-mono font-bold text-slate-800">
            {num.toLocaleString('id-ID')}
          </span>
        );
      }
    }

    // Milestone statuses: CLOSE, OPEN, etc.
    const strVal = String(val).trim();
    if (strVal.toUpperCase() === 'CLOSE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={11} className="text-emerald-600" />
          CLOSE
        </span>
      );
    }
    if (strVal.toUpperCase() === 'OPEN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={11} className="text-amber-600" />
          OPEN
        </span>
      );
    }

    return <span>{strVal}</span>;
  };

  const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`;

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* TOP HEADER & ACTION CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-xl shadow-xs shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                Monitoring Pemusnahan Barang
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Live Sheet
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Sheet: <strong className="text-slate-700 font-bold">{config.sheetName}</strong></span>
              <span>•</span>
              <span className="text-slate-400">ID & Timestamp disembunyikan</span>
              {lastUpdated && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">Sinkronisasi: {lastUpdated.toLocaleTimeString('id-ID')}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Tombol Sensor Nilai Sensitif (VALUE, COGS, TOTAL NILAI) */}
          <button
            type="button"
            onClick={toggleHideSensitive}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              hideSensitiveValues
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={
              hideSensitiveValues
                ? 'Nilai sensitif (Value & COGS) sedang disembunyikan. Klik untuk menampilkan seluruh nominal.'
                : 'Nilai sensitif sedang ditampilkan. Klik untuk menyembunyikan (sensor) nominal.'
            }
          >
            {hideSensitiveValues ? (
              <>
                <EyeOff size={14} className="text-amber-700" />
                <span>Sensor Nilai: Aktif</span>
              </>
            ) : (
              <>
                <Eye size={14} className="text-slate-600" />
                <span>Sensor Nilai: Terbuka</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data dari Google Sheets"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
            <span>{isRefreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredAndSortedRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Download Data ke Format Excel (.xlsx)"
          >
            <Download size={14} className="text-emerald-700" />
            <span>Export Excel</span>
          </button>

          <a
            href={googleSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs hover:shadow-xs transition-all"
            title="Buka file Google Sheets langsung di Google Drive"
          >
            <ExternalLink size={14} />
            <span>Buka Sheet</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setTempSpreadsheetId(config.spreadsheetId);
              setTempSheetName(config.sheetName);
              setShowSettingsModal(true);
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Pengaturan ID Spreadsheet & Nama Sheet"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PROGRES PEMUSNAHAN OVERVIEW BAR (PROGRESS BERDASARKAN KOLOM STATUS) */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                Progres Pemusnahan Berdasarkan Status
              </h3>
              <p className="text-[11px] text-slate-400">
                Tingkat penyelesaian disposal berdasarkan tahapan status batch pengajuan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Selesai: {progressAnalytics.selesaiCount} Batch ({progressAnalytics.selesaiPercentage}%)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Dalam Proses: {progressAnalytics.prosesCount} Batch
            </span>
          </div>
        </div>

        {/* Visual Progress Bar Strip */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 flex items-center gap-1">
              <span>Tingkat Penyelesaian Kumulatif</span>
              <span className="text-slate-400 font-normal">({progressAnalytics.selesaiCount}/{progressAnalytics.totalItems} Batch Tuntas)</span>
            </span>
            <span className="text-emerald-700 font-mono text-sm font-black">
              {progressAnalytics.averageProgress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200 flex">
            {/* Selesai portion */}
            <div
              className="bg-emerald-500 h-full rounded-l-full"
              style={{ width: `${progressAnalytics.selesaiPercentage}%` }}
              title={`Selesai: ${progressAnalytics.selesaiPercentage}%`}
            />
            {/* Proses portion */}
            <div
              className="bg-amber-400 h-full"
              style={{
                width: `${progressAnalytics.totalItems > 0 ? (progressAnalytics.prosesCount / progressAnalytics.totalItems) * 100 : 0}%`,
              }}
              title={`Dalam Proses: ${progressAnalytics.prosesCount} Batch`}
            />
            {/* Batal portion */}
            {progressAnalytics.batalCount > 0 && (
              <div
                className="bg-rose-500 h-full transition-all duration-700"
                style={{
                  width: `${(progressAnalytics.batalCount / progressAnalytics.totalItems) * 100}%`,
                }}
                title={`Batal: ${progressAnalytics.batalCount} Batch`}
              />
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] text-slate-500 font-medium block">Total Batch Pengajuan</span>
            <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
              {progressAnalytics.totalItems} <span className="text-xs font-normal text-slate-400">Batch</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] text-slate-500 font-medium block">Total Fisik Dimusnahkan</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
              {progressAnalytics.totalQty.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">PCS</span>
            </span>
          </div>

          {/* TOTAL NILAI BARANG DENGAN SENSOR */}
          <div
            onClick={toggleHideSensitive}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer group select-none"
            title="Klik untuk menyembunyikan atau menampilkan nilai sensitif"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-slate-500 font-medium block">Total Nilai Barang (Value)</span>
              {hideSensitiveValues ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-200">
                  <EyeOff size={9} /> SENSOR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-200">
                  <Eye size={9} /> LIHAT
                </span>
              )}
            </div>
            {hideSensitiveValues ? (
              <span className="text-sm sm:text-base font-black text-slate-400 font-mono tracking-widest block mt-0.5 group-hover:text-amber-700 transition-colors">
                Rp ••••••••••
              </span>
            ) : (
              <span className="text-sm sm:text-base font-black text-slate-800 font-mono truncate block mt-0.5" title={`Rp ${progressAnalytics.totalValue.toLocaleString('id-ID')}`}>
                Rp {progressAnalytics.totalValue.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] text-slate-500 font-medium block">Kolom Ditampilkan</span>
            <span className="text-base sm:text-lg font-black text-indigo-700 font-mono">
              {displayedHeaders.length} <span className="text-xs font-normal text-slate-400">Kolom</span>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER & SEARCH TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nomor pengajuan, SLOC, keterangan..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
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

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter size={13} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Progres Status</option>
              <option value="SELESAI">✓ Selesai (100%)</option>
              <option value="PROSES">↻ Dalam Proses (20% - 90%)</option>
              <option value="BATAL">✗ Batal (0%)</option>
            </select>
          </div>

          {/* Kategori Filter */}
          {uniqueKategoriValues.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <select
                value={kategoriFilter}
                onChange={e => setKategoriFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Semua Kategori</option>
                {uniqueKategoriValues.map(k => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Indikator Urutan Spreadsheet */}
          {sortColumn ? (
            <button
              type="button"
              onClick={() => setSortColumn(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all cursor-pointer"
              title="Klik untuk mengembalikan urutan persis seperti di Google Spreadsheet"
            >
              <ArrowUpDown size={13} className="text-amber-700" />
              <span>Urutan: {sortColumn} ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</span>
              <span className="ml-1 px-1.5 py-0.2 bg-amber-200/80 text-amber-900 rounded text-[10px]">Reset ke Asli</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold select-none"
              title="Urutan baris tabel 100% mengikuti urutan baris di Google Spreadsheet"
            >
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Urutan Asli Sesuai Spreadsheet</span>
            </div>
          )}

          {/* Kontrol Freeze Pane & Tinggi Tabel */}
          <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <div
              className="flex items-center gap-1 px-1.5 text-[11px] font-bold text-slate-700 select-none"
              title="Freeze Pane aktif: Judul kolom selalu terkunci di atas saat scroll ke bawah"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Freeze Header:</span>
            </div>
            <button
              type="button"
              onClick={() => setTableHeightMode('compact')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tableHeightMode === 'compact'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Tinggi 440px (Kompak)"
            >
              440px
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode('medium')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tableHeightMode === 'medium'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Tinggi 620px (Standar Freeze Pane)"
            >
              620px
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode('large')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tableHeightMode === 'large'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Tinggi 820px (Lega)"
            >
              820px
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode(tableHeightMode === 'full' ? 'medium' : 'full')}
              className={`p-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tableHeightMode === 'full'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={tableHeightMode === 'full' ? 'Kembali ke mode scroll dengan Freeze Pane' : 'Mode Tinggi Penuh (Scroll Halaman)'}
            >
              {tableHeightMode === 'full' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          {/* Page Size */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Baris:</span>
            <select
              value={pageSize}
              onChange={e => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="ALL">Semua</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DATA TABLE DENGAN FREEZE PANE (HEADER & FIRST COLUMNS PINNED) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Mengambil data dari Google Sheets...</p>
            <p className="text-[11px] text-slate-400">Sheet: {config.sheetName}</p>
          </div>
        ) : displayedHeaders.length === 0 || rows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileSpreadsheet size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700">Belum Ada Data di Sheet MONITORING</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tabel di Google Sheets masih kosong atau kolom belum terdeteksi.
            </p>
            <div className="pt-2">
              <a
                href={googleSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
              >
                <ExternalLink size={14} />
                <span>Buka Google Sheets</span>
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* CONTAINER DENGAN VERTICAL & HORIZONTAL FREEZE PANE */}
            <div
              className={`overflow-x-auto overflow-y-auto ${
                tableHeightMode === 'compact'
                  ? 'max-h-[440px]'
                  : tableHeightMode === 'medium'
                  ? 'max-h-[620px]'
                  : tableHeightMode === 'large'
                  ? 'max-h-[820px]'
                  : 'max-h-none'
              } relative border-b border-slate-200 scrollbar-thin`}
            >
              <table className="w-full text-left border-separate border-spacing-0 text-xs">
                {/* THEAD FREEZE PANE: STICKY TOP-0 SEHINGGA JUDUL KOLOM SELALU KELIHATAN */}
                <thead className="sticky top-0 z-30 shadow-xs">
                  <tr className="bg-slate-100 text-slate-700 font-black tracking-tight">
                    {/* KOLOM NO: FREEZE PANE KIRI & ATAS (Z-40) */}
                    <th className="sticky top-0 left-0 z-40 bg-slate-100 py-3 px-3 w-12 min-w-[48px] max-w-[48px] text-center border-b border-r border-slate-200 text-slate-500 font-bold shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      No
                    </th>

                    {/* DEDICATED PROGRES & STATUS: FREEZE PANE KIRI & ATAS (Z-40) */}
                    <th
                      onClick={() => handleSort('STATUS')}
                      className="sticky top-0 left-12 z-40 bg-slate-100 py-3 px-4 border-b border-r border-slate-200 cursor-pointer select-none hover:bg-slate-200 transition-colors whitespace-nowrap min-w-[200px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex items-center gap-1.5 text-emerald-800">
                        <Activity size={14} />
                        <span className="font-extrabold uppercase">PROGRES & STATUS</span>
                        <span className="text-slate-400 ml-auto">
                          {sortColumn === 'STATUS' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-emerald-600 font-bold" />
                            ) : (
                              <ArrowDown size={12} className="text-emerald-600 font-bold" />
                            )
                          ) : (
                            <ArrowUpDown size={11} className="opacity-40" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* OTHER DISPLAYED HEADERS: FREEZE PANE ATAS (STICKY TOP-0 Z-30) */}
                    {displayedHeaders
                      .filter(h => h !== 'STATUS')
                      .map(h => {
                        const isSorted = sortColumn === h;
                        const isSensitive = isSensitiveColumn(h);
                        return (
                          <th
                            key={h}
                            onClick={() => handleSort(h)}
                            className={`sticky top-0 z-30 bg-slate-100 py-3 px-3.5 border-b border-r border-slate-200 last:border-r-0 cursor-pointer select-none hover:bg-slate-200 transition-colors whitespace-nowrap ${
                              isSensitive ? 'bg-amber-50/70' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-700">{h}</span>
                              {isSensitive && (
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    hideSensitiveValues
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                  title={hideSensitiveValues ? 'Nilai sensitif disembunyikan (Klik untuk membuka)' : 'Nilai sensitif terbuka'}
                                >
                                  {hideSensitiveValues ? <EyeOff size={10} /> : <Eye size={10} />}
                                </span>
                              )}
                              <span className="text-slate-400">
                                {isSorted ? (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp size={12} className="text-emerald-600 font-bold" />
                                  ) : (
                                    <ArrowDown size={12} className="text-emerald-600 font-bold" />
                                  )
                                ) : (
                                  <ArrowUpDown size={11} className="opacity-40" />
                                )}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={displayedHeaders.length + 1} className="p-8 text-center text-slate-400">
                        Tidak ada data yang cocok dengan pencarian atau filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const rowNumber = pageSize === 'ALL' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                      const prog = calculateProgress(row);

                      return (
                        <tr
                          key={row._rowIndex || idx}
                          className="hover:bg-emerald-50/40 transition-colors group odd:bg-white even:bg-slate-50/50"
                        >
                          {/* STICKY NO CELL (STICKY LEFT-0 Z-20) */}
                          <td className="sticky left-0 z-20 bg-white group-odd:bg-white group-even:bg-slate-50 group-hover:bg-emerald-50 py-2.5 px-3 text-center border-b border-r border-slate-200/60 text-slate-400 font-mono text-[11px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                            {rowNumber}
                          </td>

                          {/* STICKY PROGRES BERDASARKAN STATUS CELL (STICKY LEFT-12 Z-20) */}
                          <td className="sticky left-12 z-20 bg-emerald-50/30 group-odd:bg-emerald-50/30 group-even:bg-emerald-50/50 group-hover:bg-emerald-100/60 py-2.5 px-4 border-b border-r border-slate-200/60 whitespace-nowrap min-w-[200px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${prog.badgeClass}`}>
                                  {prog.statusCategory === 'SELESAI' && <CheckCircle2 size={11} />}
                                  {prog.statusCategory === 'PROSES' && <Clock size={11} className="text-amber-600" />}
                                  {prog.statusCategory === 'BATAL' && <AlertCircle size={11} />}
                                  <span>{prog.badgeText}</span>
                                </span>

                                <span className="font-mono text-xs font-black text-slate-700">
                                  {prog.label}
                                </span>
                              </div>

                              {/* Visual Progress Bar */}
                              <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden border border-slate-200/80">
                                <div
                                  className={`h-full rounded-full ${prog.barColor}`}
                                  style={{ width: `${prog.percentage}%` }}
                                />
                              </div>

                              <div className="text-[10px] text-slate-500 font-medium truncate">
                                {prog.sublabel}
                              </div>
                            </div>
                          </td>

                          {/* Remaining Columns */}
                          {displayedHeaders
                            .filter(h => h !== 'STATUS')
                            .map(h => (
                              <td
                                key={h}
                                className="py-2.5 px-3.5 border-b border-r border-slate-200/50 last:border-r-0 text-slate-700 whitespace-nowrap"
                              >
                                {formatCellValue(h, row[h])}
                              </td>
                            ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan {(currentPage - 1) * (pageSize as number) + 1} -{' '}
                  {Math.min(currentPage * (pageSize as number), filteredAndSortedRows.length)} dari{' '}
                  {filteredAndSortedRows.length} baris
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-3 py-1 font-bold text-slate-700">
                    Halaman {currentPage} dari {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SETTINGS MODAL */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-800">Pengaturan Google Sheets Monitoring</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Spreadsheet ID</label>
                <input
                  type="text"
                  value={tempSpreadsheetId}
                  onChange={e => setTempSpreadsheetId(e.target.value)}
                  placeholder="ID Spreadsheet..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Sheet</label>
                <input
                  type="text"
                  value={tempSheetName}
                  onChange={e => setTempSheetName(e.target.value)}
                  placeholder="Contoh: MONITORING"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetSettings}
                className="text-xs text-slate-500 hover:text-rose-600 font-medium underline"
              >
                Reset ke Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  Simpan & Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
