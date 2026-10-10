/* eslint-disable @typescript-eslint/no-explicit-any */
import seed from './seed.json';
import { createAdapter, createFakeSocket, createRouter, createStore, fail, newId, now, withStatus } from './kernel';

type Doc = Record<string, any>;
type DB = { users: Doc[]; conversations: Doc[]; messages: Doc[] };

export const store = createStore<DB>('devtalk.demo.v1', seed as unknown as { exportedAt: string; data: DB });
const db = () => store.db;

const COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444', '#EAB308', '#EC4899', '#14B8A6'];
const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/(pdf|zip|json)|text\/(plain|markdown|csv))$/;
const MAX_DEMO_FILE = 2 * 1024 * 1024;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const publicUser = ({ password: _p, ...u }: Doc) => u;
const token = (u: Doc) => `demo.${u.id}`;
const userRef = (id: string, fields: string[]) => {
  const u = db().users.find((x) => x.id === id);
  return u ? Object.fromEntries([['id', u.id], ...fields.map((f) => [f, u[f]])]) : null;
};
const me = (userId: string | null) => db().users.find((u) => u.id === userId) ?? fail(401, 'Please sign in to continue');

// Seeded attachments ship with the static site under /demo-uploads.
const fileUrl = (url: string) => (url.startsWith('/uploads/') ? `${import.meta.env.BASE_URL}demo-uploads/${url.slice(9)}` : url);

// ---------- realtime ----------
let currentUser: string | null = null;
const online = new Set<string>();
export const socket = createFakeSocket((event, payload) => {
  if (event === 'typing') return; // nobody else is really here to see it
  void payload;
});
const emit = (event: string, payload: unknown) => socket.deliver(event, payload);

/** Starts a session: the signed-in user plus a few teammates show as online. */
function startSession(userId: string) {
  if (currentUser === userId) return;
  currentUser = userId;
  online.clear();
  online.add(userId);
  db().users.filter((u) => u.id !== userId).slice(0, 3).forEach((u) => online.add(u.id));
  socket.deliver('presence:list', { userIds: [...online] }, { sticky: true });
}

// ---------- serializers ----------
function conversationFor(id: string, userId: string | null) {
  const conv = db().conversations.find((c) => c.id === id);
  const member = conv?.members.find((m: Doc) => m.user === userId);
  if (!conv || !member) fail(404, 'Conversation not found');
  return { conv: conv!, member: member! };
}
function serializeFor(conv: Doc, userId: string) {
  const mine = conv.members.find((m: Doc) => m.user === userId);
  const since = mine?.lastReadAt ?? new Date(0).toISOString();
  const unread = db().messages.filter((m) => m.conversation === conv.id && m.createdAt > since && m.sender !== userId && !m.deletedAt).length;
  const { directKey: _d, ...rest } = conv;
  return { ...rest, members: conv.members.map((m: Doc) => ({ ...m, user: userRef(m.user, ['name', 'email', 'avatarColor', 'title', 'lastSeen']) })), unread };
}
function serializeMessage(m: Doc) {
  const reply = m.replyTo ? db().messages.find((x) => x.id === m.replyTo) : null;
  const out: Doc = {
    ...m,
    sender: userRef(m.sender, ['name', 'avatarColor']),
    attachments: (m.attachments ?? []).map((a: Doc) => ({ ...a, url: fileUrl(a.url) })),
    replyTo: reply
      ? { id: reply.id, text: reply.deletedAt ? '' : reply.text, sender: userRef(reply.sender, ['name']), deletedAt: reply.deletedAt, attachments: reply.deletedAt ? [] : (reply.attachments ?? []).map((a: Doc) => ({ ...a, url: fileUrl(a.url) })) }
      : undefined,
  };
  if (m.deletedAt) Object.assign(out, { text: '', attachments: [], reactions: [] });
  return out;
}
const preview = (text: string, attachments: { mime: string }[]) =>
  text ? text.replace(/```[\s\S]*?```/g, '[code]').replace(/\s+/g, ' ').slice(0, 120) : attachments.length ? (attachments[0].mime.startsWith('image/') ? '📷 Photo' : '📎 File') : '';
const push = (conv: Doc) => currentUser && conv.members.some((m: Doc) => m.user === currentUser) && emit('conversation:updated', serializeFor(conv, currentUser));

