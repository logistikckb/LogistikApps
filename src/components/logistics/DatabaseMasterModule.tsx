import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { 
  Database, Package, Truck, Search, Plus, Upload, Download, RefreshCw, 
  Trash2, Edit3, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, 
  ShieldAlert, ShieldCheck, ArrowUpDown, Filter, Check, X, 
  Barcode, Layers, HelpCircle, FileDown, Eye, Copy, ExternalLink, Sparkles,
  CloudUpload, Server, Terminal, Info
} from 'lucide-react';
import { DataBarang, DataDistributor } from '../../types';
import { supabase, isSupabaseConfigured, supabaseUrl, fetchAllRowsFromSupabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const CACHE_KEY_BARANG = 'ckb_master_data_barang_cache';
const CACHE_KEY_DISTRIBUTOR = 'ckb_master_data_distributor_cache';

export function DatabaseMasterModule() {
  const { currentUser, isAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();

  // Active sub-tab: 'barang' | 'distributor'
  const [activeTab, setActiveTab] = useState<'barang' | 'distributor'>('barang');

  // Master Data States (Initialized as empty or from cached local database)
  const [barangList, setBarangList] = useState<DataBarang[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_BARANG);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [distributorList, setDistributorList] = useState<DataDistributor[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_DISTRIBUTOR);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [dbSynced, setDbSynced] = useState(isSupabaseConfigured);
  const [isPushingToSupabase, setIsPushingToSupabase] = useState(false);
  const [showSqlSetupModal, setShowSqlSetupModal] = useState(false);
  const [lastSupabaseError, setLastSupabaseError] = useState<string | null>(null);

  // Search & Filters
  const [searchBarang, setSearchBarang] = useState('');
  const [filterStatusBarang, setFilterStatusBarang] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');
  const [pageBarang, setPageBarang] = useState(1);
  const [rowsPerPageBarang, setRowsPerPageBarang] = useState(10);
  const [selectedBarangCodes, setSelectedBarangCodes] = useState<string[]>([]);

  const [searchDistributor, setSearchDistributor] = useState('');
  const [filterStatusDistributor, setFilterStatusDistributor] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');
  const [pageDistributor, setPageDistributor] = useState(1);
  const [rowsPerPageDistributor, setRowsPerPageDistributor] = useState(10);
  const [selectedDistributorCodes, setSelectedDistributorCodes] = useState<string[]>([]);

  // Modals
  const [showBarangModal, setShowBarangModal] = useState(false);
  const [editingBarang, setEditingBarang] = useState<DataBarang | null>(null);
  const [barangForm, setBarangForm] = useState({
    item_code: '',
    barcode: '',
    item_name: '',
    status: 'Aktif' as 'Aktif' | 'Nonaktif'
  });

  const [showDistributorModal, setShowDistributorModal] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState<DataDistributor | null>(null);
  const [distributorForm, setDistributorForm] = useState({
    kode_ld: '',
    nama_distributor: '',
    status: 'Aktif' as 'Aktif' | 'Nonaktif'
  });

  // Excel Upload States
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelTarget, setExcelTarget] = useState<'barang' | 'distributor'>('barang');
  const [parsedExcelRows, setParsedExcelRows] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to cache
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY_BARANG, JSON.stringify(barangList));
    } catch {
      // ignore
    }
  }, [barangList]);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY_DISTRIBUTOR, JSON.stringify(distributorList));
    } catch {
      // ignore
    }
  }, [distributorList]);

  // =========================================================================
  // FETCH DATA FROM SUPABASE (PAGINATED CHUNKS - NO 1000 ROWS LIMIT)
  // =========================================================================
  const fetchDataBarang = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const data = await fetchAllRowsFromSupabase<DataBarang>('data_barang', {
        orderBy: 'item_code',
        ascending: true
      });

      if (data && data.length > 0) {
        setDbSynced(true);
        setBarangList(data);
      }
    } catch (err) {
      console.warn('Error fetching data_barang from Supabase:', err);
    }
  }, []);

  const fetchDataDistributor = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const data = await fetchAllRowsFromSupabase<DataDistributor>('data_distributor', {
        orderBy: 'kode_ld',
        ascending: true
      });

      if (data && data.length > 0) {
        setDbSynced(true);
        setDistributorList(data);
      }
    } catch (err) {
      console.warn('Error fetching data_distributor from Supabase:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDataBarang(), fetchDataDistributor()]);
    setLoading(false);
    showToast('Tersinkron', 'Data master berhasil diperbarui dari Supabase', 'info');
  }, [fetchDataBarang, fetchDataDistributor, showToast]);

  useEffect(() => {
    fetchDataBarang();
    fetchDataDistributor();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('master_database_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_barang' }, () => {
          fetchDataBarang();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'data_distributor' }, () => {
          fetchDataDistributor();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchDataBarang, fetchDataDistributor]);

  // =========================================================================
  // SUPERADMIN SECURITY CHECK
  // =========================================================================
  const isSuperAdmin = isAdmin || currentUser?.username?.toLowerCase() === 'superadmin' || currentUser?.role === 'Admin';

  if (!isSuperAdmin) {
    return (
      <div className="p-6 sm:p-10 rounded-3xl bg-white border border-rose-200 shadow-xl text-center max-w-2xl mx-auto my-8 space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert size={36} className="animate-pulse" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Akses Khusus Super Admin
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Menu <strong>Database Master (data_barang & data_distributor)</strong> diproteksi dan hanya dapat diakses oleh akun dengan level otoritas <strong>Super Admin</strong>.
        </p>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>Silakan hubungi administrator sistem atau login menggunakan akun Super Admin.</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CRUD: DATA BARANG
  // =========================================================================
  const handleOpenAddBarang = () => {
    setEditingBarang(null);
    setBarangForm({
      item_code: '',
      barcode: '',
      item_name: '',
      status: 'Aktif'
    });
    setShowBarangModal(true);
  };

  const handleOpenEditBarang = (item: DataBarang) => {
    setEditingBarang(item);
    setBarangForm({
      item_code: item.item_code,
      barcode: item.barcode || '',
      item_name: item.item_name,
      status: item.status
    });
    setShowBarangModal(true);
  };

  const handleSaveBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = barangForm.item_code.trim();
    const cleanName = barangForm.item_name.trim();
    const cleanBarcode = barangForm.barcode.trim();

    if (!cleanCode || !cleanName) {
      showToast('Form Tidak Lengkap', 'Item Code dan Nama Barang wajib diisi!', 'warning');
      return;
    }

    // Check duplicate code on Add
    if (!editingBarang && barangList.some(b => b.item_code.toLowerCase() === cleanCode.toLowerCase())) {
      showToast('Duplikat', `Item Code "${cleanCode}" sudah terdaftar di database!`, 'danger');
      return;
    }

    const payload: DataBarang = {
      item_code: cleanCode,
      barcode: cleanBarcode || undefined,
      item_name: cleanName,
      status: barangForm.status,
      updated_at: new Date().toISOString()
    };

    if (!editingBarang) {
      payload.created_at = new Date().toISOString();
    }

    // 1. Optimistic state
    if (editingBarang) {
      setBarangList(prev => prev.map(b => b.item_code === editingBarang.item_code ? { ...b, ...payload } : b));
    } else {
      setBarangList(prev => [payload, ...prev]);
    }

    setShowBarangModal(false);

    // 2. Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        if (editingBarang) {
          const { error } = await supabase
            .from('data_barang')
            .update({
              barcode: payload.barcode || null,
              item_name: payload.item_name,
              status: payload.status,
              updated_at: payload.updated_at
            })
            .eq('item_code', editingBarang.item_code);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('data_barang')
            .insert([{
              item_code: payload.item_code,
              barcode: payload.barcode || null,
              item_name: payload.item_name,
              status: payload.status,
              created_at: payload.created_at,
              updated_at: payload.updated_at
            }]);

          if (error) throw error;
        }
        showToast('Berhasil Disimpan', `Barang ${cleanName} berhasil disimpan ke Supabase!`, 'success');
      } catch (err: any) {
        console.error('Error saving data_barang to Supabase:', err);
        showToast('Catatan', `Tersimpan di memori lokal. (Supabase error: ${err.message || 'offline'})`, 'info');
      }
    } else {
      showToast('Tersimpan', `Data barang ${cleanName} berhasil disimpan`, 'success');
    }
  };

  const handleDeleteBarang = (itemCode: string, itemName: string) => {
    showConfirm({
      title: 'Hapus Master Barang',
      message: `Apakah Anda yakin ingin menghapus "${itemName}" (${itemCode}) dari database? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        // Save previous for rollback if cloud error
        const prevBarang = [...barangList];
        
        // Optimistic update
        setBarangList(prev => prev.filter(b => b.item_code !== itemCode));
        setSelectedBarangCodes(prev => prev.filter(c => c !== itemCode));

        if (isSupabaseConfigured) {
          try {
            const { error } = await supabase.from('data_barang').delete().eq('item_code', itemCode);
            if (error) {
              console.error('Error deleting from data_barang:', error);
              showToast('Gagal Hapus Cloud', `Gagal menghapus dari database cloud: ${error.message}`, 'danger');
              setBarangList(prevBarang);
              fetchDataBarang();
              return;
            }
            showToast('Berhasil Dihapus', `Barang ${itemCode} berhasil dihapus dari database`, 'success');
          } catch (err: any) {
            console.error('Error deleting from data_barang:', err);
            showToast('Peringatan', `Terhapus di lokal. (${err.message || 'Offline'})`, 'info');
          }
        } else {
          showToast('Terhapus', `Barang ${itemCode} berhasil dihapus dari penyimpanan lokal`, 'info');
        }
      }
    });
  };

  const handleBatchDeleteBarang = () => {
    if (selectedBarangCodes.length === 0) return;

    const count = selectedBarangCodes.length;
    showConfirm({
      title: 'Hapus Massal Barang',
      message: `Apakah Anda yakin ingin menghapus ${count} barang terpilih dari database? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: `Ya, Hapus ${count} Barang`,
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const codesToDelete = [...selectedBarangCodes];
        const prevBarang = [...barangList];
        
        // Optimistic update
        setBarangList(prev => prev.filter(b => !codesToDelete.includes(b.item_code)));
        setSelectedBarangCodes([]);

        if (isSupabaseConfigured) {
          try {
            // Chunk deletions in batches of 50 to prevent PostgREST URL length limit
            const chunks = chunkArray(codesToDelete, 50);
            let deletedCount = 0;
            let hadError = false;

            for (const chunk of chunks) {
              const { error } = await supabase.from('data_barang').delete().in('item_code', chunk);
              if (error) {
                console.error('Error batch deleting barang chunk:', error);
                hadError = true;
              } else {
                deletedCount += chunk.length;
              }
            }

            if (hadError && deletedCount < codesToDelete.length) {
              showToast('Sebagian Terhapus', `${deletedCount} dari ${codesToDelete.length} barang berhasil dihapus dari database cloud.`, 'warning');
              fetchDataBarang();
            } else {
              showToast('Sukses Hapus Massal', `${deletedCount} barang terpilih berhasil dihapus dari Database Cloud!`, 'success');
            }
          } catch (err: any) {
            console.error('Error batch deleting barang:', err);
            showToast('Peringatan', `Terhapus di lokal. (${err.message || 'Offline'})`, 'info');
          }
        } else {
          showToast('Sukses', `${codesToDelete.length} barang berhasil dihapus`, 'success');
        }
      }
    });
  };

  // Reset / Wipe All Barang (Super Admin Danger Tool)
  const handleClearAllBarang = () => {
    if (barangList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data master barang untuk dihapus', 'info');
      return;
    }

    const total = barangList.length;
    showConfirm({
      title: 'KOSONGKAN SELURUH MASTER BARANG',
      message: `PERINGATAN TINGGI: Anda akan menghapus SEMUA ${total} master barang dari aplikasi dan Database Cloud! Tindakan ini HANYA boleh dilakukan saat reset data dan TIDAK DAPAT DIBATALKAN. Lanjutkan?`,
      confirmText: `Hapus Semua (${total} Item)`,
      cancelText: 'Batal / Amankan Data',
      type: 'danger',
      onConfirm: async () => {
        const allCodes = barangList.map(b => b.item_code);
        setBarangList([]);
        setSelectedBarangCodes([]);

        if (isSupabaseConfigured) {
          try {
            const chunks = chunkArray(allCodes, 50);
            for (const chunk of chunks) {
              await supabase.from('data_barang').delete().in('item_code', chunk);
            }
            showToast('Terkosongkan', `Seluruh ${total} master barang berhasil dibersihkan dari database!`, 'success');
            fetchDataBarang();
          } catch (err: any) {
            console.error('Error clearing data_barang:', err);
            showToast('Peringatan', `Data dibersihkan di lokal. (${err.message || 'Offline'})`, 'warning');
          }
        } else {
          showToast('Terkosongkan', `Semua ${total} master barang berhasil dihapus dari lokal`, 'info');
        }
      }
    });
  };

  // Batch Update Status Barang
  const handleBatchSetStatusBarang = async (newStatus: 'Aktif' | 'Nonaktif') => {
    if (selectedBarangCodes.length === 0) return;

    const count = selectedBarangCodes.length;
    const codes = [...selectedBarangCodes];

    setBarangList(prev => prev.map(b => codes.includes(b.item_code) ? { ...b, status: newStatus, updated_at: new Date().toISOString() } : b));
    setSelectedBarangCodes([]);

    if (isSupabaseConfigured) {
      try {
        const chunks = chunkArray(codes, 50);
        for (const chunk of chunks) {
          await supabase.from('data_barang').update({ status: newStatus, updated_at: new Date().toISOString() }).in('item_code', chunk);
        }
        showToast('Status Diperbarui', `Status ${count} barang diubah menjadi "${newStatus}"`, 'success');
        fetchDataBarang();
      } catch (err: any) {
        showToast('Peringatan', `Status diperbarui lokal. (${err.message || 'Offline'})`, 'info');
      }
    } else {
      showToast('Status Diperbarui', `Status ${count} barang diubah menjadi "${newStatus}"`, 'success');
    }
  };

  // =========================================================================
  // CRUD: DATA DISTRIBUTOR
  // =========================================================================
  const handleOpenAddDistributor = () => {
    setEditingDistributor(null);
    setDistributorForm({
      kode_ld: '',
      nama_distributor: '',
      status: 'Aktif'
    });
    setShowDistributorModal(true);
  };

  const handleOpenEditDistributor = (item: DataDistributor) => {
    setEditingDistributor(item);
    setDistributorForm({
      kode_ld: item.kode_ld,
      nama_distributor: item.nama_distributor,
      status: item.status
    });
    setShowDistributorModal(true);
  };

  const handleSaveDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKode = distributorForm.kode_ld.trim();
    const cleanNama = distributorForm.nama_distributor.trim();

    if (!cleanKode || !cleanNama) {
      showToast('Form Belum Lengkap', 'Kode LD dan Nama Distributor wajib diisi!', 'warning');
      return;
    }

    if (!editingDistributor && distributorList.some(d => d.kode_ld.toLowerCase() === cleanKode.toLowerCase())) {
      showToast('Duplikat', `Kode LD "${cleanKode}" sudah terdaftar di database!`, 'danger');
      return;
    }

    const payload: DataDistributor = {
      kode_ld: cleanKode,
      nama_distributor: cleanNama,
      status: distributorForm.status,
      updated_at: new Date().toISOString()
    };

    if (!editingDistributor) {
      payload.created_at = new Date().toISOString();
    }

    if (editingDistributor) {
      setDistributorList(prev => prev.map(d => d.kode_ld === editingDistributor.kode_ld ? { ...d, ...payload } : d));
    } else {
      setDistributorList(prev => [payload, ...prev]);
    }

    setShowDistributorModal(false);

    if (isSupabaseConfigured) {
      try {
        if (editingDistributor) {
          const { error } = await supabase
            .from('data_distributor')
            .update({
              nama_distributor: payload.nama_distributor,
              status: payload.status,
              updated_at: payload.updated_at
            })
            .eq('kode_ld', editingDistributor.kode_ld);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('data_distributor')
            .insert([{
              kode_ld: payload.kode_ld,
              nama_distributor: payload.nama_distributor,
              status: payload.status,
              created_at: payload.created_at,
              updated_at: payload.updated_at
            }]);

          if (error) throw error;
        }
        showToast('Berhasil Disimpan', `Distributor ${cleanNama} berhasil disimpan ke Supabase!`, 'success');
      } catch (err: any) {
        console.error('Error saving data_distributor to Supabase:', err);
        showToast('Catatan', `Tersimpan di memori lokal. (Supabase error: ${err.message || 'offline'})`, 'info');
      }
    } else {
      showToast('Tersimpan', `Data distributor ${cleanNama} berhasil disimpan`, 'success');
    }
  };

  const handleDeleteDistributor = (kodeLd: string, namaDistributor: string) => {
    showConfirm({
      title: 'Hapus Distributor',
      message: `Apakah Anda yakin ingin menghapus distributor "${namaDistributor}" (${kodeLd}) dari database?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const prevDist = [...distributorList];
        setDistributorList(prev => prev.filter(d => d.kode_ld !== kodeLd));
        setSelectedDistributorCodes(prev => prev.filter(c => c !== kodeLd));

        if (isSupabaseConfigured) {
          try {
            const { error } = await supabase.from('data_distributor').delete().eq('kode_ld', kodeLd);
            if (error) {
              console.error('Error deleting from data_distributor:', error);
              showToast('Gagal Hapus Cloud', `Gagal menghapus dari database cloud: ${error.message}`, 'danger');
              setDistributorList(prevDist);
              fetchDataDistributor();
              return;
            }
            showToast('Berhasil Dihapus', `Distributor ${kodeLd} berhasil dihapus dari database`, 'success');
          } catch (err: any) {
            console.error('Error deleting from data_distributor:', err);
            showToast('Peringatan', `Terhapus di lokal. (${err.message || 'Offline'})`, 'info');
          }
        } else {
          showToast('Terhapus', `Distributor ${kodeLd} berhasil dihapus dari penyimpanan lokal`, 'info');
        }
      }
    });
  };

  const handleBatchDeleteDistributor = () => {
    if (selectedDistributorCodes.length === 0) return;

    const count = selectedDistributorCodes.length;
    showConfirm({
      title: 'Hapus Massal Distributor',
      message: `Apakah Anda yakin ingin menghapus ${count} distributor terpilih dari database?`,
      confirmText: `Ya, Hapus ${count} Distributor`,
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: async () => {
        const codesToDelete = [...selectedDistributorCodes];
        setDistributorList(prev => prev.filter(d => !codesToDelete.includes(d.kode_ld)));
        setSelectedDistributorCodes([]);

        if (isSupabaseConfigured) {
          try {
            const chunks = chunkArray(codesToDelete, 50);
            let deletedCount = 0;
            let hadError = false;

            for (const chunk of chunks) {
              const { error } = await supabase.from('data_distributor').delete().in('kode_ld', chunk);
              if (error) {
                console.error('Error batch deleting distributor chunk:', error);
                hadError = true;
              } else {
                deletedCount += chunk.length;
              }
            }

            if (hadError && deletedCount < codesToDelete.length) {
              showToast('Sebagian Terhapus', `${deletedCount} dari ${codesToDelete.length} distributor berhasil dihapus dari database cloud.`, 'warning');
              fetchDataDistributor();
            } else {
              showToast('Sukses Hapus Massal', `${deletedCount} distributor terpilih berhasil dihapus dari Database Cloud!`, 'success');
            }
          } catch (err: any) {
            console.error('Error batch deleting distributor:', err);
            showToast('Peringatan', `Terhapus di lokal. (${err.message || 'Offline'})`, 'info');
          }
        } else {
          showToast('Sukses', `${codesToDelete.length} distributor berhasil dihapus`, 'success');
        }
      }
    });
  };

  // Reset / Wipe All Distributor (Super Admin Danger Tool)
  const handleClearAllDistributor = () => {
    if (distributorList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data master distributor untuk dihapus', 'info');
      return;
    }

    const total = distributorList.length;
    showConfirm({
      title: 'KOSONGKAN SELURUH MASTER DISTRIBUTOR',
      message: `PERINGATAN TINGGI: Anda akan menghapus SEMUA ${total} master distributor dari aplikasi dan Database Cloud! Tindakan ini TIDAK DAPAT DIBATALKAN. Lanjutkan?`,
      confirmText: `Hapus Semua (${total} Distributor)`,
      cancelText: 'Batal / Amankan Data',
      type: 'danger',
      onConfirm: async () => {
        const allCodes = distributorList.map(d => d.kode_ld);
        setDistributorList([]);
        setSelectedDistributorCodes([]);

        if (isSupabaseConfigured) {
          try {
            const chunks = chunkArray(allCodes, 50);
            for (const chunk of chunks) {
              await supabase.from('data_distributor').delete().in('kode_ld', chunk);
            }
            showToast('Terkosongkan', `Seluruh ${total} master distributor berhasil dibersihkan dari database!`, 'success');
            fetchDataDistributor();
          } catch (err: any) {
            console.error('Error clearing data_distributor:', err);
            showToast('Peringatan', `Data dibersihkan di lokal. (${err.message || 'Offline'})`, 'warning');
          }
        } else {
          showToast('Terkosongkan', `Semua ${total} master distributor berhasil dihapus dari lokal`, 'info');
        }
      }
    });
  };

  // Batch Update Status Distributor
  const handleBatchSetStatusDistributor = async (newStatus: 'Aktif' | 'Nonaktif') => {
    if (selectedDistributorCodes.length === 0) return;

    const count = selectedDistributorCodes.length;
    const codes = [...selectedDistributorCodes];

    setDistributorList(prev => prev.map(d => codes.includes(d.kode_ld) ? { ...d, status: newStatus, updated_at: new Date().toISOString() } : d));
    setSelectedDistributorCodes([]);

    if (isSupabaseConfigured) {
      try {
        const chunks = chunkArray(codes, 50);
        for (const chunk of chunks) {
          await supabase.from('data_distributor').update({ status: newStatus, updated_at: new Date().toISOString() }).in('kode_ld', chunk);
        }
        showToast('Status Diperbarui', `Status ${count} distributor diubah menjadi "${newStatus}"`, 'success');
        fetchDataDistributor();
      } catch (err: any) {
        showToast('Peringatan', `Status diperbarui lokal. (${err.message || 'Offline'})`, 'info');
      }
    } else {
      showToast('Status Diperbarui', `Status ${count} distributor diubah menjadi "${newStatus}"`, 'success');
    }
  };

  // =========================================================================
  // EXPORT EXCEL (.xlsx)
  // =========================================================================
  const exportBarangToExcel = () => {
    if (filteredBarang.length === 0) {
      showToast('Data Kosong', 'Tidak ada data barang untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredBarang.map((item, idx) => ({
      'No': idx + 1,
      'Item Code': item.item_code,
      'Barcode': item.barcode || '',
      'Nama Barang': item.item_name,
      'Status': item.status,
      'Tanggal Dibuat': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      'Tanggal Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);

    // Auto-fit column widths
    const wscols = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 45 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data_barang');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Data_Barang_${dateStr}.xlsx`);
    showToast('Download Selesai', `File Master_Data_Barang_${dateStr}.xlsx berhasil diunduh!`, 'success');
  };

  const exportDistributorToExcel = () => {
    if (filteredDistributor.length === 0) {
      showToast('Data Kosong', 'Tidak ada data distributor untuk diekspor', 'warning');
      return;
    }

    const exportRows = filteredDistributor.map((item, idx) => ({
      'No': idx + 1,
      'Kode LD': item.kode_ld,
      'Nama Distributor': item.nama_distributor,
      'Status': item.status,
      'Tanggal Dibuat': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      'Tanggal Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wscols = [
      { wch: 6 },
      { wch: 16 },
      { wch: 45 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data_distributor');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Data_Distributor_${dateStr}.xlsx`);
    showToast('Download Selesai', `File Master_Data_Distributor_${dateStr}.xlsx berhasil diunduh!`, 'success');
  };

  const exportSelectedBarangToExcel = () => {
    if (selectedBarangCodes.length === 0) return;
    const selectedItems = barangList.filter(b => selectedBarangCodes.includes(b.item_code));

    const exportRows = selectedItems.map((item, idx) => ({
      'No': idx + 1,
      'Item Code': item.item_code,
      'Barcode': item.barcode || '',
      'Nama Barang': item.item_name,
      'Status': item.status,
      'Tanggal Dibuat': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      'Tanggal Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wscols = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 45 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data_barang_terpilih');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Barang_Terpilih_${dateStr}.xlsx`);
    showToast('Download Selesai', `${selectedItems.length} barang terpilih berhasil diunduh ke Excel!`, 'success');
  };

  const exportSelectedDistributorToExcel = () => {
    if (selectedDistributorCodes.length === 0) return;
    const selectedItems = distributorList.filter(d => selectedDistributorCodes.includes(d.kode_ld));

    const exportRows = selectedItems.map((item, idx) => ({
      'No': idx + 1,
      'Kode LD': item.kode_ld,
      'Nama Distributor': item.nama_distributor,
      'Status': item.status,
      'Tanggal Dibuat': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
      'Tanggal Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wscols = [
      { wch: 6 },
      { wch: 16 },
      { wch: 45 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data_distributor_terpilih');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Distributor_Terpilih_${dateStr}.xlsx`);
    showToast('Download Selesai', `${selectedItems.length} distributor terpilih berhasil diunduh ke Excel!`, 'success');
  };

  // =========================================================================
  // IMPORT EXCEL (.xlsx / .xls / .csv)
  // =========================================================================
  const handleOpenExcelModal = (target: 'barang' | 'distributor') => {
    setExcelTarget(target);
    setParsedExcelRows([]);
    setExcelFileName('');
    setShowExcelModal(true);
  };

  const downloadExcelTemplate = (target: 'barang' | 'distributor') => {
    if (target === 'barang') {
      const templateData = [
        { 'Item Code': '21104508', 'Barcode': '8992775010080', 'Nama Barang': 'KINO CANDY MINT 150G', 'Status': 'Aktif' },
        { 'Item Code': '21104509', 'Barcode': '8992775010097', 'Nama Barang': 'CAP KAKI TIGA GUAVA 320ML', 'Status': 'Aktif' },
        { 'Item Code': '21104510', 'Barcode': '8992775010103', 'Nama Barang': 'ELLIPS HAIR VITAMIN SMOOTH 50S', 'Status': 'Nonaktif' }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 35 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Barang');
      XLSX.writeFile(wb, 'Template_Import_Data_Barang.xlsx');
    } else {
      const templateData = [
        { 'Kode LD': 'LD-007', 'Nama Distributor': 'PT SINAR NIAGA LOGISTIK', 'Status': 'Aktif' },
        { 'Kode LD': 'LD-008', 'Nama Distributor': 'PT MITRA DISTRIBUSI SEJAHTERA', 'Status': 'Aktif' },
        { 'Kode LD': 'LD-009', 'Nama Distributor': 'CV SUKABUMI JAYA ABADI', 'Status': 'Nonaktif' }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Distributor');
      XLSX.writeFile(wb, 'Template_Import_Data_Distributor.xlsx');
    }
    showToast('Template Terunduh', 'Template Excel siap diisi dan diupload kembali', 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsProcessingExcel(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Kosong', 'File Excel tidak memiliki baris data!', 'warning');
          setParsedExcelRows([]);
          return;
        }

        const normalizeKey = (key: string) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (excelTarget === 'barang') {
          const rawBarangList: DataBarang[] = rawJson.map((row) => {
            const normalizedRow: Record<string, any> = {};
            Object.keys(row).forEach(k => {
              normalizedRow[normalizeKey(k)] = row[k];
            });

            // Find Item Code
            let item_code = '';
            const codeKeys = ['itemcode', 'material', 'kodebarang', 'kode', 'sku', 'item', 'partnumber', 'article'];
            for (const k of codeKeys) {
              if (normalizedRow[k]) {
                item_code = String(normalizedRow[k]).trim();
                break;
              }
            }
            if (!item_code) {
              const foundKey = Object.keys(normalizedRow).find(k => k.includes('item') || k.includes('code') || k.includes('kode') || k.includes('sku') || k.includes('mat'));
              if (foundKey) item_code = String(normalizedRow[foundKey]).trim();
            }

            // Find Barcode
            let barcode = '';
            const barcodeKeys = ['barcode', 'barcodebarang', 'ean', 'ean13', 'upc', 'bar'];
            for (const k of barcodeKeys) {
              if (normalizedRow[k]) {
                barcode = String(normalizedRow[k]).trim();
                break;
              }
            }

            // Find Item Name
            let item_name = '';
            const nameKeys = ['namabarang', 'itemname', 'nama', 'deskripsi', 'description', 'productname', 'namaitem'];
            for (const k of nameKeys) {
              if (normalizedRow[k]) {
                item_name = String(normalizedRow[k]).trim();
                break;
              }
            }
            if (!item_name) {
              const foundKey = Object.keys(normalizedRow).find(k => k.includes('nama') || k.includes('name') || k.includes('desc'));
              if (foundKey) item_name = String(normalizedRow[foundKey]).trim();
            }

            // Find Status
            let rawStatus = 'Aktif';
            const statusKey = Object.keys(normalizedRow).find(k => k.includes('status') || k.includes('kondisi') || k.includes('isactive'));
            if (statusKey && normalizedRow[statusKey]) {
              rawStatus = String(normalizedRow[statusKey]).trim();
            }
            const status: 'Aktif' | 'Nonaktif' = rawStatus.toLowerCase().includes('non') || rawStatus.toLowerCase().includes('inact') || rawStatus === '0' || rawStatus.toLowerCase() === 'false' ? 'Nonaktif' : 'Aktif';

            return {
              item_code,
              barcode: barcode || undefined,
              item_name,
              status,
              created_at: new Date().toISOString()
            };
          }).filter(r => r.item_code && r.item_name);

          // Deduplicate parsed rows by item_code to prevent duplicates
          const barangMap = new Map<string, DataBarang>();
          rawBarangList.forEach(item => {
            const key = item.item_code.trim().toLowerCase();
            barangMap.set(key, { ...item, item_code: item.item_code.trim() });
          });
          const formatted = Array.from(barangMap.values());

          setParsedExcelRows(formatted);
          if (formatted.length > 0) {
            showToast('Excel Terbaca', `${formatted.length} baris data barang unik berhasil dimuat`, 'info');
          } else {
            showToast('Format Kolom Tidak Cocok', 'Kolom Item Code dan Nama Barang tidak ditemukan. Silakan unduh Template Excel.', 'warning');
          }
        } else {
          const rawDistributorList: DataDistributor[] = rawJson.map((row) => {
            const normalizedRow: Record<string, any> = {};
            Object.keys(row).forEach(k => {
              normalizedRow[normalizeKey(k)] = row[k];
            });

            // Find Kode LD
            let kode_ld = '';
            const ldKeys = ['kodeld', 'ld', 'kodedistributor', 'kodevendor', 'iddistributor', 'idvendor', 'kode', 'id', 'nold', 'nomorld'];
            for (const k of ldKeys) {
              if (normalizedRow[k]) {
                kode_ld = String(normalizedRow[k]).trim();
                break;
              }
            }
            if (!kode_ld) {
              const foundKey = Object.keys(normalizedRow).find(k => k.includes('ld') || k.includes('kode') || k.includes('id'));
              if (foundKey) kode_ld = String(normalizedRow[foundKey]).trim();
            }

            // Find Nama Distributor
            let nama_distributor = '';
            const nameKeys = ['namadistributor', 'distributor', 'namavendor', 'vendor', 'nama', 'name', 'distributorname', 'perusahaan', 'customer'];
            for (const k of nameKeys) {
              if (normalizedRow[k]) {
                nama_distributor = String(normalizedRow[k]).trim();
                break;
              }
            }
            if (!nama_distributor) {
              const foundKey = Object.keys(normalizedRow).find(k => k.includes('distributor') || k.includes('vendor') || k.includes('nama') || k.includes('name'));
              if (foundKey) nama_distributor = String(normalizedRow[foundKey]).trim();
            }

            // Find Status
            let rawStatus = 'Aktif';
            const statusKey = Object.keys(normalizedRow).find(k => k.includes('status') || k.includes('kondisi') || k.includes('isactive'));
            if (statusKey && normalizedRow[statusKey]) {
              rawStatus = String(normalizedRow[statusKey]).trim();
            }
            const status: 'Aktif' | 'Nonaktif' = rawStatus.toLowerCase().includes('non') || rawStatus.toLowerCase().includes('inact') || rawStatus === '0' || rawStatus.toLowerCase() === 'false' ? 'Nonaktif' : 'Aktif';

            return {
              kode_ld,
              nama_distributor,
              status,
              created_at: new Date().toISOString()
            };
          }).filter(r => r.kode_ld && r.nama_distributor);

          // Deduplicate parsed rows by kode_ld to prevent duplicates
          const distMap = new Map<string, DataDistributor>();
          rawDistributorList.forEach(item => {
            const key = item.kode_ld.trim().toLowerCase();
            distMap.set(key, { ...item, kode_ld: item.kode_ld.trim() });
          });
          const formatted = Array.from(distMap.values());

          setParsedExcelRows(formatted);
          if (formatted.length > 0) {
            showToast('Excel Terbaca', `${formatted.length} baris data distributor unik berhasil dimuat`, 'info');
          } else {
            showToast('Format Kolom Tidak Cocok', 'Kolom Kode LD dan Nama Distributor tidak terdeteksi. Silakan unduh Template Excel.', 'warning');
          }
        }
      } catch (err) {
        console.error('Error parsing excel:', err);
        showToast('Gagal Membaca Excel', 'Pastikan format file berupa tabel .xlsx/.xls yang valid', 'danger');
      } finally {
        setIsProcessingExcel(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Helper to chunk arrays for safe Supabase batch operations
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  // Safe Batch Upsert with guaranteed distinct keys per chunk + fallback item-by-item
  const safeBatchUpsert = async <T extends Record<string, any>>(
    tableName: string,
    items: T[],
    keyField: keyof T,
    chunkSize = 50
  ): Promise<{ successCount: number; error: any }> => {
    // 1. Strictly deduplicate items by keyField to eliminate "21000 ON CONFLICT DO UPDATE cannot affect row a second time"
    const uniqueMap = new Map<string, T>();
    for (const item of items) {
      const rawKey = item[keyField];
      if (rawKey !== undefined && rawKey !== null) {
        const cleanKey = String(rawKey).trim();
        if (cleanKey) {
          uniqueMap.set(cleanKey.toLowerCase(), {
            ...item,
            [keyField]: cleanKey
          });
        }
      }
    }

    const cleanItems = Array.from(uniqueMap.values());
    if (cleanItems.length === 0) return { successCount: 0, error: null };

    const chunks = chunkArray(cleanItems, chunkSize);
    let totalSuccess = 0;
    let lastErr: any = null;

    for (const chunk of chunks) {
      const { error } = await supabase
        .from(tableName)
        .upsert(chunk as any, { onConflict: String(keyField) });

      if (error) {
        console.warn(`Upsert warning on ${tableName} chunk, trying fallback item-by-item:`, error);
        // Fallback: execute row-by-row to guarantee saving all valid rows
        let fallbackSuccess = 0;
        for (const singleItem of chunk) {
          const { error: singleErr } = await supabase
            .from(tableName)
            .upsert([singleItem] as any, { onConflict: String(keyField) });

          if (!singleErr) {
            fallbackSuccess++;
          } else {
            lastErr = singleErr;
            console.error(`Single upsert failed on ${tableName}:`, singleErr);
          }
        }
        totalSuccess += fallbackSuccess;
        if (fallbackSuccess === 0) {
          lastErr = error;
          break;
        }
      } else {
        totalSuccess += chunk.length;
      }
    }

    return { successCount: totalSuccess, error: totalSuccess === cleanItems.length ? null : lastErr };
  };

  const handleCommitExcelImport = async () => {
    if (parsedExcelRows.length === 0) return;

    setIsProcessingExcel(true);

    try {
      if (excelTarget === 'barang') {
        const rows = parsedExcelRows as DataBarang[];
        
        // Merge with existing local state
        setBarangList(prev => {
          const map = new Map<string, DataBarang>();
          prev.forEach(item => map.set(item.item_code.trim().toLowerCase(), item));
          rows.forEach(item => map.set(item.item_code.trim().toLowerCase(), item));
          return Array.from(map.values());
        });

        // Upsert to Supabase with deduplicated payload
        if (isSupabaseConfigured) {
          const supabasePayload = rows.map(r => ({
            item_code: r.item_code.trim(),
            barcode: r.barcode?.trim() || null,
            item_name: r.item_name.trim(),
            status: r.status,
            updated_at: new Date().toISOString()
          }));

          const { successCount, error } = await safeBatchUpsert('data_barang', supabasePayload, 'item_code', 50);

          if (error && successCount === 0) {
            console.error('Upsert error on data_barang:', error);
            setLastSupabaseError(error.message || JSON.stringify(error));
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
              setShowSqlSetupModal(true);
            }
            showToast('Peringatan Database', `Tersimpan di aplikasi, namun gagal terkirim ke database cloud. Cek Setup Database.`, 'warning');
          } else {
            showToast('Import Selesai', `Berhasil mengimpor & menyimpan ${successCount} data barang ke Database Cloud!`, 'success');
            fetchDataBarang();
          }
        } else {
          showToast('Import Lokal Selesai', `${rows.length} data barang tersimpan di aplikasi (Penyimpanan Lokal)`, 'info');
        }
      } else {
        const rows = parsedExcelRows as DataDistributor[];

        // Merge with existing local state
        setDistributorList(prev => {
          const map = new Map<string, DataDistributor>();
          prev.forEach(item => map.set(item.kode_ld.trim().toLowerCase(), item));
          rows.forEach(item => map.set(item.kode_ld.trim().toLowerCase(), item));
          return Array.from(map.values());
        });

        // Upsert to Cloud Database with deduplicated payload
        if (isSupabaseConfigured) {
          const supabasePayload = rows.map(r => ({
            kode_ld: r.kode_ld.trim(),
            nama_distributor: r.nama_distributor.trim(),
            status: r.status,
            updated_at: new Date().toISOString()
          }));

          const { successCount, error } = await safeBatchUpsert('data_distributor', supabasePayload, 'kode_ld', 50);

          if (error && successCount === 0) {
            console.error('Upsert error on data_distributor:', error);
            setLastSupabaseError(error.message || JSON.stringify(error));
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
              setShowSqlSetupModal(true);
            }
            showToast('Peringatan Database', `Data masuk ke aplikasi, namun gagal masuk ke database cloud. Klik "Setup Database".`, 'danger');
          } else {
            showToast('Sukses Sinkronisasi', `Berhasil mengimpor & menyimpan ${successCount} data distributor ke Database Cloud!`, 'success');
            fetchDataDistributor();
          }
        } else {
          showToast('Import Lokal Selesai', `${rows.length} data distributor masuk ke aplikasi (Penyimpanan Lokal)`, 'info');
        }
      }

      setShowExcelModal(false);
      setParsedExcelRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Error importing excel:', err);
      showToast('Terjadi Kendala', err.message || 'Gagal menyimpan data import', 'danger');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Push all existing Distributor records from local state into Cloud Database
  const handlePushAllDistributorToSupabase = async () => {
    if (distributorList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data distributor untuk disinkronkan ke database', 'warning');
      return;
    }

    if (!isSupabaseConfigured) {
      showToast('Koneksi Belum Ada', 'Koneksi database cloud belum terkonfigurasi pada aplikasi', 'warning');
      setShowSqlSetupModal(true);
      return;
    }

    setIsPushingToSupabase(true);
    try {
      const payload = distributorList.map(d => ({
        kode_ld: d.kode_ld.trim(),
        nama_distributor: d.nama_distributor.trim(),
        status: d.status,
        updated_at: new Date().toISOString()
      }));

      const { successCount, error } = await safeBatchUpsert('data_distributor', payload, 'kode_ld', 50);

      if (error && successCount === 0) {
        console.error('Push error on data_distributor:', error);
        setLastSupabaseError(error.message || JSON.stringify(error));
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setShowSqlSetupModal(true);
        }
        showToast('Gagal Sinkronisasi Cloud', `Terjadi kendala saat mengirim ke database: ${lastSupabaseError || 'Periksa Setup Database'}`, 'danger');
      } else {
        showToast('Sinkronisasi Sukses', `Semua ${successCount} data distributor berhasil disinkronkan ke Database Cloud!`, 'success');
        setDbSynced(true);
        fetchDataDistributor();
      }
    } catch (err: any) {
      console.error('Fatal error pushing distributor:', err);
      showToast('Gagal', err.message || 'Terjadi kesalahan sistem saat kirim data', 'danger');
    } finally {
      setIsPushingToSupabase(false);
    }
  };

  // Push all existing Barang records from local state into Cloud Database
  const handlePushAllBarangToSupabase = async () => {
    if (barangList.length === 0) {
      showToast('Data Kosong', 'Tidak ada data barang untuk disinkronkan ke database', 'warning');
      return;
    }

    if (!isSupabaseConfigured) {
      showToast('Koneksi Belum Ada', 'Koneksi database cloud belum terkonfigurasi pada aplikasi', 'warning');
      setShowSqlSetupModal(true);
      return;
    }

    setIsPushingToSupabase(true);
    try {
      const payload = barangList.map(b => ({
        item_code: b.item_code.trim(),
        barcode: b.barcode?.trim() || null,
        item_name: b.item_name.trim(),
        status: b.status,
        updated_at: new Date().toISOString()
      }));

      const { successCount, error } = await safeBatchUpsert('data_barang', payload, 'item_code', 50);

      if (error && successCount === 0) {
        console.error('Push error on data_barang:', error);
        setLastSupabaseError(error.message || JSON.stringify(error));
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setShowSqlSetupModal(true);
        }
        showToast('Gagal Sinkronisasi Cloud', `Terjadi kendala saat mengirim ke database: ${lastSupabaseError || 'Periksa Setup Database'}`, 'danger');
      } else {
        showToast('Sinkronisasi Sukses', `Semua ${successCount} data barang berhasil disinkronkan ke Database Cloud!`, 'success');
        setDbSynced(true);
        fetchDataBarang();
      }
    } catch (err: any) {
      console.error('Fatal error pushing barang:', err);
      showToast('Gagal', err.message || 'Terjadi kesalahan sistem saat kirim data', 'danger');
    } finally {
      setIsPushingToSupabase(false);
    }
  };

  // =========================================================================
  // FILTERED DATA & STATS
  // =========================================================================
  const filteredBarang = useMemo(() => {
    return barangList.filter(item => {
      const matchSearch = 
        item.item_code.toLowerCase().includes(searchBarang.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchBarang.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchBarang.toLowerCase()));
      
      const matchStatus = filterStatusBarang === 'all' || item.status === filterStatusBarang;
      return matchSearch && matchStatus;
    });
  }, [barangList, searchBarang, filterStatusBarang]);

  const paginatedBarang = useMemo(() => {
    const start = (pageBarang - 1) * rowsPerPageBarang;
    return filteredBarang.slice(start, start + rowsPerPageBarang);
  }, [filteredBarang, pageBarang, rowsPerPageBarang]);

  const totalPagesBarang = Math.ceil(filteredBarang.length / rowsPerPageBarang) || 1;

  const filteredDistributor = useMemo(() => {
    return distributorList.filter(item => {
      const matchSearch = 
        item.kode_ld.toLowerCase().includes(searchDistributor.toLowerCase()) ||
        item.nama_distributor.toLowerCase().includes(searchDistributor.toLowerCase());
      
      const matchStatus = filterStatusDistributor === 'all' || item.status === filterStatusDistributor;
      return matchSearch && matchStatus;
    });
  }, [distributorList, searchDistributor, filterStatusDistributor]);

  const paginatedDistributor = useMemo(() => {
    const start = (pageDistributor - 1) * rowsPerPageDistributor;
    return filteredDistributor.slice(start, start + rowsPerPageDistributor);
  }, [filteredDistributor, pageDistributor, rowsPerPageDistributor]);

  const totalPagesDistributor = Math.ceil(filteredDistributor.length / rowsPerPageDistributor) || 1;

  // Multi-select handlers
  const handleToggleSelectAllBarang = () => {
    if (selectedBarangCodes.length === paginatedBarang.length && paginatedBarang.length > 0) {
      setSelectedBarangCodes([]);
    } else {
      setSelectedBarangCodes(paginatedBarang.map(b => b.item_code));
    }
  };

  const handleSelectAllFilteredBarang = () => {
    if (selectedBarangCodes.length === filteredBarang.length) {
      setSelectedBarangCodes([]);
    } else {
      setSelectedBarangCodes(filteredBarang.map(b => b.item_code));
    }
  };

  const handleToggleSelectBarang = (code: string) => {
    setSelectedBarangCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleToggleSelectAllDistributor = () => {
    if (selectedDistributorCodes.length === paginatedDistributor.length && paginatedDistributor.length > 0) {
      setSelectedDistributorCodes([]);
    } else {
      setSelectedDistributorCodes(paginatedDistributor.map(d => d.kode_ld));
    }
  };

  const handleSelectAllFilteredDistributor = () => {
    if (selectedDistributorCodes.length === filteredDistributor.length) {
      setSelectedDistributorCodes([]);
    } else {
      setSelectedDistributorCodes(filteredDistributor.map(d => d.kode_ld));
    }
  };

  const handleToggleSelectDistributor = (code: string) => {
    setSelectedDistributorCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast('Tersalin', `${label} "${text}" disalin ke clipboard`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* TOP STATS & SUB-NAVIGATION BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-blue-300 shrink-0 shadow-inner">
            <Database size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white m-0">
                Database Master Barang & Distributor
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} /> Super Admin
              </span>
            </div>
            <p className="text-xs text-blue-200/80 font-medium m-0 mt-0.5">
              Kelola Master Data Barang & Distributor dengan Sinkronisasi Database Realtime
            </p>
          </div>
        </div>

        {/* Action Controls & Sync Status */}
        <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB SELECTOR (Data Barang vs Data Distributor) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('barang')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'barang'
              ? 'bg-blue-900 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Package size={16} />
          <span>1. Master Data Barang</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'barang' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 text-slate-700'}`}>
            {barangList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('distributor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'distributor'
              ? 'bg-blue-900 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Truck size={16} />
          <span>2. Master Data Distributor</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'distributor' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 text-slate-700'}`}>
            {distributorList.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MASTER DATA BARANG */}
      {/* ========================================================================= */}
      {activeTab === 'barang' && (
        <div className="space-y-4 animate-fade-in">
          {/* Action Toolbar: Search, Filters, Add, Excel */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            {/* Search Bar */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchBarang}
                  onChange={(e) => {
                    setSearchBarang(e.target.value);
                    setPageBarang(1);
                  }}
                  placeholder="Cari Item Code, Barcode, atau Nama Barang..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                {searchBarang && (
                  <button
                    type="button"
                    onClick={() => setSearchBarang('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={filterStatusBarang}
                onChange={(e) => {
                  setFilterStatusBarang(e.target.value as any);
                  setPageBarang(1);
                }}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={handleClearAllBarang}
                disabled={barangList.length === 0}
                className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 disabled:opacity-40 text-xs font-black shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Super Admin: Kosongkan seluruh master data barang"
              >
                <Trash2 size={13} className="text-rose-600" />
                <span className="hidden sm:inline">Reset / Kosongkan</span>
              </button>

              <button
                type="button"
                onClick={() => downloadExcelTemplate('barang')}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black shadow-2xs transition-all items-center gap-1.5 cursor-pointer"
                title="Download Template Format Excel untuk Import Data Barang"
              >
                <FileDown size={14} />
                <span>Template Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenExcelModal('barang')}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-xs transition-all items-center gap-1.5 cursor-pointer"
                title="Import data barang dari file Excel"
              >
                <Upload size={14} />
                <span>Upload Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePushAllBarangToSupabase}
                disabled={isPushingToSupabase || barangList.length === 0}
                className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Kirim dan sinkronkan semua data barang di tabel ke database cloud"
              >
                <CloudUpload size={14} className={isPushingToSupabase ? 'animate-bounce' : ''} />
                <span>{isPushingToSupabase ? 'Mengirim...' : 'Sinkron Database'}</span>
              </button>

              <button
                type="button"
                onClick={exportBarangToExcel}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-black shadow-xs transition-all items-center gap-1.5 cursor-pointer"
                title="Download data barang ke format Excel (.xlsx)"
              >
                <Download size={14} />
                <span>Download Excel</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddBarang}
                className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} className="stroke-[3]" />
                <span>Tambah Barang</span>
              </button>
            </div>
          </div>

          {/* Multi-selection Floating Action Bar for Data Barang */}
          {selectedBarangCodes.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-blue-900 text-white shadow-lg border border-blue-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-300 shrink-0 font-black text-xs">
                  {selectedBarangCodes.length}
                </div>
                <div>
                  <div className="text-xs font-black tracking-tight text-white flex items-center gap-2">
                    <span>{selectedBarangCodes.length} barang terpilih</span>
                    {selectedBarangCodes.length < filteredBarang.length && (
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredBarang}
                        className="text-[11px] text-blue-200 underline hover:text-white font-bold cursor-pointer"
                      >
                        Pilih semua ({filteredBarang.length}) hasil filter
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-blue-200/80 font-medium m-0">
                    Gunakan aksi massal di bawah untuk memproses sekaligus
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => handleBatchSetStatusBarang('Aktif')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Ubah semua barang terpilih menjadi Aktif"
                >
                  <CheckCircle2 size={13} />
                  <span>Set Aktif</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchSetStatusBarang('Nonaktif')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Ubah semua barang terpilih menjadi Nonaktif"
                >
                  <XCircle size={13} />
                  <span>Set Nonaktif</span>
                </button>

                <button
                  type="button"
                  onClick={exportSelectedBarangToExcel}
                  className="hidden lg:flex px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-bold transition-all items-center gap-1 cursor-pointer"
                  title="Download hanya barang terpilih ke Excel"
                >
                  <Download size={13} />
                  <span>Download Excel ({selectedBarangCodes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchDeleteBarang}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Hapus Terpilih</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBarangCodes([])}
                  className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Table Data Barang */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedBarangCodes.length > 0 && selectedBarangCodes.length === paginatedBarang.length}
                        onChange={handleToggleSelectAllBarang}
                        className="rounded border-slate-300 text-blue-900 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Item Code</th>
                    <th className="py-3 px-3">Barcode</th>
                    <th className="py-3 px-4">Nama Barang</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedBarang.length > 0 ? (
                    paginatedBarang.map((item, idx) => {
                      const isSelected = selectedBarangCodes.includes(item.item_code);
                      const rowNumber = (pageBarang - 1) * rowsPerPageBarang + idx + 1;

                      return (
                        <tr 
                          key={item.item_code}
                          className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectBarang(item.item_code)}
                              className="rounded border-slate-300 text-blue-900 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold text-blue-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{item.item_code}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.item_code, 'Item Code')}
                                className="text-slate-400 hover:text-blue-700 p-0.5 cursor-pointer"
                                title="Salin Item Code"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {item.barcode ? (
                              <div className="flex items-center gap-1.5">
                                <Barcode size={14} className="text-slate-400" />
                                <span>{item.barcode}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.item_name}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                item.status === 'Aktif'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {item.status === 'Aktif' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              <span>{item.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditBarang(item)}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit Data Barang"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBarang(item.item_code, item.item_name)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Hapus Barang"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Package size={36} className="mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">Tidak ada data barang yang ditemukan</p>
                          <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau tambah barang baru.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-slate-200/80 bg-slate-50/70 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <span>Menampilkan</span>
                <select
                  value={rowsPerPageBarang}
                  onChange={(e) => {
                    setRowsPerPageBarang(Number(e.target.value));
                    setPageBarang(1);
                  }}
                  className="py-1 px-2 rounded-lg bg-white border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={2500}>2500</option>
                  <option value={5000}>5000</option>
                </select>
                <span>dari <strong>{filteredBarang.length}</strong> total barang</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPageBarang(prev => Math.max(1, prev - 1))}
                  disabled={pageBarang === 1}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Hal {pageBarang} / {totalPagesBarang}
                </span>
                <button
                  type="button"
                  onClick={() => setPageBarang(prev => Math.min(totalPagesBarang, prev + 1))}
                  disabled={pageBarang >= totalPagesBarang}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER DATA DISTRIBUTOR */}
      {/* ========================================================================= */}
      {activeTab === 'distributor' && (
        <div className="space-y-4 animate-fade-in">
          {/* Action Toolbar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchDistributor}
                  onChange={(e) => {
                    setSearchDistributor(e.target.value);
                    setPageDistributor(1);
                  }}
                  placeholder="Cari Kode LD atau Nama Distributor..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                {searchDistributor && (
                  <button
                    type="button"
                    onClick={() => setSearchDistributor('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={filterStatusDistributor}
                onChange={(e) => {
                  setFilterStatusDistributor(e.target.value as any);
                  setPageDistributor(1);
                }}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={handleClearAllDistributor}
                disabled={distributorList.length === 0}
                className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 disabled:opacity-40 text-xs font-black shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Super Admin: Kosongkan seluruh master data distributor"
              >
                <Trash2 size={13} className="text-rose-600" />
                <span className="hidden sm:inline">Reset / Kosongkan</span>
              </button>

              <button
                type="button"
                onClick={() => downloadExcelTemplate('distributor')}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black shadow-2xs transition-all items-center gap-1.5 cursor-pointer"
                title="Download Template Format Excel untuk Import Data Distributor"
              >
                <FileDown size={14} />
                <span>Template Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenExcelModal('distributor')}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-xs transition-all items-center gap-1.5 cursor-pointer"
                title="Import data distributor dari file Excel"
              >
                <Upload size={14} />
                <span>Upload Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePushAllDistributorToSupabase}
                disabled={isPushingToSupabase || distributorList.length === 0}
                className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Kirim dan sinkronkan semua data distributor di tabel ke database cloud"
              >
                <CloudUpload size={14} className={isPushingToSupabase ? 'animate-bounce' : ''} />
                <span>{isPushingToSupabase ? 'Mengirim...' : 'Sinkron Database'}</span>
              </button>

              <button
                type="button"
                onClick={exportDistributorToExcel}
                className="hidden lg:flex px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-black shadow-xs transition-all items-center gap-1.5 cursor-pointer"
                title="Download data distributor ke format Excel (.xlsx)"
              >
                <Download size={14} />
                <span>Download Excel</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddDistributor}
                className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} className="stroke-[3]" />
                <span>Tambah Distributor</span>
              </button>
            </div>
          </div>

          {/* Multi-selection Floating Action Bar for Data Distributor */}
          {selectedDistributorCodes.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-blue-900 text-white shadow-lg border border-blue-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-300 shrink-0 font-black text-xs">
                  {selectedDistributorCodes.length}
                </div>
                <div>
                  <div className="text-xs font-black tracking-tight text-white flex items-center gap-2">
                    <span>{selectedDistributorCodes.length} distributor terpilih</span>
                    {selectedDistributorCodes.length < filteredDistributor.length && (
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredDistributor}
                        className="text-[11px] text-blue-200 underline hover:text-white font-bold cursor-pointer"
                      >
                        Pilih semua ({filteredDistributor.length}) hasil filter
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-blue-200/80 font-medium m-0">
                    Gunakan aksi massal di bawah untuk memproses sekaligus
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => handleBatchSetStatusDistributor('Aktif')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Ubah semua distributor terpilih menjadi Aktif"
                >
                  <CheckCircle2 size={13} />
                  <span>Set Aktif</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchSetStatusDistributor('Nonaktif')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Ubah semua distributor terpilih menjadi Nonaktif"
                >
                  <XCircle size={13} />
                  <span>Set Nonaktif</span>
                </button>

                <button
                  type="button"
                  onClick={exportSelectedDistributorToExcel}
                  className="hidden lg:flex px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-bold transition-all items-center gap-1 cursor-pointer"
                  title="Download hanya distributor terpilih ke Excel"
                >
                  <Download size={13} />
                  <span>Download Excel ({selectedDistributorCodes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchDeleteDistributor}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Hapus Terpilih</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDistributorCodes([])}
                  className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Table Data Distributor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedDistributorCodes.length > 0 && selectedDistributorCodes.length === paginatedDistributor.length}
                        onChange={handleToggleSelectAllDistributor}
                        className="rounded border-slate-300 text-blue-900 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Kode LD</th>
                    <th className="py-3 px-4">Nama Distributor</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedDistributor.length > 0 ? (
                    paginatedDistributor.map((item, idx) => {
                      const isSelected = selectedDistributorCodes.includes(item.kode_ld);
                      const rowNumber = (pageDistributor - 1) * rowsPerPageDistributor + idx + 1;

                      return (
                        <tr 
                          key={item.kode_ld}
                          className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectDistributor(item.kode_ld)}
                              className="rounded border-slate-300 text-blue-900 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold text-blue-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">{item.kode_ld}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.kode_ld, 'Kode LD')}
                                className="text-slate-400 hover:text-blue-700 p-0.5 cursor-pointer"
                                title="Salin Kode LD"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.nama_distributor}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                item.status === 'Aktif'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {item.status === 'Aktif' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              <span>{item.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditDistributor(item)}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit Data Distributor"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDistributor(item.kode_ld, item.nama_distributor)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Hapus Distributor"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Truck size={36} className="mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">Tidak ada data distributor yang ditemukan</p>
                          <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau tambah distributor baru.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-slate-200/80 bg-slate-50/70 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <span>Menampilkan</span>
                <select
                  value={rowsPerPageDistributor}
                  onChange={(e) => {
                    setRowsPerPageDistributor(Number(e.target.value));
                    setPageDistributor(1);
                  }}
                  className="py-1 px-2 rounded-lg bg-white border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={2500}>2500</option>
                  <option value={5000}>5000</option>
                </select>
                <span>dari <strong>{filteredDistributor.length}</strong> total distributor</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPageDistributor(prev => Math.max(1, prev - 1))}
                  disabled={pageDistributor === 1}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Hal {pageDistributor} / {totalPagesDistributor}
                </span>
                <button
                  type="button"
                  onClick={() => setPageDistributor(prev => Math.min(totalPagesDistributor, prev + 1))}
                  disabled={pageDistributor >= totalPagesDistributor}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT DATA BARANG */}
      {/* ========================================================================= */}
      {showBarangModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 m-0">
                    {editingBarang ? 'Edit Data Barang' : 'Tambah Barang Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0">Tabel: public.data_barang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBarangModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBarang} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Item Code / SKU <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingBarang}
                  value={barangForm.item_code}
                  onChange={(e) => setBarangForm(prev => ({ ...prev, item_code: e.target.value }))}
                  placeholder="Contoh: 21104501"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {editingBarang && (
                  <p className="text-[10px] text-slate-400 mt-1">Item Code adalah kunci utama (Primary Key) dan tidak dapat diubah.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Barcode (Opsional)
                </label>
                <input
                  type="text"
                  value={barangForm.barcode}
                  onChange={(e) => setBarangForm(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="Contoh: 8992775010011"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={barangForm.item_name}
                  onChange={(e) => setBarangForm(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder="Contoh: KINO SAMANTHA HAIR OIL 20ML"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Status Produk
                </label>
                <select
                  value={barangForm.status}
                  onChange={(e) => setBarangForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Aktif">Aktif (Dapat Digunakan di Transaksi)</option>
                  <option value="Nonaktif">Nonaktif (Diarsipkan)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBarangModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT DATA DISTRIBUTOR */}
      {/* ========================================================================= */}
      {showDistributorModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 m-0">
                    {editingDistributor ? 'Edit Data Distributor' : 'Tambah Distributor Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0">Tabel: public.data_distributor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDistributorModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDistributor} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Kode LD <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingDistributor}
                  value={distributorForm.kode_ld}
                  onChange={(e) => setDistributorForm(prev => ({ ...prev, kode_ld: e.target.value }))}
                  placeholder="Contoh: LD-001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {editingDistributor && (
                  <p className="text-[10px] text-slate-400 mt-1">Kode LD adalah Primary Key dan tidak dapat diubah.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nama Distributor / Vendor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={distributorForm.nama_distributor}
                  onChange={(e) => setDistributorForm(prev => ({ ...prev, nama_distributor: e.target.value }))}
                  placeholder="Contoh: PT KINO INDONESIA TBK"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Status Distributor
                </label>
                <select
                  value={distributorForm.status}
                  onChange={(e) => setDistributorForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDistributorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Simpan Distributor
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD / IMPORT EXCEL (.xlsx) DENGAN PREVIEW */}
      {/* ========================================================================= */}
      {showExcelModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 m-0">
                    Import Excel: {excelTarget === 'barang' ? 'Master Data Barang' : 'Master Data Distributor'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0">
                    Unggah file Excel (.xlsx / .xls / .csv) untuk input atau perbarui data massal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Template Download Prompt */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950">
                <div className="flex items-center gap-2 text-xs">
                  <FileDown size={18} className="text-blue-700 shrink-0" />
                  <span>Gunakan template standar agar nama kolom sesuai dengan database.</span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExcelTemplate(excelTarget)}
                  className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Unduh Template</span>
                </button>
              </div>

              {/* Upload Drop Area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-master-upload"
                />
                <label
                  htmlFor="excel-master-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                    <Upload size={22} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800">
                      Klik untuk memilih file Excel atau seret file ke sini
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Format didukung: .xlsx, .xls, .csv
                    </p>
                  </div>
                  {excelFileName && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold mt-2">
                      <Check size={13} /> {excelFileName} ({parsedExcelRows.length} baris valid)
                    </span>
                  )}
                </label>
              </div>

              {/* Preview Table if rows parsed */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">
                      Pratinjau Data ({parsedExcelRows.length} Baris Siap Diimpor)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Data yang sudah ada (berdasarkan kode) akan otomatis diperbarui
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="py-2 px-3">No</th>
                          {excelTarget === 'barang' ? (
                            <>
                              <th className="py-2 px-3">Item Code</th>
                              <th className="py-2 px-3">Barcode</th>
                              <th className="py-2 px-3">Nama Barang</th>
                              <th className="py-2 px-3">Status</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2 px-3">Kode LD</th>
                              <th className="py-2 px-3">Nama Distributor</th>
                              <th className="py-2 px-3">Status</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedExcelRows.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                            {excelTarget === 'barang' ? (
                              <>
                                <td className="py-2 px-3 font-mono font-bold text-blue-900">{row.item_code}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{row.barcode || '-'}</td>
                                <td className="py-2 px-3 font-bold text-slate-800">{row.item_name}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${row.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                    {row.status}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 px-3 font-mono font-bold text-blue-900">{row.kode_ld}</td>
                                <td className="py-2 px-3 font-bold text-slate-800">{row.nama_distributor}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${row.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                    {row.status}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedExcelRows.length > 50 && (
                    <p className="text-[11px] text-slate-500 italic text-center">
                      Menampilkan 50 baris pertama dari total {parsedExcelRows.length} baris...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={parsedExcelRows.length === 0 || isProcessingExcel}
                onClick={handleCommitExcelImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessingExcel ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[3]" />
                    <span>Simpan {parsedExcelRows.length} Data ke Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ========================================================================= */}
      {/* MODAL: SQL SETUP & DIAGNOSTIC */}
      {/* ========================================================================= */}
      {showSqlSetupModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
                  <Terminal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white m-0 flex items-center gap-2">
                    Panduan Setup Database SQL
                  </h3>
                  <p className="text-xs text-indigo-200/80 font-medium m-0">
                    Pastikan tabel <code className="text-amber-300 font-mono">data_distributor</code> dan <code className="text-amber-300 font-mono">data_barang</code> sudah dibuat di database
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSqlSetupModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700">
              {/* Connection Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Server size={15} className="text-indigo-600" />
                    Status Koneksi Database Server
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {isSupabaseConfigured ? 'Kredensial Terdeteksi' : 'Kredensial Kosong'}
                  </span>
                </div>
                <div className="text-xs font-mono bg-white p-2.5 rounded-xl border border-slate-200 text-slate-600 flex items-center justify-between">
                  <span className="truncate">Database Host: {supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'Belum diisi di environment (.env)'}</span>
                </div>
                {lastSupabaseError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                    <p className="font-bold flex items-center gap-1.5 text-rose-900 mb-1">
                      <AlertTriangle size={14} /> Terakhir Mendapat Peringatan Database:
                    </p>
                    {lastSupabaseError}
                  </div>
                )}
              </div>

              {/* Step by step guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Info size={15} className="text-blue-600" />
                  Langkah Setup Skema Tabel Database:
                </h4>
                <ol className="text-xs space-y-2 list-decimal list-inside text-slate-600 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200/80 font-medium">
                  <li>Buka Dashboard database cloud project Anda di browser.</li>
                  <li>Pilih menu <strong>SQL Editor / Query Tool</strong>.</li>
                  <li>Salin (Copy) kode SQL di bawah ini, lalu tempel (Paste) di SQL Editor.</li>
                  <li>Jalankan perintah (Run) query tersebut hingga berhasil.</li>
                  <li>Kembali ke aplikasi ini dan klik tombol <strong>"Sinkron Database"</strong> pada tabel Distributor.</li>
                </ol>
              </div>

              {/* Copyable SQL Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Script SQL Tabel Data Distributor & Barang (PostgreSQL)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `-- ==========================================
-- 1. TABEL DATA DISTRIBUTOR (KODE LD)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_distributor (
  kode_ld VARCHAR(50) PRIMARY KEY,
  nama_distributor VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS & Berikan Izin Penuh
ALTER TABLE public.data_distributor DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.data_distributor TO anon, authenticated, service_role;

-- ==========================================
-- 2. TABEL DATA BARANG (ITEM CODE & BARCODE)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_barang (
  item_code VARCHAR(50) PRIMARY KEY,
  barcode VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS & Berikan Izin Penuh
ALTER TABLE public.data_barang DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.data_barang TO anon, authenticated, service_role;`;
                      navigator.clipboard.writeText(sql);
                      showToast('SQL Tersalin', 'Script SQL berhasil disalin ke clipboard!', 'success');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Salin Script SQL</span>
                  </button>
                </div>

                <div className="relative bg-slate-900 rounded-2xl p-4 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 overflow-y-auto border border-slate-800">
                  <pre className="m-0">
{`-- ==========================================
-- 1. TABEL DATA DISTRIBUTOR (KODE LD)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_distributor (
  kode_ld VARCHAR(50) PRIMARY KEY,
  nama_distributor VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS & Berikan Izin Penuh
ALTER TABLE public.data_distributor DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.data_distributor TO anon, authenticated, service_role;

-- ==========================================
-- 2. TABEL DATA BARANG (ITEM CODE & BARCODE)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_barang (
  item_code VARCHAR(50) PRIMARY KEY,
  barcode VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS & Berikan Izin Penuh
ALTER TABLE public.data_barang DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.data_barang TO anon, authenticated, service_role;`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePushAllDistributorToSupabase}
                  disabled={isPushingToSupabase || distributorList.length === 0}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CloudUpload size={14} />
                  <span>Sinkron Distributor Sekarang ({distributorList.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSqlSetupModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
