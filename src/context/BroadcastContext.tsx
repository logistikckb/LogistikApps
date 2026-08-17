import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
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

  // Fetch messages from database table `broadcast` (with fallback to `broadcasts` / `broadcast_messages`)
  const fetchMessages = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      // 1. Try primary table: 'broadcast'
      let { data, error } = await supabase
        .from('broadcast')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // 2. If 'broadcast' not found or error, try fallback table 'broadcasts'
      if (error) {
        const fallback1 = await supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!fallback1.error && fallback1.data) {
          data = fallback1.data;
          error = null;
        } else {
          // 3. Fallback table 'broadcast_messages'
          const fallback2 = await supabase
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
        const normalized = data.map(normalizeBroadcast);
        setMessages(normalized);
        // Pre-populate processed IDs so initial load doesn't replay sounds
        normalized.forEach(m => processedMessageIdsRef.current.add(m.id));
      }
    } catch (e) {
      console.error('Error fetching broadcast messages from database:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to both Supabase Broadcast WebSocket Channel & Postgres Realtime DB table `broadcast`
  useEffect(() => {
    fetchMessages();

    // Safely remove any existing channel with the same topic to prevent React StrictMode duplicate subscription crashes
    try {
      const existingChannels = (supabase as any).getChannels ? (supabase as any).getChannels() : [];
      const match = existingChannels.find((c: any) => c.topic === 'realtime:broadcast_intercom_room');
      if (match) {
        supabase.removeChannel(match);
      }
    } catch (e) {
      console.warn('Channel cleanup warning:', e);
    }

    // Unique channel instance for this app session
    const channel = supabase.channel('broadcast_intercom_room');
    activeChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'new_broadcast' }, (payload: any) => {
        const rawItem = payload.payload;
        if (!rawItem) return;
        const item = normalizeBroadcast(rawItem);

        // Add to state if not exists
        setMessages(prev => {
          if (prev.some(m => m.id === item.id)) return prev;
          return [item, ...prev];
        });

        // Trigger force multi-device alert
        handleIncomingAlert(item, rawItem.sessionId);
      })
      // Realtime Postgres Changes on table 'broadcast'
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast' }, (payload: any) => {
        const raw = payload.new;
        if (!raw) return;
        const newItem = normalizeBroadcast(raw);

        setMessages(prev => {
          if (prev.some(m => m.id === newItem.id)) return prev;
          return [newItem, ...prev];
        });

        handleIncomingAlert(newItem);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcast' }, (payload: any) => {
        if (payload.old && payload.old.id) {
          setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
        } else {
          fetchMessages();
        }
      })
      // Realtime Postgres Changes on table 'broadcasts' (fallback)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload: any) => {
        const raw = payload.new;
        if (!raw) return;
        const newItem = normalizeBroadcast(raw);

        setMessages(prev => {
          if (prev.some(m => m.id === newItem.id)) return prev;
          return [newItem, ...prev];
        });

        handleIncomingAlert(newItem);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcasts' }, (payload: any) => {
        if (payload.old && payload.old.id) {
          setMessages(prev => prev.filter(m => m.id !== String(payload.old.id)));
        } else {
          fetchMessages();
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Connected successfully
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      activeChannelRef.current = null;
    };
  }, [fetchMessages, handleIncomingAlert]);

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

    // 2. Broadcast immediately over websocket channel for zero-lag peer reception across all connected devices
    try {
      if (activeChannelRef.current) {
        await activeChannelRef.current.send({
          type: 'broadcast',
          event: 'new_broadcast',
          payload: broadcastItem
        });
      }
    } catch (err) {
      console.warn('Broadcast channel delivery note:', err);
    }

    // 3. Persist to Supabase Database table `broadcast` (with flexible payload)
    if (isSupabaseConfigured) {
      try {
        const payloadData = {
          id: tempId,
          message: cleanMessage,
          content: cleanMessage,
          sender_name: cleanSender,
          author_name: cleanSender,
          title: cleanMessage.length > 50 ? cleanMessage.substring(0, 47) + '...' : cleanMessage,
          category: category,
          priority: 'Normal',
          device_info: broadcastItem.device_info,
          is_active: true,
          created_at: createdAt
        };

        // Try primary table 'broadcast'
        let { error } = await supabase.from('broadcast').insert([payloadData]);

        // If table 'broadcast' has schema restriction or error, try fallback formats
        if (error) {
          console.warn('Initial insert to table broadcast result:', error.message);
          
          const minimalBroadcast = await supabase.from('broadcast').insert([{
            id: tempId,
            message: cleanMessage,
            sender_name: cleanSender,
            category: category,
            created_at: createdAt
          }]);

          if (minimalBroadcast.error) {
            const fallbackBroadcasts = await supabase.from('broadcasts').insert([{
              id: tempId,
              title: cleanMessage.length > 50 ? cleanMessage.substring(0, 47) + '...' : cleanMessage,
              content: cleanMessage,
              category: 'Pengumuman',
              priority: 'Normal',
              author_name: cleanSender,
              created_at: createdAt
            }]);

            if (fallbackBroadcasts.error) {
              await supabase.from('broadcast_messages').insert([{
                id: tempId,
                sender_name: cleanSender,
                message: cleanMessage,
                category: category,
                device_info: broadcastItem.device_info,
                created_at: createdAt
              }]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to save broadcast to database table broadcast:', e);
      }
    }

    return broadcastItem;
  };

  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (isSupabaseConfigured) {
      try {
        const res1 = await supabase.from('broadcast').delete().eq('id', id);
        if (res1.error) {
          await supabase.from('broadcasts').delete().eq('id', id);
          await supabase.from('broadcast_messages').delete().eq('id', id);
        }
      } catch (e) {
        console.error('Error deleting broadcast message from database:', e);
      }
    }
  };

  const clearAllMessages = async () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_BROADCAST_CACHE);
    } catch {
      // ignore
    }

    if (isSupabaseConfigured) {
      try {
        const res1 = await supabase.from('broadcast').delete().neq('id', '___NON_EXISTENT___');
        if (res1.error) {
          await supabase.from('broadcasts').delete().neq('id', '___NON_EXISTENT___');
          await supabase.from('broadcast_messages').delete().neq('id', '___NON_EXISTENT___');
        }
      } catch (e) {
        console.error('Error clearing all broadcast messages from database:', e);
      }
    }
  };

  const dismissIncomingBroadcast = () => {
    setIncomingBroadcast(null);
    stopTabAlert();
  };

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  return (
    <BroadcastContext.Provider
      value={{
        messages,
        loading,
        incomingBroadcast,
        soundEnabled,
        notificationPermission,
        isNotificationSupported: isNotificationSupported(),
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

