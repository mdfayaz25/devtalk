import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Conversation, Message } from '@/types';

export type Page = { messages: Message[]; hasMore: boolean };
export type Pages = InfiniteData<Page, string | undefined>;

export const messagesKey = (id: string) => ['messages', id] as const;

/** Adds or replaces a message in the conversation's cache. Newest page is pages[0]. */
export function upsertMessage(qc: QueryClient, msg: Message, replaceId?: string) {
  qc.setQueryData<Pages>(messagesKey(msg.conversation), (data) => {
    if (!data) return data;
    let found = false;
    const pages = data.pages.map((p) => ({
      ...p,
      messages: p.messages
        .filter((m) => m.id !== replaceId)
        .map((m) => {
          if (m.id !== msg.id) return m;
          found = true;
          return msg;
        }),
    }));
    if (!found) {
      const first = pages[0] ?? { messages: [], hasMore: false };
      pages[0] = { ...first, messages: [...first.messages, msg] };
    }
    return { ...data, pages };
  });
}

export function upsertConversation(qc: QueryClient, conv: Conversation) {
  qc.setQueryData<Conversation[]>(['conversations'], (list) => {
    if (!list) return list;
    const next = [conv, ...list.filter((c) => c.id !== conv.id)];
    return next.sort((a, b) => new Date(b.lastMessage?.createdAt ?? b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt ?? a.updatedAt).getTime());
  });
}

export const flatten = (data?: { pages: Page[] }) => (data ? [...data.pages].reverse().flatMap((p) => p.messages) : []);
