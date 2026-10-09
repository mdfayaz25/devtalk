import { FileText, Loader2, Paperclip, SendHorizonal, Smile, X } from 'lucide-react';
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { formatBytes } from '@/lib/format';
import type { Attachment, Message } from '@/types';
import { cn } from '@/lib/utils';
import { QUICK_REACTIONS } from './MessageBubble';

type Props = {
  conversationId: string;
  placeholder: string;
  replyTo: Message | null;
  editing: Message | null;
  onCancel: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onEdit: (id: string, text: string) => void;
};

export function Composer({ conversationId, placeholder, replyTo, editing, onCancel, onSend, onEdit }: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<{ on: boolean; timer?: ReturnType<typeof setTimeout> }>({ on: false });

  useEffect(() => { setText(''); setFiles([]); ref.current?.focus(); }, [conversationId]);
  useEffect(() => { if (editing) { setText(editing.text); ref.current?.focus(); } }, [editing]);
  useEffect(() => { if (replyTo) ref.current?.focus(); }, [replyTo]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const setTyping = (on: boolean) => {
    const t = typingRef.current;
    clearTimeout(t.timer);
    if (on) t.timer = setTimeout(() => setTyping(false), 2500);
    if (t.on === on) return;
    t.on = on;
    getSocket()?.emit('typing', { conversationId, isTyping: on });
  };
  useEffect(() => () => setTyping(false), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (list: FileList | File[]) => {
    const arr = [...list].slice(0, 6 - files.length);
    if (!arr.length) return;
    if (arr.some((f) => f.size > 10 * 1024 * 1024)) return toast.error('Files must be 10 MB or smaller');
    const form = new FormData();
    arr.forEach((f) => form.append('files', f));
    setUploading(true);
    try {
      const { data } = await api.post<{ files: Attachment[] }>('/uploads', form);
      setFiles((f) => [...f, ...data.files]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    const value = text.trim();
    if (editing) {
      if (value && value !== editing.text) onEdit(editing.id, value);
      setText('');
      onCancel();
      return;
    }
    if (!value && !files.length) return;
    onSend(value, files);
    setText('');
    setFiles([]);
    setTyping(false);
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); };
  const onPaste = (e: ClipboardEvent) => { const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/')); if (imgs.length) { e.preventDefault(); upload(imgs); } };

  return (
    <div className="px-3 pb-3 sm:px-6 sm:pb-5" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className={cn('rounded-2xl border bg-surface transition', dragging ? 'border-brand-500 shadow-glow' : 'border-line focus-within:border-brand-500/50 focus-within:shadow-glow')}>
        {(replyTo || editing) && (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs">
            <span className="h-6 w-0.5 rounded-full bg-brand-500" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-400">{editing ? 'Editing message' : `Replying to ${replyTo!.sender.name}`}</p>
              {replyTo && <p className="truncate text-muted">{replyTo.text || 'Attachment'}</p>}
            </div>
            <button onClick={() => { onCancel(); if (editing) setText(''); }} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div>
        )}
        {(files.length > 0 || uploading) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {files.map((f) => (
              <div key={f.url} className="relative">
                {f.mime.startsWith('image/') ? (
                  <img src={f.url} alt={f.name} className="h-16 w-16 rounded-xl border border-line object-cover" />
                ) : (
                  <div className="flex h-16 w-44 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
                    <FileText className="h-5 w-5 shrink-0 text-brand-400" />
                    <div className="min-w-0 text-xs"><p className="truncate font-semibold">{f.name}</p><p className="text-muted">{formatBytes(f.size)}</p></div>
                  </div>
                )}
                <button onClick={() => setFiles((l) => l.filter((x) => x.url !== f.url))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-ink ring-2 ring-surface" aria-label={`Remove ${f.name}`}><X className="h-3 w-3" /></button>
              </div>
            ))}
            {uploading && <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-line"><Loader2 className="h-5 w-5 animate-spin text-brand-400" /></div>}
          </div>
        )}
        <div className="flex items-end gap-1 p-2">
          <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Attach files" title="Attach files (or drop / paste)"><Paperclip className="h-5 w-5" /></button>
          <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.zip,.txt,.md,.csv,.json" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
          <div className="relative">
            <button onClick={() => setEmoji((v) => !v)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Emoji"><Smile className="h-5 w-5" /></button>
            {emoji && (
              <div className="absolute bottom-12 left-0 z-20 flex gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-pop">
                {[...QUICK_REACTIONS, '🙏', '✅', '🚀', '💯'].map((e) => <button key={e} onClick={() => { setText((t) => t + e); setEmoji(false); ref.current?.focus(); }} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-surface-2">{e}</button>)}
              </div>
            )}
          </div>
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); setTyping(e.target.value.length > 0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
              if (e.key === 'Escape' && (replyTo || editing)) { onCancel(); if (editing) setText(''); }
            }}
            onPaste={onPaste}
            placeholder={placeholder}
            maxLength={4000}
            className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] leading-snug outline-none placeholder:text-muted"
            aria-label="Message"
          />
          <button onClick={submit} disabled={(!text.trim() && !files.length) || uploading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-brand-900 transition hover:bg-brand-400 disabled:bg-surface-2 disabled:text-muted" aria-label="Send">
            <SendHorizonal className="h-5 w-5" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 hidden px-2 text-[11px] text-muted sm:block"><span className="kbd">Enter</span> to send · <span className="kbd">Shift</span> + <span className="kbd">Enter</span> for a new line · wrap code in <span className="font-mono">```</span></p>
    </div>
  );
}
