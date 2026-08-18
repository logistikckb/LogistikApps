import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { 
  QrCode, 
  Printer, 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Sliders, 
  Layers, 
  Search,
  Check,
  Copy,
  Info,
  FileCode,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Settings,
  AlertCircle
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export interface QrLabelItem {
  id: string;
  title: string;
  text: string;
  dataUrl: string;
  itemCode?: string;      // Kolom 1
  itemName?: string;      // Kolom 2
  lpn?: string;           // Kolom 11 (Isi QR Code)
  batch?: string;         // Kolom 12
  expiredDate?: string;   // Kolom 15
  isFullLogistic?: boolean; // True jika berasal dari data 15 kolom Excel
}

export type LabelPresetSize = '80x100' | '50x30' | '70x50' | '100x50' | '100x75' | '100x150' | 'custom';

export function QrGeneratorHoneywellModule() {
  const { showToast } = useNotification();

  // 1. Posisi Awal: Input Data & Hasil Generate KOSONG
  const [inputText, setInputText] = useState<string>('');
  const [defaultTitlePrefix, setDefaultTitlePrefix] = useState<string>('label');
  const [labels, setLabels] = useState<QrLabelItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Filter & Pemilihan
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Ukuran Kertas / Label Honeywell PM42: Standar SN 80x100 mm (Landscape)
  const [presetSize] = useState<LabelPresetSize>('80x100');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showBorder, setShowBorder] = useState<boolean>(false);
  const [titleFontSize, setTitleFontSize] = useState<number>(8); // 8px default standar
  const [textFontSize, setTextFontSize] = useState<number>(8); // 8px default standar
  const [qrSizeMm, setQrSizeMm] = useState<number>(40); // 40mm barcode size standar PM42
  const [topMarginMm, setTopMarginMm] = useState<number>(10); // 10mm margin atas default
  const [leftMarginMm, setLeftMarginMm] = useState<number>(2); // 2mm margin kiri awal mulai judul
  const [qrCorrectionLevel, setQrCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');

  // Command Generator Modal / View
  const [showCommandModal, setShowCommandModal] = useState<boolean>(false);
  const [commandType, setCommandType] = useState<'direct-protocol' | 'zpl'>('direct-protocol');
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Print Option & Dialog Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [activePrintTargetIds, setActivePrintTargetIds] = useState<string[] | undefined>(undefined);

  // Hitung dimensi milimeter (SN 8x10 = 80 x 100 mm)
  const getDimensions = () => {
    return { w: 80, h: 100 };
  };

  const currentDim = getDimensions();
  const printWidthMm = orientation === 'landscape' ? Math.max(currentDim.w, currentDim.h) : Math.min(currentDim.w, currentDim.h);
  const printHeightMm = orientation === 'landscape' ? Math.min(currentDim.w, currentDim.h) : Math.max(currentDim.w, currentDim.h);

  // Parser: Mengubah baris teks dari Excel 15 kolom atau format standar menjadi QrLabelItem
  const parseLines = (text: string) => {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Filter header jika user tidak sengaja paste header kolom Excel
    const dataLines = rawLines.filter((l) => {
      const lower = l.toLowerCase();
      // Skip jika ini adalah baris judul kolom Excel
      if (lower.startsWith('item code') || lower.includes('lpn/serial number') || (lower.includes('item code') && lower.includes('item name'))) {
        return false;
      }
      return true;
    });

    const linesToProcess = dataLines.length > 0 ? dataLines : rawLines;

    return linesToProcess.map((line, idx) => {
      // 1. Cek pemisahan tab (\t) atau delimitasi >= 11 kolom dari Excel
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t').map(c => c.trim());
      } else if (line.includes('|') && line.split('|').length >= 11) {
        cols = line.split('|').map(c => c.trim());
      } else if (line.includes(';') && line.split(';').length >= 11) {
        cols = line.split(';').map(c => c.trim());
      }

      // Jika baris memiliki minimal 11 kolom (format Excel 15 kolom)
      if (cols.length >= 11) {
        // Kolom 1 (Index 0): Item Code (misal: FG10101.496.0060.C)
        const itemCode = cols[0] || '';
        // Kolom 2 (Index 1): Item Name (misal: ABS HYPO Y. REVITALIZE 60ML BTL -1604)
        const itemName = cols[1] || '';
        // Kolom 11 (Index 10): LPN/Serial Number (misal: FGKINO-250405-AD-19-6B-155) -> Dijadikan QR Code!
        const lpn = cols[10] || '';
        // Kolom 12 (Index 11): Batch (misal: 5AJA3413F)
        const batch = cols[11] || '';
        // Kolom 15 (Index 14): Expired Date (misal: 07/12/2026)
        const expiredDate = cols.length >= 15 ? (cols[14] || '') : (cols[13] || '');

        const qrValue = lpn || itemCode || `item-${idx + 1}`;
        const titleDisplay = itemCode && itemName ? `${itemCode} - ${itemName}` : (itemCode || itemName || `Item ${idx + 1}`);

        return {
          title: titleDisplay,
          text: qrValue,
          itemCode,
          itemName,
          lpn: qrValue,
          batch,
          expiredDate,
          isFullLogistic: true
        };
      }

      // 2. Format standar / input data sebelumnya (1 atau 2 kolom biasa)
      let title = '';
      let value = '';

      if (line.includes('\t')) {
        const parts = line.split('\t');
        title = parts[0].trim();
        value = parts.slice(1).join('\t').trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        title = parts[0].trim();
        value = parts.slice(1).join(',').trim();
      } else if (line.includes(';') && !line.includes('http')) {
        const parts = line.split(';');
        title = parts[0].trim();
        value = parts.slice(1).join(';').trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        title = parts[0].trim();
        value = parts.slice(1).join('|').trim();
      } else {
        title = `${defaultTitlePrefix} ${idx + 1}`;
        value = line;
      }

      if (!value && title) {
        value = title;
        title = `${defaultTitlePrefix} ${idx + 1}`;
      }

      return { 
        title, 
        text: value,
        isFullLogistic: false 
      };
    });
  };

  // Generate QR Codes
  const handleGenerateQRs = async () => {
    if (!inputText.trim()) {
      setLabels([]);
      showToast('Perhatian', 'Masukkan teks data terlebih dahulu', 'info');
      return;
    }

    setIsGenerating(true);
    const parsed = parseLines(inputText);
    const generated: QrLabelItem[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const qrDataToEncode = item.text || item.lpn || `item-${i + 1}`;

      try {
        const url = await QRCode.toDataURL(qrDataToEncode, {
          errorCorrectionLevel: qrCorrectionLevel,
          margin: 1,
          width: 600,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        generated.push({
          id: `qr-${i + 1}-${Date.now()}`,
          title: item.title,
          text: qrDataToEncode,
          dataUrl: url,
          itemCode: item.itemCode,
          itemName: item.itemName,
          lpn: item.lpn,
          batch: item.batch,
          expiredDate: item.expiredDate,
          isFullLogistic: item.isFullLogistic
        });
      } catch (err) {
        console.error('Error QR:', item, err);
      }
    }

    setLabels(generated);
    setSelectedIds(new Set(generated.map(g => g.id)));
    setIsGenerating(false);
    
    const countLogistic = generated.filter(g => g.isFullLogistic).length;
    if (countLogistic > 0) {
      showToast('Sukses', `${generated.length} Label Logistik (15 Kolom) siap dicetak`, 'success');
    } else {
      showToast('Sukses', `${generated.length} QR Code siap dicetak`, 'success');
    }
  };

  // Re-generate if correction level changes ONLY when labels exist
  useEffect(() => {
    if (labels.length > 0 && inputText.trim()) {
      handleGenerateQRs();
    }
  }, [qrCorrectionLevel]);

  // Edit inline untuk semua field
  const handleUpdateLabel = (id: string, field: keyof QrLabelItem, val: string) => {
    setLabels(prev => prev.map(item => {
      if (item.id === id) {
        const updated: QrLabelItem = { ...item, [field]: val };
        
        // Update title otomatis jika itemCode atau itemName diedit pada data logistik
        if (item.isFullLogistic && (field === 'itemCode' || field === 'itemName')) {
          const code = field === 'itemCode' ? val : (item.itemCode || '');
          const name = field === 'itemName' ? val : (item.itemName || '');
          updated.title = code && name ? `${code} - ${name}` : (code || name || item.title);
        }

        // Regenerate QR Code jika LPN atau text diedit
        const isQrField = field === 'lpn' || field === 'text';
        if (isQrField && val.trim()) {
          updated.text = val;
          if (item.isFullLogistic) {
            updated.lpn = val;
          }
          QRCode.toDataURL(val, {
            errorCorrectionLevel: qrCorrectionLevel,
            margin: 1,
            width: 600,
            color: { dark: '#000000', light: '#ffffff' }
          }).then(url => {
            setLabels(inner => inner.map(x => x.id === id ? { ...x, dataUrl: url } : x));
          }).catch(console.error);
        }

        return updated;
      }
      return item;
    }));
  };

  const handleDeleteLabel = (id: string) => {
    setLabels(prev => prev.filter(item => item.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddNewRow = async () => {
    const newTitle = `${defaultTitlePrefix} ${labels.length + 1}`;
    const newText = `item-${Date.now().toString().slice(-6)}`;
    try {
      const url = await QRCode.toDataURL(newText, {
        errorCorrectionLevel: qrCorrectionLevel,
        margin: 1,
        width: 500,
        color: { dark: '#000000', light: '#ffffff' }
      });
      const newItem: QrLabelItem = {
        id: `qr-${labels.length + 1}-${Date.now()}`,
        title: newTitle,
        text: newText,
        dataUrl: url
      };
      setLabels(prev => [...prev, newItem]);
      setSelectedIds(prev => new Set([...prev, newItem.id]));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(labels.map(l => l.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Upload file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
          
          const lines: string[] = [];
          data.forEach((row: any[]) => {
            if (row && row.length > 0) {
              // Jika data memiliki >= 11 kolom (format 15 kolom dari Excel)
              if (row.length >= 11) {
                lines.push(row.map(c => String(c ?? '').trim()).join('\t'));
              } else {
                const col1 = String(row[0] || '').trim();
                const col2 = String(row[1] || '').trim();
                if (col1 && col2) {
                  lines.push(`${col1}, ${col2}`);
                } else if (col1) {
                  lines.push(col1);
                }
              }
            }
          });

          if (lines.length > 0) {
            setInputText(lines.join('\n'));
            showToast('Excel Dimuat', `${lines.length} baris terbaca`, 'success');
          }
        } catch (err) {
          console.error(err);
          showToast('Gagal', 'Format Excel tidak sesuai', 'danger');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content) {
          setInputText(content);
          showToast('File Dimuat', `${file.name} berhasil dibaca`, 'success');
        }
      };
      reader.readAsText(file);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    if (labels.length === 0) return;
    const hasLogistic = labels.some(l => l.isFullLogistic);
    const exportData = labels.map((l, idx) => {
      if (hasLogistic) {
        return {
          No: idx + 1,
          'Item Code': l.itemCode || l.title,
          'Item Name': l.itemName || l.title,
          'LPN / Serial Number': l.lpn || l.text,
          'Batch': l.batch || '',
          'Expired Date': l.expiredDate || '',
          'Teks QR': l.text
        };
      }
      return {
        No: idx + 1,
        Judul: l.title,
        'Teks QR': l.text
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'QR Code');
    XLSX.writeFile(wb, `qr_code_${Date.now()}.xlsx`);
    showToast('Export Berhasil', 'Data tersimpan ke Excel', 'success');
  };

  // Download ZIP
  const handleDownloadZip = async () => {
    if (labels.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      labels.forEach((item, idx) => {
        const base64Data = item.dataUrl.replace(/^data:image\/png;base64,/, "");
        const safeTitle = (item.title || `qr_${idx + 1}`).replace(/[^a-z0-9_-]/gi, '_').substring(0, 30);
        zip.file(`${idx + 1}_${safeTitle}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `QR_Code_${labels.length}_item.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Sukses', `${labels.length} file gambar diunduh`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal', 'Gagal membuat file ZIP', 'danger');
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Tersalin', 'Teks disalin', 'success');
  };

  // Helper untuk menghitung ukuran font judul
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

  // Helper untuk membuat dokumen HTML siap cetak
  const generatePrintHtml = (itemsToPrint: QrLabelItem[]) => {
    // Sizing terukur agar QR pas di tengah dan tidak mendesak judul keluar (proporsional 100x80mm)
    const effectiveQrSize = Math.min(qrSizeMm, printWidthMm - 16, Math.max(22, printHeightMm - 36));

    const labelsHtml = itemsToPrint.map((item) => {
      const dynamicTitleSize = getItemTitleFontSize(item.title, titleFontSize);
      const dynamicTextSize = getItemTextFontSize(item.text, textFontSize);

      if (item.isFullLogistic) {
        return `
          <div class="label-page">
            <div class="label-box ${showBorder ? 'with-border' : ''}">
              <!-- 1. ATAS: ITEM CODE & ITEM NAME (Mepet 2mm ke kiri, 8px) -->
              <div class="logistic-header" style="padding-left: ${leftMarginMm}mm;">
                <div class="item-code" style="font-size: ${dynamicTitleSize}px;">
                  <span class="lbl-tag">ITEM:</span> ${escapeHtml(item.itemCode || '')}
                </div>
                <div class="item-name" style="font-size: ${dynamicTitleSize}px;">
                  ${escapeHtml(item.itemName || item.title)}
                </div>
                <!-- Garis tepat di bawah Item Name -->
                <div class="header-divider"></div>
              </div>

              <!-- 2. TENGAH: QR CODE (Standard 40mm) -->
              <div class="label-qr">
                <img src="${item.dataUrl}" alt="QR" style="width: ${effectiveQrSize}mm; height: ${effectiveQrSize}mm;" />
              </div>

              <!-- 3. BAWAH: LPN / SERIAL NUMBER, BATCH, EXPIRED DATE (Tepat di bawah BATCH agar tidak kepotong) -->
              <div class="logistic-footer" style="padding-left: ${leftMarginMm}mm;">
                <div class="lpn-text" style="font-size: ${dynamicTextSize}px;">
                  <span class="lbl-tag">SN/LPN:</span> <span class="mono-val">${escapeHtml(item.lpn || item.text)}</span>
                </div>
                <div class="batch-text" style="font-size: ${dynamicTextSize}px;">
                  <span class="lbl-tag">BATCH:</span> <span class="bold-val">${escapeHtml(item.batch || '-')}</span>
                </div>
                <div class="exp-text" style="font-size: ${dynamicTextSize}px;">
                  <span class="lbl-tag">EXP DATE:</span> <span class="bold-val">${escapeHtml(item.expiredDate || '-')}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // Format sebelumnya (standar / simple)
      return `
        <div class="label-page">
          <div class="label-box ${showBorder ? 'with-border' : ''}">
            <div class="label-title" style="font-size: ${dynamicTitleSize}px; padding-left: ${leftMarginMm}mm;">
              ${escapeHtml(item.title)}
              <div class="header-divider"></div>
            </div>
            <div class="label-qr">
              <img src="${item.dataUrl}" alt="QR" style="width: ${effectiveQrSize}mm; height: ${effectiveQrSize}mm;" />
            </div>
            <div class="label-text" style="font-size: ${dynamicTextSize}px;">${escapeHtml(item.text)}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak QR Honeywell PM42 (${printWidthMm}x${printHeightMm}mm)</title>
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

          /* JUDUL DI ATAS (STANDAR SIMPLE) */
          .label-title {
            width: 100%;
            font-weight: 700;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-word;
            overflow-wrap: anywhere;
            white-space: normal;
            text-align: left;
            padding-right: 2mm;
            margin-bottom: 1mm;
            flex-shrink: 0;
            max-width: 100%;
            text-transform: uppercase;
            letter-spacing: 0.2px;
          }
          /* TEKS DI BAWAH (STANDAR SIMPLE) */
          .label-text {
            width: 100%;
            font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-weight: 600;
            color: #000000 !important;
            line-height: 1.2;
            word-break: break-word;
            overflow-wrap: anywhere;
            white-space: normal;
            text-align: center;
            margin-top: 1mm;
            padding: 0 2mm;
            flex-shrink: 0;
            max-width: 100%;
            letter-spacing: 0.5px;
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
            <div style="font-size: 11px; color: #94a3b8;">${itemsToPrint.length} Label &bull; ${printWidthMm}x${printHeightMm} mm (${presetSize === '80x100' ? 'SN 8x10' : presetSize})</div>
          </div>
          <button class="print-btn-action" onclick="window.print()">
            &#128438; Buka Dialog Printer
          </button>
        </div>
        ${labelsHtml}
        <script>
          // Trigger print dialog otomatis begitu halaman termuat
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

  // Helper untuk mendapatkan list label yang akan dicetak
  const getSelectedItemsToPrint = (targetIds?: string[]) => {
    return labels.filter(l => 
      targetIds ? targetIds.includes(l.id) : (selectedIds.size > 0 ? selectedIds.has(l.id) : true)
    );
  };

  // Buka Modal Pilihan Cetak Printer
  const openPrintOptionsDialog = (targetIds?: string[]) => {
    const items = getSelectedItemsToPrint(targetIds);
    if (items.length === 0) {
      showToast('Perhatian', 'Pilih minimal 1 label untuk dicetak', 'info');
      return;
    }
    setActivePrintTargetIds(targetIds);
    setShowPrintModal(true);
  };

  // Eksekusi Panggilan Dialog Printer Sistem
  const executeSystemPrint = (targetIds?: string[]) => {
    const itemsToPrint = getSelectedItemsToPrint(targetIds || activePrintTargetIds);
    if (itemsToPrint.length === 0) {
      showToast('Pilih Label', 'Pilih minimal 1 label untuk dicetak', 'info');
      return;
    }

    const htmlContent = generatePrintHtml(itemsToPrint);

    // Metode 1: Buka popup print window (Memastikan dialog printer muncul 100% tanpa batas iframe)
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

    // Metode 2: Fallback ke hidden Iframe Print
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
  const openPrintNewTab = (targetIds?: string[]) => {
    const itemsToPrint = getSelectedItemsToPrint(targetIds || activePrintTargetIds);
    if (itemsToPrint.length === 0) {
      showToast('Pilih Label', 'Pilih minimal 1 label untuk dicetak', 'info');
      return;
    }

    const htmlContent = generatePrintHtml(itemsToPrint);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    showToast('Halaman Cetak Terbuka', 'Tab cetak baru telah dibuka', 'success');
  };

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Raw Command Generator (Direct Protocol & ZPL)
  const generateRawCommands = (type: 'direct-protocol' | 'zpl') => {
    const itemsToProcess = labels.filter(l => selectedIds.size === 0 || selectedIds.has(l.id));
    if (itemsToProcess.length === 0) return '// Tidak ada label yang dipilih';

    if (type === 'direct-protocol') {
      let dp = `CLL\nOPTIMIZE "BATCH" ON\nMEDIA TYPE "LABEL WITH GAPS"\nMEDIA SIZE ${printWidthMm * 8} DOTS, ${printHeightMm * 8} DOTS\nFEED\n\n`;
      itemsToProcess.forEach((item) => {
        dp += `CLIP ON\nDIR 1\n`;
        dp += `FONT "Swiss 721 BT", 8, 8\n`;
        if (item.isFullLogistic) {
          dp += `PP ${leftMarginMm * 8}, 20: FT "ITEM: ${item.itemCode || ''}"\n`;
          dp += `PP ${leftMarginMm * 8}, 45: FT "${item.itemName || item.title}"\n`;
          dp += `PP ${leftMarginMm * 8}, 65: PL ${printWidthMm * 8 - (leftMarginMm * 8 + 20)}, 1\n`;
          dp += `BARCODE "QR", 5, 2, 4\n`;
          dp += `PP 30, 80: PB "${item.lpn || item.text}"\n`;
          dp += `FONT "Swiss 721 BT", 8, 8\n`;
          dp += `PP ${leftMarginMm * 8}, ${printHeightMm * 8 - 55}: FT "SN/LPN: ${item.lpn || item.text}"\n`;
          dp += `PP ${leftMarginMm * 8}, ${printHeightMm * 8 - 36}: FT "BATCH: ${item.batch || '-'}"\n`;
          dp += `PP ${leftMarginMm * 8}, ${printHeightMm * 8 - 18}: FT "EXP DATE: ${item.expiredDate || '-'}"\n`;
        } else {
          dp += `PP ${leftMarginMm * 8}, 20: FT "${item.title}"\n`;
          dp += `PP ${leftMarginMm * 8}, 45: PL ${printWidthMm * 8 - (leftMarginMm * 8 + 20)}, 1\n`;
          dp += `BARCODE "QR", 5, 2, 4\n`;
          dp += `PP 30, 80: PB "${item.text}"\n`;
          dp += `FONT "Swiss 721 BT", 8, 8\n`;
          dp += `PP 20, ${printHeightMm * 8 - 35}: FT "${item.text}"\n`;
        }
        dp += `PF 1\n\n`;
      });
      return dp;
    }

    let zpl = `^XA\n^PW${Math.round(printWidthMm * 8)}\n^LL${Math.round(printHeightMm * 8)}\n^MNM\n^XZ\n\n`;
    itemsToProcess.forEach((item) => {
      zpl += `^XA\n`;
      if (showBorder) {
        zpl += `^FO10,10^GB${Math.round(printWidthMm * 8) - 20},${Math.round(printHeightMm * 8) - 20},2^FS\n`;
      }
      if (item.isFullLogistic) {
        zpl += `^FO${leftMarginMm * 8},20^A0N,18,18^FDITEM: ${item.itemCode || ''}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},42^A0N,18,18^FB${Math.round(printWidthMm * 8) - 40},2,0,L^FD${item.itemName || item.title}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},62^GB${Math.round(printWidthMm * 8) - (leftMarginMm * 8 + 20)},1,1^FS\n`;
        zpl += `^FO${Math.round((printWidthMm * 8) / 2) - 70},70^BQN,2,4^FDQA,${item.lpn || item.text}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},${Math.round(printHeightMm * 8) - 65}^A0N,16,16^FDSN/LPN: ${item.lpn || item.text}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},${Math.round(printHeightMm * 8) - 44}^A0N,16,16^FDBATCH: ${item.batch || '-'}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},${Math.round(printHeightMm * 8) - 24}^A0N,16,16^FDEXP DATE: ${item.expiredDate || '-'}^FS\n`;
      } else {
        zpl += `^FO${leftMarginMm * 8},25^A0N,20,20^FB${Math.round(printWidthMm * 8) - 40},2,0,L^FD${item.title}^FS\n`;
        zpl += `^FO${leftMarginMm * 8},50^GB${Math.round(printWidthMm * 8) - (leftMarginMm * 8 + 20)},1,1^FS\n`;
        zpl += `^FO${Math.round((printWidthMm * 8) / 2) - 70},70^BQN,2,4^FDQA,${item.text}^FS\n`;
        zpl += `^FO20,${Math.round(printHeightMm * 8) - 45}^A0N,18,18^FB${Math.round(printWidthMm * 8) - 40},2,0,C^FD${item.text}^FS\n`;
      }
      zpl += `^XZ\n\n`;
    });
    return zpl;
  };

  const handleDownloadPrnFile = () => {
    const raw = generateRawCommands(commandType);
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const ext = commandType === 'direct-protocol' ? 'dp' : 'zpl';
    link.download = `PM42_print_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File Diunduh', `File ${ext.toUpperCase()} berhasil diunduh`, 'success');
  };

  const filteredLabels = labels.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      
      {/* Header Bar Singkat & Rapi */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <QrCode size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white m-0">QR Code Generator & Print PM42</h2>
            <p className="text-xs text-slate-300 m-0">
              Format: <span className="text-amber-400 font-semibold">Judul (atas)</span> &bull; <span className="text-white font-semibold">QR Code (tengah)</span> &bull; <span className="text-amber-400 font-semibold">Teks (bawah)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Info size={13} className="text-amber-400" />
            <span>{showGuide ? 'Tutup Petunjuk' : 'Petunjuk PM42'}</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setShowCommandModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode size={13} />
            <span>Raw Code (DP/ZPL)</span>
          </button>
        </div>
      </div>

      {/* Petunjuk Singkat */}
      {showGuide && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-slate-800 space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-amber-950">Cara Print Langsung ke Honeywell PM42 Tanpa LARGO:</div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
            <li><strong>Autosense:</strong> Di LCD printer PM42: <em>Settings &gt; Printing &gt; Media &gt; Media Type</em> pilih <code>Label w/ Gaps</code> atau <code>Autosense</code>.</li>
            <li><strong>Dialog Print Browser:</strong> Pilih printer <strong>Honeywell PM42</strong>, atur Paper Size sesuai ukuran stiker, <strong>Margin: None / Nol</strong>, dan centang Background Graphics.</li>
          </ul>
        </div>
      )}

      {/* Input Data Teks */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-800">
            Input Data (Paste langsung 15 kolom Excel atau format <code className="text-blue-900 bg-blue-50 px-1 py-0.5 rounded">judul, teks</code>)
          </span>

          <div className="flex items-center gap-2">
            <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
              <Upload size={12} />
              <span>Import TXT / Excel</span>
              <input 
                type="file" 
                accept=".txt,.csv,.xlsx,.xls" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>

            {(inputText || defaultTitlePrefix) && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setDefaultTitlePrefix('');
                }}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Hapus input dan prefix judul"
              >
                <Trash2 size={12} />
                <span>Clear All Input</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3">
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste data langsung dari Excel (15 Kolom tanpa header):&#10;Contoh 15 kolom: [Col 1: Item Code] [Col 2: Item Name] ... [Col 11: LPN/Serial (QR)] [Col 12: Batch] ... [Col 15: Expired Date]&#10;&#10;Atau format standar sebelumnya:&#10;lokasi rak a-01, BIN-A01-01&#10;material kino 21104501, 21104501-LOT911346"
              className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="space-y-2 flex flex-col justify-between">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Prefix Judul Otomatis:
              </label>
              <input 
                type="text" 
                value={defaultTitlePrefix}
                onChange={(e) => setDefaultTitlePrefix(e.target.value)}
                placeholder="label"
                className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateQRs}
              disabled={isGenerating}
              className="w-full py-2 px-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isGenerating ? 'animate-spin' : ''} />
              <span>{isGenerating ? 'Memproses...' : 'Generate QR Code'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pengaturan Ukuran Label Standar Honeywell PM42 */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Sliders size={15} className="text-amber-600" />
            <span>Standar Label Honeywell PM42:</span>
            <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
              80 x 100 mm (SN 8x10)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Dimensi Cetak:</span>
            <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {printWidthMm} x {printHeightMm} mm ({orientation.toUpperCase()})
            </span>
          </div>
        </div>

        {/* Detail Penyesuaian Slider Standar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 pt-1 text-xs">
          <div>
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">
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
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">
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
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">
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
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">
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
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">
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
            <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Orientasi:</label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
            >
              <option value="landscape">Landscape (100x80)</option>
              <option value="portrait">Portrait (80x100)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showBorder} 
                onChange={(e) => setShowBorder(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-900 accent-blue-900"
              />
              <span className="text-xs font-semibold text-slate-700">Border Garis</span>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HASIL GENERATE: HANYA JUDUL (ATAS), QR CODE (TENGAH), TEKS (BAWAH) */}
      {/* TANPA KETERANGAN TAMBAHAN APAPUN */}
      {/* ========================================================================= */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-800 m-0">
              Hasil Generate ({labels.length} Label)
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddNewRow}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} />
              <span>Tambah Baris</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={labels.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Download size={12} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={labels.length === 0 || isZipping}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Download size={12} />
              <span>{isZipping ? 'Membuat ZIP...' : 'Unduh ZIP'}</span>
            </button>

            {/* Tombol Cetak Utama */}
            <button
              type="button"
              onClick={() => openPrintOptionsDialog()}
              disabled={labels.length === 0}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Printer size={15} />
              <span>PRINT PM42 ({selectedIds.size > 0 ? selectedIds.size : labels.length})</span>
            </button>
          </div>
        </div>

        {/* Filter & Pilih Semua */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
            >
              Pilih Semua ({labels.length})
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari..."
              className="pl-6 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs outline-none w-44"
            />
          </div>
        </div>

        {/* GRID TAMPILAN LABEL (HANYA: JUDUL, QR CODE, TEKS) */}
        {filteredLabels.length === 0 ? (
          <div className="py-12 px-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-2xl bg-slate-50/70 space-y-2">
            <QrCode className="mx-auto text-slate-400" size={32} />
            <p className="font-semibold text-slate-700 m-0">Area Hasil Generate Masih Kosong</p>
            <p className="text-[11px] text-slate-400 m-0 max-w-md mx-auto">
              Silakan ketik baris data di area input teks di atas atau unggah file Excel/TXT, lalu klik tombol <strong className="text-blue-900">Generate QR Code</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 bg-slate-100/70 border border-slate-200 rounded-xl max-h-[600px] overflow-y-auto">
            {filteredLabels.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const dynamicCardTitleSize = getItemTitleFontSize(item.title, titleFontSize);
              const dynamicCardTextSize = getItemTextFontSize(item.text, textFontSize);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-2.5 border transition-all flex flex-col justify-between relative group shadow-2xs ${
                    isSelected ? 'border-amber-500 ring-2 ring-amber-400/40' : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {/* Checkbox & Hapus Baris */}
                  <div className="flex items-center justify-between mb-1">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-3.5 h-3.5 rounded text-amber-600 accent-amber-600 cursor-pointer"
                    />

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.id, item.text)}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                        title="Salin Teks"
                      >
                        {copiedId === item.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLabel(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* KOTAK PREVIEW LABEL: JUDUL/ITEM DI ATAS, QR CODE DI TENGAH, LPN/BATCH/EXP DI BAWAH */}
                  <div 
                    className={`bg-white p-2 flex flex-col justify-between text-left ${
                      showBorder ? 'border border-slate-900 rounded-sm' : ''
                    }`}
                    style={{ minHeight: '190px' }}
                  >
                    {item.isFullLogistic ? (
                      <>
                        {/* 1. ATAS (KOLOM 1 ITEM CODE & KOLOM 2 ITEM NAME) */}
                        <div className="w-full space-y-0.5 pb-1 border-b border-slate-900">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-1 py-0.2 rounded">ITEM</span>
                            <input
                              type="text"
                              value={item.itemCode || ''}
                              onChange={(e) => handleUpdateLabel(item.id, 'itemCode', e.target.value)}
                              title="Klik untuk edit Item Code"
                              style={{ fontSize: `${dynamicCardTitleSize}px` }}
                              className="w-full font-extrabold text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none truncate"
                            />
                          </div>
                          <textarea
                            rows={item.itemName && item.itemName.length > 25 ? 2 : 1}
                            value={item.itemName || item.title}
                            onChange={(e) => handleUpdateLabel(item.id, 'itemName', e.target.value)}
                            title="Klik untuk edit Item Name"
                            style={{ fontSize: `${dynamicCardTitleSize}px`, lineHeight: 1.2 }}
                            className="w-full font-bold uppercase text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none resize-none overflow-hidden"
                          />
                        </div>

                        {/* 2. QR CODE DI TENGAH (Standar 40mm) */}
                        <div className="py-1 my-auto flex items-center justify-center w-full min-h-0">
                          <img 
                            src={item.dataUrl} 
                            alt="QR Code"
                            className="w-18 h-18 max-w-full aspect-square object-contain mx-auto"
                          />
                        </div>

                        {/* 3. BAWAH (KOLOM 11 LPN, KOLOM 12 BATCH, KOLOM 15 EXP DATE TERTUMPUK) */}
                        <div className="w-full space-y-1 border-t border-slate-100 pt-1 text-[9px]">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">SN/LPN:</span>
                            <input
                              type="text"
                              value={item.lpn || item.text}
                              onChange={(e) => handleUpdateLabel(item.id, 'lpn', e.target.value)}
                              title="Klik untuk edit LPN (QR Code akan di-generate ulang)"
                              style={{ fontSize: `${dynamicCardTextSize}px` }}
                              className="w-full font-mono font-bold text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none truncate"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">BATCH:</span>
                            <input
                              type="text"
                              value={item.batch || ''}
                              onChange={(e) => handleUpdateLabel(item.id, 'batch', e.target.value)}
                              title="Batch"
                              placeholder="-"
                              style={{ fontSize: `${dynamicCardTextSize}px` }}
                              className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">EXP DATE:</span>
                            <input
                              type="text"
                              value={item.expiredDate || ''}
                              onChange={(e) => handleUpdateLabel(item.id, 'expiredDate', e.target.value)}
                              title="Expired Date"
                              placeholder="-"
                              style={{ fontSize: `${dynamicCardTextSize}px` }}
                              className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 1. JUDUL DI ATAS (Tebal, rata kiri mepet 2mm, wrapping penuh) */}
                        <div className="w-full pb-0.5 border-b border-slate-900">
                          <textarea
                            rows={item.title.length > 30 ? 2 : 1}
                            value={item.title}
                            onChange={(e) => handleUpdateLabel(item.id, 'title', e.target.value)}
                            title="Klik untuk edit judul"
                            style={{ fontSize: `${dynamicCardTitleSize}px`, lineHeight: 1.25 }}
                            className="w-full font-bold uppercase text-slate-950 text-left pl-1.5 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none resize-none overflow-hidden pb-0.5"
                          />
                        </div>

                        {/* 2. QR CODE DI TENGAH (Lebih kecil sedikit & proporsional) */}
                        <div className="py-1 my-auto flex items-center justify-center w-full min-h-0">
                          <img 
                            src={item.dataUrl} 
                            alt="QR Code"
                            className="w-20 h-20 max-w-full aspect-square object-contain mx-auto"
                          />
                        </div>

                        {/* 3. TEKS DI BAWAH (Terbaca semua, tanpa keterangan tambahan) */}
                        <textarea
                          rows={item.text.length > 25 ? 2 : 1}
                          value={item.text}
                          onChange={(e) => handleUpdateLabel(item.id, 'text', e.target.value)}
                          title="Klik untuk edit teks"
                          style={{ fontSize: `${dynamicCardTextSize}px`, lineHeight: 1.2 }}
                          className="w-full font-mono font-semibold text-slate-900 text-center bg-transparent border-t border-transparent hover:border-slate-300 focus:border-blue-500 outline-none resize-none overflow-hidden pt-0.5"
                        />
                      </>
                    )}
                  </div>

                  {/* Tombol Cetak 1 Ini Saja */}
                  <button
                    type="button"
                    onClick={() => openPrintOptionsDialog([item.id])}
                    className="w-full mt-2 py-1 bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-600 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-slate-200"
                  >
                    <Printer size={11} />
                    <span>Print Label Ini</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DIALOG OPSI PRINT KE PRINTER */}
      {/* ========================================================================= */}
      {showPrintModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 m-0">Opsi & Dialog Cetak Printer</h3>
                  <p className="text-[11px] text-slate-500 m-0">Honeywell PM42 Thermal Transfer / Direct Thermal</p>
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

            {/* Informasi Cetak */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Jumlah Label</div>
                <div className="text-sm font-extrabold text-blue-950">
                  {getSelectedItemsToPrint(activePrintTargetIds).length} Label
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Ukuran Kertas</div>
                <div className="text-sm font-extrabold text-amber-700">
                  {printWidthMm} x {printHeightMm} mm
                </div>
                <div className="text-[10px] text-slate-500 font-medium">{presetSize === '80x100' ? 'SN 8x10' : presetSize}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Orientasi</div>
                <div className="text-sm font-extrabold text-slate-800 capitalize">
                  {orientation}
                </div>
              </div>
            </div>

            {/* Tombol Aksi Cetak Utama */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => executeSystemPrint(activePrintTargetIds)}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={18} />
                <span>Buka Dialog Printer (Cetak Sekarang)</span>
              </button>

              <button
                type="button"
                onClick={() => openPrintNewTab(activePrintTargetIds)}
                className="w-full py-2.5 px-4 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border border-blue-200"
              >
                <ExternalLink size={14} />
                <span>Buka Halaman Cetak di Tab Baru (Rekomendasi jika dialog tidak muncul)</span>
              </button>
            </div>

            {/* Checklist Pengaturan Dialog Browser untuk Honeywell PM42 */}
            <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-1.5 text-xs text-amber-950">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                <Info size={14} />
                <span>Panduan Pengaturan di Dialog Printer Browser:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-amber-900/90 pl-5 list-disc m-0">
                <li><strong>Destination (Tujuan):</strong> Pilih <strong>Honeywell PM42</strong> / Driver Printer Thermal Anda.</li>
                <li><strong>Paper Size:</strong> Pilih <strong>80 x 100 mm</strong> (atau User-Defined Label 8x10 cm).</li>
                <li><strong>Margins:</strong> Atur ke <strong>None / Tidak Ada (0)</strong> agar posisi pas.</li>
                <li><strong>Scale (Skala):</strong> Atur ke <strong>100% / Default</strong>.</li>
                <li><strong>Options:</strong> Centang opsi <em>"Background graphics"</em> jika ada.</li>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
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
                  showToast('Tersalin', 'Kode tersalin', 'success');
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

    </div>
  );
}
