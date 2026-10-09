import { AnimatePresence, motion } from 'framer-motion';
import { FileText, LogOut, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Conversation, Message } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { convTitle } from '@/lib/conversation';
import { formatBytes, lastSeenText } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import { ConvAvatar } from './ConvAvatar';

export function InfoPanel({ conv, open, onClose, messages, onImage }: { conv: Conversation; open: boolean; onClose: () => void; messages: Message[]; onImage: (url: string) => void }) {
  const { user } = useAuth();
  const { online, lastSeen } = useChat();
  const navigate = useNavigate();
  const shared = messages.filter((m) => !m.deletedAt).flatMap((m) => m.attachments).reverse();
  const images = shared.filter((a) => a.mime.startsWith('image/'));
  const files = shared.filter((a) => !a.mime.startsWith('image/'));
  const members = [...conv.members].sort((a, b) => Number(online.has(b.user.id)) - Number(online.has(a.user.id)));

  const leave = () =>
    api.delete(`/conversations/${conv.id}/members/${user!.id}`).then(() => { toast.success(`You left #${conv.name}`); navigate('/'); }).catch((e) => toast.error(getErrorMessage(e)));

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          className="fixed inset-y-0 right-0 z-40 overflow-hidden border-l border-line bg-surface lg:static"
        >
          <div className="flex h-full w-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="font-bold">Details</p>
              <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close details"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5 scrollbar-thin">
              <div className="text-center">
                <div className="mx-auto w-fit"><ConvAvatar conv={conv} size={72} /></div>
                <p className="mt-3 text-lg font-bold">{conv.type === 'group' && '#'}{convTitle(conv, user?.id)}</p>
                {conv.topic && <p className="mt-1 text-sm text-muted">{conv.topic}</p>}
              </div>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted">Members · {conv.members.length}</p>
                <ul className="space-y-1">
                  {members.map((m) => (
                    <li key={m.user.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                      <Avatar name={m.user.name} color={m.user.avatarColor} size={34} online={online.has(m.user.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.user.name}{m.user.id === user?.id && <span className="font-normal text-muted"> (you)</span>}</p>
                        <p className="truncate text-xs text-muted">{online.has(m.user.id) ? <span className="text-brand-400">Online</span> : lastSeenText(lastSeen[m.user.id] ?? m.user.lastSeen)}{m.user.title && ` · ${m.user.title}`}</p>
                      </div>
                      {m.role === 'admin' && conv.type === 'group' && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">Admin</span>}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted">Shared media · {images.length}</p>
                {images.length ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.slice(0, 9).map((a) => <button key={a.url} onClick={() => onImage(a.url)} className="aspect-square overflow-hidden rounded-lg border border-line"><img src={a.url} alt={a.name} className="h-full w-full object-cover" /></button>)}
                  </div>
                ) : <p className="text-sm text-muted">No images yet.</p>}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted">Files · {files.length}</p>
                {files.length ? (
                  <ul className="space-y-1.5">
                    {files.map((f) => (
                      <li key={f.url}>
                        <a href={f.url} download={f.name} className="flex items-center gap-3 rounded-xl border border-line p-2.5 hover:border-brand-500/40">
                          <FileText className="h-5 w-5 shrink-0 text-brand-400" />
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{f.name}</span><span className="text-xs text-muted">{formatBytes(f.size)}</span></span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">No files yet.</p>}
              </section>

              {conv.type === 'group' && (
                <button onClick={leave} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> Leave group
                </button>
              )}
              <p className="text-center text-xs text-muted">{formatBytes(shared.reduce((n, a) => n + a.size, 0))} shared in loaded messages</p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
