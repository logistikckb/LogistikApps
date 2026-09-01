import { createPortal } from 'react-dom';
import React, { useState, useEffect, FormEvent } from 'react';
import { 
  Send, 
  X, 
  History, 
  PlusCircle, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Mail,
  MailOpen,
  Database,
  ShieldCheck,
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  UserCheck,
  ArrowRightLeft,
  Settings2
} from 'lucide-react';
import { BroadcastMessage } from '../../types';
import { playBroadcastSound } from '../../utils/broadcastSound';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: BroadcastMessage[];
  loading: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSend: (data: {
    sender_name: string;
    message: string;
    category?: any;
    device_info?: string;
  }) => Promise<any>;
  onDeleteMessage?: (id: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  initialSenderName?: string;
  isAdmin?: boolean;
  notificationPermission?: NotificationPermission;
  onRequestNotificationPermission?: () => Promise<any>;
  isNotificationSupported?: boolean;
  isBridgeActive?: boolean;
  onOpenBridgeSettings?: () => void;
}

function safeFormatTime(dateInput?: any): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export function BroadcastModal({
  isOpen,
  onClose,
  messages,
  loading,
  soundEnabled,
  onToggleSound,
  onSend,
  onDeleteMessage,
  onClearAll,
  initialSenderName,
  isAdmin,
  notificationPermission,
  onRequestNotificationPermission,
  isNotificationSupported = true,
  isBridgeActive = false,
  onOpenBridgeSettings
}: BroadcastModalProps) {
  const { currentUser } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  const [senderName, setSenderName] = useState<string>(() => {
    if (currentUser?.nama) return currentUser.nama;
    if (currentUser?.username) return currentUser.username;
    return localStorage.getItem('broadcast_sender_name') || 'Pos Logistik';
  });

  const [messageText, setMessageText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Sync sender name when currentUser or modal opens
  useEffect(() => {
    if (currentUser?.nama) {
      setSenderName(currentUser.nama);
    } else if (currentUser?.username) {
      setSenderName(currentUser.username);
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (initialSenderName) {
      setMessageText(`@${initialSenderName} `);
    }
  }, [initialSenderName]);

  if (!isOpen) return null;

  const handleSendBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) {
      showToast('Peringatan', 'Silakan ketik pesan terlebih dahulu.', 'warning');
      return;
    }

    if (!senderName.trim()) {
      showToast('Peringatan', 'Silakan masukkan nama pengirim.', 'warning');
      return;
    }

    setIsSending(true);
    try {
      localStorage.setItem('broadcast_sender_name', senderName.trim());

      await onSend({
        sender_name: senderName.trim(),
        message: messageText.trim(),
        category: 'info',
        device_info: navigator.userAgent.includes('Mobile') ? 'HP' : 'PC'
      });

      if (soundEnabled) {
        playBroadcastSound('info');
      }

      showToast('Terkirim!', 'Pesan siaran berhasil dikirim ke seluruh perangkat.', 'success');
      setMessageText('');
      setActiveTab('history');
    } catch (err: any) {
      showToast('Gagal', err.message || 'Gagal menyiarkan pesan.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    if (!onClearAll) {
      showToast('Akses Terbatas', 'Hanya Admin yang dapat menghapus seluruh pesan di database.', 'warning');
      return;
    }

    showConfirm({
      title: 'Kosongkan Seluruh Pesan Siaran?',
      message: 'Semua riwayat pesan siaran akan dibersihkan secara permanen dari server agar sistem tetap ringan dan responsif. Lanjutkan?',
      confirmText: 'Ya, Bersihkan Riwayat',
      type: 'danger',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onClearAll();
          showToast('Riwayat Bersih', 'Seluruh riwayat pesan siaran berhasil dikosongkan.', 'success');
        } catch (e: any) {
          showToast('Gagal', 'Terjadi kesalahan saat mengosongkan pesan.', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleDeleteSingle = (id: string, sender: string) => {
    if (!onDeleteMessage) return;

    showConfirm({
      title: 'Hapus Pesan?',
      message: `Hapus pesan siaran dari "${sender}" dari database?`,
      confirmText: 'Hapus Pesan',
      type: 'danger',
      onConfirm: async () => {
        try {
          await onDeleteMessage(id);
          showToast('Terhapus', 'Pesan siaran berhasil dihapus dari database.', 'success');
        } catch (e) {
          showToast('Gagal', 'Gagal menghapus pesan.', 'error');
        }
      }
    });
  };

  return typeof document !== "undefined" ? createPortal(
    <div 
      className="fixed inset-0 z-[800] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Sederhana & Cepat */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 shadow-xs shrink-0 font-bold">
              <MailOpen size={16} className="text-slate-950" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight leading-none truncate m-0 flex items-center gap-1.5">
                <span>Kirim Pesan Siaran</span>
              </h3>
              <p className="text-[11px] text-amber-300 font-medium m-0 mt-0.5 truncate">
                Disiarkan langsung ke seluruh perangkat aktif
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
              title={soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Mute'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-1.5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'compose'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle size={14} />
            <span>Tulis Pesan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History size={14} />
            <span>Riwayat ({messages.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-white">
          {activeTab === 'compose' ? (
            <form onSubmit={handleSendBroadcast} className="space-y-3.5">
              {/* Cross-App Bridge Connection Banner (Khusus Admin) */}
              {isAdmin && onOpenBridgeSettings && (
                <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                  isBridgeActive 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isBridgeActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <ArrowRightLeft size={12} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] leading-tight m-0 truncate">
                        {isBridgeActive 
                          ? 'Jembatan Siaran 2 Aplikasi Aktif' 
                          : 'Jembatan Siaran Antar-Aplikasi'}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight m-0 mt-0.5 truncate">
                        {isBridgeActive 
                          ? 'Pesan otomatis disiarkan ke database kedua aplikasi.' 
                          : 'Hubungkan dengan aplikasi pasangan (database berbeda).'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenBridgeSettings}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Settings2 size={11} />
                    <span>{isBridgeActive ? 'Atur' : 'Sambungkan'}</span>
                  </button>
                </div>
              )}

              {/* OS Notification Status Banner */}
              {isNotificationSupported && (
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition-all ${
                  notificationPermission === 'granted'
                    ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                    : 'bg-amber-50/80 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {notificationPermission === 'granted' ? (
                      <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                    ) : (
                      <BellRing size={16} className="text-amber-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] leading-tight m-0">
                        {notificationPermission === 'granted' 
                          ? 'Notifikasi Layar OS Aktif' 
                          : 'Notifikasi Layar Belum Aktif'}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight m-0 mt-0.5 truncate">
                        {notificationPermission === 'granted'
                          ? 'Siaran akan muncul di layar meski buka tab lain / Excel / HP.'
                          : 'Aktifkan agar siaran tetap muncul saat buka aplikasi lain.'}
                      </p>
                    </div>
                  </div>

                  {notificationPermission !== 'granted' && onRequestNotificationPermission && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await onRequestNotificationPermission();
                        if (res === 'granted') {
                          showToast('Berhasil Aktif', 'Notifikasi sistem OS berhasil diaktifkan.', 'success');
                        } else if (res === 'denied') {
                          showToast('Izin Ditolak', 'Silakan izinkan notifikasi melalui ikon gembok di browser.', 'warning');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider shrink-0 transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Aktifkan
                    </button>
                  )}
                </div>
              )}

              {/* Input Nama Pengirim (Otomatis Pengguna yang Login) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Nama Pengirim
                  </label>
                  {currentUser && (
                    <span className="text-[10px] font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <UserCheck size={11} className="text-blue-700" /> Pengguna Login
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Nama Pengirim..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                  required
                />
              </div>

              {/* Input Pesan */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Isi Pesan
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Tulis pesan yang ingin disiarkan..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all resize-none"
                  required
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSending || !messageText.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send size={13} />
                  <span>{isSending ? 'Mengirim...' : 'Siarkan Pesan'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* History List */
            <div className="space-y-3">
              {/* Admin Database Control Bar */}
              {isAdmin && onClearAll && messages.length > 0 && (
                <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                      <Database size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-red-950 m-0 leading-tight">
                        Riwayat Server ({messages.length} pesan)
                      </p>
                      <p className="text-[10px] text-red-700 m-0 leading-tight truncate">
                        Kosongkan agar kapasitas server tetap optimal
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearHistory}
                    disabled={isDeleting}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>{isDeleting ? 'Menghapus...' : 'Hapus Semua'}</span>
                  </button>
                </div>
              )}

              {/* Status Header */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Daftar Pesan Tersimpan ({messages.length})
                </span>

                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <ShieldCheck size={11} /> Admin Mode
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <AlertCircle size={10} /> Hapus via Admin
                  </span>
                )}
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-400 font-medium text-xs">
                  Memuat riwayat...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-500">
                  <p className="text-xs font-semibold m-0">Belum ada pesan siaran di database.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('compose')}
                    className="mt-2 text-xs font-bold text-blue-900 hover:underline cursor-pointer"
                  >
                    Tulis pesan sekarang
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-0.5">
                  {messages.map(item => {
                    const timeStr = safeFormatTime(item.created_at);
                    const senderName = item.sender_name || item.author_name || 'Pos Logistik';
                    const messageText = item.message || item.content || '';

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-800 truncate">
                              {senderName}
                            </span>
                            {item.device_info && (
                              <span className="text-[10px] text-slate-400">
                                • {item.device_info}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-slate-400 text-[10px]">
                            {timeStr && <span>{timeStr}</span>}
                            {isAdmin && onDeleteMessage && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(item.id, senderName)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                                title="Hapus pesan ini dari database (Admin)"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 font-medium m-0 leading-relaxed whitespace-pre-wrap break-words">
                          {messageText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body) : null;
}
