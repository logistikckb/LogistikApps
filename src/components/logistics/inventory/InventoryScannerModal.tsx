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
  Check 
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { InventoryItem } from '../../../types';

interface InventoryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (scannedText: string, metadata?: { sku?: string; batch?: string; lpn?: string }) => void;
  inventoryList?: InventoryItem[];
}

export function InventoryScannerModal({
  isOpen,
  onClose,
  onScanResult,
  inventoryList = []
}: InventoryScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [recentScans, setRecentScans] = useState<Array<{
    text: string;
    parsed: { sku?: string; batch?: string; lpn?: string; name?: string };
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
          // Check if first or second is numeric item code (e.g. 6-10 digits)
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
    const cleanSearch = (sku || lpn || batch || text).trim();

    return {
      rawText: text,
      cleanSearch,
      sku,
      batch,
      lpn,
      name
    };
  };

  // Handle successful scan
  const handleDecodedText = (decodedText: string) => {
    playBeep();
    triggerHaptic();
    setLastScannedResult(decodedText);

    const parsed = parseBarcodeData(decodedText);
    const searchTerm = parsed.cleanSearch;

    setRecentScans(prev => [
      {
        text: decodedText,
        parsed: {
          sku: parsed.sku,
          batch: parsed.batch,
          lpn: parsed.lpn,
          name: parsed.name
        },
        timestamp: new Date()
      },
      ...prev.filter(r => r.text !== decodedText).slice(0, 9)
    ]);

    if (!continuousMode) {
      // Single scan mode: close modal and apply search directly
      stopScanner().then(() => {
        onScanResult(searchTerm, {
          sku: parsed.sku,
          batch: parsed.batch,
          lpn: parsed.lpn
        });
        onClose();
      });
    } else {
      // In continuous mode, just invoke the callback so search updates behind or in state
      onScanResult(searchTerm, {
        sku: parsed.sku,
        batch: parsed.batch,
        lpn: parsed.lpn
      });
    }
  };

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
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
    if (isOpen && activeTab === 'camera' && selectedCameraId) {
      startScanner(selectedCameraId);
    } else {
      stopScanner();
    }
  }, [isOpen, activeTab, selectedCameraId]);

  const startScanner = async (cameraId: string) => {
    setErrorMessage(null);
    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      // Check if container element exists
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-3.5 bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Scan size={18} className="text-teal-200" />
            </div>
            <div>
              <h3 className="text-sm font-black m-0 tracking-tight flex items-center gap-1.5">
                <span>Scan QR & Barcode Inventory</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-500/30 text-teal-100 font-mono font-bold border border-teal-400/40">
                  Live Scanner
                </span>
              </h3>
              <p className="text-[11px] text-teal-100/80 m-0">
                Pindai label Honeywell PM42, SKU, Batch, atau LPN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 p-1.5 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'camera'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Camera size={13} />
            <span>Kamera Live</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              setActiveTab('upload');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Upload size={13} />
            <span>Upload Foto / Gambar</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
          
          {/* CAMERA TAB */}
          {activeTab === 'camera' && (
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
                      title="Nyalakan Lampu Kilat / Senter"
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
                    title="Scan Beruntun tanpa langsung menutup jendela scanner"
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
                <span>Arahkan kamera ke Barcode / QR Code barang</span>
                <span className="font-mono text-teal-800 font-bold">Format: QR, Code128, EAN, UPC</span>
              </div>
            </div>
          )}

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (
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
                    Klik untuk memilih foto barcode atau drag-and-drop
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Mendukung gambar JPG, PNG, WEBP dengan QR Code atau Barcode 1D
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

          {/* LAST SCAN RESULT CARD */}
          {lastScannedResult && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-900 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  <span>Berhasil Memindai</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lastScannedResult)}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedText === lastScannedResult ? <Check size={10} /> : <Copy size={10} />}
                    <span>{copiedText === lastScannedResult ? 'Tersalin' : 'Salin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseBarcodeData(lastScannedResult);
                      onScanResult(parsed.cleanSearch, {
                        sku: parsed.sku,
                        batch: parsed.batch,
                        lpn: parsed.lpn
                      });
                      stopScanner();
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Search size={10} />
                    <span>Cari Sekarang</span>
                  </button>
                </div>
              </div>
              <div className="p-1.5 bg-white rounded-lg border border-emerald-200 font-mono text-[11px] text-slate-800 break-all select-all font-semibold">
                {lastScannedResult}
              </div>
            </div>
          )}

          {/* RECENT SCANS HISTORY */}
          {recentScans.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <History size={12} className="text-slate-400" />
                  <span>Riwayat Pemindaian ({recentScans.length})</span>
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
                      onClick={() => {
                        onScanResult(parsed.cleanSearch, {
                          sku: parsed.sku,
                          batch: parsed.batch,
                          lpn: parsed.lpn
                        });
                        if (!continuousMode) {
                          stopScanner();
                          onClose();
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-50/80 border border-slate-200 hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between gap-2 group text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-teal-900 truncate">
                            {parsed.cleanSearch}
                          </span>
                          {parsed.name && (
                            <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                              - {parsed.name}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                          {parsed.sku && <span>SKU: {parsed.sku}</span>}
                          {parsed.batch && <span>Batch: {parsed.batch}</span>}
                          {parsed.lpn && <span>LPN: {parsed.lpn}</span>}
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
            <span>Mendukung Scan Barcode Fisik & Label Honeywell</span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
