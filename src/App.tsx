import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Hero } from './components/Hero';
import { MainKPIDashboard } from './components/dashboard/MainKPIDashboard';
import { ToolsGridMenu, ToolId, TOOLS_LIST } from './components/ToolsNavigation';
import { EdCheckerModule } from './components/logistics/EdCheckerModule';
import { DatabaseMasterModule } from './components/logistics/DatabaseMasterModule';
import { IncomingModule } from './components/logistics/IncomingModule';
import { PlaceholderTool } from './components/PlaceholderTool';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
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
    return (
      <>
        <LoginPage />
        <PwaInstallPrompt />
      </>
    );
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
      <div className="max-w-6xl mx-auto p-3 sm:p-5 md:p-6 lg:p-8">
        
        {/* ========================================================================= */}
        {/* VIEW 1: HALAMAN UTAMA (HOME / DASHBOARD MENU) */}
        {/* ========================================================================= */}
        {currentView === 'home' && (
          <div className="space-y-6 animate-fade-in">
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
            <main className="glass-box p-4 sm:p-6 bg-white/70 backdrop-blur-md shadow-xl border border-white/60">
              <ToolsGridMenu onOpenTool={handleOpenTool} />
            </main>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: HALAMAN MODUL APLIKASI (DEDICATED SUB-PAGE) */}
        {/* ========================================================================= */}
        {currentView === 'module' && (
          <div className="space-y-5 animate-fade-in">
            
            {/* AppSheet Style Top Navigation & Header Bar */}
            <header className="glass-box p-3.5 sm:p-4 bg-white/90 backdrop-blur-md shadow-md border border-white/80 flex flex-wrap items-center justify-between gap-3 sticky top-3 z-30">
              {/* Tombol Back ke Halaman Utama */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleBackToHome}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-x-0.5"
                  title="Kembali ke Halaman Menu Utama"
                >
                  <ArrowLeft size={16} />
                  <span>Kembali ke Menu Utama</span>
                </button>

                <button
                  onClick={handleBackToHome}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                  title="Home Menu"
                >
                  <Home size={16} />
                </button>
              </div>

              {/* Breadcrumb / Status Modul */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold">
                  <LayoutGrid size={13} className="text-blue-900" />
                  <span className="hidden sm:inline text-slate-500">Menu /</span>
                  <span className="font-extrabold text-slate-800">{currentTool.title}</span>
                </div>

                {currentTool.isReady ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-xl border border-emerald-300 flex items-center gap-1">
                    <Sparkles size={11} /> Aktif
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-xl border border-amber-300">
                    Draft Kosongan
                  </span>
                )}
              </div>
            </header>

            {/* Isi Halaman Modul */}
            <main className="space-y-6">
              <div className="glass-box p-4 sm:p-6 bg-white/75 backdrop-blur-md shadow-xl border border-white/60">
                {/* Header Title Banner of Active Tool */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${currentTool.colorBg} text-white flex items-center justify-center shadow-md shrink-0`}>
                      <currentTool.icon size={24} className="sm:size-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-800 m-0 uppercase tracking-tight">
                          {currentTool.title}
                        </h1>
                        <span className="bg-blue-50 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                          <Layers size={10} /> {currentTool.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                        {currentTool.shortDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Render Halaman Sesuai Menu Yang Diklik */}
                {activeToolId === 'ed-checker' ? (
                  <EdCheckerModule />
                ) : activeToolId === 'menu-a' ? (
                  <DatabaseMasterModule />
                ) : activeToolId === 'menu-b' ? (
                  <IncomingModule />
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
                <div className="glass-box p-4 sm:p-5 bg-white/50 backdrop-blur-md border border-white/60">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={16} className="text-blue-900" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 m-0 uppercase tracking-wide">
                      Informasi & Panduan Decoding Kode Batch Logistik
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-1">1. Format Batch Unix (4 Digit)</span>
                      <p className="leading-relaxed m-0 text-slate-600">
                        <span className="font-mono font-bold text-blue-900">3 Digit Pertama</span> = Hari ke-N dalam tahun (DOY: 001 - 366).<br />
                        <span className="font-mono font-bold text-orange-600">1 Digit Terakhir</span> = Digit terakhir tahun produksi.
                      </p>
                    </div>

                    <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-1">2. Perhitungan Tanggal Mixing</span>
                      <p className="leading-relaxed m-0 text-slate-600">
                        Tanggal Mixing = 1 Januari Tahun Produksi + (DOY - 1) Hari. Termasuk penanganan presisi tahun kabisat (Leap Year).
                      </p>
                    </div>

                    <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="font-bold text-slate-800 block mb-1">3. Masa Simpan (Shelf Life)</span>
                      <p className="leading-relaxed m-0 text-slate-600">
                        Secara default 3 tahun, produk Paper 5 tahun, Olive Oil 4 tahun, Samantha/Keset 2 tahun, Pia 1 tahun, dan Abstract non-expired.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Back Button Bar */}
              <div className="flex justify-center pt-2 pb-6">
                <button
                  onClick={handleBackToHome}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300/80 text-slate-700 font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>Kembali ke Halaman Menu Utama</span>
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

      {/* PWA Install Prompt Banner & Offline Detector */}
      <PwaInstallPrompt />
    </div>
  );
}
