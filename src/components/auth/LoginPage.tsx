import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { DEFAULT_AVATAR } from '../../data/avatarPresets';
import { 
  User, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  RefreshCw, 
  UserCheck, 
  ShieldAlert, 
  Clock, 
  X,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';

interface LoginPageProps {
  onOpenBroadcast?: () => void;
}

export function LoginPage({ onOpenBroadcast }: LoginPageProps) {
  const { login, usersList, refreshUsers, isLoadingUsers, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    setInfoMsg(`Akun "${user.nama}" dipilih. Silakan masukkan PIN Anda.`);
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
      setErrorMsg('Harap masukkan Kode PIN Anda!');
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
        setSuccessMsg('Login berhasil! Mengalihkan...');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi gangguan saat memverifikasi kredensial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col justify-center items-center bg-slate-100/60 text-slate-800">
      <div className="w-full max-w-sm space-y-3.5">
        
        {/* Header Sederhana */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-2 bg-slate-900 text-white rounded-2xl shadow-xs">
            <img 
              src="/icons/icon.svg" 
              alt="Logo" 
              className="w-11 h-11 object-contain rounded-lg"
            />
          </div>

          <h1 className="text-lg font-bold text-slate-900 tracking-tight m-0">
            Masuk ke Sistem
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Pilih atau masukkan username dan PIN Anda
          </p>
        </div>

        {/* Security Auto-Logout Notification Banner */}
        {sessionExpiredNotice && (
          <div 
            id="session-expired-alert"
            className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between gap-2 text-xs"
          >
            <div className="flex items-start gap-2 min-w-0">
              <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-bold block">Sesi Telah Berakhir</span>
                <p className="text-[11px] text-amber-800 m-0 leading-tight">
                  {sessionExpiredNotice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearSessionExpiredNotice}
              className="text-amber-600 hover:text-amber-900 p-0.5 rounded cursor-pointer"
              title="Tutup"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Form Login Sederhana & Ringan */}
        <div className="bg-white p-5 border border-slate-200/90 shadow-2xs rounded-2xl">
          
          {/* Alert Feedback */}
          {errorMsg && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <UserCheck size={14} className="shrink-0 mt-0.5 text-blue-600" />
              <span className="font-medium">{infoMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            
            {/* Searchable / Dropdown Username Field */}
            <div ref={dropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Username
                </label>
                {matchedUser && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
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
                      className="w-5 h-5 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <User size={15} className="text-slate-400" />
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
                  placeholder="Ketik atau pilih username..."
                  className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-medium text-slate-800 transition-colors"
                />

                {/* Dropdown Toggle / Clear Button */}
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-0.5">
                  {username && (
                    <button
                      type="button"
                      onClick={() => {
                        setUsername('');
                        setInfoMsg('');
                        usernameInputRef.current?.focus();
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      title="Hapus"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    title={isDropdownOpen ? 'Tutup daftar' : 'Buka daftar'}
                  >
                    <ChevronDown size={15} className={`transition-transform ${isDropdownOpen ? 'rotate-180 text-slate-800' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Dropdown Menu List of Users */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-56 flex flex-col">
                  
                  {/* Dropdown Header / Search Tip */}
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Search size={11} className="text-slate-600" />
                      Pilih Akun Terdaftar:
                    </span>
                    <span className="text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded font-mono">
                      {filteredUsers.length} Akun
                    </span>
                  </div>

                  {/* Users List Scrollable */}
                  <div className="overflow-y-auto divide-y divide-slate-100 p-1">
                    {isLoadingUsers && usersList.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <RefreshCw size={13} className="animate-spin text-slate-600" />
                        <span>Memuat...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        <p className="font-medium text-slate-700 m-0">Tidak ada akun yang cocok.</p>
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
                            className={`w-full p-2 rounded-lg transition-colors text-left flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-slate-100 text-slate-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={user.avatar || DEFAULT_AVATAR}
                                alt={user.nama}
                                className="w-6 h-6 rounded-md object-cover border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-semibold text-slate-800 truncate">
                                    {user.nama}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                    isAdminUser
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-200 text-slate-700'
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
                              <CheckCircle2 size={14} className="text-slate-800 shrink-0" />
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
                <label className="block text-xs font-bold text-slate-700">
                  Kode PIN
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  ref={pinInputRef}
                  type={showPin ? 'text' : 'password'}
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN..."
                  className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-mono tracking-widest text-slate-800 transition-colors font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Masuk</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Info & Sync */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hover:text-slate-600 flex items-center gap-1 cursor-pointer"
              title="Perbarui daftar akun"
            >
              <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Sinkron Akun ({usersList.length})</span>
            </button>
            <span className="text-[10px]">PIN Terenkripsi</span>
          </div>
        </div>
      </div>
    </div>
  );
}


