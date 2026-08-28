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
  | 'menu-g'
  | 'menu-h';

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
    requiresAdmin: true,
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
    id: 'menu-c',
    title: 'Generator QR & Print PM42',
    shortDesc: 'Generator Multi QR Code & Direct Thermal Label Print Honeywell PM42 (Autosense Ready)',
    category: 'Label & Barcode',
    icon: QrCode,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    colorBorder: 'border-amber-200',
    colorIcon: 'text-amber-700',
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
    id: 'menu-f',
    title: 'Reco',
    shortDesc: 'Permintaan Barang - Dikelola & Dipindahkan dari Modul Penyiapan',
    category: 'Permintaan & Relokasi',
    icon: ClipboardList,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-purple-50 text-purple-600 border border-purple-200/80',
    colorBorder: 'border-purple-200',
    colorIcon: 'text-purple-600',
    plannedFeatures: [
      'Manajemen Permintaan Barang & Relokasi',
      'Pindah Massal & Terintegrasi dari Modul Penyiapan',
      'Tracking Lokasi (WH-RECO-01), SLOC (SL03) & Status Permintaan',
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
  },
  {
    id: 'menu-h',
    title: 'Repack',
    shortDesc: 'Manajemen Repacking Produk & Promo Bundling dari Modul Penyiapan',
    category: 'Repack & Bundling',
    icon: Boxes,
    isReady: true,
    requiresAdmin: false,
    colorBg: 'bg-amber-50 text-amber-600 border border-amber-200/80',
    colorBorder: 'border-amber-200',
    colorIcon: 'text-amber-600',
    plannedFeatures: [
      'Manajemen Data Repack & Bundling Produk',
      'Transfer Massal Otomatis dari Modul Penyiapan Outbound',
      'Tracking Lokasi Repack (WH-REPACK-01), SLOC (SL04) & Destinasi Promo',
      'Upload & Export Laporan Excel (.xlsx) dengan Template Standar'
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
      {visibleTools.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onOpenTool(tool.id)}
            className="p-2.5 sm:p-3 rounded-xl transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer border bg-white hover:bg-slate-50 active:bg-blue-50/40 border-slate-200/90 hover:border-slate-300 shadow-2xs group select-none min-h-[88px] sm:min-h-[96px]"
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
            <span className="mt-1.5 text-xs font-semibold text-slate-800 group-hover:text-blue-900 leading-tight tracking-tight text-center line-clamp-2 w-full">
              {tool.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
