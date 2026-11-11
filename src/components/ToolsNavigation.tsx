import React from 'react';
import { 
  CalendarCheck2, 
  Database,
  Boxes,
  Truck,
  ClipboardCheck,
  Flame,
  Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ToolId = 
  | 'ed-checker' 
  | 'menu-a' 
  | 'menu-b' 
  | 'menu-admk'
  | 'menu-d' 
  | 'menu-e'
  | 'menu-g';

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
    requiresAdmin: false,
    colorBg: 'bg-blue-50 text-blue-600 border border-blue-200/80',
    colorBorder: 'border-blue-200',
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
    requiresAdmin: false,
    colorBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80',
    colorBorder: 'border-indigo-200',
    colorIcon: 'text-indigo-600',
    plannedFeatures: [
      'Master Data Barang (SKU, Barcode, Nama, Status)',
      'Master Data Distributor (Kode LD, Nama, Status)',
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
    requiresAdmin: false,
    colorBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
    colorBorder: 'border-emerald-200',
    colorIcon: 'text-emerald-600',
    plannedFeatures: [
      'Pencatatan Transaksi Kedatangan Barang Realtime',
      'Upload & Batch Import Excel (.xlsx/.xls/.csv) Cepat',
      'Download Template Excel Standar & Export Laporan Excel',
      'Manajemen Status QC (QC-PASS, QC-HOLD, QC-REJECT) & Petugas Tally'
    ]
  },
  {
    id: 'menu-admk',
    title: 'ADMK',
    shortDesc: 'Pencatatan & Manajemen Transaksi ADMK (Inbound/ADMK)',
    category: 'Inbound & Logistik',
    icon: ClipboardCheck,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-violet-50 text-violet-600 border border-violet-200/80',
    colorBorder: 'border-violet-200',
    colorIcon: 'text-violet-600',
    plannedFeatures: [
      'Pencatatan Transaksi ADMK Realtime',
      'Upload & Batch Import Excel (.xlsx/.xls/.csv) Cepat',
      'Download Template Excel Standar & Export Laporan Excel',
      'Manajemen Status QC (QC-PASS, QC-HOLD, QC-REJECT) & Petugas Tally'
    ]
  },

  {
    id: 'menu-d',
    title: 'Penyiapan',
    shortDesc: 'Manajemen Data Penyiapan Outbound, Upload Excel & Sinkronisasi Cloud',
    category: 'Outbound & Logistik',
    icon: Boxes,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-sky-50 text-sky-600 border border-sky-200/80',
    colorBorder: 'border-sky-200',
    colorIcon: 'text-sky-600',
    plannedFeatures: [
      'Manajemen Data Penyiapan Outbound',
      'Upload File Excel Massal Khusus Role Admin (20 Kolom Standar Logistik)',
      'Pencarian Cepat, Voice Search Speech-to-Text & Filter Kategori/SLoc/QC',
      'Export Laporan Excel (.xlsx) & Sinkronisasi Cloud Realtime'
    ]
  },
  {
    id: 'menu-e',
    title: 'Pemusnahan',
    shortDesc: 'Pemusnahan & Disposal Barang Terkontrol dengan Relasi Modul Penyiapan',
    category: 'Disposal & Karantina',
    icon: Flame,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-rose-50 text-rose-600 border border-rose-200/80',
    colorBorder: 'border-rose-200',
    colorIcon: 'text-rose-600',
    plannedFeatures: [
      'Manajemen Transaksi Pemusnahan Barang',
      'Relasi Otomatis dari Modul Penyiapan (Kirim item dengan status Oke / Siap Musnah)',
      'Tracking Lokasi Karantina (WH-REJECT-01), SLOC (SL99) & Destinasi Incinerator',
      'Upload & Export File Excel (.xlsx) dengan Template Standar & QR Code LPN'
    ]
  },

  {
    id: 'menu-g',
    title: 'Inventory',
    shortDesc: 'Manajemen Data Inventory Gudang, Upload Excel & Sinkronisasi Cloud',
    category: 'Inventory & Stok',
    icon: Package,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-teal-50 text-teal-600 border border-teal-200/80',
    colorBorder: 'border-teal-200',
    colorIcon: 'text-teal-600',
    plannedFeatures: [
      'Manajemen Data Inventory Gudang Terpadu',
      'Upload File Excel Massal Khusus Role Admin (Format Kolom Standar Logistik)',
      'Pencarian Cepat, Voice Search Speech-to-Text & Filter Kategori/SLoc/Status',
      'Export Laporan Excel (.xlsx) & Sinkronisasi Cloud Realtime'
    ]
  }
];

interface ToolsGridMenuProps {
  onOpenTool: (id: ToolId) => void;
}

export function ToolsGridMenu({ onOpenTool }: ToolsGridMenuProps) {
  const { currentUser, isAdmin } = useAuth();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin' || currentUser?.username?.toLowerCase() === 'superadmin';

  // Filter tools: Check requiresAdmin
  const visibleTools = TOOLS_LIST.filter(tool => !tool.requiresAdmin || isSuperAdmin);

  return (
    <div className="space-y-2.5">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-800 tracking-tight">
            Menu Operasional
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            ({visibleTools.length} modul aktif)
          </span>
        </div>
      </div>

      {/* Grid of Menus */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;

          return (
            <div key={tool.id} className="relative group">
              <button
                type="button"
                onClick={() => onOpenTool(tool.id)}
                className="w-full p-2.5 sm:p-3 rounded-xl transition-all relative flex flex-col items-center justify-center text-center cursor-pointer border shadow-2xs select-none min-h-[88px] sm:min-h-[96px] bg-white hover:bg-slate-50 active:bg-blue-50/40 border-slate-200/90 hover:border-slate-300"
              >
                {/* Ready Indicator dot for active tool */}
                {tool.isReady && (
                  <span 
                    className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white" 
                    title="Modul Aktif"
                  />
                )}

                {/* Super Admin Badge on top left if tool requires admin */}
                {tool.requiresAdmin && (
                  <span 
                    className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8px] font-bold uppercase tracking-wider"
                    title="Khusus Super Admin"
                  >
                    ADMIN
                  </span>
                )}

                {/* Icon Container with Light Pastel Fill */}
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${tool.colorBg} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
                >
                  <Icon size={18} className="sm:size-[19px]" />
                </div>

                {/* Nama Menu di Bawah Icon */}
                <span className="mt-1.5 text-xs font-semibold leading-tight tracking-tight text-center line-clamp-2 w-full text-slate-800 group-hover:text-blue-900">
                  {tool.title}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
