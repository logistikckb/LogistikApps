import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { Download, Printer, Trash2, Search, Copy, Check, QrCode, ExternalLink, Settings, X, Tag } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

export interface QrItem {
  id: string;
  label: string;
  value: string;
  dataUrl: string;
}

interface BatchQrSectionProps {
  items: QrItem[];
  onClear: () => void;
  onOpenModal: () => void;
}

export function BatchQrSection({ items, onClear, onOpenModal }: BatchQrSectionProps) {
  const { showToast } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Honeywell PM42 Thermal Printing State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [labelSize, setLabelSize] = useState<'50x30' | '70x40' | '100x50' | 'a4grid'>('50x30');
  const [orgHeader, setOrgHeader] = useState('PEMKAB SUKABUMI');
  const [showItemLabel, setShowItemLabel] = useState(true);
  const [showItemValue, setShowItemValue] = useState(true);
  const [singlePrintItem, setSinglePrintItem] = useState<QrItem | null>(null);

  if (!items || items.length === 0) return null;

  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownloadSingle = (item: QrItem) => {
    const link = document.createElement('a');
    link.href = item.dataUrl;
    const safeName = (item.label || item.value).replace(/[^a-z0-9]/gi, '_').substring(0, 30).toLowerCase();
    link.download = `qrcode_${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sukses', `QR Code "${item.label}" berhasil diunduh`, 'success');
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Tersalin', 'Teks QR Code berhasil disalin', 'success');
  };

  const handleDownloadZip = async () => {
    if (items.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("qrcode_massal");

      items.forEach((item, idx) => {
        const base64Data = item.dataUrl.replace(/^data:image\/png;base64,/, "");
        const safeName = (item.label || item.value).replace(/[^a-z0-9]/gi, '_').substring(0, 30).toLowerCase();
        folder?.file(`${idx + 1}_${safeName}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `qrcode_batch_${items.length}_items_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Sukses', `Berhasil mengunduh ${items.length} QR Code dalam format ZIP`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal', 'Gagal membuat file ZIP', 'danger');
    } finally {
      setIsZipping(false);
    }
  };

  const handleExecutePrint = (singleItem?: QrItem) => {
    setSinglePrintItem(singleItem || null);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const printItemsList = singlePrintItem ? [singlePrintItem] : filteredItems;

  return (
    <div className="mt-10 pt-8 border-t-2 border-dashed border-blue-300/80 scroll-mt-6" id="qr-batch-results">
      {/* Header bar */}
      <div className="glass-box p-5 sm:p-6 !rounded-3xl border border-blue-200 shadow-lg mb-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
              <QrCode size={26} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold m-0 text-white">
                  Hasil Generasi QR Code Massal
                </h3>
                <span className="bg-amber-500 text-slate-950 font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                  {items.length} Item
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-1 m-0">
                Ukuran QR Code jernih untuk scanner & siap cetak Stiker Thermal Honeywell PM42
              </p>
            </div>
          </div>

          {/* Actions toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenModal}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <QrCode size={15} />
              <span>Tambah / Edit Batch</span>
            </button>

            <button
              onClick={() => {
                setSinglePrintItem(null);
                setShowPrintModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              title="Cetak Stiker Label Honeywell PM42"
            >
              <Printer size={15} />
              <span>Cetak Honeywell PM42</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isZipping ? 'Membuat ZIP...' : 'Unduh Semua (ZIP)'}</span>
            </button>

            <button
              onClick={onClear}
              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-500/30 transition-all cursor-pointer ml-1"
              title="Sembunyikan / Hapus Hasil"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Search bar if many items */}
        {items.length > 4 && (
          <div className="mt-4 pt-4 border-t border-white/15 flex items-center">
            <div className="relative w-full max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari dari ${items.length} QR Code...`}
                className="w-full bg-slate-800/80 text-white border border-white/20 rounded-xl pl-10 pr-4 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid of Large QR Codes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 pb-8">
        {filteredItems.map((item, idx) => {
          const isUrl = item.value.startsWith('http://') || item.value.startsWith('https://');

          return (
            <div 
              key={item.id} 
              className="glass-box p-5 !rounded-3xl border border-slate-200/90 shadow-md hover:shadow-xl transition-all duration-200 bg-white/90 flex flex-col items-center justify-between text-center relative group"
            >
              <span className="absolute top-3 left-3 bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                #{idx + 1}
              </span>

              {/* QR Image Container - Big & Crisp */}
              <div className="w-full flex justify-center my-2 p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-inner group-hover:border-blue-400 transition-colors">
                <img 
                  src={item.dataUrl} 
                  alt={item.label} 
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                />
              </div>

              {/* QR Code Text / Label Section */}
              <div className="w-full my-2 space-y-1 text-left px-1">
                {item.label && item.label !== item.value && (
                  <div className="font-extrabold text-xs text-slate-800 truncate" title={item.label}>
                    {item.label}
                  </div>
                )}
                
                <div 
                  className="font-mono text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 break-all leading-relaxed max-h-24 overflow-y-auto"
                  title={item.value}
                >
                  {item.value}
                </div>
              </div>

              {/* Card Actions */}
              <div className="w-full flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopyText(item.value, item.id)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Salin Teks"
                >
                  {copiedId === item.id ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{copiedId === item.id ? 'Tersalin' : 'Salin'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleExecutePrint(item);
                  }}
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border border-emerald-200"
                  title="Cetak Stiker ke Printer Honeywell PM42"
                >
                  <Printer size={13} />
                  <span>Cetak Stiker</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSingle(item)}
                  className="py-1.5 px-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs ml-auto"
                  title="Unduh PNG"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* HONEYWELL PM42 PRINT OPTION MODAL */}
      {showPrintModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-box !bg-white/95 p-6 rounded-3xl max-w-xl w-full shadow-2xl border border-emerald-300 relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Pengaturan Cetak Honeywell PM42</h3>
                  <p className="text-[11px] text-slate-500 m-0">Format stiker thermal khusus printer barcode PM42/Zebra</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Size Preset */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Ukuran Label / Stiker Thermal:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelSize('50x30')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labelSize === '50x30'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Tag size={13} className="text-emerald-600" />
                      <span>50 x 30 mm</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Stiker PM42 Standar / Barang</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelSize('70x40')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labelSize === '70x40'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Tag size={13} className="text-emerald-600" />
                      <span>70 x 40 mm</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Stiker PM42 Sedang / Arsip</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelSize('100x50')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labelSize === '100x50'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Tag size={13} className="text-emerald-600" />
                      <span>100 x 50 mm</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Stiker PM42 Besar / Shipping</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelSize('a4grid')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      labelSize === 'a4grid'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Printer size={13} className="text-emerald-600" />
                      <span>Kertas A4 Grid</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">3 x 8 Stiker per Lembar A4</div>
                  </button>
                </div>
              </div>

              {/* Header Label Text */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Header KOP / Instansi Stiker:
                </label>
                <input 
                  type="text" 
                  value={orgHeader} 
                  onChange={(e) => setOrgHeader(e.target.value)}
                  placeholder="Contoh: PEMKAB SUKABUMI / DISKOMINFO"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showItemLabel} 
                    onChange={(e) => setShowItemLabel(e.target.checked)} 
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Cetak Judul Item</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showItemValue} 
                    onChange={(e) => setShowItemValue(e.target.checked)} 
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Cetak Teks/URL</span>
                </label>
              </div>

              {/* Sample Sticker Preview */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Simulasi Hasil Stiker Honeywell PM42:</span>
                <div className="bg-white border-2 border-slate-900 rounded-lg p-2.5 max-w-[220px] mx-auto text-center shadow-xs">
                  {orgHeader && (
                    <div className="text-[10px] font-black tracking-wider uppercase border-b border-slate-800 pb-1 mb-1">
                      {orgHeader}
                    </div>
                  )}
                  {items[0] && (
                    <div className="flex flex-col items-center">
                      <img src={items[0].dataUrl} alt="Preview" className="w-24 h-24 object-contain" />
                      {showItemLabel && (
                        <div className="font-extrabold text-[10px] mt-1 text-slate-900 truncate max-w-full">
                          {items[0].label}
                        </div>
                      )}
                      {showItemValue && (
                        <div className="font-mono text-[9px] text-slate-700 break-all leading-tight max-w-full line-clamp-1">
                          {items[0].value}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(false);
                  handleExecutePrint();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span>Cetak ({printItemsList.length} Stiker)</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* PRINT-ONLY AREA FOR HONEYWELL PM42 THERMAL PRINTER */}
      <div id="printable-thermal-area" className="hidden print:block">
        {printItemsList.map((item, index) => {
          let stickerStyleClass = "w-[50mm] h-[30mm]";
          let qrSizeClass = "w-[20mm] h-[20mm]";
          let fontSizeClass = "text-[8px]";

          if (labelSize === '70x40') {
            stickerStyleClass = "w-[70mm] h-[40mm]";
            qrSizeClass = "w-[28mm] h-[28mm]";
            fontSizeClass = "text-[10px]";
          } else if (labelSize === '100x50') {
            stickerStyleClass = "w-[100mm] h-[50mm]";
            qrSizeClass = "w-[38mm] h-[38mm]";
            fontSizeClass = "text-[11px]";
          } else if (labelSize === 'a4grid') {
            stickerStyleClass = "w-[65mm] h-[35mm] inline-block m-1";
            qrSizeClass = "w-[22mm] h-[22mm]";
            fontSizeClass = "text-[9px]";
          }

          return (
            <div 
              key={`print-${item.id}-${index}`} 
              className={`thermal-sticker-label ${stickerStyleClass} flex flex-col items-center justify-between text-center bg-white text-black p-1.5 border border-black overflow-hidden font-sans`}
            >
              {orgHeader && (
                <div className="w-full text-center font-black uppercase text-[8px] tracking-wider border-b border-black pb-0.5 mb-0.5 leading-none">
                  {orgHeader}
                </div>
              )}

              <div className="flex-1 flex items-center justify-center w-full my-0.5">
                <img 
                  src={item.dataUrl} 
                  alt={item.label} 
                  className={`${qrSizeClass} object-contain`}
                />
              </div>

              {showItemLabel && item.label && (
                <div className={`w-full font-bold uppercase truncate leading-none ${fontSizeClass}`}>
                  {item.label}
                </div>
              )}

              {showItemValue && (
                <div className="w-full font-mono text-[7px] break-all line-clamp-1 leading-none mt-0.5">
                  {item.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

