import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { 
  FileText, Plus, Search, Printer, Edit, Trash2, Save, Download, Upload, 
  RefreshCw, ChevronLeft, Building2, User, Phone, MapPin, CheckCircle2, 
  Settings, Layers, ListFilter, FileSpreadsheet, ArrowLeft, PlusCircle,
  Database, FolderCheck, Eye, X, Sparkles, Calendar
} from 'lucide-react';
import { supabase, fetchAllRowsFromSupabase } from '../../supabase';
import { useNotification } from '../../context/NotificationContext';

const KINO_LOGO_URL = 'https://res.cloudinary.com/dedtb3vnj/image/upload/v1782568576/kino_yrhkmc.png';

export interface DocumentItem {
  id?: string;
  doc_id?: string;
  rekapNo: number;
  namaBarang: string;
  ctn: number | string;
  pcs: number | string;
  berat: number | string;
  kubikasi: number | string;
  keterangan: string;
}

export interface DocumentSJ {
  id: string;
  nomorSJ: string;
  jenisId: string;
  tanggal: string;
  tujuanId: string;
  up: string;
  noTelpon: string;
  items: DocumentItem[];
  created_at?: string;
}

export interface JenisSJ {
  id: string;
  kode: string;
  nama: string;
}

export interface Tujuan {
  id: string;
  nama: string;
  alamat: string;
  kota: string;
  up: string;
  noTelpon: string;
}

export interface Pengirim {
  nama: string;
  alamat: string;
  kotaKab: string;
  telp: string;
}

export interface SavedRekapSJ {
  id: string;
  judul: string;
  tanggal_rekap?: string;
  total_sj?: number;
  total_item?: number;
  total_ctn?: number;
  total_pcs?: number;
  total_berat?: number;
  total_kubikasi?: number;
  data_detail: any[];
  keterangan?: string;
  created_at?: string;
}

type SJSubTab = 'dashboard' | 'form' | 'rekap' | 'settings' | 'print';

