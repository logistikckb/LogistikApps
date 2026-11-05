import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Production Credentials (Fallback otomatis jika env vars belum terbaca pada perangkat/PWA klien)
export const DEFAULT_SUPABASE_URL = 'https://lvxnozabjemsvejkkwvx.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eG5vemFiamVtc3Zlamtrd3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjI0NTcsImV4cCI6MjEwMjM5ODQ1N30.haeBn4x-QBhpTdZoJpCV39B7xPABuadcFjmtm5K3At4';

export const DEFAULT_SHARED_BROADCAST_URL = 'https://elwdoyfviqrhfvpqwfmx.supabase.co';
export const DEFAULT_SHARED_BROADCAST_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd2RveWZ2aXFyaGZ2cHF3Zm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTQ2NjcsImV4cCI6MjA4OTk5MDY2N30.ElQJLokg0uBDfquesI085RVQlz5mhIbn6M7kahH-y9A';

// Resolve URL from Vite env, defines, or localStorage overrides
function cleanUrl(raw: string): string {
  if (!raw) return '';
  let url = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/+$/, '');
}

function cleanKey(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

function getResolvedUrl(): string {
  // 1. Cek penyimpanan kustom di localStorage (abaikan jika berisi placeholder)
  try {
    const saved = localStorage.getItem('ckb_custom_supabase_url');
    if (saved && !saved.includes('placeholder') && !saved.includes('YOUR_SUPABASE_URL')) {
      const cleaned = cleanUrl(saved);
      if (cleaned.startsWith('https://') && cleaned.includes('.supabase.co')) return cleaned;
    }
  } catch {
    // ignore
  }

  // 2. Cek env var dari Vite (import.meta.env)
  const envUrl = 
    (import.meta.env.VITE_SUPABASE_URL as string) || 
    (import.meta.env.SUPABASE_URL as string) || 
    '';
  
  if (envUrl && !envUrl.includes('YOUR_SUPABASE_URL') && !envUrl.includes('placeholder')) {
    const cleaned = cleanUrl(envUrl);
    if (cleaned.startsWith('https://')) return cleaned;
  }

  // 3. Fallback ke URL Produksi Pusat (Menjamin SEMUA perangkat selalu terhubung ke database yang sama)
  return DEFAULT_SUPABASE_URL;
}

function getResolvedKey(): string {
  // 1. Cek penyimpanan kustom di localStorage (abaikan jika tidak valid)
  try {
    const saved = localStorage.getItem('ckb_custom_supabase_anon_key');
    if (saved && !saved.includes('YOUR_SUPABASE_ANON_KEY') && saved.length > 20) {
      const cleaned = cleanKey(saved);
      if (cleaned.length > 20) return cleaned;
    }
  } catch {
    // ignore
  }

  // 2. Cek env var dari Vite (import.meta.env)
  const envKey = 
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SUPABASE_ANON_KEY as string) || 
    '';

  if (envKey && !envKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    const cleaned = cleanKey(envKey);
    if (cleaned.length > 20) return cleaned;
  }

  // 3. Fallback ke Key Produksi Pusat
  return DEFAULT_SUPABASE_ANON_KEY;
}

// ============================================================================
// SECONDARY / SHARED BROADCAST BRIDGE (Jembatan Pesan Siaran Antar-Aplikasi)
// ============================================================================
function getResolvedSharedBroadcastUrl(): string {
  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_url');
    if (saved && !saved.includes('placeholder') && !saved.includes('YOUR_SUPABASE_URL')) {
      const cleaned = cleanUrl(saved);
      if (cleaned.startsWith('https://') && cleaned.includes('.supabase.co')) return cleaned;
    }
  } catch {
    // ignore
  }

  const envUrl = 
    (import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_URL as string) || 
    (import.meta.env.VITE_SHARED_BROADCAST_URL as string) || 
    (import.meta.env.VITE_SHARED_SUPABASE_URL as string) || 
    (import.meta.env.SHARED_BROADCAST_SUPABASE_URL as string) || 
    (import.meta.env.SHARED_SUPABASE_URL as string) || 
    (import.meta.env.SUPABASE_BROADCAST_URL as string) || 
    (import.meta.env.VITE_APP2_SUPABASE_URL as string) || 
    (import.meta.env.APP2_SUPABASE_URL as string) || 
    '';
  
  if (envUrl && !envUrl.includes('YOUR_SUPABASE_URL') && !envUrl.includes('placeholder')) {
    const cleaned = cleanUrl(envUrl);
    if (cleaned.startsWith('https://')) return cleaned;
  }

  return DEFAULT_SHARED_BROADCAST_URL;
}

