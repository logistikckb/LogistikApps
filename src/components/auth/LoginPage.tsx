import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { isSupabaseConfigured } from '../../supabase';
import { DEFAULT_AVATAR } from '../../data/avatarPresets';
import { 
  ShieldCheck, 
  KeyRound, 
  User, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  Radio, 
  RefreshCw, 
  UserCheck, 
  ShieldAlert, 
  Clock, 
  X,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import { InstallPwaButton } from '../common/InstallPwaButton';
import { SupabaseConnectionModal } from '../common/SupabaseConnectionModal';

export function LoginPage() {
  const { login, usersList, refreshUsers, isLoadingUsers, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);

  // Dropdown search & visibility state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter users based on username text input
  const filteredUsers = useMemo(() => {
    const query = username.trim().toLowerCase();
    if (!query) return usersList;
    return usersList.filter(u => 
      u.username.toLowerCase().includes(query) ||
      u.nama.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
  }, [usersList, username]);

  // Check if current username matches an existing profile
  const matchedUser = useMemo(() => {
    if (!username.trim()) return null;
    return usersList.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
  }, [usersList, username]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUsers();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSelectUser = (user: UserProfile) => {
    setErrorMsg('');
    setSuccessMsg('');
    setUsername(user.username);
    setPin('');
    setInfoMsg(`Akun "${user.nama}" dipilih. Silakan masukkan PIN 4 digit Anda.`);
    setIsDropdownOpen(false);

    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 100);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setInfoMsg('');

    if (!username.trim()) {
      setErrorMsg('Harap masukkan atau pilih Username akun Anda!');
      usernameInputRef.current?.focus();
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Harap masukkan Kode PIN 4 Digit Anda!');
      pinInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(username, pin);
      if (!res.success) {
        setErrorMsg(res.message || 'Login gagal. Periksa kembali Username dan PIN Anda.');
        setPin('');
        pinInputRef.current?.focus();
      } else {
        setSuccessMsg('Login berhasil! Mengalihkan ke Halaman Operasional...');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi gangguan saat memverifikasi kredensial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 flex flex-col justify-center items-center bg-bg-body text-slate-800 animate-fade-in relative overflow-hidden">
      
      {/* Subtle Background Decorative Glows */}
      <div className="absolute -top-28 -left-28 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg space-y-5 relative z-10">
        
        {/* Header Logo & Branding */}
        <div className="text-center space-y-3">
          {/* Main App Badge / Shield Logo */}
          <div className="inline-flex items-center justify-center p-1.5 bg-slate-900 text-white rounded-3xl shadow-2xl border-2 border-white/80 ring-4 ring-blue-900/10 mb-1 overflow-hidden">
            <img 
              src="/icons/icon.svg" 
              alt="LogistikApps Shield Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md rounded-2xl"
            />
          </div>

          <div className="flex justify-center items-center gap-2 flex-wrap">
            <span className="bg-blue-900 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-sky-300" /> LogistikApps Portal
            </span>
            <span className="bg-orange-500 text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
              V1.0
            </span>
            
            {/* Cloud Sync Status Badge */}
            <button
              type="button"
              onClick={() => setShowDbModal(true)}
              className={`cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                isSupabaseConfigured
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              } text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1.5`}
              title="Status sinkronisasi server terpusat"
            >
              <Radio size={12} className={isSupabaseConfigured ? 'animate-pulse' : ''} />
              <span>{isSupabaseConfigured ? 'Server Cloud Online' : 'Mode Offline-Ready'}</span>
            </button>

            <InstallPwaButton variant="header" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight m-0">
            Sistem Autentikasi Logistik
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Pilih atau ketik <strong>Username</strong> akun Anda, lalu masukkan <strong>PIN</strong> untuk masuk.
          </p>
        </div>

        {/* Security Auto-Logout Notification Banner */}
        {sessionExpiredNotice && (
          <div 
            id="session-expired-alert"
            className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 backdrop-blur-md shadow-md animate-fade-in flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <ShieldAlert size={18} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs font-black text-amber-900 m-0 uppercase tracking-wide">
                    Sesi Telah Berakhir
                  </h3>
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-amber-300 flex items-center gap-0.5">
                    <Clock size={9} /> 30 Menit
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed m-0 font-medium">
                  {sessionExpiredNotice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearSessionExpiredNotice}
              className="text-amber-700 hover:text-amber-950 bg-amber-200/60 hover:bg-amber-200 p-1 rounded-lg transition-all cursor-pointer shrink-0"
              title="Tutup pemberitahuan"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Form Login Box */}
        <div className="glass-box p-6 sm:p-7 bg-white/90 backdrop-blur-md border border-white/80 shadow-2xl rounded-3xl">
          
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-xs shrink-0">
                <KeyRound size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 m-0 uppercase tracking-tight">
                  Form Masuk
                </h2>
                <span className="text-[10px] font-bold text-slate-400">Silakan Verifikasi Akun</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 text-[11px] text-blue-900 hover:text-blue-950 font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition-all cursor-pointer disabled:opacity-50 border border-blue-200"
              title="Perbarui daftar akun terdaftar"
            >
              <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Sinkron Akun</span>
            </button>
          </div>

          {/* Alert Feedback */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <UserCheck size={16} className="shrink-0 mt-0.5 text-blue-600" />
              <span className="font-semibold">{infoMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            
            {/* Searchable / Dropdown Username Field */}
            <div ref={dropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  Username Akun
                </label>
                {matchedUser && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    matchedUser.role === 'Admin'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}>
                    <Check size={10} /> {matchedUser.nama} ({matchedUser.role})
                  </span>
                )}
              </div>

              <div className="relative">
                {/* Avatar Preview or User Icon on Left */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {matchedUser ? (
                    <img
                      src={matchedUser.avatar || DEFAULT_AVATAR}
                      alt={matchedUser.nama}
                      className="w-6 h-6 rounded-lg object-cover border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <User size={16} className="text-slate-400" />
                  )}
                </div>

                <input
                  ref={usernameInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (!isDropdownOpen) setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Ketik atau cari nama / username akun..."
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium text-slate-800 transition-all shadow-inner"
                />

                {/* Dropdown Toggle / Clear Button */}
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                  {username && (
                    <button
                      type="button"
                      onClick={() => {
                        setUsername('');
                        setInfoMsg('');
                        usernameInputRef.current?.focus();
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Bersihkan input"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-1 text-slate-400 hover:text-blue-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title={isDropdownOpen ? 'Tutup daftar profil' : 'Buka daftar profil'}
                  >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-blue-900' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Dropdown Menu List of Users */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-64 flex flex-col animate-scale-up">
                  
                  {/* Dropdown Header / Search Tip */}
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Search size={12} className="text-blue-900" />
                      Pilih Profil Akun Terdaftar:
                    </span>
                    <span className="text-[10px] bg-slate-200/70 px-1.5 py-0.2 rounded-md font-mono">
                      {filteredUsers.length} Akun
                    </span>
                  </div>

                  {/* Users List Scrollable */}
                  <div className="overflow-y-auto divide-y divide-slate-100 p-1">
                    {isLoadingUsers && usersList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-blue-900" />
                        <span>Memuat data pengguna...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-700 m-0">Tidak ada akun yang cocok.</p>
                        <p className="text-[11px] text-slate-400 m-0">
                          Anda tetap bisa login menggunakan "{username}" secara manual.
                        </p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSelected = username.toLowerCase() === user.username.toLowerCase();
                        const isAdminUser = user.role === 'Admin';

                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectUser(user)}
                            className={`w-full p-2.5 rounded-xl transition-all text-left flex items-center justify-between gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={user.avatar || DEFAULT_AVATAR}
                                alt={user.nama}
                                className="w-8 h-8 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800 truncate">
                                    {user.nama}
                                  </span>
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                    isAdminUser
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {user.role}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  @{user.username}
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <CheckCircle2 size={16} className="text-blue-900 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PIN Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  Kode PIN Keamanan (4 Digit)
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Wajib diisi</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  ref={pinInputRef}
                  type={showPin ? 'text' : 'password'}
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN keamanan..."
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono tracking-widest text-slate-800 transition-all font-bold shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-700 hover:from-blue-800 hover:to-indigo-600 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Memverifikasi Kredensial...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Masuk ke Halaman Operasional</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Keamanan PIN Terenkripsi</span>
            <span>{usersList.length} Akun Tersinkron</span>
          </div>
        </div>
      </div>

      {/* Modal Status & Sinkronisasi Server */}
      <SupabaseConnectionModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
      />
    </div>
  );
}

