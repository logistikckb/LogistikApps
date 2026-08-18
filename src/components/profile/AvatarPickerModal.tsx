import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { AVATAR_PRESETS } from '../../data/avatarPresets';
import { 
  X, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  RefreshCw,
  Layers
} from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvatarPickerModal({ isOpen, onClose }: AvatarPickerModalProps) {
  const { currentUser, updateMyAvatar } = useAuth();
  const { showToast } = useNotification();
  
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser?.avatar || AVATAR_PRESETS[0].url);
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const categories = ['Semua', 'Role & Jabatan', 'Spesialis Logistik', 'Karakter & Warna'];

  const filteredPresets = activeCategory === 'Semua' 
    ? AVATAR_PRESETS 
    : AVATAR_PRESETS.filter((p) => p.category === activeCategory);

  const handleSaveAvatar = async (url: string) => {
    setSelectedAvatar(url);
    setIsSaving(true);
    try {
      const res = await updateMyAvatar(url);
      if (res.success) {
        showToast('Avatar Diperbarui', 'Foto profil avatar baru Anda berhasil disimpan!', 'success');
        onClose();
      } else {
        showToast('Gagal', res.message || 'Gagal memperbarui avatar', 'error');
      }
    } catch {
      showToast('Error', 'Terjadi gangguan saat menyimpan avatar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return typeof document !== "undefined" ? createPortal(
    <div 
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="glass-box !bg-white/95 p-5 sm:p-7 rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-400/80 relative overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Decorative Accents */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all z-20 cursor-pointer"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 m-0 uppercase tracking-tight flex items-center gap-2">
              Pilih Avatar Profil Ringan
            </h2>
            <p className="text-xs text-slate-500 m-0 font-medium">
              Pilih dari koleksi avatar vektor instan tanpa perlu URL foto eksternal
            </p>
          </div>
        </div>

        {/* Current Avatar Preview Box */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-800 text-white flex items-center justify-between gap-3 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <img 
              src={selectedAvatar || currentUser?.avatar || AVATAR_PRESETS[0].url} 
              alt="Preview Avatar"
              className="w-12 h-12 rounded-2xl object-cover border-2 border-white/80 shadow-md bg-white shrink-0"
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                Avatar Aktif ({currentUser?.nama})
              </div>
              <div className="text-xs font-black">
                Klik salah satu avatar di bawah untuk langsung menerapkan
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-xl border border-white/20">
            <Layers size={13} />
            <span>Format Vektor Ringan</span>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Avatar Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {filteredPresets.map((preset) => {
            const isCurrent = (currentUser?.avatar === preset.url) || (selectedAvatar === preset.url);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSaveAvatar(preset.url)}
                disabled={isSaving}
                className={`p-3 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2 group cursor-pointer relative overflow-hidden ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-400/40'
                    : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-md'
                }`}
              >
                {/* Active Selection Badge */}
                {isCurrent && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}

                <img 
                  src={preset.url} 
                  alt={preset.name}
                  className="w-14 h-14 rounded-2xl object-cover shadow-xs group-hover:scale-105 transition-transform"
                />

                <div className="w-full">
                  <div className="text-[11px] font-black text-slate-800 line-clamp-1 group-hover:text-blue-900">
                    {preset.name}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    {preset.category}
                  </div>
                </div>

                <div className={`w-full py-1 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 ${
                  isCurrent
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-blue-900 group-hover:text-white'
                }`}>
                  {isCurrent ? (
                    <>
                      <CheckCircle2 size={11} />
                      <span>Dipakai</span>
                    </>
                  ) : (
                    <span>Pilih Avatar</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info & cancel */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">
            Avatar berbasis grafik vektor aman, tidak membebani memori, & langsung tersimpan ke akun Anda.
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer shrink-0 ml-2"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  , document.body) : null;
}
