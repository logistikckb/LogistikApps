import { useEffect, useState } from 'react';
import { Heart, Volume2, X, Reply, Sparkles, Send } from 'lucide-react';
import { BroadcastMessage } from '../../types';
import { playBroadcastSound } from '../../utils/broadcastSound';

interface FloatingRobotBroadcastProps {
  broadcast: BroadcastMessage | null;
  onClose: () => void;
  onReply?: (senderName: string) => void;
  soundEnabled: boolean;
}

export function FloatingRobotBroadcast({
  broadcast,
  onClose,
  onReply,
  soundEnabled
}: FloatingRobotBroadcastProps) {
  const [autoCloseTimer, setAutoCloseTimer] = useState<number>(25);

  useEffect(() => {
    if (!broadcast) return;

    setAutoCloseTimer(25);
    const interval = setInterval(() => {
      setAutoCloseTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [broadcast, onClose]);

  if (!broadcast) return null;

  const timeFormatted = new Date(broadcast.created_at).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg flex flex-col items-center gap-2 relative pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Floating Pink Love Robot Avatar with Thrusters & Glow */}
        <div className="relative flex flex-col items-center animate-bounce duration-1000">
          
          {/* Holographic Love Heart Signal Rings */}
          <div className="absolute -top-4 w-14 h-14 rounded-full border-2 border-pink-400/50 animate-ping pointer-events-none" />
          
          {/* Floating Miniature Hearts around Robot */}
          <div className="absolute -top-2 -left-6 animate-pulse text-pink-400 pointer-events-none">
            <Heart size={14} className="fill-pink-400 opacity-80 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div className="absolute -top-1 -right-6 animate-pulse text-rose-400 pointer-events-none delay-150">
            <Heart size={12} className="fill-rose-400 opacity-90" />
          </div>

          {/* Robot Head and Body */}
          <div 
            className="relative group cursor-pointer" 
            onClick={() => playBroadcastSound('info')}
            title="Klik untuk bunyikan nada"
          >
            {/* Robot Head Container - Pink / Magenta Cyber Gradient */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-b from-pink-500 via-rose-600 to-pink-700 border-2 border-pink-300 shadow-[0_0_30px_rgba(244,63,94,0.65)] flex items-center justify-center relative z-10 transition-transform active:scale-95">
              
              {/* Antenna with Glowing Heart Top */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className="p-0.5 rounded-full bg-pink-300 shadow-[0_0_12px_#fb7185] animate-pulse">
                  <Heart size={12} className="text-pink-600 fill-pink-600" />
                </div>
                <div className="w-1 h-2 bg-pink-300" />
              </div>

              {/* Robot Face Screen (Glossy Visor) */}
              <div className="w-12 h-8 sm:w-14 sm:h-10 rounded-2xl bg-slate-950 border border-pink-400/60 flex items-center justify-around px-1.5 sm:px-2 shadow-inner relative overflow-hidden">
                
                {/* Glowing Heart / Love Eyes */}
                <div className="flex items-center justify-center animate-pulse">
                  <Heart size={13} className="text-pink-400 fill-pink-400 shadow-[0_0_8px_#f43f5e]" />
                </div>

                {/* Cute Blush Cheek Dots */}
                <div className="w-1 h-1 rounded-full bg-pink-500/80 blur-[0.5px]" />

                {/* Glowing Heart / Love Eyes */}
                <div className="flex items-center justify-center animate-pulse">
                  <Heart size={13} className="text-pink-400 fill-pink-400 shadow-[0_0_8px_#f43f5e]" />
                </div>
              </div>

              {/* Robot Pink Ear Sensors */}
              <div className="absolute -left-1.5 w-1.5 h-5 rounded-l-md bg-pink-300 shadow-[0_0_6px_#f43f5e]" />
              <div className="absolute -right-1.5 w-1.5 h-5 rounded-r-md bg-pink-300 shadow-[0_0_6px_#f43f5e]" />
            </div>

            {/* Jet Thruster Flame Glow underneath (Pink/Rose Plasma) */}
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <div className="w-2.5 h-4 bg-gradient-to-b from-pink-300 via-rose-400 to-transparent rounded-full blur-[1px] animate-pulse" />
              <div className="w-3.5 h-5.5 bg-gradient-to-b from-pink-200 via-pink-500 to-transparent rounded-full blur-[1px] animate-pulse delay-75" />
              <div className="w-2.5 h-4 bg-gradient-to-b from-pink-300 via-rose-400 to-transparent rounded-full blur-[1px] animate-pulse delay-150" />
            </div>
          </div>
        </div>

        {/* Message Speech Bubble Dialog Delivered by Pink Love Robot */}
        <div className="w-full bg-white rounded-3xl shadow-2xl border-2 border-pink-400/60 overflow-hidden animate-in zoom-in-95 duration-150 relative">
          
          {/* Header Tag */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-pink-900 via-rose-900 to-slate-900 text-white flex items-center justify-between gap-2 border-b border-pink-400/30">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-lg bg-pink-500/25 text-pink-300 flex items-center justify-center">
                <Heart size={14} className="fill-pink-300 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-white truncate">
                Pesan dari: <strong className="text-pink-300 uppercase">{broadcast.sender_name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-300">
              <span>{timeFormatted}</span>
              {soundEnabled && (
                <button
                  type="button"
                  onClick={() => playBroadcastSound('info')}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-pink-300 cursor-pointer"
                  title="Bunyikan Nada"
                >
                  <Volume2 size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Speech Bubble Body */}
          <div className="p-4 sm:p-5 bg-gradient-to-b from-pink-50/40 via-rose-50/20 to-white">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-pink-100 shadow-xs text-slate-800 text-sm sm:text-base font-bold leading-relaxed whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
              "{broadcast.message}"
            </div>

            {/* Auto Close Timer Bar with Heart Indicator */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span className="flex items-center gap-1 text-pink-600 font-semibold">
                <Heart size={12} className="fill-pink-500 text-pink-500 animate-pulse" />
                Robot menutup otomatis dalam {autoCloseTimer}s
              </span>
              <div className="w-24 bg-pink-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 transition-all duration-1000"
                  style={{ width: `${(autoCloseTimer / 25) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-4 py-2.5 bg-pink-50/50 border-t border-pink-100 flex items-center justify-end gap-2">
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReply(broadcast.sender_name);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <Reply size={13} />
                <span>Balas Pesan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Heart size={13} className="fill-white" />
              <span>Oke, Mengerti</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
