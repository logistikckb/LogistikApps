import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  X, 
  MapPin, 
  Calendar, 
  Barcode, 
  Layers, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Edit2, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink,
  Trash2,
  Sliders,
  Info,
  FileCode,
  AlertCircle,
  RefreshCw,
  Eye
} from 'lucide-react';
import QRCode from 'qrcode';
import { InventoryItem } from '../../../types';

interface InventoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onEdit: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InventoryDetailModal({
  isOpen,
  onClose,
  item,
  onEdit,
  onDelete,
  showToast
}: InventoryDetailModalProps) {
  // State QR Code & Copy
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Pengaturan Cetak Label Standar Honeywell PM42 (Sama Persis dengan QR Generator PM42)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showBorder, setShowBorder] = useState<boolean>(false);
  const [titleFontSize, setTitleFontSize] = useState<number>(8); // 8px default standar
  const [textFontSize, setTextFontSize] = useState<number>(8); // 8px default standar
  const [qrSizeMm, setQrSizeMm] = useState<number>(40); // 40mm barcode size standar PM42
  const [topMarginMm, setTopMarginMm] = useState<number>(10); // 10mm margin atas default
  const [leftMarginMm, setLeftMarginMm] = useState<number>(2); // 2mm margin kiri awal mulai judul
  const [qrCorrectionLevel, setQrCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');

  // Modal Print Dialog & Raw Code Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showCommandModal, setShowCommandModal] = useState<boolean>(false);
  const [commandType, setCommandType] = useState<'direct-protocol' | 'zpl'>('direct-protocol');

  // Hitung dimensi milimeter (SN 8x10 = 80 x 100 mm)
  const printWidthMm = orientation === 'landscape' ? 100 : 80;
  const printHeightMm = orientation === 'landscape' ? 80 : 100;

  // Generate QR Code saat item atau correction level berubah
  useEffect(() => {
    if (item) {
      const qrPayload = item.lpn_serial_number || item.id_inventory || `${item.item_code}|${item.batch || ''}`;
      QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: qrCorrectionLevel,
        width: 600,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => {
          console.error('Error generating QR in InventoryDetailModal:', err);
          setQrDataUrl('');
        });
    }
  }, [item, qrCorrectionLevel]);

  if (!isOpen || !item) return null;

  const handleCopyId = () => {
    if (item.id_inventory) {
      navigator.clipboard.writeText(item.id_inventory);
      setIsCopied(true);
      showToast('Tersalin', `ID ${item.id_inventory} berhasil disalin ke clipboard.`, 'info');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Helper untuk menghitung ukuran font judul dinamis
  const getItemTitleFontSize = (titleText: string, baseSize: number) => {
    if (baseSize <= 8) return baseSize;
    const len = (titleText || '').length;
    if (len > 90) return Math.max(7, baseSize - 4);
    if (len > 60) return Math.max(7.5, baseSize - 3);
    if (len > 40) return Math.max(8, baseSize - 1.5);
    return baseSize;
  };

  const getItemTextFontSize = (codeText: string, baseSize: number) => {
    if (baseSize <= 8) return baseSize;
    const len = (codeText || '').length;
    if (len > 60) return Math.max(7, baseSize - 2);
    if (len > 35) return Math.max(7.5, baseSize - 1);
    return baseSize;
  };

  function escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper untuk membuat dokumen HTML siap cetak Honeywell PM42 (Format 100% sama dengan QR Generator)
  const generatePrintHtml = () => {
    const effectiveQrSize = Math.min(qrSizeMm, printWidthMm - 16, Math.max(22, printHeightMm - 36));
    const titleText = `${item.item_code} - ${item.item_name || ''}`;
    const dynamicTitleSize = getItemTitleFontSize(titleText, titleFontSize);
    const dynamicTextSize = getItemTextFontSize(item.lpn_serial_number || item.id_inventory, textFontSize);
    const qrValue = item.lpn_serial_number || item.id_inventory || item.item_code;

    const labelHtml = `
      <div class="label-page">
        <div class="label-box ${showBorder ? 'with-border' : ''}">
          <!-- 1. ATAS: ITEM CODE & ITEM NAME (Mepet ke kiri, 8px) -->
          <div class="logistic-header" style="padding-left: ${leftMarginMm}mm;">
            <div class="item-code" style="font-size: ${dynamicTitleSize}px;">
              <span class="lbl-tag">ITEM:</span> ${escapeHtml(item.item_code || '')}
            </div>
            <div class="item-name" style="font-size: ${dynamicTitleSize}px;">
              ${escapeHtml(item.item_name || item.item_code)}
            </div>
            <!-- Garis tepat di bawah Item Name -->
            <div class="header-divider"></div>
          </div>

          <!-- 2. TENGAH: QR CODE (Standard 40mm) -->
          <div class="label-qr">
            <img src="${qrDataUrl}" alt="QR" style="width: ${effectiveQrSize}mm; height: ${effectiveQrSize}mm;" />
          </div>

          <!-- 3. BAWAH: LPN / SERIAL NUMBER, BATCH, EXPIRED DATE (Tepat di bawah BATCH agar tidak kepotong) -->
          <div class="logistic-footer" style="padding-left: ${leftMarginMm}mm;">
            <div class="lpn-text" style="font-size: ${dynamicTextSize}px;">
              <span class="lbl-tag">SN/LPN:</span> <span class="mono-val">${escapeHtml(item.lpn_serial_number || item.id_inventory)}</span>
            </div>
            <div class="batch-text" style="font-size: ${dynamicTextSize}px;">
              <span class="lbl-tag">BATCH:</span> <span class="bold-val">${escapeHtml(item.batch || '-')}</span>
            </div>
            <div class="exp-text" style="font-size: ${dynamicTextSize}px;">
              <span class="lbl-tag">EXP DATE:</span> <span class="bold-val">${escapeHtml(item.expired_date || '-')}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak Label PM42 - ${escapeHtml(item.id_inventory)} (${printWidthMm}x${printHeightMm}mm)</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: ${printWidthMm}mm ${printHeightMm}mm;
            margin: 0mm !important;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #000000;
            width: ${printWidthMm}mm;
          }
          .label-page {
            width: ${printWidthMm}mm;
            height: ${printHeightMm}mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            align-items: stretch;
            justify-content: flex-start;
            padding: ${topMarginMm}mm 2mm 2mm 2mm;
            overflow: hidden;
            background: #ffffff;
            box-sizing: border-box;
          }
          .label-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .label-box {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: space-between;
            background: #ffffff;
            box-sizing: border-box;
            overflow: hidden;
          }
          .label-box.with-border {
            border: 1px solid #000000;
            border-radius: 1mm;
          }

          /* LOGISTIC HEADER (KOLOM 1 & 2) */
          .logistic-header {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.5mm;
            text-align: left;
            padding-right: 2mm;
            flex-shrink: 0;
          }
          .item-code {
            font-weight: 800;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-all;
            letter-spacing: 0.2px;
          }
          .item-name {
            font-weight: 700;
            color: #000000 !important;
            line-height: 1.2;
            text-transform: uppercase;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .lbl-tag {
            font-weight: 800;
            color: #000000 !important;
            margin-right: 1mm;
          }
          .header-divider {
            width: 100%;
            height: 0;
            border-bottom: 1px solid #000000;
            margin-top: 0.8mm;
            margin-bottom: 0.5mm;
          }

          /* QR CODE DI TENGAH */
          .label-qr {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            margin: auto 0;
            padding: 0.5mm 0;
            flex-shrink: 0;
          }
          .label-qr img {
            width: ${effectiveQrSize}mm;
            height: ${effectiveQrSize}mm;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 1/1;
            object-fit: contain;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: pixelated;
          }

          /* LOGISTIC FOOTER (KOLOM 11, 12, 15) - Tumpuk Vertikal */
          .logistic-footer {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.5mm;
            text-align: left;
            padding-right: 2mm;
            flex-shrink: 0;
          }
          .lpn-text {
            font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-weight: 700;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-all;
          }
          .mono-val {
            font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-weight: 800;
          }
          .bold-val {
            font-weight: 800;
          }
          .batch-text {
            font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-weight: 700;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-all;
          }
          .exp-text {
            font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-weight: 700;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-all;
          }

          @media screen {
            body {
              background: #0f172a;
              padding: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 16px;
              min-height: 100vh;
              width: 100%;
            }
            .no-print-toolbar {
              position: sticky;
              top: 10px;
              z-index: 999;
              background: #1e293b;
              color: #ffffff;
              padding: 12px 20px;
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 16px;
              width: 100%;
              max-width: 480px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
              border: 1px solid #334155;
            }
            .print-btn-action {
              background: #d97706;
              color: #ffffff;
              font-weight: bold;
              border: none;
              padding: 8px 18px;
              border-radius: 10px;
              cursor: pointer;
              font-size: 13px;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              transition: background 0.15s;
            }
            .print-btn-action:hover {
              background: #b45309;
            }
            .label-page {
              box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
              background: #ffffff;
              border-radius: 4px;
              border: 1px solid #cbd5e1;
            }
          }
          @media print {
            .no-print-toolbar {
              display: none !important;
            }
            body {
              background: #ffffff !important;
              padding: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-toolbar">
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #f8fafc;">Siap Cetak Honeywell PM42</div>
            <div style="font-size: 11px; color: #94a3b8;">1 Label &bull; ${printWidthMm}x${printHeightMm} mm (SN 8x10)</div>
          </div>
          <button class="print-btn-action" onclick="window.print()">
            &#128438; Buka Dialog Printer
          </button>
        </div>
        ${labelHtml}
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.print();
            }, 350);
          });
        </script>
      </body>
      </html>
    `;
  };

  // Eksekusi Panggilan Dialog Printer Sistem
  const executeSystemPrint = () => {
    const htmlContent = generatePrintHtml();

    try {
      const printWin = window.open('', '_blank', 'width=800,height=700');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        showToast('Dialog Printer Dibuka', 'Pilih printer Honeywell PM42 pada jendela cetak', 'success');
        return;
      }
    } catch (e) {
      console.warn('Popup window print blocked, using iframe fallback...', e);
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      showToast('Dialog Printer', 'Pilih printer Honeywell PM42 di daftar printer', 'success');

      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 60000);
    }, 400);
  };

  // Buka Halaman Cetak di Tab Baru
  const openPrintNewTab = () => {
    const htmlContent = generatePrintHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    showToast('Halaman Cetak Terbuka', 'Tab cetak baru telah dibuka', 'success');
  };

  // Raw Command Generator (Direct Protocol & ZPL)
  const generateRawCommands = (type: 'direct-protocol' | 'zpl') => {
    const widthDots = Math.round(printWidthMm * 8); // 8 dots/mm = 203 DPI (Standar PM42)
    const heightDots = Math.round(printHeightMm * 8);
    const lpnVal = item.lpn_serial_number || item.id_inventory || item.item_code;

    if (type === 'direct-protocol') {
      let dp = `CLL\nOPTIMIZE "BATCH" ON\nMEDIA TYPE "LABEL WITH GAPS"\nMEDIA SIZE ${widthDots} DOTS, ${heightDots} DOTS\nFEED\n\n`;
      dp += `CLIP ON\nDIR 1\n`;
      dp += `FONT "Swiss 721 BT", 8, 8\n`;
      dp += `PP ${leftMarginMm * 8}, 20: FT "ITEM: ${item.item_code || ''}"\n`;
      dp += `PP ${leftMarginMm * 8}, 45: FT "${item.item_name || item.item_code}"\n`;
      dp += `PP ${leftMarginMm * 8}, 65: PL ${widthDots - (leftMarginMm * 8 + 20)}, 1\n`;
      dp += `BARCODE "QR", 5, 2, 4\n`;
      dp += `PP 30, 80: PB "${lpnVal}"\n`;
      dp += `FONT "Swiss 721 BT", 8, 8\n`;
      dp += `PP ${leftMarginMm * 8}, ${heightDots - 55}: FT "SN/LPN: ${lpnVal}"\n`;
      dp += `PP ${leftMarginMm * 8}, ${heightDots - 36}: FT "BATCH: ${item.batch || '-'}"\n`;
      dp += `PP ${leftMarginMm * 8}, ${heightDots - 18}: FT "EXP DATE: ${item.expired_date || '-'}"\n`;
      dp += `PF 1\n\n`;
      return dp;
    }

    // ZPL / ZSim 100% Compliant dengan Emulasi ZSim Honeywell PM42
    let zpl = `^XA\n`;
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^PON\n`;
    zpl += `^MNY\n`;
    zpl += `^PR4,4\n`;

    if (showBorder) {
      zpl += `^FO10,10^GB${widthDots - 20},${heightDots - 20},2^FS\n`;
    }

    // Baris 1: Item Code
    zpl += `^FO${leftMarginMm * 8},20^A0N,20,20^FDITEM: ${item.item_code || ''}^FS\n`;
    // Baris 2: Item Name (Maks 2 baris)
    zpl += `^FO${leftMarginMm * 8},44^A0N,20,20^FB${widthDots - 40},2,0,L^FD${item.item_name || item.item_code}^FS\n`;
    // Garis Pembatas
    zpl += `^FO${leftMarginMm * 8},66^GB${widthDots - (leftMarginMm * 8 + 20)},2,2^FS\n`;
    
    // QR Code di Tengah
    const qrPosX = Math.max(10, Math.round((widthDots / 2) - 80));
    zpl += `^FO${qrPosX},76^BQN,2,4,Q,7^FDMA,${lpnVal}^FS\n`;
    
    // Footer: LPN, BATCH, EXP DATE
    zpl += `^FO${leftMarginMm * 8},${heightDots - 70}^A0N,18,18^FDSN/LPN: ${lpnVal}^FS\n`;
    zpl += `^FO${leftMarginMm * 8},${heightDots - 48}^A0N,18,18^FDBATCH: ${item.batch || '-'}^FS\n`;
    zpl += `^FO${leftMarginMm * 8},${heightDots - 26}^A0N,18,18^FDEXP DATE: ${item.expired_date || '-'}^FS\n`;

    zpl += `^PQ1,0,1,Y\n`;
    zpl += `^XZ\n\n`;
    return zpl;
  };

  const handleDownloadPrnFile = () => {
    const raw = generateRawCommands(commandType);
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const ext = commandType === 'direct-protocol' ? 'dp' : 'zpl';
    link.download = `PM42_inventory_${item.id_inventory || 'label'}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File Diunduh', `File ${ext.toUpperCase()} berhasil diunduh`, 'success');
  };

  const statusKey = (item.status || '').toLowerCase().trim();
  const isAda = statusKey === 'ada';
  const isBeda = statusKey === 'beda';
  const isTidak = statusKey === 'tidak';

  // Dynamic preview font size inside modal card
  const titleDisplay = `${item.item_code} - ${item.item_name || ''}`;
  const dynamicCardTitleSize = getItemTitleFontSize(titleDisplay, titleFontSize);
  const dynamicCardTextSize = getItemTextFontSize(item.lpn_serial_number || item.id_inventory, textFontSize);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-teal-300">
              <Package size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight m-0">
                Detail Transaksi Inventory
              </h3>
              <p className="text-[11px] text-teal-200 m-0 font-medium font-mono">
                {item.id_inventory}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Main Header Item Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-teal-100 text-teal-900 border border-teal-300">
                  {item.item_code}
                </span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                  isAda ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                  isBeda ? 'bg-blue-100 text-blue-900 border-blue-300' :
                  isTidak ? 'bg-amber-100 text-amber-900 border-amber-300' :
                  'bg-slate-100 text-slate-800 border-slate-300'
                }`}>
                  Status: {item.status || '-'}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 m-0 leading-snug">
                {item.item_name || '-'}
              </h4>
            </div>

            {/* Actions: Copy & Print */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer"
                title="Salin ID Inventory"
              >
                {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{isCopied ? 'Tersalin' : 'Copy ID'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-all"
                title="Buka Pengaturan & Cetak Label PM42"
              >
                <Printer size={13} />
                <span>Cetak Label PM42</span>
              </button>
            </div>
          </div>

          {/* Grid Attributes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Lokasi */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Lokasi Gudang</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 font-mono text-xs">
                <MapPin size={14} className="text-teal-600 shrink-0" />
                <span>{item.location || '-'} {item.location_type ? `(${item.location_type})` : ''}</span>
              </div>
            </div>

            {/* Last Qty */}
            <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-0.5">Last Qty (Fisik)</span>
              <div className="font-mono font-black text-emerald-900 text-sm">
                {Number(item.last_qty || 0).toLocaleString('id-ID')} {item.uom ? item.uom : ''}
              </div>
            </div>

            {/* Qty Convert */}
            <div className="p-2.5 rounded-xl border border-teal-200 bg-teal-50/50 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-teal-800 block mb-0.5">Konversi PCS</span>
              <div className="font-mono font-black text-teal-900 text-sm">
                {Number(item.qty_convert || 0).toLocaleString('id-ID')} {item.uom_convert ? item.uom_convert : ''}
              </div>
            </div>

            {/* Batch */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Nomor Batch / Lot</span>
              <div className="font-mono font-bold text-slate-800 text-xs">
                {item.batch || '-'}
              </div>
            </div>

            {/* Expired Date */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Expired Date</span>
              <div className="flex items-center gap-1 font-mono font-bold text-slate-800 text-xs">
                <Calendar size={13} className="text-amber-600 shrink-0" />
                <span>{item.expired_date || '-'}</span>
              </div>
            </div>

            {/* SLOC */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Storage Loc (SLOC)</span>
              <div className="font-mono font-bold text-slate-800 text-xs">
                {item.sloc || '-'}
              </div>
            </div>

            {/* LPN / Serial */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">LPN / Serial Number</span>
              <div className="font-mono font-bold text-slate-800 text-xs truncate" title={item.lpn_serial_number || '-'}>
                {item.lpn_serial_number || '-'}
              </div>
            </div>

            {/* QC Code */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">QC Status</span>
              <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                <span>{item.qc_code || '-'}</span>
              </div>
            </div>
          </div>

          {/* Catatan & Tujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Catatan / Note:</span>
              <p className="text-slate-700 text-xs m-0 leading-relaxed font-medium">
                {item.note || '-'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/40">
              <span className="text-[10px] font-bold uppercase text-teal-800 block mb-1">Tujuan / Destinasi:</span>
              <p className="text-teal-950 font-bold text-xs m-0 leading-relaxed">
                {item.tujuan || '-'}
              </p>
            </div>
          </div>

          {/* Label Preview Card (PM42 Standard Format) */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Printer size={14} className="text-amber-700" />
                <span className="font-bold text-slate-900 text-xs">Preview Format Label Honeywell PM42 (80x100 mm)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <Sliders size={12} />
                <span>Ubah Pengaturan Cetak</span>
              </button>
            </div>

            <div className="max-w-md mx-auto p-3 bg-white rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between min-h-[160px]">
              {/* 1. ATAS */}
              <div className="w-full pb-1 border-b border-slate-900" style={{ paddingLeft: `${leftMarginMm}px` }}>
                <div className="font-extrabold text-slate-950 leading-tight" style={{ fontSize: `${dynamicCardTitleSize}px` }}>
                  ITEM: {item.item_code}
                </div>
                <div className="font-bold text-slate-900 uppercase leading-tight mt-0.5" style={{ fontSize: `${dynamicCardTitleSize}px` }}>
                  {item.item_name || '-'}
                </div>
              </div>

              {/* 2. TENGAH */}
              <div className="py-2 my-auto flex items-center justify-center w-full">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="QR Code"
                    className="w-20 h-20 aspect-square object-contain mx-auto"
                  />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 flex items-center justify-center text-slate-400 font-mono text-[10px]">
                    QR Code
                  </div>
                )}
              </div>

              {/* 3. BAWAH */}
              <div className="w-full pt-1 border-t border-slate-200 flex flex-col gap-0.5" style={{ paddingLeft: `${leftMarginMm}px` }}>
                <div className="font-mono font-bold text-slate-900" style={{ fontSize: `${dynamicCardTextSize}px` }}>
                  <span className="font-semibold text-slate-500 text-[9px] mr-1">SN/LPN:</span>
                  {item.lpn_serial_number || item.id_inventory}
                </div>
                <div className="font-mono font-bold text-slate-900" style={{ fontSize: `${dynamicCardTextSize}px` }}>
                  <span className="font-semibold text-slate-500 text-[9px] mr-1">BATCH:</span>
                  {item.batch || '-'}
                </div>
                <div className="font-mono font-bold text-slate-900" style={{ fontSize: `${dynamicCardTextSize}px` }}>
                  <span className="font-semibold text-slate-500 text-[9px] mr-1">EXP DATE:</span>
                  {item.expired_date || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="text-[10px] text-slate-400 font-mono">
            Dibuat: {item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-'}
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(item);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Hapus</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Edit2 size={13} />
              <span>Edit Data</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL DIALOG OPSI & PENGATURAN CETAK PM42 (SAMA DENGAN QR GENERATOR) */}
      {/* ========================================================================= */}
      {showPrintModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 max-h-[95vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 m-0">Pengaturan & Dialog Cetak Label PM42</h3>
                  <p className="text-[11px] text-slate-500 m-0">Honeywell PM42 Thermal Transfer / Direct Thermal (SN 8x10 cm)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Pengaturan Slider Ukuran & Posisi */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1.5 border-b border-slate-200/80">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Sliders size={14} className="text-amber-600" />
                  <span>Standar Label: 80 x 100 mm (SN 8x10)</span>
                </div>
                <div className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {printWidthMm} x {printHeightMm} mm ({orientation.toUpperCase()})
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">
                    Margin Atas ({topMarginMm}mm):
                  </label>
                  <input 
                    type="range" 
                    min={0} 
                    max={20} 
                    value={topMarginMm}
                    onChange={(e) => setTopMarginMm(Number(e.target.value))}
                    className="w-full accent-amber-600"
                    title="Antisipasi sensor jeda printer agar judul tercetak utuh"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">
                    Margin Kiri Judul ({leftMarginMm}mm):
                  </label>
                  <input 
                    type="range" 
                    min={0} 
                    max={15} 
                    value={leftMarginMm}
                    onChange={(e) => setLeftMarginMm(Number(e.target.value))}
                    className="w-full accent-amber-600"
                    title="Posisi awal mulai judul dari tepi kiri"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">
                    Ukuran Barcode/QR ({qrSizeMm}mm):
                  </label>
                  <input 
                    type="range" 
                    min={15} 
                    max={60} 
                    value={qrSizeMm}
                    onChange={(e) => setQrSizeMm(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">
                    Ukuran Judul ({titleFontSize}px):
                  </label>
                  <input 
                    type="range" 
                    min={6} 
                    max={20} 
                    value={titleFontSize}
                    onChange={(e) => setTitleFontSize(Number(e.target.value))}
                    className="w-full accent-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">
                    Ukuran Teks Bawah ({textFontSize}px):
                  </label>
                  <input 
                    type="range" 
                    min={6} 
                    max={18} 
                    value={textFontSize}
                    onChange={(e) => setTextFontSize(Number(e.target.value))}
                    className="w-full accent-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Orientasi:</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold"
                  >
                    <option value="landscape">Landscape (100x80)</option>
                    <option value="portrait">Portrait (80x100)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showBorder} 
                    onChange={(e) => setShowBorder(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-900 accent-blue-900"
                  />
                  <span className="text-xs font-semibold text-slate-700">Tampilkan Border Label</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowCommandModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FileCode size={12} />
                  <span>Raw Code (DP & ZPL)</span>
                </button>
              </div>
            </div>

            {/* Tombol Aksi Cetak Utama */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={executeSystemPrint}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={18} />
                <span>Buka Dialog Printer (Cetak Sekarang)</span>
              </button>

              <button
                type="button"
                onClick={openPrintNewTab}
                className="w-full py-2 px-4 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border border-blue-200"
              >
                <ExternalLink size={14} />
                <span>Buka Halaman Cetak di Tab Baru (Rekomendasi jika popup diblokir)</span>
              </button>
            </div>

            {/* Checklist Petunjuk Printer Honeywell PM42 */}
            <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-1.5 text-xs text-amber-950">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                <Info size={14} />
                <span>Petunjuk Wajib di Printer & Layar Dialog Browser:</span>
              </div>
              <ul className="space-y-0.5 text-[11px] text-amber-900/90 pl-5 list-disc m-0">
                <li><strong>Mode Bahasa LCD PM42:</strong> Ubah <em>Command Language</em> ke <strong className="text-emerald-800">Autosense</strong> atau <strong>Direct Protocol</strong>.</li>
                <li><strong>Paper Size:</strong> Pilih <strong>80 x 100 mm</strong> (atau User-Defined Label 8x10 cm).</li>
                <li><strong>Margins:</strong> Atur ke <strong>None / 0</strong> agar letak konten presisi.</li>
                <li><strong>Scale (Skala):</strong> Atur ke <strong>100% / Default</strong>.</li>
              </ul>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal Raw Code (DP & ZPL) */}
      {showCommandModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800 m-0">Raw Code Honeywell PM42</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCommandModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandType('direct-protocol')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  commandType === 'direct-protocol' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Direct Protocol (.dp)
              </button>
              <button
                type="button"
                onClick={() => setCommandType('zpl')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  commandType === 'zpl' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                ZPL / ZSim (.zpl)
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
              {commandType === 'zpl' ? (
                <span>
                  <strong>ZPL / ZSim:</strong> Format Zebra ZPL II untuk Honeywell PM42 dengan mode <strong>ZSim</strong> atau <strong>Autosense</strong>. Cocok untuk port 9100 / Raw Print.
                </span>
              ) : (
                <span>
                  <strong>Direct Protocol (.dp):</strong> Bahasa bawaan asli Honeywell PM42 saat printer dalam mode <strong>Direct Protocol</strong> atau <strong>Autosense</strong>.
                </span>
              )}
            </div>

            <textarea
              readOnly
              rows={10}
              value={generateRawCommands(commandType)}
              className="w-full bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs outline-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateRawCommands(commandType));
                  showToast('Tersalin', 'Kode tersalin ke clipboard', 'success');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Salin Kode
              </button>
              <button
                type="button"
                onClick={handleDownloadPrnFile}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Unduh File
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>,
    document.body
  );
}
