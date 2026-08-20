import React from 'react';
import { 
  CalendarCheck2, 
  Sparkles,
  ChevronRight,
  Database,
  Boxes,
  FileText,
  Truck,
  Settings,
  Grid,
  ShieldCheck,
  QrCode,
  Flame,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ToolId = 
  | 'ed-checker' 
  | 'menu-a' 
  | 'menu-b' 
  | 'menu-c' 
  | 'menu-d' 
  | 'menu-e';

export interface ToolItem {
  id: ToolId;
  title: string;
  shortDesc: string;
  category: string;
  icon: React.ElementType;
  isReady: boolean;
  requiresAdmin?: boolean;
  colorBg: string;
  colorBorder: string;
  colorIcon: string;
  plannedFeatures: string[];
}

export const TOOLS_LIST: ToolItem[] = [
  {
    id: 'ed-checker',
    title: 'Cek Expired Date (ED)',
    shortDesc: 'Kalkulator SLED, DOY (Day of Year), Tanggal Mixing & Validasi Batch Excel',
    category: 'Quality & Expired',
    icon: CalendarCheck2,
    isReady: true,
    colorBg: 'bg-blue-600',
    colorBorder: 'border-blue-500',
    colorIcon: 'text-blue-600',
    plannedFeatures: [
      'Perhitungan instan DOY & Tahun Unix',
      'Kalkulasi Shelf Life (1-5 Tahun)',
      'Upload & Export Excel (.xlsx) massal',
      'Filter status peringatan ED'
    ]
  },
  {
    id: 'menu-a',
    title: 'Database Master',
    shortDesc: 'Master Data Barang & Distributor (CRUD, Upload & Download Excel)',
    category: 'Database Master',
    icon: Database,
    isReady: true,
    requiresAdmin: true,
    colorBg: 'bg-indigo-600',
    colorBorder: 'border-indigo-500',
    colorIcon: 'text-indigo-600',
    plannedFeatures: [
      'Master Data Barang (data_barang: SKU, Barcode, Nama, Status)',
      'Master Data Distributor (data_distributor: Kode LD, Nama, Status)',
      'Operasi CRUD Lengkap & Sinkronisasi Cloud',
      'Upload & Download Excel (.xlsx) dengan Template Standar'
    ]
  },
  {
    id: 'menu-b',
    title: 'Kedatangan',
    shortDesc: 'Pencatatan & Manajemen Transaksi Kedatangan Barang (Inbound/Incoming)',
    category: 'Inbound & Logistik',
    icon: Truck,
    isReady: true,
    colorBg: 'bg-emerald-600',
    colorBorder: 'border-emerald-500',
    colorIcon: 'text-emerald-600',
    plannedFeatures: [
      'Pencatatan Transaksi Kedatangan Barang Realtime (Tabel incoming)',
      'Upload & Batch Import Excel (.xlsx/.xls/.csv) Cepat',
      'Download Template Excel Standar & Export Laporan Excel',
      'Manajemen Status QC (QC-PASS, QC-HOLD, QC-REJECT) & Petugas Tally'
    ]
  },
  {
    id: 'menu-c',
    title: 'Generator QR & Print PM42',
    shortDesc: 'Generator Multi QR Code & Direct Thermal Label Print Honeywell PM42 (Autosense Ready)',
    category: 'Label & Barcode',
    icon: QrCode,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-amber-600',
    colorBorder: 'border-amber-500',
    colorIcon: 'text-amber-600',
    plannedFeatures: [
      'Generate QR Massal dari banyak baris teks (Judul + QR Code + Teks)',
      'Direct Thermal Label Print khusus Honeywell PM42 (Autosense 0-Margin)',
      'Bypass software LARGO & Dukungan Raw Direct Protocol / ZSim ZPL',
      'Unduh ZIP gambar QR, Ekspor Excel, dan Custom Dimensi Label'
    ]
  },
  {
    id: 'menu-d',
    title: 'Penyiapan',
    shortDesc: 'Manajemen Data Penyiapan Outbound (data_penyiapan), Upload Excel & Sinkron Supabase',
    category: 'Outbound & Logistik',
    icon: Boxes,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-sky-600',
    colorBorder: 'border-sky-500',
    colorIcon: 'text-sky-600',
    plannedFeatures: [
      'Manajemen Data Penyiapan Outbound (Tabel Supabase: public.data_penyiapan)',
      'Upload File Excel Massal Khusus Role Admin (20 Kolom Standar Logistik)',
      'Pencarian Cepat, Voice Search Speech-to-Text & Filter Kategori/SLoc/QC',
      'Export Laporan Excel (.xlsx) & Sinkronisasi Cloud Supabase'
    ]
  },
  {
    id: 'menu-e',
    title: 'Pemusnahan',
    shortDesc: 'Pemusnahan & Disposal Barang Terkontrol (data_pemusnahan) dengan Relasi Modul Penyiapan',
    category: 'Disposal & Karantina',
    icon: Flame,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-rose-600',
    colorBorder: 'border-rose-500',
    colorIcon: 'text-rose-600',
    plannedFeatures: [
      'Manajemen Transaksi Pemusnahan Barang (Tabel Supabase: public.data_pemusnahan)',
      'Relasi Otomatis dari Modul Penyiapan (Kirim item dengan status Oke / Siap Musnah)',
      'Tracking Lokasi Karantina (WH-REJECT-01), SLOC (SL99) & Destinasi Incinerator',
      'Upload & Export File Excel (.xlsx) dengan Template Standar & QR Code LPN'
    ]
  }
];

interface ToolsGridMenuProps {
  onOpenTool: (id: ToolId) => void;
}

export function ToolsGridMenu({ onOpenTool }: ToolsGridMenuProps) {
  const { currentUser, isAdmin } = useAuth();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin' || currentUser?.username?.toLowerCase() === 'superadmin';

  // Filter tools: Menu A (Database Master) only appears for SuperAdmin
  const visibleTools = TOOLS_LIST.filter(tool => {
    if (tool.requiresAdmin) {
      return isSuperAdmin;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Title Bar (Minimalist & Compact for Mobile) */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-2xs">
            <Grid size={14} />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-800 m-0 uppercase tracking-tight">
              Menu Aplikasi
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isSuperAdmin && (
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={11} /> Akses Super Admin
            </span>
          )}
          <span className="text-[10px] font-bold text-slate-500 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-full shadow-2xs">
            {visibleTools.length} Menu
          </span>
        </div>
      </div>

      {/* Grid Menu: Mobile-first 3 columns on phone, 4 on tablet, 6 on desktop */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3.5">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onOpenTool(tool.id)}
              className="p-3 sm:p-4 rounded-2xl transition-all duration-200 relative overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer border bg-white/80 hover:bg-white active:bg-blue-50/70 border-slate-200/70 hover:border-blue-400 active:border-blue-500 shadow-2xs hover:shadow-md active:scale-95 group select-none min-h-[96px] sm:min-h-[110px]"
            >
              {/* Ready Indicator dot for active tool */}
              {tool.isReady && (
                <span 
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs" 
                  title="Modul Aktif"
                />
              )}

              {/* Super Admin Badge on top left if tool requires admin */}
              {tool.requiresAdmin && (
                <span 
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-indigo-900 text-white text-[8px] font-black uppercase tracking-wider"
                  title="Khusus Super Admin"
                >
                  ADMIN
                </span>
              )}

              {/* Icon Container */}
              <div 
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${tool.colorBg} text-white flex items-center justify-center shadow-sm group-hover:scale-105 group-active:scale-90 transition-transform shrink-0`}
              >
                <Icon size={22} className="sm:size-6" />
              </div>

              {/* Nama Menu di Bawah Icon */}
              <span className="mt-2 text-xs sm:text-[13px] font-extrabold text-slate-800 group-hover:text-blue-900 leading-tight tracking-tight text-center line-clamp-2 w-full">
                {tool.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
