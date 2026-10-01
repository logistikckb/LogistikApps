import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  const envUrl = 
    (import.meta.env.VITE_SUPABASE_URL as string) || 
    (import.meta.env.SUPABASE_URL as string) || 
    '';
  
  if (envUrl && !envUrl.includes('YOUR_SUPABASE_URL')) {
    const cleaned = cleanUrl(envUrl);
    if (cleaned.startsWith('https://')) return cleaned;
  }

  try {
    const saved = localStorage.getItem('ckb_custom_supabase_url');
    if (saved) {
      const cleaned = cleanUrl(saved);
      if (cleaned.startsWith('https://')) return cleaned;
    }
  } catch {
    // ignore
  }

  return '';
}

function getResolvedKey(): string {
  const envKey = 
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SUPABASE_ANON_KEY as string) || 
    '';

  if (envKey && !envKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    const cleaned = cleanKey(envKey);
    if (cleaned.length > 20) return cleaned;
  }

  try {
    const saved = localStorage.getItem('ckb_custom_supabase_anon_key');
    if (saved) {
      const cleaned = cleanKey(saved);
      if (cleaned.length > 20) return cleaned;
    }
  } catch {
    // ignore
  }

  return '';
}

// ============================================================================
// SECONDARY / SHARED BROADCAST BRIDGE (Jembatan Pesan Siaran Antar-Aplikasi)
// ============================================================================
function getResolvedSharedBroadcastUrl(): string {
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
  
  if (envUrl && !envUrl.includes('YOUR_SUPABASE_URL')) {
    const cleaned = cleanUrl(envUrl);
    if (cleaned.startsWith('https://')) return cleaned;
  }

  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_url');
    if (saved) {
      const cleaned = cleanUrl(saved);
      if (cleaned.startsWith('https://')) return cleaned;
    }
  } catch {
    // ignore
  }

  return '';
}

function getResolvedSharedBroadcastKey(): string {
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

  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_anon_key');
    if (saved) {
      const cleaned = cleanKey(saved);
      if (cleaned.length > 20) return cleaned;
    }
  } catch {
    // ignore
  }

  return '';
}

const resolvedUrl = getResolvedUrl();
const resolvedKey = getResolvedKey();

// Supabase aktif jika URL dan Anon Key tersedia (dari env vars atau localStorage)
export const isSupabaseConfigured = Boolean(resolvedUrl && resolvedKey);
export const supabaseUrl = resolvedUrl || 'https://placeholder.supabase.co';
export const supabaseAnonKey = resolvedKey || '';
export const isDatabaseSpreadsheetOnly = !isSupabaseConfigured;

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
    links: boolean;
    todos: boolean;
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
      tables: { users: false, broadcasts: false, links: false, todos: false },
      details: 'Kredensial Server Database Supabase belum dikonfigurasi. Aplikasi beroperasi dalam mode lokal offline.',
    };
  }

  const result: ConnectionTestResult = {
    connected: false,
    url: currentUrl,
    tables: { users: false, broadcasts: false, links: false, todos: false },
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

    // 3. Test links table
    const { error: linkErr } = await supabase.from('links').select('id').limit(1);
    if (!linkErr) result.tables.links = true;

    // 4. Test todos table
    const { error: todoErr } = await supabase.from('todos').select('id').limit(1);
    if (!todoErr) result.tables.todos = true;

    // 5. Test data_penyiapan table
    const { error: penyiapanErr } = await supabase.from('data_penyiapan').select('id_penyiapan').limit(1);

    result.latencyMs = Date.now() - startTime;
    result.connected = !userErr || !bErr || !penyiapanErr || !linkErr || !todoErr;

    if (result.connected) {
      result.details = `Server Cloud Supabase Terhubung Aktif (${result.latencyMs}ms). Data otomatis sinkron secara realtime di semua perangkat.`;
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
      tables: { users: false, broadcasts: false, links: false, todos: false },
      details: 'Jembatan Siaran Antar-Aplikasi belum dikonfigurasi.',
    };
  }

  const result: ConnectionTestResult = {
    connected: false,
    url: currentUrl,
    tables: { users: false, broadcasts: false, links: false, todos: false },
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

/**
 * Ambil SEMUA baris dari tabel Supabase dengan otomatis melakukan iterasi/pagination
 * untuk melewati batas default 1000 baris PostgREST server.
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
  const selectCols = options?.selectCols || '*';
  const orderBy = options?.orderBy;
  const ascending = options?.ascending ?? true;

  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select(selectCols)
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
        allRows = allRows.concat(data as T[]);
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