// ---------- simulated teammates ----------
const REPLIES = [
  'Nice, that makes sense 👍',
  'Good call. I will pick that up after standup.',
  'Looks good to me — ship it 🚀',
  'Can you share a screenshot when you get a sec?',
  'Agreed. Let us pair on it this afternoon.',
  'Thanks! Merging once CI is green ✅',
  'Interesting… I had not thought about that edge case.',
  'On it. I will push a fix in the next hour.',
];
let replyIdx = 0;
const replyTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

/** After you send a message, a teammate reads it, types for a moment and answers. */
function simulateReply(conv: Doc, from: string) {
  const others = conv.members.map((m: Doc) => m.user).filter((id: string) => id !== from && online.has(id));
  const pool = others.length ? others : conv.members.map((m: Doc) => m.user).filter((id: string) => id !== from);
  if (!pool.length) return;
  const who: string = pool[Math.floor(Math.random() * pool.length)];
  replyTimers.get(conv.id)?.forEach(clearTimeout);
  const timers = [
    setTimeout(() => {
      const member = conv.members.find((m: Doc) => m.user === who);
      if (member) member.lastReadAt = now();
      store.save();
      emit('read', { conversationId: conv.id, userId: who, at: now() });
    }, 900),
    setTimeout(() => emit('typing', { conversationId: conv.id, userId: who, isTyping: true }), 1600),
    setTimeout(() => {
      const msg = { id: newId(), conversation: conv.id, sender: who, text: REPLIES[replyIdx++ % REPLIES.length], attachments: [], reactions: [], createdAt: now(), updatedAt: now() };
      db().messages.push(msg);
      conv.lastMessage = { text: preview(msg.text, []), sender: who, createdAt: msg.createdAt };
      const sender = conv.members.find((m: Doc) => m.user === who);
      if (sender) sender.lastReadAt = msg.createdAt;
      conv.updatedAt = now();
      store.save();
      emit('message:new', serializeMessage(msg));
      push(conv);
    }, 4200),
  ];
  replyTimers.set(conv.id, timers);
}

const r = createRouter();

// ---------- auth ----------
r.post('/auth/register', ({ body }) => {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  if (name.length < 2) fail(400, 'name: Name must be at least 2 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'email: Enter a valid email');
  if (String(body.password ?? '').length < 8) fail(400, 'password: Password must be at least 8 characters');
  if (db().users.some((u) => u.email === email)) fail(409, 'An account with this email already exists');
  const user = { id: newId(), name, email, password: body.password, role: 'user', avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)], title: '', createdAt: now(), updatedAt: now() };
  db().users.push(user);
  store.save();
  startSession(user.id);
  return withStatus(201, { user: publicUser(user), token: token(user) });
}, false);
r.post('/auth/login', ({ body }) => {
  const user = db().users.find((u) => u.email === str(body.email).toLowerCase());
  if (!user || user.password !== body.password) fail(401, 'Incorrect email or password');
  startSession(user!.id);
  return { user: publicUser(user!), token: token(user!) };
}, false);
r.get('/auth/me', ({ userId }) => {
  const u = me(userId);
  startSession(u.id);
  return { user: publicUser(u) };
});
r.patch('/auth/me', ({ userId, body }) => {
  const u = me(userId);
  if (body.name !== undefined) {
    if (str(body.name).length < 2) fail(400, 'name: Name must be at least 2 characters');
    u.name = str(body.name);
  }
  if (body.title !== undefined) u.title = str(body.title).slice(0, 60);
  u.updatedAt = now();
  store.save();
  return { user: publicUser(u) };
});

// ---------- users ----------
r.get('/users', ({ userId, query }) => {
  const q = str(query.search).toLowerCase();
  const users = db().users
    .filter((u) => u.id !== userId && (!q || [u.name, u.email, u.title].some((f) => String(f ?? '').toLowerCase().includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, avatarColor: u.avatarColor, title: u.title, lastSeen: u.lastSeen, online: online.has(u.id) }));
  return { users };
});

