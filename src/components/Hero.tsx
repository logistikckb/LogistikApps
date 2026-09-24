import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  LogOut, 
  Sparkles,
  UserCog,
  KeyRound,
  FileSpreadsheet,
  ExternalLink
} from 'lucide-react';
import { InstallPwaButton } from './common/InstallPwaButton';
import { DEFAULT_AVATAR } from '../data/avatarPresets';
import { AvatarPickerModal } from './profile/AvatarPickerModal';
import { ChangePinModal } from './profile/ChangePinModal';
import { UserManagementModal } from './admin/UserManagementModal';
import { SpreadsheetLinkModal } from './common/SpreadsheetLinkModal';
import { MenuPinAuthModal } from './admin/MenuPinAuthModal';
import { useNotification } from '../context/NotificationContext';

export function Hero() {
  const { currentUser, logout, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [greeting, setGreeting] = useState('SELAMAT SIANG');

  // Modals State
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showSpreadsheetPinModal, setShowSpreadsheetPinModal] = useState(false);

  useEffect(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

    const updateClock = () => {
      const now = new Date();
      const currentHoursStr = String(now.getHours()).padStart(2, '0');
      const currentMinutesStr = String(now.getMinutes()).padStart(2, '0');
      const currentSecondsStr = String(now.getSeconds()).padStart(2, '0');
      setTime(`${currentHoursStr}:${currentMinutesStr}:${currentSecondsStr}`);
      setDateStr(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);

      const hour = now.getHours();
      let greet = 'Selamat Malam';
      if (hour < 11) greet = 'Selamat Pagi';
      else if (hour < 15) greet = 'Selamat Siang';
      else if (hour < 18) greet = 'Selamat Sore';
      setGreeting(greet);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Modal Avatar Picker (Untuk Semua Pengguna) */}
      {showAvatarPicker && (
        <AvatarPickerModal
          isOpen={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          onOpenChangePin={() => setShowChangePinModal(true)}
        />
      )}

      {/* Modal Ganti PIN Mandiri (Untuk Semua Pengguna) */}
      {showChangePinModal && (
        <ChangePinModal
          isOpen={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
        />
      )}

      {/* Modal Manajemen User CRUD (Khusus Super Administrator) */}
      {isAdmin && showUserManagement && (
        <UserManagementModal
          isOpen={showUserManagement}
          onClose={() => setShowUserManagement(false)}
        />
      )}

      {/* Modal Link Google Spreadsheet Sinkron Data */}
      <SpreadsheetLinkModal
        isOpen={showSpreadsheetModal}
        onClose={() => setShowSpreadsheetModal(false)}
        showToast={showToast}
      />

      {/* Modal Verifikasi PIN 399339 untuk Buka Spreadsheet */}
      <MenuPinAuthModal
        isOpen={showSpreadsheetPinModal}
        onClose={() => setShowSpreadsheetPinModal(false)}
        onSuccess={() => {
          setShowSpreadsheetPinModal(false);
          setShowSpreadsheetModal(true);
          showToast('PIN Terverifikasi', 'Akses link Google Spreadsheet dibuka.', 'success');
        }}
        title="Verifikasi PIN Spreadsheet"
        description="Masukkan PIN keamanan 399339 untuk membuka Google Spreadsheet yang dipakai untuk sinkron data."
      />

      {/* Main Header Box (Polos - Minimalism Lite) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch justify-between overflow-hidden">
        
        {/* User Active & Profile Section */}
        <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-start gap-3.5 p-3.5 sm:p-4 min-w-0 bg-white">
          <div className="relative shrink-0">
            <button 
              type="button"
              onClick={() => setShowAvatarPicker(true)}
              className="cursor-pointer rounded-2xl block relative group transition-transform active:scale-95"
              title="Pilih Avatar Profil"
            >
              <img 
                src={currentUser?.avatar || DEFAULT_AVATAR} 
                alt={currentUser?.nama || "Pengguna"} 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-200 group-hover:border-blue-500 bg-white transition-colors"
              />
              <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                Ubah
              </span>
            </button>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col items-center sm:items-start w-full justify-center">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start mb-2">
              <h1 className="font-extrabold text-slate-800 m-0 text-sm sm:text-base tracking-tight uppercase">
                {greeting}, {currentUser ? currentUser.nama.split(' ')[0] : 'Rekan'}!
              </h1>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                title="Pilih foto avatar profil"
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>Ganti Avatar</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChangePinModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200/80 hover:border-amber-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs active:scale-95"
                title="Ganti kode PIN keamanan akun Anda"
              >
                <KeyRound size={12} className="text-amber-600" />
                <span>Ganti PIN</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowUserManagement(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-xs font-semibold transition-colors shadow-2xs cursor-pointer active:scale-95"
                  title="Kelola user & role"
                >
                  <UserCog size={13} />
                  <span>Kelola User</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSpreadsheetPinModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-colors shadow-2xs cursor-pointer active:scale-95"
                title="Buka Google Spreadsheet yang dipakai untuk sinkron data (Memerlukan PIN 399339)"
              >
                <FileSpreadsheet size={13} className="text-emerald-700" />
                <span>Buka Spreadsheet</span>
                <ExternalLink size={10} className="text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200/80 hover:border-red-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                title="Keluar dari sesi"
              >
                <LogOut size={12} />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Date, Live Clock & Protection Section */}
        <div className="flex flex-col justify-between items-center sm:items-end p-3.5 sm:p-4 bg-white border-t md:border-t-0 md:border-l border-slate-200 min-w-[210px] text-center sm:text-right shrink-0">
          <div className="w-full flex sm:flex-col justify-between items-center sm:items-end gap-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {dateStr}
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {time}
            </div>
          </div>

          <div className="mt-2.5 sm:mt-0 flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
            <InstallPwaButton variant="header" />

            <div 
              id="hero-security-inactivity-badge"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs"
              title="Proteksi sesi: Auto logout 30 menit"
            >
              <ShieldCheck size={11} className="text-slate-600 shrink-0" />
              <span>Sesi 30m</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
