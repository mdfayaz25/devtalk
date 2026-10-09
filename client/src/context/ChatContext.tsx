import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSocket } from '@/lib/socket';
import { upsertConversation, upsertMessage } from '@/lib/chatCache';
import type { Conversation, Message } from '@/types';
import { useAuth } from './AuthContext';

type Typing = Record<string, string[]>; // conversationId -> userIds

type ChatState = {
  online: Set<string>;
  typing: Typing;
  lastSeen: Record<string, string>;
  connected: boolean;
};

const ChatContext = createContext<ChatState>({ online: new Set(), typing: {}, lastSeen: {}, connected: false });

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<Typing>({});
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const stopTyping = (conversationId: string, userId: string) =>
      setTyping((t) => ({ ...t, [conversationId]: (t[conversationId] ?? []).filter((id) => id !== userId) }));

    const handlers = {
      connect: () => setConnected(true),
      disconnect: () => setConnected(false),
      'presence:list': ({ userIds }: { userIds: string[] }) => setOnline(new Set(userIds)),
      presence: ({ userId, online: on, lastSeen: seen }: { userId: string; online: boolean; lastSeen?: string }) => {
        setOnline((s) => { const n = new Set(s); if (on) n.add(userId); else n.delete(userId); return n; });
        if (seen) setLastSeen((l) => ({ ...l, [userId]: seen }));
      },
      typing: ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
        const key = `${conversationId}:${userId}`;
        clearTimeout(timers.get(key));
        if (!isTyping) return stopTyping(conversationId, userId);
        setTyping((t) => ({ ...t, [conversationId]: [...new Set([...(t[conversationId] ?? []), userId])] }));
        timers.set(key, setTimeout(() => stopTyping(conversationId, userId), 5000));
      },
      'message:new': (m: Message) => {
        upsertMessage(qc, m);
        stopTyping(m.conversation, m.sender.id);
      },
      'message:updated': (m: Message) => upsertMessage(qc, m),
      'conversation:updated': (c: Conversation) => upsertConversation(qc, c),
      'conversation:removed': ({ id }: { id: string }) => qc.setQueryData<Conversation[]>(['conversations'], (l) => l?.filter((c) => c.id !== id)),
      read: ({ conversationId, userId, at }: { conversationId: string; userId: string; at: string }) =>
        qc.setQueryData<Conversation[]>(['conversations'], (l) =>
          l?.map((c) => (c.id === conversationId ? { ...c, members: c.members.map((m) => (m.user.id === userId ? { ...m, lastReadAt: at } : m)) } : c)),
        ),
    } as const;

    setConnected(socket.connected);
    Object.entries(handlers).forEach(([e, h]) => socket.on(e, h as (...a: unknown[]) => void));
    return () => {
      Object.entries(handlers).forEach(([e, h]) => socket.off(e, h as (...a: unknown[]) => void));
      timers.forEach(clearTimeout);
    };
  }, [user, qc]);

  const value = useMemo(() => ({ online, typing, lastSeen, connected }), [online, typing, lastSeen, connected]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
