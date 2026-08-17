import { useState, useEffect } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { LinkData } from '../types';
import { useNotification } from '../context/NotificationContext';

interface LinkModalProps {
  link: LinkData | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (data: Omit<LinkData, 'id'>) => Promise<void>;
}

const ICON_LIST = [
  'fas fa-link', 'fas fa-box', 'fas fa-truck', 'fas fa-file-invoice', 'fas fa-chart-line',
  'fas fa-users', 'fas fa-cogs', 'fas fa-database', 'fas fa-shield-alt', 'fas fa-envelope',
  'fas fa-calendar', 'fas fa-calculator', 'fas fa-camera', 'fas fa-clock', 'fas fa-cloud',
  'fas fa-comments', 'fas fa-credit-card', 'fas fa-desktop', 'fas fa-folder', 'fas fa-globe',
  'fas fa-heart', 'fas fa-home', 'fas fa-image', 'fas fa-key', 'fas fa-lock',
  'fas fa-map-marker-alt', 'fas fa-music', 'fas fa-paper-plane', 'fas fa-phone', 'fas fa-shopping-cart',
  'fas fa-star', 'fas fa-tag', 'fas fa-user', 'fas fa-video', 'fas fa-wrench',
  'fas fa-chart-bar', 'fas fa-chart-pie', 'fas fa-clipboard', 'fas fa-clipboard-list', 'fas fa-clipboard-check',
  'fas fa-box-open', 'fas fa-boxes', 'fas fa-dolly', 'fas fa-pallet', 'fas fa-warehouse',
  'fas fa-money-bill-wave', 'fas fa-wallet', 'fas fa-receipt', 'fas fa-file-alt', 'fas fa-file-pdf',
  'fas fa-file-excel', 'fas fa-file-word', 'fas fa-folder-open', 'fas fa-sitemap', 'fas fa-network-wired',
  'fas fa-server', 'fas fa-microchip', 'fas fa-laptop-code', 'fas fa-terminal', 'fas fa-code',
  'fas fa-bug', 'fas fa-check-circle', 'fas fa-times-circle', 'fas fa-exclamation-circle', 'fas fa-info-circle',
  'fas fa-question-circle', 'fas fa-flag', 'fas fa-bookmark', 'fas fa-thumbtack', 'fas fa-paperclip',
  'fas fa-list', 'fas fa-list-check', 'fas fa-table', 'fas fa-th', 'fas fa-grid',
  'fas fa-download', 'fas fa-upload', 'fas fa-share', 'fas fa-sync', 'fas fa-refresh',
  'fas fa-search', 'fas fa-filter', 'fas fa-sort', 'fas fa-eye', 'fas fa-eye-slash',
  'fas fa-plus', 'fas fa-minus', 'fas fa-edit', 'fas fa-trash', 'fas fa-pen',
  'fas fa-paint-brush', 'fas fa-palette', 'fas fa-magic', 'fas fa-wand-magic-sparkles', 'fas fa-lightbulb',
  'fas fa-graduation-cap', 'fas fa-book', 'fas fa-newspaper', 'fas fa-award', 'fas fa-trophy',
  'fas fa-handshake', 'fas fa-hand-holding', 'fas fa-gift', 'fas fa-puzzle-piece', 'fas fa-plug',
  'fas fa-battery-full', 'fas fa-gas-pump', 'fas fa-oil-can', 'fas fa-car', 'fas fa-bicycle',
  'fas fa-anchor', 'fas fa-life-ring', 'fas fa-fire', 'fas fa-snowflake', 'fas fa-sun',
  'fas fa-moon', 'fas fa-tree', 'fas fa-leaf', 'fas fa-seedling', 'fas fa-recycle'
];

