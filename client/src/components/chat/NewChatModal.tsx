import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { upsertConversation } from '@/lib/chatCache';
import type { Conversation, Person } from '@/types';
import { useChat } from '@/context/ChatContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { cn } from '@/lib/utils';

const COLORS = ['#34D399', '#60A5FA', '#F472B6', '#FBBF24', '#A78BFA', '#FB923C'];

export function NewChatModal({ mode, onClose }: { mode: 'direct' | 'group' | null; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const { online } = useChat();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => { if (mode) { setQ(''); setPicked([]); setName(''); } }, [mode]);

  const { data: people, isLoading } = useQuery({
    queryKey: ['people', q],
    queryFn: async () => (await api.get<{ users: Person[] }>('/users', { params: { search: q || undefined } })).data.users,
    enabled: Boolean(mode),
  });

  const done = (c: Conversation) => { upsertConversation(qc, c); qc.invalidateQueries({ queryKey: ['conversations'] }); onClose(); navigate(`/c/${c.id}`); };
  const direct = useMutation({ mutationFn: async (userId: string) => (await api.post<{ conversation: Conversation }>('/conversations/direct', { userId })).data.conversation, onSuccess: done, onError: (e) => toast.error(getErrorMessage(e)) });
  const group = useMutation({
    mutationFn: async () => (await api.post<{ conversation: Conversation }>('/conversations/group', { name, color, memberIds: picked.map((p) => p.id) })).data.conversation,
    onSuccess: (c) => { toast.success(`#${c.name} created`); done(c); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggle = (p: Person) => setPicked((l) => (l.some((x) => x.id === p.id) ? l.filter((x) => x.id !== p.id) : [...l, p]));

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={mode === 'group' ? 'New group' : 'New message'}>
      {mode === 'group' && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">#</span>
            <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="group-name" maxLength={60} className="pl-8 font-mono" aria-label="Group name" />
          </div>
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-ink')} style={{ background: c }} />)}</div>
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <button key={p.id} onClick={() => toggle(p)} className="flex items-center gap-1.5 rounded-full bg-brand-500/15 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-brand-300">
                  <Avatar name={p.name} color={p.avatarColor} size={20} /> {p.name.split(' ')[0]} ×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name, email or role" className="pl-10" aria-label="Search people" />
      </div>
      <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto scrollbar-thin">
        {isLoading && <li className="py-6 text-center text-sm text-muted">Loading…</li>}
        {people?.length === 0 && <li className="py-6 text-center text-sm text-muted">Nobody found.</li>}
        {people?.map((p) => {
          const sel = picked.some((x) => x.id === p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => (mode === 'direct' ? direct.mutate(p.id) : toggle(p))}
                disabled={direct.isPending}
                className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-2', sel && 'bg-brand-500/10')}
              >
                <Avatar name={p.name} color={p.avatarColor} size={38} online={online.has(p.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted">{p.title || p.email}</p>
                </div>
                {mode === 'group' && <span className={cn('grid h-5 w-5 place-items-center rounded-md border', sel ? 'border-brand-500 bg-brand-500 text-brand-900' : 'border-line')}>{sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {mode === 'group' && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (name.trim().length < 2) return toast.error('Give the group a name'); if (!picked.length) return toast.error('Add at least one person'); group.mutate(); }} loading={group.isPending}>
            Create group
          </Button>
        </div>
      )}
    </Modal>
  );
}
