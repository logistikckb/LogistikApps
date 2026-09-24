import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, KeyRound, X, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldAlert, Delete } from 'lucide-react';

interface MenuPinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const MENU_VISIBILITY_PIN = '399339';

export function MenuPinAuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verifikasi PIN Menu',
  description = 'Masukkan PIN keamanan untuk melakukan Hide / Unhide menu.'
}: MenuPinAuthModalProps) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 6) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const verifyPin = (candidate: string) => {
    if (candidate === MENU_VISIBILITY_PIN) {
      onSuccess();
      onClose();
    } else {
      setErrorMsg('PIN salah! Silakan masukkan PIN 6 digit yang valid.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6) {
      setErrorMsg('Harap masukkan 6 digit PIN secara lengkap.');
      return;
    }
    verifyPin(pin);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white p-5 sm:p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 relative text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 m-0">{title}</h3>
              <p className="text-[11px] text-slate-500 m-0">Autentikasi Hak Akses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4 text-center">
          {description}
        </p>

        {/* PIN Dots Display */}
        <div className="flex justify-center items-center gap-2.5 mb-3">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const hasValue = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-9 h-11 rounded-xl border flex items-center justify-center text-sm font-black transition-all ${
                  hasValue
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-300'
                }`}
              >
                {hasValue ? (showPin ? pin[idx] : '•') : ''}
              </div>
            );
          })}
        </div>

        {/* Hidden Input for Keyboard Typing */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPin(val);
              setErrorMsg('');
              if (val.length === 6) {
                verifyPin(val);
              }
            }}
            className="opacity-0 absolute -z-10 pointer-events-none"
            autoFocus
          />
        </form>

        {/* Toggle Show PIN */}
        <div className="flex justify-center mb-3">
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
          >
            {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showPin ? 'Sembunyikan Digit' : 'Lihat Digit PIN'}</span>
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 border border-slate-200 text-slate-800 font-extrabold text-base transition-colors cursor-pointer select-none shadow-2xs"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-500 font-bold text-xs transition-colors cursor-pointer select-none"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 border border-slate-200 text-slate-800 font-extrabold text-base transition-colors cursor-pointer select-none shadow-2xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
            title="Backspace"
          >
            <Delete size={17} />
          </button>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => verifyPin(pin)}
            disabled={pin.length !== 6}
            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
          >
            Verifikasi PIN
          </button>
        </div>

      </div>
    </div>,
    document.body
  ) : null;
}
