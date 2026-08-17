import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole, UserStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { DEFAULT_AVATAR } from '../data/avatarPresets';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAdmin: boolean;
  usersList: UserProfile[];
  login: (username: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: (reason?: string) => void;
  isDbConnected: boolean;
  refreshUsers: () => Promise<void>;
  isLoadingUsers: boolean;
  // User Management (Admin CRUD)
  addUser: (userData: {
    username: string;
    nama: string;
    pin: string;
    role: UserRole;
    status: UserStatus;
    email_google?: string;
    avatar?: string;
    permissions?: UserProfile['permissions'];
  }) => Promise<{ success: boolean; message?: string }>;
  updateUser: (id: string, updates: Partial<UserProfile> & { pin?: string }) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message?: string }>;
  // Avatar Update for Any User
  updateMyAvatar: (avatarUrl: string) => Promise<{ success: boolean; message?: string }>;
  // Inactivity & Security Auto-Logout (30 Menit)
  sessionExpiryWarning: { isWarning: boolean; secondsRemaining: number } | null;
  sessionExpiredNotice: string | null;
  clearSessionExpiredNotice: () => void;
  resetInactivityTimer: () => void;
  inactivityTimeoutMinutes: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 Menit auto-logout
export const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // 2 Menit peringatan sebelum auto-logout

