import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  RefreshCw, 
  Upload, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRightLeft, 
  FileSpreadsheet, 
  XCircle, 
  Info,
  CheckCircle,
  HelpCircle,
  Layers,
  Database,
  Table,
  Filter
} from 'lucide-react';
import { compareLargoAndSap, CompareResultRow } from '../../utils/logisticsCalculations';
import { useNotification } from '../../context/NotificationContext';

export function BatchCheckerModule() {
  const { showToast } = useNotification();

  const [largoRows, setLargoRows] = useState<any[]>([]);
  const [sapRows, setSapRows] = useState<any[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResultRow[]>([]);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Helper untuk membaca nilai kolom secara fleksibel tanpa terpengaruh huruf besar/kecil/spasi
  const extractField = (row: Record<string, any>, candidateKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const cand of candidateKeys) {
      const cleanCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = rowKeys.find(
        k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanCand
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return row[foundKey];
      }
    }
    return undefined;
  };

  const handleLargoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const mapped = data.map(r => {
          const sloc = extractField(r, ['SLOC', 'Storage Location', 'Sloc', 'Storage Loc', 'Lokasi', 'Gudang']) ?? '';
          const item = extractField(r, ['Item', 'Material', 'Item Code', 'Kode Material', 'Kode Barang', 'Material Number', 'No. Material', 'Part Number', 'SKU']) ?? '';
          const desc = extractField(r, ['Description', 'Material Description', 'Item Name', 'Deskripsi', 'Nama Barang', 'Nama Material', 'Text']) ?? '';
          const batch = extractField(r, ['Batch', 'Batch Number', 'No Batch', 'No. Batch', 'Nomor Batch', 'Charg', 'Charge', 'Lot']) ?? '';
          const qty = extractField(r, ['Qty', 'Quantity', 'Stok', 'Jumlah', 'Stock', 'Balance', 'Total Qty', 'Ending Qty']) ?? 0;

          return {
            sloc: String(sloc).trim(),
            item: String(item).trim(),
            desc: String(desc).trim(),
            batch: String(batch).trim(),
            qty
          };
        }).filter(r => r.item && r.batch);

        setLargoRows(mapped);
        setCompareResults([]);
        showToast('File LARGO Dimuat', `Berhasil membaca ${mapped.length} baris data LARGO`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Gagal', 'Gagal membaca file Excel LARGO. Pastikan format valid.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSapFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const mapped = data.map(r => {
          const sloc = extractField(r, ['Storage Location', 'Stor. Location', 'SLoc', 'SLOC', 'Lok. Simpan', 'Lokasi Simpan', 'Lokasi']) ?? '';
          const item = extractField(r, ['Material', 'Material Number', 'Item', 'Kode Material', 'Material No.', 'No. Material', 'Item Code']) ?? '';
          const desc = extractField(r, ['Material Description', 'Description', 'Item Name', 'Deskripsi', 'Nama Barang']) ?? '';
          const batch = extractField(r, ['Batch', 'Batch Number', 'Charg', 'Charge', 'No. Batch', 'Nomor Batch', 'Lot']) ?? '';
          const unrestricted = extractField(r, ['Unrestricted', 'Unrestricted Use', 'Bebas Digunakan', 'Penggunaan bebas', 'Bebas', 'Qty Bebas']) ?? 0;
          const blocked = extractField(r, ['Blocked', 'Blocked Stock', 'Diblokir', 'Terblokir', 'Blokir']) ?? 0;
          const qty = extractField(r, ['Qty', 'Quantity', 'Jumlah', 'Total Stock', 'Stok']);

          return {
            sloc: String(sloc).trim(),
            item: String(item).trim(),
            desc: String(desc).trim(),
            batch: String(batch).trim(),
            unrestricted,
            blocked,
            qty
          };
        }).filter(r => r.item && r.batch);

        setSapRows(mapped);
        setCompareResults([]);
        showToast('File SAP Dimuat', `Berhasil membaca ${mapped.length} baris data SAP MB52`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Gagal', 'Gagal membaca file Excel SAP. Pastikan format valid.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunComparison = () => {
    if (largoRows.length === 0 || sapRows.length === 0) {
      showToast('Perhatian', 'Harap upload file Excel LARGO dan SAP terlebih dahulu', 'info');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const results = compareLargoAndSap(largoRows, sapRows);
      setCompareResults(results);
      setIsProcessing(false);
      showToast('Rekonsiliasi Selesai', `Perbandingan berhasil (${results.length} item terekonsiliasi)`, 'success');
    }, 100);
  };

  // Helper format baris untuk export Excel (100% konsisten dengan tabel di webapp)
  const mapRowForExport = (r: CompareResultRow, index?: number) => ({
    No: index !== undefined ? index + 1 : r.no,
    SLOC: r.sloc,
    'Item Code': r.item,
    'Deskripsi Material': r.desc,
    'Batch LARGO': r.bLargo || '-',
    'Batch SAP': r.bSap || '-',
    'Qty LARGO': r.qLargo,
    'Qty SAP': r.qSap,
    'Selisih (SAP - LARGO)': r.diff,
    Status: r.status,
    'Rekomendasi Pemetaan': r.rec
  });

  // Filtered dataset
  const filteredResults = compareResults.filter(r => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      r.item.toLowerCase().includes(term) ||
      r.desc.toLowerCase().includes(term) ||
      r.sloc.toLowerCase().includes(term) ||
      r.bLargo.toLowerCase().includes(term) ||
      r.bSap.toLowerCase().includes(term) ||
      r.status.toLowerCase().includes(term) ||
      r.rec.toLowerCase().includes(term);

    if (!matchSearch) return false;

    if (filterStatus === 'MATCH') return r.status === 'MATCH';
    if (filterStatus === 'QTY_DIFF') return r.status === 'QTY_DIFF';
    if (filterStatus === 'REPLACE') return r.status === 'REPLACE';
    if (filterStatus === 'NO_CANDIDATE') return r.status === 'NO_CANDIDATE';
    if (filterStatus === 'LARGO_ONLY') return r.status === 'LARGO_ONLY';

    return true;
  });

  // Export 1: Export Tampilan Saat Ini (100% persis dengan baris & filter yang dilihat user di layar)
  const handleExportFiltered = () => {
    if (filteredResults.length === 0) {
      showToast('Data Kosong', 'Tidak ada baris data yang cocok untuk diexport.', 'warning');
      return;
    }

    const exportData = filteredResults.map((r, idx) => mapRowForExport(r, idx));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    
    const sheetName = filterStatus === 'all' 
      ? 'Rekonsiliasi Batch' 
      : `Batch ${filterStatus}`.slice(0, 31);
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Hasil_Batch_Checker_${filterStatus}_${Date.now()}.xlsx`);
    showToast('Export Sukses', `Hasil perbandingan (${filteredResults.length} baris) berhasil diunduh.`, 'success');
  };

  // Export 2: Export Rekonsiliasi Komprehensif (Multi-Sheet Lengkap)
  const handleExportMultiSheet = () => {
    if (compareResults.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Semua Rekonsiliasi
    const allData = compareResults.map((r, idx) => mapRowForExport(r, idx));
    const wsAll = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Rekonsiliasi');

    // Sheet 2: Pemetaan Batch (REPLACE)
    const replaceData = compareResults
      .filter(r => r.status === 'REPLACE')
      .map((r, idx) => mapRowForExport(r, idx));
    if (replaceData.length > 0) {
      const wsReplace = XLSX.utils.json_to_sheet(replaceData);
      XLSX.utils.book_append_sheet(wb, wsReplace, 'Pemetaan Batch (REPLACE)');
    }

    // Sheet 3: Selisih Qty (QTY_DIFF)
    const diffData = compareResults
      .filter(r => r.status === 'QTY_DIFF')
      .map((r, idx) => mapRowForExport(r, idx));
    if (diffData.length > 0) {
      const wsDiff = XLSX.utils.json_to_sheet(diffData);
      XLSX.utils.book_append_sheet(wb, wsDiff, 'Selisih Qty');
    }

    // Sheet 4: Tanpa Kandidat di LARGO (NO_CANDIDATE)
    const noCandData = compareResults
      .filter(r => r.status === 'NO_CANDIDATE')
      .map((r, idx) => mapRowForExport(r, idx));
    if (noCandData.length > 0) {
      const wsNoCand = XLSX.utils.json_to_sheet(noCandData);
      XLSX.utils.book_append_sheet(wb, wsNoCand, 'Hanya di SAP');
    }

    // Sheet 5: Hanya di LARGO (LARGO_ONLY)
    const largoOnlyData = compareResults
      .filter(r => r.status === 'LARGO_ONLY')
      .map((r, idx) => mapRowForExport(r, idx));
    if (largoOnlyData.length > 0) {
      const wsLargoOnly = XLSX.utils.json_to_sheet(largoOnlyData);
      XLSX.utils.book_append_sheet(wb, wsLargoOnly, 'Hanya di LARGO');
    }

    // Sheet 6: Ringkasan / Summary KPI
    const summaryData = [
      { Indikator: 'Total Data Rekonsiliasi', Jumlah_Baris: compareResults.length },
      { Indikator: 'MATCH (Sesuai 100%)', Jumlah_Baris: countByStatus('MATCH') },
      { Indikator: 'REPLACE (Pemetaan Ganti Batch)', Jumlah_Baris: countByStatus('REPLACE') },
      { Indikator: 'QTY_DIFF (Selisih Jumlah Qty)', Jumlah_Baris: countByStatus('QTY_DIFF') },
      { Indikator: 'NO_CANDIDATE (Hanya ada di SAP)', Jumlah_Baris: countByStatus('NO_CANDIDATE') },
      { Indikator: 'LARGO_ONLY (Hanya ada di LARGO)', Jumlah_Baris: countByStatus('LARGO_ONLY') },
      { Indikator: 'Tanggal Dibuat', Jumlah_Baris: new Date().toLocaleString('id-ID') }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Statistik');

    XLSX.writeFile(wb, `Rekonsiliasi_Batch_Lengkap_LARGO_vs_SAP_${Date.now()}.xlsx`);
    showToast('Export Sukses', 'Seluruh data multi-sheet berhasil diexport ke Excel.', 'success');
  };

  const countByStatus = (st: string) => compareResults.filter(r => r.status === st).length;

  return (
    <div className="space-y-5">
      {/* Upload Section Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Largo Box */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center font-black text-xs">
                1
              </div>
              <span className="text-xs font-bold text-slate-800">
                Data Excel LARGO ({largoRows.length} baris)
              </span>
            </div>
            <label className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-95">
              <Upload size={13} />
              <span>{largoRows.length > 0 ? 'Ganti LARGO' : 'Upload LARGO'}</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleLargoFileUpload} className="hidden" />
            </label>
          </div>
          <p className="text-[11px] text-slate-500 m-0">
            Kolom didukung: <code className="text-blue-900 bg-blue-50 px-1 py-0.5 rounded">SLOC</code>, <code className="text-blue-900 bg-blue-50 px-1 py-0.5 rounded">Item / Material</code>, <code className="text-blue-900 bg-blue-50 px-1 py-0.5 rounded">Batch</code>, <code className="text-blue-900 bg-blue-50 px-1 py-0.5 rounded">Qty / Stok</code>
          </p>
        </div>

        {/* SAP Box */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs">
                2
              </div>
              <span className="text-xs font-bold text-slate-800">
                Data Excel SAP MB52 ({sapRows.length} baris)
              </span>
            </div>
            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-95">
              <Upload size={13} />
              <span>{sapRows.length > 0 ? 'Ganti SAP' : 'Upload SAP'}</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleSapFileUpload} className="hidden" />
            </label>
          </div>
          <p className="text-[11px] text-slate-500 m-0">
            Kolom didukung: <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">Storage Loc / SLOC</code>, <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">Material</code>, <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">Batch / Charg</code>, <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">Unrestricted / Qty</code>
          </p>
        </div>
      </div>

      {/* Compare Trigger Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleRunComparison}
          disabled={isProcessing || largoRows.length === 0 || sapRows.length === 0}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-950 hover:to-indigo-950 text-white text-xs font-bold rounded-2xl shadow-md disabled:opacity-40 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
        >
          <ArrowRightLeft size={16} className={isProcessing ? 'animate-spin' : ''} />
          <span>{isProcessing ? 'Sedang Membandingkan...' : 'Bandingkan LARGO vs SAP & Pemetaan Batch'}</span>
        </button>
      </div>

      {/* Comparison Output */}
      {compareResults.length > 0 && (
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total Data</div>
              <div className="text-base font-black mt-0.5">{compareResults.length}</div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('MATCH')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'MATCH'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">MATCH</div>
              <div className="text-base font-black mt-0.5">{countByStatus('MATCH')}</div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('REPLACE')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'REPLACE'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">PEMETAAN (REPLACE)</div>
              <div className="text-base font-black mt-0.5">{countByStatus('REPLACE')}</div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('QTY_DIFF')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'QTY_DIFF'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200 text-amber-900'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">SELISIH QTY</div>
              <div className="text-base font-black mt-0.5">{countByStatus('QTY_DIFF')}</div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('NO_CANDIDATE')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'NO_CANDIDATE'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-red-50/70 hover:bg-red-100/70 border-red-200 text-red-900'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">HANYA DI SAP</div>
              <div className="text-base font-black mt-0.5">{countByStatus('NO_CANDIDATE')}</div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('LARGO_ONLY')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'LARGO_ONLY'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'
              }`}
            >
              <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">HANYA DI LARGO</div>
              <div className="text-base font-black mt-0.5">{countByStatus('LARGO_ONLY')}</div>
            </button>
          </div>

          {/* Search & Export Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Search input */}
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari Item, Material, Batch, SLOC, atau Rekomendasi..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportFiltered}
                className="px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Download sesuai filter & pencarian yang sedang tampil di layar"
              >
                <Download size={13} />
                <span>Export Tampilan ({filteredResults.length})</span>
              </button>

              <button
                type="button"
                onClick={handleExportMultiSheet}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Download Excel lengkap dengan sheet terpisah untuk setiap status dan pemetaan batch"
              >
                <FileSpreadsheet size={13} />
                <span>Export Multi-Sheet Lengkap</span>
              </button>
            </div>
          </div>

          {/* Webapp Table (100% synchronized with Excel data) */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[440px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="p-2.5 border-b border-slate-200 text-center w-12">No</th>
                  <th className="p-2.5 border-b border-slate-200">SLOC</th>
                  <th className="p-2.5 border-b border-slate-200">Item Code</th>
                  <th className="p-2.5 border-b border-slate-200">Deskripsi Material</th>
                  <th className="p-2.5 border-b border-slate-200">Batch LARGO</th>
                  <th className="p-2.5 border-b border-slate-200">Batch SAP</th>
                  <th className="p-2.5 border-b border-slate-200 text-right">Qty LARGO</th>
                  <th className="p-2.5 border-b border-slate-200 text-right">Qty SAP</th>
                  <th className="p-2.5 border-b border-slate-200 text-right">Selisih</th>
                  <th className="p-2.5 border-b border-slate-200">Status</th>
                  <th className="p-2.5 border-b border-slate-200">Rekomendasi Pemetaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-semibold">
                      Tidak ada data yang sesuai dengan filter atau pencarian "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 font-bold font-mono text-blue-900">
                        {r.sloc}
                      </td>
                      <td className="p-2.5 font-mono font-semibold text-slate-900">
                        {r.item}
                      </td>
                      <td className="p-2.5 truncate max-w-[200px]" title={r.desc}>
                        {r.desc}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800">
                        {r.bLargo || '-'}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800">
                        {r.bSap || '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold">
                        {r.qLargo.toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold">
                        {r.qSap.toLocaleString('id-ID')}
                      </td>
                      <td className={`p-2.5 text-right font-mono font-bold ${
                        r.diff === 0 ? 'text-slate-400' : r.diff > 0 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {r.diff > 0 ? `+${r.diff.toLocaleString('id-ID')}` : r.diff.toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap ${
                          r.status === 'MATCH' ? 'bg-emerald-100 text-emerald-800' :
                          r.status === 'REPLACE' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                          r.status === 'QTY_DIFF' ? 'bg-amber-100 text-amber-800' :
                          r.status === 'NO_CANDIDATE' ? 'bg-red-100 text-red-800' :
                          'bg-slate-200 text-slate-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-700 text-[11px]">
                        {r.rec}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
            <span>Menampilkan {filteredResults.length} dari total {compareResults.length} baris terekonsiliasi</span>
            <span>Semua format data di webapp dan export Excel 100% sinkron</span>
          </div>
        </div>
      )}
    </div>
  );
}
