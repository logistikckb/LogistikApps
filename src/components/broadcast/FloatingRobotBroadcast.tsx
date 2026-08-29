import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, MailOpen, Volume2, X, Reply, Sparkles, Send, CheckCircle2, Clock, ChevronDown, Lock } from 'lucide-react';
import { BroadcastMessage } from '../../types';
import { playBroadcastSound } from '../../utils/broadcastSound';

interface FloatingRobotBroadcastProps {
  broadcast: BroadcastMessage | null;
  onClose: () => void;
  onReply?: (senderName: string) => void;
  soundEnabled: boolean;
}

function safeFormatTime(dateInput?: any): string {
  if (!dateInput) {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      const now = new Date();
      return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Baru saja';
  }
}

function safeFormatDate(dateInput?: any): string {
  if (!dateInput) {
    const now = new Date();
    return now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      const now = new Date();
      return now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'Hari ini';
  }
}

export function FloatingRobotBroadcast({
  broadcast,
  onClose,
  onReply,
  soundEnabled
}: FloatingRobotBroadcastProps) {
  // Envelope is CLOSED by default when a broadcast arrives
  const [isOpen, setIsOpen] = useState(false);

  // Reset to closed state whenever a new broadcast arrives
  useEffect(() => {
    if (broadcast) {
      setIsOpen(false);
    }
  }, [broadcast?.id]);

  if (!broadcast || typeof broadcast !== 'object') return null;

  const senderName = broadcast.sender_name || broadcast.author_name || 'Pos Logistik';
  const messageText = broadcast.message || broadcast.content || broadcast.title || '';
  const timeFormatted = safeFormatTime(broadcast.created_at);
  const dateFormatted = safeFormatDate(broadcast.created_at);

  const handleOpenEnvelope = () => {
    setIsOpen(true);
    if (soundEnabled) {
      playBroadcastSound(broadcast.category || 'info');
    }
  };

  const handleFoldEnvelope = () => {
    setIsOpen(false);
  };

  if (typeof document === "undefined" || !document.body) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md flex flex-col items-center relative select-none animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Floating Top Header Badges & Actions */}
        <div className="w-full flex items-center justify-between gap-2 mb-2.5 px-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-900/90 border border-blue-400/40 text-blue-200 text-[11px] font-bold shadow-xs">
              <Sparkles size={12} className="text-amber-300 animate-pulse" />
              <span>Pesan Siaran Baru</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {soundEnabled && (
              <button
                type="button"
                onClick={() => playBroadcastSound(broadcast.category || 'info')}
                className="p-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-slate-700 shadow-xs cursor-pointer transition-colors"
                title="Putar Suara Notifikasi"
              >
                <Volume2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-xs cursor-pointer transition-colors"
              title="Tutup"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CASE 1: ENVELOPE IS CLOSED (Isi pesan disembunyikan)      */}
        {/* ======================================================== */}
        {!isOpen ? (
          <div 
            onClick={handleOpenEnvelope}
            className="w-full bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-2xl border-2 border-blue-400/50 shadow-2xl overflow-hidden cursor-pointer group hover:border-amber-400/80 transition-all duration-300 active:scale-[0.98]"
          >
            {/* Airmail Border Accent Stripe */}
            <div 
              className="h-2 w-full"
              style={{
                backgroundImage: 'repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 14px, #ffffff 14px, #ffffff 24px, #3b82f6 24px, #3b82f6 38px, #ffffff 38px, #ffffff 48px)'
              }}
            />

            {/* Closed Envelope Body */}
            <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4">
              
              {/* Animated Wax Seal Stamp */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-lg flex items-center justify-center transform group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300 border-2 border-amber-200">
                  <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-amber-500 to-amber-800 flex flex-col items-center justify-center text-white">
                    <Mail size={26} className="text-amber-100 fill-amber-100/20" />
                  </div>
                </div>
                {/* Stamp Ripple Pulse */}
                <div className="absolute -inset-1 rounded-2xl bg-amber-400/30 animate-ping pointer-events-none -z-10" />
              </div>

              {/* Sender & Status Description */}
              <div className="space-y-1.5 max-w-xs">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-900/60 border border-blue-400/30 text-[11px] font-mono text-blue-200">
                  <Clock size={11} className="text-amber-300" />
                  <span>Diterima {timeFormatted}</span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight m-0">
                  Surat Siaran dari <span className="text-amber-300 uppercase">{senderName}</span>
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed m-0 flex items-center justify-center gap-1">
                  <Lock size={12} className="text-amber-400/90 shrink-0" />
                  <span>Isi pesan tersegel di dalam amplop.</span>
                </p>
              </div>

              {/* Primary Call-To-Action Button to Open */}
              <button
                type="button"
                onClick={handleOpenEnvelope}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer group-hover:shadow-amber-500/40"
              >
                <MailOpen size={17} className="text-slate-950" />
                <span>Buka Amplop Sekarang</span>
              </button>
            </div>

            {/* Bottom Footer Ribbon */}
            <div className="px-4 py-2 bg-slate-950/60 border-t border-blue-900/40 flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono uppercase tracking-wider text-blue-300/80">Logistics Dispatch</span>
              <span className="text-amber-300/90 font-medium">Klik untuk membaca ➔</span>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* CASE 2: ENVELOPE IS OPEN (Isi pesan terbuka & terbaca)    */
          /* ======================================================== */
          <div className="w-full bg-white rounded-2xl border-2 border-amber-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Top Airmail Border Accent */}
            <div 
              className="h-2.5 w-full"
              style={{
                backgroundImage: 'repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 14px, #ffffff 14px, #ffffff 24px, #2563eb 24px, #2563eb 38px, #ffffff 38px, #ffffff 48px)'
              }}
            />

            {/* Letter Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between gap-2 border-b border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shrink-0 border border-amber-200">
                  <MailOpen size={16} className="text-slate-950" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Surat Siaran Logistik
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-white truncate m-0 mt-0.5">
                    Pengirim: <span className="text-amber-300 uppercase">{senderName}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 text-[10px] text-slate-300 font-mono">
                <span className="flex items-center gap-1 text-amber-200 font-bold">
                  <Clock size={11} />
                  {timeFormatted}
                </span>
                <span className="text-slate-400">{dateFormatted}</span>
              </div>
            </div>

            {/* Letter Body (Parchment Paper Styling) */}
            <div className="p-4 sm:p-5 bg-gradient-to-b from-amber-50/40 via-white to-slate-50 relative space-y-3">
              
              {/* Official Postal Stamp watermark */}
              <div className="absolute right-3 top-3 border-2 border-dashed border-blue-900/20 rounded-lg p-1.5 flex flex-col items-center opacity-30 pointer-events-none rotate-3">
                <span className="text-[8px] font-black font-mono tracking-widest text-blue-900 uppercase">PRIORITY DISPATCH</span>
                <span className="text-[9px] font-black text-blue-900">{dateFormatted}</span>
              </div>

              {/* Message Content Box */}
              <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs text-slate-800 text-sm sm:text-base font-bold leading-relaxed whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                "{messageText || '(Pesan kosong)'}"
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1.5 text-blue-900 font-bold">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Pesan Siaran Aktif
                </span>
                <button 
                  type="button" 
                  onClick={handleFoldEnvelope}
                  className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <ChevronDown size={13} />
                  <span>Lipat Kembali</span>
                </button>
              </div>
            </div>

            {/* Letter Action Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div>
                {onReply && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onReply(senderName);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Reply size={13} className="text-blue-700" />
                    <span>Balas Pesan</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Oke, Mengerti</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  , document.body);
}

// Named alias for backward compatibility and clean semantics
export const EnvelopeBroadcast = FloatingRobotBroadcast;

