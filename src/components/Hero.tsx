import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../supabase';
import { 
  Mail, 
  MessageCircle, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ZoomIn, 
  ExternalLink, 
  ShieldCheck, 
  MapPin, 
  LogOut, 
  UserCheck, 
  ShieldAlert,
  Database,
  Users,
  Sparkles,
  UserCog,
  Clock,
  Lock
} from 'lucide-react';
import { InstallPwaButton } from './common/InstallPwaButton';
import { AvatarPickerModal } from './profile/AvatarPickerModal';
import { UserManagementModal } from './admin/UserManagementModal';
import { DEFAULT_AVATAR } from '../data/avatarPresets';

export function Hero() {
  const { currentUser, logout, isAdmin } = useAuth();

  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [greeting, setGreeting] = useState('SELAMAT SIANG');

  // Toggle Sembunyikan/Tampilkan Kontak Developer
  const [showContacts, setShowContacts] = useState(false);

  // Modals State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

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
      <AvatarPickerModal
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
      />

      {/* Modal Manajemen User CRUD (Khusus Super Administrator) */}
      {isAdmin && (
        <UserManagementModal
          isOpen={showUserManagement}
          onClose={() => setShowUserManagement(false)}
        />
      )}

      {/* Modal Detail Developer & Kontak */}
      {showPhotoModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="glass-box !bg-white/95 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl border border-blue-400 relative overflow-hidden text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

            <button 
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all z-20 cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>

            {/* Foto Developer */}
            <div className="relative inline-block mx-auto mb-4 group">
              <div className="p-1 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 shadow-xl">
                <img 
                  src="https://res.cloudinary.com/dedtb3vnj/image/upload/v1785128112/dedesuparman_eelegb.jpg" 
                  alt="Dede Suparman" 
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-cover border-4 border-white shadow-inner transition-transform duration-300 hover:scale-105"
                />
              </div>
              <span className="absolute bottom-2 right-2 bg-blue-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md flex items-center gap-1 border border-blue-700">
                <ZoomIn size={12} /> Lead Developer
              </span>
            </div>

            {/* Detail Nama & Peran */}
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 m-0 uppercase tracking-tight">
              Dede Suparman
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs mt-1">
              <ShieldCheck size={14} className="text-blue-600" />
              <span>Full-Stack & Logistik Developer</span>
            </div>

            <p className="text-xs text-slate-500 mt-2 font-medium">
              Pengembang Sistem Operasional Logistik RR V1.0 Sukabumi.
            </p>

            {/* Detail Kontak Lengkap */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <MessageCircle size={15} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</div>
                  <a href="https://wa.me/6281911934000" target="_blank" rel="noreferrer" className="font-extrabold text-emerald-700 hover:underline flex items-center gap-1">
                    081911934000 <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail size={15} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Email</div>
                  <a href="mailto:wcikembar111@gmail.com" className="font-extrabold text-blue-900 hover:underline">
                    wcikembar111@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <MapPin size={15} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Lokasi / Wilayah</div>
                  <div className="font-extrabold text-slate-800 text-xs">Kabupaten Sukabumi, Jawa Barat</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <a 
                href="https://wa.me/6281911934000" 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} /> Hubungi WhatsApp
              </a>
              <button 
                onClick={() => setShowPhotoModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Main Header Box */}
      <div className="glass-box p-0 flex flex-col md:flex-row items-stretch justify-between relative overflow-hidden mb-6">
        
        {/* User Active & Profile Section */}
        <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 sm:p-5 bg-white/20 min-w-0">
          <div className="relative z-10 shrink-0 group">
            <button 
              type="button"
              onClick={() => setShowAvatarPicker(true)}
              className="relative cursor-pointer overflow-hidden rounded-2xl p-0.5 transition-all duration-300 block text-left"
              title="Klik untuk memilih foto avatar profil ringan"
            >
              <img 
                src={currentUser?.avatar || DEFAULT_AVATAR} 
                alt={currentUser?.nama || "Pengguna"} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-3 border-white shadow-md transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-xl group-hover:border-blue-300 bg-white"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-blue-900/60 via-transparent to-orange-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex items-center justify-center">
                <span className="bg-slate-900/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 shadow-md">
                  <Sparkles size={10} /> Ganti Avatar
                </span>
              </div>
            </button>
          </div>

          <div className="relative z-10 flex-1 min-w-0 text-center sm:text-left flex flex-col items-center sm:items-start w-full justify-center">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <h1 className="font-extrabold text-slate-800 m-0 text-base sm:text-lg md:text-xl tracking-tight uppercase">
                {greeting}, {currentUser ? currentUser.nama.split(' ')[0] : 'Rekan'}!
              </h1>
              {isAdmin ? (
                <span className="bg-red-500/15 text-red-700 border border-red-500/30 text-[9px] sm:text-[10px] font-black py-0.5 px-2.5 uppercase rounded-full shadow-2xs flex items-center gap-1">
                  <ShieldAlert size={11} /> Super Admin
                </span>
              ) : (
                <span className="bg-blue-900/15 text-blue-900 border border-blue-900/30 text-[9px] sm:text-[10px] font-bold py-0.5 px-2.5 uppercase rounded-full shadow-2xs flex items-center gap-1">
                  <UserCheck size={11} /> Pelaksana
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 flex-wrap mt-1 mb-2 text-xs text-slate-600">
              <span className="font-extrabold text-slate-800">{currentUser?.nama || 'Pengguna'}</span>
              <span>•</span>
              <span className="text-[11px] text-slate-500 font-mono">@{currentUser?.username || 'user'}</span>
            </div>

            {/* Action Bar: Ganti Avatar, Kelola User (Khusus Admin), Logout */}
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {/* Tombol Ganti Avatar (Untuk Semua User) */}
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-xs font-bold transition-all shadow-2xs cursor-pointer hover:shadow-xs"
                title="Pilih foto avatar profil vektor ringan"
              >
                <Sparkles size={13} className="text-orange-600" />
                <span>Ganti Avatar</span>
              </button>

              {/* Tombol Khusus Super Administrator: Kelola Semua User (CRUD) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowUserManagement(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black transition-all shadow-xs cursor-pointer hover:shadow-md transform active:scale-95"
                  title="Kelola semua akun user, hak akses, CRUD, status dan reset PIN"
                >
                  <UserCog size={14} />
                  <span>Kelola User & Role (CRUD)</span>
                </button>
              )}

              {/* Tombol Keluar (Logout) */}
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer hover:shadow-xs"
                title="Keluar dari sesi akun saat ini"
              >
                <LogOut size={13} />
                <span>Keluar</span>
              </button>

              {/* Toggle Developer Contacts */}
              {showContacts ? (
                <div className="inline-flex items-center gap-2 flex-wrap">
                  <a 
                    href="https://wa.me/6281911934000" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 text-[11px] font-bold border border-emerald-500/20 transition-all"
                  >
                    <MessageCircle size={12} className="text-emerald-600" />
                    <span>081911934000</span>
                  </a>

                  <button 
                    onClick={() => setShowContacts(false)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-200/80 text-slate-600 hover:text-slate-900 text-[10px] font-bold transition-all cursor-pointer"
                  >
                    <ChevronUp size={11} /> Tutup
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowContacts(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-900 bg-white/60 hover:bg-white px-2.5 py-1.5 rounded-xl border border-white/70 transition-all cursor-pointer shadow-2xs"
                >
                  <Mail size={12} className="text-slate-500" />
                  <span>Kontak Developer</span>
                  <ChevronDown size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date, Live Clock & Status Section */}
        <div className="flex flex-col justify-between items-center sm:items-end p-4 sm:p-5 bg-white/30 border-t md:border-t-0 md:border-l border-white/50 min-w-[240px] text-center sm:text-right shrink-0">
          <div className="w-full flex sm:flex-col justify-between items-center sm:items-end gap-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {dateStr}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 tracking-tight font-mono drop-shadow-2xs">
              {time}
            </div>
          </div>

          <div className="mt-3 sm:mt-0 flex items-center gap-2 flex-wrap justify-center sm:justify-end">
            <InstallPwaButton variant="header" />

            {/* Auto-Logout Inactivity Protection Badge */}
            <div 
              id="hero-security-inactivity-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-blue-50/80 text-blue-900 border border-blue-200 shadow-2xs"
              title="Proteksi data logistik: Otomatis logout setelah 30 menit tidak ada aktivitas"
            >
              <ShieldCheck size={12} className="text-blue-700 shrink-0" />
              <span>Proteksi Sesi: 30m</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
