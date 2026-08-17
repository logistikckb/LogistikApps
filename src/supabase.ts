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
