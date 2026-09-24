import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getAppSettingFromSupabase, saveAppSettingToSupabase, isSupabaseConfigured } from '../supabase';
import { ToolId } from '../components/ToolsNavigation';
import { useAuth } from '../context/AuthContext';

const SETTING_KEY = 'hidden_menu_ids';
const LOCAL_STORAGE_KEY = `ckb_app_setting_${SETTING_KEY}`;
const REALTIME_CHANNEL_NAME = 'menu_visibility_realtime_sync';

export const MENU_VISIBILITY_PIN = '399339';

export function useMenuVisibility() {
  const { currentUser, isAdmin } = useAuth();
  const isSuperAdmin = isAdmin || currentUser?.role === 'Admin' || currentUser?.username?.toLowerCase() === 'superadmin';

  // 1. Inisialisasi awal dari cache lokal untuk fast load tanpa delay
  const [hiddenMenuIds, setHiddenMenuIds] = useState<ToolId[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed as ToolId[];
      }
    } catch {}
    return [];
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Channel ref untuk broadcast realtime antar perangkat
  const channelRef = useRef<any>(null);

  // Update state dan cache lokal
  const applyHiddenMenuIds = useCallback((newIds: ToolId[]) => {
    setHiddenMenuIds(newIds);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newIds));
    } catch {}
    setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
  }, []);

  // 2. Mengambil data konfigurasi terbaru dari Cloud Supabase
  const fetchFromCloud = useCallback(async () => {
    try {
      const cloudValue = await getAppSettingFromSupabase<ToolId[]>(SETTING_KEY, []);
      if (Array.isArray(cloudValue)) {
        applyHiddenMenuIds(cloudValue);
      }
    } catch (err) {
      console.warn('[useMenuVisibility] Gagal mengambil konfigurasi cloud:', err);
    } finally {
      setIsLoading(false);
    }
  }, [applyHiddenMenuIds]);

  // 3. Realtime Listener: Mendengarkan perubahan dari perangkat lain secara langsung!
  useEffect(() => {
    fetchFromCloud();

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const channel = supabase
        .channel(REALTIME_CHANNEL_NAME)
        // A. Realtime Broadcast event (sangat cepat, latensi < 100ms antar browser)
        .on('broadcast', { event: 'visibility_updated' }, (response: any) => {
          if (response?.payload?.hiddenMenuIds && Array.isArray(response.payload.hiddenMenuIds)) {
            console.log('[useMenuVisibility] Menerima update visibilitas menu via Broadcast Realtime:', response.payload);
            applyHiddenMenuIds(response.payload.hiddenMenuIds);
          }
        })
        // B. Postgres Database Changes event (jika tabel app_settings diupdate)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${SETTING_KEY}` },
          (payload: any) => {
            const rawVal = payload?.new?.value;
            if (rawVal) {
              const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
              if (Array.isArray(parsed)) {
                console.log('[useMenuVisibility] Menerima update visibilitas menu via Postgres Changes:', parsed);
                applyHiddenMenuIds(parsed);
              }
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[useMenuVisibility] Terhubung ke channel sinkronisasi menu realtime.');
          }
        });

      channelRef.current = channel;

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    } catch (e) {
      console.warn('[useMenuVisibility] Gagal menginisialisasi listener realtime:', e);
    }
  }, [fetchFromCloud, applyHiddenMenuIds]);

  // 4. Fungsi Simpan & Broadcast ke SEMUA Perangkat
  const saveAndBroadcast = async (nextIds: ToolId[]) => {
    setIsSyncing(true);
    applyHiddenMenuIds(nextIds);

    const updatedBy = currentUser?.nama || currentUser?.username || 'Admin';

    // A. Broadcast langsung ke semua perangkat aktif via channel Supabase
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'visibility_updated',
          payload: {
            hiddenMenuIds: nextIds,
            updatedBy,
            timestamp: new Date().toISOString()
          }
        });
      } catch (err) {
        console.warn('[useMenuVisibility] Gagal mengirim broadcast websocket:', err);
      }
    }

    // B. Simpan ke database Supabase agar perangkat yang offline / baru buka nanti tetap tersinkron
    try {
      const res = await saveAppSettingToSupabase(SETTING_KEY, nextIds, updatedBy);
      return res;
    } catch (err: any) {
      console.error('[useMenuVisibility] Gagal menyimpan ke cloud:', err);
      return { success: false, message: err?.message || 'Gagal menyimpan ke server cloud.' };
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle Hide / Unhide suatu menu
  const toggleMenuVisibility = async (toolId: ToolId) => {
    const isHidden = hiddenMenuIds.includes(toolId);
    const nextIds = isHidden
      ? hiddenMenuIds.filter(id => id !== toolId)
      : [...hiddenMenuIds, toolId];

    return await saveAndBroadcast(nextIds);
  };

  // Sembunyikan Menu spesifik
  const hideMenu = async (toolId: ToolId) => {
    if (hiddenMenuIds.includes(toolId)) return { success: true };
    const nextIds = [...hiddenMenuIds, toolId];
    return await saveAndBroadcast(nextIds);
  };

  // Tampilkan Menu spesifik
  const unhideMenu = async (toolId: ToolId) => {
    if (!hiddenMenuIds.includes(toolId)) return { success: true };
    const nextIds = hiddenMenuIds.filter(id => id !== toolId);
    return await saveAndBroadcast(nextIds);
  };

  // Buka / Tampilkan Semua Menu (Unhide All)
  const unhideAllMenus = async () => {
    return await saveAndBroadcast([]);
  };

  // Helper periksa apakah menu tersembunyi
  const isMenuHidden = useCallback((toolId: ToolId) => {
    return hiddenMenuIds.includes(toolId);
  }, [hiddenMenuIds]);

  return {
    hiddenMenuIds,
    isLoading,
    isSyncing,
    lastSyncTime,
    isMenuHidden,
    toggleMenuVisibility,
    hideMenu,
    unhideMenu,
    unhideAllMenus,
    refreshVisibility: fetchFromCloud,
    isSuperAdmin
  };
}
