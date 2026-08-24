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
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white p-6 sm:p-7 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-xl transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>

            {/* Foto Developer */}
            <div className="relative inline-block mx-auto mb-3">
              <img 
                src="https://res.cloudinary.com/dedtb3vnj/image/upload/v1785128112/dedesuparman_eelegb.jpg" 
                alt="Dede Suparman" 
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
              />
              <span className="absolute bottom-2 right-2 bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                <ZoomIn size={12} /> Lead Dev
              </span>
            </div>

            {/* Detail Nama & Peran */}
            <h2 className="text-lg sm:text-xl font-black text-slate-800 m-0 uppercase tracking-tight">
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
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
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

            <div className="mt-4 flex gap-2">
              <a 
                href="https://wa.me/6281911934000" 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} /> Hubungi WhatsApp
              </a>
              <button 
                onClick={() => setShowPhotoModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Main Header Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch justify-between overflow-hidden">
        
        {/* User Active & Profile Section */}
        <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-start gap-3.5 p-3.5 sm:p-4 min-w-0">
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
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-2xs group-hover:border-blue-500 bg-white transition-colors"
              />
              <span className="absolute -bottom-1 -right-1 bg-blue-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                Ubah
              </span>
            </button>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col items-center sm:items-start w-full justify-center">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <h1 className="font-extrabold text-slate-800 m-0 text-sm sm:text-base tracking-tight uppercase">
                {greeting}, {currentUser ? currentUser.nama.split(' ')[0] : 'Rekan'}!
              </h1>
              {isAdmin ? (
                <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black py-0.5 px-2 uppercase rounded-full flex items-center gap-1">
                  <ShieldAlert size={11} /> Super Admin
                </span>
              ) : (
                <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[9px] font-bold py-0.5 px-2 uppercase rounded-full flex items-center gap-1">
                  <UserCheck size={11} /> Pelaksana
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap mt-0.5 mb-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800">{currentUser?.nama || 'Pengguna'}</span>
              <span>•</span>
              <span className="text-[11px] text-slate-500 font-mono">@{currentUser?.username || 'user'}</span>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Pilih foto avatar profil"
              >
                <Sparkles size={12} className="text-orange-500" />
                <span>Ganti Avatar</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowUserManagement(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer active:scale-95"
                  title="Kelola user & role"
                >
                  <UserCog size={13} />
                  <span>Kelola User</span>
                </button>
              )}

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Keluar dari sesi"
              >
                <LogOut size={12} />
                <span>Keluar</span>
              </button>

              {showContacts ? (
                <div className="inline-flex items-center gap-1.5 flex-wrap">
                  <a 
                    href="https://wa.me/6281911934000" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-colors"
                  >
                    <MessageCircle size={12} className="text-emerald-600" />
                    <span>081911934000</span>
                  </a>

                  <button 
                    onClick={() => setShowContacts(false)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    <ChevronUp size={11} /> Tutup
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowContacts(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Mail size={12} />
                  <span>Kontak Dev</span>
                  <ChevronDown size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date, Live Clock & Protection Section */}
        <div className="flex flex-col justify-between items-center sm:items-end p-3.5 sm:p-4 bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-200 min-w-[210px] text-center sm:text-right shrink-0">
          <div className="w-full flex sm:flex-col justify-between items-center sm:items-end gap-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {dateStr}
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight font-mono">
              {time}
            </div>
          </div>

          <div className="mt-2.5 sm:mt-0 flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
            <InstallPwaButton variant="header" />

            <div 
              id="hero-security-inactivity-badge"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200"
              title="Proteksi sesi: Auto logout 30 menit"
            >
              <ShieldCheck size={11} className="text-blue-700 shrink-0" />
              <span>Sesi 30m</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
