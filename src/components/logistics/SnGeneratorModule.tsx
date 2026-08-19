import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Barcode, Copy, Download, Check, RefreshCw, Eraser, Info } from 'lucide-react';
import { generateSerialNumberList } from '../../utils/logisticsCalculations';
import { useNotification } from '../../context/NotificationContext';

export function SnGeneratorModule() {
  const { showToast } = useNotification();
  const [inputText, setInputText] = useState('');
  const [generatedList, setGeneratedList] = useState<Array<{ sn: string; rawCols: string[] }>>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerateSN = () => {
    if (!inputText.trim()) {
      setGeneratedList([]);
      showToast('Perhatian', 'Masukkan teks input data inbound terlebih dahulu', 'info');
      return;
    }

    const results = generateSerialNumberList(inputText);
    setGeneratedList(results);
    showToast('Sukses', `Berhasil menghasilkan ${results.length} Serial Number Unik Anti-Duplikat.`, 'success');
  };

  const handleClear = () => {
    setInputText('');
    setGeneratedList([]);
    showToast('Bersih', 'Area input dan hasil generator Serial Number telah dibersihkan', 'info');
  };

  const handleCopyTable = () => {
    if (generatedList.length === 0) return;
    const tableText = generatedList.map(item => `${item.sn}\t${item.rawCols.join('\t')}`).join('\n');
    navigator.clipboard.writeText(tableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Tersalin', 'Seluruh Serial Number disalin ke clipboard', 'success');
  };

  const handleDownloadExcel = () => {
    if (generatedList.length === 0) return;
    const exportData = generatedList.map((item, idx) => ({
      No: idx + 1,
      'Generated Serial Number': item.sn,
      'Bin Location (Col 1)': item.rawCols[0] || '',
      'Item Code (Col 2)': item.rawCols[1] || '',
      'Item Name (Col 3)': item.rawCols[2] || '',
      'Extra Info': item.rawCols.slice(3).join(' | ')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Serial Number FGKINO');
    XLSX.writeFile(wb, `Serial_Number_Inbound_${Date.now()}.xlsx`);
    showToast('Export Sukses', 'Serial Number berhasil diunduh ke file Excel', 'success');
  };

  return (
    <div className="space-y-2 sm:space-y-2.5">
      <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 m-0">Input Data Inbound (Tab-Separated / Excel)</h3>
            <p className="text-[10px] text-slate-500 m-0">
              Format Seri: <code>FGKINO-YYMMDD[BinLoc8Digit][RandNum4Digit]</code>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-red-600 hover:text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Eraser size={12} />
                <span>Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateSN}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={12} />
              <span>Generate SN</span>
            </button>
          </div>
        </div>

        <textarea
          rows={4}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="A01B02C3	21104501	KINO SAMANTHA HAIR OIL"
          className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Generated Table */}
      {generatedList.length > 0 && (
        <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700">Hasil Generator SN ({generatedList.length} Item Unik):</span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyTable}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copied ? 'Tersalin' : 'Salin Tabel'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
              >
                <Download size={12} />
                <span>Download Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-2.5 border-b border-slate-200">#</th>
                  <th className="py-2 px-2.5 border-b border-slate-200">Generated SN</th>
                  <th className="py-2 px-2.5 border-b border-slate-200">Bin Location</th>
                  <th className="py-2 px-2.5 border-b border-slate-200">Data Asli Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {generatedList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-1.5 px-2.5 font-mono font-extrabold text-blue-900 bg-blue-50/50 rounded">{item.sn}</td>
                    <td className="py-1.5 px-2.5 font-mono font-semibold">{item.rawCols[0] || '-'}</td>
                    <td className="py-1.5 px-2.5 text-slate-600 truncate max-w-[300px]">{item.rawCols.slice(1).join(' | ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
