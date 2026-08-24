import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowRightLeft, 
  X, 
  Database, 
  CheckCircle2, 
  RefreshCw, 
  Layers, 
  Boxes, 
  Flame, 
  Truck, 
  ClipboardList, 
  Send 
} from 'lucide-react';
import { InventoryItem } from '../../../types';
import { supabase } from '../../../supabase';
import { normalizeToIsoDate } from '../../../utils/logisticsCalculations';

export interface TransferDestination {
  id: string;
  name: string;
  tableName: string;
  idPrefix: string;
  idField: string;
  defaultSloc: string;
  defaultLocation: string;
  defaultLocationType: string;
  defaultQcCode: string;
  defaultDestinationCode: string;
  defaultStatus: string;
  defaultTujuan: string;
  defaultCategory: string;
  sourceStatusDefault: string;
  cacheKey: string;
  description: string;
  colorClass: string;
}

export const INVENTORY_TRANSFER_DESTINATIONS: TransferDestination[] = [
  {
    id: 'penyiapan',
    name: 'Menu Penyiapan (Menu D)',
    tableName: 'data_penyiapan',
    idPrefix: 'PEN-',
    idField: 'id_penyiapan',
    defaultSloc: 'SL02',
    defaultLocation: 'WH-B-01',
    defaultLocationType: 'Floor',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-02',
    defaultStatus: '',
    defaultTujuan: 'Pengiriman Cabang',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Penyiapan',
    cacheKey: 'penyiapan_cache_v1',
    description: 'Tabel: public.data_penyiapan - Outbound Penyiapan Barang',
    colorClass: 'from-sky-600 to-blue-800'
  },
  {
    id: 'pemusnahan',
    name: 'Menu Pemusnahan (Menu E)',
    tableName: 'data_pemusnahan',
    idPrefix: 'PMS-',
    idField: 'id_pemusnahan',
    defaultSloc: 'SL99',
    defaultLocation: 'WH-REJECT-01',
    defaultLocationType: 'Quarantine',
    defaultQcCode: 'QC-REJECT',
    defaultDestinationCode: 'INCINERATOR',
    defaultStatus: '',
    defaultTujuan: 'Pemusnahan Limbah Terkontrol',
    defaultCategory: 'Damaged',
    sourceStatusDefault: 'Terkirim ke Pemusnahan',
    cacheKey: 'pemusnahan_cache_v1',
    description: 'Tabel: public.data_pemusnahan - Karantina & Limbah Barang',
    colorClass: 'from-rose-600 to-red-800'
  },
  {
    id: 'reco',
    name: 'Menu Reco / Permintaan Barang (Menu F)',
    tableName: 'data_reco',
    idPrefix: 'REC-',
    idField: 'id_reco',
    defaultSloc: 'SL03',
    defaultLocation: 'WH-RECO-01',
    defaultLocationType: 'Floor',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-RECO',
    defaultStatus: '',
    defaultTujuan: 'Permintaan Barang',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Reco',
    cacheKey: 'reco_cache_v1',
    description: 'Tabel: public.data_reco - Permintaan Barang Reco',
    colorClass: 'from-purple-600 to-indigo-800'
  },
  {
    id: 'incoming',
    name: 'Menu Kedatangan / Inbound (Menu B)',
    tableName: 'incoming',
    idPrefix: 'INC-',
    idField: 'id_incoming',
    defaultSloc: 'SL01',
    defaultLocation: 'WH-IN-01',
    defaultLocationType: 'Rack',
    defaultQcCode: 'QC-PASS',
    defaultDestinationCode: 'DST-01',
    defaultStatus: '',
    defaultTujuan: 'Warehouse Utama (Inbound)',
    defaultCategory: 'Finished Good',
    sourceStatusDefault: 'Terkirim ke Kedatangan',
    cacheKey: 'ckb_incoming_cache_v1',
    description: 'Tabel: public.incoming - Transaksi Inbound Kedatangan Barang',
    colorClass: 'from-emerald-600 to-teal-800'
  }
];

