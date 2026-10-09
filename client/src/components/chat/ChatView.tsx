import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, Info, Loader2, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { flatten, messagesKey, upsertMessage, type Page } from '@/lib/chatCache';
import { convTitle, otherMember } from '@/lib/conversation';
import { dayLabel, lastSeenText } from '@/lib/format';
import type { Attachment, Conversation, Message } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { ConvAvatar } from './ConvAvatar';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { InfoPanel } from './InfoPanel';
import { IconBtn } from './Sidebar';

export function ChatView({ conv }: { conv: Conversation }) {
  const { user } = useAuth();
  const { online, typing, lastSeen } = useChat();
  const qc = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: messagesKey(conv.id),
    queryFn: async ({ pageParam }) => (await api.get<Page>(`/conversations/${conv.id}/messages`, { params: { before: pageParam, limit: 40 } })).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.id : undefined),
  });
  const messages = useMemo(() => flatten(query.data), [query.data]);

  // Mark as read on open and whenever new messages arrive while the chat is visible.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastId || document.visibilityState !== 'visible') return;
    api.post(`/conversations/${conv.id}/read`).catch(() => undefined);
    qc.setQueryData<Conversation[]>(['conversations'], (l) => l?.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)));
  }, [conv.id, lastId, qc]);

  // Load older messages when the top sentinel scrolls into view, keeping the scroll position steady.
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        prevHeight.current = scroller.current?.scrollHeight ?? null;
        query.fetchNextPage();
      }
    }, { root: scroller.current, rootMargin: '200px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowJump(true);
    }
  }, [messages.length]);

  useEffect(() => { atBottom.current = true; setReplyTo(null); setEditing(null); setShowJump(false); }, [conv.id]);

  // Images and code blocks change height after they render; stay pinned to the bottom if we were there.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const ro = new ResizeObserver(() => { if (atBottom.current && prevHeight.current === null) el.scrollTop = el.scrollHeight; });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current!;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setShowJump(false);
  };
  const jump = () => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); setShowJump(false); };

  const send = useMutation({
    mutationFn: async ({ text, attachments, replyId }: { text: string; attachments: Attachment[]; replyId?: string; tempId: string }) =>
      (await api.post<{ message: Message }>(`/conversations/${conv.id}/messages`, { text, attachments, replyTo: replyId })).data.message,
    onMutate: ({ text, attachments, tempId }) => {
      atBottom.current = true;
      upsertMessage(qc, { id: tempId, conversation: conv.id, sender: { id: user!.id, name: user!.name, avatarColor: user!.avatarColor }, text, attachments, reactions: [], replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, sender: { id: replyTo.sender.id, name: replyTo.sender.name }, attachments: replyTo.attachments } : null, createdAt: new Date().toISOString(), pending: true });
    },
    onSuccess: (m, { tempId }) => upsertMessage(qc, m, tempId),
    onError: (e, { tempId }) => {
      qc.setQueryData(messagesKey(conv.id), (d: typeof query.data) => d && { ...d, pages: d.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== tempId) })) });
      toast.error(getErrorMessage(e));
    },
  });
  const react = useCallback((id: string, emoji: string) => { api.post(`/messages/${id}/reactions`, { emoji }).then((r) => upsertMessage(qc, r.data.message)).catch((e) => toast.error(getErrorMessage(e))); }, [qc]);
  const edit = (id: string, text: string) => api.patch(`/messages/${id}`, { text }).then((r) => upsertMessage(qc, r.data.message)).catch((e) => toast.error(getErrorMessage(e)));
  const remove = useCallback((m: Message) => { if (window.confirm('Delete this message for everyone?')) api.delete(`/messages/${m.id}`).then((r) => upsertMessage(qc, r.data.message)).catch((e) => toast.error(getErrorMessage(e))); }, [qc]);
  const onReply = useCallback((m: Message) => { setEditing(null); setReplyTo(m); }, []);
  const onEdit = useCallback((m: Message) => { setReplyTo(null); setEditing(m); }, []);

  const other = conv.type === 'direct' ? otherMember(conv, user?.id) : undefined;
  const typers = (typing[conv.id] ?? []).filter((id) => id !== user?.id).map((id) => conv.members.find((m) => m.user.id === id)?.user.name.split(' ')[0]).filter(Boolean) as string[];
  const onlineCount = conv.members.filter((m) => online.has(m.user.id)).length;
  const status = typers.length
    ? `${typers.join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing…`
    : conv.type === 'group'
      ? `${conv.members.length} members · ${onlineCount} online`
      : other && online.has(other.id) ? 'Online' : lastSeenText(other ? lastSeen[other.id] ?? other.lastSeen : undefined);

  // "Seen" goes under my latest message once the other person has read past it (DMs only).
  const otherRead = conv.type === 'direct' ? conv.members.find((m) => m.user.id !== user?.id)?.lastReadAt : undefined;
  const lastMine = [...messages].reverse().find((m) => m.sender.id === user?.id && !m.pending);
  const seenId = lastMine && otherRead && new Date(otherRead) >= new Date(lastMine.createdAt) ? lastMine.id : undefined;

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface/80 px-3 py-2.5 backdrop-blur sm:px-5">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 md:hidden" aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></Link>
          <ConvAvatar conv={conv} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold">{conv.type === 'group' && <span className="text-muted">#</span>}{convTitle(conv, user?.id)}</h1>
            <p className={cn('truncate text-xs', typers.length || (other && online.has(other.id)) ? 'text-brand-400' : 'text-muted')}>{status}</p>
          </div>
          <IconBtn label="Conversation details" onClick={() => setInfoOpen((o) => !o)} active={infoOpen}><Info className="h-[18px] w-[18px]" /></IconBtn>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={scroller} onScroll={onScroll} className="grid-bg h-full overflow-y-auto pb-4 pt-2 scrollbar-thin" aria-live="polite">
            <div ref={content}>
            <div ref={topRef} />
            {query.isFetchingNextPage && <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>}
            {query.isLoading && <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-400" /></div>}
            {!query.isLoading && !query.hasNextPage && (
              <div className="px-6 pb-2 pt-8 text-center">
                <div className="mx-auto mb-3 w-fit"><ConvAvatar conv={conv} size={64} /></div>
                <p className="text-lg font-bold">{conv.type === 'group' ? `Welcome to #${conv.name}` : convTitle(conv, user?.id)}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{conv.type === 'group' ? conv.topic || 'This is the start of the group.' : `This is the beginning of your conversation with ${other?.name.split(' ')[0]}.`}</p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const showHeader = newDay || !prev || prev.sender.id !== m.sender.id || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 6e4;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="sticky top-2 z-10 my-4 flex justify-center">
                      <span className="rounded-full border border-line bg-surface/90 px-3 py-1 text-[11px] font-semibold text-muted backdrop-blur">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <MessageBubble msg={m} mine={m.sender.id === user?.id} showHeader={showHeader} meId={user?.id} seen={m.id === seenId} onReact={react} onReply={onReply} onEdit={onEdit} onDelete={remove} onImage={setLightbox} />
                </Fragment>
              );
            })}
            <AnimatePresence>
              {typers.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2 px-4 sm:px-6">
                  <span className="w-8" />
                  <span className="flex gap-1 rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-3" aria-label={status}>
                    {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-blink rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
          {showJump && (
            <button onClick={jump} className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-2 text-xs font-bold text-brand-900 shadow-glow">
              <ArrowDown className="h-3.5 w-3.5" /> New messages
            </button>
          )}
        </div>

        <Composer
          conversationId={conv.id}
          placeholder={`Message ${conv.type === 'group' ? `#${conv.name}` : other?.name.split(' ')[0] ?? ''}`}
          replyTo={replyTo}
          editing={editing}
          onCancel={() => { setReplyTo(null); setEditing(null); }}
          onSend={(text, attachments) => { send.mutate({ text, attachments, replyId: replyTo?.id, tempId: `tmp-${Date.now()}` }); setReplyTo(null); }}
          onEdit={edit}
        />
      </section>

      <InfoPanel conv={conv} open={infoOpen} onClose={() => setInfoOpen(false)} messages={messages} onImage={setLightbox} />

      <AnimatePresence>
        {lightbox && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)}>
            <button className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Close"><X className="h-5 w-5" /></button>
            <motion.img initial={{ scale: 0.96 }} animate={{ scale: 1 }} src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl shadow-pop" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
