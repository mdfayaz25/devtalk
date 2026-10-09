import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { conversationFor, populateConversation, preview, serializeFor } from '../lib/conversations.js';
import { emitToConversation, emitToUser, joinConversation, leaveConversation } from '../lib/realtime.js';

const router = Router();
router.use(requireAuth);
const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid id');

async function load(id: Types.ObjectId | string) {
  return populateConversation(Conversation.findById(id));
}

/** Tell each member about a conversation change, with their own unread count. */
async function pushConversation(id: Types.ObjectId | string) {
  const conv = await load(id);
  if (!conv) return;
  await Promise.all(
    conv.members.map(async (m) => {
      const uid = String((m.user as unknown as { _id: Types.ObjectId })._id);
      emitToUser(uid, 'conversation:updated', await serializeFor(conv, uid));
    }),
  );
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const convs = await populateConversation(Conversation.find({ 'members.user': req.user!.id }).sort({ 'lastMessage.createdAt': -1, updatedAt: -1 }));
    res.json({ conversations: await Promise.all(convs.map((c) => serializeFor(c, req.user!.id))) });
  }),
);

router.post(
  '/direct',
  validate({ body: z.object({ userId: objectId }) }),
  asyncHandler(async (req, res) => {
    const other = req.body.userId as string;
    if (other === req.user!.id) throw AppError.badRequest("You can't start a chat with yourself");
    if (!(await User.exists({ _id: other }))) throw AppError.notFound('User not found');
    const directKey = [req.user!.id, other].sort().join(':');
    const before = await Conversation.exists({ directKey });
    const conv = await Conversation.findOneAndUpdate(
      { directKey },
      { $setOnInsert: { type: 'direct', directKey, createdBy: req.user!.id, members: [{ user: req.user!.id, role: 'member' }, { user: other, role: 'member' }] } },
      { upsert: true, new: true },
    );
    if (!before) {
      joinConversation([req.user!.id, other], String(conv._id));
      await pushConversation(conv._id);
    }
    const full = await load(conv._id);
    res.status(before ? 200 : 201).json({ conversation: await serializeFor(full!, req.user!.id) });
  }),
);

const groupSchema = z.object({
  name: z.string().trim().min(2, 'Give the group a name').max(60),
  topic: z.string().trim().max(160).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  memberIds: z.array(objectId).min(1, 'Add at least one person').max(50),
});

