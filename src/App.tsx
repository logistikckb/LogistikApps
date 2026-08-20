import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Hero } from './components/Hero';
import { MainKPIDashboard } from './components/dashboard/MainKPIDashboard';
import { ToolsGridMenu, ToolId, TOOLS_LIST } from './components/ToolsNavigation';
import { EdCheckerModule } from './components/logistics/EdCheckerModule';
import { DatabaseMasterModule } from './components/logistics/DatabaseMasterModule';
import { IncomingModule } from './components/logistics/IncomingModule';
import { QrGeneratorHoneywellModule } from './components/logistics/QrGeneratorHoneywellModule';
import { PenyiapanModule } from './components/logistics/PenyiapanModule';
import { PemusnahanModule } from './components/logistics/PemusnahanModule';
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

  // State navigasi halaman: 'home' (Daftar Menu Utama) atau 'module' (Halaman Detail Modul)
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

  // Jika belum login, tampilkan Halaman Login terlebih dahulu
  if (!currentUser) {
    return <LoginPage />;
  }

  const currentTool = TOOLS_LIST.find((t) => t.id === activeToolId) || TOOLS_LIST[0];

  // Handler saat user mengklik icon menu dari halaman utama
  const handleOpenTool = (id: ToolId) => {
    setActiveToolId(id);
    setCurrentView('module');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler untuk kembali ke halaman utama (Home)
  const handleBackToHome = () => {
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const latestBroadcast = broadcastMessages.length > 0 ? broadcastMessages[0] : null;

  return (
    <div className="min-h-screen p-0 overflow-y-auto text-[13px] font-sans bg-bg-body text-slate-800">
      <div className="max-w-[1440px] mx-auto px-2 py-1.5 sm:px-3 sm:py-2.5 md:px-4 md:py-3">
        
        {/* ========================================================================= */}
        {/* VIEW 1: HALAMAN UTAMA (HOME / DASHBOARD MENU) */}
        {/* ========================================================================= */}
        {currentView === 'home' && (
          <div className="space-y-2.5 sm:space-y-3.5 animate-fade-in">
            {/* Notification Permission Banner for All Devices & Browsers */}
            <NotificationPermissionBanner 
              permission={notificationPermission}
              onRequestPermission={requestNotificationPermission}
              isSupported={isNotificationSupported}
            />

            {/* Header & Profil Pengguna Login */}
            <Hero />

            {/* Global Broadcast Message Bar (Muncul untuk semua user jika ada siaran) */}
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

            {/* Pusat Metrik & Indikator Kinerja Utama (KPI Cards Terpadu) */}
            <MainKPIDashboard onOpenTool={handleOpenTool} />

            {/* Grid Menu Aplikasi (AppSheet Style) */}
            <main className="glass-box p-2.5 sm:p-4 bg-white/70 backdrop-blur-md shadow-lg border border-white/60">
              <ToolsGridMenu onOpenTool={handleOpenTool} />
            </main>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: HALAMAN MODUL APLIKASI (DEDICATED SUB-PAGE) */}
        {/* ========================================================================= */}
        {currentView === 'module' && (
          <div className="space-y-2 sm:space-y-2.5 animate-fade-in">
            
            {/* Ultra-compact AppSheet Style Top Navigation & Header Bar */}
            <header className="glass-box p-2 sm:p-2.5 bg-white/95 backdrop-blur-md shadow-xs border border-white/90 flex items-center justify-between gap-2 sticky top-1 sm:top-2 z-30">
              {/* Tombol Home & Judul Modul */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleBackToHome}
                  className="w-8 h-8 rounded-lg bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs shrink-0"
                  title="Kembali ke Menu Utama (Home)"
                >
                  <Home size={16} />
                </button>

                {/* Judul Modul Aktif & Ikon Langsung di Bar Header */}
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${currentTool.colorBg} text-white flex items-center justify-center shadow-2xs shrink-0`}>
                    <currentTool.icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <h1 className="text-xs sm:text-sm font-black text-slate-800 m-0 uppercase tracking-tight truncate">
                        {currentTool.title}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Modul & Kategori */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden md:inline-flex bg-blue-50 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200 items-center gap-1">
                  <Layers size={10} /> {currentTool.category}
                </span>

                {currentTool.isReady ? (
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                    <Sparkles size={10} /> Aktif
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300">
                    Draft
                  </span>
                )}
              </div>
            </header>

            {/* Isi Halaman Modul */}
            <main className="space-y-2 sm:space-y-2.5">
              <div className="glass-box p-2 sm:p-3 md:p-3.5 bg-white/85 backdrop-blur-md shadow-md border border-white/70">
                {/* Render Halaman Sesuai Menu Yang Diklik */}
                {activeToolId === 'ed-checker' ? (
                  <EdCheckerModule />
                ) : activeToolId === 'menu-a' ? (
                  <DatabaseMasterModule />
                ) : activeToolId === 'menu-b' ? (
                  <IncomingModule />
                ) : activeToolId === 'menu-c' ? (
                  <QrGeneratorHoneywellModule />
                ) : activeToolId === 'menu-d' ? (
                  <PenyiapanModule onNavigateToPemusnahan={() => handleOpenTool('menu-e')} />
                ) : activeToolId === 'menu-e' ? (
                  <PemusnahanModule onNavigateToPenyiapan={() => handleOpenTool('menu-d')} />
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

              {/* Panduan Rumus (khusus di modul Cek ED) */}
              {activeToolId === 'ed-checker' && (
                <div className="glass-box p-2.5 sm:p-3 bg-white/50 backdrop-blur-md border border-white/60">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen size={14} className="text-blue-900" />
                    <h3 className="text-xs font-bold text-slate-800 m-0 uppercase tracking-wide">
                      Informasi & Panduan Decoding Kode Batch Logistik
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-0.5">1. Format Batch Unix (4 Digit)</span>
                      <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                        <span className="font-mono font-bold text-blue-900">3 Digit Pertama</span> = Hari ke-N dalam tahun (DOY: 001 - 366).<br />
                        <span className="font-mono font-bold text-orange-600">1 Digit Terakhir</span> = Digit terakhir tahun produksi.
                      </p>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-0.5">2. Perhitungan Tanggal Mixing</span>
                      <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                        Tanggal Mixing = 1 Januari Tahun Produksi + (DOY - 1) Hari. Termasuk penanganan presisi tahun kabisat (Leap Year).
                      </p>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-0.5">3. Masa Simpan (Shelf Life)</span>
                      <p className="leading-relaxed m-0 text-[11px] text-slate-600">
                        Secara default 3 tahun, produk Paper 5 tahun, Olive Oil 4 tahun, Samantha/Keset 2 tahun, Pia 1 tahun, dan Abstract non-expired.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Home Button */}
              <div className="flex justify-center pt-1 pb-3">
                <button
                  onClick={handleBackToHome}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300/80 text-slate-700 font-bold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer"
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

      {/* Floating Pink Love Robot Alert Delivery Popup */}
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
      <InactivityWarningModal />
    </div>
  );
}
