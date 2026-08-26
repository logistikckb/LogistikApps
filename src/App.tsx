import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Hero } from './components/Hero';
import { ToolsGridMenu, ToolId, TOOLS_LIST } from './components/ToolsNavigation';
import { EdCheckerModule } from './components/logistics/EdCheckerModule';
import { DatabaseMasterModule } from './components/logistics/DatabaseMasterModule';
import { IncomingModule } from './components/logistics/IncomingModule';
import { QrGeneratorHoneywellModule } from './components/logistics/QrGeneratorHoneywellModule';
import { PenyiapanModule } from './components/logistics/PenyiapanModule';
import { PemusnahanModule } from './components/logistics/PemusnahanModule';
import { RecoModule } from './components/logistics/RecoModule';
import { InventoryModule } from './components/logistics/InventoryModule';
import { PlaceholderTool } from './components/PlaceholderTool';
import { InactivityWarningModal } from './components/auth/InactivityWarningModal';
import { BroadcastBar } from './components/broadcast/BroadcastBar';
import { BroadcastModal } from './components/broadcast/BroadcastModal';
import { FloatingRobotBroadcast } from './components/broadcast/FloatingRobotBroadcast';
import { NotificationPermissionBanner } from './components/broadcast/NotificationPermissionBanner';
import { useBroadcast } from './hooks/useBroadcast';
import { 
  ArrowLeft, 
  Home, 
  Sparkles, 
  BookOpen, 
  Layers, 
  LayoutGrid,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  const { currentUser, isAdmin } = useAuth();

  // Navigation: 'home' (Daftar Menu Utama) / 'module' (Halaman Detail Modul)
  const [currentView, setCurrentView] = useState<'home' | 'module'>('home');
  const [activeToolId, setActiveToolId] = useState<ToolId>('ed-checker');

  // Broadcast intercom system
  const {
    messages: broadcastMessages,
    loading: broadcastLoading,
    incomingBroadcast,
    soundEnabled,
    notificationPermission,
    isNotificationSupported,
    requestNotificationPermission,
    sendBroadcast,
    deleteMessage: deleteBroadcastMessage,
    clearAllMessages: clearAllBroadcasts,
    dismissIncomingBroadcast,
    toggleSound,
  } = useBroadcast();

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [replySender, setReplySender] = useState<string>('');

  const currentTool = TOOLS_LIST.find((t) => t.id === activeToolId) || TOOLS_LIST[0];

  const handleOpenTool = (id: ToolId) => {
    setActiveToolId(id);
    setCurrentView('module');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const latestBroadcast = broadcastMessages.length > 0 ? broadcastMessages[0] : null;

  return (
    <div className="min-h-screen p-0 overflow-y-auto text-[13px] font-sans bg-slate-50 text-slate-800">
      {!currentUser ? (
        <LoginPage onOpenBroadcast={() => setShowBroadcastModal(true)} />
      ) : (
        <div className="max-w-[1440px] mx-auto px-2 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3">
          
          {/* VIEW 1: HALAMAN UTAMA (HOME / DASHBOARD MENU) */}
          {currentView === 'home' && (
            <div className="space-y-2.5 sm:space-y-3">
              <NotificationPermissionBanner 
                permission={notificationPermission}
                onRequestPermission={requestNotificationPermission}
                isSupported={isNotificationSupported}
              />

              <Hero />

              <BroadcastBar
                onOpenBroadcastModal={() => setShowBroadcastModal(true)}
                latestBroadcast={latestBroadcast}
                messageCount={broadcastMessages.length}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={requestNotificationPermission}
                isNotificationSupported={isNotificationSupported}
              />

              <main className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs">
                <ToolsGridMenu onOpenTool={handleOpenTool} />
              </main>
            </div>
          )}

          {/* VIEW 2: HALAMAN MODUL APLIKASI */}
          {currentView === 'module' && (
            <div className="space-y-2 sm:space-y-2.5">
              {/* Header Navigation Bar */}
              <header className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 sticky top-1 sm:top-2 z-30">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={handleBackToHome}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Kembali ke Menu Utama (Home)"
                  >
                    <Home size={15} />
                  </button>

                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl ${currentTool.colorBg} flex items-center justify-center shrink-0`}>
                      <currentTool.icon size={15} />
                    </div>
                    <h1 className="text-xs sm:text-sm font-bold text-slate-800 m-0 uppercase tracking-tight truncate">
                      {currentTool.title}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="hidden md:inline-flex bg-slate-50 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200/80 items-center gap-1">
                    <Layers size={10} /> {currentTool.category}
                  </span>

                  {currentTool.isReady ? (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                      <Sparkles size={10} /> Aktif
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-200">
                      Draft
                    </span>
                  )}
                </div>
              </header>

              {/* Modul Content */}
              <main className="space-y-2 sm:space-y-2.5">
                <div className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  {activeToolId === 'ed-checker' ? (
                    <EdCheckerModule />
                  ) : activeToolId === 'menu-a' ? (
                    <DatabaseMasterModule />
                  ) : activeToolId === 'menu-b' ? (
                    <IncomingModule />
                  ) : activeToolId === 'menu-c' ? (
                    <QrGeneratorHoneywellModule />
                  ) : activeToolId === 'menu-d' ? (
                    <PenyiapanModule 
                      onNavigateToPemusnahan={() => handleOpenTool('menu-e')} 
                      onNavigateToReco={() => handleOpenTool('menu-f')}
                      onNavigateToInventory={() => handleOpenTool('menu-g')}
                    />
                  ) : activeToolId === 'menu-e' ? (
                    <PemusnahanModule onNavigateToPenyiapan={() => handleOpenTool('menu-d')} />
                  ) : activeToolId === 'menu-f' ? (
                    <RecoModule onNavigateToPenyiapan={() => handleOpenTool('menu-d')} />
                  ) : activeToolId === 'menu-g' ? (
                    <InventoryModule 
                      onNavigateToPenyiapan={() => handleOpenTool('menu-d')}
                      onNavigateToPemusnahan={() => handleOpenTool('menu-e')}
                      onNavigateToReco={() => handleOpenTool('menu-f')}
                    />
                  ) : (
                    <PlaceholderTool
                      id={currentTool.id}
                      title={currentTool.title}
                      subtitle={currentTool.shortDesc}
                      category={currentTool.category}
                      icon={currentTool.icon}
                      colorClass={currentTool.colorBg}
                      plannedFeatures={currentTool.plannedFeatures}
                    />
                  )}
                </div>

                {/* Guide for ED Checker */}
                {activeToolId === 'ed-checker' && (
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 mb-2">
                      <BookOpen size={14} className="text-blue-900" />
                      <h3 className="text-xs font-bold text-slate-800 m-0 uppercase tracking-wide">
                        Informasi & Panduan Decoding Kode Batch Logistik
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-800 block mb-0.5">1. Format Batch Unix (4 Digit)</span>
                        <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                          <span className="font-mono font-bold text-blue-900">3 Digit Pertama</span> = Hari ke-N dalam tahun (DOY: 001 - 366).<br />
                          <span className="font-mono font-bold text-orange-600">1 Digit Terakhir</span> = Digit terakhir tahun produksi.
                        </p>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-800 block mb-0.5">2. Perhitungan Tanggal Mixing</span>
                        <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                          Tanggal Mixing = 1 Januari Tahun Produksi + (DOY - 1) Hari. Presisi tahun kabisat (Leap Year).
                        </p>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-800 block mb-0.5">3. Masa Simpan (Shelf Life)</span>
                        <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                          Default 3 tahun, Paper 5 tahun, Olive Oil 4 tahun, Samantha/Keset 2 tahun, Pia 1 tahun, Abstract non-expired.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Home Button */}
                <div className="flex justify-center pt-1 pb-3">
                  <button
                    onClick={handleBackToHome}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                    title="Kembali ke Menu Utama"
                  >
                    <Home size={14} className="text-blue-900" />
                    <span>Menu Utama</span>
                  </button>
                </div>
              </main>
            </div>
          )}
        </div>
      )}

      {/* Floating Robot Popup */}
      <FloatingRobotBroadcast
        broadcast={incomingBroadcast}
        onClose={dismissIncomingBroadcast}
        soundEnabled={soundEnabled}
        onReply={(sender) => {
          setReplySender(sender);
          setShowBroadcastModal(true);
        }}
      />

      {/* Broadcast Messaging & History Modal */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => {
          setShowBroadcastModal(false);
          setReplySender('');
        }}
        messages={broadcastMessages}
        loading={broadcastLoading}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onSend={sendBroadcast}
        onDeleteMessage={deleteBroadcastMessage}
        onClearAll={clearAllBroadcasts}
        initialSenderName={replySender}
        isAdmin={isAdmin}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={requestNotificationPermission}
        isNotificationSupported={isNotificationSupported}
      />

      {/* Inactivity Security Warning Modal (30 Mins Auto-Logout) */}
      {currentUser && <InactivityWarningModal />}
    </div>
  );
}
