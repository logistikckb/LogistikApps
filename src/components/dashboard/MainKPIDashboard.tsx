import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Truck, 
  ShieldCheck, 
  CalendarCheck2, 
  Database, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  RefreshCw,
  Barcode,
  Clock,
  Sparkles
} from 'lucide-react';
import { DataBarang, DataDistributor, IncomingItem } from '../../types';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { ToolId } from '../ToolsNavigation';

interface MainKPIDashboardProps {
  onOpenTool: (toolId: ToolId) => void;
}

export function MainKPIDashboard({ onOpenTool }: MainKPIDashboardProps) {
  // Master Data States
  const [barangCount, setBarangCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('ckb_master_data_barang_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    return 0;
  });

  const [activeBarangCount, setActiveBarangCount] = useState<number>(0);
  const [barcodeCount, setBarcodeCount] = useState<number>(0);

  const [distributorCount, setDistributorCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('ckb_master_data_distributor_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    return 0;
  });

  // Incoming Data States
  const [incomingTotalLot, setIncomingTotalLot] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('incoming_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    return 0;
  });

  const [incomingTotalCtn, setIncomingTotalCtn] = useState<number>(0);
  const [incomingTotalPcs, setIncomingTotalPcs] = useState<number>(0);
  const [qcPassRate, setQcPassRate] = useState<number>(100);
  const [qcPassCount, setQcPassCount] = useState<number>(0);
  const [qcHoldCount, setQcHoldCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchLiveKPIData = async () => {
    setIsLoading(true);
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // 1. Process from LocalStorage Cache first
    try {
      const cachedBarang = localStorage.getItem('ckb_master_data_barang_cache');
      if (cachedBarang) {
        const parsed: DataBarang[] = JSON.parse(cachedBarang);
        if (Array.isArray(parsed)) {
          setBarangCount(parsed.length);
          setActiveBarangCount(parsed.filter(b => b.status === 'Aktif').length);
          setBarcodeCount(parsed.filter(b => !!b.barcode).length);
        }
      }

      const cachedDist = localStorage.getItem('ckb_master_data_distributor_cache');
      if (cachedDist) {
        const parsed: DataDistributor[] = JSON.parse(cachedDist);
        if (Array.isArray(parsed)) {
          setDistributorCount(parsed.length);
        }
      }

      const cachedInc = localStorage.getItem('incoming_cache_v1');
      if (cachedInc) {
        const parsed: IncomingItem[] = JSON.parse(cachedInc);
        if (Array.isArray(parsed)) {
          setIncomingTotalLot(parsed.length);
          let ctn = 0;
          let pcs = 0;
          let pass = 0;
          let hold = 0;
          parsed.forEach(i => {
            ctn += Number(i.last_qty || i.first_qty || 0);
            pcs += Number(i.qty_convert || 0);
            const qc = (i.qc_code || 'QC-PASS').toUpperCase();
            if (qc === 'QC-PASS') pass++;
            else if (qc === 'QC-HOLD') hold++;
          });
          setIncomingTotalCtn(ctn);
          setIncomingTotalPcs(pcs);
          setQcPassCount(pass);
          setQcHoldCount(hold);
          setQcPassRate(parsed.length > 0 ? Math.round((pass / parsed.length) * 100) : 100);
        }
      }
    } catch (e) {
      console.warn('Error reading localStorage KPI:', e);
    }

    // 2. Fetch fresh stats from Cloud Database if connected
    if (isSupabaseConfigured) {
      try {
        const [resBarang, resDist, resInc] = await Promise.all([
          supabase.from('data_barang').select('status, barcode'),
          supabase.from('data_distributor').select('id, kode_ld'),
          supabase.from('incoming').select('first_qty, last_qty, qty_convert, qc_code')
        ]);

        if (resBarang.data) {
          setBarangCount(resBarang.data.length);
          setActiveBarangCount(resBarang.data.filter(b => b.status === 'Aktif').length);
          setBarcodeCount(resBarang.data.filter(b => !!b.barcode).length);
        }

        if (resDist.data) {
          setDistributorCount(resDist.data.length);
        }

        if (resInc.data) {
          const list = resInc.data;
          setIncomingTotalLot(list.length);
          let ctn = 0;
          let pcs = 0;
          let pass = 0;
          let hold = 0;
          list.forEach(i => {
            ctn += Number(i.last_qty || i.first_qty || 0);
            pcs += Number(i.qty_convert || 0);
            const qc = (i.qc_code || 'QC-PASS').toUpperCase();
            if (qc === 'QC-PASS') pass++;
            else if (qc === 'QC-HOLD') hold++;
          });
          setIncomingTotalCtn(ctn);
          setIncomingTotalPcs(pcs);
          setQcPassCount(pass);
          setQcHoldCount(hold);
          setQcPassRate(list.length > 0 ? Math.round((pass / list.length) * 100) : 100);
        }
      } catch (err) {
        console.warn('Live database KPI query silent notice:', err);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchLiveKPIData();
  }, []);

  return (
    <div className="hidden lg:block space-y-3">
      {/* Header Dashboard Metrics */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide m-0 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-blue-700" />
            <span>Ringkasan KPI</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
              Update: {lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={fetchLiveKPIData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Perbarui Data KPI"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            <span className="text-[11px] hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Master Data Barang */}
        <div 
          onClick={() => onOpenTool('menu-a')}
          className="group p-4 rounded-2xl bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"
          title="Buka Database Master Barang"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Package size={13} className="text-indigo-600" />
              <span>Master Barang</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <Package size={17} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {barangCount}
            </div>
            <span className="text-xs font-bold text-slate-400">SKU</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> {activeBarangCount || barangCount} Aktif
            </span>
            <span className="text-indigo-700 font-bold flex items-center gap-1">
              <Barcode size={11} /> {barcodeCount} Barcode
            </span>
            <ArrowRight size={13} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        {/* KPI 2: Master Distributor */}
        <div 
          onClick={() => onOpenTool('menu-a')}
          className="group p-4 rounded-2xl bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"
          title="Buka Master Distributor"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Truck size={13} className="text-blue-600" />
              <span>Distributor</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-900 text-blue-900 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <Truck size={17} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
              {distributorCount}
            </div>
            <span className="text-xs font-bold text-slate-400">Mitra</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-blue-800 font-bold flex items-center gap-1">
              <ShieldCheck size={11} /> Terverifikasi
            </span>
            <span className="text-[10px] text-slate-400">Kode LD Aktif</span>
            <ArrowRight size={13} className="text-slate-400 group-hover:text-blue-900 group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        {/* KPI 3: Transaksi Kedatangan (Inbound) */}
        <div 
          onClick={() => onOpenTool('menu-b')}
          className="group p-4 rounded-2xl bg-white hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/50 border border-slate-200/90 hover:border-emerald-300 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"
          title="Buka Kedatangan Barang"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Truck size={13} className="text-emerald-600" />
              <span>Kedatangan</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <Truck size={17} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {incomingTotalLot}
            </div>
            <span className="text-xs font-bold text-slate-400">Lot</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-emerald-700 font-bold">
              {incomingTotalCtn.toLocaleString('id-ID')} CTN
            </span>
            <span className="text-slate-500">
              ≈ {incomingTotalPcs.toLocaleString('id-ID')} PCS
            </span>
            <ArrowRight size={13} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        {/* KPI 4: Kualitas QC & Validasi ED */}
        <div 
          onClick={() => onOpenTool('ed-checker')}
          className="group p-4 rounded-2xl bg-white hover:bg-gradient-to-br hover:from-white hover:to-amber-50/50 border border-slate-200/90 hover:border-amber-300 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"
          title="Buka Cek ED"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <CalendarCheck2 size={13} className="text-amber-600" />
              <span>Status QC</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-amber-600 text-amber-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <ShieldCheck size={17} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {qcPassRate}%
            </div>
            <span className="text-xs font-bold text-emerald-600">Pass</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> {qcPassCount} Lolos
            </span>
            <span className="text-amber-700 font-bold flex items-center gap-1">
              <AlertTriangle size={11} /> {qcHoldCount} Hold
            </span>
            <ArrowRight size={13} className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
          </div>
        </div>

      </div>
    </div>
  );
}
