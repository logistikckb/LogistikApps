// User & Role Types
export type UserRole = 'Admin' | 'Pelaksana';
export type UserStatus = 'Aktif' | 'Nonaktif';

export interface UserPermissions {
  canInputIncoming: boolean;
  canTally: boolean;
  canEditMasterBarang: boolean;
  canManageUsers: boolean;
  canApproveQC: boolean;
  canAccessDatabase: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  nama: string;
  pin?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  email_google?: string;
  permissions: UserPermissions;
  created_at?: string;
  updated_at?: string;
}

export const SEED_USERS: UserProfile[] = [];

export type BroadcastCategory = 'info' | 'urgent' | 'warning' | 'announcement' | 'Pengumuman' | 'Peringatan' | 'Inbound' | 'Maintenance' | 'Operasional';

export interface BroadcastMessage {
  id: string;
  sender_name?: string;
  author_name?: string;
  title?: string;
  content?: string;
  message?: string;
  category: BroadcastCategory;
  priority?: string;
  device_info?: string;
  is_pinned?: boolean;
  is_active?: boolean;
  created_at: string;
}

// Master Data Barang (Supabase table: public.data_barang)
export interface DataBarang {
  item_code: string;
  barcode?: string;
  item_name: string;
  category?: string;
  uom?: string;
  shelf_life?: string;
  status: 'Aktif' | 'Nonaktif';
  created_at?: string;
  updated_at?: string;
}

// Master Data Distributor (Supabase table: public.data_distributor)
export interface DataDistributor {
  kode_ld: string;
  nama_distributor: string;
  status: 'Aktif' | 'Nonaktif';
  created_at?: string;
  updated_at?: string;
}

// Transaksi Kedatangan / Inbound (Supabase table: public.incoming)
export interface IncomingItem {
  id_incoming: string;
  jenis?: string;
  id_distributor?: string;
  distributor?: string;
  item_code: string;
  item_name: string;
  category?: string;
  location?: string;
  location_type?: string;
  first_qty?: number;
  last_qty?: number;
  uom?: string;
  qty_convert?: number;
  uom_convert?: string;
  lpn_serial_number?: string;
  batch?: string;
  vendor_batch?: string;
  sloc?: string;
  expired_date?: string;
  destination_code?: string;
  qc_code?: string;
  user_tally?: string;
  shelf_life?: string;
  source?: string;
  user_input?: string;
  tanggal_update?: string;
  status?: string;
  tujuan?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

// Transaksi Penyiapan Barang Outbound (Supabase table: public.data_penyiapan)
export interface PenyiapanItem {
  id_penyiapan: string;
  tujuan?: string;
  item_code: string;
  item_name: string;
  category?: string;
  location?: string;
  location_type?: string;
  first_qty?: number;
  last_qty?: number;
  uom?: string;
  qty_convert?: number;
  uom_convert?: string;
  lpn_serial_number?: string;
  batch?: string;
  vendor_batch?: string;
  sloc?: string;
  expired_date?: string;
  destination_code?: string;
  qc_code?: string;
  user_tally?: string;
  shelf_life?: string;
  source?: string;
  user_input?: string;
  tanggal_update?: string;
  status?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}


// Transaksi Cek Fisik / Penyiapan Pemusnahan (Supabase table: public.data_cek_fisik_pemusnahan)
// Struktur logika dan kolom sama persis 100% dengan data_penyiapan untuk staging check fisik pemusnahan
export interface CekFisikPemusnahanItem {
  id_cek_fisik: string;
  tujuan?: string;
  item_code: string;
  item_name: string;
  category?: string;
  location?: string;
  location_type?: string;
  first_qty?: number;
  last_qty?: number;
  uom?: string;
  qty_convert?: number;
  uom_convert?: string;
  lpn_serial_number?: string;
  batch?: string;
  vendor_batch?: string;
  sloc?: string;
  expired_date?: string;
  destination_code?: string;
  qc_code?: string;
  user_tally?: string;
  shelf_life?: string;
  source?: string;
  user_input?: string;
  tanggal_update?: string;
  status?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

// Transaksi Pemusnahan / Disposal Barang (Supabase table: public.data_pemusnahan)
export interface PemusnahanItem {
  id_pemusnahan: string;
  tujuan?: string;
  item_code: string;
  item_name: string;
  category?: string;
  location?: string;
  location_type?: string;
  first_qty?: number;
  last_qty?: number;
  uom?: string;
  qty_convert?: number;
  uom_convert?: string;
  lpn_serial_number?: string;
  batch?: string;
  vendor_batch?: string;
  sloc?: string;
  expired_date?: string;
  destination_code?: string;
  qc_code?: string;
  user_tally?: string;
  shelf_life?: string;
  source?: string;
  user_input?: string;
  tanggal_update?: string;
  status?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}


// Transaksi Data Inventory (Supabase table: public.data_inventory)
// Struktur sama persis dengan data_penyiapan TANPA kolom tanggal_update
export interface InventoryItem {
  id_inventory: string;
  tujuan?: string;
  item_code: string;
  item_name: string;
  category?: string;
  location?: string;
  location_type?: string;
  first_qty?: number;
  last_qty?: number;
  uom?: string;
  qty_convert?: number;
  uom_convert?: string;
  lpn_serial_number?: string;
  batch?: string;
  vendor_batch?: string;
  sloc?: string;
  expired_date?: string;
  destination_code?: string;
  qc_code?: string;
  user_tally?: string;
  shelf_life?: string;
  source?: string;
  user_input?: string;
  status?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
  child_ids?: string[];
  child_count?: number;
}

// Transaksi Monitoring Pengambilan Sample
export interface MonitoringSampleItem {
  status: string; // STATUS proses, misalnya OPEN, CLOSE
  tanggal: string; // TANGGAL transaksi/proses
  no_sppj: string; // NO. SPPJ
  id_barang: string; // ID barang
  deskripsi: string; // DESKRIPSI barang atau pekerjaan
  qty: number | string; // QTY
  unit: string; // UNIT (CAR, PCS, dll)
  wms: string; // WMS status/proses
  sap: string; // SAP status/proses
  pic: string; // PIC (Person in Charge)
  note: string; // NOTE (Catatan/keterangan)
  _rowIndex?: number;
}