export function SuratJalanModule() {
  const { showToast, showConfirm } = useNotification();

  const [activeTab, setActiveTab] = useState<SJSubTab>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);

  // Saved Rekap State
  const [savedRekapList, setSavedRekapList] = useState<SavedRekapSJ[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [rekapTitleInput, setRekapTitleInput] = useState<string>('');
  const [savingRekap, setSavingRekap] = useState<boolean>(false);
  const [viewSavedRekap, setViewSavedRekap] = useState<SavedRekapSJ | null>(null);
  const [showHistorySection, setShowHistorySection] = useState<boolean>(false);

  // Master Data
  const [documents, setDocuments] = useState<DocumentSJ[]>([]);
  const [jenisList, setJenisList] = useState<JenisSJ[]>([
    { id: 'jenis-1', kode: 'CKB', nama: 'SURAT JALAN CKB' }
  ]);
  const [tujuanList, setTujuanList] = useState<Tujuan[]>([]);
  const [pengirim, setPengirim] = useState<Pengirim>({
    nama: '',
    alamat: '',
    kotaKab: '',
    telp: ''
  });

  // Filter States
  const [dashSearch, setDashSearch] = useState<string>('');
  const [dashFilterJenis, setDashFilterJenis] = useState<string>('');

  // Form State
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    docId: string | null;
    nomorSJ: string;
    jenisId: string;
    tanggal: string;
    tujuanId: string;
    up: string;
    noTelpon: string;
    items: DocumentItem[];
  }>({
    docId: null,
    nomorSJ: '',
    jenisId: 'jenis-1',
    tanggal: new Date().toISOString().split('T')[0],
    tujuanId: '',
    up: '',
    noTelpon: '',
    items: [{ rekapNo: 1, namaBarang: '', ctn: '', pcs: '', berat: '', kubikasi: '', keterangan: '' }]
  });

  const [formMode, setFormMode] = useState<'manual' | 'tempel' | 'impor'>('manual');
  const [pasteSubMode, setPasteSubMode] = useState<'all' | 'column'>('all');
  const [pasteTargetCol, setPasteTargetCol] = useState<keyof DocumentItem>('namaBarang');
  const [pasteTextArea, setPasteTextArea] = useState<string>('');
  const [quickAddTujuanOpen, setQuickAddTujuanOpen] = useState<boolean>(false);
  const [quickAddForm, setQuickAddForm] = useState({ nama: '', kota: '', alamat: '', up: '', telp: '' });

  // Print State
  const [printDoc, setPrintDoc] = useState<DocumentSJ | null>(null);
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4');

  // Rekap Filter State
  const [rekapSearch, setRekapSearch] = useState<string>('');
  const [rekapFilterSJ, setRekapFilterSJ] = useState<string>('');
  const [rekapFilterBarang, setRekapFilterBarang] = useState<string>('');

  // Master Jenis & Tujuan Modals State
  const [showJenisModal, setShowJenisModal] = useState<boolean>(false);
  const [editingJenisId, setEditingJenisId] = useState<string | null>(null);
  const [jenisForm, setJenisForm] = useState<{ kode: string; nama: string }>({ kode: '', nama: '' });

  const [showTujuanModal, setShowTujuanModal] = useState<boolean>(false);
  const [editingTujuanId, setEditingTujuanId] = useState<string | null>(null);
  const [tujuanForm, setTujuanForm] = useState<{ nama: string; alamat: string; kota: string; up: string; noTelpon: string }>({
    nama: '',
    alamat: '',
    kota: '',
    up: '',
    noTelpon: ''
  });

  // Fetch all data from Supabase or localStorage fallback
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Documents & Items separately to ensure reliable joins without 1000 limit
      const [docsData, itemsData] = await Promise.all([
        fetchAllRowsFromSupabase('documents', { orderBy: 'created_at', ascending: false }),
        fetchAllRowsFromSupabase('items')
      ]);

      if (docsData && docsData.length > 0) {
        const mappedDocs: DocumentSJ[] = docsData.map((d: any) => {
          const matchedItems = (itemsData || []).filter((it: any) => it.doc_id === d.id);
          return {
            id: d.id,
            nomorSJ: d.nomor_sj || d.nomorSJ || '',
            jenisId: d.jenis_id || d.jenisId || 'jenis-1',
            tanggal: d.tanggal || new Date().toISOString().split('T')[0],
            tujuanId: d.tujuan_id || d.tujuanId || '',
            up: d.up || '',
            noTelpon: d.no_telpon || d.noTelpon || '',
            items: matchedItems.map((it: any) => ({
              id: it.id,
              doc_id: it.doc_id,
              rekapNo: Number(it.rekap_no ?? it.rekapNo ?? 1),
              namaBarang: it.nama_barang || it.namaBarang || '',
              ctn: Number(it.ctn) || 0,
              pcs: Number(it.pcs) || 0,
              berat: Number(it.berat) || 0,
              kubikasi: Number(it.kubikasi) || 0,
              keterangan: it.keterangan || ''
            }))
          };
        });
        setDocuments(mappedDocs);
      }

      // 2. Fetch Jenis
      const { data: jenisData } = await supabase.from('jenis').select('*');
      if (jenisData && jenisData.length > 0) {
        setJenisList(jenisData as JenisSJ[]);
      }

      // 3. Fetch Tujuan
      const { data: tujuanData } = await supabase.from('tujuan').select('*');
      if (tujuanData) {
        setTujuanList(tujuanData.map((t: any) => ({
          id: t.id,
          nama: t.nama || '',
          alamat: t.alamat || '',
          kota: t.kota || '',
          up: t.up || '',
          noTelpon: t.no_telpon || t.noTelpon || ''
        })));
      }

      // 4. Fetch Pengirim
      const { data: pengirimData } = await supabase.from('pengirim').select('*').limit(1).single();
      if (pengirimData) {
        setPengirim({
          nama: pengirimData.nama || '',
          alamat: pengirimData.alamat || '',
          kotaKab: pengirimData.kota_kab || pengirimData.kotaKab || '',
          telp: pengirimData.telp || ''
        });
      }

      // 5. Fetch Rekapan SJ
      try {
        const { data: rekapData, error: rekapErr } = await supabase
          .from('rekapan_sj')
          .select('*')
          .order('created_at', { ascending: false });

        if (!rekapErr && rekapData) {
          setSavedRekapList(rekapData as SavedRekapSJ[]);
        }
      } catch (e) {
        console.error('Error fetching rekapan_sj:', e);
      }
    } catch (e) {
      console.error('Error fetching SJ data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('surat_jalan_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jenis' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tujuan' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengirim' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rekapan_sj' }, () => fetchAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Generate Nomor SJ Auto Preview
  const generateNomorSJ = (jenisIdParam?: string, tanggalParam?: string) => {
    const jId = jenisIdParam || formState.jenisId;
    const selectedJenis = jenisList.find(j => j.id === jId) || jenisList[0];
    const kodeJenis = selectedJenis ? selectedJenis.kode : 'CKB';

    const tglStr = tanggalParam || formState.tanggal || new Date().toISOString().split('T')[0];
    const d = new Date(tglStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');

    const nextUrut = documents.length + 1;
    const urutPadded = String(nextUrut).padStart(4, '0');

    return `WH-CKB/${kodeJenis}/${yyyy}/${mm}/${urutPadded}`;
  };

  // Open Form for Creation
  const handleOpenNewForm = () => {
    setEditDocId(null);
    const initialNomor = generateNomorSJ(jenisList[0]?.id, new Date().toISOString().split('T')[0]);
    setFormState({
      docId: null,
      nomorSJ: initialNomor,
      jenisId: jenisList[0]?.id || 'jenis-1',
      tanggal: new Date().toISOString().split('T')[0],
      tujuanId: tujuanList[0]?.id || '',
      up: tujuanList[0]?.up || '',
      noTelpon: tujuanList[0]?.noTelpon || '',
      items: [{ rekapNo: 1, namaBarang: '', ctn: '', pcs: '', berat: '', kubikasi: '', keterangan: '' }]
    });
    setActiveTab('form');
  };

  // Open Form for Edit
  const handleOpenEditForm = (doc: DocumentSJ) => {
    setEditDocId(doc.id);
    setFormState({
      docId: doc.id,
      nomorSJ: doc.nomorSJ,
      jenisId: doc.jenisId,
      tanggal: doc.tanggal,
      tujuanId: doc.tujuanId,
      up: doc.up,
      noTelpon: doc.noTelpon,
      items: doc.items.map(it => ({ ...it }))
    });
    setActiveTab('form');
  };

  // Select Tujuan Handler
  const handleTujuanSelect = (tId: string) => {
    const sel = tujuanList.find(t => t.id === tId);
    setFormState(prev => ({
      ...prev,
      tujuanId: tId,
      up: sel ? sel.up : prev.up,
      noTelpon: sel ? sel.noTelpon : prev.noTelpon
    }));
  };

  // Save Document
  const handleSaveDocument = async () => {
    if (!formState.nomorSJ || !formState.tujuanId) {
      showToast('Form Belum Lengkap', 'Nomor SJ dan Tujuan Pengiriman wajib diisi', 'danger');
      return;
    }

    const filteredItems = formState.items.filter(it => it.namaBarang.trim() !== '');
    if (filteredItems.length === 0) {
      showToast('Barang Kosong', 'Minimal 1 baris barang dengan Nama Barang wajib diisi', 'danger');
      return;
    }

    const finalDoc: DocumentSJ = {
      id: formState.docId || crypto.randomUUID(),
      nomorSJ: formState.nomorSJ,
      jenisId: formState.jenisId,
      tanggal: formState.tanggal,
      tujuanId: formState.tujuanId,
      up: formState.up,
      noTelpon: formState.noTelpon,
      items: filteredItems.map((it, idx) => ({
        ...it,
        rekapNo: idx + 1,
        ctn: Number(it.ctn) || 0,
        pcs: Number(it.pcs) || 0,
        berat: Number(it.berat) || 0,
        kubikasi: Number(it.kubikasi) || 0
      }))
    };

    let updatedDocs: DocumentSJ[];
    if (editDocId) {
      updatedDocs = documents.map(d => d.id === editDocId ? finalDoc : d);
    } else {
      updatedDocs = [finalDoc, ...documents];
    }

    setDocuments(updatedDocs);

    // Try Supabase sync
    try {
      const docPayload = {
        id: finalDoc.id,
        nomor_sj: finalDoc.nomorSJ,
        jenis_id: finalDoc.jenisId || null,
        tanggal: finalDoc.tanggal,
        tujuan_id: finalDoc.tujuanId || null,
        up: finalDoc.up || '',
        no_telpon: finalDoc.noTelpon || ''
      };

      const { error: docErr } = await supabase.from('documents').upsert([docPayload]);
      if (docErr) {
        console.error('Supabase save document error:', docErr);
        showToast('Peringatan Database', `Dokumen tersimpan di browser, gagal di Supabase: ${docErr.message}`, 'danger');
      } else {
        // Delete existing items then re-insert
        await supabase.from('items').delete().eq('doc_id', finalDoc.id);

        const itemsPayload = finalDoc.items.map((it, idx) => ({
          id: crypto.randomUUID(),
          doc_id: finalDoc.id,
          rekap_no: idx + 1,
          nama_barang: it.namaBarang,
          ctn: Number(it.ctn) || 0,
          pcs: Number(it.pcs) || 0,
          berat: Number(it.berat) || 0,
          kubikasi: Number(it.kubikasi) || 0,
          keterangan: it.keterangan || ''
        }));

        const { error: itemsErr } = await supabase.from('items').insert(itemsPayload);
        if (itemsErr) {
          console.error('Supabase save items error:', itemsErr);
          showToast('Peringatan Barang', `Dokumen tersimpan, tetapi rincian barang error: ${itemsErr.message}`, 'danger');
        } else {
          showToast('Sukses', 'Dokumen Surat Jalan berhasil disimpan ke Database Supabase!', 'success');
        }
        fetchAllData();
      }
    } catch (e: any) {
      showToast('Tersimpan Lokal', 'Dokumen disimpan secara lokal', 'info');
    }

    setActiveTab('dashboard');
  };

  // Delete Document
  const handleDeleteDocument = (id: string) => {
    showConfirm({
      title: 'Hapus Dokumen SJ',
      message: 'Yakin ingin menghapus dokumen Surat Jalan ini dari Database?',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const updated = documents.filter(d => d.id !== id);
        setDocuments(updated);

        try {
          await supabase.from('items').delete().eq('doc_id', id);
          const { error: delErr } = await supabase.from('documents').delete().eq('id', id);
          if (delErr) {
            console.error('Supabase delete doc error:', delErr);
            showToast('Gagal Hapus DB', delErr.message, 'danger');
          } else {
            showToast('Terhapus', 'Dokumen SJ beserta barangnya berhasil dihapus dari Database', 'success');
            fetchAllData();
          }
        } catch (e) {
          showToast('Terhapus', 'Dokumen dihapus dari lokal', 'info');
        }
      }
    });
  };

  // Quick Add Tujuan
  const handleQuickAddTujuan = async () => {
    if (!quickAddForm.nama.trim()) {
      showToast('Peringatan', 'Nama Perusahaan/Tujuan wajib diisi', 'danger');
      return;
    }

    const newTujuan: Tujuan = {
      id: crypto.randomUUID(),
      nama: quickAddForm.nama.trim(),
      alamat: quickAddForm.alamat.trim(),
      kota: quickAddForm.kota.trim(),
      up: quickAddForm.up.trim(),
      noTelpon: quickAddForm.telp.trim()
    };

    const updatedTujuan = [...tujuanList, newTujuan];
    setTujuanList(updatedTujuan);

    try {
      await supabase.from('tujuan').insert([{
        id: newTujuan.id,
        nama: newTujuan.nama,
        alamat: newTujuan.alamat,
        kota: newTujuan.kota,
        up: newTujuan.up,
        no_telpon: newTujuan.noTelpon
      }]);
      showToast('Sukses', 'Tujuan baru berhasil ditambahkan ke Database', 'success');
    } catch (e) {
      showToast('Tersimpan Lokal', 'Tujuan ditambahkan ke lokal', 'info');
    }

    setFormState(prev => ({
      ...prev,
      tujuanId: newTujuan.id,
      up: newTujuan.up || prev.up,
      noTelpon: newTujuan.noTelpon || prev.noTelpon
    }));

    setQuickAddForm({ nama: '', kota: '', alamat: '', up: '', telp: '' });
    setQuickAddTujuanOpen(false);
  };

  // Master Jenis Handlers
  const handleOpenAddJenis = () => {
    setEditingJenisId(null);
    setJenisForm({ kode: '', nama: '' });
    setShowJenisModal(true);
  };

  const handleOpenEditJenis = (j: JenisSJ) => {
    setEditingJenisId(j.id);
    setJenisForm({ kode: j.kode, nama: j.nama });
    setShowJenisModal(true);
  };

  const handleSaveJenis = async () => {
    if (!jenisForm.kode.trim() || !jenisForm.nama.trim()) {
      showToast('Form Belum Lengkap', 'Kode dan Nama Jenis Surat Jalan wajib diisi', 'danger');
      return;
    }

    const payload: JenisSJ = {
      id: editingJenisId || `jenis-${Date.now()}`,
      kode: jenisForm.kode.trim().toUpperCase(),
      nama: jenisForm.nama.trim()
    };

    let updated: JenisSJ[];
    if (editingJenisId) {
      updated = jenisList.map(j => j.id === editingJenisId ? payload : j);
    } else {
      updated = [...jenisList, payload];
    }

    setJenisList(updated);

    try {
      const { error } = await supabase.from('jenis').upsert([payload]);
      if (error) {
        console.warn('Supabase jenis upsert error:', error.message);
        showToast('Peringatan Database', `Tersimpan lokal. Supabase: ${error.message}`, 'info');
      } else {
        showToast('Sukses', `Jenis Surat Jalan ${payload.kode} berhasil disimpan ke Database`, 'success');
        fetchAllData();
      }
    } catch (e: any) {
      showToast('Sukses Lokal', 'Jenis Surat Jalan disimpan di penyimpanan lokal', 'info');
    }

    setShowJenisModal(false);
    setEditingJenisId(null);
    setJenisForm({ kode: '', nama: '' });
  };

  const handleDeleteJenis = (id: string) => {
    showConfirm({
      title: 'Hapus Jenis Surat Jalan',
      message: 'Yakin ingin menghapus Jenis Surat Jalan ini dari Database?',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const updated = jenisList.filter(j => j.id !== id);
        setJenisList(updated);

        try {
          const { error } = await supabase.from('jenis').delete().eq('id', id);
          if (error) {
            showToast('Gagal Hapus DB', error.message, 'danger');
          } else {
            showToast('Berhasil', 'Jenis Surat Jalan terhapus dari Database', 'success');
            fetchAllData();
          }
        } catch (e) {
          showToast('Terhapus', 'Terhapus dari lokal', 'info');
        }
      }
    });
  };

  // Master Tujuan Handlers
  const handleOpenAddTujuanMaster = () => {
    setEditingTujuanId(null);
    setTujuanForm({ nama: '', alamat: '', kota: '', up: '', noTelpon: '' });
    setShowTujuanModal(true);
  };

  const handleOpenEditTujuanMaster = (t: Tujuan) => {
    setEditingTujuanId(t.id);
    setTujuanForm({
      nama: t.nama,
      alamat: t.alamat,
      kota: t.kota,
      up: t.up,
      noTelpon: t.noTelpon
    });
    setShowTujuanModal(true);
  };

  const handleSaveTujuanMaster = async () => {
    if (!tujuanForm.nama.trim()) {
      showToast('Form Belum Lengkap', 'Nama Tujuan / Perusahaan wajib diisi', 'danger');
      return;
    }

    const targetId = editingTujuanId || `tujuan-${Date.now()}`;
    const localItem: Tujuan = {
      id: targetId,
      nama: tujuanForm.nama.trim(),
      alamat: tujuanForm.alamat.trim(),
      kota: tujuanForm.kota.trim(),
      up: tujuanForm.up.trim(),
      noTelpon: tujuanForm.noTelpon.trim()
    };

    const dbPayload = {
      id: targetId,
      nama: localItem.nama,
      alamat: localItem.alamat,
      kota: localItem.kota,
      up: localItem.up,
      no_telpon: localItem.noTelpon
    };

    let updated: Tujuan[];
    if (editingTujuanId) {
      updated = tujuanList.map(t => t.id === editingTujuanId ? localItem : t);
    } else {
      updated = [...tujuanList, localItem];
    }

    setTujuanList(updated);

    try {
      const { error } = await supabase.from('tujuan').upsert([dbPayload]);
      if (error) {
        console.warn('Supabase tujuan upsert error:', error.message);
        showToast('Peringatan Database', `Tersimpan lokal. Supabase: ${error.message}`, 'info');
      } else {
        showToast('Sukses', `Tujuan "${localItem.nama}" berhasil disimpan ke Database`, 'success');
        fetchAllData();
      }
    } catch (e: any) {
      showToast('Sukses Lokal', 'Tujuan disimpan di penyimpanan lokal', 'info');
    }

    setShowTujuanModal(false);
    setEditingTujuanId(null);
    setTujuanForm({ nama: '', alamat: '', kota: '', up: '', noTelpon: '' });
  };

  const handleDeleteTujuanMaster = (id: string) => {
    showConfirm({
      title: 'Hapus Tujuan Pengiriman',
      message: 'Yakin ingin menghapus Tujuan Pengiriman ini dari Database?',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const updated = tujuanList.filter(t => t.id !== id);
        setTujuanList(updated);

        try {
          const { error } = await supabase.from('tujuan').delete().eq('id', id);
          if (error) {
            showToast('Gagal Hapus DB', error.message, 'danger');
          } else {
            showToast('Berhasil', 'Tujuan Pengiriman terhapus dari Database', 'success');
            fetchAllData();
          }
        } catch (e) {
          showToast('Terhapus', 'Terhapus dari lokal', 'info');
        }
      }
    });
  };

  // Paste Processors
  const processPasteAll = () => {
    if (!pasteTextArea.trim()) {
      showToast('Kosong', 'Area paste masih kosong', 'danger');
      return;
    }

    const lines = pasteTextArea.trim().split('\n');
    const newItems: DocumentItem[] = lines.map((line, idx) => {
      const cols = line.split('\t');
      return {
        rekapNo: idx + 1,
        namaBarang: (cols[0] || '').trim(),
        ctn: (cols[1] || '').trim(),
        pcs: (cols[2] || '').trim(),
        berat: (cols[3] || '').trim(),
        kubikasi: (cols[4] || '').trim(),
        keterangan: (cols[5] || '').trim()
      };
    });

    setFormState(prev => ({
      ...prev,
      items: prev.items.length === 1 && !prev.items[0].namaBarang ? newItems : [...prev.items, ...newItems]
    }));

    setPasteTextArea('');
    showToast('Sukses Paste', `Berhasil menambahkan ${newItems.length} baris barang`, 'success');
  };

  const processPasteColumn = () => {
    if (!pasteTextArea.trim()) {
      showToast('Kosong', 'Area paste 1 kolom masih kosong', 'danger');
      return;
    }

    const lines = pasteTextArea.trim().split('\n').map(l => l.trim()).filter(l => l !== '');
    const currentItems = [...formState.items];

    lines.forEach((val, idx) => {
      if (idx < currentItems.length) {
        currentItems[idx] = { ...currentItems[idx], [pasteTargetCol]: val };
      } else {
        const newItem: DocumentItem = {
          rekapNo: idx + 1,
          namaBarang: '',
          ctn: '',
          pcs: '',
          berat: '',
          kubikasi: '',
          keterangan: '',
          [pasteTargetCol]: val
        };
        currentItems.push(newItem);
      }
    });

    setFormState(prev => ({ ...prev, items: currentItems }));
    setPasteTextArea('');
    showToast('Sukses Kolom', `Terapkan ${lines.length} baris pada kolom target`, 'success');
  };

  // Excel Upload to Form
  const handleFormFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          showToast('Peringatan', 'File tidak berisi data yang cukup', 'danger');
          return;
        }

        const newItems: DocumentItem[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;
          newItems.push({
            rekapNo: i,
            namaBarang: String(r[0] || '').trim(),
            ctn: String(r[1] || '').trim(),
            pcs: String(r[2] || '').trim(),
            berat: String(r[3] || '').trim(),
            kubikasi: String(r[4] || '').trim(),
            keterangan: String(r[5] || '').trim()
          });
        }

        if (newItems.length > 0) {
          setFormState(prev => ({
            ...prev,
            items: prev.items.length === 1 && !prev.items[0].namaBarang ? newItems : [...prev.items, ...newItems]
          }));
          showToast('Sukses Impor', `Berhasil mengimpor ${newItems.length} item dari file Excel`, 'success');
        }
      } catch (err) {
        showToast('Gagal Impor', 'Gagal membaca file Excel', 'danger');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Open Print Mode
  const handleOpenPrint = (doc: DocumentSJ) => {
    setPrintDoc(doc);
    setActiveTab('print');
  };

  // Filtered Dashboard Docs
  const filteredDashDocs = documents.filter(d => {
    const t = tujuanList.find(tuj => tuj.id === d.tujuanId);
    const tujNama = t ? t.nama : '';
    const matchSearch =
      d.nomorSJ.toLowerCase().includes(dashSearch.toLowerCase()) ||
      tujNama.toLowerCase().includes(dashSearch.toLowerCase()) ||
      d.up.toLowerCase().includes(dashSearch.toLowerCase());

    const matchJenis = dashFilterJenis ? d.jenisId === dashFilterJenis : true;
    return matchSearch && matchJenis;
  });

  // Calculate Totals for Dashboard
  const totalSJ = documents.length;
  const totalItemLines = documents.reduce((acc, d) => acc + d.items.length, 0);
  const totalCTNCount = documents.reduce((acc, d) => acc + d.items.reduce((sum, it) => sum + (Number(it.ctn) || 0), 0), 0);

  // All Rekap Items Flattened
  const allRekapItems = documents.flatMap((d) => {
    const t = tujuanList.find(tuj => tuj.id === d.tujuanId);
    return d.items.map((it) => ({
      rekapNo: it.rekapNo,
      nomorSJ: d.nomorSJ,
      tanggal: d.tanggal,
      tujuan: t ? t.nama : 'N/A',
      namaBarang: it.namaBarang,
      ctn: Number(it.ctn) || 0,
      pcs: Number(it.pcs) || 0,
      berat: Number(it.berat) || 0,
      kubikasi: Number(it.kubikasi) || 0,
      keterangan: it.keterangan || ''
    }));
  }).sort((a, b) => a.rekapNo - b.rekapNo);

  const filteredRekapItems = allRekapItems.filter((it) => {
    const qGlobal = rekapSearch.toLowerCase();
    const qSJ = rekapFilterSJ.toLowerCase();
    const qBarang = rekapFilterBarang.toLowerCase();

    const matchGlobal = !qGlobal || (
      it.nomorSJ.toLowerCase().includes(qGlobal) ||
      it.tujuan.toLowerCase().includes(qGlobal) ||
      it.namaBarang.toLowerCase().includes(qGlobal) ||
      it.keterangan.toLowerCase().includes(qGlobal)
    );

    const matchSJ = !qSJ || it.nomorSJ.toLowerCase().includes(qSJ);
    const matchBarang = !qBarang || it.namaBarang.toLowerCase().includes(qBarang);

    return matchGlobal && matchSJ && matchBarang;
  });

  // Export Rekap Excel
  const exportRekapExcel = () => {
    if (allRekapItems.length === 0) {
      showToast('Kosong', 'Tidak ada data rekap untuk diekspor', 'info');
      return;
    }

    const rows = filteredRekapItems.map(it => ({
      "No Rekap": it.rekapNo,
      "Nomor SJ": it.nomorSJ,
      "Tanggal": it.tanggal,
      "Tujuan": it.tujuan,
      "Nama Barang": it.namaBarang,
      "Jumlah CTN": it.ctn,
      "Jumlah PCS": it.pcs,
      "Berat (KG)": it.berat,
      "Kubikasi (M3)": it.kubikasi,
      "Keterangan": it.keterangan
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Barang');
    XLSX.writeFile(wb, `Rekapitulasi_Surat_Jalan_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Sukses Ekspor', 'Data rekapitulasi barang berhasil diunduh', 'success');
  };

  // Save Rekapan to Database
  const handleSaveRekapToDatabase = async () => {
    if (filteredRekapItems.length === 0) {
      showToast('Kosong', 'Tidak ada data rekapitulasi untuk disimpan', 'info');
      return;
    }

    setSavingRekap(true);
    const defaultTitle = rekapTitleInput.trim() || `Rekapan Surat Jalan - ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    const uniqueSJs = new Set(filteredRekapItems.map(i => i.nomorSJ)).size;
    const totalItem = filteredRekapItems.length;
    const totalCtn = filteredRekapItems.reduce((acc, i) => acc + (Number(i.ctn) || 0), 0);
    const totalPcs = filteredRekapItems.reduce((acc, i) => acc + (Number(i.pcs) || 0), 0);
    const totalBerat = filteredRekapItems.reduce((acc, i) => acc + (Number(i.berat) || 0), 0);
    const totalKubikasi = filteredRekapItems.reduce((acc, i) => acc + (Number(i.kubikasi) || 0), 0);

    const newRekapPayload: SavedRekapSJ = {
      id: crypto.randomUUID(),
      judul: defaultTitle,
      tanggal_rekap: new Date().toISOString(),
      total_sj: uniqueSJs,
      total_item: totalItem,
      total_ctn: totalCtn,
      total_pcs: totalPcs,
      total_berat: Number(totalBerat.toFixed(2)),
      total_kubikasi: Number(totalKubikasi.toFixed(3)),
      data_detail: filteredRekapItems,
      keterangan: `Disimpan dari Rekapitulasi Barang (${filteredRekapItems.length} baris)`
    };

    try {
      const { error } = await supabase.from('rekapan_sj').insert([newRekapPayload]);
      if (error) {
        console.warn('Supabase rekapan_sj warning:', error.message);
        showToast('Disimpan Lokal', `Rekapan tersimpan lokal. Supabase: ${error.message}`, 'info');
      } else {
        showToast('Berhasil Disimpan', `Rekapan "${defaultTitle}" berhasil tersimpan ke Database Supabase!`, 'success');
      }

      const updated = [newRekapPayload, ...savedRekapList];
      setSavedRekapList(updated);
      setShowSaveModal(false);
      setRekapTitleInput('');
    } catch (e: any) {
      showToast('Error', e.message || 'Gagal menyimpan rekapan', 'danger');
    } finally {
      setSavingRekap(false);
    }
  };

  // Delete Saved Rekap
  const handleDeleteSavedRekap = (id: string, judul: string) => {
    showConfirm({
      title: 'Hapus Rekapan Ter simpan',
      message: `Yakin ingin menghapus rekapan "${judul}" dari Database Supabase?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const updated = savedRekapList.filter(r => r.id !== id);
        setSavedRekapList(updated);

        try {
          const { error } = await supabase.from('rekapan_sj').delete().eq('id', id);
          if (error) {
            showToast('Peringatan', `Terhapus lokal, catatan DB: ${error.message}`, 'info');
          } else {
            showToast('Terhapus', 'Data rekapan berhasil dihapus dari Database Supabase', 'success');
            fetchAllData();
          }
        } catch (e) {
          showToast('Terhapus', 'Data rekapan terhapus dari lokal', 'info');
        }
      }
    });
  };

  // Export Saved Rekap Excel
  const exportSavedRekapToExcel = (rekap: SavedRekapSJ) => {
    if (!rekap.data_detail || rekap.data_detail.length === 0) {
      showToast('Kosong', 'Tidak ada data rincian dalam rekapan ini', 'info');
      return;
    }

    const rows = rekap.data_detail.map((it: any) => ({
      "No Rekap": it.rekapNo,
      "Nomor SJ": it.nomorSJ,
      "Tanggal": it.tanggal,
      "Tujuan": it.tujuan,
      "Nama Barang": it.namaBarang,
      "Jumlah CTN": it.ctn,
      "Jumlah PCS": it.pcs,
      "Berat (KG)": it.berat,
      "Kubikasi (M3)": it.kubikasi,
      "Keterangan": it.keterangan
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Barang');
    const safeTitle = (rekap.judul || 'Rekapan_SJ').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}.xlsx`);
    showToast('Sukses Ekspor', `File Excel "${rekap.judul}" berhasil diunduh`, 'success');
  };

  const formatNum = (n: number | string) => (Number(n) || 0).toLocaleString('id-ID');

  return (
    <div className="space-y-6 text-slate-800">
      {/* HEADER SUB-NAVIGATION */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText size={15} />
            <span>Dashboard SJ</span>
          </button>

          <button
            onClick={handleOpenNewForm}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'form'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus size={15} />
            <span>Buat SJ Baru</span>
          </button>

          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rekap'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>REKAP BARANG</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Settings size={15} />
            <span>Pengaturan Master</span>
          </button>
        </div>

        <button
          onClick={fetchAllData}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          title="Sinkronkan dengan Supabase"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. DASHBOARD TAB */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block tracking-tight">{totalSJ}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Dokumen SJ</span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Layers size={24} />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block tracking-tight">{formatNum(totalItemLines)}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Baris Item</span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Save size={24} />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block tracking-tight">{formatNum(totalCTNCount)}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Karton (CTN)</span>
              </div>
            </div>
          </div>

          {/* Search & Table */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={dashSearch}
                    onChange={(e) => setDashSearch(e.target.value)}
                    placeholder="Cari nomor SJ, tujuan, atau UP..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={dashFilterJenis}
                  onChange={(e) => setDashFilterJenis(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Jenis SJ</option>
                  {jenisList.map(j => (
                    <option key={j.id} value={j.id}>{j.nama} ({j.kode})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleOpenNewForm}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Buat SJ Baru</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nomor SJ</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jenis</th>
                    <th className="p-3">Tujuan</th>
                    <th className="p-3">UP / Kontak</th>
                    <th className="p-3 text-right">Total Item</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        <RefreshCw size={20} className="animate-spin inline-block mr-2 text-blue-600" />
                        Memuat data Surat Jalan...
                      </td>
                    </tr>
                  ) : filteredDashDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        Belum ada dokumen Surat Jalan. Klik <strong>"Buat SJ Baru"</strong> untuk menambah.
                      </td>
                    </tr>
                  ) : (
                    filteredDashDocs.map((doc) => {
                      const t = tujuanList.find(tuj => tuj.id === doc.tujuanId);
                      const j = jenisList.find(jen => jen.id === doc.jenisId);
                      return (
                        <tr key={doc.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-amber-600 whitespace-nowrap">
                            {doc.nomorSJ}
                          </td>
                          <td className="p-3 whitespace-nowrap">{doc.tanggal}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="bg-amber-100 text-amber-800 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold">
                              {j ? j.kode : 'CKB'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{t ? t.nama : 'N/A'}</td>
                          <td className="p-3 text-slate-600">
                            {doc.up || '-'} {doc.noTelpon ? `(${doc.noTelpon})` : ''}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{doc.items.length} item</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPrint(doc)}
                                className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer transition-colors"
                                title="Cetak / Pratinjau"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenEditForm(doc)}
                                className="p-1.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 cursor-pointer transition-colors"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1.5 rounded bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 cursor-pointer transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. FORM INPUT / EDIT TAB */}
      {/* ==================================================================== */}
      {activeTab === 'form' && (
        <div className="space-y-5">
          {/* Header & Back */}
          <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase m-0">
                {editDocId ? 'Edit Surat Jalan' : 'Buat Surat Jalan Baru'}
              </h2>
              <p className="text-xs text-slate-500 font-semibold m-0 mt-0.5">Isi rincian pengiriman dan daftar barang</p>
            </div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              <span>Kembali</span>
            </button>
          </div>

          {/* Form Header Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Jenis Surat Jalan
                </label>
                <select
                  value={formState.jenisId}
                  onChange={(e) => {
                    const nextJenisId = e.target.value;
                    const nextNomor = generateNomorSJ(nextJenisId, formState.tanggal);
                    setFormState(prev => ({ ...prev, jenisId: nextJenisId, nomorSJ: nextNomor }));
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {jenisList.map(j => (
                    <option key={j.id} value={j.id}>{j.nama} ({j.kode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={formState.tanggal}
                  onChange={(e) => {
                    const nextTgl = e.target.value;
                    const nextNomor = generateNomorSJ(formState.jenisId, nextTgl);
                    setFormState(prev => ({ ...prev, tanggal: nextTgl, nomorSJ: nextNomor }));
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                Nomor Surat Jalan (Otomatis)
              </label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl font-mono text-sm font-black text-blue-900">
                {formState.nomorSJ}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider m-0">
                    Tujuan Pengiriman
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuickAddTujuanOpen(!quickAddTujuanOpen)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <PlusCircle size={13} />
                    <span>+ Tambah Tujuan Baru</span>
                  </button>
                </div>
                <select
                  value={formState.tujuanId}
                  onChange={(e) => handleTujuanSelect(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Pilih Tujuan --</option>
                  {tujuanList.map(t => (
                    <option key={t.id} value={t.id}>{t.nama} ({t.kota || '-'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">UP (Penerima)</label>
                  <input
                    type="text"
                    value={formState.up}
                    onChange={(e) => setFormState({ ...formState, up: e.target.value })}
                    placeholder="Nama UP"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">No. Telepon</label>
                  <input
                    type="text"
                    value={formState.noTelpon}
                    onChange={(e) => setFormState({ ...formState, noTelpon: e.target.value })}
                    placeholder="No Telp UP"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Add Tujuan Box */}
            {quickAddTujuanOpen && (
              <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-xl space-y-3 animate-in fade-in duration-200">
                <span className="text-xs font-extrabold text-slate-900 uppercase block">Tambah Alamat Tujuan Baru (Cepat)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nama Perusahaan / Tujuan *"
                    value={quickAddForm.nama}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, nama: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Kota / Kabupaten"
                    value={quickAddForm.kota}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, kota: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Alamat Lengkap"
                    value={quickAddForm.alamat}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, alamat: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="UP (Kontak Penerima)"
                    value={quickAddForm.up}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, up: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                  <input
                    type="text"
                    placeholder="No. Telepon"
                    value={quickAddForm.telp}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, telp: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickAddTujuanOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddTujuan}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs"
                  >
                    Simpan Tujuan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Method Tabs & Items Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase text-slate-900 tracking-wider">Metode Pengisian Barang:</span>
              <div className="flex border border-slate-300 rounded-xl overflow-hidden p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setFormMode('manual')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${formMode === 'manual' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700'}`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('tempel')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${formMode === 'tempel' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700'}`}
                >
                  Tempel (Paste)
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('impor')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${formMode === 'impor' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700'}`}
                >
                  Impor File
                </button>
              </div>
            </div>

            {/* Paste Area */}
            {formMode === 'tempel' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteSubMode('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${pasteSubMode === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                  >
                    Semua Kolom Sekaligus
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasteSubMode('column')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${pasteSubMode === 'column' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                  >
                    Per Kolom (Step-by-Step)
                  </button>
                </div>

                {pasteSubMode === 'all' ? (
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">
                      Copy dari Excel (Urutan Kolom: Nama Barang | CTN | PCS | Berat | Kubikasi | Keterangan) lalu paste di bawah:
                    </span>
                    <textarea
                      rows={4}
                      value={pasteTextArea}
                      onChange={(e) => setPasteTextArea(e.target.value)}
                      placeholder="Paste data dari Excel di sini..."
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs outline-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={processPasteAll}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs"
                      >
                        Proses &amp; Tambah Ke Tabel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Kolom</label>
                        <select
                          value={pasteTargetCol}
                          onChange={(e) => setPasteTargetCol(e.target.value as any)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                        >
                          <option value="namaBarang">Nama Barang</option>
                          <option value="ctn">Jumlah CTN</option>
                          <option value="pcs">Jumlah PCS</option>
                          <option value="berat">Berat (KG)</option>
                          <option value="kubikasi">Kubikasi (M3)</option>
                          <option value="keterangan">Keterangan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Paste Data 1 Kolom</label>
                        <textarea
                          rows={2}
                          value={pasteTextArea}
                          onChange={(e) => setPasteTextArea(e.target.value)}
                          placeholder="Paste 1 kolom dari Excel..."
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-xs outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={processPasteColumn}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs"
                      >
                        Terapkan Kolom Ini
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Impor File */}
            {formMode === 'impor' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Pilih file Excel (.xlsx, .xls) untuk mengimpor daftar item secara otomatis:
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFormFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-10">No</th>
                    <th className="p-2.5">Nama Barang / Deskripsi</th>
                    <th className="p-2.5 w-24">CTN</th>
                    <th className="p-2.5 w-24">PCS</th>
                    <th className="p-2.5 w-28">Berat (KG)</th>
                    <th className="p-2.5 w-28">Kubikasi (M3)</th>
                    <th className="p-2.5">Keterangan</th>
                    <th className="p-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {formState.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.namaBarang}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].namaBarang = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          placeholder="Deskripsi barang..."
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          value={it.ctn}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].ctn = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          value={it.pcs}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].pcs = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={it.berat}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].berat = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.001"
                          value={it.kubikasi}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].kubikasi = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.keterangan}
                          onChange={(e) => {
                            const newItems = [...formState.items];
                            newItems[idx].keterangan = e.target.value;
                            setFormState({ ...formState, items: newItems });
                          }}
                          placeholder="Ket..."
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        {formState.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = formState.items.filter((_, i) => i !== idx);
                              setFormState({ ...formState, items: newItems });
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="p-2.5 text-right">TOTAL:</td>
                    <td className="p-2.5 text-right font-mono">
                      {formatNum(formState.items.reduce((s, i) => s + (Number(i.ctn) || 0), 0))}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {formatNum(formState.items.reduce((s, i) => s + (Number(i.pcs) || 0), 0))}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {formState.items.reduce((s, i) => s + (Number(i.berat) || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {formState.items.reduce((s, i) => s + (Number(i.kubikasi) || 0), 0).toFixed(3)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setFormState({
                  ...formState,
                  items: [...formState.items, { rekapNo: formState.items.length + 1, namaBarang: '', ctn: '', pcs: '', berat: '', kubikasi: '', keterangan: '' }]
                })}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Tambah Baris Barang</span>
              </button>

              <button
                type="button"
                onClick={() => setFormState({
                  ...formState,
                  items: [{ rekapNo: 1, namaBarang: '', ctn: '', pcs: '', berat: '', kubikasi: '', keterangan: '' }]
                })}
                className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
              >
                Kosongkan Baris
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveDocument}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Save size={16} />
              <span>Simpan Dokumen SJ</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PRINT / PRATINJAU TAB */}
      {/* ==================================================================== */}
      {activeTab === 'print' && printDoc && (
        <div className="space-y-4">
          {/* Print Toolbar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-2 print:hidden">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              <span>Kembali</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex border border-slate-300 rounded-xl overflow-hidden p-0.5 bg-slate-100">
                <button
                  onClick={() => setPaperSize('A4')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${paperSize === 'A4' ? 'bg-blue-600 text-white' : 'text-slate-700'}`}
                >
                  A4
                </button>
                <button
                  onClick={() => setPaperSize('Letter')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${paperSize === 'Letter' ? 'bg-blue-600 text-white' : 'text-slate-700'}`}
                >
                  Letter
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={16} />
                <span>Cetak Surat Jalan</span>
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className={`mx-auto bg-white p-8 border border-slate-300 shadow-lg text-slate-900 ${paperSize === 'A4' ? 'max-w-[210mm]' : 'max-w-[215.9mm]'} font-sans`}>
            {/* Header / Kop */}
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900 gap-4">
              <img src={KINO_LOGO_URL} alt="Kino Logo" className="h-10 object-contain" />
              <div className="text-center flex-1">
                <h1 className="text-xl font-extrabold tracking-wider uppercase m-0 text-slate-900">
                  {jenisList.find(j => j.id === printDoc.jenisId)?.nama || 'SURAT JALAN'}
                </h1>
                <p className="font-mono text-sm font-bold text-blue-600 m-0 mt-0.5">
                  NO: {printDoc.nomorSJ}
                </p>
              </div>
              <div className="text-right text-xs font-bold whitespace-nowrap pt-1">
                Tanggal: <span>{printDoc.tanggal}</span>
              </div>
            </div>

            {/* Parties Info */}
            <div className="grid grid-cols-2 gap-6 my-4 text-xs leading-relaxed">
              <div>
                <span className="font-extrabold uppercase block text-slate-900 mb-1">PENGIRIM:</span>
                <p className="m-0 font-bold text-slate-900">{pengirim.nama}</p>
                <p className="m-0 text-slate-700">{pengirim.alamat}</p>
                <p className="m-0 text-slate-700">{pengirim.kotaKab} {pengirim.telp ? `- Telp: ${pengirim.telp}` : ''}</p>
              </div>

              <div>
                <span className="font-extrabold uppercase block text-slate-900 mb-1">KEPADA YTH:</span>
                {(() => {
                  const t = tujuanList.find(tuj => tuj.id === printDoc.tujuanId);
                  return (
                    <>
                      <p className="m-0 font-bold text-slate-900">{t ? t.nama : 'N/A'}</p>
                      <p className="m-0 text-slate-700">{t ? t.alamat : ''}</p>
                      <p className="m-0 text-slate-700">{t ? t.kota : ''}</p>
                      {printDoc.up && <p className="m-0 font-semibold text-slate-800">UP: {printDoc.up} {printDoc.noTelpon ? `(${printDoc.noTelpon})` : ''}</p>}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Print Table */}
            <table className="w-full text-left text-xs my-6 border-collapse">
              <thead>
                <tr className="border-y-2 border-slate-900 font-extrabold uppercase text-slate-900">
                  <th className="py-2 px-1.5 w-8">NO</th>
                  <th className="py-2 px-1.5">NAMA / DESKRIPSI BARANG</th>
                  <th className="py-2 px-1.5 text-right w-16">CTN</th>
                  <th className="py-2 px-1.5 text-right w-16">PCS</th>
                  <th className="py-2 px-1.5 text-right w-20">BERAT</th>
                  <th className="py-2 px-1.5 text-right w-20">KUBIKASI</th>
                  <th className="py-2 px-1.5">KETERANGAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {printDoc.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-1.5 font-mono">{idx + 1}</td>
                    <td className="py-2 px-1.5 font-semibold">{it.namaBarang}</td>
                    <td className="py-2 px-1.5 text-right font-mono">{formatNum(it.ctn)}</td>
                    <td className="py-2 px-1.5 text-right font-mono">{formatNum(it.pcs)}</td>
                    <td className="py-2 px-1.5 text-right font-mono">{(Number(it.berat) || 0).toFixed(2)}</td>
                    <td className="py-2 px-1.5 text-right font-mono">{(Number(it.kubikasi) || 0).toFixed(3)}</td>
                    <td className="py-2 px-1.5 text-slate-600">{it.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-900 font-extrabold text-slate-900">
                <tr>
                  <td colSpan={2} className="py-2 px-1.5 text-right">TOTAL:</td>
                  <td className="py-2 px-1.5 text-right font-mono">
                    {formatNum(printDoc.items.reduce((s, i) => s + (Number(i.ctn) || 0), 0))}
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono">
                    {formatNum(printDoc.items.reduce((s, i) => s + (Number(i.pcs) || 0), 0))}
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono">
                    {printDoc.items.reduce((s, i) => s + (Number(i.berat) || 0), 0).toFixed(2)} kg
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono">
                    {printDoc.items.reduce((s, i) => s + (Number(i.kubikasi) || 0), 0).toFixed(3)} m³
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-4 gap-4 my-12 text-center text-xs">
              <div>
                <p className="font-bold text-slate-900 m-0 mb-12">Pengirim</p>
                <div className="border-t border-slate-900 pt-1 text-[11px] text-slate-600">( _________________ )</div>
              </div>

              <div>
                <p className="font-bold text-slate-900 m-0 mb-12">Sopir / Ekspedisi</p>
                <div className="border-t border-slate-900 pt-1 text-[11px] text-slate-600">( _________________ )</div>
              </div>

              <div>
                <p className="font-bold text-slate-900 m-0 mb-12">Security</p>
                <div className="border-t border-slate-900 pt-1 text-[11px] text-slate-600">( _________________ )</div>
              </div>

              <div>
                <p className="font-bold text-slate-900 m-0 mb-12">Penerima</p>
                <div className="border-t border-slate-900 pt-1 text-[11px] text-slate-600">( _________________ )</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. REKAPITULASI BARANG TAB */}
      {/* ==================================================================== */}
      {activeTab === 'rekap' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase m-0 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600" size={20} />
                <span>Rekapitulasi Barang Pengiriman</span>
              </h2>
              <p className="text-xs text-slate-500 font-semibold m-0 mt-0.5">Data seluruh rincian barang dari semua Surat Jalan</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200">
                {filteredRekapItems.length} / {allRekapItems.length} baris
              </span>

              <button
                onClick={() => {
                  setRekapTitleInput(`Rekapan SJ - ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`);
                  setShowSaveModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="Simpan rekapan saat ini ke Database Supabase"
              >
                <Database size={15} />
                <span>Simpan Rekapan DB</span>
              </button>

              <button
                onClick={() => setShowHistorySection(!showHistorySection)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  showHistorySection 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <FolderCheck size={15} />
                <span>Riwayat Rekapan DB ({savedRekapList.length})</span>
              </button>

              <button
                onClick={exportRekapExcel}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download size={15} />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* RIWAYAT REKAPAN TER SIMPAN DI DATABASE SECTION */}
          {showHistorySection && (
            <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm">
                  <Database size={16} className="text-purple-600" />
                  <span>Daftar Rekapan Ter simpan di Database Supabase ({savedRekapList.length})</span>
                </div>
                <button
                  onClick={() => setShowHistorySection(false)}
                  className="text-xs text-purple-600 font-bold hover:underline cursor-pointer"
                >
                  Sembunyikan
                </button>
              </div>

              {savedRekapList.length === 0 ? (
                <p className="text-xs text-purple-600 italic m-0">Belum ada rekapan yang tersimpan di database.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {savedRekapList.map((rk) => (
                    <div key={rk.id} className="p-3.5 bg-white border border-purple-200 rounded-xl shadow-xs space-y-2 hover:border-purple-300 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 m-0 uppercase line-clamp-1">{rk.judul}</h4>
                          <p className="text-[10px] text-slate-400 font-medium m-0 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} />
                            <span>{new Date(rk.tanggal_rekap || rk.created_at || '').toLocaleString('id-ID')}</span>
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-lg whitespace-nowrap">
                          {rk.total_item || rk.data_detail?.length || 0} Barang
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 bg-slate-50 p-2 rounded-lg text-center text-[10px] font-bold text-slate-700">
                        <div>
                          <span className="block text-slate-400 text-[9px]">DOC SJ</span>
                          {rk.total_sj || 0}
                        </div>
                        <div>
                          <span className="block text-slate-400 text-[9px]">CTN</span>
                          {formatNum(rk.total_ctn || 0)}
                        </div>
                        <div>
                          <span className="block text-slate-400 text-[9px]">PCS</span>
                          {formatNum(rk.total_pcs || 0)}
                        </div>
                        <div>
                          <span className="block text-slate-400 text-[9px]">KG</span>
                          {rk.total_berat || 0}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          onClick={() => setViewSavedRekap(rk)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>Detail</span>
                        </button>
                        <button
                          onClick={() => exportSavedRekapToExcel(rk)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Download size={12} />
                          <span>Excel</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSavedRekap(rk.id, rk.judul)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Hapus Rekapan"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3 Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rekapSearch}
                onChange={(e) => setRekapSearch(e.target.value)}
                placeholder="Cari Semua Kolom..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rekapFilterSJ}
                onChange={(e) => setRekapFilterSJ(e.target.value)}
                placeholder="Filter Nomor SJ..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rekapFilterBarang}
                onChange={(e) => setRekapFilterBarang(e.target.value)}
                placeholder="Filter Nama Barang..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-16 text-center">No Rekap</th>
                  <th className="p-2.5">Nomor SJ</th>
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">Tujuan</th>
                  <th className="p-2.5">Nama Barang</th>
                  <th className="p-2.5 text-right">CTN</th>
                  <th className="p-2.5 text-right">PCS</th>
                  <th className="p-2.5 text-right">Berat (KG)</th>
                  <th className="p-2.5 text-right">Kubikasi (M3)</th>
                  <th className="p-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredRekapItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                      Tidak ada data rekap barang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredRekapItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-2.5 text-center font-mono text-slate-400">{it.rekapNo}</td>
                      <td className="p-2.5 font-mono font-bold text-amber-600">{it.nomorSJ}</td>
                      <td className="p-2.5 whitespace-nowrap">{it.tanggal}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{it.tujuan}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{it.namaBarang}</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatNum(it.ctn)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatNum(it.pcs)}</td>
                      <td className="p-2.5 text-right font-mono">{it.berat.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono">{it.kubikasi.toFixed(3)}</td>
                      <td className="p-2.5 text-slate-500">{it.keterangan || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. PENGATURAN MASTER DATA TAB */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kop Pengirim */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-900 m-0 pb-2 border-b border-slate-100">
                Data Pengirim (Kop SJ)
              </h3>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Nama Pengirim</label>
                <input
                  type="text"
                  value={pengirim.nama}
                  onChange={(e) => setPengirim({ ...pengirim, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={pengirim.alamat}
                  onChange={(e) => setPengirim({ ...pengirim, alamat: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Kota / Kab</label>
                  <input
                    type="text"
                    value={pengirim.kotaKab}
                    onChange={(e) => setPengirim({ ...pengirim, kotaKab: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Telepon</label>
                  <input
                    type="text"
                    value={pengirim.telp}
                    onChange={(e) => setPengirim({ ...pengirim, telp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await supabase.from('pengirim').upsert([{ id: 1, ...pengirim, kota_kab: pengirim.kotaKab }]);
                    showToast('Sukses', 'Data Kop Pengirim berhasil disimpan', 'success');
                  } catch (e) {
                    showToast('Sukses Lokal', 'Data Kop disimpan di lokal', 'info');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 mt-2"
              >
                <Save size={14} />
                <span>Simpan Kop Pengirim</span>
              </button>
            </div>

            {/* Jenis SJ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-black uppercase text-slate-900 m-0">
                  Jenis Surat Jalan ({jenisList.length})
                </h3>
                <button
                  type="button"
                  onClick={handleOpenAddJenis}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Plus size={14} />
                  <span>Tambah Jenis SJ</span>
                </button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {jenisList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada jenis surat jalan.</p>
                ) : (
                  jenisList.map(j => (
                    <div key={j.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{j.nama}</span>
                        <span className="bg-amber-100 text-amber-800 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold inline-block mt-0.5">
                          {j.kode}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditJenis(j)}
                          className="p-1.5 rounded bg-white hover:bg-amber-100 text-slate-600 hover:text-amber-700 cursor-pointer border border-slate-200"
                          title="Edit Jenis"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteJenis(j.id)}
                          className="p-1.5 rounded bg-white hover:bg-red-100 text-slate-600 hover:text-red-700 cursor-pointer border border-slate-200"
                          title="Hapus Jenis"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Master Tujuan Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900 m-0">
                  Daftar Tujuan Pengiriman ({tujuanList.length})
                </h3>
                <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                  Data tujuan pengiriman yang tersimpan di Database Supabase (`tujuan`)
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddTujuanMaster}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Plus size={15} />
                <span>Tambah Tujuan Pengiriman</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Nama Tujuan</th>
                    <th className="p-2.5">Alamat</th>
                    <th className="p-2.5">Kota</th>
                    <th className="p-2.5">UP</th>
                    <th className="p-2.5">No Telepon</th>
                    <th className="p-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {tujuanList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                        Belum ada tujuan pengiriman. Klik "Tambah Tujuan Pengiriman" untuk menambah.
                      </td>
                    </tr>
                  ) : (
                    tujuanList.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{t.nama}</td>
                        <td className="p-2.5 text-slate-600">{t.alamat || '-'}</td>
                        <td className="p-2.5 text-slate-700">{t.kota || '-'}</td>
                        <td className="p-2.5 text-slate-700">{t.up || '-'}</td>
                        <td className="p-2.5 text-slate-700">{t.noTelpon || '-'}</td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditTujuanMaster(t)}
                              className="p-1.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 cursor-pointer"
                              title="Edit Tujuan"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteTujuanMaster(t.id)}
                              className="p-1.5 rounded bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 cursor-pointer"
                              title="Hapus Tujuan"
                            >
                              <Trash2 size={13} />
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
      )}

      {/* Modal Tambah/Edit Jenis SJ */}
      {showJenisModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase m-0">
                {editingJenisId ? 'Edit Jenis Surat Jalan' : 'Tambah Jenis Surat Jalan Baru'}
              </h3>
              <button
                onClick={() => setShowJenisModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Kode Jenis SJ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={jenisForm.kode}
                  onChange={(e) => setJenisForm({ ...jenisForm, kode: e.target.value })}
                  placeholder="Contoh: CKB, REG, EXP"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Nama Jenis SJ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={jenisForm.nama}
                  onChange={(e) => setJenisForm({ ...jenisForm, nama: e.target.value })}
                  placeholder="Contoh: SURAT JALAN CKB"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowJenisModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveJenis}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={15} />
                <span>Simpan Ke Database</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal Tambah/Edit Master Tujuan */}
      {showTujuanModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase m-0">
                {editingTujuanId ? 'Edit Tujuan Pengiriman' : 'Tambah Tujuan Pengiriman Baru'}
              </h3>
              <button
                onClick={() => setShowTujuanModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Nama Perusahaan / Tujuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tujuanForm.nama}
                  onChange={(e) => setTujuanForm({ ...tujuanForm, nama: e.target.value })}
                  placeholder="Contoh: PT KINO INDONESIA SUKABUMI"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  value={tujuanForm.alamat}
                  onChange={(e) => setTujuanForm({ ...tujuanForm, alamat: e.target.value })}
                  placeholder="Jl. Raya Cikembar No. 88"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                    Kota / Kab
                  </label>
                  <input
                    type="text"
                    value={tujuanForm.kota}
                    onChange={(e) => setTujuanForm({ ...tujuanForm, kota: e.target.value })}
                    placeholder="Sukabumi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                    U.P. (Attn)
                  </label>
                  <input
                    type="text"
                    value={tujuanForm.up}
                    onChange={(e) => setTujuanForm({ ...tujuanForm, up: e.target.value })}
                    placeholder="Bpk. Hendra"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                    No. Telepon
                  </label>
                  <input
                    type="text"
                    value={tujuanForm.noTelpon}
                    onChange={(e) => setTujuanForm({ ...tujuanForm, noTelpon: e.target.value })}
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTujuanModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTujuanMaster}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={15} />
                <span>Simpan Ke Database</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ==================================================================== */}
      {/* MODAL SIMPAN REKAPAN TO DATABASE */}
      {/* ==================================================================== */}
      {showSaveModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase m-0">Simpan Rekapan Ke Database</h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0">Simpan laporan ringkasan barang saat ini</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                  Judul Rekapan / Laporan
                </label>
                <input
                  type="text"
                  value={rekapTitleInput}
                  onChange={(e) => setRekapTitleInput(e.target.value)}
                  placeholder="Contoh: Rekapitulasi SJ Periode Agustus 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-[11px] text-emerald-900 font-semibold">
                <div className="flex justify-between">
                  <span>Total Baris Barang:</span>
                  <span className="font-bold">{filteredRekapItems.length} item</span>
                </div>
                <div className="flex justify-between">
                  <span>Total CTN:</span>
                  <span className="font-bold">{formatNum(filteredRekapItems.reduce((acc, i) => acc + (Number(i.ctn) || 0), 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total PCS:</span>
                  <span className="font-bold">{formatNum(filteredRekapItems.reduce((acc, i) => acc + (Number(i.pcs) || 0), 0))}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingRekap}
                onClick={handleSaveRekapToDatabase}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={15} />
                <span>{savingRekap ? 'Menyimpan...' : 'Simpan Ke Database'}</span>
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ==================================================================== */}
      {/* MODAL DETAIL REKAPAN TER SIMPAN */}
      {/* ==================================================================== */}
      {viewSavedRekap && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase m-0">{viewSavedRekap.judul}</h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Disimpan tanggal: {new Date(viewSavedRekap.tanggal_rekap || viewSavedRekap.created_at || '').toLocaleString('id-ID')}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportSavedRekapToExcel(viewSavedRekap)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                >
                  <Download size={14} />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  onClick={() => setViewSavedRekap(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Dokumen SJ</span>
                <span className="font-mono font-extrabold text-slate-900">{viewSavedRekap.total_sj || 0}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Item</span>
                <span className="font-mono font-extrabold text-slate-900">{viewSavedRekap.total_item || viewSavedRekap.data_detail?.length || 0}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Total CTN</span>
                <span className="font-mono font-extrabold text-slate-900">{formatNum(viewSavedRekap.total_ctn || 0)}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Total PCS</span>
                <span className="font-mono font-extrabold text-slate-900">{formatNum(viewSavedRekap.total_pcs || 0)}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Berat</span>
                <span className="font-mono font-extrabold text-slate-900">{(viewSavedRekap.total_berat || 0).toFixed(2)} KG</span>
              </div>
            </div>

            {/* Table Detail */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-[400px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-12 text-center">No</th>
                    <th className="p-2.5">Nomor SJ</th>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Tujuan</th>
                    <th className="p-2.5">Nama Barang</th>
                    <th className="p-2.5 text-right">CTN</th>
                    <th className="p-2.5 text-right">PCS</th>
                    <th className="p-2.5 text-right">Berat (KG)</th>
                    <th className="p-2.5 text-right">Kubikasi (M3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {(!viewSavedRekap.data_detail || viewSavedRekap.data_detail.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                        Tidak ada detail data dalam rekapan ini.
                      </td>
                    </tr>
                  ) : (
                    viewSavedRekap.data_detail.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-400">{it.rekapNo || (idx + 1)}</td>
                        <td className="p-2.5 font-mono font-bold text-amber-600">{it.nomorSJ}</td>
                        <td className="p-2.5 whitespace-nowrap">{it.tanggal}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{it.tujuan}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{it.namaBarang}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatNum(it.ctn)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatNum(it.pcs)}</td>
                        <td className="p-2.5 text-right font-mono">{(Number(it.berat) || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono">{(Number(it.kubikasi) || 0).toFixed(3)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewSavedRekap(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