function getResolvedSharedBroadcastKey(): string {
  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_anon_key');
    if (saved && !saved.includes('YOUR_SUPABASE_ANON_KEY') && saved.length > 20) {
      const cleaned = cleanKey(saved);
      if (cleaned.length > 20) return cleaned;
    }
  } catch {
    // ignore
  }

  const envKey = 
    (import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.VITE_SHARED_BROADCAST_ANON_KEY as string) || 
    (import.meta.env.VITE_SHARED_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SHARED_BROADCAST_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SHARED_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SUPABASE_BROADCAST_ANON_KEY as string) || 
    (import.meta.env.VITE_APP2_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.APP2_SUPABASE_ANON_KEY as string) || 
    '';

  if (envKey && !envKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    const cleaned = cleanKey(envKey);
    if (cleaned.length > 20) return cleaned;
  }

  return DEFAULT_SHARED_BROADCAST_KEY;
}

const resolvedUrl = getResolvedUrl();
const resolvedKey = getResolvedKey();

// Supabase aktif jika URL dan Anon Key tersedia (dari env vars atau localStorage)
export const isSupabaseConfigured = Boolean(resolvedUrl && resolvedKey);
export const supabaseUrl = resolvedUrl || 'https://placeholder.supabase.co';
export const supabaseAnonKey = resolvedKey || '';

