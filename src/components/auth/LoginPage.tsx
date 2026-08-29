import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
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
  User
} from 'lucide-react';

interface LoginPageProps {
  onOpenBroadcast?: () => void;
}

export function LoginPage({ onOpenBroadcast: _onOpenBroadcast }: LoginPageProps) {
  const { login, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUsername) {
      setErrorMsg('Harap masukkan Username Anda!');
      usernameInputRef.current?.focus();
      return;
    }
    if (!cleanPin) {
      setErrorMsg('Harap masukkan Kode PIN Anda!');
      pinInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(cleanUsername, cleanPin);
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
      <div className="w-full max-w-md space-y-3.5 my-auto">
        
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
            Masuk ke Sistem
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Masukkan Username dan Kode PIN untuk melanjutkan
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
        <div className="bg-white p-5 sm:p-6 border border-slate-200/90 shadow-sm rounded-2xl">
          
          {/* Alert Feedback */}
          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-username-input" className="block text-xs font-bold text-slate-700">
                Username / Akun
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  id="login-username-input"
                  ref={usernameInputRef}
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username..."
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-slate-800 transition-colors placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            {/* PIN Code Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-pin-input" className="block text-xs font-bold text-slate-700">
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
                  id="login-pin-input"
                  ref={pinInputRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN..."
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-mono tracking-widest text-slate-800 transition-colors font-bold text-center placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !pin.trim()}
                id="login-submit-btn"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Masuk ke Aplikasi</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Info */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Lock size={11} className="text-slate-400" />
              <span>PIN & Akses Terenkripsi</span>
            </span>
            <span className="text-[10px] text-slate-400">Cikembar Logistic</span>
          </div>
        </div>
      </div>
    </div>
  );
}