interface InventoryBulkTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  onTransferSuccess: (destination: TransferDestination, updatedInventoryItems: InventoryItem[]) => Promise<void>;
  currentUser: any;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InventoryBulkTransferModal({
  isOpen,
  onClose,
  selectedItems,
  onTransferSuccess,
  currentUser,
  showToast
}: InventoryBulkTransferModalProps) {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('penyiapan');
  const [customDestinationTujuan, setCustomDestinationTujuan] = useState<string>('');
  const [customDestinationStatus, setCustomDestinationStatus] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [keepOrDeleteSource, setKeepOrDeleteSource] = useState<'update_status' | 'delete_source'>('update_status');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedDest = INVENTORY_TRANSFER_DESTINATIONS.find(d => d.id === selectedDestinationId) || INVENTORY_TRANSFER_DESTINATIONS[0];

  useEffect(() => {
    if (selectedItems.length > 0) {
      // Preserve first selected item's tujuan and note as per user's preference
      setCustomDestinationTujuan(selectedItems[0].tujuan || selectedDest.defaultTujuan);
      setCustomNote(selectedItems[0].note || '');
      setCustomDestinationStatus(''); // Empty by default
    }
  }, [selectedItems, selectedDestinationId]);

  if (!isOpen || selectedItems.length === 0) return null;

  const handleExecuteTransfer = async () => {
    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const dateStr = nowIso.slice(0, 10).replace(/-/g, '');

      // 1. Fetch existing count from destination table to generate unique IDs
      let maxSeq = 0;
      try {
        const { data } = await supabase
          .from(selectedDest.tableName)
          .select(selectedDest.idField)
          .order('created_at', { ascending: false })
          .limit(100);

        if (data && Array.isArray(data)) {
          const regex = new RegExp(`^${selectedDest.idPrefix}${dateStr}-(\\d+)$`, 'i');
          data.forEach(row => {
            const val = String((row as any)[selectedDest.idField] || '');
            const match = val.match(regex);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
        }
      } catch (fetchErr) {
        console.warn('Could not fetch existing seq from destination:', fetchErr);
      }

      // 2. Prepare payload for destination table
      const rowsToInsert = selectedItems.map(item => {
        maxSeq += 1;
        const newId = `${selectedDest.idPrefix}${dateStr}-${String(maxSeq).padStart(4, '0')}`;
        
        // Match note and tujuan from item if available, or fallback to modal custom input
        const finalTujuan = customDestinationTujuan || item.tujuan || selectedDest.defaultTujuan;
        const finalNote = customNote || item.note || '';
        const finalStatus = customDestinationStatus || '';

        const record: Record<string, any> = {
          [selectedDest.idField]: newId,
          item_code: item.item_code,
          item_name: item.item_name,
          category: item.category || selectedDest.defaultCategory,
          location: item.location || selectedDest.defaultLocation,
          location_type: item.location_type || selectedDest.defaultLocationType,
          first_qty: item.first_qty ?? item.last_qty,
          last_qty: item.last_qty ?? 0,
          uom: item.uom || 'CTN',
          qty_convert: item.qty_convert ?? 0,
          uom_convert: item.uom_convert || 'PCS',
          lpn_serial_number: item.lpn_serial_number || `LPN-${newId}`,
          batch: item.batch || '',
          vendor_batch: item.vendor_batch || '',
          sloc: item.sloc || selectedDest.defaultSloc,
          expired_date: normalizeToIsoDate(item.expired_date) || null,
          destination_code: item.destination_code || selectedDest.defaultDestinationCode,
          qc_code: item.qc_code || selectedDest.defaultQcCode,
          user_tally: item.user_tally || currentUser?.nama || 'Tally Transfer',
          shelf_life: item.shelf_life || '24 Bulan',
          source: 'Inventory Gudang',
          user_input: currentUser?.nama || 'Admin',
          status: finalStatus,
          note: finalNote,
          tujuan: finalTujuan,
          created_at: nowIso,
          updated_at: nowIso
        };

        return record;
      });

      // 3. Insert into Supabase destination table
      const { error: insertErr } = await supabase
        .from(selectedDest.tableName)
        .insert(rowsToInsert);

      if (insertErr) {
        throw new Error(`Gagal menyimpan ke ${selectedDest.tableName}: ${insertErr.message}`);
      }

      // 4. Update or delete source inventory items
      let updatedSourceItems: InventoryItem[] = [];

      if (keepOrDeleteSource === 'delete_source') {
        const idsToDelete = selectedItems.map(i => i.id_inventory);
        await supabase
          .from('data_inventory')
          .delete()
          .in('id_inventory', idsToDelete);
      } else {
        // Update status in data_inventory
        const idsToUpdate = selectedItems.map(i => i.id_inventory);
        await supabase
          .from('data_inventory')
          .update({
            status: selectedDest.sourceStatusDefault,
            updated_at: nowIso
          })
          .in('id_inventory', idsToUpdate);

        updatedSourceItems = selectedItems.map(item => ({
          ...item,
          status: selectedDest.sourceStatusDefault,
          updated_at: nowIso
        }));
      }

      showToast(
        'Pindah Data Berhasil',
        `Berhasil memindahkan ${selectedItems.length} baris data ke ${selectedDest.name}.`,
        'success'
      );

      await onTransferSuccess(selectedDest, updatedSourceItems);
      onClose();
    } catch (err: any) {
      console.error('Transfer error:', err);
      showToast('Gagal Pindah Data', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-teal-300">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight m-0">
                Pindah Data Inventory Massal
              </h3>
              <p className="text-[11px] text-teal-200 m-0 font-medium">
                {selectedItems.length} baris data terpilih
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Destination Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Pilih Modul / Tabel Tujuan:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INVENTORY_TRANSFER_DESTINATIONS.map((dest) => {
                const isSelected = dest.id === selectedDestinationId;
                return (
                  <div
                    key={dest.id}
                    onClick={() => setSelectedDestinationId(dest.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-600 ring-2 ring-teal-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-xs ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                        {dest.name}
                      </span>
                      {isSelected && <CheckCircle2 size={15} className="text-teal-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 m-0 font-medium">{dest.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Fields: Tujuan, Status, Note */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tujuan di Database Tujuan (Default sesuai data terpilih):
              </label>
              <input
                type="text"
                value={customDestinationTujuan}
                onChange={(e) => setCustomDestinationTujuan(e.target.value)}
                placeholder={selectedDest.defaultTujuan}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Status di Database Tujuan (Dikosongkan secara default):
              </label>
              <input
                type="text"
                value={customDestinationStatus}
                onChange={(e) => setCustomDestinationStatus(e.target.value)}
                placeholder="Biarkan kosong atau isi status khusus..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Catatan / Note (Default sesuai data terpilih):
              </label>
              <textarea
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Catatan perpindahan barang..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Opsi data asal */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <span className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Tindakan pada Data di Modul Inventory Asal:
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="source_action"
                  checked={keepOrDeleteSource === 'update_status'}
                  onChange={() => setKeepOrDeleteSource('update_status')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <span>Simpan di Inventory (Update Status jadi "{selectedDest.sourceStatusDefault}")</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-rose-700">
                <input
                  type="radio"
                  name="source_action"
                  checked={keepOrDeleteSource === 'delete_source'}
                  onChange={() => setKeepOrDeleteSource('delete_source')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Hapus Data Asal dari Inventory (Move / Pindah Penuh)</span>
              </label>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecuteTransfer}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Memproses Perpindahan...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Kirim {selectedItems.length} Data ke {selectedDest.name}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