function createSafeDummyQueryBuilder() {
  const dummyResult = { data: [], error: null, count: 0 };
  const builder: any = {
    select: () => builder,
    insert: () => Promise.resolve(dummyResult),
    upsert: () => Promise.resolve(dummyResult),
    update: () => Promise.resolve(dummyResult),
    delete: () => Promise.resolve(dummyResult),
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    ilike: () => builder,
    like: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any, reject?: any) => Promise.resolve(dummyResult).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(dummyResult).catch(reject),
  };
  return builder;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(resolvedUrl, resolvedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : ({
      from: () => createSafeDummyQueryBuilder(),
      channel: () => ({
        on: function() { return this; },
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
      removeChannel: () => {},
      removeAllChannels: () => {},
      getChannels: () => [],
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as any);

// Shared Broadcast Bridge Client
const resolvedSharedBroadcastUrl = getResolvedSharedBroadcastUrl();
const resolvedSharedBroadcastKey = getResolvedSharedBroadcastKey();

export const isSharedBroadcastConfigured = Boolean(resolvedSharedBroadcastUrl && resolvedSharedBroadcastKey);
export const sharedBroadcastUrl = resolvedSharedBroadcastUrl;
export const sharedBroadcastAnonKey = resolvedSharedBroadcastKey;
export const sharedBroadcastSupabase: SupabaseClient | null = isSharedBroadcastConfigured
  ? createClient(resolvedSharedBroadcastUrl, resolvedSharedBroadcastKey)
  : null;

export interface ConnectionTestResult {
  connected: boolean;
  url: string;
  tables: {
    users: boolean;
    broadcasts: boolean;
    penyiapan: boolean;
    barang: boolean;
    links?: boolean;
    todos?: boolean;
  };
  details: string;
  latencyMs?: number;
}

/**
 * Tes koneksi komprehensif ke Server Cloud dan modul data
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const currentUrl = getResolvedUrl();
  const currentKey = getResolvedKey();

  if (!currentUrl || !currentKey || !isSupabaseConfigured) {
    return {
      connected: false,
      url: currentUrl || 'Belum Terhubung',
      tables: { users: false, broadcasts: false, penyiapan: false, barang: false },
      details: 'Kredensial Server Database belum dikonfigurasi. Pastikan koneksi server cloud aktif.',
    };
  }

  const result: ConnectionTestResult = {
    connected: false,
    url: currentUrl,
    tables: { users: false, broadcasts: false, penyiapan: false, barang: false },
    details: '',
  };

  try {
    // 1. Test users table
    const { error: userErr } = await supabase.from('users').select('id').limit(1);
    if (!userErr) result.tables.users = true;

    // 2. Test broadcast table
    const { error: bErr } = await supabase.from('broadcast').select('id').limit(1);
    if (!bErr) {
      result.tables.broadcasts = true;
    } else {
      const { error: bErr2 } = await supabase.from('broadcasts').select('id').limit(1);
      if (!bErr2) result.tables.broadcasts = true;
    }

    // 3. Test data_penyiapan table
    const { error: penyiapanErr } = await supabase.from('data_penyiapan').select('id_penyiapan').limit(1);
    if (!penyiapanErr) result.tables.penyiapan = true;

    // 4. Test data_barang table
    const { error: barangErr } = await supabase.from('data_barang').select('item_code').limit(1);
    if (!barangErr) result.tables.barang = true;

    result.latencyMs = Date.now() - startTime;
    result.connected = !userErr || !bErr || !penyiapanErr || !barangErr;

    if (result.connected) {
      result.details = `Server Cloud Terhubung Aktif (${result.latencyMs}ms). Data otomatis sinkron secara realtime di semua perangkat.`;
    } else {
      result.details = `Koneksi ke server gagal: ${userErr?.message || penyiapanErr?.message || 'Periksa URL dan Key'}`;
    }
  } catch (err: any) {
    result.connected = false;
    result.details = `Status server: ${err.message || err}`;
  }

  return result;
}

export function saveCustomSupabaseCredentials(url: string, key: string): void {
  try {
    if (url) localStorage.setItem('ckb_custom_supabase_url', url.trim());
    if (key) localStorage.setItem('ckb_custom_supabase_anon_key', key.trim());
    window.location.reload();
  } catch {
    // ignore
  }
}

/**
 * Simpan Kredensial Database Jembatan Siaran Antar-Aplikasi (Secondary Supabase)
 */
export function saveSharedBroadcastCredentials(url: string, key: string): void {
  try {
    if (url) localStorage.setItem('ckb_shared_broadcast_supabase_url', url.trim());
    if (key) localStorage.setItem('ckb_shared_broadcast_supabase_anon_key', key.trim());
    window.location.reload();
  } catch {
    // ignore
  }
}

/**
 * Hapus / Reset Kredensial Jembatan Siaran (Kembali ke mode database mandiri)
 */
export function removeSharedBroadcastCredentials(): void {
  try {
    localStorage.removeItem('ckb_shared_broadcast_supabase_url');
    localStorage.removeItem('ckb_shared_broadcast_supabase_anon_key');
    window.location.reload();
  } catch {
    // ignore
  }
}

/**
 * Tes koneksi khusus untuk Database Jembatan Siaran Antar-Aplikasi (Secondary Supabase)
 */
export async function testSharedBroadcastConnection(): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const currentUrl = getResolvedSharedBroadcastUrl();
  const currentKey = getResolvedSharedBroadcastKey();

  if (!currentUrl || !currentKey || !sharedBroadcastSupabase) {
    return {
      connected: false,
      url: currentUrl || 'Belum Terhubung',
      tables: { users: false, broadcasts: false, penyiapan: false, barang: false },
      details: 'Jembatan Siaran Antar-Aplikasi belum dikonfigurasi.',
    };
  }

  const result: ConnectionTestResult = {
    connected: false,
    url: currentUrl,
    tables: { users: false, broadcasts: false, penyiapan: false, barang: false },
    details: '',
  };

  try {
    // Test broadcast table on shared/secondary database
    const { error: bErr } = await sharedBroadcastSupabase
      .from('broadcast')
      .select('id')
      .limit(1);

    if (!bErr) {
      result.tables.broadcasts = true;
      result.connected = true;
    } else {
      const { error: bErr2 } = await sharedBroadcastSupabase.from('broadcasts').select('id').limit(1);
      if (!bErr2) {
        result.tables.broadcasts = true;
        result.connected = true;
      } else {
        const { error: bErr3 } = await sharedBroadcastSupabase.from('broadcast_messages').select('id').limit(1);
        if (!bErr3) {
          result.tables.broadcasts = true;
          result.connected = true;
        }
      }
    }

    result.latencyMs = Date.now() - startTime;

    if (result.connected) {
      result.details = `Jembatan Siaran Terhubung Aktif! Siaran instan sinkron dengan Aplikasi Pasangan (${result.latencyMs}ms).`;
    } else {
      result.details = 'Koneksi ke Database Siaran Pasangan gagal. Pastikan URL & Anon Key benar dan tabel "broadcast" sudah dibuat.';
    }
  } catch (err: any) {
    result.connected = false;
    result.details = `Status jembatan siaran: ${err.message || err}`;
  }

  return result;
}

// Daftar kolom spesifik per tabel untuk mengurangi ukuran payload & latensi jaringan Supabase
export const SUPABASE_TABLE_COLUMNS = {
  users: 'id, username, nama, pin, avatar, role, status, email_google, permissions, created_at, updated_at',
  broadcast: 'id, sender_name, author_name, message, content, title, category, priority, device_info, is_pinned, is_active, created_at',
  broadcasts: 'id, title, content, category, priority, author_id, author_name, author_role, is_pinned, is_active, created_at',
  broadcast_messages: 'id, sender_name, message, category, device_info, created_at',
  data_barang: 'item_code, barcode, item_name, status, created_at, updated_at',
  data_distributor: 'kode_ld, nama_distributor, status, created_at, updated_at',
  incoming: 'id_incoming, jenis, id_distributor, distributor, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, tujuan, created_at, updated_at',
  data_penyiapan: 'id_penyiapan, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_picking: 'id_picking, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_cek_fisik_pemusnahan: 'id_cek_fisik, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_pemusnahan: 'id_pemusnahan, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_reco: 'id_reco, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_repack: 'id_repack, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, tanggal_update, status, note, created_at, updated_at',
  data_inventory: 'id_inventory, tujuan, item_code, item_name, category, location, location_type, first_qty, last_qty, uom, qty_convert, uom_convert, lpn_serial_number, batch, vendor_batch, sloc, expired_date, destination_code, qc_code, user_tally, shelf_life, source, user_input, status, note, created_at, updated_at',
  documents: 'id, nomor_sj, jenis_id, tanggal, tujuan_id, up, no_telpon, created_at',
  items: 'id, doc_id, rekap_no, nama_barang, ctn, pcs, berat, kubikasi, keterangan',
  jenis: 'id, kode, nama',
  tujuan: 'id, nama, alamat, kota, up, no_telpon',
  pengirim: 'nama, alamat, kota_kab, telp',
  rekapan_sj: 'id, judul, tanggal_rekap, total_sj, total_item, total_ctn, total_pcs, total_berat, total_kubikasi, data_detail, keterangan, created_at',
  promosi: 'id, nomor, tgl_terima, material, pengirim, penerima, nopol, expedisi, jumlah_ctn, jumlah_pcs, keterangan, created_at',
  links: 'id, title, url, category, subcategory, icon, created_at',
  todos: 'id, task, status, created_at',
  settings: 'id, order, messages',
  app_settings: 'key, value, updated_at'
} as const;

/**
 * Ambil SEMUA baris dari tabel Supabase dengan otomatis melakukan iterasi/pagination
 * untuk melewati batas default 1000 baris PostgREST server dan hanya memilih kolom yang diperlukan.
 */
export async function fetchAllRowsFromSupabase<T = any>(
  tableName: string,
  options?: {
    orderBy?: string;
    ascending?: boolean;
    selectCols?: string;
    pageSize?: number;
  }
): Promise<T[]> {
  if (!isSupabaseConfigured) return [];

  const pageSize = options?.pageSize || 1000;
  const activeSelectCols = options?.selectCols || (SUPABASE_TABLE_COLUMNS as Record<string, string>)[tableName] || 'id';
  const orderBy = options?.orderBy;
  const ascending = options?.ascending ?? true;

  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select(activeSelectCols)
        .range(from, from + pageSize - 1);

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      const { data, error } = await query;

      if (error) {
        console.warn(`[fetchAllRowsFromSupabase] Error pada tabel ${tableName} offset ${from}:`, error);
        break;
      }

      if (data && data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          allRows.push(data[i] as T);
        }
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }
  } catch (err) {
    console.error(`[fetchAllRowsFromSupabase] Error saat mengambil tabel ${tableName}:`, err);
  }

  return allRows;
}

// ============================================================================
// SHARED IN-MEMORY MASTER DATA CACHE (Mencegah JSON.parse & Fetch Berulang)
// ============================================================================
const MASTER_BARANG_CACHE_KEY = 'ckb_master_data_barang_cache';
const MASTER_DIST_CACHE_KEY = 'ckb_master_data_distributor_cache';
const MASTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit di memori RAM

let memoryBarangCache: any[] | null = null;
let memoryBarangLastFetch = 0;
let inFlightBarangPromise: Promise<any[]> | null = null;

let memoryDistCache: any[] | null = null;
let memoryDistLastFetch = 0;
let inFlightDistPromise: Promise<any[]> | null = null;

export function getCachedMasterBarangSync<T = any>(): T[] {
  if (memoryBarangCache) return memoryBarangCache as T[];
  try {
    const raw = localStorage.getItem(MASTER_BARANG_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryBarangCache = parsed;
        return parsed as T[];
      }
    }
  } catch {}
  return [];
}

