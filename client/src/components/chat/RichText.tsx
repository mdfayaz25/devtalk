import { Check, Copy } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

/** Renders a small, safe subset of Markdown: ```code blocks```, `inline code`, **bold** and links. */
export function RichText({ text, mine }: { text: string; mine?: boolean }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const body = part.slice(3, -3);
          const nl = body.indexOf('\n');
          const lang = nl > 0 && /^[\w+-]{1,15}$/.test(body.slice(0, nl).trim()) ? body.slice(0, nl).trim() : '';
          const code = lang ? body.slice(nl + 1) : body.replace(/^\n/, '');
          return <CodeBlock key={i} code={code.replace(/\n$/, '')} lang={lang} />;
        }
        return <Fragment key={i}>{inline(part, mine)}</Fragment>;
      })}
    </>
  );
}

function inline(text: string, mine?: boolean): ReactNode[] {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
  return tokens.map((t, i) => {
    if (t.startsWith('`') && t.endsWith('`') && t.length > 2)
      return <code key={i} className={`rounded-md px-1.5 py-0.5 font-mono text-[0.85em] ${mine ? 'bg-black/20' : 'bg-surface-3/80 text-brand-300'}`}>{t.slice(1, -1)}</code>;
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4) return <strong key={i} className="font-semibold">{t.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(t)) return <a key={i} href={t} target="_blank" rel="noreferrer noopener" className="underline decoration-current/40 underline-offset-2 hover:decoration-current">{t}</a>;
    return <Fragment key={i}>{t}</Fragment>;
  });
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#0A0C10] text-left">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted">{lang || 'code'}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => undefined)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted transition hover:bg-white/5 hover:text-ink"
        >
          {copied ? <><Check className="h-3 w-3 text-brand-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-[#C9D1E3] scrollbar-thin"><code>{code}</code></pre>
    </div>
  );
}
