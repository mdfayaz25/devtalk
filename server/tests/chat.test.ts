import request from 'supertest';
import { describe, expect, it } from 'vitest';
import './setup.js';
import { app, createUser } from './helpers.js';

describe('conversations', () => {
  it('reuses the same direct chat for a pair and hides it from others', async () => {
    const a = await createUser({ name: 'Asha' });
    const b = await createUser({ name: 'Bala' });
    const c = await createUser({ name: 'Chen' });
    const first = await request(app).post('/api/conversations/direct').set(a.auth).send({ userId: b.user.id });
    expect(first.status).toBe(201);
    const again = await request(app).post('/api/conversations/direct').set(b.auth).send({ userId: a.user.id });
    expect(again.status).toBe(200);
    expect(again.body.conversation.id).toBe(first.body.conversation.id);

    const peek = await request(app).get(`/api/conversations/${first.body.conversation.id}/messages`).set(c.auth);
    expect(peek.status).toBe(404);
  });

  it('tracks unread counts and read receipts', async () => {
    const a = await createUser();
    const b = await createUser();
    const { body } = await request(app).post('/api/conversations/direct').set(a.auth).send({ userId: b.user.id });
    const id = body.conversation.id;
    for (const text of ['one', 'two', 'three']) await request(app).post(`/api/conversations/${id}/messages`).set(a.auth).send({ text }).expect(201);

    let list = await request(app).get('/api/conversations').set(b.auth);
    expect(list.body.conversations[0].unread).toBe(3);
    expect(list.body.conversations[0].lastMessage.text).toBe('three');
    list = await request(app).get('/api/conversations').set(a.auth);
    expect(list.body.conversations[0].unread).toBe(0);

    await request(app).post(`/api/conversations/${id}/read`).set(b.auth).expect(200);
    list = await request(app).get('/api/conversations').set(b.auth);
    expect(list.body.conversations[0].unread).toBe(0);
  });

  it('paginates messages oldest-first with a cursor', async () => {
    const a = await createUser();
    const b = await createUser();
    const { body } = await request(app).post('/api/conversations/direct').set(a.auth).send({ userId: b.user.id });
    for (let i = 1; i <= 5; i++) await request(app).post(`/api/conversations/${body.conversation.id}/messages`).set(a.auth).send({ text: `m${i}` });
    const page1 = await request(app).get(`/api/conversations/${body.conversation.id}/messages?limit=3`).set(a.auth);
    expect(page1.body.messages.map((m: { text: string }) => m.text)).toEqual(['m3', 'm4', 'm5']);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await request(app).get(`/api/conversations/${body.conversation.id}/messages?limit=3&before=${page1.body.messages[0].id}`).set(a.auth);
    expect(page2.body.messages.map((m: { text: string }) => m.text)).toEqual(['m1', 'm2']);
    expect(page2.body.hasMore).toBe(false);
  });

  it('only admins manage groups; members can leave', async () => {
    const admin = await createUser();
    const m1 = await createUser();
    const m2 = await createUser();
    const g = await request(app).post('/api/conversations/group').set(admin.auth).send({ name: 'core', memberIds: [m1.user.id] });
    expect(g.status).toBe(201);
    const id = g.body.conversation.id;
    await request(app).post(`/api/conversations/${id}/members`).set(m1.auth).send({ userIds: [m2.user.id] }).expect(403);
    await request(app).post(`/api/conversations/${id}/members`).set(admin.auth).send({ userIds: [m2.user.id] }).expect(200);
    await request(app).delete(`/api/conversations/${id}/members/${m2.user.id}`).set(m2.auth).expect(204);
  });
});

describe('messages', () => {
  it('lets only the sender edit or delete, and toggles reactions', async () => {
    const a = await createUser();
    const b = await createUser();
    const { body } = await request(app).post('/api/conversations/direct').set(a.auth).send({ userId: b.user.id });
    const sent = await request(app).post(`/api/conversations/${body.conversation.id}/messages`).set(a.auth).send({ text: 'helo' });
    const id = sent.body.message.id;

    await request(app).patch(`/api/messages/${id}`).set(b.auth).send({ text: 'hijack' }).expect(403);
    const edited = await request(app).patch(`/api/messages/${id}`).set(a.auth).send({ text: 'hello' });
    expect(edited.body.message.text).toBe('hello');
    expect(edited.body.message.editedAt).toBeTruthy();

    const r1 = await request(app).post(`/api/messages/${id}/reactions`).set(b.auth).send({ emoji: '🔥' });
    expect(r1.body.message.reactions[0].users).toHaveLength(1);
    const r2 = await request(app).post(`/api/messages/${id}/reactions`).set(b.auth).send({ emoji: '🔥' });
    expect(r2.body.message.reactions).toHaveLength(0);

    const del = await request(app).delete(`/api/messages/${id}`).set(a.auth);
    expect(del.body.message.deletedAt).toBeTruthy();
    expect(del.body.message.text).toBe('');
  });

  it('accepts images and rejects unsupported uploads', async () => {
    const a = await createUser();
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const ok = await request(app).post('/api/uploads').set(a.auth).attach('files', png, { filename: 'dot.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.files[0].url).toMatch(/^\/uploads\/.+\.png$/);
    const bad = await request(app).post('/api/uploads').set(a.auth).attach('files', Buffer.from('MZ'), { filename: 'run.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
  });
});
