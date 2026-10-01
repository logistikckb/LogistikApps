/**
 * PWA Service Worker Registration, Code Update Detection & Lifecycle Management
 */
import { playBroadcastSound, triggerDeviceVibrate } from './utils/broadcastSound';
import { startTabAlert, triggerSystemBroadcastNotification } from './utils/systemNotification';

export const CURRENT_APP_VERSION = '2.6.0';
export const CURRENT_BUILD_TIMESTAMP = 1727748800000;

export interface AppUpdateInfo {
  version: string;
  buildTimestamp?: number;
  releaseDate?: string;
  changelog?: string[];
  detectedAt: Date;
  isFromServiceWorker?: boolean;
}

type UpdateListener = (info: AppUpdateInfo) => void;

let activeRegistration: ServiceWorkerRegistration | null = null;
let pendingUpdateInfo: AppUpdateInfo | null = null;
const updateListeners = new Set<UpdateListener>();
let isReloadingForUpdate = false;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Register a callback whenever a new code update is detected
 */
export function subscribeToAppUpdates(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  // If an update is already pending, immediately notify the new listener
  if (pendingUpdateInfo) {
    listener(pendingUpdateInfo);
  }
  return () => {
    updateListeners.delete(listener);
  };
}

/**
 * Dispatches an update notification to all UI listeners and hardware alert layers
 */
export function notifyUpdateAvailable(info: AppUpdateInfo) {
  pendingUpdateInfo = info;
  console.log('[PWA Update] New code version available:', info);

  // 1. Notify all subscribers (React PwaContext & UI)
  updateListeners.forEach((listener) => {
    try {
      listener(info);
    } catch (e) {
      console.error('[PWA Update] Listener error:', e);
    }
  });

  // 2. Play acoustic announcement chime & vibration
  try {
    playBroadcastSound('announcement');
    triggerDeviceVibrate([250, 120, 250, 120, 400]);
  } catch {
    // Ignore audio error if context suspended
  }

  // 3. Start dynamic flashing tab title
  try {
    startTabAlert(`🚀 [UPDATE] LogistikApps v${info.version} Tersedia!`);
  } catch {
    // Ignore
  }

  // 4. Send OS / Web Notification if permitted
  try {
    triggerSystemBroadcastNotification(
      {
        id: `update-${info.version}-${Date.now()}`,
        sender_name: 'Pembaruan LogistikApps',
        message: `Versi baru (${info.version}) telah dirilis. Ketuk untuk memuat pembaruan sistem terkini.`,
        category: 'announcement',
        created_at: new Date().toISOString(),
      },
      () => {
        applyAppUpdate();
      }
    );
  } catch {
    // Ignore
  }
}

/**
 * Compare two semver strings (returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal)
 */
function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const clean2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Actively checks for updates via both Service Worker byte check and remote version manifest
 */
