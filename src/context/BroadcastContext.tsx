import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  supabase, 
  isSupabaseConfigured,
  sharedBroadcastSupabase,
  isSharedBroadcastConfigured,
  sharedBroadcastUrl,
  saveSharedBroadcastCredentials,
  removeSharedBroadcastCredentials,
  testSharedBroadcastConnection,
  ConnectionTestResult
} from '../supabase';
import { BroadcastMessage, BroadcastCategory } from '../types';
import { 
  forceDeviceBroadcastAlert,
  stopTabAlert, 
  requestNotificationPermission, 
  getNotificationPermission,
  isNotificationSupported
} from '../utils/systemNotification';
import { initAudioUnlock } from '../utils/broadcastSound';

const SESSION_CLIENT_ID = typeof crypto !== 'undefined' && crypto.randomUUID 
  ? crypto.randomUUID() 
  : 'client-' + Math.random().toString(36).substring(2, 9);

const STORAGE_KEY_BROADCAST_CACHE = 'ckb_logistic_broadcasts_cache';

// Cross-tab broadcast channel for instant multi-tab coordination
let crossTabChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    crossTabChannel = new BroadcastChannel('ckb_intercom_tab_sync');
  }
} catch {
  // ignore
}

// Helper to normalize any broadcast row format from Supabase database table `broadcast` or `broadcasts`
function normalizeBroadcast(raw: any): BroadcastMessage {
  if (!raw) return raw;
  const messageText = raw.message || raw.content || raw.pesan || raw.title || '';
  const senderText = raw.sender_name || raw.author_name || raw.sender || raw.pengirim || raw.nama || 'Pos Logistik';
  const category = (raw.category || raw.kategori || raw.tipe || 'info') as BroadcastCategory;
  const createdAt = raw.created_at || raw.timestamp || raw.tanggal || new Date().toISOString();
  const deviceInfo = raw.device_info || raw.device || raw.author_role || '';
  const id = String(raw.id || raw.id_broadcast || crypto.randomUUID());

  return {
    id,
    sender_name: senderText,
    author_name: senderText,
    message: messageText,
    content: messageText,
    title: raw.title || (messageText.length > 40 ? messageText.slice(0, 40) + '...' : messageText),
    category,
    priority: raw.priority || 'Normal',
    device_info: deviceInfo,
    is_pinned: !!raw.is_pinned,
    is_active: raw.is_active !== undefined ? !!raw.is_active : true,
    created_at: createdAt,
  };
}

interface BroadcastContextType {
  messages: BroadcastMessage[];
  loading: boolean;
  incomingBroadcast: BroadcastMessage | null;
  soundEnabled: boolean;
  notificationPermission: NotificationPermission;
  isNotificationSupported: boolean;
  isBridgeActive: boolean;
  bridgeUrl: string;
  testBridge: () => Promise<ConnectionTestResult>;
  saveBridgeCredentials: (url: string, key: string) => void;
  removeBridgeCredentials: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  sendBroadcast: (data: {
    sender_name: string;
    message: string;
    category?: BroadcastCategory;
    device_info?: string;
  }) => Promise<BroadcastMessage>;
  deleteMessage: (id: string) => Promise<void>;
  clearAllMessages: () => Promise<void>;
  dismissIncomingBroadcast: () => void;
  toggleSound: () => void;
  refetch: () => Promise<void>;
}