export function setSharedMasterBarangCache<T = any>(items: T[]): void {
  memoryBarangCache = items;
  memoryBarangLastFetch = Date.now();
  try {
    if (items.length > 0) {
      localStorage.setItem(MASTER_BARANG_CACHE_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(MASTER_BARANG_CACHE_KEY);
    }
  } catch {}
}

export async function getSharedMasterBarang<T = any>(forceRefresh = false): Promise<T[]> {
  if (!forceRefresh && memoryBarangCache && memoryBarangCache.length > 0 && Date.now() - memoryBarangLastFetch < MASTER_CACHE_TTL_MS) {
    return memoryBarangCache as T[];
  }
  if (!isSupabaseConfigured) {
    return getCachedMasterBarangSync<T>();
  }
  if (inFlightBarangPromise) {
    return inFlightBarangPromise as Promise<T[]>;
  }

  inFlightBarangPromise = (async () => {
    try {
      const data = await fetchAllRowsFromSupabase<any>('data_barang', {
        orderBy: 'item_name',
        ascending: true,
        selectCols: SUPABASE_TABLE_COLUMNS.data_barang
      });
      if (Array.isArray(data) && data.length > 0) {
        const map = new Map<string, any>();
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item?.item_code) {
            map.set(String(item.item_code).trim().toLowerCase(), item);
          }
        }
        const deduped = Array.from(map.values());
        setSharedMasterBarangCache(deduped);
        return deduped;
      }
    } catch (err) {
      console.warn('[getSharedMasterBarang] Gagal memuat dari cloud:', err);
    } finally {
      inFlightBarangPromise = null;
    }
    return getCachedMasterBarangSync<T>();
  })();

  return inFlightBarangPromise as Promise<T[]>;
}

