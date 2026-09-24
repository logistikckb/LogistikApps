import React, { useState } from 'react';
import { 
  CalendarCheck2, 
  Sparkles,
  Database,
  Boxes,
  Truck,
  QrCode,
  Flame,
  ClipboardList,
  Package,
  Eye,
  EyeOff,
  Settings2,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMenuVisibility } from '../hooks/useMenuVisibility';
import { MenuVisibilityModal } from './admin/MenuVisibilityModal';
import { MenuPinAuthModal } from './admin/MenuPinAuthModal';
import { useNotification } from '../context/NotificationContext';

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
    requiresAdmin: true,
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
    requiresAdmin: true,
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
    requiresAdmin: true,
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
    requiresAdmin: true,
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
  const { showToast } = useNotification();

  const {
    hiddenMenuIds,
    toggleMenuVisibility,
    unhideAllMenus,
    isSyncing,
    lastSyncTime
  } = useMenuVisibility();

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showHiddenInGrid, setShowHiddenInGrid] = useState(false);

  // Keamanan PIN khusus untuk fitur Hide / Unhide (PIN: 399339)
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requirePinForAction = (action: () => void) => {
    if (isPinVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPinModal(true);
    }
  };

  const handlePinSuccess = () => {
    setIsPinVerified(true);
    showToast('PIN Terverifikasi', 'Akses kelola visibilitas menu diaktifkan.', 'success');
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // Filter tools:
  // 1. Check requiresAdmin
  // 2. Check hidden status
  const visibleTools = TOOLS_LIST.filter(tool => {
    if (tool.requiresAdmin && !isSuperAdmin) {
      return false;
    }
    const isHidden = hiddenMenuIds.includes(tool.id);
    if (isHidden) {
      // Non-admin can NEVER see hidden tools
      if (!isSuperAdmin) return false;
      // Admin can view if toggle is turned on
      return showHiddenInGrid;
    }
    return true;
  });

  const hiddenCount = hiddenMenuIds.length;

  return (
    <div className="space-y-2.5">
      {/* Top Header / Bar for Menu Management (Admin Only) */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-800 tracking-tight">
            Menu Operasional
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            ({visibleTools.length} modul aktif)
          </span>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHiddenInGrid(prev => !prev)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showHiddenInGrid 
                    ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                }`}
                title={showHiddenInGrid ? 'Sembunyikan menu nonaktif dari grid' : 'Tampilkan menu yang sedang di-hide di grid ini'}
              >
                <EyeOff size={12} className="text-rose-600" />
                <span>{hiddenCount} Menu Dihide</span>
                <span className="text-[9px] underline ml-0.5">
                  ({showHiddenInGrid ? 'Tampil di Grid' : 'Lihat'})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => requirePinForAction(() => setShowVisibilityModal(true))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
              title="Atur Hide / Unhide menu untuk seluruh perangkat tim (Memerlukan PIN 399339)"
            >
              {isPinVerified ? (
                <Unlock size={12} className="text-emerald-600" />
              ) : (
                <Lock size={12} className="text-amber-600" />
              )}
              <span>Atur Menu (Hide/Unhide)</span>
            </button>

            {isPinVerified && (
              <button
                type="button"
                onClick={() => {
                  setIsPinVerified(false);
                  showToast('Akses Dikunci', 'PIN diperlukan kembali untuk mengubah menu.', 'info');
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-800 cursor-pointer transition-colors"
                title="Kunci kembali akses pengaturan menu"
              >
                <Lock size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid of Menus */}
      {visibleTools.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <EyeOff size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-bold text-slate-700 m-0">Tidak ada menu yang ditampilkan saat ini.</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isSuperAdmin ? 'Semua menu sedang disembunyikan. Silakan buka menu Atur Menu untuk mengaktifkan kembali.' : 'Silakan hubungi Administrator untuk mengaktifkan akses menu.'}
          </p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => requirePinForAction(() => setShowVisibilityModal(true))}
              className="mt-3 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer shadow-sm"
            >
              Atur Menu Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
          {visibleTools.map((tool) => {
            const Icon = tool.icon;
            const isHidden = hiddenMenuIds.includes(tool.id);

            return (
              <div key={tool.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onOpenTool(tool.id)}
                  className={`w-full p-2.5 sm:p-3 rounded-xl transition-all relative flex flex-col items-center justify-center text-center cursor-pointer border shadow-2xs select-none min-h-[88px] sm:min-h-[96px] ${
                    isHidden
                      ? 'bg-rose-50/40 border-dashed border-rose-300 opacity-70 hover:opacity-100 hover:bg-rose-50'
                      : 'bg-white hover:bg-slate-50 active:bg-blue-50/40 border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Ready Indicator dot for active tool */}
                  {tool.isReady && !isHidden && (
                    <span 
                      className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white" 
                      title="Modul Aktif"
                    />
                  )}

                  {/* Super Admin Badge on top left if tool requires admin */}
                  {tool.requiresAdmin && !isHidden && (
                    <span 
                      className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8px] font-bold uppercase tracking-wider"
                      title="Khusus Super Admin"
                    >
                      ADMIN
                    </span>
                  )}

                  {/* Hidden Indicator Badge */}
                  {isHidden && (
                    <span 
                      className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-md bg-rose-100 border border-rose-300 text-rose-800 text-[8px] font-extrabold uppercase tracking-wider flex items-center gap-0.5"
                      title="Disembunyikan di semua perangkat user"
                    >
                      <EyeOff size={8} /> HIDE
                    </span>
                  )}

                  {/* Icon Container with Light Pastel Fill */}
                  <div 
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${tool.colorBg} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 ${
                      isHidden ? 'grayscale-40 opacity-70' : ''
                    }`}
                  >
                    <Icon size={18} className="sm:size-[19px]" />
                  </div>

                  {/* Nama Menu di Bawah Icon */}
                  <span className={`mt-1.5 text-xs font-semibold leading-tight tracking-tight text-center line-clamp-2 w-full ${
                    isHidden ? 'text-slate-500' : 'text-slate-800 group-hover:text-blue-900'
                  }`}>
                    {tool.title}
                  </span>
                </button>

                {/* Quick Unhide button for Admin when hovering on hidden menu */}
                {isSuperAdmin && isHidden && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requirePinForAction(() => toggleMenuVisibility(tool.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110 z-10"
                    title={`Klik untuk Unhide "${tool.title}" di semua perangkat (Perlu PIN 399339)`}
                  >
                    <Eye size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Pengaturan Visibilitas Menu (Admin Only) */}
      {isSuperAdmin && (
        <MenuVisibilityModal
          isOpen={showVisibilityModal}
          onClose={() => setShowVisibilityModal(false)}
          onLock={() => setIsPinVerified(false)}
          hiddenMenuIds={hiddenMenuIds}
          onToggleVisibility={toggleMenuVisibility}
          onUnhideAll={unhideAllMenus}
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
          showToast={showToast}
        />
      )}

      {/* Modal Verifikasi PIN Khusus Hide/Unhide (PIN 399339) */}
      {isSuperAdmin && (
        <MenuPinAuthModal
          isOpen={showPinModal}
          onClose={() => {
            setShowPinModal(false);
            setPendingAction(null);
          }}
          onSuccess={handlePinSuccess}
          title="Verifikasi PIN Menu"
          description="Masukkan PIN keamanan 399339 untuk melakukan Hide / Unhide menu di semua perangkat."
        />
      )}
    </div>
  );
}
