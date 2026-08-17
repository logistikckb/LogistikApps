import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationContext';
import { Smartphone, Download, Share2, X, Check, Laptop, Monitor, Sparkles, AlertCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isStandalone: boolean;
  canInstall: boolean;
  isIos: boolean;
  isOnline: boolean;
  promptInstall: () => void;
  openInstallGuide: () => void;
}

const PwaContext = createContext<PwaContextType | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useNotification();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect standalone mode (already installed & running from home screen/desktop)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    // 2. Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    // 3. Online/Offline status
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi Pulih', 'Aplikasi kembali online & sinkronisasi aktif.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mode Offline', 'Aplikasi berjalan dari cache lokal offline.', 'info');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Capture beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('[PWA] beforeinstallprompt event intercepted');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. App Installed event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowInstallGuideModal(false);
      showToast('Aplikasi Terpasang', 'CKBLogistic Hub berhasil dipasang ke perangkat Anda!', 'success');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  const openInstallGuide = useCallback(() => {
    setShowInstallGuideModal(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          showToast('Memasang...', 'Sedang menambahkan CKBLogistic Hub ke layar utama', 'success');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA install prompt error:', err);
        setShowInstallGuideModal(true);
      }
    } else {
      // If native deferred prompt not available (e.g. iOS or already shown or desktop browser), show guide
      setShowInstallGuideModal(true);
    }
  }, [deferredPrompt, showToast]);

  // Can install if NOT currently running in standalone mode
  const canInstall = !isStandalone;

  return (
    <PwaContext.Provider
      value={{
        isStandalone,
        canInstall,
        isIos,
        isOnline,
        promptInstall,
        openInstallGuide,
      }}
    >
      {children}

      {/* Comprehensive Universal PWA Install Guide Modal */}
      {showInstallGuideModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-200 text-slate-800 text-left relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Background Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-blue-900/20">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 m-0 uppercase tracking-tight">
                    Pasang CKBLogistic Hub
                  </h3>
                  <p className="text-[11px] text-blue-900 font-bold m-0">Akses Cepat, Fullscreen & Offline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* If deferred prompt exists, offer direct button */}
            {deferredPrompt && (
              <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="text-xs text-blue-950 font-semibold">
                  Peramban mendukung instalasi 1-klik otomatis:
                </div>
                <button
                  type="button"
                  onClick={() => {
                    promptInstall();
                    setShowInstallGuideModal(false);
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-900 to-cyan-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 transition-transform active:scale-95"
                >
                  <Download size={14} />
                  <span>Pasang Sekarang</span>
                </button>
              </div>
            )}

            {/* Platform Specific Guides */}
            <div className="space-y-3.5 text-xs text-slate-700 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {isIos ? (
                /* iOS Safari Guide */
                <div className="space-y-2.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                    <Smartphone size={14} className="text-blue-900" />
                    <span>Petunjuk untuk iPhone / iPad (Safari):</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      Buka di browser <strong>Safari</strong>, lalu ketuk tombol <strong>Bagikan / Share</strong> (
                      <Share2 size={13} className="inline mx-0.5 text-blue-700" />) di bilah bawah layar.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      Gulir menu ke bawah lalu pilih <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon aplikasi akan muncul di layar ponsel Anda!
                    </div>
                  </div>
                </div>
              ) : (
                /* Android & Desktop Guide */
                <div className="space-y-3">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                    <Smartphone size={14} className="text-emerald-700" />
                    <span>Untuk Android (Chrome / Edge / Samsung):</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      Ketuk <strong>Titik Tiga (⋮)</strong> di sudut kanan atas browser Chrome/Edge.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      Pilih menu <strong>"Install app"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide mb-2">
                      <Monitor size={14} className="text-blue-900" />
                      <span>Untuk Komputer / Laptop (Chrome / Edge / Windows / Mac):</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <p className="m-0 leading-relaxed">
                        Klik ikon <strong>Install (<Download size={12} className="inline text-blue-900" />)</strong> pada bilah alamat URL (*address bar*) di kanan atas browser Chrome/Edge, lalu klik <strong>"Install"</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Benefit Highlights */}
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/80 mt-3">
                <div className="font-bold text-[11px] text-blue-950 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-blue-700" />
                  <span>Keuntungan Menggunakan PWA:</span>
                </div>
                <ul className="m-0 pl-4 space-y-0.5 text-[11px] text-slate-600">
                  <li>Bekerja tanpa memakan memori besar (ringan & cepat)</li>
                  <li>Bisa dibuka langsung dari Home Screen / Desktop</li>
                  <li>Tampilan layar penuh tanpa terganggu menu browser</li>
                </ul>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}