router.post(
  '/group',
  validate({ body: groupSchema }),
  asyncHandler(async (req, res) => {
    const ids = [...new Set((req.body.memberIds as string[]).filter((id) => id !== req.user!.id))];
    if ((await User.countDocuments({ _id: { $in: ids } })) !== ids.length) throw AppError.badRequest('Some of those people were not found');
    const conv = await Conversation.create({
      type: 'group',
      name: req.body.name,
      topic: req.body.topic ?? '',
      color: req.body.color,
      createdBy: req.user!.id,
      members: [{ user: req.user!.id, role: 'admin', lastReadAt: new Date() }, ...ids.map((user) => ({ user, role: 'member' }))],
    });
    const sys = await Message.create({ conversation: conv._id, sender: req.user!.id, text: `created #${conv.name}` });
    conv.lastMessage = { text: sys.text, sender: sys.sender, createdAt: sys.createdAt };
    await conv.save();
    joinConversation([req.user!.id, ...ids], String(conv._id));
    await pushConversation(conv._id);
    res.status(201).json({ conversation: await serializeFor((await load(conv._id))!, req.user!.id) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await conversationFor(req.params.id, req.user!.id);
    res.json({ conversation: await serializeFor((await load(req.params.id))!, req.user!.id) });
  }),
);

router.patch(
  '/:id',
  validate({ body: groupSchema.pick({ name: true, topic: true }).partial() }),
  asyncHandler(async (req, res) => {
    const { conv, member } = await conversationFor(req.params.id, req.user!.id);
    if (conv.type !== 'group') throw AppError.badRequest('Direct messages cannot be renamed');
    if (member.role !== 'admin') throw AppError.forbidden('Only group admins can edit the group');
    Object.assign(conv, req.body);
    await conv.save();
    await pushConversation(conv._id);
    res.json({ conversation: await serializeFor((await load(conv._id))!, req.user!.id) });
  }),
);

router.post(
  '/:id/members',
  validate({ body: z.object({ userIds: z.array(objectId).min(1).max(20) }) }),
  asyncHandler(async (req, res) => {
    const { conv, member } = await conversationFor(req.params.id, req.user!.id);
    if (conv.type !== 'group') throw AppError.badRequest('Start a group to add more people');
    if (member.role !== 'admin') throw AppError.forbidden('Only group admins can add people');
    const existing = new Set(conv.members.map((m) => String(m.user)));
    const add = (req.body.userIds as string[]).filter((id) => !existing.has(id));
    add.forEach((user) => conv.members.push({ user: new Types.ObjectId(user), role: 'member', lastReadAt: new Date(0) }));
    await conv.save();
    joinConversation(add, String(conv._id));
    await pushConversation(conv._id);
    res.json({ conversation: await serializeFor((await load(conv._id))!, req.user!.id) });
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { conv, member } = await conversationFor(req.params.id, req.user!.id);
    const self = req.params.userId === req.user!.id;
    if (conv.type !== 'group') throw AppError.badRequest('You cannot leave a direct message');
    if (!self && member.role !== 'admin') throw AppError.forbidden('Only group admins can remove people');
    conv.members = conv.members.filter((m) => String(m.user) !== req.params.userId) as typeof conv.members;
    if (conv.members.length && !conv.members.some((m) => m.role === 'admin')) conv.members[0].role = 'admin';
    await conv.save();
    leaveConversation(req.params.userId, String(conv._id));
    emitToUser(req.params.userId, 'conversation:removed', { id: String(conv._id) });
    await pushConversation(conv._id);
    res.status(204).end();
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { conv, member } = await conversationFor(req.params.id, req.user!.id);
    const at = new Date();
    member.lastReadAt = at;
    await conv.save();
    emitToConversation(String(conv._id), 'read', { conversationId: String(conv._id), userId: req.user!.id, at });
    res.json({ ok: true, at });
  }),
);

// ---------- messages ----------
const pageQuery = z.object({ before: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(40) });

/** Newest-first cursor pagination on _id (monotonic), returned oldest-first for rendering. */
router.get(
  '/:id/messages',
  validate({ query: pageQuery }),
  asyncHandler(async (req, res) => {
    const { conv } = await conversationFor(req.params.id, req.user!.id);
    const { before, limit } = pageQuery.parse(req.query);
    const messages = await Message.find({ conversation: conv._id, ...(before && { _id: { $lt: new Types.ObjectId(before) } }) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('sender', 'name avatarColor')
      .populate({ path: 'replyTo', select: 'text sender deletedAt attachments', populate: { path: 'sender', select: 'name' } });
    const hasMore = messages.length > limit;
    res.json({ messages: messages.slice(0, limit).reverse(), hasMore });
  }),
);

const attachment = z.object({
  url: z.string().regex(/^\/uploads\/[\w.-]+$/, 'Invalid attachment'),
  name: z.string().max(200),
  size: z.number().int().min(0).max(10 * 1024 * 1024),
  mime: z.string().max(100),
});

router.post(
  '/:id/messages',
  validate({ body: z.object({ text: z.string().max(4000).default(''), attachments: z.array(attachment).max(6).default([]), replyTo: objectId.optional() }) }),
  asyncHandler(async (req, res) => {
    const { conv } = await conversationFor(req.params.id, req.user!.id);
    const text = (req.body.text as string).trim();
    if (!text && !req.body.attachments.length) throw AppError.badRequest('Message is empty');
    if (req.body.replyTo && !(await Message.exists({ _id: req.body.replyTo, conversation: conv._id }))) throw AppError.badRequest('Original message not found');

    const msg = await Message.create({ conversation: conv._id, sender: req.user!.id, text, attachments: req.body.attachments, replyTo: req.body.replyTo });
    conv.lastMessage = { text: preview(text, req.body.attachments), sender: msg.sender, createdAt: msg.createdAt };
    const me = conv.members.find((m) => String(m.user) === req.user!.id);
    if (me) me.lastReadAt = msg.createdAt;
    await conv.save();

    await msg.populate('sender', 'name avatarColor');
    await msg.populate({ path: 'replyTo', select: 'text sender deletedAt attachments', populate: { path: 'sender', select: 'name' } });
    emitToConversation(String(conv._id), 'message:new', msg.toJSON());
    await pushConversation(conv._id);
    res.status(201).json({ message: msg });
  }),
);

export default router;
