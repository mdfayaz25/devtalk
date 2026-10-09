import { LogOut, MessageSquarePlus, Search, Users, Wifi, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Conversation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { convTitle } from '@/lib/conversation';
import { listTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';
import { ConvAvatar } from './ConvAvatar';

type Props = { conversations?: Conversation[]; loading: boolean; onNew: (mode: 'direct' | 'group') => void };

export function Sidebar({ conversations, loading, onNew }: Props) {
  const { user, logout } = useAuth();
  const { typing, connected } = useChat();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'unread' | 'groups'>('all');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (conversations ?? []).filter((c) => {
      if (tab === 'unread' && !c.unread) return false;
      if (tab === 'groups' && c.type !== 'group') return false;
      return !term || convTitle(c, user?.id).toLowerCase().includes(term);
    });
  }, [conversations, q, tab, user?.id]);
  const totalUnread = (conversations ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-surface md:w-[340px]">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Logo />
        <span
          className={cn('ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold', connected ? 'bg-brand-500/10 text-brand-400' : 'bg-amber-500/10 text-amber-400')}
          title={connected ? 'Connected' : 'Reconnecting…'}
        >
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {connected ? 'Live' : 'Offline'}
        </span>
        <div className="ml-auto flex gap-1">
          <IconBtn label="New group" onClick={() => onNew('group')}><Users className="h-[18px] w-[18px]" /></IconBtn>
          <IconBtn label="New message" onClick={() => onNew('direct')}><MessageSquarePlus className="h-[18px] w-[18px]" /></IconBtn>
        </div>
      </div>

      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10" />
        </div>
        <div className="mt-3 flex gap-1 rounded-xl bg-surface-2 p-1 text-xs font-semibold">
          {(['all', 'unread', 'groups'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 capitalize transition', tab === t ? 'bg-surface-3 text-ink shadow-card' : 'text-muted hover:text-ink')}>
              {t}{t === 'unread' && totalUnread > 0 && <span className="tabular rounded-full bg-brand-500 px-1.5 text-[10px] text-brand-900">{totalUnread}</span>}
            </button>
          ))}
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 scrollbar-thin" aria-label="Conversations">
        {loading && Array.from({ length: 6 }, (_, i) => <div key={i} className="mx-2 my-1 h-14 animate-pulse rounded-xl bg-surface-2" />)}
        {!loading && list.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{q ? 'No conversations match.' : 'No conversations yet. Start one!'}</p>}
        {list.map((c) => {
          const isTyping = (typing[c.id] ?? []).filter((id) => id !== user?.id).length > 0;
          const fromMe = c.lastMessage?.sender === user?.id;
          const senderName = c.type === 'group' && !fromMe ? c.members.find((m) => m.user.id === c.lastMessage?.sender)?.user.name.split(' ')[0] : undefined;
          return (
            <NavLink key={c.id} to={`/c/${c.id}`} className={({ isActive }) => cn('group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition', isActive ? 'bg-surface-3/80' : 'hover:bg-surface-2')}>
              <ConvAvatar conv={c} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn('truncate text-sm', c.unread ? 'font-bold' : 'font-semibold')}>{c.type === 'group' && <span className="text-muted">#</span>}{convTitle(c, user?.id)}</p>
                  <span className={cn('tabular shrink-0 text-[11px]', c.unread ? 'font-semibold text-brand-400' : 'text-muted')}>{listTime(c.lastMessage?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-[13px]', isTyping ? 'font-medium text-brand-400' : c.unread ? 'text-ink/90' : 'text-muted')}>
                    {isTyping ? 'typing…' : c.lastMessage ? `${fromMe ? 'You: ' : senderName ? `${senderName}: ` : ''}${c.lastMessage.text}` : 'No messages yet'}
                  </p>
                  {c.unread > 0 && <span className="tabular grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-brand-900">{c.unread > 99 ? '99+' : c.unread}</span>}
                </div>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {user && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Avatar name={user.name} color={user.avatarColor} size={36} online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.title || user.email}</p>
          </div>
          <IconBtn label="Sign out" onClick={logout}><LogOut className="h-4 w-4" /></IconBtn>
        </div>
      )}
    </aside>
  );
}

export function IconBtn({ label, onClick, children, active }: { label: string; onClick?: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn('grid h-9 w-9 place-items-center rounded-lg transition', active ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
      {children}
    </button>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#34D399" />
        <path d="M9 11.5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4.5L11 24v-3.5a3 3 0 0 1-2-2.8z" fill="#06261A" />
        <path d="m13.5 13-1.8 1.6 1.8 1.6M18.5 13l1.8 1.6-1.8 1.6" stroke="#34D399" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px] font-bold tracking-tight">DevTalk</span>
    </span>
  );
}