export async function checkForAppUpdate(): Promise<{
  hasUpdate: boolean;
  updateInfo?: AppUpdateInfo;
  reason?: string;
}> {
  // If an update is already pending in memory
  if (pendingUpdateInfo) {
    return { hasUpdate: true, updateInfo: pendingUpdateInfo, reason: 'Sudah ada pembaruan siap dipasang' };
  }

  let detectedUpdate: AppUpdateInfo | null = null;

  // Step 1: Trigger native Service Worker update check if available
  if (activeRegistration && typeof activeRegistration.update === 'function') {
    try {
      await activeRegistration.update();
      if (activeRegistration.waiting) {
        detectedUpdate = {
          version: CURRENT_APP_VERSION,
          detectedAt: new Date(),
          isFromServiceWorker: true,
          changelog: ['Pembaruan kode modul dan perbaikan sistem terbaru.']
        };
      }
    } catch (swErr) {
      console.debug('[PWA] sw update check error:', swErr);
    }
  }

  // Step 2: Live check remote version JSON (cache-busted)
  try {
    const timestamp = Date.now();
    const res = await fetch(`/api/app-version?_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const remoteVersion = data.version || '2.5.0';
      const remoteTimestamp = Number(data.buildTimestamp) || 0;

      const isVersionNewer = compareSemver(remoteVersion, CURRENT_APP_VERSION) > 0;
      const isTimestampNewer = remoteTimestamp > CURRENT_BUILD_TIMESTAMP;

      if (isVersionNewer || isTimestampNewer || (detectedUpdate && !pendingUpdateInfo)) {
        detectedUpdate = {
          version: remoteVersion,
          buildTimestamp: remoteTimestamp,
          releaseDate: data.releaseDate || 'Hari ini',
          changelog: Array.isArray(data.changelog) && data.changelog.length > 0 
            ? data.changelog 
            : ['Pembaruan performa dan stabilitas aplikasi.'],
          detectedAt: new Date(),
          isFromServiceWorker: !!detectedUpdate,
        };
      }
    }
  } catch (err) {
    console.debug('[PWA] Remote version check error:', err);
  }

  if (detectedUpdate) {
    notifyUpdateAvailable(detectedUpdate);
    return { hasUpdate: true, updateInfo: detectedUpdate, reason: 'Pembaruan kode baru terdeteksi' };
  }

  return { hasUpdate: false, reason: 'Aplikasi sudah menggunakan versi terbaru' };
}

/**
 * Applies the pending update: sends SKIP_WAITING to worker and reloads the window
 */
export async function applyAppUpdate(): Promise<void> {
  if (isReloadingForUpdate) return;
  isReloadingForUpdate = true;

  console.log('[PWA Update] Applying update & refreshing application...');

  // 1. Send SKIP_WAITING to waiting service worker if available
  if (activeRegistration && activeRegistration.waiting) {
    activeRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  // Also broadcast postMessage to any worker
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }

  // 2. Clear old caches if caches API is available
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (!key.includes(CURRENT_APP_VERSION)) {
          await caches.delete(key).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback reload after brief timeout if controllerchange does not trigger
  setTimeout(() => {
    window.location.reload();
  }, 600);
}

/**
 * Simulates a code update for testing and demonstration in UI
 */
export function simulateUpdateForTesting() {
  const simulatedInfo: AppUpdateInfo = {
    version: '2.5.1',
    buildTimestamp: Date.now(),
    releaseDate: 'Versi Baru (Uji Coba)',
    changelog: [
      'Fitur notifikasi pembaruan kode instan di PWA',
      'Penyegaran memori aplikasi otomatis saat update',
      'Peningkatan kecepatan baca barcode Honeywell PM42',
      'Sinkronisasi Google Spreadsheet latar belakang'
    ],
    detectedAt: new Date(),
    isFromServiceWorker: false
  };
  notifyUpdateAvailable(simulatedInfo);
}

/**
 * Registers the Service Worker and binds lifecycle events
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Purge any stale caches from previous versions immediately on startup
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (!key.includes(CURRENT_APP_VERSION)) {
          console.log('[PWA] Purging outdated cache:', key);
          caches.delete(key).catch(() => {});
        }
      });
    }).catch(() => {});
  }

  // Listen for controllerchange to reload seamlessly when new service worker takes over
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloadingForUpdate) {
      window.location.reload();
    }
  });

  // Handle messages received from Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'UPDATE_AVAILABLE') {
      checkForAppUpdate();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        activeRegistration = reg;
        console.log('[PWA] Service Worker registered with scope:', reg.scope);

        // Check if there is already a waiting service worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable({
            version: CURRENT_APP_VERSION,
            detectedAt: new Date(),
            isFromServiceWorker: true,
            changelog: ['Versi baru telah diunduh di latar belakang. Siap dipasang.']
          });
        }

        // Listen for new updates downloading
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // A new worker is installed and waiting
                  checkForAppUpdate();
                } else {
                  console.log('[PWA] Core assets pre-cached for offline use.');
                }
              }
            };
          }
        };

        // Run an initial check after startup (3 seconds delay)
        setTimeout(() => {
          checkForAppUpdate();
        }, 3000);
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });

  // Setup periodic background update check (every 10 minutes)
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    checkForAppUpdate();
  }, 10 * 60 * 1000);

  // Check whenever user brings the app/tab back into focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
    }
  });

  // Check whenever network connectivity comes back online
  window.addEventListener('online', () => {
    checkForAppUpdate();
  });
}
