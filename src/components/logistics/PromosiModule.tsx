import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  PackageCheck, Save, RefreshCw, Download, Upload, Trash2, Edit, 
  X, FileSpreadsheet, FileCheck, Database, FileText
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useNotification } from '../../context/NotificationContext';

export interface PromosiData {
  id: string;
  nomor: string;
  tgl_terima: string;
  material: string;
  pengirim: string;
  penerima: string;
  nopol: string;
  expedisi: string;
  keterangan: string;
  jumlah_ctn: number;
  jumlah_pcs: number;
  created_at?: string;
}

export function PromosiModule() {
  const { showToast, showConfirm } = useNotification();

  const [promosiList, setPromosiList] = useState<PromosiData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Preview state for Excel import before saving to database
  const [previewItems, setPreviewItems] = useState<PromosiData[] | null>(null);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    nomor: '',
    tgl_terima: new Date().toISOString().split('T')[0],
    material: '',
    pengirim: '',
    penerima: '',
    nopol: '',
    expedisi: '',
    jumlah_ctn: '' as string | number,
    jumlah_pcs: '' as string | number,
    keterangan: ''
  });

  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper to parse any date format (Excel serial numbers, DD/MM/YYYY, JS Date, etc) to YYYY-MM-DD for PostgreSQL DATE column
  const formatDateToYYYYMMDD = (val: any): string => {
    if (val === null || val === undefined || val === '') {
      return getTodayDate();
    }

    // 1. Handle JS Date object
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return getTodayDate();
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // 2. Handle Excel date serial number (e.g., 45123 or "45123")
    const num = Number(val);
    if (!isNaN(num) && num > 20000 && num < 60000) {
      try {
        const dateObj = XLSX.SSF.parse_date_code(num);
        if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
          const yyyy = dateObj.y;
          const mm = String(dateObj.m).padStart(2, '0');
          const dd = String(dateObj.d).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      } catch (e) {
        // Fallback
      }
    }

    const str = String(val).trim();

    // 3. YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
      const parts = str.split(/[-/]/);
      const yyyy = parts[0];
      const mm = parts[1].padStart(2, '0');
      const dd = parts[2].substring(0, 2).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // 4. DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
      const parts = str.split(/[-/]/);
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2].substring(0, 4);
      return `${yyyy}-${mm}-${dd}`;
    }

    // 5. Native JS Date parse
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return getTodayDate();
  };

  // Helper to extract value from Excel row regardless of column name casing or spaces
  const getRowVal = (row: Record<string, any>, keys: string[]): any => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return row[k];
      }
    }
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return row[foundKey];
      }
    }
    return undefined;
  };

  const generateNomorPlaceholder = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    return `PRM-${yyyy}-${rand}`;
  };

  const fetchPromosiData = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('promosi')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase order fetch note:', error.message);
        // Fallback fetch without order in case created_at column is missing
        const retry = await supabase.from('promosi').select('*');
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        console.warn('Supabase fetch error for promosi:', error.message);
      } else if (data) {
        const mappedData: PromosiData[] = data.map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          nomor: item.nomor || item.Nomor || '',
          tgl_terima: formatDateToYYYYMMDD(item.tgl_terima || item.tglTerima || item['Tgl Terima']),
          material: item.material || item.Material || '',
          pengirim: item.pengirim || item.Pengirim || '',
          penerima: item.penerima || item.Penerima || '',
          nopol: item.nopol || item.Nopol || '',
          expedisi: item.expedisi || item.Expedisi || '',
          jumlah_ctn: Number(item.jumlah_ctn ?? item.jumlahCtn ?? item['Jumlah CTN'] ?? 0),
          jumlah_pcs: Number(item.jumlah_pcs ?? item.jumlahPcs ?? item['Jumlah PCS'] ?? 0),
          keterangan: item.keterangan || item.Keterangan || '',
          created_at: item.created_at
        }));
        setPromosiList(mappedData);
      }
    } catch (e) {
      console.error('Error loading promosi data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromosiData();
    setFormData(prev => ({
      ...prev,
      nomor: generateNomorPlaceholder(),
      tgl_terima: getTodayDate()
    }));

    const channel = supabase
      .channel('promosi_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promosi' }, () => {
        fetchPromosiData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nomor: generateNomorPlaceholder(),
      tgl_terima: getTodayDate(),
      material: '',
      pengirim: '',
      penerima: '',
      nopol: '',
      expedisi: '',
      jumlah_ctn: '',
      jumlah_pcs: '',
      keterangan: ''
    });
  };

  const handleCancelEdit = () => {
    resetForm();
    showToast('Batal Edit', 'Mode pengeditan dibatalkan', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nomor || !formData.tgl_terima || !formData.material) {
      showToast('Peringatan', 'Nomor, Tgl Terima, dan Material wajib diisi', 'danger');
      return;
    }

    const payload = {
      nomor: formData.nomor,
      tgl_terima: formData.tgl_terima,
      material: formData.material,
      pengirim: formData.pengirim,
      penerima: formData.penerima,
      nopol: formData.nopol,
      expedisi: formData.expedisi,
      jumlah_ctn: Number(formData.jumlah_ctn) || 0,
      jumlah_pcs: Number(formData.jumlah_pcs) || 0,
      keterangan: formData.keterangan
    };

    if (editingId) {
      const dbUpdatePayload = {
        nomor: formData.nomor,
        tgl_terima: formatDateToYYYYMMDD(formData.tgl_terima),
        material: formData.material,
        pengirim: formData.pengirim || '',
        penerima: formData.penerima || '',
        nopol: formData.nopol || '',
        expedisi: formData.expedisi || '',
        jumlah_ctn: Number(formData.jumlah_ctn) || 0,
        jumlah_pcs: Number(formData.jumlah_pcs) || 0,
        keterangan: formData.keterangan || ''
      };

      const updatedList = promosiList.map(item => item.id === editingId ? { ...item, ...dbUpdatePayload } : item);
      setPromosiList(updatedList);

      try {
        let { error } = await supabase.from('promosi').update(dbUpdatePayload).eq('id', editingId);
        if (error) {
          // Fallback to update by nomor if id mismatch or invalid uuid
          const fallbackRes = await supabase.from('promosi').update(dbUpdatePayload).eq('nomor', formData.nomor);
          error = fallbackRes.error;
        }

        if (error) {
          console.error('Supabase update error:', error.message);
          showToast('Peringatan Database', `Data tersimpan di browser, tetapi gagal di Supabase: ${error.message}`, 'danger');
        } else {
          showToast('Berhasil', 'Data penerimaan barang promosi berhasil diperbarui di Database', 'success');
          fetchPromosiData();
        }
      } catch (e: any) {
        showToast('Berhasil', 'Data diperbarui di penyimpanan lokal', 'success');
      }
    } else {
      const newId = crypto.randomUUID();
      const dbInsertPayload = {
        id: newId,
        nomor: formData.nomor,
        tgl_terima: formatDateToYYYYMMDD(formData.tgl_terima),
        material: formData.material,
        pengirim: formData.pengirim || '',
        penerima: formData.penerima || '',
        nopol: formData.nopol || '',
        expedisi: formData.expedisi || '',
        jumlah_ctn: Number(formData.jumlah_ctn) || 0,
        jumlah_pcs: Number(formData.jumlah_pcs) || 0,
        keterangan: formData.keterangan || ''
      };

      const newItem: PromosiData = {
        ...dbInsertPayload,
        created_at: new Date().toISOString()
      };

      const updatedList = [newItem, ...promosiList];
      setPromosiList(updatedList);

      try {
        const { error } = await supabase.from('promosi').insert([dbInsertPayload]);
        if (error) {
          console.error('Supabase insert error:', error.message);
          showToast('Peringatan Database', `Tersimpan di browser, gagal di Supabase: ${error.message}`, 'danger');
        } else {
          showToast('Berhasil', 'Data penerimaan berhasil disimpan ke Database', 'success');
          fetchPromosiData();
        }
      } catch (e: any) {
        showToast('Berhasil', 'Data penerimaan disimpan di lokal', 'success');
      }
    }

    resetForm();
  };

  const handleEdit = (item: PromosiData) => {
    setEditingId(item.id);
    setFormData({
      nomor: item.nomor || '',
      tgl_terima: item.tgl_terima || getTodayDate(),
      material: item.material || '',
      pengirim: item.pengirim || '',
      penerima: item.penerima || '',
      nopol: item.nopol || '',
      expedisi: item.expedisi || '',
      jumlah_ctn: item.jumlah_ctn ?? '',
      jumlah_pcs: item.jumlah_pcs ?? '',
      keterangan: item.keterangan || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Mode Edit', `Mengedit data penerimaan nomor ${item.nomor}`, 'info');
  };

  const handleDelete = (id: string) => {
    showConfirm({
      title: 'Hapus Data Penerimaan',
      message: 'Yakin ingin menghapus data penerimaan ini dari Database?',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const itemToDelete = promosiList.find(item => item.id === id);
        const updated = promosiList.filter(item => item.id !== id);
        setPromosiList(updated);

        try {
          let { error } = await supabase.from('promosi').delete().eq('id', id);
          if (error && itemToDelete?.nomor) {
            // Fallback delete by nomor if id was invalid uuid or mismatched
            const fallbackRes = await supabase.from('promosi').delete().eq('nomor', itemToDelete.nomor);
            error = fallbackRes.error;
          }

          if (error) {
            console.warn('Supabase delete warning:', error.message);
            showToast('Peringatan', `Terhapus lokal, catatan Supabase: ${error.message}`, 'info');
          } else {
            showToast('Berhasil', 'Data penerimaan berhasil dihapus dari Database', 'success');
            fetchPromosiData();
          }
        } catch (e) {
          showToast('Berhasil', 'Data dihapus dari penyimpanan lokal', 'info');
        }
      }
    });
  };

  // 1. DOWNLOAD TEMPLATE EXCEL ACCORDING TO DATABASE STRUCTURE
  const downloadDatabaseTemplate = () => {
    const templateRows = [
      {
        "Nomor": "PRM-2026-001",
        "Tgl Terima": getTodayDate(),
        "Material": "SPINNER KINO BRANDED 2026",
        "Pengirim": "PT MEDIA PROMOSI INDONESIA",
        "Penerima": "LOGISTICS WAREHOUSE",
        "Nopol": "B 9876 CKB",
        "Expedisi": "EXPEDISI UTAMA",
        "Jumlah CTN": 50,
        "Jumlah PCS": 2000,
        "Keterangan": "Kondisi Segel Utuh"
      },
      {
        "Nomor": "PRM-2026-002",
        "Tgl Terima": getTodayDate(),
        "Material": "SPANDUK PROMO DISKON SAMANTHA 3X1M",
        "Pengirim": "CV GRAPHIC CREATIVE",
        "Penerima": "LOGISTICS WAREHOUSE",
        "Nopol": "B 1234 XYZ",
        "Expedisi": "JNE CARGO",
        "Jumlah CTN": 10,
        "Jumlah PCS": 500,
        "Keterangan": "Kondisi Baik"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Promosi DB');
    XLSX.writeFile(wb, 'Template_Impor_Penerimaan_Promosi.xlsx');
    showToast('Download Sukses', 'Template Excel struktur Database berhasil diunduh', 'success');
  };

  // 2. DOWNLOAD CURRENT DATA TO EXCEL
  const downloadExcel = () => {
    if (promosiList.length === 0) {
      showToast('Info', 'Tidak ada data penerimaan untuk diunduh', 'info');
      return;
    }

    const rows = promosiList.map(r => ({
      "Nomor": r.nomor,
      "Tgl Terima": r.tgl_terima,
      "Material": r.material,
      "Pengirim": r.pengirim,
      "Penerima": r.penerima,
      "Nopol": r.nopol,
      "Expedisi": r.expedisi,
      "Jumlah CTN": r.jumlah_ctn,
      "Jumlah PCS": r.jumlah_pcs,
      "Keterangan": r.keterangan
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Penerimaan');
    XLSX.writeFile(wb, 'Data_Penerimaan_Promosi.xlsx');
    showToast('Sukses', 'File Data_Penerimaan_Promosi.xlsx berhasil diunduh', 'success');
  };

  // 3. UPLOAD EXCEL & PARSE FOR PREVIEW BEFORE SAVING TO DATABASE
  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

        if (rows.length === 0) {
          showToast('Peringatan', 'File Excel kosong atau tidak terbaca', 'danger');
          return;
        }

        const parsedItems: PromosiData[] = rows.map((r, idx) => {
          const rawNomor = getRowVal(r, ['Nomor', 'nomor', 'NO', 'No', 'no', 'No.']);
          const rawTgl = getRowVal(r, ['Tgl Terima', 'tgl_terima', 'Tanggal', 'TGL TERIMA', 'Tgl', 'Date']);
          const rawMaterial = getRowVal(r, ['Material', 'material', 'MATERIAL', 'Barang', 'Nama Barang']);
          const rawPengirim = getRowVal(r, ['Pengirim', 'pengirim', 'PENGIRIM']);
          const rawPenerima = getRowVal(r, ['Penerima', 'penerima', 'PENERIMA']);
          const rawNopol = getRowVal(r, ['Nopol', 'nopol', 'NOPOL', 'No. Pol', 'No Polisi']);
          const rawExpedisi = getRowVal(r, ['Expedisi', 'expedisi', 'EXPEDISI', 'Ekspedisi']);
          const rawCtn = getRowVal(r, ['Jumlah CTN', 'jumlah_ctn', 'CTN', 'Ctn', 'Karton']);
          const rawPcs = getRowVal(r, ['Jumlah PCS', 'jumlah_pcs', 'PCS', 'Pcs']);
          const rawKet = getRowVal(r, ['Keterangan', 'keterangan', 'KETERANGAN', 'Ket', 'Catatan']);

          return {
            id: crypto.randomUUID(),
            nomor: String(rawNomor || `PRM-${new Date().getFullYear()}-${idx + 100}`).trim(),
            tgl_terima: formatDateToYYYYMMDD(rawTgl),
            material: String(rawMaterial || 'Material Promosi').trim(),
            pengirim: String(rawPengirim || '').trim(),
            penerima: String(rawPenerima || '').trim(),
            nopol: String(rawNopol || '').trim(),
            expedisi: String(rawExpedisi || '').trim(),
            jumlah_ctn: Number(rawCtn) || 0,
            jumlah_pcs: Number(rawPcs) || 0,
            keterangan: String(rawKet || '').trim(),
            created_at: new Date().toISOString()
          };
        });

        setPreviewItems(parsedItems);
        showToast('File Dibaca', `Ditemukan ${parsedItems.length} baris data. Silakan klik "Simpan Ke Database"`, 'info');
      } catch (err) {
        console.error('Failed reading Excel:', err);
        showToast('Gagal Impor', 'Gagal membaca file Excel. Pastikan menggunakan format template yang benar.', 'danger');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 4. EXPLICIT BATCH SAVE PREVIEW ITEMS TO SUPABASE DATABASE
  const handleSavePreviewToDatabase = async () => {
    if (!previewItems || previewItems.length === 0) return;

    setSavingBatch(true);
    try {
      const dbPayload = previewItems.map(item => ({
        id: item.id,
        nomor: item.nomor,
        tgl_terima: formatDateToYYYYMMDD(item.tgl_terima),
        material: item.material,
        pengirim: item.pengirim || '',
        penerima: item.penerima || '',
        nopol: item.nopol || '',
        expedisi: item.expedisi || '',
        jumlah_ctn: Number(item.jumlah_ctn) || 0,
        jumlah_pcs: Number(item.jumlah_pcs) || 0,
        keterangan: item.keterangan || ''
      }));

      const { error } = await supabase.from('promosi').insert(dbPayload);

      if (error) {
        console.error('Supabase batch insert error:', error);
        showToast('Gagal Simpan DB', `Gagal menyimpan ke Database Supabase: ${error.message}`, 'danger');
      } else {
        showToast('Sukses Database', `${previewItems.length} data barang promosi berhasil disimpan penuh ke Database Supabase!`, 'success');
        setPreviewItems(null);
        fetchPromosiData();
      }
    } catch (e: any) {
      console.error(e);
      showToast('Error', e?.message || 'Gagal menyimpan ke database', 'danger');
    } finally {
      setSavingBatch(false);
    }
  };

  const formatNumber = (val: number | string) => {
    return (Number(val) || 0).toLocaleString('id-ID');
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* HEADER TITLE */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight m-0 flex items-center gap-2">
            <PackageCheck size={24} className="text-blue-600" />
            <span>Penerimaan Barang Promosi</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold m-0 mt-1">
            Form &amp; Data Penerimaan Barang Promosi Gudang
          </p>
        </div>

        {/* PROMINENT TOP TEMPLATE & EXCEL ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadDatabaseTemplate}
            className="hidden lg:flex px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer items-center gap-2 shadow-md hover:shadow-indigo-600/30"
            title="Unduh file template Excel sesuai struktur database"
          >
            <FileSpreadsheet size={16} />
            <span>Download Template Excel</span>
          </button>
        </div>
      </div>

      {/* PREVIEW BANNER & SAVE TO DATABASE MODAL/BAR IF EXCEL UPLOADED */}
      {previewItems && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 sm:p-5 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Database size={20} className="text-amber-700 shrink-0" />
              <div>
                <h3 className="text-sm font-black text-amber-900 m-0 uppercase">
                  Pratinjau Impor File Excel ({previewItems.length} Data)
                </h3>
                <p className="text-xs text-amber-700 font-semibold m-0">
                  Data berikut belum masuk database. Klik tombol "Simpan Ke Database" di sebelah kanan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewItems(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <X size={14} />
                <span>Batal</span>
              </button>

              <button
                onClick={handleSavePreviewToDatabase}
                disabled={savingBatch}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save size={16} className={savingBatch ? 'animate-spin' : ''} />
                <span>{savingBatch ? 'Menyimpan...' : `Simpan ${previewItems.length} Data Ke Database`}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[220px] overflow-y-auto border border-amber-200 rounded-lg bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-amber-100/70 text-amber-900 font-extrabold uppercase sticky top-0">
                <tr>
                  <th className="p-2">Nomor</th>
                  <th className="p-2">Tgl Terima</th>
                  <th className="p-2">Material</th>
                  <th className="p-2">Pengirim</th>
                  <th className="p-2">Penerima</th>
                  <th className="p-2">Nopol</th>
                  <th className="p-2">Expedisi</th>
                  <th className="p-2 text-right">CTN</th>
                  <th className="p-2 text-right">PCS</th>
                  <th className="p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {previewItems.map((r, i) => (
                  <tr key={i} className="hover:bg-amber-50/50">
                    <td className="p-2 font-mono font-bold text-amber-800">{r.nomor}</td>
                    <td className="p-2">{r.tgl_terima}</td>
                    <td className="p-2 font-bold">{r.material}</td>
                    <td className="p-2">{r.pengirim || '-'}</td>
                    <td className="p-2">{r.penerima || '-'}</td>
                    <td className="p-2 font-mono">{r.nopol || '-'}</td>
                    <td className="p-2">{r.expedisi || '-'}</td>
                    <td className="p-2 text-right font-bold">{formatNumber(r.jumlah_ctn)}</td>
                    <td className="p-2 text-right font-bold">{formatNumber(r.jumlah_pcs)}</td>
                    <td className="p-2 text-slate-500">{r.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM INPUT SECTION (CARD SECTION) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-slate-900 uppercase m-0 flex items-center gap-2">
            <Edit size={18} className="text-blue-600" />
            <span>{editingId ? 'Edit Penerimaan Barang Promosi' : 'Form Penerimaan Barang Promosi'}</span>
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <X size={14} />
              <span>Batal Edit</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ROW 1: GRID 3 COLS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Nomor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nomor}
                onChange={(e) => setFormData({ ...formData, nomor: e.target.value })}
                placeholder="Contoh: PRM-001"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Tgl Terima <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tgl_terima}
                onChange={(e) => setFormData({ ...formData, tgl_terima: e.target.value })}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Material <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                placeholder="Nama/deskripsi material"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          {/* ROW 2: GRID 4 COLS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Pengirim
              </label>
              <input
                type="text"
                value={formData.pengirim}
                onChange={(e) => setFormData({ ...formData, pengirim: e.target.value })}
                placeholder="Nama pengirim"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Penerima
              </label>
              <input
                type="text"
                value={formData.penerima}
                onChange={(e) => setFormData({ ...formData, penerima: e.target.value })}
                placeholder="Nama penerima"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Nopol Kendaraan
              </label>
              <input
                type="text"
                value={formData.nopol}
                onChange={(e) => setFormData({ ...formData, nopol: e.target.value })}
                placeholder="Contoh: B 1234 AB"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Expedisi
              </label>
              <input
                type="text"
                value={formData.expedisi}
                onChange={(e) => setFormData({ ...formData, expedisi: e.target.value })}
                placeholder="Nama expedisi"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          {/* ROW 3: GRID 3 COLS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Jumlah CTN
              </label>
              <input
                type="number"
                min="0"
                value={formData.jumlah_ctn}
                onChange={(e) => setFormData({ ...formData, jumlah_ctn: e.target.value })}
                placeholder="0"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Jumlah PCS
              </label>
              <input
                type="number"
                min="0"
                value={formData.jumlah_pcs}
                onChange={(e) => setFormData({ ...formData, jumlah_pcs: e.target.value })}
                placeholder="0"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Keterangan
              </label>
              <input
                type="text"
                value={formData.keterangan}
                onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                placeholder="Catatan tambahan"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-lg text-xs font-extrabold text-white shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                editingId
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
              }`}
            >
              <Save size={16} />
              <span>{editingId ? 'Update Data' : 'Simpan Data'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* TABLE DATA SECTION (CARD SECTION) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase m-0">
              Data Barang Diterima
            </h2>
            <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
              Database Supabase (Tabel: promosi)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchPromosiData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Refresh data dari database"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {/* BUTTON 1: DOWNLOAD TEMPLATE EXCEL (Tampil di Desktop) */}
            <button
              onClick={downloadDatabaseTemplate}
              className="hidden lg:flex px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all cursor-pointer items-center gap-1.5 shadow-xs"
              title="Unduh Template Excel sesuai struktur Database"
            >
              <FileSpreadsheet size={14} />
              <span>Download Template</span>
            </button>

            {/* BUTTON 2: DOWNLOAD EXCEL (Tampil di Desktop) */}
            <button
              onClick={downloadExcel}
              className="hidden lg:flex px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all cursor-pointer items-center gap-1.5 shadow-xs"
              title="Unduh semua data penerimaan ke file Excel"
            >
              <Download size={14} />
              <span>Download Excel</span>
            </button>

            {/* BUTTON 3: UPLOAD EXCEL (Tampil di Desktop) */}
            <label className="hidden lg:flex px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold transition-all cursor-pointer items-center gap-1.5 shadow-xs">
              <Upload size={14} />
              <span>Upload Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* MAIN DATA TABLE */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Nomor</th>
                <th className="p-3">Tgl Terima</th>
                <th className="p-3">Material</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Penerima</th>
                <th className="p-3">Nopol</th>
                <th className="p-3">Expedisi</th>
                <th className="p-3 text-right">CTN</th>
                <th className="p-3 text-right">PCS</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right min-w-[90px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500 font-semibold">
                    <RefreshCw size={20} className="animate-spin inline-block mr-2 text-blue-600" />
                    Memuat data penerimaan dari Supabase...
                  </td>
                </tr>
              ) : promosiList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-bold">
                    Belum ada data penerimaan barang promosi.
                  </td>
                </tr>
              ) : (
                promosiList.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-orange-600 whitespace-nowrap">
                      {row.nomor}
                    </td>
                    <td className="p-3 whitespace-nowrap">{row.tgl_terima}</td>
                    <td className="p-3 font-semibold text-slate-900 max-w-[180px] truncate" title={row.material}>
                      {row.material}
                    </td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{row.pengirim || '-'}</td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{row.penerima || '-'}</td>
                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{row.nopol || '-'}</td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{row.expedisi || '-'}</td>
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                      {formatNumber(row.jumlah_ctn)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                      {formatNumber(row.jumlah_pcs)}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[150px] truncate" title={row.keterangan}>
                      {row.keterangan || '-'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1.5 rounded-md bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 cursor-pointer transition-all shadow-2xs"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 rounded-md bg-white hover:bg-red-50 border border-slate-200 text-slate-700 hover:text-red-600 cursor-pointer transition-all shadow-2xs"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