// ---------- conversations ----------
r.get('/conversations', ({ userId }) => {
  const key = (c: Doc) => c.lastMessage?.createdAt ?? c.updatedAt;
  const convs = db().conversations.filter((c) => c.members.some((m: Doc) => m.user === userId)).sort((a, b) => key(b).localeCompare(key(a)));
  return { conversations: convs.map((c) => serializeFor(c, userId!)) };
});
r.post('/conversations/direct', ({ userId, body }) => {
  const other = String(body.userId ?? '');
  if (other === userId) fail(400, "You can't start a chat with yourself");
  if (!db().users.some((u) => u.id === other)) fail(404, 'User not found');
  const directKey = [userId, other].sort().join(':');
  const pairKey = (c: Doc) => c.type === 'direct' && c.members.map((m: Doc) => m.user).sort().join(':');
  let conv = db().conversations.find((c) => c.directKey === directKey || pairKey(c) === directKey);
  const created = !conv;
  if (!conv) {
    conv = { id: newId(), type: 'direct', topic: '', color: '#34D399', directKey, createdBy: userId, members: [{ user: userId, role: 'member', lastReadAt: new Date(0).toISOString() }, { user: other, role: 'member', lastReadAt: new Date(0).toISOString() }], createdAt: now(), updatedAt: now() };
    db().conversations.push(conv);
    store.save();
    push(conv);
  }
  return withStatus(created ? 201 : 200, { conversation: serializeFor(conv, userId!) });
});
r.post('/conversations/group', ({ userId, body }) => {
  const name = str(body.name);
  if (name.length < 2) fail(400, 'name: Give the group a name');
  const ids = [...new Set(((body.memberIds ?? []) as string[]).filter((id) => id !== userId))];
  if (!ids.length) fail(400, 'memberIds: Add at least one person');
  if (ids.some((id) => !db().users.some((u) => u.id === id))) fail(400, 'Some of those people were not found');
  const conv: Doc = {
    id: newId(), type: 'group', name: name.slice(0, 60), topic: str(body.topic).slice(0, 160), color: /^#[0-9a-fA-F]{6}$/.test(body.color ?? '') ? body.color : '#34D399', createdBy: userId,
    members: [{ user: userId, role: 'admin', lastReadAt: now() }, ...ids.map((user) => ({ user, role: 'member', lastReadAt: new Date(0).toISOString() }))],
    createdAt: now(), updatedAt: now(),
  };
  const sys = { id: newId(), conversation: conv.id, sender: userId, text: `created #${conv.name}`, attachments: [], reactions: [], createdAt: now(), updatedAt: now() };
  conv.lastMessage = { text: sys.text, sender: userId, createdAt: sys.createdAt };
  db().conversations.push(conv);
  db().messages.push(sys);
  store.save();
  push(conv);
  return withStatus(201, { conversation: serializeFor(conv, userId!) });
});
r.get('/conversations/:id', ({ params, userId }) => ({ conversation: serializeFor(conversationFor(params.id, userId).conv, userId!) }));
r.patch('/conversations/:id', ({ params, userId, body }) => {
  const { conv, member } = conversationFor(params.id, userId);
  if (conv.type !== 'group') fail(400, 'Direct messages cannot be renamed');
  if (member.role !== 'admin') fail(403, 'Only group admins can edit the group');
  if (body.name !== undefined) {
    if (str(body.name).length < 2) fail(400, 'name: Give the group a name');
    conv.name = str(body.name).slice(0, 60);
  }
  if (body.topic !== undefined) conv.topic = str(body.topic).slice(0, 160);
  conv.updatedAt = now();
  store.save();
  push(conv);
  return { conversation: serializeFor(conv, userId!) };
});
r.post('/conversations/:id/members', ({ params, userId, body }) => {
  const { conv, member } = conversationFor(params.id, userId);
  if (conv.type !== 'group') fail(400, 'Start a group to add more people');
  if (member.role !== 'admin') fail(403, 'Only group admins can add people');
  const existing = new Set(conv.members.map((m: Doc) => m.user));
  ((body.userIds ?? []) as string[]).filter((id) => !existing.has(id) && db().users.some((u) => u.id === id)).forEach((user) => conv.members.push({ user, role: 'member', lastReadAt: new Date(0).toISOString() }));
  store.save();
  push(conv);
  return { conversation: serializeFor(conv, userId!) };
});
r.delete('/conversations/:id/members/:userId', ({ params, userId }) => {
  const { conv, member } = conversationFor(params.id, userId);
  const self = params.userId === userId;
  if (conv.type !== 'group') fail(400, 'You cannot leave a direct message');
  if (!self && member.role !== 'admin') fail(403, 'Only group admins can remove people');
  conv.members = conv.members.filter((m: Doc) => m.user !== params.userId);
  if (conv.members.length && !conv.members.some((m: Doc) => m.role === 'admin')) conv.members[0].role = 'admin';
  store.save();
  if (self) emit('conversation:removed', { id: conv.id });
  else push(conv);
  return undefined;
});
r.post('/conversations/:id/read', ({ params, userId }) => {
  const { conv, member } = conversationFor(params.id, userId);
  const at = now();
  member.lastReadAt = at;
  store.save();
  emit('read', { conversationId: conv.id, userId, at });
  return { ok: true, at };
});

