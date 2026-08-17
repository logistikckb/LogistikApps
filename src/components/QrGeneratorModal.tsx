import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { QrCode, Download, Upload, X, Copy, Check, Layers, RefreshCw, Eye, Eraser, Trash2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { QrItem } from './BatchQrSection';

interface QrGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetBatchItems: (items: QrItem[]) => void;
  existingBatchCount: number;
}

export function QrGeneratorModal({ isOpen, onClose, onSetBatchItems, existingBatchCount }: QrGeneratorModalProps) {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single mode state
  const [singleText, setSingleText] = useState('https://sukabumikab.go.id');
  const [singleDataUrl, setSingleDataUrl] = useState('');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [copied, setCopied] = useState(false);

  // Batch mode state
  const [batchText, setBatchText] = useState("Website Pemkab, https://sukabumikab.go.id\nDokumen SPPD, https://example.com/sppd\nPengumuman Resmi, https://example.com/pengumuman");
  const [batchItems, setBatchItems] = useState<QrItem[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleClearSingle = () => {
    setSingleText('');
    showToast('Bersih', 'Teks QR Code dibersihkan', 'info');
  };

  const handleClearBatch = () => {
    setBatchText('');
    setBatchItems([]);
    showToast('Bersih', 'Area teks batch dan hasil preview dibersihkan', 'info');
  };

  // Generate Single QR Code (high res for scanner readability)
  useEffect(() => {
    if (!isOpen || activeTab !== 'single') return;

    if (!singleText.trim()) {
      setSingleDataUrl('');
      return;
    }

    QRCode.toDataURL(singleText, {
      width: 500,
      margin: 2,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    })
      .then(url => setSingleDataUrl(url))
      .catch(err => console.error('Error generating single QR code:', err));
  }, [singleText, fgColor, bgColor, isOpen, activeTab]);

  // Generate Batch QR Codes
  const generateBatchQrs = async () => {
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setBatchItems([]);
      return;
    }

    setIsGeneratingBatch(true);
    const results: QrItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let label = line;
      let value = line;

      if (line.includes(',')) {
        const parts = line.split(',');
        label = parts[0].trim();
        value = parts.slice(1).join(',').trim();
      } else if (line.includes(';')) {
        const parts = line.split(';');
        label = parts[0].trim();
        value = parts.slice(1).join(';').trim();
      }

      if (!value) value = label;

      try {
        const url = await QRCode.toDataURL(value, {
          width: 500, // High definition for scanners
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });
        results.push({
          id: `qr-${i}-${Date.now()}`,
          label,
          value,
          dataUrl: url,
        });
      } catch (err) {
        console.error(`Error generating QR for ${line}`, err);
      }
    }

    setBatchItems(results);
    setIsGeneratingBatch(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'batch') {
      generateBatchQrs();
    }
  }, [isOpen, activeTab, fgColor, bgColor]);

  if (!isOpen) return null;

  const handleDownloadSingle = () => {
    if (!singleDataUrl) return;
    const link = document.createElement('a');
    link.href = singleDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Berhasil', 'QR Code berhasil diunduh', 'success');
  };

  const handleCopySingle = async () => {
    if (!singleDataUrl) return;
    try {
      const response = await fetch(singleDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Tersalin', 'Gambar QR Code disalin ke clipboard', 'success');
    } catch {
      showToast('Perhatian', 'Fitur salin gambar tidak didukung di browser ini, gunakan Unduh PNG', 'info');
    }
  };

  const handleDownloadSingleBatchItem = (item: QrItem) => {
    const link = document.createElement('a');
    link.href = item.dataUrl;
    const safeName = (item.label || item.value).replace(/[^a-z0-9]/gi, '_').substring(0, 30).toLowerCase();
    link.download = `qrcode_${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBatchZip = async () => {
    if (batchItems.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("qrcode_batch");

      batchItems.forEach((item, idx) => {
        const base64Data = item.dataUrl.replace(/^data:image\/png;base64,/, "");
        const safeName = (item.label || item.value).replace(/[^a-z0-9]/gi, '_').substring(0, 30).toLowerCase();
        folder?.file(`${idx + 1}_${safeName}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `qrcode_batch_${batchItems.length}_items_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Sukses', `Berhasil mengunduh ${batchItems.length} QR Code dalam format ZIP`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal', 'Terjadi kesalahan saat membuat file ZIP', 'danger');
    } finally {
      setIsZipping(false);
    }
  };

  const handleSendToMainPage = () => {
    if (batchItems.length === 0) {
      showToast('Perhatian', 'Belum ada QR Code yang dihasilkan', 'info');
      return;
    }
    onSetBatchItems(batchItems);
    onClose();
    showToast('Tersimpan', `${batchItems.length} QR Code ditampilkan di Halaman Utama`, 'success');
    setTimeout(() => {
      const elem = document.getElementById('qr-batch-results');
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBatchText(text);
        showToast('File Dimuat', `File ${file.name} berhasil dibaca`, 'info');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-box !bg-white/95 p-5 sm:p-7 rounded-3xl max-w-3xl w-full shadow-2xl border border-blue-300 relative max-h-[92vh] flex flex-col overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white flex items-center justify-center shadow-md">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 m-0">Generator QR Code</h3>
              <p className="text-xs text-slate-500 m-0">Buat QR Code Satuan atau Massal/Batch dengan cepat</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 my-4 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'single'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <QrCode size={15} />
            <span>QR Code Satuan</span>
          </button>

          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Layers size={15} />
            <span>QR Code Massal ({batchItems.length} Item)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Colors palette */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Warna QR Code:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-slate-500 text-[11px]">Warna Kode:</span>
                <input 
                  type="color" 
                  value={fgColor} 
                  onChange={(e) => setFgColor(e.target.value)} 
                  className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0 bg-transparent"
                />
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-slate-500 text-[11px]">Latar:</span>
                <input 
                  type="color" 
                  value={bgColor} 
                  onChange={(e) => setBgColor(e.target.value)} 
                  className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0 bg-transparent"
                />
              </label>
            </div>
          </div>

          {/* TAB 1: SINGLE */}
          {activeTab === 'single' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Teks / Link URL:
                  </label>
                  {singleText && (
                    <button
                      type="button"
                      onClick={handleClearSingle}
                      className="text-[11px] text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      title="Bersihkan Teks"
                    >
                      <Eraser size={13} />
                      <span>Bersihkan Teks</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={singleText}
                    onChange={(e) => setSingleText(e.target.value)}
                    placeholder="Ketik teks, nomor WA, atau link https://..."
                    className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                  />
                  {singleText && (
                    <button
                      type="button"
                      onClick={handleClearSingle}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 p-1 rounded-full hover:bg-slate-200 transition-all cursor-pointer"
                      title="Hapus / Clear"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Preview Box - Large & Scanner Friendly */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-100/70 border border-slate-200 rounded-2xl min-h-[220px]">
                {singleDataUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img 
                      src={singleDataUrl} 
                      alt="QR Code Preview" 
                      className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl shadow-md border-2 border-white bg-white p-3 object-contain"
                    />
                    <div className="font-mono text-xs text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 max-w-md break-all text-center">
                      {singleText}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs font-medium">
                    Masukkan teks di atas untuk membuat QR Code
                  </div>
                )}
              </div>

              {/* Download & Copy Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopySingle}
                  disabled={!singleDataUrl}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  <span>{copied ? 'Tersalin' : 'Salin Gambar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSingle}
                  disabled={!singleDataUrl}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 disabled:opacity-40 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={15} />
                  <span>Unduh PNG</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BATCH / MASSAL */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Daftar Teks / Link (1 Item Per Baris):
                  </label>
                  <div className="flex items-center gap-3">
                    {batchText && (
                      <button
                        type="button"
                        onClick={handleClearBatch}
                        className="text-[11px] text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        title="Bersihkan Area Teks"
                      >
                        <Trash2 size={13} />
                        <span>Bersihkan Teks</span>
                      </button>
                    )}
                    <label className="text-[11px] text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload size={13} />
                      <span>Import File TXT/CSV</span>
                      <input 
                        type="file" 
                        accept=".txt,.csv" 
                        onChange={handleFileUpload}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-1">
                  Format: <code>Judul, URL/Teks</code> atau langsung <code>URL/Teks</code> per baris.
                </p>
                <div className="relative">
                  <textarea 
                    rows={4}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder="Website Pemkab, https://sukabumikab.go.id&#10;Dokumen SPPD, https://example.com/sppd&#10;https://nomor-surat-123"
                    className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                  />
                  {batchText && (
                    <button
                      type="button"
                      onClick={handleClearBatch}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-slate-200 transition-all cursor-pointer bg-slate-100/80 border border-slate-300/80"
                      title="Bersihkan Teks"
                    >
                      <Eraser size={14} />
                    </button>
                  )}
                </div>
              </div>


              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Hasil Preview Batch ({batchItems.length} QR Code):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={generateBatchQrs}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} className={isGeneratingBatch ? 'animate-spin' : ''} />
                    <span>Perbarui</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendToMainPage}
                    disabled={batchItems.length === 0}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40"
                  >
                    <Eye size={13} />
                    <span>Tampilkan di Halaman Utama</span>
                  </button>
                </div>
              </div>

              {/* Batch Grid Preview inside Modal (Larger QR Code & Real Text Display) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[260px] overflow-y-auto p-3 bg-slate-100/70 border border-slate-200 rounded-2xl">
                {batchItems.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-slate-400 font-medium">
                    Belum ada item batch. Ketik data di atas.
                  </div>
                ) : (
                  batchItems.map((item, index) => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col items-center text-center gap-2 relative">
                      <span className="absolute top-2 left-2 text-[9px] font-mono font-bold text-slate-400">
                        #{index + 1}
                      </span>

                      {/* Large QR image */}
                      <img 
                        src={item.dataUrl} 
                        alt={item.label} 
                        className="w-36 h-36 sm:w-40 sm:h-40 object-contain bg-white rounded-lg p-1 border border-slate-200"
                      />

                      {/* Display the actual text underneath */}
                      <div className="w-full text-left bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                        {item.label && item.label !== item.value && (
                          <div className="text-[11px] font-bold text-slate-800 truncate" title={item.label}>
                            {item.label}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-700 break-all leading-snug line-clamp-2" title={item.value}>
                          {item.value}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadSingleBatchItem(item)}
                        className="w-full py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-blue-900 hover:text-white rounded-lg text-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download size={11} /> Unduh PNG
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Batch Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 flex-wrap gap-2">
                <span className="text-[11px] text-slate-500 font-medium">
                  {batchItems.length > 10 ? 'Tips: Gunakan "Tampilkan di Halaman Utama" untuk tampilan 30+ QR Code lebih luas.' : 'Unduh seluruh QR Code dalam file ZIP.'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendToMainPage}
                    disabled={batchItems.length === 0}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Eye size={15} />
                    <span>Lihat di Halaman Utama</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBatchZip}
                    disabled={batchItems.length === 0 || isZipping}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={15} />
                    <span>{isZipping ? 'Membuat ZIP...' : 'Unduh Semua (ZIP)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
