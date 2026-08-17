// System / OS Web Notification, Dynamic Tab Alert, & Multi-Channel Notification Engine
import { BroadcastMessage } from '../types';
import { playBroadcastSound, triggerDeviceVibrate } from './broadcastSound';

let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'CKB Logistic Hub';
let titleFlashInterval: ReturnType<typeof setInterval> | null = null;
let originalFaviconHref: string | null = null;
let faviconFlashInterval: ReturnType<typeof setInterval> | null = null;

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Triggers an OS-level notification banner that appears above any active window/app across all OS & browsers.
 */
export async function triggerSystemBroadcastNotification(
  broadcast: BroadcastMessage,
  onNotificationClick?: () => void
) {
  // 1. Flash browser tab title & favicon (works on ALL browsers even if OS permission is denied)
  const shortMsg = broadcast.message.length > 30 
    ? broadcast.message.substring(0, 30) + '...' 
    : broadcast.message;
  startTabAlert(`🚨 [SIARAN] ${broadcast.sender_name}: ${shortMsg}`);

  // 2. Trigger OS Notification if permitted
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const title = `📢 Pesan Siaran: ${broadcast.sender_name}`;
  const options: any = {
    body: broadcast.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `ckb-broadcast-${broadcast.id || Date.now()}`,
    renotify: true,
    requireInteraction: true, // Keep notification pinned until user interacts (Windows/Mac/Android)
    silent: false,
    vibrate: [300, 150, 300, 150, 450],
    data: {
      url: window.location.href,
      broadcastId: broadcast.id,
      senderName: broadcast.sender_name,
      message: broadcast.message
    }
  };

  try {
    // Priority A: Try through active Service Worker registration (handles Android Chrome, Edge, PWA best)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    }

    // Priority B: Standard Web Notification API
    const notif = new Notification(title, options);
    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notif.close();
      stopTabAlert();
      if (onNotificationClick) {
        onNotificationClick();
      }
    };
  } catch (err) {
    console.warn('Standard showNotification failed, trying lightweight fallback:', err);
    try {
      const fallbackNotif = new Notification(title, {
        body: broadcast.message,
        icon: '/favicon.svg'
      });
      fallbackNotif.onclick = () => {
        window.focus();
        fallbackNotif.close();
        stopTabAlert();
        if (onNotificationClick) onNotificationClick();
      };
    } catch {
      // Ignored
    }
  }
}

/**
 * Executes a forceful, multi-channel notification trigger across all available hardware and software layers:
 * 1. Physical Device Vibration (Mobile phones / tablets)
 * 2. Web Audio API Acoustic Sound Chime (Synthesizer)
 * 3. System / OS Notification Banner (Desktop & Mobile Lockscreen/PWA)
 * 4. Flashing Browser Tab Title
 * 5. Flashing Red Alert Favicon
 */
export function forceDeviceBroadcastAlert(
  broadcast: BroadcastMessage,
  soundEnabled: boolean = true,
  onNotificationClick?: () => void
) {
  // Layer 1: Physical Vibration
  triggerDeviceVibrate([300, 150, 300, 150, 500]);

  // Layer 2: Audio chime
  if (soundEnabled) {
    playBroadcastSound(broadcast.category || 'info');
  }

  // Layer 3 & 4 & 5: System Notification, Title & Favicon
  triggerSystemBroadcastNotification(broadcast, onNotificationClick);
}

/**
 * Alternates the document title between original and alert text
 */
export function startTabAlert(alertText: string) {
  if (typeof document === 'undefined') return;
  
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }

  if (!originalDocumentTitle || originalDocumentTitle.includes('🚨')) {
    originalDocumentTitle = 'CKB Logistic Hub';
  }

  let isAlert = true;
  document.title = alertText;

  titleFlashInterval = setInterval(() => {
    document.title = isAlert ? originalDocumentTitle : alertText;
    isAlert = !isAlert;
  }, 800);

  startFaviconFlash();

  // Auto clear when user returns to this window/tab
  const onFocusOrVisible = () => {
    if (!document.hidden) {
      stopTabAlert();
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    }
  };

  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);
}

/**
 * Creates dynamic flashing alert on browser favicon
 */
function startFaviconFlash() {
  if (typeof document === 'undefined') return;
  
  const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!favicon) return;

  if (!originalFaviconHref) {
    originalFaviconHref = favicon.href;
  }

  if (faviconFlashInterval) {
    clearInterval(faviconFlashInterval);
    faviconFlashInterval = null;
  }

  let isRed = false;
  // Red alert icon SVG data URI
  const redAlertIcon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="%23ef4444" stroke="%23ffffff" stroke-width="8"/><path d="M50 24v32M50 68v8" stroke="%23ffffff" stroke-width="10" stroke-linecap="round"/></svg>';

  faviconFlashInterval = setInterval(() => {
    if (favicon) {
      favicon.href = isRed ? (originalFaviconHref || '/favicon.svg') : redAlertIcon;
      isRed = !isRed;
    }
  }, 800);
}

export function stopTabAlert() {
  if (typeof document === 'undefined') return;
  
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = originalDocumentTitle || 'CKB Logistic Hub';

  if (faviconFlashInterval) {
    clearInterval(faviconFlashInterval);
    faviconFlashInterval = null;
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (favicon && originalFaviconHref) {
      favicon.href = originalFaviconHref;
    }
  }
}

