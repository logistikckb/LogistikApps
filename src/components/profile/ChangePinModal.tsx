import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { 
  KeyRound, 
  X, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Delete,
  Hash
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../../data/avatarPresets';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePinModal({ isOpen, onClose }: ChangePinModalProps) {
  const { currentUser, changeMyPin } = useAuth();
  const { showToast } = useNotification();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const [activeField, setActiveField] = useState<'old' | 'new' | 'confirm'>('old');
  const [useVirtualNumpad, setUseVirtualNumpad] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const oldPinRef = useRef<HTMLInputElement>(null);
  const newPinRef = useRef<HTMLInputElement>(null);
  const confirmPinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setErrorMsg('');
      setActiveField('old');
      setTimeout(() => {
        oldPinRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = newPin.length > 0 && confirmPin.length > 0 && newPin === confirmPin;
  const isMismatch = confirmPin.length > 0 && newPin !== confirmPin;
  const isPinValidLength = newPin.trim().length >= 4;

  const handleNumpadPress = (num: string) => {
    setErrorMsg('');
    if (activeField === 'old') {
      if (oldPin.length < 8) setOldPin((prev) => prev + num);
    } else if (activeField === 'new') {
      if (newPin.length < 8) setNewPin((prev) => prev + num);
    } else if (activeField === 'confirm') {
      if (confirmPin.length < 8) setConfirmPin((prev) => prev + num);
    }
  };

  const handleNumpadBackspace = () => {
    setErrorMsg('');
    if (activeField === 'old') {
      setOldPin((prev) => prev.slice(0, -1));
    } else if (activeField === 'new') {
      setNewPin((prev) => prev.slice(0, -1));
    } else if (activeField === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleNumpadClear = () => {
    setErrorMsg('');
    if (activeField === 'old') {
      setOldPin('');
    } else if (activeField === 'new') {
      setNewPin('');
    } else if (activeField === 'confirm') {
      setConfirmPin('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!oldPin.trim()) {
      setErrorMsg('Harap masukkan PIN lama Anda untuk verifikasi.');
      oldPinRef.current?.focus();
      return;
    }

    if (!newPin.trim()) {
      setErrorMsg('Harap masukkan PIN baru.');
      newPinRef.current?.focus();
      return;
    }

    if (newPin.trim().length < 4) {
      setErrorMsg('PIN baru minimal harus 4 digit/karakter.');
      newPinRef.current?.focus();
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setErrorMsg('Konfirmasi PIN baru tidak sesuai dengan PIN baru!');
      confirmPinRef.current?.focus();
      return;
    }

    if (oldPin.trim() === newPin.trim()) {
      setErrorMsg('PIN baru tidak boleh sama dengan PIN lama Anda.');
      newPinRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeMyPin(oldPin, newPin);
      if (res.success) {
        showToast('PIN Berhasil Diperbarui', res.message || 'PIN keamanan Anda telah berhasil diperbarui.', 'success');
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal mengubah PIN. Periksa kembali PIN lama Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memperbarui PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/70 p-4 animate-fade-in backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 relative text-left max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all z-20 cursor-pointer"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 m-0 uppercase tracking-tight flex items-center gap-2">
              Ganti PIN Akun Saya
            </h2>
            <p className="text-xs text-slate-500 m-0 font-medium">
              Ubah kode PIN akses pribadi Anda secara mandiri & aman
            </p>
          </div>
        </div>

        {/* User Info Card */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3 mb-4">
          <img 
            src={currentUser?.avatar || DEFAULT_AVATAR} 
            alt={currentUser?.nama || 'Avatar'}
            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-800 text-xs truncate">
                {currentUser?.nama || 'Pengguna'}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                @{currentUser?.username || 'user'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <ShieldCheck size={11} className="text-blue-600 shrink-0" />
              <span>Role: <strong className="text-slate-700">{currentUser?.role || 'Pelaksana'}</strong></span>
            </div>
          </div>

          <div className="text-right">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <CheckCircle2 size={10} /> Akun Aktif
            </span>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-shake">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="font-semibold leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
          {/* Field 1: PIN Lama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>PIN Lama / Saat Ini <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Wajib untuk verifikasi keamanan</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={15} />
              </div>
              <input
                ref={oldPinRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                maxLength={8}
                value={oldPin}
                onChange={(e) => {
                  setErrorMsg('');
                  setOldPin(e.target.value);
                }}
                onFocus={() => setActiveField('old')}
                placeholder="Masukkan PIN lama Anda..."
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all ${
                  activeField === 'old' ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300'
                } ${showOldPin ? 'pin-mask-visible' : 'pin-mask-hidden'}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPin(!showOldPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showOldPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showOldPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Field 2: PIN Baru */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>PIN Baru <span className="text-red-500">*</span></span>
              <span className={`text-[10px] font-semibold ${isPinValidLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isPinValidLength ? '✓ Minimal 4 karakter terpenuhi' : 'Minimal 4 digit/karakter'}
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound size={15} />
              </div>
              <input
                ref={newPinRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                maxLength={8}
                value={newPin}
                onChange={(e) => {
                  setErrorMsg('');
                  setNewPin(e.target.value);
                }}
                onFocus={() => setActiveField('new')}
                placeholder="Buat PIN baru (contoh: 1234)..."
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all ${
                  activeField === 'new' ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300'
                } ${showNewPin ? 'pin-mask-visible' : 'pin-mask-hidden'}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showNewPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showNewPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Field 3: Konfirmasi PIN Baru */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Konfirmasi PIN Baru <span className="text-red-500">*</span></span>
              {isMatched && (
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                  <CheckCircle2 size={11} /> PIN Cocok
                </span>
              )}
              {isMismatch && (
                <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                  <AlertCircle size={11} /> Belum cocok
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <CheckCircle2 size={15} className={isMatched ? 'text-emerald-500' : 'text-slate-400'} />
              </div>
              <input
                ref={confirmPinRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => {
                  setErrorMsg('');
                  setConfirmPin(e.target.value);
                }}
                onFocus={() => setActiveField('confirm')}
                placeholder="Ketik ulang PIN baru..."
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all ${
                  isMatched 
                    ? 'border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50/20' 
                    : isMismatch 
                    ? 'border-red-400 ring-1 ring-red-300' 
                    : activeField === 'confirm' 
                    ? 'border-amber-500 ring-1 ring-amber-400' 
                    : 'border-slate-300'
                } ${showConfirmPin ? 'pin-mask-visible' : 'pin-mask-hidden'}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showConfirmPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showConfirmPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Virtual Numpad Toggle for Mobile / Barcode Gun / Tablet Touchscreens */}
          <div className="pt-1">
            <div className="flex items-center justify-between pb-1.5">
              <button
                type="button"
                onClick={() => setUseVirtualNumpad(!useVirtualNumpad)}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
              >
                <Hash size={13} />
                <span>{useVirtualNumpad ? 'Sembunyikan Numpad Sentuh' : 'Tampilkan Numpad Sentuh Cepat'}</span>
              </button>

              <span className="text-[10px] text-slate-400">
                Sedang aktif: <strong className="text-slate-700 uppercase">{activeField === 'old' ? 'PIN Lama' : activeField === 'new' ? 'PIN Baru' : 'Konfirmasi'}</strong>
              </span>
            </div>

            {useVirtualNumpad && (
              <div className="bg-slate-100/90 p-3 rounded-2xl border border-slate-200 shadow-inner mt-2">
                <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadPress(num)}
                      className="py-2.5 rounded-xl bg-white hover:bg-amber-50 active:bg-amber-100 text-slate-800 font-extrabold text-sm border border-slate-200 shadow-xs transition-colors cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleNumpadClear}
                    className="py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    title="Hapus Semua"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('0')}
                    className="py-2.5 rounded-xl bg-white hover:bg-amber-50 active:bg-amber-100 text-slate-800 font-extrabold text-sm border border-slate-200 shadow-xs transition-colors cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleNumpadBackspace}
                    className="py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                    title="Hapus Satu Digit"
                  >
                    <Delete size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isPinValidLength || (confirmPin.length > 0 && !isMatched)}
              className="flex-1 max-w-xs py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menyimpan PIN...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Simpan PIN Baru</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security Info Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 m-0">
            PIN Anda bersifat rahasia dan langsung terenkripsi ke database server. Jangan berikan kode PIN kepada siapa pun.
          </p>
        </div>
      </div>
    </div>
  , document.body) : null;
}

export default ChangePinModal;
