import React, { useState, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldAlert, 
  X,
  Search,
  Users,
  ArrowLeft
} from 'lucide-react';

interface LoginPageProps {
  onOpenBroadcast?: () => void;
}

export function LoginPage({ onOpenBroadcast: _onOpenBroadcast }: LoginPageProps) {
  const { login, usersList, refreshUsers, isLoadingUsers, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return usersList;
    return usersList.filter(u => 
      u.username.toLowerCase().includes(query) ||
      u.nama.toLowerCase().includes(query)
    );
  }, [usersList, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUsers();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSelectUser = (user: UserProfile) => {
    setErrorMsg('');
    setSuccessMsg('');
    setSelectedUser(user);
    setPin('');

    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 100);
  };

  const handleBackToUserList = () => {
    setErrorMsg('');
    setSelectedUser(null);
    setPin('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedUser) {
      setErrorMsg('Silakan pilih salah satu akun terlebih dahulu!');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Harap masukkan Kode PIN Anda!');
      pinInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(selectedUser.username, pin);
      if (!res.success) {
        setErrorMsg(res.message || 'Login gagal. Periksa kembali PIN Anda.');
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
      <div className="w-full max-w-lg space-y-3.5 my-auto">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
            <img 
              src="/icons/icon.svg" 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-lg"
            />
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
            {selectedUser ? `Halo, ${selectedUser.nama}` : 'Masuk ke Sistem'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {selectedUser 
              ? 'Masukkan PIN untuk melanjutkan ke aplikasi' 
              : 'Pilih profil pengguna Anda di bawah'}
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

        {/* Form Login Container */}
        <div className="bg-white p-5 border border-slate-200/90 shadow-sm rounded-2xl">
          
          {/* Alert Feedback */}
          {errorMsg && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* STEP 1: PILIH PROFIL AKUN (GRID 100% TANPA PERLU SCROLL) */}
          {!selectedUser ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-500" />
                  <span>Pilih Profil Anda</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                  {usersList.length} Akun
                </span>
              </div>

              {/* Quick Search jika akun banyak */}
              {usersList.length > 4 && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={13} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik untuk mencari nama..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-800 text-slate-800 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Grid of Users - compact, fits on screen cleanly */}
              <div id="login-user-grid" className="pt-1">
                {isLoadingUsers && usersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-slate-600" />
                    <span>Memuat daftar pengguna...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                    <p className="font-medium text-slate-700 m-0">Tidak ada akun yang cocok.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        id={`user-item-${user.username}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectUser(user);
                          }
                        }}
                        className="p-3 rounded-xl flex flex-col items-start text-left cursor-pointer select-none bg-white hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300"
                      >
                        {/* User Info */}
                        <span className="text-xs font-semibold leading-snug truncate w-full text-slate-800" title={user.nama}>
                          {user.nama}
                        </span>

                        <span className="text-[11px] font-mono mt-0.5 truncate w-full text-slate-500">
                          @{user.username}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STEP 2: MASUKKAN PIN UNTUK AKUN TERPILIH (FOKUS, BERSIH, TANPA SCROLL) */
            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              {/* Selected User Profile Card with "Ganti Akun" Button */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-900 truncate block">
                    {selectedUser.nama}
                  </span>
                  <span className="text-xs font-mono text-slate-500 block">
                    @{selectedUser.username}
                  </span>
                </div>

                {/* Change Account Button */}
                <button
                  type="button"
                  onClick={handleBackToUserList}
                  id="change-account-btn"
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>Ganti Akun</span>
                </button>
              </div>

              {/* PIN Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Kode PIN
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Maks. 8 digit
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    ref={pinInputRef}
                    type={showPin ? 'text' : 'password'}
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Masukkan PIN..."
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-mono tracking-widest text-slate-800 transition-colors font-bold text-center"
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

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleBackToUserList}
                  disabled={isSubmitting}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Kembali
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !pin.trim()}
                  id="login-submit-btn"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
            </form>
          )}

          {/* Footer Info & Sync */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              id="sync-users-btn"
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
