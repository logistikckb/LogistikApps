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
  Trash2
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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (item) {
      const qrPayload = item.lpn_serial_number || item.id_inventory || `${item.item_code}|${item.batch}`;
      QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: { dark: '#042f2e', light: '#ffffff' }
      })
        .then(url => setQrDataUrl(url))
        .catch(() => setQrDataUrl(''));
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleCopyId = () => {
    if (item.id_inventory) {
      navigator.clipboard.writeText(item.id_inventory);
      setIsCopied(true);
      showToast('Tersalin', `ID ${item.id_inventory} berhasil disalin ke clipboard.`, 'info');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handlePrintThermal = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Gagal Membuka Jendela Cetak', 'Izinkan pop-up browser untuk mencetak.', 'warning');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Label PM42 - ${item.id_inventory}</title>
          <style>
            @page { size: 100mm 50mm; margin: 0; }
            body { font-family: monospace; padding: 6px; margin: 0; font-size: 11px; }
            .label-box { border: 1px solid #000; padding: 6px; border-radius: 4px; }
            .title { font-weight: bold; font-size: 13px; margin-bottom: 2px; }
            .bold { font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .qr { text-align: center; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="title">${item.item_name}</div>
            <div class="row"><span>SKU: ${item.item_code}</span><span>LOC: ${item.location}</span></div>
            <div class="row"><span>BATCH: ${item.batch || '-'}</span><span>EXP: ${item.expired_date || '-'}</span></div>
            <div class="row"><span>QTY: ${item.last_qty} ${item.uom} (${item.qty_convert} PCS)</span><span>SLOC: ${item.sloc}</span></div>
            <div class="row"><span>ID: ${item.id_inventory}</span><span>STATUS: ${item.status}</span></div>
            ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" width="80" /></div>` : ''}
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const statusKey = (item.status || '').toLowerCase().trim();
  const isAda = statusKey === 'ada';
  const isBeda = statusKey === 'beda';
  const isTidak = statusKey === 'tidak';

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
                onClick={handlePrintThermal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                title="Cetak Label Thermal PM42"
              >
                <Printer size={13} />
                <span>Cetak Label</span>
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

            {/* User Input & Tally */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Petugas / Tally</span>
              <div className="font-semibold text-slate-800 text-xs truncate">
                {item.user_tally || item.user_input || '-'}
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

          {/* QR Code Section */}
          {qrDataUrl && (
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-0.5">LPN / Barcode QR Code</span>
                <p className="text-[11px] text-slate-500 m-0">
                  Scan QR code untuk lookup cepat pada mobile scanner atau aplikasi barcode gudang.
                </p>
              </div>
              <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 rounded-lg border border-slate-200 shrink-0" />
            </div>
          )}
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
    </div>,
    document.body
  );
}
