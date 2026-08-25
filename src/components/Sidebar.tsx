import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ListTodo, X, Plus, RefreshCw, Trash2, BellRing, Volume2, ChevronLeft, Edit2, CheckCircle2, Clock, Circle, Save, Flame, Zap, AlertCircle, Sparkles } from 'lucide-react';
import { TodoData, TodoPriority } from '../types';
import { useNotification } from '../context/NotificationContext';
import { InstallPwaButton } from './common/InstallPwaButton';

interface SidebarProps {
  todos: TodoData[];
  loading: boolean;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onAddTodo: (task: string, priority?: TodoPriority, isBlinking?: boolean) => void;
  onUpdateStatus: (id: string, status: TodoData['status']) => void;
  onUpdateTodo?: (id: string, updates: Partial<Omit<TodoData, 'id'>>) => void;
  onDeleteTodo: (id: string) => void;
  onDeleteCompletedTodos?: () => void;
  onRefresh: () => void;
}

const STATUS_CYCLE: TodoData['status'][] = ['no', 'onproses', 'close'];

export function Sidebar({ todos, loading, isAdmin, isOpen, onToggle, onAddTodo, onUpdateStatus, onUpdateTodo, onDeleteTodo, onDeleteCompletedTodos, onRefresh }: SidebarProps) {
  const { showConfirm, showToast } = useNotification();
  // Filter tab: 'all' | 'priority' | 'no' | 'onproses' | 'close'
  const [filter, setFilter] = useState<'all' | 'priority' | 'no' | 'onproses' | 'close'>('no');
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('rendah');
  const [newIsBlinking, setNewIsBlinking] = useState(false);

  const [reminderActive, setReminderActive] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  // Modal untuk Edit/View Detail Tugas
  const [editingTodo, setEditingTodo] = useState<TodoData | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<TodoData['status']>('no');
  const [editTaskPriority, setEditTaskPriority] = useState<TodoPriority>('rendah');
  const [editTaskBlinking, setEditTaskBlinking] = useState(false);

  const filteredTodos = todos.filter(t => {
    if (filter === 'priority') return t.priority === 'mendesak' || t.priority === 'tinggi' || t.is_blinking;
    if (filter === 'all') return true;
    return t.status === filter;
  }).sort((a, b) => {
    // Blinking or Urgent priority items sorted to top
    const aWeight = (a.is_blinking || a.priority === 'mendesak') ? 3 : (a.priority === 'tinggi' ? 2 : (a.priority === 'sedang' ? 1 : 0));
    const bWeight = (b.is_blinking || b.priority === 'mendesak') ? 3 : (b.priority === 'tinggi' ? 2 : (b.priority === 'sedang' ? 1 : 0));
    return bWeight - aWeight;
  });
  
  const no = todos.filter(t => t.status === 'no').length;
  const onproses = todos.filter(t => t.status === 'onproses').length;
  const close = todos.filter(t => t.status === 'close').length;
  const priorityCount = todos.filter(t => (t.priority === 'mendesak' || t.priority === 'tinggi' || t.is_blinking) && t.status !== 'close').length;
  const pendingCount = no + onproses;

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const notes = [659.25, 880.00, 1174.66];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const startTime = ctx.currentTime + index * 0.2;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.55);
      });
    } catch (e) {
      console.error("Gagal memutar audio todo chime:", e);
    }
  };

  const handleTestReminder = () => {
    playChime();
    setReminderActive(true);
    setShowReminderModal(true);
    setTimeout(() => setReminderActive(false), 3000);
  };

  const handleAdd = () => {
    if (!newTask.trim()) {
      showToast('Perhatian', 'Silakan ketik isi tugas terlebih dahulu', 'warning');
      return;
    }
    onAddTodo(newTask.trim(), newPriority, newIsBlinking || newPriority === 'mendesak');
    showToast('Tersimpan', 'Tugas baru berhasil ditambahkan', 'success');
    setNewTask('');
    setNewPriority('rendah');
    setNewIsBlinking(false);
    setShowFormModal(false);
  };

  const cycleStatus = (todo: TodoData) => {
    const idx = STATUS_CYCLE.indexOf(todo.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onUpdateStatus(todo.id, next);
  };

  const handleOpenEditModal = (todo: TodoData) => {
    setEditingTodo(todo);
    setEditTaskText(todo.task);
    setEditTaskStatus(todo.status);
    setEditTaskPriority(todo.priority || 'rendah');
    setEditTaskBlinking(!!todo.is_blinking);
  };

  const handleSaveEdit = () => {
    if (!editingTodo) return;
    if (!editTaskText.trim()) {
      showToast('Perhatian', 'Isi tugas tidak boleh kosong', 'warning');
      return;
    }
    if (onUpdateTodo) {
      onUpdateTodo(editingTodo.id, { 
        task: editTaskText.trim(), 
        status: editTaskStatus,
        priority: editTaskPriority,
        is_blinking: editTaskBlinking || editTaskPriority === 'mendesak'
      });
    } else {
      onUpdateStatus(editingTodo.id, editTaskStatus);
    }
    showToast('Tersimpan', 'Tugas berhasil diperbarui', 'success');
    setEditingTodo(null);
  };

  const renderPriorityBadge = (priority?: TodoPriority, isBlinking?: boolean) => {
    const isMendesak = priority === 'mendesak' || isBlinking;
    if (isMendesak) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border border-red-500 animate-badge-blink cursor-pointer shadow-sm">
          <Zap size={11} className="fill-current animate-bounce shrink-0" />
          <span>KEDIP MENDESAK</span>
        </span>
      );
    }
    if (priority === 'tinggi') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase bg-amber-500 text-white border border-amber-600 shadow-2xs">
          <Flame size={11} className="fill-current shrink-0" />
          <span>PRIORITAS TINGGI</span>
        </span>
      );
    }
    if (priority === 'sedang') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase bg-blue-600 text-white border border-blue-700 shadow-2xs">
          <AlertCircle size={11} className="shrink-0" />
          <span>PRIORITAS SEDANG</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase bg-slate-200/90 text-slate-600 border border-slate-300">
        <span>BIASA</span>
      </span>
    );
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-[85] lg:hidden transition-opacity duration-300 cursor-pointer"
          onClick={onToggle}
          title="Klik untuk menutup Todo sidebar"
        />
      )}
      <div 
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[380px] lg:w-[360px] xl:w-[380px] bg-white/70 backdrop-blur-xl border-l border-white/40 flex flex-col transition-transform duration-400 ease-in-out z-[90] shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-white/40 bg-white/40">
          <h5 className="m-0 font-bold text-slate-800 flex items-center gap-2.5 text-base">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-600 flex items-center justify-center border border-orange-500/30 shadow-sm"><ListTodo size={18} /></div> 
            Public Todo
          </h5>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleTestReminder}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                reminderActive 
                  ? 'bg-orange-500 text-white border-orange-600 scale-105 shadow-md' 
                  : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 border-orange-500/30'
              }`}
              title="Bunyikan Nada Pengingat Todo"
            >
              <BellRing size={13} className={reminderActive ? 'animate-bounce' : ''} />
              <span>{pendingCount} Pending</span>
            </button>

            <button onClick={onToggle} className="w-9 h-9 rounded-xl bg-white/50 flex items-center justify-center text-slate-600 hover:text-slate-900 border border-white/60 shadow-sm hover:scale-105 transition-all cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards - Included Priority Filter Badge */}
        <div className="grid grid-cols-4 p-3 sm:p-4 border-b border-white/40 gap-1.5 bg-transparent">
          <div 
            onClick={() => setFilter('priority')}
            className={`rounded-xl border shadow-2xs p-2 text-center cursor-pointer transition-all ${filter === 'priority' ? 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500 animate-badge-blink' : 'bg-red-500/10 border-red-500/30'}`}
            title="Filter Tugas Prioritas / Kedip"
          >
            <div className="text-base font-black text-red-700 leading-tight flex items-center justify-center gap-1">
              <Zap size={13} className="text-red-600 fill-current animate-bounce" /> {priorityCount}
            </div>
            <div className="font-bold text-[8px] text-red-700 tracking-wider mt-0.5 uppercase">Kedip</div>
          </div>

          <div 
            onClick={() => setFilter('no')}
            className={`rounded-xl border shadow-2xs p-2 text-center cursor-pointer transition-all ${filter === 'no' ? 'bg-orange-500/15 border-orange-500/40 ring-2 ring-orange-400' : 'bg-white/50 border-white/60'}`}
          >
            <div className="text-base font-black text-slate-800 leading-tight">{no}</div>
            <div className="font-bold text-[8px] text-slate-600 tracking-wider mt-0.5 uppercase">Todo</div>
          </div>

          <div 
            onClick={() => setFilter('onproses')}
            className={`rounded-xl border shadow-2xs p-2 text-center cursor-pointer transition-all ${filter === 'onproses' ? 'bg-blue-900/20 border-blue-900/40 ring-2 ring-blue-800' : 'bg-blue-900/10 border-blue-900/20'}`}
          >
            <div className="text-base font-black text-blue-900 leading-tight">{onproses}</div>
            <div className="font-bold text-[8px] text-blue-900 tracking-wider mt-0.5 uppercase">Proses</div>
          </div>

          <div 
            onClick={() => setFilter('close')}
            className={`rounded-xl border shadow-2xs p-2 text-center cursor-pointer transition-all ${filter === 'close' ? 'bg-emerald-500/25 border-emerald-500/40 ring-2 ring-emerald-500' : 'bg-emerald-500/10 border-emerald-500/20'}`}
          >
            <div className="text-base font-black text-emerald-700 leading-tight">{close}</div>
            <div className="font-bold text-[8px] text-emerald-600 tracking-wider mt-0.5 uppercase">Done</div>
          </div>
        </div>

        {/* Action Bar: Tombol Tambah Tugas + Filter Buttons */}
        <div className="px-4 py-3 border-b border-white/40 flex flex-col gap-2.5 bg-white/30">
          <button 
            onClick={() => setShowFormModal(true)} 
            className="glass-btn !bg-orange-500 hover:!bg-orange-600 !text-white !rounded-xl !py-2.5 !px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Plus size={16} /> Tambah Tugas Baru
          </button>

          <div className="flex justify-between items-center gap-1 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilter('all')} className={`glass-btn !py-1 !px-2 !rounded-lg text-[10px] ${filter === 'all' ? '!bg-slate-800 !text-white' : ''}`}>Semua</button>
              <button onClick={() => setFilter('priority')} className={`glass-btn !py-1 !px-2 !rounded-lg text-[10px] flex items-center gap-1 ${filter === 'priority' ? '!bg-red-600 !text-white' : '!bg-red-50 !text-red-700 !border-red-200'}`}>
                <Zap size={11} className={filter === 'priority' ? 'fill-white' : 'text-red-600'} /> Kedip ({priorityCount})
              </button>
              <button onClick={() => setFilter('no')} className={`glass-btn !py-1 !px-2 !rounded-lg text-[10px] ${filter === 'no' ? '!bg-orange-600 !text-white' : ''}`}>Todo</button>
              <button onClick={() => setFilter('onproses')} className={`glass-btn !py-1 !px-2 !rounded-lg text-[10px] ${filter === 'onproses' ? '!bg-blue-900 !text-white' : ''}`}>Proses</button>
              <button onClick={() => setFilter('close')} className={`glass-btn !py-1 !px-2 !rounded-lg text-[10px] ${filter === 'close' ? '!bg-emerald-600 !text-white' : ''}`}>Done ({close})</button>
            </div>
            
            <div className="flex gap-1.5 items-center">
              {isAdmin && close > 0 && onDeleteCompletedTodos && (
                <button 
                  onClick={() => {
                    showConfirm({
                      title: 'Hapus Tugas Selesai',
                      message: `Hapus masal ${close} tugas yang sudah berstatus Done/Selesai?`,
                      confirmText: 'Hapus Selesai',
                      cancelText: 'Batal',
                      type: 'danger',
                      onConfirm: async () => {
                        await onDeleteCompletedTodos();
                        showToast('Selesai', 'Tugas selesai berhasil dibersihkan', 'info');
                      }
                    });
                  }}
                  title="Hapus masal semua tugas yang sudah selesai (Done)"
                  className="glass-btn !bg-red-500/10 hover:!bg-red-500/20 !text-red-600 !py-1 !px-2 !rounded-lg flex items-center gap-1 text-[10px] font-bold border border-red-500/20"
                >
                  <Trash2 size={12} />
                  <span>Hapus</span>
                </button>
              )}
              <button onClick={onRefresh} className="glass-btn !p-1.5 !rounded-lg" title="Refresh">
                <RefreshCw size={14} className={loading ? 'animate-spin text-blue-900' : 'text-slate-600'} />
              </button>
            </div>
          </div>
        </div>

        {/* List Task - Includes Blinking Color Animation */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-transparent custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 font-bold text-slate-500 text-xs">Memuat Daftar Tugas...</div>
          ) : filteredTodos.length === 0 ? (
            <div className="text-center py-8 font-medium text-slate-500 text-xs">
              {filter === 'priority' ? 'Tidak ada tugas berprioritas tinggi / kedip.' : (filter === 'no' ? 'Tidak ada tugas Todo.' : (filter === 'onproses' ? 'Tidak ada tugas Proses.' : (filter === 'close' ? 'Tidak ada tugas Done.' : 'Belum ada tugas.')))}
            </div>
          ) : (
            filteredTodos.map(t => {
              const isDone = t.status === 'close';
              const isProses = t.status === 'onproses';
              const isTodo = t.status === 'no';
              const isBlinkingActive = (t.priority === 'mendesak' || t.is_blinking) && !isDone;

              return (
                <div 
                  key={t.id} 
                  className={`glass-box p-3.5 mb-3 flex flex-col gap-2.5 transition-all border shadow-2xs relative overflow-hidden ${
                    isBlinkingActive 
                      ? 'animate-todo-blink' 
                      : (isDone 
                          ? 'opacity-70 bg-emerald-50/20 border-white/60' 
                          : 'bg-white/50 hover:bg-white/80 border-white/60'
                        )
                  }`}
                >
                  {/* Top Bar Card: Priority Badge & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div onClick={() => handleOpenEditModal(t)} className="cursor-pointer">
                      {renderPriorityBadge(t.priority, t.is_blinking)}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(t)}
                        className="p-1 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-100/60 transition-all cursor-pointer"
                        title="Edit / Detail Tugas"
                      >
                        <Edit2 size={13} />
                      </button>

                      {isAdmin && (
                        <button 
                          onClick={() => {
                            showConfirm({
                              title: 'Hapus Tugas',
                              message: 'Apakah Anda yakin ingin menghapus tugas ini?',
                              confirmText: 'Hapus',
                              cancelText: 'Batal',
                              type: 'danger',
                              onConfirm: () => {
                                onDeleteTodo(t.id);
                                showToast('Dihapus', 'Tugas berhasil dihapus', 'info');
                              }
                            });
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-100/60 transition-all cursor-pointer"
                          title="Hapus tugas ini"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task Content */}
                  <div 
                    onClick={() => handleOpenEditModal(t)}
                    className={`font-semibold text-xs leading-relaxed whitespace-pre-wrap break-words cursor-pointer hover:text-orange-700 transition-colors ${
                      isDone ? 'line-through text-slate-500' : (isBlinkingActive ? 'animate-text-blink font-bold' : 'text-slate-800')
                    }`}
                    title="Klik untuk lihat / edit tugas"
                  >
                    {t.task}
                  </div>

                  {/* Bottom Bar: Status Choice & Quick Priority Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 flex-wrap gap-1">
                    {/* Quick Priority Switcher */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextPriority: TodoPriority = 
                            t.priority === 'rendah' ? 'sedang' :
                            t.priority === 'sedang' ? 'tinggi' :
                            t.priority === 'tinggi' ? 'mendesak' : 'rendah';
                          const isBlink = nextPriority === 'mendesak';
                          if (onUpdateTodo) {
                            onUpdateTodo(t.id, { priority: nextPriority, is_blinking: isBlink });
                          }
                        }}
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition-all cursor-pointer flex items-center gap-0.5"
                        title="Klik untuk putar Prioritas (Biasa -> Sedang -> Tinggi -> Mendesak)"
                      >
                        <Sparkles size={10} className="text-orange-500" />
                        <span>Ganti Prioritas</span>
                      </button>
                    </div>

                    {/* 3 Choice Status Selector */}
                    <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                      <button
                        onClick={() => onUpdateStatus(t.id, 'no')}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isTodo 
                            ? 'bg-orange-500 text-white shadow-2xs scale-105' 
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                        title="Ubah status ke Todo"
                      >
                        <Circle size={10} className={isTodo ? 'fill-white' : ''} />
                        <span>Todo</span>
                      </button>

                      <button
                        onClick={() => onUpdateStatus(t.id, 'onproses')}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isProses 
                            ? 'bg-blue-900 text-white shadow-2xs scale-105' 
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                        title="Ubah status ke Proses"
                      >
                        <Clock size={10} />
                        <span>Proses</span>
                      </button>

                      <button
                        onClick={() => onUpdateStatus(t.id, 'close')}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isDone 
                            ? 'bg-emerald-600 text-white shadow-2xs scale-105' 
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                        title="Ubah status ke Done (Selesai)"
                      >
                        <CheckCircle2 size={10} />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer with Install PWA Button */}
        <div className="p-3 border-t border-white/40 bg-white/40">
          <InstallPwaButton variant="sidebar" />
        </div>
      </div>

      {/* Modal Form Edit/Detail Tugas Public */}
      {editingTodo && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-box !bg-white/95 p-6 sm:p-7 rounded-3xl max-w-md w-full shadow-2xl border border-orange-400 relative overflow-hidden text-left">
            <button 
              onClick={() => setEditingTodo(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                <Edit2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 m-0">Detail & Edit Tugas</h3>
                <p className="text-xs text-slate-500 m-0">Publik dapat mengedit isi, prioritas, dan status tugas</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Isi / Deskripsi Tugas:</label>
                <textarea 
                  rows={4}
                  value={editTaskText}
                  onChange={(e) => setEditTaskText(e.target.value)}
                  placeholder="Ketik detail tugas..."
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-orange-400 outline-none transition-all shadow-inner placeholder:text-slate-400 resize-y min-h-[90px]"
                />
              </div>

              {/* Priority Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Tingkat Prioritas Tugas:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTaskPriority('rendah');
                      setEditTaskBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskPriority === 'rendah'
                        ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-bold">Biasa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTaskPriority('sedang');
                      setEditTaskBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskPriority === 'sedang'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertCircle size={14} />
                    <span className="text-xs font-bold">Sedang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTaskPriority('tinggi');
                      setEditTaskBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskPriority === 'tinggi'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Flame size={14} />
                    <span className="text-xs font-bold">Tinggi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTaskPriority('mendesak');
                      setEditTaskBlinking(true);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskPriority === 'mendesak'
                        ? 'bg-red-600 text-white border-red-700 shadow-sm animate-badge-blink'
                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <Zap size={14} className="fill-current" />
                    <span className="text-[10px] font-black uppercase">Mendesak</span>
                  </button>
                </div>
              </div>

              {/* Blinking Toggle Option */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-orange-500/10 border border-orange-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-badge-blink">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Animasi Kedip-Kedip Warna</div>
                    <div className="text-[10px] text-slate-500">Tandai todo dengan warna berkedip terang</div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editTaskBlinking} 
                    onChange={(e) => {
                      setEditTaskBlinking(e.target.checked);
                      if (e.target.checked && editTaskPriority === 'rendah') {
                        setEditTaskPriority('mendesak');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Status Tugas:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTaskStatus('no')}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskStatus === 'no'
                        ? 'bg-orange-500/10 border-orange-500 text-orange-800 ring-2 ring-orange-300/60 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Circle size={18} className={editTaskStatus === 'no' ? 'text-orange-600 fill-orange-500' : 'text-slate-400'} />
                    <span className="text-xs font-bold">Todo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditTaskStatus('onproses')}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskStatus === 'onproses'
                        ? 'bg-blue-900/10 border-blue-900 text-blue-950 ring-2 ring-blue-300/60 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Clock size={18} className={editTaskStatus === 'onproses' ? 'text-blue-900' : 'text-slate-400'} />
                    <span className="text-xs font-bold">Proses</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditTaskStatus('close')}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      editTaskStatus === 'close'
                        ? 'bg-emerald-500/15 border-emerald-600 text-emerald-900 ring-2 ring-emerald-300/60 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 size={18} className={editTaskStatus === 'close' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-xs font-bold">Done</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      showConfirm({
                        title: 'Hapus Tugas',
                        message: 'Apakah Anda yakin ingin menghapus tugas ini?',
                        confirmText: 'Hapus',
                        cancelText: 'Batal',
                        type: 'danger',
                        onConfirm: () => {
                          onDeleteTodo(editingTodo.id);
                          setEditingTodo(null);
                          showToast('Dihapus', 'Tugas berhasil dihapus', 'info');
                        }
                      });
                    }}
                    className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-red-200"
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setEditingTodo(null)}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={15} /> Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Tambah Tugas Baru */}
      {showFormModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-box !bg-white/95 p-6 sm:p-7 rounded-3xl max-w-md w-full shadow-2xl border border-orange-400 relative overflow-hidden text-left">
            <button 
              onClick={() => setShowFormModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md">
                <Plus size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 m-0">Tambah Tugas Baru</h3>
                <p className="text-xs text-slate-500 m-0">Ketik rincian tugas & atur tanda prioritas kedip</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Tugas / Catatan:</label>
                <textarea 
                  rows={3}
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Ketik tugas di sini... Contoh: Kirim Dokumen Surat Jalan Urgent"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-orange-400 outline-none transition-all shadow-inner placeholder:text-slate-400 resize-y min-h-[80px]"
                  autoFocus
                />
              </div>

              {/* Priority Selection Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanda Prioritas:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPriority('rendah');
                      setNewIsBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      newPriority === 'rendah'
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-bold">Biasa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPriority('sedang');
                      setNewIsBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      newPriority === 'sedang'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-bold">Sedang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPriority('tinggi');
                      setNewIsBlinking(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      newPriority === 'tinggi'
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-bold">Tinggi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPriority('mendesak');
                      setNewIsBlinking(true);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      newPriority === 'mendesak'
                        ? 'bg-red-600 text-white border-red-700 animate-badge-blink'
                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <Zap size={13} className="fill-current" />
                    <span className="text-[10px] font-black uppercase">Kedip</span>
                  </button>
                </div>
              </div>

              {/* Blinking Toggle Switch */}
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-red-600 shrink-0 animate-bounce" />
                  <span className="text-xs font-bold text-slate-800">Animasi Kedip Warna</span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newIsBlinking} 
                    onChange={(e) => {
                      setNewIsBlinking(e.target.checked);
                      if (e.target.checked && newPriority === 'rendah') {
                        setNewPriority('mendesak');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleAdd}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={16} /> Simpan Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal Pengingat Todo Aktif dari Lonceng */}
      {showReminderModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-box !bg-white/95 p-6 sm:p-7 rounded-3xl max-w-lg w-full shadow-2xl border border-orange-400 relative overflow-hidden text-left">
            <button 
              onClick={() => setShowReminderModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg animate-bounce">
              <BellRing size={28} />
            </div>

            <div className="text-center mb-4">
              <span className="text-[10px] font-bold tracking-wider text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-300 inline-block mb-1">
                Pengingat Todo Aktif
              </span>
              <h3 className="text-lg font-bold text-slate-800 m-0">
                {pendingCount > 0 ? `Ada ${pendingCount} Tugas Pending` : 'Semua Tugas Selesai'}
              </h3>
              <p className="text-xs text-slate-600 mt-1 m-0">
                Bunyi pengingat aktif. Tambah tugas baru atau lihat daftar tugas Anda:
              </p>
            </div>

            {/* Quick Form Tambah Task */}
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="+ Tambah tugas pengingat cepat..." 
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
                className="glass-input flex-1 !text-xs !py-2.5 !px-3"
              />
              <button 
                onClick={handleAdd}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
              >
                Tambah
              </button>
            </div>

            {/* List Tugas Pending */}
            <div className="max-h-52 overflow-y-auto my-3 space-y-2 pr-1 custom-scrollbar">
              {todos.filter(t => t.status !== 'close').length === 0 ? (
                <div className="text-center py-6 text-emerald-600 font-bold text-xs bg-emerald-50 rounded-xl border border-emerald-200">
                  🎉 Tidak ada tugas pending saat ini.
                </div>
              ) : (
                todos.filter(t => t.status !== 'close').map(t => (
                  <div key={t.id} className={`p-3 rounded-xl flex items-center justify-between gap-2 border ${
                    t.is_blinking || t.priority === 'mendesak' ? 'animate-todo-blink' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button 
                        onClick={() => cycleStatus(t)}
                        className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border font-bold text-[10px] transition-all ${
                          t.status === 'onproses' 
                            ? 'bg-blue-900 text-white border-blue-900' 
                            : 'bg-white text-orange-500 border-orange-400 hover:bg-orange-50'
                        }`}
                        title="Klik untuk ubah status"
                      >
                        {t.status === 'onproses' ? 'P' : 'T'}
                      </button>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-slate-800 font-medium leading-relaxed break-words">
                          {t.task}
                        </span>
                        <div>{renderPriorityBadge(t.priority, t.is_blinking)}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      t.status === 'onproses' ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-orange-100 text-orange-700 border-orange-300'
                    }`}>
                      {t.status === 'onproses' ? 'Proses' : 'Todo'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2.5 justify-center mt-5">
              <button 
                onClick={playChime}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Volume2 size={15} /> Bunyikan Nada
              </button>
              <button 
                onClick={() => setShowReminderModal(false)}
                className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      <div 
        className={`fixed top-3 sm:top-4 right-0 z-[95] transition-all duration-300 ${isOpen ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0'}`}
      >
        <button 
          onClick={onToggle}
          className="glass-box !bg-orange-500/90 hover:!bg-orange-600 backdrop-blur-md text-white !rounded-l-xl !rounded-r-none border-r-0 px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg transition-all hover:pl-3 cursor-pointer group"
          title="Buka Public Todo"
        >
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
          <ListTodo size={15} />
          <span className="text-xs font-bold pr-1">Todo</span>
          {priorityCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" title={`${priorityCount} Tugas Kedip`} />
          )}
        </button>
      </div>
    </>
  );
}
