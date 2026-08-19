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

export interface LinkData {
  id: string;
  title: string;
  url: string;
  category: string;
  subcategory?: string;
  icon?: string;
}

export type TodoPriority = 'rendah' | 'sedang' | 'tinggi' | 'mendesak';

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

export interface TodoData {
  id: string;
  task: string;
  status: 'no' | 'onproses' | 'close';
  priority?: TodoPriority;
  is_blinking?: boolean;
}

export interface ParsedTodoTask {
  cleanTask: string;
  priority: TodoPriority;
  isBlinking: boolean;
}

export function parseTodoTask(rawTask: string, rawPriority?: string, rawBlinking?: boolean): ParsedTodoTask {
  let task = rawTask || '';
  let priority: TodoPriority = 'rendah';
  let isBlinking = false;

  if (rawPriority && ['rendah', 'sedang', 'tinggi', 'mendesak'].includes(rawPriority)) {
    priority = rawPriority as TodoPriority;
  }
  if (rawBlinking !== undefined) {
    isBlinking = !!rawBlinking;
  }

  const pMatch = task.match(/\[P:(rendah|sedang|tinggi|mendesak)\]/i);
  if (pMatch) {
    priority = pMatch[1].toLowerCase() as TodoPriority;
    task = task.replace(pMatch[0], '');
  }

  if (/\[BLINK\]/i.test(task) || /\[BLINK:true\]/i.test(task)) {
    isBlinking = true;
    task = task.replace(/\[BLINK(:true)?\]/gi, '');
  } else if (/\[BLINK:false\]/i.test(task)) {
    isBlinking = false;
    task = task.replace(/\[BLINK:false\]/gi, '');
  }

  if (priority === 'mendesak' && rawBlinking === undefined && !rawTask.includes('[BLINK:false]')) {
    isBlinking = true;
  }

  return {
    cleanTask: task.trim(),
    priority,
    isBlinking
  };
}

export function formatTodoTask(cleanTask: string, priority: TodoPriority, isBlinking: boolean): string {
  let result = cleanTask.trim();
  if (priority && priority !== 'rendah') {
    result = `[P:${priority}] ${result}`;
  }
  if (isBlinking) {
    result = `[BLINK] ${result}`;
  }
  return result;
}

// Master Data Barang (Supabase table: public.data_barang)
export interface DataBarang {
  item_code: string;
  barcode?: string;
  item_name: string;
  category?: string;
  uom?: string;
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
