import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Upload, Download, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, Search, FileSpreadsheet, Eraser, Info } from 'lucide-react';
import { edComputeExpiredRow, EdComputeResult } from '../../utils/logisticsCalculations';
import { useNotification } from '../../context/NotificationContext';

export function EdCheckerModule() {
  const { showToast } = useNotification();

  // Single Tester State
  const [singleMaterial, setSingleMaterial] = useState('');
  const [singleDesc, setSingleDesc] = useState('');
  const [singleBatch, setSingleBatch] = useState('');

  // Excel Batch State
  const [excelRows, setExcelRows] = useState<EdComputeResult[]>([]);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'warning' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Single Result Computation
  const singleResult = edComputeExpiredRow(singleMaterial, singleDesc, singleBatch);

  const formatDate = (d: Date | null) => {
    if (!d) return '-';
    if (d.getFullYear() === 9999) return 'Non-Expired (Abstract)';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleClearSingle = () => {
    setSingleMaterial('');
    setSingleDesc('');
    setSingleBatch('');
    showToast('Bersih', 'Form masukan single batch telah dibersihkan', 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingExcel(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const computed: EdComputeResult[] = data.map((row) => {
          const mat = String(row['Material'] || row['Kode Material'] || row['Material Code'] || '').trim();
          const desc = String(row['Material Description'] || row['Deskripsi'] || row['Nama Barang'] || '').trim();
          const bat = String(row['Batch'] || row['Kode Batch'] || row['Batch Number'] || '').trim();
          return edComputeExpiredRow(mat, desc, bat);
        });

        setExcelRows(computed);
        showToast('Sukses', `Berhasil memproses ${computed.length} baris data Excel`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Gagal', 'Gagal membaca file Excel. Pastikan format file sesuai.', 'danger');
      } finally {
        setIsLoadingExcel(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      { Material: '21104501', 'Material Description': 'KINO SAMANTHA HAIR OIL 20ML', Batch: 'L911346N' },
      { Material: '21104502', 'Material Description': 'OLIVE OIL SOFT PACK', Batch: 'K913654A' },
      { Material: '21104503', 'Material Description': 'PAPER TOWEL ABSORBENT', Batch: 'M810012B' },
      { Material: '21104504', 'Material Description': 'PIA COKLAT LEZAT', Batch: 'P904523' },
      { Material: '21104505', 'Material Description': 'Q-LIFE KESET SANITARY', Batch: 'Q802011X' }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template ED');
    XLSX.writeFile(wb, 'Template_Cek_Expired_Date.xlsx');
    showToast('Download', 'Template Excel berhasil diunduh', 'info');
  };

  const exportResultToExcel = () => {
    if (excelRows.length === 0) return;

    const exportData = excelRows.map((r, idx) => ({
      No: idx + 1,
      Material: r.material,
      Deskripsi: r.description,
      'Batch Mentah': r.batch,
      'Unix Batch': r.batchUnix,
      'DOY (Hari ke-N)': r.doy ?? '-',
      'Digit Tahun': r.digitTahunProduksi ?? '-',
      'Tahun Produksi': r.tahunProduksi ?? '-',
      'Tgl Mixing': formatDate(r.tglMixing),
      'Masa Simpan (Thn)': r.lamaEdTahun,
      'SLED / Expired Date': formatDate(r.sledEd),
      Status: r.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil ED Computation');
    XLSX.writeFile(wb, `Hasil_Cek_ED_${Date.now()}.xlsx`);
    showToast('Export Sukses', 'Hasil perhitungan ED berhasil diunduh ke Excel', 'success');
  };

  const filteredRows = excelRows.filter(r => {
    const matchSearch =
      r.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.batch.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (filterStatus === 'ok') return r.status.startsWith('OK');
    if (filterStatus === 'warning') return r.status.includes('PERHATIAN');
    if (filterStatus === 'error') return r.status.startsWith('Cek:');
    return true;
  });

  const okCount = excelRows.filter(r => r.status.startsWith('OK')).length;
  const warningCount = excelRows.filter(r => r.status.includes('PERHATIAN')).length;
  const errorCount = excelRows.filter(r => r.status.startsWith('Cek:')).length;

  return (
    <div className="space-y-6">
      {/* SECTION 1: SINGLE BATCH QUICK TESTER */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-blue-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-700" size={18} />
            <h3 className="text-sm sm:text-base font-bold text-slate-800 m-0">Single Batch Quick Tester</h3>
          </div>
          {(singleMaterial || singleDesc || singleBatch) && (
            <button
              onClick={handleClearSingle}
              className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Eraser size={13} />
              <span>Clear Form</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Kode Material:</label>
            <input 
              type="text" 
              value={singleMaterial}
              onChange={(e) => setSingleMaterial(e.target.value)}
              placeholder="Contoh: 21104501"
              className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Deskripsi Produk:</label>
            <input 
              type="text" 
              value={singleDesc}
              onChange={(e) => setSingleDesc(e.target.value)}
              placeholder="Contoh: KINO SAMANTHA HAIR OIL"
              className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Kode Batch Mentah:</label>
            <input 
              type="text" 
              value={singleBatch}
              onChange={(e) => setSingleBatch(e.target.value)}
              placeholder="Contoh: L911346N"
              className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Live Calculation Cards */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasil Analisis Batch:</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              singleResult.status.startsWith('OK')
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : singleResult.status.includes('PERHATIAN')
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              {singleResult.status.startsWith('OK') && <CheckCircle size={13} />}
              {singleResult.status.includes('PERHATIAN') && <AlertTriangle size={13} />}
              {singleResult.status.startsWith('Cek:') && <AlertCircle size={13} />}
              <span>{singleResult.status}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">Tanggal Mixing</span>
              <span className="text-xs font-bold text-slate-800">{formatDate(singleResult.tglMixing)}</span>
            </div>

            <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
              <span className="text-[10px] text-blue-700 font-semibold block">SLED / Expired Date</span>
              <span className="text-xs font-extrabold text-blue-900">{formatDate(singleResult.sledEd)}</span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">DOY (Day of Year)</span>
              <span className="text-xs font-bold text-slate-800">{singleResult.doy ?? '-'}</span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">Tahun Produksi</span>
              <span className="text-xs font-bold text-slate-800">{singleResult.tahunProduksi ?? '-'} (Masa Simpan {singleResult.lamaEdTahun} Thn)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: BATCH EXCEL UPLOAD */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={18} />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 m-0">Kalkulasi Massal (.xlsx)</h3>
              <p className="text-[11px] text-slate-500 m-0">Upload file Excel dengan kolom: <code>Material</code>, <code>Material Description</code>, <code>Batch</code></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleTemplate}
              className="hidden lg:flex px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer items-center gap-1"
            >
              <Download size={13} />
              <span>Download Template</span>
            </button>

            <label className="hidden lg:flex px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer items-center gap-1.5">
              <Upload size={13} />
              <span>{isLoadingExcel ? 'Memproses...' : 'Upload Excel (.xlsx)'}</span>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload}
                className="hidden" 
                disabled={isLoadingExcel}
              />
            </label>
          </div>
        </div>

        {/* Filters and Stats Header */}
        {excelRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({excelRows.length})
                </button>
                <button
                  onClick={() => setFilterStatus('ok')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === 'ok' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  OK ({okCount})
                </button>
                <button
                  onClick={() => setFilterStatus('warning')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === 'warning' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  Perhatian ({warningCount})
                </button>
                <button
                  onClick={() => setFilterStatus('error')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === 'error' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:text-red-900'
                  }`}
                >
                  Error ({errorCount})
                </button>
              </div>

              {/* Search & Export */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari material / batch..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={exportResultToExcel}
                  className="hidden lg:flex px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-xs transition-all cursor-pointer items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200">#</th>
                    <th className="p-2.5 border-b border-slate-200">Material</th>
                    <th className="p-2.5 border-b border-slate-200">Deskripsi</th>
                    <th className="p-2.5 border-b border-slate-200">Batch Mentah</th>
                    <th className="p-2.5 border-b border-slate-200">DOY</th>
                    <th className="p-2.5 border-b border-slate-200">Thn Prod</th>
                    <th className="p-2.5 border-b border-slate-200">Tgl Mixing</th>
                    <th className="p-2.5 border-b border-slate-200">SLED / ED</th>
                    <th className="p-2.5 border-b border-slate-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        Tidak ada data yang cocok dengan filter
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-bold font-mono text-slate-900">{row.material}</td>
                        <td className="p-2.5 truncate max-w-[200px]" title={row.description}>{row.description}</td>
                        <td className="p-2.5 font-mono font-semibold">{row.batch}</td>
                        <td className="p-2.5 font-mono">{row.doy ?? '-'}</td>
                        <td className="p-2.5 font-mono">{row.tahunProduksi ?? '-'}</td>
                        <td className="p-2.5">{formatDate(row.tglMixing)}</td>
                        <td className="p-2.5 font-bold text-blue-900">{formatDate(row.sledEd)}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.status.startsWith('OK')
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status.includes('PERHATIAN')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