// ---------- messages ----------
r.get('/conversations/:id/messages', ({ params, userId, query }) => {
  const { conv } = conversationFor(params.id, userId);
  const limit = Math.min(Math.max(Number(query.limit) || 40, 1), 100);
  const all = db().messages.filter((m) => m.conversation === conv.id && (!query.before || m.id < query.before)).sort((a, b) => (a.id < b.id ? 1 : -1));
  const page = all.slice(0, limit);
  return { messages: page.reverse().map(serializeMessage), hasMore: all.length > limit };
});
r.post('/conversations/:id/messages', ({ params, userId, body }) => {
  const { conv, member } = conversationFor(params.id, userId);
  const text = str(body.text).slice(0, 4000);
  const attachments = ((body.attachments ?? []) as Doc[]).slice(0, 6).map((a) => ({ url: String(a.url), name: String(a.name).slice(0, 200), size: Number(a.size) || 0, mime: String(a.mime) }));
  if (!text && !attachments.length) fail(400, 'Message is empty');
  if (body.replyTo && !db().messages.some((m) => m.id === body.replyTo && m.conversation === conv.id)) fail(400, 'Original message not found');
  const msg = { id: newId(), conversation: conv.id, sender: userId, text, attachments, reactions: [], replyTo: body.replyTo || undefined, createdAt: now(), updatedAt: now() };
  db().messages.push(msg);
  conv.lastMessage = { text: preview(text, attachments), sender: userId, createdAt: msg.createdAt };
  member.lastReadAt = msg.createdAt;
  conv.updatedAt = now();
  store.save();
  const out = serializeMessage(msg);
  emit('message:new', out);
  push(conv);
  simulateReply(conv, userId!);
  return withStatus(201, { message: out });
});
function loadOwn(id: string, userId: string | null, mustBeSender = true) {
  const msg = db().messages.find((m) => m.id === id);
  if (!msg || msg.deletedAt) fail(404, 'Message not found');
  conversationFor(msg!.conversation, userId);
  if (mustBeSender && msg!.sender !== userId) fail(403, 'You can only change your own messages');
  return msg!;
}
const broadcast = (msg: Doc) => {
  msg.updatedAt = now();
  store.save();
  const out = serializeMessage(msg);
  emit('message:updated', out);
  return { message: out };
};
r.patch('/messages/:id', ({ params, userId, body }) => {
  const msg = loadOwn(params.id, userId);
  const text = str(body.text);
  if (!text) fail(400, 'text: Message is empty');
  msg.text = text.slice(0, 4000);
  msg.editedAt = now();
  return broadcast(msg);
});
r.delete('/messages/:id', ({ params, userId }) => {
  const msg = loadOwn(params.id, userId);
  msg.deletedAt = now();
  const conv = db().conversations.find((c) => c.id === msg.conversation);
  if (conv && conv.lastMessage?.createdAt === msg.createdAt) {
    conv.lastMessage.text = 'Message deleted';
    push(conv);
  }
  return broadcast(msg);
});
r.post('/messages/:id/reactions', ({ params, userId, body }) => {
  const msg = loadOwn(params.id, userId, false);
  const emoji = String(body.emoji ?? '').slice(0, 16);
  if (!emoji) fail(400, 'emoji: Pick an emoji');
  const existing = msg.reactions.find((x: Doc) => x.emoji === emoji);
  if (!existing) msg.reactions.push({ emoji, users: [userId] });
  else if (existing.users.includes(userId)) existing.users = existing.users.filter((u: string) => u !== userId);
  else existing.users.push(userId);
  msg.reactions = msg.reactions.filter((x: Doc) => x.users.length > 0);
  return broadcast(msg);
});

// ---------- uploads (kept in the browser as data URLs) ----------
const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
r.post('/uploads', async ({ body }) => {
  const files = body instanceof FormData ? (body.getAll('files').filter((f) => f instanceof File) as File[]) : [];
  if (!files.length) fail(400, 'Choose a file to upload');
  if (files.length > 6) fail(400, 'You can attach up to 6 files');
  for (const f of files) {
    if (!ALLOWED.test(f.type)) fail(400, `${f.name}: that file type isn't supported`);
    if (f.size > MAX_DEMO_FILE) fail(400, `${f.name}: the live demo accepts files up to 2 MB`);
  }
  const out = await Promise.all(files.map(async (f) => ({ url: await readAsDataUrl(f), name: f.name, size: f.size, mime: f.type })));
  return withStatus(201, { files: out });
});

export const demoAdapter = createAdapter(r, (t) => (t?.startsWith('demo.') ? t.slice(5) : null));
