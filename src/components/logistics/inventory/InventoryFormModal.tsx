import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  X, 
  Search, 
  MapPin, 
  Calendar, 
  Barcode, 
  Layers, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  Sparkles, 
  AlertCircle, 
  Filter 
} from 'lucide-react';
import { InventoryItem, DataBarang } from '../../../types';
import { getEdIsoDateString } from '../../../utils/logisticsCalculations';
import { fuzzySearchDataBarang } from '../../../utils/fuseSearch';

interface InventoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => Promise<void>;
  itemToEdit: InventoryItem | null;
  existingItems: InventoryItem[];
  barangList: DataBarang[];
  currentUser: any;
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export function InventoryFormModal({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
  existingItems,
  barangList,
  currentUser,
  showToast
}: InventoryFormModalProps) {
  const isEdit = !!itemToEdit;

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    item_code: '',
    item_name: '',
    category: 'Finished Good',
    location: 'WH-INV-01',
    location_type: 'Rack',
    first_qty: 1,
    last_qty: 1,
    uom: 'CTN',
    qty_convert: 24,
    uom_convert: 'PCS',
    lpn_serial_number: '',
    batch: '',
    vendor_batch: '',
    sloc: 'SL01',
    expired_date: '',
    destination_code: 'DST-INV',
    qc_code: 'QC-PASS',
    user_tally: currentUser?.nama || 'Tally Inventory',
    shelf_life: '24 Bulan',
    source: 'Stok Gudang',
    user_input: currentUser?.nama || 'Admin',
    status: 'Ada',
    note: '',
    tujuan: 'Stok Inventory Gudang'
  });

  const [barangSearchText, setBarangSearchText] = useState('');
  const [isBarangDropdownOpen, setIsBarangDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const barangContainerRef = useRef<HTMLDivElement>(null);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setFormData({ ...itemToEdit });
        setBarangSearchText(itemToEdit.item_code ? `${itemToEdit.item_code} - ${itemToEdit.item_name}` : '');
      } else {
        const nowIso = new Date().toISOString();
        const dateStr = nowIso.slice(0, 10).replace(/-/g, '');
        
        let maxSeq = 0;
        const prefixRegex = new RegExp(`^INV-${dateStr}-(\\d+)$`, 'i');
        for (const item of existingItems) {
          const match = (item.id_inventory || '').match(prefixRegex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
        const nextId = `INV-${dateStr}-${String(maxSeq + 1).padStart(4, '0')}`;

        setFormData({
          id_inventory: nextId,
          item_code: '',
          item_name: '',
          category: 'Finished Good',
          location: 'WH-INV-01',
          location_type: 'Rack',
          first_qty: 1,
          last_qty: 1,
          uom: 'CTN',
          qty_convert: 24,
          uom_convert: 'PCS',
          lpn_serial_number: `LPN-${nextId}`,
          batch: '',
          vendor_batch: '',
          sloc: 'SL01',
          expired_date: '',
          destination_code: 'DST-INV',
          qc_code: 'QC-PASS',
          user_tally: currentUser?.nama || 'Tally Inventory',
          shelf_life: '24 Bulan',
          source: 'Stok Gudang',
          user_input: currentUser?.nama || 'Admin',
          status: 'Ada',
          note: '',
          tujuan: 'Stok Inventory Gudang'
        });
        setBarangSearchText('');
      }
    }
  }, [isOpen, itemToEdit, existingItems, currentUser]);

  // Click outside to close master barang dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barangContainerRef.current && !barangContainerRef.current.contains(e.target as Node)) {
        setIsBarangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filter master barang
  const filteredBarangList = fuzzySearchDataBarang(barangList, barangSearchText).slice(0, 15);

  const handleSelectBarang = (barang: DataBarang) => {
    setFormData(prev => ({
      ...prev,
      item_code: barang.item_code,
      item_name: barang.item_name
    }));
    setBarangSearchText(`${barang.item_code} - ${barang.item_name}`);
    setIsBarangDropdownOpen(false);
  };

  const handleBatchChange = (batchVal: string) => {
    const cleanBatch = batchVal.trim();
    let calculatedEd = '';
    if (cleanBatch.length >= 4) {
      const edResult = getEdIsoDateString(formData.item_code || '', formData.item_name || '', cleanBatch);
      if (edResult?.isoDate) calculatedEd = edResult.isoDate;
    }

    setFormData(prev => ({
      ...prev,
      batch: batchVal,
      expired_date: calculatedEd || prev.expired_date || ''
    }));
  };

  const handleLastQtyChange = (qtyVal: number) => {
    const uom = formData.uom || 'CTN';
    const convert = uom === 'CTN' ? qtyVal * 24 : qtyVal;
    setFormData(prev => ({
      ...prev,
      last_qty: qtyVal,
      qty_convert: convert
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_code || !formData.item_name) {
      showToast('Data Belum Lengkap', 'Silakan pilih Master SKU atau isi Kode dan Nama Barang!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: InventoryItem = {
        id_inventory: formData.id_inventory || `INV-${Date.now()}`,
        item_code: formData.item_code,
        item_name: formData.item_name,
        category: formData.category || 'Finished Good',
        location: formData.location || 'WH-INV-01',
        location_type: formData.location_type || 'Rack',
        first_qty: Number(formData.first_qty || 0),
        last_qty: Number(formData.last_qty || 0),
        uom: formData.uom || 'CTN',
        qty_convert: Number(formData.qty_convert || 0),
        uom_convert: formData.uom_convert || 'PCS',
        lpn_serial_number: formData.lpn_serial_number || '',
        batch: formData.batch || '',
        vendor_batch: formData.vendor_batch || '',
        sloc: formData.sloc || 'SL01',
        expired_date: formData.expired_date || '',
        destination_code: formData.destination_code || 'DST-INV',
        qc_code: formData.qc_code || 'QC-PASS',
        user_tally: formData.user_tally || 'Tally Inventory',
        shelf_life: formData.shelf_life || '24 Bulan',
        source: formData.source || 'Stok Gudang',
        user_input: formData.user_input || currentUser?.nama || 'Admin',
        status: formData.status || 'Ada',
        note: formData.note || '',
        tujuan: formData.tujuan || 'Stok Inventory Gudang',
        created_at: formData.created_at || nowIso,
        updated_at: nowIso
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving inventory:', err);
      showToast('Gagal Simpan', err.message || 'Terjadi kesalahan saat menyimpan data.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-teal-300">
              <Package size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight m-0">
                {isEdit ? 'Edit Data Inventory' : 'Tambah Data Inventory Baru'}
              </h3>
              <p className="text-[11px] text-teal-200 m-0 font-medium">
                Tabel Supabase: public.data_inventory
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Master SKU Autocomplete */}
          <div ref={barangContainerRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Cari Master SKU / Nama Barang <span className="text-rose-500">*</span>
              </label>
              {isBarangDropdownOpen && (
                <button
                  type="button"
                  onClick={() => setIsBarangDropdownOpen(false)}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                >
                  <X size={12} />
                  <span>Tutup</span>
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                value={barangSearchText}
                onChange={(e) => {
                  setBarangSearchText(e.target.value);
                  setIsBarangDropdownOpen(true);
                }}
                onFocus={() => setIsBarangDropdownOpen(true)}
                placeholder="Ketik SKU atau Nama Produk..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
              {barangSearchText && (
                <button
                  type="button"
                  onClick={() => {
                    setBarangSearchText('');
                    setFormData(prev => ({ ...prev, item_code: '', item_name: '' }));
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Hasil Pencarian Master Barang */}
            {isBarangDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredBarangList.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    Tidak ditemukan data barang yang sesuai
                  </div>
                ) : (
                  filteredBarangList.map((b) => (
                    <div
                      key={b.item_code}
                      onClick={() => handleSelectBarang(b)}
                      className="p-2 px-3 hover:bg-teal-50 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-teal-800">{b.item_code}</span>
                        <span className="ml-2 font-medium text-slate-800">{b.item_name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {b.barcode || '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Grid 2 Column Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Item Code / SKU</label>
              <input
                type="text"
                required
                value={formData.item_code || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, item_code: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Item Name / Deskripsi</label>
              <input
                type="text"
                required
                value={formData.item_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Lokasi & SLOC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Lokasi Gudang</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="misal: WH-INV-01"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Jenis Lokasi</label>
              <select
                value={formData.location_type || 'Rack'}
                onChange={(e) => setFormData(prev => ({ ...prev, location_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              >
                <option value="Rack">Rack</option>
                <option value="Floor">Floor</option>
                <option value="Bulk">Bulk</option>
                <option value="Staging">Staging</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Storage Loc (SLOC)</label>
              <input
                type="text"
                value={formData.sloc || 'SL01'}
                onChange={(e) => setFormData(prev => ({ ...prev, sloc: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Qty & UOM */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">First Qty</label>
              <input
                type="number"
                value={formData.first_qty ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, first_qty: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Last Qty (Fisik)</label>
              <input
                type="number"
                value={formData.last_qty ?? 0}
                onChange={(e) => handleLastQtyChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/50 text-xs font-mono font-black text-emerald-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Satuan (UOM)</label>
              <select
                value={formData.uom || 'CTN'}
                onChange={(e) => {
                  const uomVal = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    uom: uomVal,
                    qty_convert: uomVal === 'CTN' ? (prev.last_qty || 0) * 24 : (prev.last_qty || 0)
                  }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              >
                <option value="CTN">CTN (Karton)</option>
                <option value="PCS">PCS (Pieces)</option>
                <option value="BOX">BOX</option>
                <option value="PACK">PACK</option>
                <option value="DRUM">DRUM</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Qty Konversi (PCS)</label>
              <input
                type="number"
                value={formData.qty_convert ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, qty_convert: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-teal-300 bg-teal-50/50 text-xs font-mono font-black text-teal-900 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Batch & Expired Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Nomor Batch / Lot</label>
              <input
                type="text"
                value={formData.batch || ''}
                onChange={(e) => handleBatchChange(e.target.value)}
                placeholder="misal: 1234 atau LOT-99"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Masa Simpan (Shelf Life)</label>
              <select
                value={formData.shelf_life || '24 Bulan'}
                onChange={(e) => {
                  const sl = e.target.value;
                  setFormData(prev => ({ ...prev, shelf_life: sl }));
                  if (formData.batch) {
                    const edResult = getEdIsoDateString(formData.item_code || '', formData.item_name || '', formData.batch);
                    if (edResult?.isoDate) setFormData(prev => ({ ...prev, expired_date: edResult.isoDate }));
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              >
                <option value="12 Bulan">12 Bulan (1 Tahun)</option>
                <option value="24 Bulan">24 Bulan (2 Tahun)</option>
                <option value="3 Tahun">36 Bulan (3 Tahun)</option>
                <option value="4 Tahun">48 Bulan (4 Tahun)</option>
                <option value="5 Tahun">60 Bulan (5 Tahun)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Expired Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={formData.expired_date || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, expired_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Status, Note & Tujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Status Fisik</label>
              <select
                value={formData.status || 'Ada'}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-teal-300 bg-teal-50/40 text-xs font-bold text-teal-900 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              >
                <option value="Ada">Ada</option>
                <option value="Beda">Beda</option>
                <option value="Tidak">Tidak</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tujuan / Destinasi</label>
              <input
                type="text"
                value={formData.tujuan || 'Stok Inventory Gudang'}
                onChange={(e) => setFormData(prev => ({ ...prev, tujuan: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Catatan / Note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Catatan / Note</label>
            <textarea
              rows={2}
              value={formData.note || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Tambahkan catatan khusus untuk item inventory ini..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            />
          </div>

        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>{isEdit ? 'Perbarui Data' : 'Simpan Data'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
