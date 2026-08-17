import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LinkData, TodoData, TodoPriority, parseTodoTask, formatTodoTask } from '../types';

export function useLinks() {
  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase.from('links').select('*').order('created_at', { ascending: false });
      if (!error && data) setLinks(data as LinkData[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    const channel = supabase
      .channel('links_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, () => {
        fetchLinks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addLink = async (link: Omit<LinkData, 'id'>) => {
    const tempId = crypto.randomUUID();
    const newLink = { ...link, id: tempId, created_at: new Date().toISOString() } as LinkData;
    setLinks(prev => [newLink, ...prev]);
    const { error } = await supabase.from('links').insert([link]);
    if (error) {
      alert(`Gagal menyimpan ke database Supabase: ${error.message}\n\nSolusi: Pastikan tabel "links" sudah dibuat dan matikan RLS (DISABLE ROW LEVEL SECURITY) atau tambahkan POLICY di Supabase SQL Editor.`);
      setLinks(prev => prev.filter(l => l.id !== tempId));
    } else {
      fetchLinks();
    }
  };

  const updateLink = async (id: string, link: Partial<Omit<LinkData, 'id'>>) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...link } : l));
    const { error } = await supabase.from('links').update(link).eq('id', id);
    if (error) {
      alert(`Gagal memperbarui aplikasi di Supabase: ${error.message}`);
      fetchLinks();
    } else {
      fetchLinks();
    }
  };

  const deleteLink = async (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from('links').delete().eq('id', id);
    if (error) {
      alert(`Gagal menghapus aplikasi dari Supabase: ${error.message}`);
      fetchLinks();
    }
  };

  return { links, loading, addLink, updateLink, deleteLink };
}

export function useTodos() {
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const parsedTodos = data.map((t: any) => {
          const parsed = parseTodoTask(t.task, t.priority, t.is_blinking);
          return {
            ...t,
            task: parsed.cleanTask,
            priority: parsed.priority,
            is_blinking: parsed.isBlinking
          };
        });
        setTodos(parsedTodos as TodoData[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    const channel = supabase
      .channel('todos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        fetchTodos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addTodo = async (task: string, priority: TodoPriority = 'rendah', isBlinking: boolean = false) => {
    const formattedTask = formatTodoTask(task, priority, isBlinking);
    const tempId = crypto.randomUUID();
    const newTodo: TodoData = { 
      id: tempId, 
      task, 
      status: 'no', 
      priority, 
      is_blinking: isBlinking, 
      created_at: new Date().toISOString() 
    } as any;
    
    setTodos(prev => [newTodo, ...prev]);

    const { error } = await supabase.from('todos').insert([{ task: formattedTask, status: 'no' }]);
    if (error) {
      alert(`Gagal menyimpan tugas. Pesan: ${error.message}. Pastikan Anda menonaktifkan RLS (Row Level Security) di tabel "todos" pada Supabase agar public dapat menambah data.`);
      setTodos(prev => prev.filter(t => t.id !== tempId));
    } else {
      fetchTodos();
    }
  };

  const updateTodoStatus = async (id: string, status: TodoData['status']) => {
    const existing = todos.find(t => t.id === id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));

    const formattedTask = existing ? formatTodoTask(existing.task, existing.priority || 'rendah', !!existing.is_blinking) : undefined;
    const updatePayload: any = { status };
    if (formattedTask) {
      updatePayload.task = formattedTask;
    }

    const { error } = await supabase.from('todos').update(updatePayload).eq('id', id);
    if (error) {
      alert(`Gagal mengubah status. Pesan: ${error.message}. Pastikan Anda menonaktifkan RLS di tabel "todos".`);
      fetchTodos();
    } else {
      fetchTodos();
    }
  };

  const updateTodo = async (id: string, updates: Partial<Omit<TodoData, 'id'>>) => {
    const existing = todos.find(t => t.id === id);
    if (!existing) return;

    const newCleanTask = updates.task !== undefined ? updates.task : existing.task;
    const newPriority = updates.priority !== undefined ? updates.priority : (existing.priority || 'rendah');
    const newBlinking = updates.is_blinking !== undefined ? updates.is_blinking : !!existing.is_blinking;
    const newStatus = updates.status !== undefined ? updates.status : existing.status;

    const formattedTask = formatTodoTask(newCleanTask, newPriority, newBlinking);

    setTodos(prev => prev.map(t => t.id === id ? { 
      ...t, 
      task: newCleanTask, 
      priority: newPriority, 
      is_blinking: newBlinking, 
      status: newStatus 
    } : t));

    const { error } = await supabase.from('todos').update({
      task: formattedTask,
      status: newStatus
    }).eq('id', id);

    if (error) {
      alert(`Gagal memperbarui tugas. Pesan: ${error.message}. Pastikan Anda menonaktifkan RLS di tabel "todos".`);
      fetchTodos();
    } else {
      fetchTodos();
    }
  };

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) {
      alert(`Gagal menghapus tugas. Pesan: ${error.message}. Pastikan Anda menonaktifkan RLS di tabel "todos".`);
      fetchTodos();
    }
  };

  const deleteCompletedTodos = async () => {
    const doneCount = todos.filter(t => t.status === 'close').length;
    if (doneCount === 0) return;

    setTodos(prev => prev.filter(t => t.status !== 'close'));
    const { error } = await supabase.from('todos').delete().eq('status', 'close');
    if (error) {
      console.error(`Gagal menghapus tugas selesai: ${error.message}`);
      fetchTodos();
    }
  };

  return { todos, loading, addTodo, updateTodoStatus, updateTodo, deleteTodo, deleteCompletedTodos };
}

