import { CornerUpLeft, FileText, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import type { Message } from '@/types';
import { formatBytes, clock } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';
import { RichText } from './RichText';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];

type Props = {
  msg: Message;
  mine: boolean;
  showHeader: boolean;
  meId?: string;
  seen?: boolean;
  onReact: (id: string, emoji: string) => void;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onImage: (url: string) => void;
};

export const MessageBubble = memo(function MessageBubble({ msg, mine, showHeader, meId, seen, onReact, onReply, onEdit, onDelete, onImage }: Props) {
  const [picker, setPicker] = useState(false);
  const deleted = Boolean(msg.deletedAt);
  const images = msg.attachments.filter((a) => a.mime.startsWith('image/'));
  const files = msg.attachments.filter((a) => !a.mime.startsWith('image/'));
  const hasCode = msg.text.includes('```');

  return (
    <div className={cn('group relative flex gap-2.5 px-4 animate-msg-in sm:px-6', mine ? 'flex-row-reverse' : '', showHeader ? 'mt-4' : 'mt-0.5')} onMouseLeave={() => setPicker(false)}>
      <div className="w-8 shrink-0">{!mine && showHeader && <Avatar name={msg.sender.name} color={msg.sender.avatarColor} size={32} />}</div>

      <div className={cn('flex min-w-0 max-w-[min(78%,640px)] flex-col', mine ? 'items-end' : 'items-start', hasCode && 'w-full')}>
        {showHeader && (
          <p className={cn('mb-1 flex items-baseline gap-2 text-xs', mine && 'flex-row-reverse')}>
            {!mine && <span className="font-semibold" style={{ color: msg.sender.avatarColor }}>{msg.sender.name}</span>}
            <span className="tabular text-muted">{clock(msg.createdAt)}</span>
          </p>
        )}

        {msg.replyTo && !deleted && (
          <div className={cn('mb-1 max-w-full truncate rounded-lg border-l-2 border-brand-500/70 bg-surface-2/80 px-2.5 py-1 text-xs text-muted')}>
            <span className="font-semibold text-ink/80">{msg.replyTo.sender?.name}</span> · {msg.replyTo.deletedAt ? 'Message deleted' : msg.replyTo.text || (msg.replyTo.attachments.length ? 'Attachment' : '')}
          </div>
        )}

        {deleted ? (
          <div className="rounded-2xl border border-dashed border-line px-3.5 py-2 text-sm italic text-muted">This message was deleted</div>
        ) : (
          <>
            {images.length > 0 && (
              <div className={cn('mb-1 grid gap-1', images.length > 1 && 'grid-cols-2')}>
                {images.map((a) => (
                  <button key={a.url} onClick={() => onImage(a.url)} className="overflow-hidden rounded-2xl border border-line bg-surface-2 transition hover:opacity-90" aria-label={`Open ${a.name}`}>
                    <img src={a.url} alt={a.name} loading="lazy" className="max-h-72 w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {files.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" download={a.name} className="mb-1 flex w-64 max-w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 transition hover:border-brand-500/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400"><FileText className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="text-xs text-muted">{formatBytes(a.size)} · {a.name.split('.').pop()?.toUpperCase()}</span>
                </span>
              </a>
            ))}
            {msg.text && (
              <div
                className={cn(
                  'whitespace-pre-wrap break-words px-3.5 py-2 text-[14.5px] leading-relaxed',
                  hasCode && 'w-full',
                  mine ? 'rounded-2xl rounded-tr-md bg-brand-500 text-brand-900' : 'rounded-2xl rounded-tl-md bg-surface-2 text-ink',
                  msg.pending && 'opacity-60',
                )}
              >
                <RichText text={msg.text} mine={mine} />
                {msg.editedAt && <span className={cn('ml-1.5 text-[11px]', mine ? 'text-brand-900/60' : 'text-muted')}>(edited)</span>}
              </div>
            )}
          </>
        )}

        {msg.reactions.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
            {msg.reactions.map((r) => {
              const reacted = meId ? r.users.includes(meId) : false;
              return (
                <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)} className={cn('tabular flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition', reacted ? 'border-brand-500/50 bg-brand-500/15 text-brand-300' : 'border-line bg-surface-2 text-muted hover:border-ink/20')}>
                  <span>{r.emoji}</span> {r.users.length}
                </button>
              );
            })}
          </div>
        )}
        {mine && seen && <p className="mt-1 text-[11px] font-medium text-brand-400/80">Seen</p>}
      </div>

      {!deleted && !msg.pending && (
        <div className={cn('pointer-events-none absolute -top-3 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 opacity-0 shadow-lift transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100', mine ? 'left-14 sm:left-20' : 'right-6 sm:right-10')}>
          {picker ? (
            QUICK_REACTIONS.map((e) => <button key={e} onClick={() => { onReact(msg.id, e); setPicker(false); }} className="grid h-8 w-8 place-items-center rounded-lg text-base transition hover:scale-125 hover:bg-surface-2" aria-label={`React ${e}`}>{e}</button>)
          ) : (
            <>
              <ToolBtn label="Add reaction" onClick={() => setPicker(true)}><SmilePlus className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Reply" onClick={() => onReply(msg)}><CornerUpLeft className="h-4 w-4" /></ToolBtn>
              {mine && msg.text && <ToolBtn label="Edit" onClick={() => onEdit(msg)}><Pencil className="h-4 w-4" /></ToolBtn>}
              {mine && <ToolBtn label="Delete" onClick={() => onDelete(msg)} danger><Trash2 className="h-4 w-4" /></ToolBtn>}
            </>
          )}
        </div>
      )}
    </div>
  );
});

function ToolBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn('grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2', danger ? 'hover:text-red-400' : 'hover:text-ink')}>
      {children}
    </button>
  );
}