const STORAGE_KEY_AUTH = 'ckb_logistic_active_user';
const STORAGE_KEY_USERS = 'ckb_logistic_users_db';
const STORAGE_KEY_LAST_ACTIVE = 'ckb_logistic_last_active_time';
const STORAGE_KEY_SESSION_EXPIRED = 'ckb_logistic_session_expired_msg';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDbConnected, setIsDbConnected] = useState<boolean>(isSupabaseConfigured);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Inactivity Security States
  const [sessionExpiryWarning, setSessionExpiryWarning] = useState<{ isWarning: boolean; secondsRemaining: number } | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SESSION_EXPIRED);
    } catch {
      return null;
    }
  });
  const [lastActiveTime, setLastActiveTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      return saved ? parseInt(saved, 10) : Date.now();
    } catch {
      return Date.now();
    }
  });

  // Inisialisasi daftar users (dari cache penyimpanan lokal atau array kosong)
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Inisialisasi user yang sedang login
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Sinkronisasi data profil pengguna langsung dari database pusat (Tabel 'users')
  const refreshUsers = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('role', { ascending: true });

      if (!error && data && data.length > 0) {
        setIsDbConnected(true);
        const mappedUsers: UserProfile[] = data.map((u: any) => ({
          id: u.id,
          username: u.username,
          nama: u.nama,
          pin: u.pin, // Diperlukan untuk verifikasi internal
          avatar: u.avatar || DEFAULT_AVATAR,
          role: u.role || 'Pelaksana',
          status: u.status || 'Aktif',
          email_google: u.email_google || '',
          permissions: typeof u.permissions === 'object' && u.permissions !== null
            ? u.permissions
            : {
                canInputIncoming: true,
                canTally: true,
                canEditMasterBarang: u.role === 'Admin',
                canManageUsers: u.role === 'Admin',
                canApproveQC: true,
                canAccessDatabase: u.role === 'Admin',
              },
          created_at: u.created_at,
          updated_at: u.updated_at,
        }));

        setUsersList(mappedUsers);
        try {
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(mappedUsers));
        } catch {
          // ignore
        }

        // Sinkronkan juga active currentUser jika ada update profil
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updatedSelf = mappedUsers.find((u) => u.id === prev.id);
          if (updatedSelf) {
            const safeSelf = { ...updatedSelf };
            delete safeSelf.pin;
            return safeSelf;
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Sync users from server fallback to cache:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();

    if (isSupabaseConfigured) {
      // Realtime listener jika ada pembaruan data user di database
      const channel = supabase
        .channel('users_sync_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          refreshUsers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [refreshUsers]);

  // Simpan active user ke storage jika berubah
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // =========================================================================
  // LOGOUT & SESSION RESET
  // =========================================================================
  const logout = useCallback((reason?: string) => {
    setCurrentUser(null);
    setSessionExpiryWarning(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
      if (reason === 'inactivity') {
        const msg = 'Sesi Anda telah berakhir otomatis setelah 30 menit tidak ada aktivitas untuk melindungi keamanan data logistik pada perangkat mobile bersama.';
        setSessionExpiredNotice(msg);
        localStorage.setItem(STORAGE_KEY_SESSION_EXPIRED, msg);
      } else {
        setSessionExpiredNotice(null);
        localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRED);
      }
    } catch {
      // ignore
    }
  }, []);

  const clearSessionExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(null);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRED);
    } catch {
      // ignore
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    setLastActiveTime(now);
    setSessionExpiryWarning(null);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
    } catch {
      // ignore
    }
  }, []);

  // =========================================================================
  // INACTIVITY MONITOR (30 MINUTES AUTO-LOGOUT)
  // Melindungi data logistik sensitif pada perangkat kerja & mobile bersama
  // =========================================================================
  useEffect(() => {
    if (!currentUser) {
      setSessionExpiryWarning(null);
      return;
    }

    // Pastikan timestamp awal tersimpan
    const saved = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    const initialTime = saved ? parseInt(saved, 10) : Date.now();
    if (!saved) {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());
      } catch {
        // ignore
      }
    }
    setLastActiveTime(initialTime);

    let lastThrottledRecord = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      // Throttle update state & localStorage setiap 2.5 detik
      if (now - lastThrottledRecord > 2500) {
        lastThrottledRecord = now;
        setLastActiveTime(now);
        try {
          localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
        } catch {
          // ignore
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVE && e.newValue) {
        const timestamp = parseInt(e.newValue, 10);
        if (!isNaN(timestamp)) {
          setLastActiveTime(timestamp);
        }
      } else if (e.key === STORAGE_KEY_AUTH && !e.newValue) {
        // User logout di tab lain
        setCurrentUser(null);
      }
    };

    const evaluateInactivity = () => {
      let activeTs = lastActiveTime;
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed)) activeTs = parsed;
        }
      } catch {
        // ignore
      }

      const elapsed = Date.now() - activeTs;

      // 1. Melebihi 30 Menit (1.800.000 ms) -> Auto Logout
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        logout('inactivity');
      } 
      // 2. Dalam rentang 2 Menit peringatan (28 - 30 Menit) -> Tampilkan Dialog Countdown
      else if (elapsed >= INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS) {
        const remainingSecs = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSessionExpiryWarning({
          isWarning: true,
          secondsRemaining: remainingSecs,
        });
      } 
      // 3. Masih aktif normal -> Sembunyikan Dialog
      else {
        setSessionExpiryWarning(null);
      }
    };

    // Handler saat aplikasi aktif kembali dari latar belakang / layar HP dinyalakan
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        evaluateInactivity();
      }
    };

    const userActivityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'touchmove',
      'scroll',
      'click',
      'wheel',
    ];

    userActivityEvents.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Evaluasi periodik setiap 1 detik
    const timerInterval = setInterval(evaluateInactivity, 1000);

    return () => {
      userActivityEvents.forEach((evt) => {
        window.removeEventListener(evt, recordActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(timerInterval);
    };
  }, [currentUser, lastActiveTime, logout]);

  // =========================================================================
  // AUTH: LOGIN
  // =========================================================================
  const login = async (username: string, pin: string): Promise<{ success: boolean; message?: string }> => {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPin = pin.trim();

    if (!trimmedUsername) {
      return { success: false, message: 'Username wajib diisi!' };
    }
    if (!trimmedPin) {
      return { success: false, message: 'PIN keamanan wajib diisi!' };
    }

    // Bersihkan pesan expired sebelumnya saat login berhasil dimulai
    clearSessionExpiredNotice();

    // 1. Cek langsung ke database jika terhubung
    if (isSupabaseConfigured) {
      try {
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .ilike('username', trimmedUsername)
          .maybeSingle();

        if (!error && dbUser) {
          if (dbUser.status !== 'Aktif') {
            return { success: false, message: 'Akun Anda sedang nonaktif. Hubungi Admin.' };
          }

          if (dbUser.pin !== trimmedPin) {
            return { success: false, message: 'Kode PIN yang Anda masukkan salah!' };
          }

          const matchedUser: UserProfile = {
            id: dbUser.id,
            username: dbUser.username,
            nama: dbUser.nama,
            avatar: dbUser.avatar || DEFAULT_AVATAR,
            role: dbUser.role || 'Pelaksana',
            status: dbUser.status || 'Aktif',
            email_google: dbUser.email_google || '',
            permissions: typeof dbUser.permissions === 'object' && dbUser.permissions !== null
              ? dbUser.permissions
              : {
                  canInputIncoming: true,
                  canTally: true,
                  canEditMasterBarang: dbUser.role === 'Admin',
                  canManageUsers: dbUser.role === 'Admin',
                  canApproveQC: true,
                  canAccessDatabase: dbUser.role === 'Admin',
                },
          };

          const now = Date.now();
          setLastActiveTime(now);
          try {
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
          } catch {
            // ignore
          }

          setCurrentUser(matchedUser);
          return { success: true };
        }
      } catch (e) {
        console.warn('Database login query error, checking local state:', e);
      }
    }

    // 2. Fallback cek ke data cached usersList
    const user = usersList.find(
      (u) => u.username.toLowerCase() === trimmedUsername
    );

    if (!user) {
      return { success: false, message: 'Username tidak ditemukan di database!' };
    }

    if (user.status !== 'Aktif') {
      return { success: false, message: 'Akun Anda sedang nonaktif. Hubungi Admin.' };
    }

    if (user.pin && user.pin !== trimmedPin) {
      return { success: false, message: 'Kode PIN yang Anda masukkan salah!' };
    }

    // Hapus PIN dari session active user demi keamanan
    const safeUser: UserProfile = { ...user };
    delete safeUser.pin;

    const now = Date.now();
    setLastActiveTime(now);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
    } catch {
      // ignore
    }

    setCurrentUser(safeUser);
    return { success: true };
  };

  // =========================================================================
  // AVATAR UPDATE (Untuk Semua User)
  // =========================================================================
  const updateMyAvatar = async (avatarUrl: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) {
      return { success: false, message: 'Pengguna belum login!' };
    }

    const updatedUser = { ...currentUser, avatar: avatarUrl };
    setCurrentUser(updatedUser);

    // Update in local users list
    setUsersList((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, avatar: avatarUrl } : u))
    );

    // Update in Supabase Database
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ avatar: avatarUrl, updated_at: new Date().toISOString() })
          .eq('id', currentUser.id);

        if (error) {
          console.warn('Update avatar in db returned error:', error);
        }
      } catch (err) {
        console.error('Failed to sync avatar to database:', err);
      }
    }

    return { success: true };
  };

  // =========================================================================
  // SUPER ADMINISTRATOR: CRUD MANAJEMEN USER
  // =========================================================================
  const addUser = async (userData: {
    username: string;
    nama: string;
    pin: string;
    role: UserRole;
    status: UserStatus;
    email_google?: string;
    avatar?: string;
    permissions?: UserProfile['permissions'];
  }): Promise<{ success: boolean; message?: string }> => {
    const cleanUsername = userData.username.trim().toLowerCase();
    const cleanNama = userData.nama.trim();
    const cleanPin = userData.pin.trim();

    if (!cleanUsername || !cleanNama || !cleanPin) {
      return { success: false, message: 'Username, Nama Lengkap, dan PIN 4 Digit wajib diisi!' };
    }

    // Validasi duplikasi username
    const exists = usersList.some((u) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return { success: false, message: `Username "${cleanUsername}" sudah digunakan oleh akun lain!` };
    }

    const newId = `usr_${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      username: cleanUsername,
      nama: cleanNama,
      pin: cleanPin,
      avatar: userData.avatar || DEFAULT_AVATAR,
      role: userData.role || 'Pelaksana',
      status: userData.status || 'Aktif',
      email_google: userData.email_google?.trim() || '',
      permissions: userData.permissions || {
        canInputIncoming: true,
        canTally: true,
        canEditMasterBarang: userData.role === 'Admin',
        canManageUsers: userData.role === 'Admin',
        canApproveQC: true,
        canAccessDatabase: userData.role === 'Admin',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update state & local storage
    setUsersList((prev) => [...prev, newUser]);

    // Insert to database
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('users').insert([
          {
            id: newUser.id,
            username: newUser.username,
            nama: newUser.nama,
            pin: cleanPin,
            avatar: newUser.avatar,
            role: newUser.role,
            status: newUser.status,
            email_google: newUser.email_google,
            permissions: newUser.permissions,
          },
        ]);

        if (error) {
          console.error('Database insert user error:', error);
          return { success: false, message: `Gagal simpan ke database: ${error.message}` };
        }
      } catch (err: any) {
        console.error('Add user exception:', err);
        return { success: false, message: err.message || 'Terjadi kesalahan sistem.' };
      }
    }

    await refreshUsers();
    return { success: true };
  };

  const updateUser = async (
    id: string,
    updates: Partial<UserProfile> & { pin?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    const existingIndex = usersList.findIndex((u) => u.id === id);
    if (existingIndex === -1) {
      return { success: false, message: 'Data pengguna tidak ditemukan!' };
    }

    // Jika username diubah, cek duplikasi
    if (updates.username) {
      const cleanUsername = updates.username.trim().toLowerCase();
      const duplicate = usersList.some((u) => u.id !== id && u.username.toLowerCase() === cleanUsername);
      if (duplicate) {
        return { success: false, message: `Username "${cleanUsername}" sudah digunakan akun lain!` };
      }
      updates.username = cleanUsername;
    }

    // Update state lokal
    setUsersList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates, updated_at: new Date().toISOString() } : u))
    );

    // Update ke Supabase database
    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (updates.username) payload.username = updates.username;
        if (updates.nama) payload.nama = updates.nama.trim();
        if (updates.pin) payload.pin = updates.pin.trim();
        if (updates.role) payload.role = updates.role;
        if (updates.status) payload.status = updates.status;
        if (updates.avatar) payload.avatar = updates.avatar;
        if (updates.email_google !== undefined) payload.email_google = updates.email_google.trim();
        if (updates.permissions) payload.permissions = updates.permissions;

        const { error } = await supabase
          .from('users')
          .update(payload)
          .eq('id', id);

        if (error) {
          console.error('Database update user error:', error);
          return { success: false, message: `Gagal memperbarui data di server: ${error.message}` };
        }
      } catch (err: any) {
        console.error('Update user exception:', err);
        return { success: false, message: err.message || 'Gagal menyimpan perubahan ke server.' };
      }
    }

    await refreshUsers();
    return { success: true };
  };

  const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const target = usersList.find((u) => u.id === id);
    if (!target) {
      return { success: false, message: 'User tidak ditemukan!' };
    }

    // Hindari menghapus akun aktif yang sedang login jika admin
    if (currentUser?.id === id) {
      return { success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif!' };
    }

    // Hapus dari state lokal
    setUsersList((prev) => prev.filter((u) => u.id !== id));

    // Hapus dari Supabase database
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) {
          console.error('Database delete user error:', error);
          return { success: false, message: `Gagal menghapus user dari database: ${error.message}` };
        }
      } catch (err: any) {
        console.error('Delete user exception:', err);
        return { success: false, message: err.message || 'Gagal menghapus user.' };
      }
    }

    await refreshUsers();
    return { success: true };
  };

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        usersList,
        login,
        logout,
        isDbConnected,
        refreshUsers,
        isLoadingUsers,
        addUser,
        updateUser,
        deleteUser,
        updateMyAvatar,
        sessionExpiryWarning,
        sessionExpiredNotice,
        clearSessionExpiredNotice,
        resetInactivityTimer,
        inactivityTimeoutMinutes: 30,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
