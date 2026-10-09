import { useQuery } from '@tanstack/react-query';
import { Code2, MessageSquarePlus, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Conversation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { convTitle } from '@/lib/conversation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [newMode, setNewMode] = useState<'direct' | 'group' | null>(null);
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get<{ conversations: Conversation[] }>('/conversations')).data.conversations,
  });
  const active = conversations?.find((c) => c.id === id);

  useEffect(() => {
    const unread = conversations?.reduce((n, c) => n + c.unread, 0) ?? 0;
    document.title = `${unread ? `(${unread}) ` : ''}${active ? `${convTitle(active, user?.id)} · ` : ''}DevTalk`;
  }, [conversations, active, user?.id]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn('h-full w-full md:w-auto', id && 'hidden md:block')}>
        <Sidebar conversations={conversations} loading={isLoading} onNew={setNewMode} />
      </div>
      <main className={cn('h-full min-w-0 flex-1', !id && 'hidden md:flex')}>
        {active ? (
          <ChatView key={active.id} conv={active} />
        ) : (
          <div className="grid-bg grid h-full w-full place-items-center p-8">
            <div className="max-w-md text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/15 text-brand-400 shadow-glow"><Code2 className="h-8 w-8" /></span>
              <h1 className="mt-6 text-2xl font-bold">{id && !isLoading ? 'Conversation not found' : `Welcome, ${user?.name.split(' ')[0]}`}</h1>
              <p className="mt-2 text-muted">Pick a conversation on the left, or start a new one. Messages, reactions and typing show up live for everyone.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setNewMode('direct')}><MessageSquarePlus className="h-4 w-4" /> New message</Button>
                <Button variant="outline" onClick={() => setNewMode('group')}><Users className="h-4 w-4" /> New group</Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-3 text-left text-xs text-muted">
                {[['Real-time', 'Socket.io rooms per chat'], ['Code blocks', 'Wrap code in ```'], ['Files', 'Drop, paste or attach']].map(([t, s]) => (
                  <div key={t} className="rounded-xl border border-line bg-surface p-3"><Zap className="mb-2 h-4 w-4 text-brand-400" /><p className="font-semibold text-ink">{t}</p><p>{s}</p></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <NewChatModal mode={newMode} onClose={() => setNewMode(null)} />
    </div>
  );
}
