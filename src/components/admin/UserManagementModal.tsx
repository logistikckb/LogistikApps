import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { UserProfile, UserRole, UserStatus } from '../../types';
import { AVATAR_PRESETS, DEFAULT_AVATAR } from '../../data/avatarPresets';
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  KeyRound,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Plus,
  Save,
  Check,
  Eye,
  EyeOff,
  UserX,
  UserCheck2,
  Sparkles
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const { 
    currentUser, 
    isAdmin, 
    usersList, 
    addUser, 
    updateUser, 
    deleteUser, 
    refreshUsers, 
    isLoadingUsers 
  } = useAuth();
  
  const { showConfirm, showToast } = useNotification();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Semua' | UserRole>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | UserStatus>('Semua');

  // Modal State for Add / Edit
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null); // null = Add Mode
  
  // Quick Reset PIN Modal
  const [resetPinUser, setResetPinUser] = useState<UserProfile | null>(null);
  const [newResetPin, setNewResetPin] = useState('');
  const [showResetPinText, setShowResetPinText] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);

  // Form Fields State
  const [formUsername, setFormUsername] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Pelaksana');
  const [formStatus, setFormStatus] = useState<UserStatus>('Aktif');
  const [formEmail, setFormEmail] = useState('');
  const [formAvatar, setFormAvatar] = useState(DEFAULT_AVATAR);
  const [showFormPin, setShowFormPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Granular Permissions State
  const [permInputIncoming, setPermInputIncoming] = useState(true);
  const [permTally, setPermTally] = useState(true);
  const [permEditMaster, setPermEditMaster] = useState(false);
  const [permManageUsers, setPermManageUsers] = useState(false);
  const [permApproveQC, setPermApproveQC] = useState(true);
  const [permAccessDb, setPermAccessDb] = useState(false);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in">
        <div className="glass-box !bg-white p-6 rounded-3xl max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <XCircle size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase">Akses Dibatasi</h3>
          <p className="text-xs text-slate-600">
            Halaman Manajemen User & Hak Akses hanya dapat diakses oleh akun dengan Role <strong>Super Administrator</strong>.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  // Filtered list
  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      u.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email_google && u.email_google.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchRole = roleFilter === 'Semua' || u.role === roleFilter;
    const matchStatus = statusFilter === 'Semua' || u.status === statusFilter;

    return matchSearch && matchRole && matchStatus;
  });

  // Open Form in Add Mode
  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFormUsername('');
    setFormNama('');
    setFormPin('');
    setFormRole('Pelaksana');
    setFormStatus('Aktif');
    setFormEmail('');
    setFormAvatar(DEFAULT_AVATAR);
    setPermInputIncoming(true);
    setPermTally(true);
    setPermEditMaster(false);
    setPermManageUsers(false);
    setPermApproveQC(true);
    setPermAccessDb(false);
    setShowAddEditModal(true);
  };

  // Open Form in Edit Mode
  const handleOpenEdit = (user: UserProfile) => {
    setEditingUserId(user.id);
    setFormUsername(user.username);
    setFormNama(user.nama);
    setFormPin(''); // Kosongkan PIN jika tidak ingin mengubah
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormEmail(user.email_google || '');
    setFormAvatar(user.avatar || DEFAULT_AVATAR);
    
    const p = (user.permissions || {}) as {
      canInputIncoming?: boolean;
      canTally?: boolean;
      canEditMasterBarang?: boolean;
      canManageUsers?: boolean;
      canApproveQC?: boolean;
      canAccessDatabase?: boolean;
    };
    setPermInputIncoming(p.canInputIncoming ?? true);
    setPermTally(p.canTally ?? true);
    setPermEditMaster(p.canEditMasterBarang ?? (user.role === 'Admin'));
    setPermManageUsers(p.canManageUsers ?? (user.role === 'Admin'));
    setPermApproveQC(p.canApproveQC ?? true);
    setPermAccessDb(p.canAccessDatabase ?? (user.role === 'Admin'));
    
    setShowAddEditModal(true);
  };

  // Auto set permissions when role changes in form
  const handleRoleChange = (role: UserRole) => {
    setFormRole(role);
    if (role === 'Admin') {
      setPermEditMaster(true);
      setPermManageUsers(true);
      setPermAccessDb(true);
    }
  };

  // Submit Add / Edit Form
  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      showToast('Perhatian', 'Username wajib diisi!', 'warning');
      return;
    }
    if (!formNama.trim()) {
      showToast('Perhatian', 'Nama Lengkap wajib diisi!', 'warning');
      return;
    }
    if (!editingUserId && !formPin.trim()) {
      showToast('Perhatian', 'PIN 4 Digit wajib diisi untuk pengguna baru!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const permissions = {
        canInputIncoming: permInputIncoming,
        canTally: permTally,
        canEditMasterBarang: permEditMaster,
        canManageUsers: permManageUsers,
        canApproveQC: permApproveQC,
        canAccessDatabase: permAccessDb,
      };

      if (!editingUserId) {
        // CREATE
        const res = await addUser({
          username: formUsername,
          nama: formNama,
          pin: formPin,
          role: formRole,
          status: formStatus,
          email_google: formEmail,
          avatar: formAvatar,
          permissions,
        });

        if (res.success) {
          showToast('Sukses', `Pengguna baru "${formNama}" berhasil ditambahkan!`, 'success');
          setShowAddEditModal(false);
        } else {
          showToast('Gagal', res.message || 'Gagal menambahkan pengguna', 'error');
        }
      } else {
        // UPDATE
        const updates: Partial<UserProfile> & { pin?: string } = {
          username: formUsername,
          nama: formNama,
          role: formRole,
          status: formStatus,
          email_google: formEmail,
          avatar: formAvatar,
          permissions,
        };

        if (formPin.trim()) {
          updates.pin = formPin.trim();
        }

        const res = await updateUser(editingUserId, updates);
        if (res.success) {
          showToast('Tersimpan', `Data akun "${formNama}" berhasil diperbarui!`, 'success');
          setShowAddEditModal(false);
        } else {
          showToast('Gagal', res.message || 'Gagal memperbarui pengguna', 'error');
        }
      }
    } catch {
      showToast('Error', 'Terjadi kesalahan sistem saat memproses data pengguna.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      showToast('Peringatan', 'Anda tidak dapat menonaktifkan akun sendiri!', 'warning');
      return;
    }

    const newStatus: UserStatus = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const res = await updateUser(user.id, { status: newStatus });
    if (res.success) {
      showToast('Status Diubah', `Status akun ${user.nama} diubah menjadi ${newStatus}.`, 'success');
    } else {
      showToast('Gagal', res.message || 'Gagal mengubah status', 'error');
    }
  };

  // Delete User
  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      showToast('Peringatan', 'Anda tidak dapat menghapus akun Anda sendiri!', 'warning');
      return;
    }

    showConfirm({
      title: `Hapus Akun "${user.nama}"?`,
      message: `Akun "${user.username}" (${user.role}) akan dihapus secara permanen dari sistem database. Pengguna ini tidak akan bisa login lagi. Lanjutkan?`,
      confirmText: 'Ya, Hapus Pengguna',
      type: 'danger',
      onConfirm: async () => {
        const res = await deleteUser(user.id);
        if (res.success) {
          showToast('Dihapus', `Akun ${user.nama} berhasil dihapus dari database.`, 'success');
        } else {
          showToast('Gagal', res.message || 'Gagal menghapus akun', 'error');
        }
      }
    });
  };

  // Quick Reset PIN Handler
  const handleExecuteResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinUser) return;
    if (!newResetPin.trim()) {
      showToast('Perhatian', 'Harap masukkan PIN baru!', 'warning');
      return;
    }

    setIsResettingPin(true);
    try {
      const res = await updateUser(resetPinUser.id, { pin: newResetPin.trim() });
      if (res.success) {
        showToast('PIN Berhasil Direset', `PIN baru untuk akun ${resetPinUser.nama} telah aktif!`, 'success');
        setResetPinUser(null);
        setNewResetPin('');
      } else {
        showToast('Gagal', res.message || 'Gagal mereset PIN', 'error');
      }
    } catch {
      showToast('Error', 'Gagal mereset PIN pengguna.', 'error');
    } finally {
      setIsResettingPin(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white p-4 sm:p-6 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-red-800 text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 m-0 uppercase tracking-tight">
                  Manajemen User & Hak Akses
                </h2>
                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-200">
                  Super Administrator
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 font-medium">
                Kelola akun operator, role hak akses, status aktif, dan reset PIN terintegrasi database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer transform active:scale-95"
            >
              <UserPlus size={15} />
              <span className="hidden sm:inline">Tambah User Baru</span>
              <span className="sm:hidden">Tambah</span>
            </button>

            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 shrink-0">
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Total Pengguna</div>
              <div className="text-base font-black text-slate-800">{usersList.length} Akun</div>
            </div>
            <Users size={20} className="text-blue-900" />
          </div>
          <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-red-500 uppercase">Role Admin</div>
              <div className="text-base font-black text-red-700">
                {usersList.filter((u) => u.role === 'Admin').length}
              </div>
            </div>
            <ShieldCheck size={20} className="text-red-600" />
          </div>
          <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase">Role Pelaksana</div>
              <div className="text-base font-black text-blue-800">
                {usersList.filter((u) => u.role === 'Pelaksana').length}
              </div>
            </div>
            <UserCheck2 size={20} className="text-blue-700" />
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Akun Aktif</div>
              <div className="text-base font-black text-emerald-700">
                {usersList.filter((u) => u.status === 'Aktif').length}
              </div>
            </div>
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, username, atau email..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="Semua">Semua Role</option>
              <option value="Admin">Role Admin</option>
              <option value="Pelaksana">Role Pelaksana</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Status Aktif</option>
              <option value="Nonaktif">Status Nonaktif</option>
            </select>

            <button
              onClick={() => refreshUsers()}
              disabled={isLoadingUsers}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Sinkronkan data akun dari server"
            >
              <RefreshCw size={14} className={isLoadingUsers ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* User List Table / Cards (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
              <Users size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 m-0">Tidak ada data pengguna yang sesuai.</p>
              <p className="text-slate-400 m-0 mt-0.5">Coba ubah kata kunci pencarian atau filter Anda.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isMe = user.id === currentUser?.id;
              const isAdminRole = user.role === 'Admin';
              const isActive = user.status === 'Aktif';

              return (
                <div
                  key={user.id}
                  className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isMe 
                      ? 'bg-blue-50/50 border-blue-300 shadow-2xs' 
                      : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Avatar & User Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={user.avatar || DEFAULT_AVATAR}
                      alt={user.nama}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm bg-white shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-slate-800 truncate">
                          {user.nama}
                        </span>
                        {isMe && (
                          <span className="bg-blue-900 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                            Akun Anda
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                            isAdminRole
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {user.role}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {user.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium flex-wrap">
                        <span>Username: <strong className="font-mono text-slate-700">@{user.username}</strong></span>
                        {user.email_google && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 truncate">{user.email_google}</span>
                          </>
                        )}
                      </div>

                      {/* Permissions Pills */}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap text-[9px]">
                        {user.permissions?.canInputIncoming && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">Incoming</span>
                        )}
                        {user.permissions?.canTally && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">Tally</span>
                        )}
                        {user.permissions?.canEditMasterBarang && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">Master</span>
                        )}
                        {user.permissions?.canManageUsers && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold">Kelola User</span>
                        )}
                        {user.permissions?.canApproveQC && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">QC</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      title="Edit Data & Hak Akses Pengguna"
                    >
                      <Edit size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        setResetPinUser(user);
                        setNewResetPin('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      title="Reset PIN Keamanan 4 Digit"
                    >
                      <KeyRound size={13} />
                      <span>PIN</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(user)}
                      disabled={isMe}
                      className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                      title={isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                    >
                      {isActive ? <UserX size={15} /> : <UserCheck2 size={15} />}
                    </button>

                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={isMe}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isMe ? 'Tidak dapat menghapus akun sendiri' : 'Hapus Pengguna'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================================= */}
        {/* SUB-MODAL: TAMBAH / EDIT PENGGUNA (CRUD FORM) */}
        {/* ========================================================================= */}
        {showAddEditModal && typeof document !== "undefined" && createPortal(
          <div 
            className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/70 p-3 sm:p-4 animate-fade-in"
            onClick={() => setShowAddEditModal(false)}
          >
            <div 
              className="bg-white p-5 sm:p-6 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowAddEditModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                  {editingUserId ? <Edit size={16} /> : <UserPlus size={16} />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 m-0 uppercase tracking-tight">
                    {editingUserId ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <span className="text-[10px] text-slate-400">Sinkronisasi Database Logistik</span>
                </div>
              </div>

              <form onSubmit={handleSubmitUserForm} className="space-y-3.5">
                
                {/* Username & Nama Lengkap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                      Username Akun <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="contoh: budi_logistik"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formNama}
                      onChange={(e) => setFormNama(e.target.value)}
                      placeholder="contoh: Budi Santoso"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                      required
                    />
                  </div>
                </div>

                {/* PIN & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-black text-slate-700 uppercase">
                        PIN 4 Digit {editingUserId ? '(Opsional)' : <span className="text-red-500">*</span>}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFormPin(!showFormPin)}
                        className="text-[10px] text-blue-900 font-bold hover:underline"
                      >
                        {showFormPin ? 'Sembunyikan' : 'Lihat PIN'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        maxLength={8}
                        value={formPin}
                        onChange={(e) => setFormPin(e.target.value)}
                        placeholder={editingUserId ? 'Kosongkan jika tidak ubah PIN' : 'Ketik PIN 4 digit...'}
                        className={`w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono tracking-widest font-bold ${
                          showFormPin ? 'pin-mask-visible' : 'pin-mask-hidden'
                        }`}
                        required={!editingUserId}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                      Email Google (Opsional)
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="email.operasional@gmail.com"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Role & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                      Role Jabatan
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none"
                    >
                      <option value="Pelaksana">Pelaksana (Operasional Logistik)</option>
                      <option value="Admin">Super Administrator (Akses Penuh)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                      Status Akun
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none"
                    >
                      <option value="Aktif">Aktif (Dapat Login)</option>
                      <option value="Nonaktif">Nonaktif (Blokir Login)</option>
                    </select>
                  </div>
                </div>

                {/* Preset Avatar Selector (Ringan & Cepat) */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                    <span>Pilih Foto Avatar Ringan:</span>
                    <span className="text-[10px] font-normal text-slate-400">Pilih dari koleksi SVG instan</span>
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200 max-h-36 overflow-y-auto">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = formAvatar === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setFormAvatar(preset.url)}
                          className={`p-1.5 rounded-xl border transition-all flex flex-col items-center gap-1 group cursor-pointer ${
                            isSelected 
                              ? 'border-blue-600 bg-blue-100/70 shadow-xs ring-2 ring-blue-400/40' 
                              : 'border-slate-200 bg-white hover:border-blue-300'
                          }`}
                          title={preset.name}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                          <span className="text-[8px] font-bold text-slate-600 truncate w-full text-center">
                            {preset.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Permissions Checklist */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-black text-slate-700 uppercase flex items-center justify-between">
                    <span>Hak Akses Modul Operasional:</span>
                    <span className="text-[10px] text-blue-900 font-bold">Role: {formRole}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permInputIncoming}
                        onChange={(e) => setPermInputIncoming(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Input Incoming Barang</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permTally}
                        onChange={(e) => setPermTally(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Tally Inbound Checker</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permEditMaster}
                        onChange={(e) => setPermEditMaster(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Edit Master Barang</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permApproveQC}
                        onChange={(e) => setPermApproveQC(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Approve Status QC</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permManageUsers}
                        onChange={(e) => setPermManageUsers(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Kelola Akun & Role User</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permAccessDb}
                        onChange={(e) => setPermAccessDb(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-600"
                      />
                      <span className="font-semibold text-slate-700">Pengaturan Server Database</span>
                    </label>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{editingUserId ? 'Simpan Perubahan Akun' : 'Tambah Pengguna Baru'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddEditModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        , document.body)}

        {/* ========================================================================= */}
        {/* SUB-MODAL: QUICK RESET PIN */}
        {/* ========================================================================= */}
        {resetPinUser && (
          <div 
            className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/70 p-4 animate-fade-in"
            onClick={() => setResetPinUser(null)}
          >
            <div 
              className="bg-white p-5 sm:p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setResetPinUser(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 m-0 uppercase">
                    Reset PIN Keamanan
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Akun: {resetPinUser.nama} (@{resetPinUser.username})
                  </span>
                </div>
              </div>

              <form onSubmit={handleExecuteResetPin} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black text-slate-700 uppercase">
                      Ketik PIN Baru (4 Digit)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowResetPinText(!showResetPinText)}
                      className="text-[10px] text-blue-900 font-bold"
                    >
                      {showResetPinText ? 'Sembunyikan' : 'Lihat'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    maxLength={8}
                    value={newResetPin}
                    onChange={(e) => setNewResetPin(e.target.value)}
                    placeholder="Masukkan 4 digit PIN baru..."
                    className={`w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono tracking-widest font-bold text-center ${
                      showResetPinText ? 'pin-mask-visible' : 'pin-mask-hidden'
                    }`}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isResettingPin}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isResettingPin ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>Simpan PIN Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPinUser(null)}
                    className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagementModal;