export function getCachedMasterDistributorSync<T = any>(): T[] {
  if (memoryDistCache) return memoryDistCache as T[];
  try {
    const raw = localStorage.getItem(MASTER_DIST_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryDistCache = parsed;
        return parsed as T[];
      }
    }
  } catch {}
  return [];
}

export function setSharedMasterDistributorCache<T = any>(items: T[]): void {
  memoryDistCache = items;
  memoryDistLastFetch = Date.now();
  try {
    if (items.length > 0) {
      localStorage.setItem(MASTER_DIST_CACHE_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(MASTER_DIST_CACHE_KEY);
    }
  } catch {}
}

export async function getSharedMasterDistributor<T = any>(forceRefresh = false): Promise<T[]> {
  if (!forceRefresh && memoryDistCache && memoryDistCache.length > 0 && Date.now() - memoryDistLastFetch < MASTER_CACHE_TTL_MS) {
    return memoryDistCache as T[];
  }
  if (!isSupabaseConfigured) {
    return getCachedMasterDistributorSync<T>();
  }
  if (inFlightDistPromise) {
    return inFlightDistPromise as Promise<T[]>;
  }

  inFlightDistPromise = (async () => {
    try {
      const data = await fetchAllRowsFromSupabase<any>('data_distributor', {
        orderBy: 'nama_distributor',
        ascending: true,
        selectCols: SUPABASE_TABLE_COLUMNS.data_distributor
      });
      if (Array.isArray(data) && data.length > 0) {
        const map = new Map<string, any>();
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const key = String(item?.kode_ld || item?.nama_distributor || '').trim().toLowerCase();
          if (key) {
            map.set(key, item);
          }
        }
        const deduped = Array.from(map.values());
        setSharedMasterDistributorCache(deduped);
        return deduped;
      }
    } catch (err) {
      console.warn('[getSharedMasterDistributor] Gagal memuat dari cloud:', err);
    } finally {
      inFlightDistPromise = null;
    }
    return getCachedMasterDistributorSync<T>();
  })();

  return inFlightDistPromise as Promise<T[]>;
}