export function useMenuOrder() {
  const [menuOrder, setMenuOrder] = useState<string[]>([]);

  const fetchMenuOrder = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'menu_order').single();
      if (!error && data) {
        let remoteOrder: string[] | null = null;
        if (Array.isArray(data.order)) {
          remoteOrder = data.order;
        } else if (Array.isArray(data.messages)) {
          remoteOrder = data.messages;
        } else if (typeof data.messages === 'string') {
          try {
            remoteOrder = JSON.parse(data.messages);
          } catch {}
        }

        if (remoteOrder && remoteOrder.length > 0) {
          setMenuOrder(remoteOrder);
        }
      }
    } catch (e) {
      console.error('Error fetching menu order from database:', e);
    }
  };

  useEffect(() => {
    fetchMenuOrder();
    const channel = supabase
      .channel('menu_order_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        fetchMenuOrder();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveMenuOrder = async (newOrder: string[]) => {
    setMenuOrder(newOrder);
    try {
      const payload: any = { id: 'menu_order', order: newOrder, messages: newOrder };
      const { error } = await supabase.from('settings').upsert(payload);
      if (error) {
        await supabase.from('settings').upsert({ id: 'menu_order', messages: newOrder });
      }
    } catch (e) {
      console.error('Error saving menu_order to Supabase:', e);
    }
  };

  return { menuOrder, saveMenuOrder };
}

export function useAuth() {
  const [user, setUser] = useState<{email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const saved = localStorage.getItem('user');
      setUser(saved ? JSON.parse(saved) : null);
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('userChange', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('userChange', handleAuthChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      // Hardcoded fallback for immediate access
      if (email === 'admin@admin.com' && password === 'Kino.2026') {
        const u = { email };
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        window.dispatchEvent(new Event('userChange'));
        return;
      }

      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error("Kredensial Supabase (URL/KEY) belum diisi di Environment Variables.");
      }

      // Coba autentikasi menggunakan tabel users
      const { data, error } = await supabase
        .from('users')
        .select('email, password')
        .eq('email', email)
        .eq('password', password)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
           throw new Error('Email atau password salah (atau data tidak ditemukan).');
        }
        if (error.code === '42P01') {
           throw new Error('Tabel users belum ada. Jalankan supabase_schema.sql di SQL Editor.');
        }
        throw new Error(error.message);
      }

      if (data) {
        const u = { email: data.email };
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        window.dispatchEvent(new Event('userChange'));
        return;
      }
    } catch (e: any) {
      throw new Error(e.message || 'Login gagal terjadi kesalahan.');
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('userChange'));
  };

  return { user, isAdmin: !!user, login, logout };
}

export { useBroadcast } from './useBroadcast';

