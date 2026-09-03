import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../hooks/useSupabase';
import { useNotification } from '../context/NotificationContext';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast, showAlert } = useNotification();

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      return showToast('Isi Kredensial', 'Email dan Password wajib diisi untuk login', 'warning');
    }
    setLoading(true);
    try {
      await login(trimmedEmail, trimmedPassword);
      showToast('Login Berhasil', 'Anda sekarang masuk sebagai Admin', 'success');
      onSuccess();
    } catch (e: any) {
      showAlert('Gagal Login', e.message || 'Kredensial tidak valid', 'error');
    } finally {
      setLoading(false);
    }
  };

  return typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[1055] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="glass-box rounded-3xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="border-b border-white/50 px-6 py-5 bg-white/40 flex justify-between items-center">
          <h5 className="font-extrabold text-slate-800 flex items-center gap-3 m-0 text-lg uppercase">
            <div className="w-10 h-10 rounded-xl bg-white/60 text-blue-900 flex items-center justify-center border border-white shadow-sm"><Lock size={20} /></div>
            Admin Login
          </h5>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 font-black text-xl transition-transform bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="p-6 bg-white/30">
          <div className="mb-6 text-[12px] font-bold text-blue-900 uppercase tracking-widest border border-blue-900/30 p-3 bg-blue-900/10 rounded-xl shadow-sm">
            Sign in to access admin privileges
          </div>
          
          <input 
            type="email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-800 outline-none transition-all mb-4 shadow-sm placeholder:text-slate-400" 
            placeholder="Email Address" 
          />
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-800 outline-none transition-all mb-6 shadow-sm placeholder:text-slate-400" 
            placeholder="Password" 
          />
          <div className="flex gap-3">
            <button onClick={handleLogin} disabled={loading} className="glass-btn !bg-orange-500/90 hover:!bg-orange-500 text-white w-full !py-3 !rounded-xl text-sm border-orange-400">
              {loading ? 'WAIT...' : 'SIGN IN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body) : null;
}
