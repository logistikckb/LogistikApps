import React, { useState, useEffect, lazy, Suspense } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { 
  Wrench, QrCode, Calendar, Layers, Barcode, ArrowRightLeft, PackageCheck, FileText, 
  X, Maximize2, RefreshCw, Download, Upload, Copy, Check, Eye, Eraser, Trash2, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { LogisticsTab } from './logistics/LogisticsModal';
import { LazyFallback } from './common/LazyFallback';
import { useNotification } from '../context/NotificationContext';
import { QrItem } from './BatchQrSection';

const EdCheckerModule = lazy(() => import('./logistics/EdCheckerModule').then(m => ({ default: m.EdCheckerModule })));
const StockOpnameModule = lazy(() => import('./logistics/StockOpnameModule').then(m => ({ default: m.StockOpnameModule })));
const SnGeneratorModule = lazy(() => import('./logistics/SnGeneratorModule').then(m => ({ default: m.SnGeneratorModule })));
const BatchCheckerModule = lazy(() => import('./logistics/BatchCheckerModule').then(m => ({ default: m.BatchCheckerModule })));
const PromosiModule = lazy(() => import('./logistics/PromosiModule').then(m => ({ default: m.PromosiModule })));
const SuratJalanModule = lazy(() => import('./logistics/SuratJalanModule').then(m => ({ default: m.SuratJalanModule })));

export type MainToolTab = 'qr-generator' | LogisticsTab;

interface EmbeddedToolsWorkspaceProps {
  activeTool: MainToolTab;
  onSelectTool: (tool: MainToolTab) => void;
  onOpenModal: (tool: MainToolTab) => void;
  onCloseWorkspace?: () => void;
  onSetBatchItems: (items: QrItem[]) => void;
}

export function EmbeddedToolsWorkspace({ 
  activeTool, 
  onSelectTool, 
  onOpenModal, 
  onCloseWorkspace,
  onSetBatchItems 
}: EmbeddedToolsWorkspaceProps) {
  const { showToast } = useNotification();

  // QR Generator Local State inside Main Page
  const [qrMode, setQrMode] = useState<'single' | 'batch'>('single');
  const [singleText, setSingleText] = useState('https://sukabumikab.go.id');
  const [singleDataUrl, setSingleDataUrl] = useState('');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [copied, setCopied] = useState(false);

  const [batchText, setBatchText] = useState("Website Pemkab, https://sukabumikab.go.id\nDokumen SPPD, https://example.com/sppd\nPengumuman Resmi, https://example.com/pengumuman");
  const [batchItems, setBatchItems] = useState<QrItem[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Single QR Generator Effect
  useEffect(() => {
    if (activeTool !== 'qr-generator' || qrMode !== 'single') return;
    if (!singleText.trim()) {
      setSingleDataUrl('');
      return;
    }

    QRCode.toDataURL(singleText, {
      width: 500,
      margin: 2,
      color: { dark: fgColor, light: bgColor }
    })
      .then(url => setSingleDataUrl(url))
      .catch(err => console.error('Error generating QR:', err));
  }, [singleText, fgColor, bgColor, activeTool, qrMode]);

  // Batch QR Generator Logic
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
          width: 500,
          margin: 2,
          color: { dark: fgColor, light: bgColor }
        });
        results.push({
          id: `qr-main-${i}-${Date.now()}`,
          label,
          value,
          dataUrl: url
        });
      } catch (err) {
        console.error(`Error generating batch QR:`, err);
      }
    }

    setBatchItems(results);
    setIsGeneratingBatch(false);
  };

  useEffect(() => {
    if (activeTool === 'qr-generator' && qrMode === 'batch') {
      generateBatchQrs();
    }
  }, [activeTool, qrMode, fgColor, bgColor]);

  const handleDownloadSingle = () => {
    if (!singleDataUrl) return;
    const link = document.createElement('a');
    link.href = singleDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Berhasil', 'QR Code diunduh ke komputer', 'success');
  };

  const handleCopySingle = async () => {
    if (!singleDataUrl) return;
    try {
      const response = await fetch(singleDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Tersalin', 'Gambar QR Code disalin', 'success');
    } catch {
      showToast('Info', 'Gunakan tombol Unduh PNG', 'info');
    }
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
      showToast('Sukses', `Berhasil mengunduh ${batchItems.length} QR Code dalam file ZIP`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal', 'Gagal membuat file ZIP', 'danger');
    } finally {
      setIsZipping(false);
    }
  };

  const handleSendToBatchSection = () => {
    if (batchItems.length === 0) return;
    onSetBatchItems(batchItems);
    showToast('Tampil', `${batchItems.length} QR Code dikirim ke Seksi Batch Halaman Utama`, 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBatchText(text);
        showToast('File Dimuat', `File ${file.name} berhasil dimuat`, 'info');
      }
    };
    reader.readAsText(file);
  };

  const toolsList: { id: MainToolTab; title: string; icon: React.ReactNode; style: string }[] = [
    {
      id: 'qr-generator',
      title: 'Generator QR Code',
      icon: <QrCode size={16} />,
      style: 'from-indigo-600 to-blue-800'
    },
    {
      id: 'ed-checker',
      title: 'Cek Expired Date',
      icon: <Calendar size={16} />,
      style: 'from-emerald-600 to-teal-800'
    },
    {
      id: 'stock-opname',
      title: 'Stock Opname Suite',
      icon: <Layers size={16} />,
      style: 'from-blue-700 to-slate-900'
    },
    {
      id: 'sn-generator',
      title: 'Generator Serial No',
      icon: <Barcode size={16} />,
      style: 'from-purple-600 to-violet-900'
    },
    {
      id: 'batch-checker',
      title: 'Batch Checker',
      icon: <ArrowRightLeft size={16} />,
      style: 'from-amber-600 to-orange-800'
    },
    {
      id: 'promosi',
      title: 'Barang Promosi',
      icon: <PackageCheck size={16} />,
      style: 'from-orange-600 to-amber-800'
    },
    {
      id: 'surat-jalan',
      title: 'Surat Jalan Studio',
      icon: <FileText size={16} />,
      style: 'from-blue-600 to-indigo-800'
    }
  ];

  const currentToolInfo = toolsList.find(t => t.id === activeTool) || toolsList[0];

  return (
    <div id="main-page-tool-workspace" className="mt-8 scroll-mt-6 animate-fade-in">
      <div className="glass-box p-4 sm:p-6 bg-white/95 border border-blue-300/80 shadow-xl rounded-3xl relative overflow-hidden">
        
        {/* Workspace Top Header & Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${currentToolInfo.style} text-white flex items-center justify-center shadow-md shrink-0`}>
              {currentToolInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="bg-blue-900 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  HALAMAN UTAMA WORKSPACE
                </span>
                <Sparkles size={13} className="text-amber-500" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 m-0 leading-tight">
                {currentToolInfo.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenModal(activeTool)}
              className="glass-btn !py-1.5 !px-3 !rounded-xl text-xs font-bold bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Buka dalam Jendela Pop-Up Modal"
            >
              <Maximize2 size={14} />
              <span>Layar Pop-Up</span>
            </button>

            {onCloseWorkspace && (
              <button
                onClick={onCloseWorkspace}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                title="Sembunyikan Workspace Tools"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Tool Switcher Tab Bar directly on Main Page */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {toolsList.map(t => {
            const isActive = t.id === activeTool;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTool(t.id)}
                className={`py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  isActive
                    ? 'bg-blue-900 text-white border-blue-950 ring-2 ring-blue-400/50 shadow-md'
                    : 'bg-slate-100/80 text-slate-700 border-slate-200/90 hover:bg-white hover:text-blue-900'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.title}</span>
              </button>
            );
          })}
        </div>

        {/* ACTIVE TOOL MODULE RENDERING */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-inner">
          {activeTool === 'qr-generator' && (
            <div className="space-y-4">
              {/* QR Subtabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/80">
                  <button
                    onClick={() => setQrMode('single')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      qrMode === 'single' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-300/60'
                    }`}
                  >
                    <QrCode size={14} />
                    <span>QR Code Satuan</span>
                  </button>

                  <button
                    onClick={() => setQrMode('batch')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      qrMode === 'batch' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-300/60'
                    }`}
                  >
                    <Layers size={14} />
                    <span>QR Code Massal ({batchItems.length})</span>
                  </button>
                </div>

                {/* Color pickers */}
                <div className="flex items-center gap-3 text-xs bg-white p-2 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Warna:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <span className="text-slate-500 text-[10px]">Kode:</span>
                    <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 bg-transparent border border-slate-300" />
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <span className="text-slate-500 text-[10px]">Latar:</span>
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 bg-transparent border border-slate-300" />
                  </label>
                </div>
              </div>

              {/* SINGLE MODE */}
              {qrMode === 'single' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Teks / Link URL yang ingin dijadikan QR Code:
                      </label>
                      <input 
                        type="text" 
                        value={singleText}
                        onChange={(e) => setSingleText(e.target.value)}
                        placeholder="Ketik teks, link https://..., atau nomor kontak"
                        className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleCopySingle}
                        disabled={!singleDataUrl}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{copied ? 'Tersalin' : 'Salin Gambar'}</span>
                      </button>

                      <button
                        onClick={handleDownloadSingle}
                        disabled={!singleDataUrl}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        <Download size={14} />
                        <span>Unduh PNG</span>
                      </button>
                    </div>
                  </div>

                  {/* Single QR Image Display */}
                  <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    {singleDataUrl ? (
                      <div className="text-center space-y-2">
                        <img src={singleDataUrl} alt="QR Preview" className="w-48 h-48 sm:w-52 sm:h-52 object-contain bg-white rounded-xl p-2 border border-slate-200 shadow-2xs mx-auto" />
                        <div className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 max-w-xs truncate mx-auto">
                          {singleText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-8">Ketik teks di samping untuk membuat QR Code</div>
                    )}
                  </div>
                </div>
              )}

              {/* BATCH MODE */}
              {qrMode === 'batch' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                      <label className="text-xs font-bold text-slate-700">Daftar Teks / Link (1 Item Per Baris):</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setBatchText('')} className="text-[11px] text-red-600 hover:underline font-bold flex items-center gap-1">
                          <Eraser size={12} /> Bersihkan Teks
                        </button>
                        <label className="text-[11px] text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1">
                          <Upload size={12} /> Impor TXT/CSV
                          <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      placeholder="Judul 1, https://link-1.com&#10;Judul 2, https://link-2.com"
                      className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-700">Hasil Generated ({batchItems.length} QR Code):</span>
                    <div className="flex items-center gap-2">
                      <button onClick={generateBatchQrs} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1">
                        <RefreshCw size={13} className={isGeneratingBatch ? 'animate-spin' : ''} /> Perbarui
                      </button>
                      <button onClick={handleSendToBatchSection} disabled={batchItems.length === 0} className="px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40">
                        <Eye size={13} /> Kirim ke Grid Bawah
                      </button>
                      <button onClick={handleDownloadBatchZip} disabled={batchItems.length === 0 || isZipping} className="px-3.5 py-1.5 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40">
                        <Download size={13} /> {isZipping ? 'Proses ZIP...' : 'Unduh ZIP'}
                      </button>
                    </div>
                  </div>

                  {/* Batch preview grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-3 bg-white rounded-xl border border-slate-200 custom-scrollbar">
                    {batchItems.map((item, idx) => (
                      <div key={item.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center text-center gap-1.5 relative">
                        <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400">#{idx + 1}</span>
                        <img src={item.dataUrl} alt={item.label} className="w-28 h-28 object-contain bg-white rounded-md p-1 border border-slate-200" />
                        <div className="text-[10px] font-bold text-slate-800 truncate w-full" title={item.label}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Suspense fallback={<LazyFallback title="Memuat lembar kerja modul..." />}>
            {activeTool === 'ed-checker' && <EdCheckerModule />}
            {activeTool === 'stock-opname' && <StockOpnameModule />}
            {activeTool === 'sn-generator' && <SnGeneratorModule />}
            {activeTool === 'batch-checker' && <BatchCheckerModule />}
            {activeTool === 'promosi' && <PromosiModule />}
            {activeTool === 'surat-jalan' && <SuratJalanModule />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
