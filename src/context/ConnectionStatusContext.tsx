import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

export type ConnectionStatus = 'Live' | 'Offline' | 'Checking';

interface ConnectionStatusContextType {
  status: ConnectionStatus;
  isOnline: boolean;
  latencyMs: number | null;
  lastCheckTime: Date | null;
  isChecking: boolean;
  errorMessage: string | null;
  checkConnection: () => Promise<boolean>;
  showDetailsModal: boolean;
  setShowDetailsModal: (show: boolean) => void;
}

const ConnectionStatusContext = createContext<ConnectionStatusContextType | undefined>(undefined);

// Interval heartbeat pemantauan koneksi secara berkala (10 detik saat online, 5 detik jika offline)
const HEARTBEAT_INTERVAL_ONLINE_MS = 10000;
const HEARTBEAT_INTERVAL_OFFLINE_MS = 5000;
const PROBE_TIMEOUT_MS = 6000;

export function ConnectionStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(navigator.onLine ? 'Checking' : 'Offline');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  const isCheckingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Melakukan probe heartbeat pembacaan data langsung ke database cloud server
   * untuk memastikan koneksi benar-benar aktif dan dapat membaca data.
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    // 1. Cek status koneksi hardware browser / jaringan
    if (!navigator.onLine) {
      setStatus('Offline');
      setLatencyMs(null);
      setErrorMessage('Perangkat Anda terputus dari jaringan internet.');
      setLastCheckTime(new Date());
      return false;
    }

    if (!isSupabaseConfigured) {
      setStatus('Offline');
      setLatencyMs(null);
      setErrorMessage('Kredensial database cloud belum dikonfigurasi.');
      setLastCheckTime(new Date());
      return false;
    }

    if (isCheckingRef.current) return status === 'Live';
    isCheckingRef.current = true;
    setIsChecking(true);

    const startTime = performance.now();

    try {
      // Buat timeout promise untuk mendeteksi jaringan lambat / freeze
      const timeoutPromise = new Promise<{ error: { message: string } }>((_, reject) => {
        setTimeout(() => reject(new Error('Waktu tunggu koneksi server habis (>6 detik)')), PROBE_TIMEOUT_MS);
      });

      // Lakukan real query read ke tabel database untuk memverifikasi kemampuan membaca data
      const queryPromise = supabase
        .from('users')
        .select('id')
        .limit(1);

      const res: any = await Promise.race([queryPromise, timeoutPromise]);
      const elapsed = Math.round(performance.now() - startTime);

      if (res && !res.error && Array.isArray(res.data)) {
        setStatus('Live');
        setLatencyMs(elapsed);
        setLastCheckTime(new Date());
        setErrorMessage(null);
        isCheckingRef.current = false;
        setIsChecking(false);
        return true;
      }

      // Cadangan probe jika tabel users mengalami kendala
      const backupStart = performance.now();
      const backupRes = await supabase.from('data_barang').select('item_code').limit(1);
      const backupElapsed = Math.round(performance.now() - backupStart);

      if (!backupRes.error && Array.isArray(backupRes.data)) {
        setStatus('Live');
        setLatencyMs(backupElapsed);
        setLastCheckTime(new Date());
        setErrorMessage(null);
        isCheckingRef.current = false;
        setIsChecking(false);
        return true;
      }

      throw new Error(res?.error?.message || backupRes?.error?.message || 'Server database tidak merespon pembacaan data.');
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setStatus('Offline');
      setLatencyMs(elapsed > 0 ? elapsed : null);
      setLastCheckTime(new Date());
      setErrorMessage(err?.message || 'Koneksi ke server cloud database terputus.');
      isCheckingRef.current = false;
      setIsChecking(false);
      return false;
    }
  }, [status]);

  // Siklus Heartbeat terus-menerus
  useEffect(() => {
    // Jalankan pemeriksaan pertama kali saat dimuat
    checkConnection();

    const scheduleNextCheck = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const interval = status === 'Offline' ? HEARTBEAT_INTERVAL_OFFLINE_MS : HEARTBEAT_INTERVAL_ONLINE_MS;
      timerRef.current = setTimeout(async () => {
        await checkConnection();
        scheduleNextCheck();
      }, interval);
    };

    scheduleNextCheck();

    // Event listener deteksi online/offline browser seketika
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setStatus('Offline');
      setLatencyMs(null);
      setErrorMessage('Koneksi internet perangkat terputus.');
      setLastCheckTime(new Date());
    };

    // Saat tab dibuka kembali dari background, cek seketika
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkConnection, status]);

  const value: ConnectionStatusContextType = {
    status,
    isOnline: status === 'Live',
    latencyMs,
    lastCheckTime,
    isChecking,
    errorMessage,
    checkConnection,
    showDetailsModal,
    setShowDetailsModal,
  };

  return (
    <ConnectionStatusContext.Provider value={value}>
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionStatusContextType {
  const context = useContext(ConnectionStatusContext);
  if (!context) {
    throw new Error('useConnectionStatus must be used within a ConnectionStatusProvider');
  }
  return context;
}