export function LinkModal({ link, existingCategories, onClose, onSave }: LinkModalProps) {
  const { showToast } = useNotification();
  const [title, setTitle] = useState(link?.title || '');
  const [url, setUrl] = useState(link?.url || '');
  const [category, setCategory] = useState(link?.category || '');
  const [newCategory, setNewCategory] = useState('');
  const [subcategory, setSubcategory] = useState(link?.subcategory || '');
  const [icon, setIcon] = useState(link?.icon || 'fas fa-link');
  const [iconSearch, setIconSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (link && !existingCategories.includes(link.category)) {
      setCategory('__NEW__');
      setNewCategory(link.category);
    }
  }, [link, existingCategories]);

  const handleSave = async () => {
    if (!title || !url) {
      return showToast('Data Tidak Lengkap', 'Judul Aplikasi dan Target URL wajib diisi', 'warning');
    }
    const finalCat = category === '__NEW__' ? newCategory : category;
    if (!finalCat) {
      return showToast('Data Tidak Lengkap', 'Kategori wajib dipilih atau diisi', 'warning');
    }
    setLoading(true);
    await onSave({
      title,
      url,
      category: finalCat.toUpperCase(),
      subcategory,
      icon
    });
    showToast('Tersimpan', link ? 'Aplikasi berhasil diperbarui' : 'Aplikasi baru berhasil ditambahkan', 'success');
    setLoading(false);
  };

  const filteredIcons = ICON_LIST.filter(i => i.includes(iconSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[1055] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="glass-box rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="border-b border-white/40 px-6 py-5 bg-white/40 flex justify-between items-center shrink-0">
          <h5 className="font-extrabold text-slate-800 flex items-center gap-3 m-0 text-lg uppercase drop-shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-600 flex items-center justify-center border border-orange-500/30 shadow-sm">
              {link ? <Edit size={20} /> : <PlusCircle size={20} />}
            </div>
            {link ? 'Edit Link' : 'Create New Link'}
          </h5>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 font-black text-xl transition-transform cursor-pointer">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto min-h-0 flex-1 custom-scrollbar bg-white/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-[11px] font-bold text-blue-900 uppercase tracking-widest mb-2 block">Application Title</label>
              <input 
                type="text" 
                value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-800 outline-none transition-all shadow-sm placeholder:text-slate-400" 
                placeholder="e.g. Inventory System" 
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-blue-900 uppercase tracking-widest mb-2 block">Target URL</label>
              <input 
                type="url" 
                value={url} onChange={e => setUrl(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-800 outline-none transition-all shadow-sm placeholder:text-slate-400" 
                placeholder="https://..." 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-2 block">Category</label>
              <select 
                value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-orange-400 outline-none transition-all shadow-sm cursor-pointer"
              >
                <option value="">-- Select Category --</option>
                {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__NEW__">+ Add New Category</option>
              </select>
              {category === '__NEW__' && (
                <input 
                  type="text" 
                  value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full mt-4 bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-orange-400 outline-none transition-all shadow-sm placeholder:text-slate-400" 
                  placeholder="Type new category..." 
                />
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-2 block">Sub Category</label>
              <input 
                type="text" 
                value={subcategory} onChange={e => setSubcategory(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-400" 
                placeholder="e.g. Asset Management" 
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Select Icon</label>
            
            <div className="flex items-center gap-3 px-4 py-3 border border-indigo-500/30 rounded-xl bg-indigo-500/10 mb-4 text-indigo-600 shadow-sm">
              <i className={`${icon} text-2xl drop-shadow-sm`} />
              <span className="font-bold text-sm tracking-wide">{icon}</span>
            </div>
            
            <input 
              type="text" 
              value={iconSearch} onChange={e => setIconSearch(e.target.value)}
              className="w-full bg-white/60 text-slate-800 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-sky-400 outline-none transition-all mb-4 shadow-sm placeholder:text-slate-400" 
              placeholder="Search icons..." 
            />
            
            <div className="bg-white/40 border border-white/60 rounded-2xl h-[180px] overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-3 custom-scrollbar shadow-inner">
              {filteredIcons.map(i => (
                <div 
                  key={i} 
                  onClick={() => setIcon(i)}
                  className={`w-[48px] h-[48px] rounded-xl flex items-center justify-center border cursor-pointer text-[1.4rem] transition-all shadow-sm
                    ${icon === i ? 'border-orange-500/50 bg-orange-500/20 text-orange-600' : 'border-white/60 bg-white/60 text-slate-600 hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/30 hover:-translate-y-1'}`}
                  title={i}
                >
                  <i className={i} />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/40 px-6 py-5 bg-white/40 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="glass-btn !bg-white/60">CANCEL</button>
          <button onClick={handleSave} disabled={loading} className="glass-btn !bg-blue-900 text-white hover:!bg-blue-800 border-blue-800">
            {loading ? 'SAVING...' : 'SAVE DATA'}
          </button>
        </div>
      </div>
    </div>
  );
}
