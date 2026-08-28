import { useState, useEffect, createPortal } from 'react';
import { Mail, MailOpen, Volume2, X, Reply, Sparkles, Send, CheckCircle2, Clock, User, ArrowDown, ArrowUp } from 'lucide-react';
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
  // Envelope opening state: starts closed on appear, automatically opens with realistic flap & letter lift
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (broadcast) {
      // Auto open envelope flap after gentle entrance delay
      const openTimer = setTimeout(() => {
        setIsOpen(true);
      }, 400);
      return () => clearTimeout(openTimer);
    } else {
      setIsOpen(false);
      setHasInteracted(false);
    }
  }, [broadcast]);

  if (!broadcast) return null;

  const timeFormatted = new Date(broadcast.created_at).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateFormatted = new Date(broadcast.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const toggleEnvelope = () => {
    setHasInteracted(true);
    setIsOpen(prev => !prev);
    if (!isOpen && soundEnabled) {
      playBroadcastSound('info');
    }
  };

  return typeof document !== "undefined" ? createPortal(
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg flex flex-col items-center relative pointer-events-auto select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Floating Sparkles and Postage Effects */}
        <div className="absolute -top-10 flex items-center justify-center gap-6 pointer-events-none">
          <div className="animate-pulse text-amber-300 opacity-80">
            <Sparkles size={20} className="animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="animate-bounce duration-1000 text-blue-300 opacity-70">
            <Mail size={16} />
          </div>
          <div className="animate-pulse text-amber-200 opacity-90 delay-300">
            <Sparkles size={18} />
          </div>
        </div>

        {/* Envelope & Letter Container */}
        <div className="w-full flex flex-col items-center relative">
          
          {/* Top Toggle & Status Pill */}
          <div className="mb-2 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleEnvelope}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border ${
                isOpen 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 animate-pulse'
              }`}
              title="Klik untuk membuka atau menutup amplop"
            >
              {isOpen ? (
                <>
                  <MailOpen size={14} className="text-slate-950" />
                  <span>Amplop Terbuka (Klik untuk Tutup)</span>
                  <ArrowDown size={13} />
                </>
              ) : (
                <>
                  <Mail size={14} className="text-white" />
                  <span>Amplop Tertutup (Klik untuk Buka)</span>
                  <ArrowUp size={13} />
                </>
              )}
            </button>

            {soundEnabled && (
              <button
                type="button"
                onClick={() => playBroadcastSound('info')}
                className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700 shadow-md cursor-pointer transition-colors"
                title="Bunyikan Nada Pesan"
              >
                <Volume2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-md cursor-pointer transition-colors"
              title="Tutup Jendela"
            >
              <X size={14} />
            </button>
          </div>

          {/* Realistic 3D Envelope Container with Letter Slip */}
          <div className="w-full relative flex flex-col items-center" style={{ perspective: '1200px' }}>
            
            {/* Envelope Flap (Tutup Amplop - 3D Rotatable) */}
            <div 
              onClick={toggleEnvelope}
              className="w-[92%] sm:w-[94%] h-20 sm:h-24 absolute top-0 z-20 transition-transform duration-700 ease-in-out cursor-pointer"
              style={{
                transformOrigin: 'top center',
                transformStyle: 'preserve-3d',
                transform: isOpen ? 'rotateX(180deg) translateY(-2px)' : 'rotateX(0deg)',
                zIndex: isOpen ? 10 : 25
              }}
              title="Klik tutup amplop untuk buka / tutup"
            >
              {/* Triangular Flap Outer (Visible when closed) */}
              <div 
                className="w-full h-full relative"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #172554 100%)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  borderTop: '2px solid #60a5fa'
                }}
              >
                {/* Vintage Airmail Striping Accent on edge */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-white to-blue-500 opacity-70" />
                
                {/* Wax Seal Stamp on Flap Tip */}
                <div className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 border-2 border-amber-200 shadow-lg flex items-center justify-center text-white">
                    <Send size={15} className="text-amber-100 fill-amber-100 rotate-[-20deg]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Letter Paper (Surat / Isi Pesan) that slides out of envelope */}
            <div 
              className={`w-[96%] sm:w-[98%] bg-white rounded-2xl shadow-2xl border-2 border-amber-200/80 overflow-hidden transition-all duration-700 ease-in-out z-15 ${
                isOpen 
                  ? 'translate-y-0 opacity-100 scale-100' 
                  : 'translate-y-16 opacity-40 scale-95 pointer-events-none'
              }`}
            >
              {/* Top Airmail Border Accent */}
              <div 
                className="h-2.5 w-full"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, #dc2626 0px, #dc2626 15px, #ffffff 15px, #ffffff 25px, #2563eb 25px, #2563eb 40px, #ffffff 40px, #ffffff 50px)'
                }}
              />

              {/* Letter Header */}
              <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between gap-3 border-b border-slate-700">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shrink-0 border border-amber-200">
                    <MailOpen size={16} className="text-slate-950" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Surat Siaran Logistik
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-black text-white truncate m-0 mt-0.5">
                      Pengirim: <span className="text-amber-300 uppercase">{broadcast.sender_name}</span>
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
              <div className="p-4 sm:p-5 bg-gradient-to-b from-amber-50/40 via-white to-slate-50 relative">
                
                {/* Official Postal Stamp Stamp watermark */}
                <div className="absolute right-4 top-4 border-2 border-dashed border-blue-900/20 rounded-lg p-1.5 flex flex-col items-center opacity-40 pointer-events-none rotate-6">
                  <span className="text-[8px] font-black font-mono tracking-widest text-blue-900 uppercase">PRIORITY LOGISTICS</span>
                  <span className="text-[9px] font-black text-blue-900">{dateFormatted}</span>
                </div>

                {/* Message Content */}
                <div className="p-4 sm:p-4.5 rounded-xl bg-white border border-slate-200/90 shadow-xs text-slate-800 text-sm sm:text-base font-bold leading-relaxed whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                  "{broadcast.message}"
                </div>

                {/* Status bar */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                  <span className="flex items-center gap-1.5 text-blue-800 font-bold">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Pesan Siaran Aktif • Tersinkronisasi ke Layar Anda
                  </span>
                  <button 
                    type="button" 
                    onClick={toggleEnvelope}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                  >
                    Lipat Amplop
                  </button>
                </div>
              </div>

              {/* Letter Action Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Klik tombol untuk respon
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {onReply && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onReply(broadcast.sender_name);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Reply size={13} className="text-blue-700" />
                      <span>Balas Pesan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>Oke, Mengerti</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Envelope Base Pocket (Front Facing) */}
            <div 
              onClick={toggleEnvelope}
              className="w-[92%] sm:w-[94%] h-14 sm:h-16 -mt-10 sm:-mt-12 rounded-b-2xl relative z-20 cursor-pointer shadow-2xl transition-transform active:scale-[0.99]"
              style={{
                background: 'linear-gradient(180deg, #1e40af 0%, #1e3a8a 50%, #0f172a 100%)',
                borderBottom: '2px solid #3b82f6',
                borderLeft: '2px solid #3b82f6',
                borderRight: '2px solid #3b82f6'
              }}
              title="Klik untuk membuka/menutup amplop"
            >
              {/* Diagonal Fold Lines */}
              <div 
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                  clipPath: 'polygon(0% 100%, 50% 0%, 100% 100%)',
                  background: 'linear-gradient(0deg, #60a5fa 0%, transparent 100%)'
                }}
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-mono tracking-widest text-blue-200/60 uppercase font-black">
                  LOGISTICS DISPATCH SERVICE
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  , document.body) : null;
}

// Named alias for backward compatibility and clean semantics
export const EnvelopeBroadcast = FloatingRobotBroadcast;
