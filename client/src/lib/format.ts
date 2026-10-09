export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

export const clock = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function listTime(d?: string) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return clock(d);
  const diff = (now.getTime() - date.getTime()) / 864e5;
  if (diff < 6) return date.toLocaleDateString('en-IN', { weekday: 'short' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function lastSeenText(iso?: string) {
  if (!iso) return 'Offline';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  return `Last seen ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}
