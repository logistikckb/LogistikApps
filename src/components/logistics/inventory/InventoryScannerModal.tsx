import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Upload, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  Scan, 
  Search, 
  History, 
  Layers, 
  Sparkles, 
  Copy, 
  Check,
  MapPin,
  Package,
  ExternalLink,
  Keyboard,
  ArrowRight
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { InventoryItem } from '../../../types';

interface InventoryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (scannedText: string, metadata?: { sku?: string; batch?: string; lpn?: string }) => void;
  inventoryList?: InventoryItem[];
  onOpenDetail?: (item: InventoryItem) => void;
}

export function InventoryScannerModal({
  isOpen,
  onClose,
  onScanResult,
  inventoryList = [],
  onOpenDetail
}: InventoryScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  
  // Floor SN / LPN Matched Results
  const [matchedResults, setMatchedResults] = useState<InventoryItem[]>([]);
  const [hasSearchedFloor, setHasSearchedFloor] = useState(false);
  const [lastScannedQuery, setLastScannedQuery] = useState('');
  
  const [recentScans, setRecentScans] = useState<Array<{
    text: string;
    parsed: { sku?: string; batch?: string; lpn?: string; name?: string };
    matchedCount: number;
    primaryLocation?: string;
    primarySku?: string;
    timestamp: Date;
  }>>([]);
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'inventory-html5-qrcode-reader';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Play audio beep
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  // Vibration feedback
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {}
  };

  // Smart parser for Honeywell label / GS1 / Tabbed / Colon / Pipe formatted QR Codes
  const parseBarcodeData = (rawText: string) => {
    const text = rawText.trim();
    let sku: string | undefined;
    let batch: string | undefined;
    let lpn: string | undefined;
    let name: string | undefined;

    // Check if JSON
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const obj = JSON.parse(text);
        sku = obj.item_code || obj.itemCode || obj.sku || obj.code || obj.material;
        batch = obj.batch || obj.lot || obj.batch_number;
        lpn = obj.lpn || obj.serial || obj.lpn_serial_number;
        name = obj.item_name || obj.itemName || obj.name;
      } catch {}
    }

    // Check pipe or tab or newline separated data (e.g. Honeywell PM42 label format)
    if (!sku) {
      const delimiter = text.includes('\t') ? '\t' : text.includes('|') ? '|' : text.includes('\n') ? '\n' : null;
      if (delimiter) {
        const parts = text.split(delimiter).map(p => p.trim());
        for (const part of parts) {
          const lower = part.toLowerCase();
          if (lower.startsWith('sku:') || lower.startsWith('item:') || lower.startsWith('kode:')) {
            sku = part.split(':')[1]?.trim();
          } else if (lower.startsWith('batch:') || lower.startsWith('lot:')) {
            batch = part.split(':')[1]?.trim();
          } else if (lower.startsWith('lpn:') || lower.startsWith('sn:')) {
            lpn = part.split(':')[1]?.trim();
          } else if (lower.startsWith('name:') || lower.startsWith('nama:')) {
            name = part.split(':')[1]?.trim();
          }
        }
        // If positional format like: [itemCode, itemName, batch, qty] or [location, itemCode, ...]
        if (!sku && parts.length >= 2) {
          const candidateSku = parts.find(p => /^\d{6,12}$/.test(p));
          if (candidateSku) sku = candidateSku;
        }
      }
    }

    // Check key-value pairs with colon or equals
    if (!sku) {
      const skuMatch = text.match(/(?:sku|item|material|kode)\s*[:=]\s*([a-zA-Z0-9_-]+)/i);
      if (skuMatch) sku = skuMatch[1];
      const batchMatch = text.match(/(?:batch|lot|charg)\s*[:=]\s*([a-zA-Z0-9_-]+)/i);
      if (batchMatch) batch = batchMatch[1];
      const lpnMatch = text.match(/(?:lpn|sn|serial)\s*[:=]\s*([a-zA-Z0-9_-]+)/i);
      if (lpnMatch) lpn = lpnMatch[1];
    }

    // Direct match against existing inventory if raw text matches item_code or lpn or batch
    if (!sku && inventoryList.length > 0) {
      const match = inventoryList.find(
        i => i.item_code?.toLowerCase() === text.toLowerCase() ||
             i.lpn_serial_number?.toLowerCase() === text.toLowerCase() ||
             i.batch?.toLowerCase() === text.toLowerCase()
      );
      if (match) {
        sku = match.item_code;
        batch = match.batch;
        lpn = match.lpn_serial_number;
        name = match.item_name;
      }
    }

    // If still no specific field detected, clean search term
    const cleanSearch = (lpn || sku || batch || text).trim();

    return {
      rawText: text,
      cleanSearch,
      sku,
      batch,
      lpn,
      name
    };
  };

  // Find matching items from inventory specifically for floor SN / LPN checking
  const findFloorMatches = (rawText: string, parsed: { sku?: string; batch?: string; lpn?: string }) => {
    const rawClean = rawText.trim().toLowerCase();
    const lpnQuery = (parsed.lpn || '').trim().toLowerCase();
    const skuQuery = (parsed.sku || '').trim().toLowerCase();
    const batchQuery = (parsed.batch || '').trim().toLowerCase();

    return inventoryList.filter(item => {
      const itemLpn = (item.lpn_serial_number || '').trim().toLowerCase();
      const itemSku = (item.item_code || '').trim().toLowerCase();
      const itemBatch = (item.batch || '').trim().toLowerCase();
      const itemId = (item.id_inventory || '').trim().toLowerCase();

      // 1. Primary match: LPN / Serial Number
      if (lpnQuery && itemLpn) {
        if (itemLpn === lpnQuery || itemLpn.includes(lpnQuery) || lpnQuery.includes(itemLpn)) {
          return true;
        }
      }
      if (rawClean && itemLpn) {
        if (itemLpn === rawClean || itemLpn.includes(rawClean) || rawClean.includes(itemLpn)) {
          return true;
        }
      }

      // 2. Structured Honeywell PM42 format match: SKU + Batch
      if (skuQuery && itemSku === skuQuery) {
        if (batchQuery) {
          return itemBatch === batchQuery;
        }
        return true;
      }

      // 3. Direct SKU match if scanned code is SKU barcode
      if (rawClean && itemSku === rawClean) {
        return true;
      }

      // 4. Fallback ID match
      if (rawClean && itemId === rawClean) {
        return true;
      }

      return false;
    });
  };

  // Handle successful scan from Camera, Upload, or Manual typing
  const handleDecodedText = (decodedText: string) => {
    if (!decodedText || !decodedText.trim()) return;
    playBeep();
    triggerHaptic();
    setLastScannedResult(decodedText);

    const parsed = parseBarcodeData(decodedText);
    const matches = findFloorMatches(decodedText, parsed);
    
    setMatchedResults(matches);
    setHasSearchedFloor(true);
    setLastScannedQuery(parsed.cleanSearch || decodedText);

    setRecentScans(prev => [
      {
        text: decodedText,
        parsed: {
          sku: parsed.sku,
          batch: parsed.batch,
          lpn: parsed.lpn,
          name: parsed.name
        },
        matchedCount: matches.length,
        primaryLocation: matches[0]?.location,
        primarySku: matches[0]?.item_name || matches[0]?.item_code,
        timestamp: new Date()
      },
      ...prev.filter(r => r.text !== decodedText).slice(0, 9)
    ]);

    // If continuous mode is on, invoke callback immediately
    if (continuousMode) {
      onScanResult(parsed.cleanSearch || decodedText, {
        sku: parsed.sku,
        batch: parsed.batch,
        lpn: parsed.lpn
      });
    } else {
      // In floor checking mode: temporarily pause scanner so user can inspect the location and SKU
      stopScanner();
    }
  };

  // Resume camera scanning for the next item on the floor
  const handleScanNext = () => {
    setMatchedResults([]);
    setHasSearchedFloor(false);
    setLastScannedResult(null);
    setLastScannedQuery('');
    setManualInput('');
    if (activeTab === 'camera' && selectedCameraId) {
      startScanner(selectedCameraId);
    }
  };

  // Apply result to inventory table
  const handleApplyToTable = (searchTerm: string, metadata?: { sku?: string; batch?: string; lpn?: string }) => {
    stopScanner().then(() => {
      onScanResult(searchTerm, metadata);
      onClose();
    });
  };

  // Open full detail modal
  const handleOpenDetailModal = (item: InventoryItem) => {
    stopScanner().then(() => {
      if (onOpenDetail) {
        onOpenDetail(item);
      }
      onClose();
    });
  };

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setMatchedResults([]);
      setHasSearchedFloor(false);
      setLastScannedResult(null);
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then(devices => {
        if (!isMounted) return;
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer back camera (environment)
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('belakang') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMessage('Tidak ada kamera yang ditemukan pada perangkat ini.');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('Camera enumeration error:', err);
        setErrorMessage('Gagal mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  // Start scanner when camera is selected
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && selectedCameraId && !hasSearchedFloor) {
      startScanner(selectedCameraId);
    } else if (hasSearchedFloor && !continuousMode) {
      // Stopped to display result
    } else {
      stopScanner();
    }
  }, [isOpen, activeTab, selectedCameraId, hasSearchedFloor, continuousMode]);

  const startScanner = async (cameraId: string) => {
    setErrorMessage(null);
    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const container = document.getElementById(scannerContainerId);
      if (!container) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.ITF
      ];

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport,
        verbose: false
      });
      scannerRef.current = html5QrCode;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxWidth = Math.floor(minEdge * 0.85);
        const qrboxHeight = Math.floor(minEdge * 0.65);
        return { width: Math.max(220, qrboxWidth), height: Math.max(140, qrboxHeight) };
      };

      await html5QrCode.start(
        cameraId,
        {
          fps: 20,
          qrbox: qrboxFunction,
          aspectRatio: 1.3333
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // ignore frame decode failures
        }
      );

      setIsScanning(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        if (capabilities && (capabilities as any).torchFeature?.().isSupported()) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      setIsScanning(false);
      setErrorMessage(err.message || 'Tidak dapat mengaktifkan kamera. Periksa izin kamera browser.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Stop scanner warning:', e);
      }
      scannerRef.current = null;
      setIsScanning(false);
      setTorchOn(false);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanning) return;
    try {
      const newTorchState = !torchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setTorchOn(newTorchState);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // File Upload Barcode scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    try {
      const html5QrCode = new Html5Qrcode('inventory-upload-temp-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });

      const decodedResult = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleDecodedText(decodedResult);
    } catch (err: any) {
      console.error('File scan error:', err);
      setErrorMessage('Tidak dapat membaca QR/Barcode dari gambar yang dipilih. Pastikan gambar jelas dan tidak buram.');
    }
  };

  // Manual search submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedText(manualInput.trim());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Scan size={18} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black m-0 tracking-tight flex items-center gap-1.5 text-slate-900">
                <span>Scanner SN / LPN di Lantai Gudang</span>
                <span className="px-2 py-0.5 rounded text-[9px] bg-teal-100 text-teal-900 font-bold border border-teal-300">
                  Cek Lokasi & SKU
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 m-0">
                Pindai SN atau LPN untuk mengetahui posisi lokasi fisik dan rincian SKU barang
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-200 bg-white p-1 gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              if (hasSearchedFloor) handleScanNext();
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'camera'
                ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Camera size={13} />
            <span>Kamera Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              setActiveTab('manual');
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'manual'
                ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Keyboard size={13} />
            <span>Ketik / Pistol Scan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              setActiveTab('upload');
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Upload size={13} />
            <span>Upload Gambar</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">

          {/* ========================================================================= */}
          {/* HASIL LOKASI & DETAIL SKU (Tampil Menonjol Saat SN/LPN Terpindai) */}
          {/* ========================================================================= */}
          {hasSearchedFloor && (
            <div className="space-y-3 animate-fade-in">
              {matchedResults.length > 0 ? (
                <div className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-b from-emerald-50/90 to-white p-3.5 shadow-md space-y-3">
                  
                  {/* Status & Match Count Header */}
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 size={15} />
                      </div>
                      <span className="text-xs font-black text-emerald-950 uppercase tracking-tight">
                        SN / LPN Teridentifikasi di Gudang
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-mono font-black border border-emerald-300">
                      {matchedResults.length} Posisi Ditemukan
                    </span>
                  </div>

                  {/* 1. KOTAK LOKASI UTAMA (Paling Penting untuk Petugas di Lantai) */}
                  <div className="p-3 bg-white rounded-xl border-2 border-indigo-600 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1">
                        <MapPin size={13} className="text-indigo-600" />
                        <span>Lokasi Fisik Barang di Lantai Gudang</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold text-[10px] border border-indigo-200">
                        SLOC: {matchedResults[0].sloc || 'SL01'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight font-mono">
                        {matchedResults[0].location || 'LOKASI TIDAK TERCATAT'}
                      </span>
                      {matchedResults[0].location_type && (
                        <span className="text-xs font-bold text-slate-500">
                          (Tipe: {matchedResults[0].location_type})
                        </span>
                      )}
                    </div>

                    {/* Jika item ini tersimpan di lebih dari 1 lokasi */}
                    {matchedResults.length > 1 && (
                      <div className="pt-2 border-t border-slate-100 mt-2 space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-600">
                          Perhatian: LPN/SKU ini tercatat di {matchedResults.length} lokasi berbeda:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {matchedResults.map((m, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold">
                              📍 {m.location} ({m.last_qty} {m.uom})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. DETAIL SKU & BARANG */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                        <Package size={13} className="text-teal-700" />
                        <span>Detail SKU & Informasi Barang</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${
                        matchedResults[0].status?.toLowerCase() === 'ada'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : matchedResults[0].status?.toLowerCase() === 'tidak'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        Status: {matchedResults[0].status || 'Belum Dicek'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 m-0 leading-snug">
                            {matchedResults[0].item_name}
                          </h4>
                          <span className="text-xs font-mono font-extrabold text-teal-800">
                            SKU: {matchedResults[0].item_code}
                          </span>
                        </div>

                        <div className="text-right shrink-0 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          <span className="text-[10px] font-bold text-slate-500 block">Sisa Stok</span>
                          <span className="text-sm sm:text-base font-black text-teal-950 font-mono">
                            {matchedResults[0].last_qty} {matchedResults[0].uom || 'CTN'}
                          </span>
                          {matchedResults[0].qty_convert !== undefined && (
                            <span className="text-[10px] font-bold text-teal-700 block">
                              ({matchedResults[0].qty_convert} {matchedResults[0].uom_convert || 'PCS'})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 text-[11px]">
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-[9px] text-slate-500 uppercase font-bold block">SN / LPN</span>
                          <span className="font-mono font-bold text-slate-800 break-all">
                            {matchedResults[0].lpn_serial_number || '-'}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Batch / Lot</span>
                          <span className="font-mono font-bold text-slate-800">
                            {matchedResults[0].batch || '-'}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-[9px] text-slate-500 uppercase font-bold block">Expired Date</span>
                          <span className="font-mono font-bold text-slate-800">
                            {matchedResults[0].expired_date || '-'}
                          </span>
                        </div>
                      </div>

                      {matchedResults[0].note && (
                        <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-950 font-medium">
                          <span className="font-bold">Catatan:</span> {matchedResults[0].note}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyToTable(matchedResults[0].lpn_serial_number || matchedResults[0].item_code || lastScannedQuery)}
                      className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Search size={14} />
                      <span>Tampilkan di Tabel</span>
                    </button>

                    {onOpenDetail && (
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(matchedResults[0])}
                        className="py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        <span>Buka Detail</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleScanNext}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-300"
                      title="Pindai LPN atau SN berikutnya"
                    >
                      <RefreshCw size={13} />
                      <span>Scan LPN Lain</span>
                    </button>
                  </div>

                </div>
              ) : (
                /* TIDAK DITEMUKAN DI INVENTORY GUDANG */
                <div className="p-4 rounded-2xl border-2 border-amber-400 bg-amber-50/80 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-black text-amber-950 m-0">
                        SN / LPN Tidak Ditemukan di Inventory
                      </h4>
                      <p className="text-xs text-amber-900 m-0">
                        Kode barcode/QR <span className="font-mono font-bold select-all bg-white px-1.5 py-0.5 rounded border border-amber-300">"{lastScannedQuery}"</span> belum tercatat di data inventory aktif.
                      </p>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-amber-200 font-mono text-xs text-slate-700 break-all select-all font-bold">
                    Raw Data: {lastScannedResult}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleApplyToTable(lastScannedQuery)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Search size={13} />
                      <span>Cari Teks di Tabel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleScanNext}
                      className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Scan size={13} />
                      <span>Scan Ulang</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* CAMERA TAB (Tampil jika belum ada hasil atau sedang mode continuous) */}
          {activeTab === 'camera' && (!hasSearchedFloor || continuousMode) && (
            <div className="space-y-3">
              {/* Controls Toolbar: Camera Picker, Torch, Continuous Mode */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                {cameras.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                    <Camera size={13} className="text-slate-500 shrink-0" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-700 truncate"
                    >
                      {cameras.map(cam => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Kamera ${cam.id.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        torchOn 
                          ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-2xs' 
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Nyalakan Lampu Kilat / Senter di area gelap gudang"
                    >
                      {torchOn ? <Zap size={12} className="fill-amber-950" /> : <ZapOff size={12} />}
                      <span>{torchOn ? 'Senter ON' : 'Senter'}</span>
                    </button>
                  )}

                  {/* Continuous scan toggle */}
                  <button
                    type="button"
                    onClick={() => setContinuousMode(!continuousMode)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      continuousMode
                        ? 'bg-teal-100 text-teal-900 border-teal-300 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                    title="Scan beruntun tanpa menghentikan kamera"
                  >
                    <Layers size={12} className={continuousMode ? 'text-teal-700' : 'text-slate-400'} />
                    <span>{continuousMode ? 'Mode Beruntun' : 'Scan 1x'}</span>
                  </button>
                </div>
              </div>

              {/* Viewfinder Frame */}
              <div className="relative rounded-2xl bg-black overflow-hidden border-2 border-slate-800 aspect-4/3 flex items-center justify-center shadow-inner">
                {/* HTML5 QR Container */}
                <div id={scannerContainerId} className="w-full h-full" />

                {/* Visual Target Guide & Laser Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    <div className="relative w-full max-w-[280px] h-[180px] border-2 border-dashed border-teal-400/80 rounded-xl bg-teal-500/5 shadow-[0_0_20px_rgba(20,184,166,0.25)] flex items-center justify-center">
                      {/* Corner Accents */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-teal-300 rounded-tl-lg -translate-x-1 -translate-y-1" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-teal-300 rounded-tr-lg translate-x-1 -translate-y-1" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-teal-300 rounded-bl-lg -translate-x-1 translate-y-1" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-teal-300 rounded-br-lg translate-x-1 translate-y-1" />
                      
                      {/* Animated Laser Scanning Line */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent absolute shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-bounce" />
                    </div>
                  </div>
                )}

                {/* Error Banner inside scanner */}
                {errorMessage && (
                  <div className="absolute inset-x-4 bottom-4 p-3 bg-rose-950/90 border border-rose-600/80 rounded-xl text-rose-200 text-xs flex items-center gap-2 backdrop-blur-xs">
                    <AlertCircle size={16} className="text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Arahkan kamera ke barcode SN / LPN pada pallet atau kardus</span>
                <span className="font-mono text-teal-800 font-bold">QR / Code128 / Honeywell</span>
              </div>
            </div>
          )}

          {/* MANUAL LOOKUP TAB (Ketik SN/LPN atau gunakan Pistol Scanner USB/Bluetooth) */}
          {activeTab === 'manual' && (!hasSearchedFloor || continuousMode) && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Keyboard size={14} className="text-teal-700" />
                  <span>Ketik Manual atau Gunakan Pistol Barcode Scanner</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Ketik nomor SN / LPN yang tertera pada kardus atau scan menggunakan barcode scanner eksternal.
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Masukkan nomor SN atau LPN (misal: SN..., LPN...)"
                    autoFocus
                    className="w-full pl-3 pr-24 py-2 bg-white rounded-xl border-2 border-teal-600 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Cek</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (!hasSearchedFloor || continuousMode) && (
            <div className="space-y-3">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 rounded-2xl p-6 text-center cursor-pointer transition-all hover:border-teal-500 flex flex-col items-center justify-center space-y-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih foto barcode / QR atau drag-and-drop
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Mendukung foto label pallet, barcode kardus, atau label Honeywell
                  </p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </div>

              {/* Hidden element for upload reader */}
              <div id="inventory-upload-temp-reader" className="hidden" />

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* RECENT SCANS HISTORY */}
          {recentScans.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <History size={12} className="text-slate-400" />
                  <span>Riwayat Pengecekan Lantai ({recentScans.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRecentScans([])}
                  className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  Bersihkan
                </button>
              </div>

              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                {recentScans.map((scan, idx) => {
                  const parsed = parseBarcodeData(scan.text);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleDecodedText(scan.text)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-teal-50/80 border border-slate-200 hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between gap-2 group text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-teal-900 truncate">
                            {parsed.cleanSearch || scan.text}
                          </span>
                          {scan.primaryLocation && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-900 font-mono font-bold text-[10px] border border-indigo-200 shrink-0">
                              📍 {scan.primaryLocation}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1.5">
                          {scan.primarySku && <span>{scan.primarySku}</span>}
                          {scan.matchedCount > 0 ? (
                            <span className="text-emerald-700 font-bold">• Ada di Stok</span>
                          ) : (
                            <span className="text-amber-700 font-bold">• Tidak di Stok</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {scan.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="p-1 rounded bg-white text-slate-500 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                          <Search size={11} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <QrCode size={13} className="text-teal-700" />
            <span>Format LPN/SN Otomatis Dicocokkan ke Database Gudang</span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
