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
  const hasMessages = messageCount > 0 && latestBroadcast;

  return (
    <div 
      id="global-broadcast-bar"
      className={`glass-box min-h-[46px] py-1.5 px-3 sm:px-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-6 !rounded-2xl border transition-all duration-300 ${
        hasMessages 
          ? 'border-pink-300/80 bg-gradient-to-r from-pink-50/70 via-white/80 to-blue-50/70 shadow-sm ring-1 ring-pink-400/20' 
          : 'border-white/70 shadow-xs bg-white/40'
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
            ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-900' 
            : 'bg-gradient-to-r from-blue-900 to-indigo-900'
        } text-white px-2.5 py-1 rounded-xl font-black text-[11px] uppercase tracking-wider shrink-0 shadow-xs`}>
          <Radio size={13} className="text-amber-300 animate-pulse" />
          <span>SIARAN PUBLIK</span>
          {messageCount > 0 && (
            <span className="bg-amber-300 text-slate-950 px-1.5 py-0.2 rounded-full text-[9px] font-black">
              {messageCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden text-xs">
          {latestBroadcast ? (
            <div className="flex items-center gap-1.5 truncate text-slate-700 font-semibold group-hover:text-pink-700 transition-colors">
              <span className="font-black text-pink-700 sm:text-blue-900 uppercase shrink-0">
                [{latestBroadcast.sender_name}]:
              </span>
              <span className="truncate text-slate-700 font-medium">
                "{latestBroadcast.message}"
              </span>
              <ChevronRight size={13} className="text-pink-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:inline" />
            </div>
          ) : (
            <span className="text-slate-500 font-medium text-[11px] truncate">
              Kirim pengumuman instan ke seluruh perangkat yang sedang online.
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 ml-0 sm:ml-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/50">
        {/* Quick Read / History Button */}
        {messageCount > 0 && (
          <button
            type="button"
            onClick={onOpenBroadcastModal}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200 transition-all cursor-pointer shadow-2xs"
            title="Lihat semua pesan siaran aktif"
          >
            <MessageSquare size={12} className="text-pink-600" />
            <span className="text-[10px] font-extrabold">{messageCount} Pesan</span>
          </button>
        )}

        {/* Toggle / Request OS Desktop Notification */}
        {isNotificationSupported && (
          notificationPermission === 'granted' ? (
            <div 
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-300"
              title="Notifikasi Sistem/OS Aktif: Pesan siaran otomatis melayang di layar meskipun membuka aplikasi/tab lain"
            >
              <Bell size={13} className="text-emerald-600" />
              <span className="hidden lg:inline text-[10px]">Notif OS Aktif</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs animate-pulse"
              title="Klik untuk mengaktifkan notifikasi pop-up desktop agar siaran tetap muncul saat Anda membuka tab/aplikasi lain"
            >
              <BellRing size={13} className="text-amber-600 animate-bounce" />
              <span className="hidden md:inline text-[10px]">Aktifkan Notif Layar</span>
            </button>
          )
        )}

        {/* Toggle Sound */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200 line-through'
          }`}
          title={soundEnabled ? 'Suara Siaran Aktif (Klik untuk Mute)' : 'Suara Siaran Dimatikan'}
        >
          {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span className="hidden md:inline">{soundEnabled ? 'Audio On' : 'Mute'}</span>
        </button>

        {/* Kirim Siaran Button */}
        <button
          type="button"
          onClick={onOpenBroadcastModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Send size={12} className="text-amber-300" />
          <span>Kirim Siaran</span>
        </button>
      </div>
    </div>
  );
}
