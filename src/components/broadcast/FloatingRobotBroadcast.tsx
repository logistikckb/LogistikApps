import { createPortal } from 'react-dom';
import { Volume2, X, Reply, Check, Radio } from 'lucide-react';
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

export function FloatingRobotBroadcast({
  broadcast,
  onClose,
  onReply,
  soundEnabled
}: FloatingRobotBroadcastProps) {
  if (!broadcast || typeof broadcast !== 'object') return null;

  const senderName = broadcast.sender_name || broadcast.author_name || 'Pos Logistik';
  const messageText = broadcast.message || broadcast.content || broadcast.title || '';
  const timeFormatted = safeFormatTime(broadcast.created_at);

  if (typeof document === "undefined" || !document.body) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/60"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-xl border-2 border-slate-700 shadow-md overflow-hidden select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Ringan & Jelas */}
        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={16} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-amber-300 block truncate">
                PESAN SIARAN PUBLIK
              </span>
              <span className="text-[11px] text-slate-300 block truncate">
                Dari: <strong className="text-white uppercase">{senderName}</strong> • {timeFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {soundEnabled && (
              <button
                type="button"
                onClick={() => playBroadcastSound(broadcast.category || 'info')}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 cursor-pointer"
                title="Putar Suara"
                aria-label="Putar Suara"
              >
                <Volume2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 cursor-pointer"
              title="Tutup"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Isi Pesan Langsung Terbaca Tanpa Gimmick Animasi / Segel */}
        <div className="p-4 bg-white">
          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm sm:text-base font-semibold leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {messageText || '(Pesan kosong)'}
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
          {onReply && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onReply(senderName);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Reply size={14} />
              <span>Balas</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Check size={15} />
            <span>Tutup / Mengerti</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Named alias for backward compatibility
export const EnvelopeBroadcast = FloatingRobotBroadcast;

