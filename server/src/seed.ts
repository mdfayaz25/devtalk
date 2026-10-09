import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { Types } from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Conversation } from './models/Conversation.js';
import { Message } from './models/Message.js';
import { UPLOAD_DIR } from './routes/upload.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const min = 6e4;

async function asset(file: string, mime: string) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `seed-${file}`;
  await copyFile(path.resolve(__dirname, '../seed-assets', file), path.join(UPLOAD_DIR, name));
  return { url: `/uploads/${name}`, name: file, size: (await stat(path.join(UPLOAD_DIR, name))).size, mime };
}

type Line = [who: number, text: string, minutesAgo: number, extra?: { attachments?: Awaited<ReturnType<typeof asset>>[]; reactions?: [string, number[]][] }];

async function run() {
  await connectDB();
  await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);

  const people = await User.create([
    { name: 'Mohammed Fayaz', email: 'fayaz@devtalk.dev', password: 'Demo@1234', avatarColor: '#34D399', title: 'Frontend Engineer' },
    { name: 'Priya Sharma', email: 'priya@devtalk.dev', password: 'Demo@1234', avatarColor: '#F472B6', title: 'Product Designer' },
    { name: 'Arjun Mehta', email: 'arjun@devtalk.dev', password: 'Demo@1234', avatarColor: '#60A5FA', title: 'Backend Engineer' },
    { name: 'Neha Kapoor', email: 'neha@devtalk.dev', password: 'Demo@1234', avatarColor: '#FBBF24', title: 'QA Lead' },
    { name: 'Karthik Rao', email: 'karthik@devtalk.dev', password: 'Demo@1234', avatarColor: '#A78BFA', title: 'DevOps Engineer', lastSeen: new Date(Date.now() - 42 * min) },
    { name: 'Sara Khan', email: 'sara@devtalk.dev', password: 'Demo@1234', avatarColor: '#FB923C', title: 'Engineering Manager', lastSeen: new Date(Date.now() - 3 * 60 * min) },
  ]);
  const ids = people.map((p) => p._id);
  const [shot, kanban, notes] = await Promise.all([asset('dashboard-preview.jpg', 'image/jpeg'), asset('kanban-v2.jpg', 'image/jpeg'), asset('release-notes-2.4.md', 'text/markdown')]);

  async function conversation(opts: { type: 'direct' | 'group'; name?: string; topic?: string; color?: string; members: number[]; admins?: number[]; lines: Line[]; readBy?: Record<number, number> }) {
    const conv = await Conversation.create({
      type: opts.type,
      name: opts.name,
      topic: opts.topic,
      color: opts.color,
      directKey: opts.type === 'direct' ? opts.members.map((i) => String(ids[i])).sort().join(':') : undefined,
      createdBy: ids[opts.members[0]],
      members: opts.members.map((i) => ({ user: ids[i], role: opts.admins?.includes(i) ? 'admin' : 'member', lastReadAt: new Date(Date.now() - (opts.readBy?.[i] ?? 0) * min) })),
    });
    let last: InstanceType<typeof Message> | undefined;
    for (const [who, text, ago, extra] of opts.lines) {
      const at = new Date(Date.now() - ago * min);
      last = await Message.create({
        conversation: conv._id, sender: ids[who], text, attachments: extra?.attachments ?? [],
        reactions: (extra?.reactions ?? []).map(([emoji, users]) => ({ emoji, users: users.map((u) => ids[u]) })),
        createdAt: at, updatedAt: at,
      });
    }
    if (last) {
      conv.lastMessage = { text: last.text || '📎 File', sender: last.sender, createdAt: last.createdAt };
      await conv.save();
    }
    return conv;
  }

  await conversation({
    type: 'group', name: 'frontend-guild', topic: 'React, TypeScript, CSS and everything in between', color: '#34D399', members: [0, 1, 2, 3, 5], admins: [0],
    readBy: { 0: 6, 1: 0, 2: 0, 3: 20, 5: 60 },
    lines: [
      [5, 'Morning all! Quick reminder: design review for the new checkout is at 3 pm.', 190],
      [1, 'Uploaded the latest mocks. Feedback welcome before the review 🙏', 150],
      [2, 'Is anyone else seeing hydration warnings on the product page after the last merge?', 64],
      [0, "Yes, it's the date formatting in the price badge. Server renders UTC, client renders IST. Fix:\n```ts\nconst formatted = new Intl.DateTimeFormat('en-IN', {\n  timeZone: 'Asia/Kolkata',\n  dateStyle: 'medium',\n}).format(date);\n```", 58, { reactions: [['🙌', [2, 3]], ['🔥', [1]]] }],
      [2, 'That was it, thanks! Opened a PR with the fix.', 52],
      [3, 'Regression suite is green on staging ✅ Here is the admin dashboard from the run:', 21, { attachments: [shot], reactions: [['🎉', [0, 1, 5]]] }],
      [1, 'Looks so clean. Can we get the chart colours from the new tokens?', 9],
      [0, 'On it. I will use `--brand-500` for the line and a 30% fill.', 5],
    ],
  });

  await conversation({
    type: 'group', name: 'release-2-4', topic: 'Ship checklist for Friday', color: '#60A5FA', members: [0, 2, 3, 4, 5], admins: [5],
    readBy: { 0: 200, 2: 0, 3: 0, 4: 0, 5: 0 },
    lines: [
      [5, 'Release notes draft is attached. Please add anything I missed.', 240, { attachments: [notes] }],
      [4, 'Staging deploy done. Blue/green switch is scheduled for 7 pm.', 120],
      [2, 'API migration ran clean on staging, 0 errors.', 90, { reactions: [['👍', [4, 5]]] }],
      [3, 'Two minor UI bugs left, both cosmetic. Not blocking.', 35],
    ],
  });

  await conversation({
    type: 'direct', members: [0, 1], readBy: { 0: 0, 1: 2 },
    lines: [
      [1, 'Hey! Did you get a chance to look at the new Kanban card design?', 30, { attachments: [kanban] }],
      [0, 'Just did. The priority bars are a nice touch. Maybe 2px more padding on mobile?', 24],
      [1, 'Good call, updating now', 22, { reactions: [['❤️', [0]]] }],
      [0, 'Also, can you share the Figma link for the empty states?', 3],
    ],
  });

  await conversation({
    type: 'direct', members: [0, 2], readBy: { 0: 15, 2: 0 },
    lines: [
      [2, 'Pushed the WebSocket presence changes. Can you review when free?', 40],
      [0, 'Sure, after lunch.', 38],
      [2, 'Thanks! Main change is in `lib/realtime.ts`, presence now only goes to shared conversations.', 12],
    ],
  });

  await conversation({
    type: 'direct', members: [0, 5], readBy: { 0: 0, 5: 0 },
    lines: [
      [5, 'Great work on the release this week, Fayaz.', 60 * 26],
      [0, 'Thank you! Team effort 🙂', 60 * 25],
    ],
  });

  void Types;
  console.log('Seeded 6 users, 2 groups and 3 direct chats.');
  console.log('Sign in → fayaz@devtalk.dev / Demo@1234 (also priya@, arjun@, neha@, karthik@, sara@)');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
