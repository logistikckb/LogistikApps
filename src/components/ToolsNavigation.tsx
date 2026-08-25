import React from 'react';
import { 
  CalendarCheck2, 
  Sparkles,
  Database,
  Boxes,
  Truck,
  QrCode,
  Flame,
  ClipboardList,
  Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ToolId = 
  | 'ed-checker' 
  | 'menu-a' 
  | 'menu-b' 
  | 'menu-c' 
  | 'menu-d' 
  | 'menu-e'
  | 'menu-f'
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
  },
  {
    id: 'menu-f',
    title: 'Reco',
    shortDesc: 'Permintaan Barang (data_reco) - Dikelola & Dipindahkan dari Modul Penyiapan',
    category: 'Permintaan & Relokasi',
    icon: ClipboardList,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-purple-600',
    colorBorder: 'border-purple-500',
    colorIcon: 'text-purple-600',
    plannedFeatures: [
      'Manajemen Permintaan Barang (Tabel Supabase: public.data_reco)',
      'Pindah Massal & Terintegrasi dari Modul Penyiapan',
      'Tracking Lokasi (WH-RECO-01), SLOC (SL03) & Status Permintaan',
      'Upload & Export File Excel (.xlsx) dengan Template Standar & QR Code LPN'
    ]
  },
  {
    id: 'menu-g',
    title: 'Inventory',
    shortDesc: 'Manajemen Data Inventory Gudang (data_inventory), Upload Excel & Sinkron Supabase',
    category: 'Inventory & Stok',
    icon: Package,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-teal-600',
    colorBorder: 'border-teal-500',
    colorIcon: 'text-teal-600',
    plannedFeatures: [
      'Manajemen Data Inventory Gudang (Tabel Supabase: public.data_inventory)',
      'Upload File Excel Massal Khusus Role Admin (Format Kolom Standar Logistik)',
      'Pencarian Cepat, Voice Search Speech-to-Text & Filter Kategori/SLoc/Status',
      'Export Laporan Excel (.xlsx) & Sinkronisasi Cloud Supabase Realtime'
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
      {visibleTools.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onOpenTool(tool.id)}
            className="p-2.5 sm:p-3.5 rounded-2xl transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer border bg-slate-50 hover:bg-white active:bg-blue-50 border-slate-200 hover:border-blue-400 shadow-2xs group select-none min-h-[90px] sm:min-h-[105px]"
          >
            {/* Ready Indicator dot for active tool */}
            {tool.isReady && (
              <span 
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" 
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
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${tool.colorBg} text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0`}
            >
              <Icon size={20} className="sm:size-[22px]" />
            </div>

            {/* Nama Menu di Bawah Icon */}
            <span className="mt-1.5 text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-blue-900 leading-tight tracking-tight text-center line-clamp-2 w-full">
              {tool.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
