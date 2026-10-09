import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { conversationFor } from '../lib/conversations.js';
import { emitToConversation } from '../lib/realtime.js';

const router = Router();
router.use(requireAuth);

async function loadOwn(id: string, userId: string, mustBeSender = true) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Message not found');
  const msg = await Message.findById(id);
  if (!msg || msg.deletedAt) throw AppError.notFound('Message not found');
  await conversationFor(String(msg.conversation), userId);
  if (mustBeSender && String(msg.sender) !== userId) throw AppError.forbidden('You can only change your own messages');
  return msg;
}

const broadcast = async (msg: InstanceType<typeof Message>) => {
  await msg.populate('sender', 'name avatarColor');
  await msg.populate({ path: 'replyTo', select: 'text sender deletedAt attachments', populate: { path: 'sender', select: 'name' } });
  emitToConversation(String(msg.conversation), 'message:updated', msg.toJSON());
  return msg;
};

router.patch(
  '/:id',
  validate({ body: z.object({ text: z.string().trim().min(1).max(4000) }) }),
  asyncHandler(async (req, res) => {
    const msg = await loadOwn(req.params.id, req.user!.id);
    msg.text = req.body.text;
    msg.editedAt = new Date();
    await msg.save();
    res.json({ message: await broadcast(msg) });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const msg = await loadOwn(req.params.id, req.user!.id);
    msg.deletedAt = new Date();
    await msg.save();
    const conv = await Conversation.findById(msg.conversation);
    if (conv?.lastMessage?.createdAt?.getTime() === msg.createdAt.getTime()) {
      conv.lastMessage.text = 'Message deleted';
      await conv.save();
    }
    res.json({ message: await broadcast(msg) });
  }),
);

router.post(
  '/:id/reactions',
  validate({ body: z.object({ emoji: z.string().min(1).max(16) }) }),
  asyncHandler(async (req, res) => {
    const msg = await loadOwn(req.params.id, req.user!.id, false);
    const me = new Types.ObjectId(req.user!.id);
    const existing = msg.reactions.find((r) => r.emoji === req.body.emoji);
    if (!existing) msg.reactions.push({ emoji: req.body.emoji, users: [me] });
    else if (existing.users.some((u) => u.equals(me))) existing.users = existing.users.filter((u) => !u.equals(me)) as typeof existing.users;
    else existing.users.push(me);
    msg.reactions = msg.reactions.filter((r) => r.users.length > 0) as typeof msg.reactions;
    await msg.save();
    res.json({ message: await broadcast(msg) });
  }),
);

export default router;