/**
 * Mengambil konfigurasi global dari database Supabase (Tabel: app_settings)
 * dengan fallback ke localStorage jika offline atau tabel belum ada.
 */
export async function getAppSettingFromSupabase<T = any>(
  key: string,
  defaultValue: T
): Promise<T> {
  // 1. Coba dari localStorage terlebih dahulu sebagai nilai instan
  let localValue: T = defaultValue;
  try {
    const cached = localStorage.getItem(`ckb_app_setting_${key}`);
    if (cached) {
      localValue = JSON.parse(cached);
    }
  } catch {}

  if (!isSupabaseConfigured) {
    return localValue;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data && data.value !== undefined) {
      const parsedValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      // Simpan ke local cache untuk fast load berikutnya
      try {
        localStorage.setItem(`ckb_app_setting_${key}`, JSON.stringify(parsedValue));
      } catch {}
      return parsedValue as T;
    }
  } catch (err) {
    console.warn(`[getAppSettingFromSupabase] Gagal mengambil setting "${key}":`, err);
  }

  return localValue;
}

/**
 * Menyimpan konfigurasi global ke database Supabase (Tabel: app_settings)
 * sehingga otomatis aktif dan terbaca di SEMUA perangkat anggota tim.
 */
export async function saveAppSettingToSupabase<T = any>(
  key: string,
  value: T,
  updatedBy?: string
): Promise<{ success: boolean; message?: string }> {
  // Simpan ke local cache
  try {
    localStorage.setItem(`ckb_app_setting_${key}`, JSON.stringify(value));
  } catch {}

  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: 'Tersimpan di perangkat lokal (Server cloud belum terkonfigurasi).'
    };
  }

  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || 'Admin'
      }, { onConflict: 'key' });

    if (error) {
      // Jika tabel app_settings belum dibuat
      if (error.code === '42P01' || error.message.includes('relation "app_settings" does not exist')) {
        return {
          success: false,
          message: 'Tabel konfigurasi sistem belum tersedia pada Server Pusat. Silakan lakukan inisialisasi skema.'
        };
      }
      return {
        success: false,
        message: `Gagal menyimpan ke Server Pusat: ${error.message}`
      };
    }

    return {
      success: true,
      message: 'Berhasil disimpan ke Server Pusat! Konfigurasi kini otomatis aktif di semua perangkat tim.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menyimpan ke Server Pusat.'
    };
  }
}
