import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Layers, FileSpreadsheet, Download, Upload, Printer, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { aggregateStockOpnameRows, processMB52Rows } from '../../utils/logisticsCalculations';
import { useNotification } from '../../context/NotificationContext';

export function StockOpnameModule() {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'largo' | 'mb52' | 'form-so'>('largo');

  // LARGO State
  const [largoRawText, setLargoRawText] = useState('');
  const [aggregatedLargo, setAggregatedLargo] = useState<any[]>([]);

  // MB52 State
  const [mb52Rows, setMb52Rows] = useState<any[]>([]);

  // Form SO & Berita Acara State
  const [docHeader, setDocHeader] = useState({
    judul: 'BERITA ACARA STOCK OPNAME',
    nomor: '',
    tanggal: new Date().toISOString().split('T')[0],
    lokasi: '',
    petugas1: '',
    petugas2: '',
    mengetahui: ''
  });

  const handleProcessLargo = () => {
    if (!largoRawText.trim()) {
      setAggregatedLargo([]);
      return;
    }

    const lines = largoRawText.split('\n');
    const rawParsed = lines.map((line, idx) => {
      const parts = line.split('\t');
      return {
        no: idx + 1,
        location: (parts[0] || '').trim(),
        itemCode: (parts[1] || '').trim(),
        itemName: (parts[2] || '').trim(),
        sloc: (parts[3] || '').trim(),
        lastQty: parseFloat((parts[4] || '0').replace(/,/g, '')) || 0
      };
    }).filter(r => r.location && r.itemCode);

    const agg = aggregateStockOpnameRows(rawParsed);
    setAggregatedLargo(agg);
    showToast('Agregasi Berhasil', `Data LARGO berhasil dikonversi & diagregasi menjadi ${agg.length} baris unik.`, 'success');
  };

  const handleMB52FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const processed = processMB52Rows(data);
        setMb52Rows(processed);
        showToast('MB52 Dimuat', `Berhasil memproses ${processed.length} data stok MB52 SAP.`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Gagal', 'Terjadi kesalahan saat membaca file MB52 SAP.', 'danger');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportLargoToExcel = () => {
    if (aggregatedLargo.length === 0) return;
    const exportData = aggregatedLargo.map((r, idx) => ({
      No: idx + 1,
      Location: r.location,
      'Item Code': r.itemCode,
      'Item Name': r.itemName,
      SLOC: r.sloc,
      'Aggregated Qty': r.lastQty
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Konversi LARGO ke SAP');
    XLSX.writeFile(wb, `Largo_Aggregated_SAP_${Date.now()}.xlsx`);
    showToast('Export Sukses', 'Data hasil agregasi berhasil diunduh', 'success');
  };

  const handlePrintBeritaAcara = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('largo')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'largo' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers size={15} />
          <span>Konversi LARGO ke SAP</span>
        </button>

        <button
          onClick={() => setActiveTab('mb52')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'mb52' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Data MB52 SAP ({mb52Rows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('form-so')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'form-so' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText size={15} />
          <span>Form & Berita Acara SO</span>
        </button>
      </div>

      {/* TAB 1: LARGO CONVERTER */}
      {activeTab === 'largo' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 m-0">Input Teks Data Mentah LARGO</h3>
                <p className="text-[11px] text-slate-500 m-0">Format per baris (Tab-Separated): <code>Location</code> [Tab] <code>ItemCode</code> [Tab] <code>ItemName</code> [Tab] <code>SLOC</code> [Tab] <code>Qty</code></p>
              </div>

              <button
                type="button"
                onClick={handleProcessLargo}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>Proses SUMIFS / Agregasi</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={largoRawText}
              onChange={(e) => setLargoRawText(e.target.value)}
              placeholder="LOC01	21104501	KINO SAMANTHA HAIR OIL	SL01	100"
              className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Aggregated Output Table */}
          {aggregatedLargo.length > 0 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Hasil Agregasi SUMIFS ({aggregatedLargo.length} Baris Unique):</span>
                <button
                  type="button"
                  onClick={handleExportLargoToExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>Download Excel</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-slate-200">#</th>
                      <th className="p-2 border-b border-slate-200">SLOC</th>
                      <th className="p-2 border-b border-slate-200">Lokasi</th>
                      <th className="p-2 border-b border-slate-200">Item Code</th>
                      <th className="p-2 border-b border-slate-200">Item Name</th>
                      <th className="p-2 border-b border-slate-200 text-right">Total Qty (Agregasi)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {aggregatedLargo.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-2 font-bold font-mono text-blue-900">{r.sloc}</td>
                        <td className="p-2">{r.location}</td>
                        <td className="p-2 font-mono">{r.itemCode}</td>
                        <td className="p-2">{r.itemName}</td>
                        <td className="p-2 font-mono font-bold text-right text-emerald-700">{r.lastQty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MB52 SAP */}
      {activeTab === 'mb52' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 m-0">Upload Data MB52 SAP</h3>
              <p className="text-[11px] text-slate-500 m-0">Menghitung Last Qty = Unrestricted + Transit + Blocked secara otomatis</p>
            </div>

            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
              <Upload size={14} />
              <span>Upload MB52 Excel (.xlsx)</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleMB52FileUpload} className="hidden" />
            </label>
          </div>

          {mb52Rows.length > 0 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="text-xs font-bold text-slate-700">Daftar Data MB52 SAP ({mb52Rows.length} Baris):</span>
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-slate-200">Material</th>
                      <th className="p-2 border-b border-slate-200">Deskripsi</th>
                      <th className="p-2 border-b border-slate-200">SLOC</th>
                      <th className="p-2 border-b border-slate-200 text-right">Unrestricted</th>
                      <th className="p-2 border-b border-slate-200 text-right">Transit</th>
                      <th className="p-2 border-b border-slate-200 text-right">Blocked</th>
                      <th className="p-2 border-b border-slate-200 text-right">Total Last Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {mb52Rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold">{r.material}</td>
                        <td className="p-2">{r.desc}</td>
                        <td className="p-2 font-bold font-mono text-blue-900">{r.sloc}</td>
                        <td className="p-2 text-right font-mono">{r.unrestricted}</td>
                        <td className="p-2 text-right font-mono">{r.transit}</td>
                        <td className="p-2 text-right font-mono">{r.blocked}</td>
                        <td className="p-2 text-right font-mono font-extrabold text-emerald-700">{r.lastQty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FORM & BERITA ACARA SO */}
      {activeTab === 'form-so' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 m-0">Pengaturan Berita Acara Stock Opname</h3>
              <button
                type="button"
                onClick={handlePrintBeritaAcara}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Cetak / Save PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Dokumen:</label>
                <input 
                  type="text" 
                  value={docHeader.judul} 
                  onChange={(e) => setDocHeader({ ...docHeader, judul: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Berita Acara:</label>
                <input 
                  type="text" 
                  value={docHeader.nomor} 
                  onChange={(e) => setDocHeader({ ...docHeader, nomor: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Pelaksanaan:</label>
                <input 
                  type="date" 
                  value={docHeader.tanggal} 
                  onChange={(e) => setDocHeader({ ...docHeader, tanggal: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Petugas Tim 1:</label>
                <input 
                  type="text" 
                  value={docHeader.petugas1} 
                  onChange={(e) => setDocHeader({ ...docHeader, petugas1: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Petugas Tim 2:</label>
                <input 
                  type="text" 
                  value={docHeader.petugas2} 
                  onChange={(e) => setDocHeader({ ...docHeader, petugas2: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mengetahui (Atasan):</label>
                <input 
                  type="text" 
                  value={docHeader.mengetahui} 
                  onChange={(e) => setDocHeader({ ...docHeader, mengetahui: e.target.value })} 
                  className="w-full p-2 bg-slate-50 border rounded-xl" 
                />
              </div>
            </div>
          </div>

          {/* Document Preview Box */}
          <div className="p-6 bg-white border-2 border-slate-800 rounded-xl max-w-3xl mx-auto shadow-md space-y-6 text-slate-900 text-xs">
            <div className="text-center border-b-2 border-slate-800 pb-3">
              <h2 className="text-base font-black tracking-wider uppercase m-0">{docHeader.judul}</h2>
              <p className="font-mono text-xs m-0">No: {docHeader.nomor}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Lokasi:</strong> {docHeader.lokasi}<br />
                <strong>Tanggal:</strong> {docHeader.tanggal}
              </div>
              <div className="text-right">
                <strong>Status Rekonsiliasi:</strong> SELESAI<br />
                <strong>Tim Pelaksana:</strong> {docHeader.petugas1}, {docHeader.petugas2}
              </div>
            </div>

            <div>
              <p className="m-0 leading-relaxed">
                Pada hari ini, tanggal <strong>{docHeader.tanggal}</strong>, telah dilaksanakan kegiatan Stock Opname bertempat di <strong>{docHeader.lokasi}</strong> dengan hasil data fisik dan rekonsiliasi tercatat secara sah.
              </p>
            </div>

            <div className="pt-12 grid grid-cols-3 text-center gap-4 border-t border-slate-300">
              <div>
                <p className="mb-12 font-bold">Petugas 1</p>
                <p className="font-bold underline">{docHeader.petugas1}</p>
              </div>
              <div>
                <p className="mb-12 font-bold">Petugas 2</p>
                <p className="font-bold underline">{docHeader.petugas2}</p>
              </div>
              <div>
                <p className="mb-12 font-bold">Mengetahui</p>
                <p className="font-bold underline">{docHeader.mengetahui}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
