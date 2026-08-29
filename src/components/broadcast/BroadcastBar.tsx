import { Radio, Volume2, VolumeX, Send, Bell, BellRing, ChevronRight, MessageSquare } from 'lucide-react';
import { BroadcastMessage } from '../../types';

interface BroadcastBarProps {
  onOpenBroadcastModal: () => void;
  latestBroadcast: BroadcastMessage | null;
  messageCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notificationPermission?: NotificationPermission;
  onRequestNotificationPermission?: () => Promise<any>;
  isNotificationSupported?: boolean;
}

export function BroadcastBar({
  onOpenBroadcastModal,
  latestBroadcast,
  messageCount,
  soundEnabled,
  onToggleSound,
  notificationPermission,
  onRequestNotificationPermission,
  isNotificationSupported = true
}: BroadcastBarProps) {
  const hasMessages = messageCount > 0 && !!latestBroadcast;
  const latestSender = latestBroadcast?.sender_name || latestBroadcast?.author_name || 'Pos Logistik';
  const latestMsg = latestBroadcast?.message || latestBroadcast?.content || '';

  return (
    <div 
      id="global-broadcast-bar"
      className={`min-h-[42px] py-1.5 px-3 sm:px-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border transition-colors bg-white ${
        hasMessages 
          ? 'border-rose-300' 
          : 'border-slate-200'
      }`}
    >
      {/* Left: Broadcast Status & Latest Message Preview */}
      <div 
        onClick={onOpenBroadcastModal}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
        title="Klik untuk membuka riwayat pesan siaran"
      >
        <div className={`flex items-center gap-1.5 ${
          hasMessages 
            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        } px-2.5 py-1 rounded-xl font-bold text-[11px] uppercase tracking-wider shrink-0`}>
          <Radio size={13} className={hasMessages ? "text-rose-500 animate-pulse" : "text-blue-500 animate-pulse"} />
          <span>SIARAN PUBLIK</span>
          {messageCount > 0 && (
            <span className="bg-white text-slate-800 border border-slate-200 px-1.5 py-0.2 rounded-full text-[9px] font-bold">
              {messageCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden text-xs">
          {latestBroadcast ? (
            <div className="flex items-center gap-1.5 truncate text-slate-700 font-semibold group-hover:text-rose-700 transition-colors">
              <span className="font-bold text-rose-700 sm:text-blue-900 uppercase shrink-0">
                [{latestSender}]:
              </span>
              <span className="truncate text-slate-700 font-medium">
                "{latestMsg}"
              </span>
              <ChevronRight size={13} className="text-rose-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform shrink-0 hidden sm:inline" />
            </div>
          ) : (
            <span className="text-slate-500 font-medium text-[11px] truncate">
              Kirim pengumuman instan ke seluruh perangkat yang sedang online.
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 ml-0 sm:ml-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
        {/* Quick Read / History Button */}
        {messageCount > 0 && (
          <button
            type="button"
            onClick={onOpenBroadcastModal}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-700 border-rose-200 transition-colors cursor-pointer"
            title="Lihat semua pesan siaran aktif"
          >
            <MessageSquare size={12} className="text-rose-600" />
            <span className="text-[10px] font-bold">{messageCount} Pesan</span>
          </button>
        )}

        {/* Toggle / Request OS Desktop Notification */}
        {isNotificationSupported && (
          notificationPermission === 'granted' ? (
            <div 
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-800 border-emerald-200"
              title="Notifikasi Sistem/OS Aktif: Pesan siaran otomatis melayang di layar meskipun membuka aplikasi/tab lain"
            >
              <Bell size={13} className="text-emerald-700" />
              <span className="hidden lg:inline text-[10px]">Notif OS Aktif</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Klik untuk mengaktifkan notifikasi pop-up desktop agar siaran tetap muncul saat Anda membuka tab/aplikasi lain"
            >
              <BellRing size={13} className="text-amber-700 animate-bounce" />
              <span className="hidden md:inline text-[10px]">Aktifkan Notif Layar</span>
            </button>
          )
        )}

        {/* Toggle Sound */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
            soundEnabled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 line-through'
          }`}
          title={soundEnabled ? 'Suara Siaran Aktif (Klik untuk Mute)' : 'Suara Siaran Dimatikan'}
        >
          {soundEnabled ? <Volume2 size={13} className="text-emerald-700" /> : <VolumeX size={13} />}
          <span className="hidden md:inline">{soundEnabled ? 'Audio On' : 'Mute'}</span>
        </button>

        {/* Kirim Siaran Button */}
        <button
          type="button"
          onClick={onOpenBroadcastModal}
          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Send size={12} className="text-blue-600" />
          <span>Kirim Siaran</span>
        </button>
      </div>
    </div>
  );
}