const BroadcastContext = createContext<BroadcastContextType | undefined>(undefined);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<BroadcastMessage[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_BROADCAST_CACHE);
      if (cached) {
        return JSON.parse(cached).map(normalizeBroadcast);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [incomingBroadcast, setIncomingBroadcast] = useState<BroadcastMessage | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('broadcast_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const soundEnabledRef = useRef(soundEnabled);
  const activeChannelRef = useRef<any>(null);
  const sharedActiveChannelRef = useRef<any>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initAudioUnlock();
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('broadcast_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  // Persist cache to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BROADCAST_CACHE, JSON.stringify(messages.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [messages]);

  const requestSysPermission = useCallback(async () => {
    const res = await requestNotificationPermission();
    setNotificationPermission(res);
    return res;
  }, []);

  // Helper to trigger full multi-layer notification alert for any new incoming broadcast
  const handleIncomingAlert = useCallback((item: BroadcastMessage, fromSessionId?: string) => {
    if (!item || !item.id) return;
    
    // Avoid double alerting for the same message ID within session
    if (processedMessageIdsRef.current.has(item.id)) return;
    processedMessageIdsRef.current.add(item.id);

    // If sent by this same exact tab, skip sound/popup to avoid self-echo, but sync state
    if (fromSessionId === SESSION_CLIENT_ID) return;

    // Trigger on-screen floating robot, vibration, audio, and OS notification
    setIncomingBroadcast(item);
    forceDeviceBroadcastAlert(item, soundEnabledRef.current, () => {
      setIncomingBroadcast(item);
    });

    // Notify other tabs via Cross-Tab BroadcastChannel
    try {
      if (crossTabChannel) {
        crossTabChannel.postMessage({ type: 'INCOMING_BROADCAST', payload: item, sessionId: SESSION_CLIENT_ID });
      }
    } catch {
      // ignore
    }
  }, []);

  // Cross-tab listener
  useEffect(() => {
    if (!crossTabChannel) return;
    const handleTabMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'INCOMING_BROADCAST') {
        const item = normalizeBroadcast(event.data.payload);
        setMessages(prev => {
          if (prev.some(m => m.id === item.id)) return prev;
          return [item, ...prev];
        });
        if (event.data.sessionId !== SESSION_CLIENT_ID) {
          setIncomingBroadcast(item);
        }
      }
    };
    crossTabChannel.addEventListener('message', handleTabMessage);
    return () => {
      crossTabChannel?.removeEventListener('message', handleTabMessage);
    };
  }, []);

  // Helper to fetch broadcasts from a specific Supabase client
  const fetchFromClient = async (client: any): Promise<BroadcastMessage[]> => {
    if (!client) return [];
    try {
      let { data, error } = await client
        .from('broadcast')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        const fallback1 = await client
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!fallback1.error && fallback1.data) {
          data = fallback1.data;
          error = null;
        } else {
          const fallback2 = await client
            .from('broadcast_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!fallback2.error && fallback2.data) {
            data = fallback2.data;
            error = null;
          }
        }
      }

      if (!error && data) {
        return data.map(normalizeBroadcast);
      }
    } catch (e) {
      console.warn('Fetch broadcast error on client:', e);
    }
    return [];
  };

  // Fetch messages from primary Supabase and shared bridge Supabase (merging & deduplicating)
  const fetchMessages = useCallback(async () => {
    if (!isSupabaseConfigured && !isSharedBroadcastConfigured) {
      setLoading(false);
      return;
    }

    try {
      const fetchTasks = [];
      if (isSupabaseConfigured) {
        fetchTasks.push(fetchFromClient(supabase));
      }
      if (isSharedBroadcastConfigured && sharedBroadcastSupabase) {
        fetchTasks.push(fetchFromClient(sharedBroadcastSupabase));
      }

      const results = await Promise.all(fetchTasks);
      const combined = results.flat();

      if (combined.length > 0) {
        // Deduplicate by ID
        const map = new Map<string, BroadcastMessage>();
        combined.forEach(m => {
          if (!map.has(m.id)) {
            map.set(m.id, m);
          }
        });

        // Sort descending by created_at
        const sorted = Array.from(map.values()).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setMessages(sorted);
        sorted.forEach(m => processedMessageIdsRef.current.add(m.id));
      }
    } catch (e) {
      console.error('Error fetching broadcast messages from database:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to both Supabase Broadcast WebSocket Channels & Postgres Realtime DB tables
  useEffect(() => {
    fetchMessages();

    // 1. Primary Supabase Channel
    let primaryChannel: any = null;
    if (isSupabaseConfigured) {
      try {
        const existingChannels = (supabase as any).getChannels ? (supabase as any).getChannels() : [];
        const match = existingChannels.find((c: any) => c.topic === 'realtime:broadcast_intercom_room');
        if (match) supabase.removeChannel(match);
      } catch (e) {
        console.warn('Primary channel cleanup warning:', e);
      }

      primaryChannel = supabase.channel('broadcast_intercom_room');
      activeChannelRef.current = primaryChannel;

      primaryChannel
        .on('broadcast', { event: 'new_broadcast' }, (payload: any) => {
          const rawItem = payload.payload;
          if (!rawItem) return;
          const item = normalizeBroadcast(rawItem);
          setMessages(prev => (prev.some(m => m.id === item.id) ? prev : [item, ...prev]));
          handleIncomingAlert(item, rawItem.sessionId);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast' }, (payload: any) => {
          const raw = payload.new;
          if (!raw) return;
          const newItem = normalizeBroadcast(raw);
          setMessages(prev => (prev.some(m => m.id === newItem.id) ? prev : [newItem, ...prev]));
          handleIncomingAlert(newItem);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcast' }, (payload: any) => {
          if (payload.old && payload.old.id) {
            setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
          } else {
            fetchMessages();
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload: any) => {
          const raw = payload.new;
          if (!raw) return;
          const newItem = normalizeBroadcast(raw);
          setMessages(prev => (prev.some(m => m.id === newItem.id) ? prev : [newItem, ...prev]));
          handleIncomingAlert(newItem);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcasts' }, (payload: any) => {
          if (payload.old && payload.old.id) {
            setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
          } else {
            fetchMessages();
          }
        })
        .subscribe();
    }

    // 2. Secondary / Shared Supabase Channel (Bridge to 2nd App)
    let sharedChannel: any = null;
    if (isSharedBroadcastConfigured && sharedBroadcastSupabase) {
      try {
        const existingChannels = (sharedBroadcastSupabase as any).getChannels ? (sharedBroadcastSupabase as any).getChannels() : [];
        const match = existingChannels.find((c: any) => c.topic === 'realtime:broadcast_intercom_room');
        if (match) sharedBroadcastSupabase.removeChannel(match);
      } catch (e) {
        console.warn('Shared channel cleanup warning:', e);
      }

      sharedChannel = sharedBroadcastSupabase.channel('broadcast_intercom_room');
      sharedActiveChannelRef.current = sharedChannel;

      sharedChannel
        .on('broadcast', { event: 'new_broadcast' }, (payload: any) => {
          const rawItem = payload.payload;
          if (!rawItem) return;
          const item = normalizeBroadcast(rawItem);
          setMessages(prev => (prev.some(m => m.id === item.id) ? prev : [item, ...prev]));
          handleIncomingAlert(item, rawItem.sessionId);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast' }, (payload: any) => {
          const raw = payload.new;
          if (!raw) return;
          const newItem = normalizeBroadcast(raw);
          setMessages(prev => (prev.some(m => m.id === newItem.id) ? prev : [newItem, ...prev]));
          handleIncomingAlert(newItem);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcast' }, (payload: any) => {
          if (payload.old && payload.old.id) {
            setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
          } else {
            fetchMessages();
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload: any) => {
          const raw = payload.new;
          if (!raw) return;
          const newItem = normalizeBroadcast(raw);
          setMessages(prev => (prev.some(m => m.id === newItem.id) ? prev : [newItem, ...prev]));
          handleIncomingAlert(newItem);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcasts' }, (payload: any) => {
          if (payload.old && payload.old.id) {
            setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
          } else {
            fetchMessages();
          }
        })
        .subscribe();
    }

    return () => {
      if (primaryChannel) {
        try { supabase.removeChannel(primaryChannel); } catch {}
        activeChannelRef.current = null;
      }
      if (sharedChannel && sharedBroadcastSupabase) {
        try { sharedBroadcastSupabase.removeChannel(sharedChannel); } catch {}
        sharedActiveChannelRef.current = null;
      }
    };
  }, [fetchMessages, handleIncomingAlert]);

  // Helper to insert a broadcast into any Supabase client table
  const insertToDatabase = async (client: any, item: BroadcastMessage) => {
    if (!client) return;
    try {
      const payloadData = {
        id: item.id,
        message: item.message,
        content: item.message,
        sender_name: item.sender_name,
        author_name: item.sender_name,
        title: item.title,
        category: item.category,
        priority: item.priority || 'Normal',
        device_info: item.device_info,
        is_active: true,
        created_at: item.created_at
      };

      let { error } = await client.from('broadcast').insert([payloadData]);
      if (error) {
        const minimal = await client.from('broadcast').insert([{
          id: item.id,
          message: item.message,
          sender_name: item.sender_name,
          category: item.category,
          created_at: item.created_at
        }]);

        if (minimal.error) {
          const fallback = await client.from('broadcasts').insert([{
            id: item.id,
            title: item.title,
            content: item.message,
            category: item.category,
            priority: item.priority || 'Normal',
            author_name: item.sender_name,
            created_at: item.created_at
          }]);

          if (fallback.error) {
            await client.from('broadcast_messages').insert([{
              id: item.id,
              sender_name: item.sender_name,
              message: item.message,
              category: item.category,
              device_info: item.device_info,
              created_at: item.created_at
            }]);
          }
        }
      }
    } catch (e) {
      console.warn('Database broadcast insert notice:', e);
    }
  };

  const sendBroadcast = async (data: {
    sender_name: string;
    message: string;
    category?: BroadcastCategory;
    device_info?: string;
  }) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'bc_' + Date.now();
    const category: BroadcastCategory = data.category || 'info';
    const createdAt = new Date().toISOString();
    const cleanSender = data.sender_name.trim() || 'Pos Logistik';
    const cleanMessage = data.message.trim();

    const broadcastItem: BroadcastMessage & { sessionId: string } = {
      id: tempId,
      sender_name: cleanSender,
      author_name: cleanSender,
      message: cleanMessage,
      content: cleanMessage,
      title: cleanMessage.length > 50 ? cleanMessage.substring(0, 47) + '...' : cleanMessage,
      category,
      priority: 'Normal',
      device_info: data.device_info || (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'HP' : 'PC'),
      is_active: true,
      is_pinned: false,
      created_at: createdAt,
      sessionId: SESSION_CLIENT_ID
    };

    processedMessageIdsRef.current.add(tempId);

    // 1. Optimistic local update
    setMessages(prev => [broadcastItem, ...prev.filter(m => m.id !== tempId)]);

    // 2. Broadcast immediately over websocket channels for zero-lag peer reception across both applications
    const broadcastPayload = {
      type: 'broadcast',
      event: 'new_broadcast',
      payload: broadcastItem
    };

    if (activeChannelRef.current) {
      activeChannelRef.current.send(broadcastPayload).catch((e: any) => console.warn('Primary WS broadcast send error:', e));
    }
    if (sharedActiveChannelRef.current) {
      sharedActiveChannelRef.current.send(broadcastPayload).catch((e: any) => console.warn('Shared WS broadcast send error:', e));
    }

    // 3. Concurrently persist to both Supabase Databases (Primary + Shared Bridge)
    const dbTasks = [];
    if (isSupabaseConfigured) {
      dbTasks.push(insertToDatabase(supabase, broadcastItem));
    }
    if (isSharedBroadcastConfigured && sharedBroadcastSupabase) {
      dbTasks.push(insertToDatabase(sharedBroadcastSupabase, broadcastItem));
    }

    await Promise.allSettled(dbTasks);

    return broadcastItem;
  };

  const deleteFromClient = async (client: any, id: string) => {
    if (!client) return;
    try {
      const res1 = await client.from('broadcast').delete().eq('id', id);
      if (res1.error) {
        await client.from('broadcasts').delete().eq('id', id);
        await client.from('broadcast_messages').delete().eq('id', id);
      }
    } catch {}
  };

  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    const tasks = [];
    if (isSupabaseConfigured) tasks.push(deleteFromClient(supabase, id));
    if (isSharedBroadcastConfigured && sharedBroadcastSupabase) tasks.push(deleteFromClient(sharedBroadcastSupabase, id));
    await Promise.allSettled(tasks);
  };

  const clearAllFromClient = async (client: any) => {
    if (!client) return;
    try {
      const res1 = await client.from('broadcast').delete().neq('id', '___NON_EXISTENT___');
      if (res1.error) {
        await client.from('broadcasts').delete().neq('id', '___NON_EXISTENT___');
        await client.from('broadcast_messages').delete().neq('id', '___NON_EXISTENT___');
      }
    } catch {}
  };

  const clearAllMessages = async () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_BROADCAST_CACHE);
    } catch {
      // ignore
    }

    const tasks = [];
    if (isSupabaseConfigured) tasks.push(clearAllFromClient(supabase));
    if (isSharedBroadcastConfigured && sharedBroadcastSupabase) tasks.push(clearAllFromClient(sharedBroadcastSupabase));
    await Promise.allSettled(tasks);
  };

  const dismissIncomingBroadcast = useCallback(() => {
    setIncomingBroadcast(null);
    stopTabAlert();
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  return (
    <BroadcastContext.Provider
      value={{
        messages,
        loading,
        incomingBroadcast,
        soundEnabled,
        notificationPermission,
        isNotificationSupported: isNotificationSupported(),
        isBridgeActive: isSharedBroadcastConfigured,
        bridgeUrl: sharedBroadcastUrl,
        testBridge: testSharedBroadcastConnection,
        saveBridgeCredentials: saveSharedBroadcastCredentials,
        removeBridgeCredentials: removeSharedBroadcastCredentials,
        requestNotificationPermission: requestSysPermission,
        sendBroadcast,
        deleteMessage,
        clearAllMessages,
        dismissIncomingBroadcast,
        toggleSound,
        refetch: fetchMessages,
      }}
    >
      {children}
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error('useBroadcast must be used within a BroadcastProvider');
  }
  return context;
}


