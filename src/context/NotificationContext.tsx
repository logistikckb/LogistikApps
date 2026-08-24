import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, Trash2, HelpCircle, Bell } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface AlertDialogState {
  isOpen: boolean;
  title: string;
  message?: string;
  type?: ToastType;
}

interface NotificationContextType {
  showToast: (title: string, message?: string, type?: ToastType) => void;
  showAlert: (title: string, message?: string, type?: ToastType) => void;
  showConfirm: (
    optionsOrTitle: string | {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
      onConfirm?: () => void;
      onCancel?: () => void;
    },
    message?: string,
    typeOrOnConfirm?: ('danger' | 'warning' | 'info') | (() => void)
  ) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    title: '',
  });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showAlert = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    setAlertDialog({
      isOpen: true,
      title,
      message,
      type,
    });
  }, []);

  const showConfirm = useCallback((
    optionsOrTitle: string | {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
      onConfirm?: () => void;
      onCancel?: () => void;
    },
    messageArg?: string,
    typeOrOnConfirmArg?: ('danger' | 'warning' | 'info') | (() => void)
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let title = '';
      let message = '';
      let confirmText = 'Ya, Lanjutkan';
      let cancelText = 'Batal';
      let type: 'danger' | 'warning' | 'info' = 'danger';
      let callbackConfirm: (() => void) | undefined;
      let callbackCancel: (() => void) | undefined;

      if (typeof optionsOrTitle === 'string') {
        title = optionsOrTitle;
        message = messageArg || '';
        if (typeof typeOrOnConfirmArg === 'function') {
          callbackConfirm = typeOrOnConfirmArg;
        } else if (typeof typeOrOnConfirmArg === 'string') {
          type = typeOrOnConfirmArg;
        }
      } else if (optionsOrTitle && typeof optionsOrTitle === 'object') {
        title = optionsOrTitle.title || 'Konfirmasi';
        message = optionsOrTitle.message || '';
        confirmText = optionsOrTitle.confirmText || 'Ya, Lanjutkan';
        cancelText = optionsOrTitle.cancelText || 'Batal';
        type = optionsOrTitle.type || 'danger';
        callbackConfirm = optionsOrTitle.onConfirm;
        callbackCancel = optionsOrTitle.onCancel;
      }

      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          if (callbackConfirm) callbackConfirm();
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          if (callbackCancel) callbackCancel();
          resolve(false);
        },
      });
    });
  }, []);

  // Set global fallback so any accidental native alert/confirm gets redirected to custom popup
  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (msg?: any) => {
      showAlert('INFORMASI', String(msg ?? ''), 'info');
    };

    window.confirm = (msg?: string) => {
      // In synchronous contexts, default to true or let showConfirm handle interactive dialogs
      showConfirm({
        title: 'Konfirmasi',
        message: String(msg ?? 'Apakah Anda yakin?'),
        confirmText: 'Ya',
        cancelText: 'Batal',
        type: 'warning',
        onConfirm: () => {},
      });
      return true;
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [showAlert, showConfirm]);

  return (
    <NotificationContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}

      {/* Floating Toasts */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
                isError
                  ? 'bg-red-600/95 text-white border-red-400/80 shadow-red-900/30'
                  : isSuccess
                  ? 'bg-emerald-600/95 text-white border-emerald-400/80 shadow-emerald-900/30'
                  : isWarning
                  ? 'bg-amber-500/95 text-white border-amber-300/80 shadow-amber-900/30'
                  : 'bg-blue-900/95 text-white border-blue-400/80 shadow-blue-950/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isError && <AlertTriangle size={20} className="text-white" />}
                {isSuccess && <CheckCircle2 size={20} className="text-white" />}
                {isWarning && <AlertTriangle size={20} className="text-white" />}
                {!isError && !isSuccess && !isWarning && <Info size={20} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-xs uppercase tracking-wide m-0">{toast.title}</h5>
                {toast.message && (
                  <p className="text-[11px] opacity-95 mt-1 m-0 break-words font-medium">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Alert Modal Dialog */}
      {alertDialog.isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="glass-box max-w-md w-full p-6 sm:p-7 rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md ${
                  alertDialog.type === 'error'
                    ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                    : alertDialog.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                    : alertDialog.type === 'warning'
                    ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                    : 'bg-blue-900/15 text-blue-900 border border-blue-900/30'
                }`}
              >
                {alertDialog.type === 'error' && <AlertTriangle size={28} />}
                {alertDialog.type === 'success' && <CheckCircle2 size={28} />}
                {alertDialog.type === 'warning' && <AlertTriangle size={28} />}
                {(!alertDialog.type || alertDialog.type === 'info') && <Bell size={28} />}
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-800 m-0 mb-2 uppercase tracking-wide">
                {alertDialog.title}
              </h3>

              {alertDialog.message && (
                <p className="text-xs sm:text-sm font-semibold text-slate-600 m-0 mb-6 leading-relaxed whitespace-pre-line">
                  {alertDialog.message}
                </p>
              )}

              <button
                onClick={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-blue-900 hover:bg-blue-950 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 cursor-pointer"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Confirm Modal Dialog */}
      {confirmDialog.isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="glass-box max-w-md w-full p-6 sm:p-7 rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md ${
                  confirmDialog.type === 'danger'
                    ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                }`}
              >
                {confirmDialog.type === 'danger' ? <Trash2 size={28} /> : <HelpCircle size={28} />}
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-800 m-0 mb-2 uppercase tracking-wide">
                {confirmDialog.title}
              </h3>

              <p className="text-xs sm:text-sm font-semibold text-slate-600 m-0 mb-6 leading-relaxed whitespace-pre-line">
                {confirmDialog.message}
              </p>

              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={confirmDialog.onCancel}
                  className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }}
                  className={`flex-1 py-3 px-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider text-white shadow-lg transition-all duration-200 active:scale-95 cursor-pointer ${
                    confirmDialog.type === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
