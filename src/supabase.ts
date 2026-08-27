import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve URL from Vite env, defines, or localStorage overrides
function getResolvedUrl(): string {
  const envUrl = 
    (import.meta.env.VITE_SUPABASE_URL as string) || 
    (import.meta.env.SUPABASE_URL as string) || 
    '';
  
  if (envUrl && envUrl.startsWith('https://') && !envUrl.includes('YOUR_SUPABASE_URL')) {
    return envUrl.trim();
  }

  try {
    const saved = localStorage.getItem('ckb_custom_supabase_url');
    if (saved && saved.startsWith('https://')) {
      return saved.trim();
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

  if (envKey && envKey.length > 20 && !envKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    return envKey.trim();
  }

  try {
    const saved = localStorage.getItem('ckb_custom_supabase_anon_key');
    if (saved && saved.length > 20) {
      return saved.trim();
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
    (import.meta.env.VITE_SHARED_SUPABASE_URL as string) || 
    (import.meta.env.SUPABASE_BROADCAST_URL as string) || 
    '';
  
  if (envUrl && envUrl.startsWith('https://') && !envUrl.includes('YOUR_SUPABASE_URL')) {
    return envUrl.trim();
  }

  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_url');
    if (saved && saved.startsWith('https://')) {
      return saved.trim();
    }
  } catch {
    // ignore
  }

  return '';
}

function getResolvedSharedBroadcastKey(): string {
  const envKey = 
    (import.meta.env.VITE_SHARED_BROADCAST_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.VITE_SHARED_SUPABASE_ANON_KEY as string) || 
    (import.meta.env.SUPABASE_BROADCAST_ANON_KEY as string) || 
    '';

  if (envKey && envKey.length > 20 && !envKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    return envKey.trim();
  }

  try {
    const saved = localStorage.getItem('ckb_shared_broadcast_supabase_anon_key');
    if (saved && saved.length > 20) {
      return saved.trim();
    }
  } catch {
    // ignore
  }

  return '';
}

const resolvedUrl = getResolvedUrl();
const resolvedKey = getResolvedKey();

export const isSupabaseConfigured = Boolean(
  resolvedUrl &&
  resolvedKey &&
  resolvedUrl.startsWith('https://') &&
  !resolvedUrl.includes('placeholder')
);

export const supabaseUrl = isSupabaseConfigured ? resolvedUrl : 'https://placeholder.supabase.co';
export const supabaseAnonKey = isSupabaseConfigured ? resolvedKey : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Shared Broadcast Bridge Client
const resolvedSharedUrl = getResolvedSharedBroadcastUrl();
const resolvedSharedKey = getResolvedSharedBroadcastKey();

export const isSharedBroadcastConfigured = Boolean(
  resolvedSharedUrl &&
  resolvedSharedKey &&
  resolvedSharedUrl.startsWith('https://') &&
  !resolvedSharedUrl.includes('placeholder') &&
  // Only consider active if it is different from primary database OR explicitly configured
  (resolvedSharedUrl !== resolvedUrl || Boolean(localStorage.getItem('ckb_shared_broadcast_supabase_url')))
);

export const sharedBroadcastUrl = isSharedBroadcastConfigured ? resolvedSharedUrl : '';
export const sharedBroadcastAnonKey = isSharedBroadcastConfigured ? resolvedSharedKey : '';

export const sharedBroadcastSupabase: SupabaseClient | null = isSharedBroadcastConfigured
  ? createClient(resolvedSharedUrl, resolvedSharedKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
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

  if (!currentUrl || !currentKey) {
    return {
      connected: false,
      url: currentUrl || 'Belum Terhubung',
      tables: { users: false, broadcasts: false, links: false, todos: false },
      details: 'Kredensial Server Cloud belum terkonfigurasi pada Environment / Secrets.',
    };
  }

  const result: ConnectionTestResult = {
    connected: false,
    url: currentUrl,
    tables: { users: false, broadcasts: false, links: false, todos: false },
    details: '',
  };

  try {
    // Test 1: Users table
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('id, username, role')
      .limit(5);

    if (!usersErr && usersData) {
      result.tables.users = true;
      result.connected = true;
    }

    // Test 2: Broadcast table (checks broadcast / broadcasts / broadcast_messages)
    const { error: bErr } = await supabase
      .from('broadcast')
      .select('id')
      .limit(1);

    if (!bErr) {
      result.tables.broadcasts = true;
    } else {
      const { error: bErr2 } = await supabase.from('broadcasts').select('id').limit(1);
      if (!bErr2) {
        result.tables.broadcasts = true;
      } else {
        const { error: bErr3 } = await supabase.from('broadcast_messages').select('id').limit(1);
        if (!bErr3) result.tables.broadcasts = true;
      }
    }

    // Test 3: Links / quick_links
    const { error: lErr } = await supabase
      .from('links')
      .select('id')
      .limit(1);

    if (!lErr) {
      result.tables.links = true;
    } else {
      const { error: lErr2 } = await supabase.from('quick_links').select('id').limit(1);
      if (!lErr2) result.tables.links = true;
    }

    // Test 4: Todos
    const { error: tErr } = await supabase
      .from('todos')
      .select('id')
      .limit(1);

    if (!tErr) result.tables.todos = true;

    result.latencyMs = Date.now() - startTime;

    if (result.connected) {
      const userCount = usersData ? usersData.length : 0;
      result.details = `Server Cloud terhubung dengan stabil. ${userCount} data akun pengguna tersinkronisasi (${result.latencyMs}ms).`;
    } else if (usersErr) {
      result.details = `Koneksi server aktif, status respon tabel data: ${usersErr.message}`;
    }
  } catch (err: any) {
    result.connected = false;
    result.details = `Status koneksi: ${err.message || err}`;
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
      message: 'Tersimpan di perangkat lokal (Supabase belum terkonfigurasi).'
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
      // Jika tabel app_settings belum dibuat di Supabase
      if (error.code === '42P01' || error.message.includes('relation "app_settings" does not exist')) {
        return {
          success: false,
          message: 'Tabel "app_settings" belum dibuat di Supabase. Silakan jalankan SQL Setup yang disediakan.'
        };
      }
      return {
        success: false,
        message: `Gagal menyimpan ke Supabase: ${error.message}`
      };
    }

    return {
      success: true,
      message: 'Berhasil disimpan ke Database Supabase! Konfigurasi kini otomatis aktif di semua perangkat tim.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menyimpan ke Supabase.'
    };
  }
}
