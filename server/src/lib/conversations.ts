import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';

export async function conversationFor(id: string, userId: string) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Conversation not found');
  const conv = await Conversation.findById(id);
  const member = conv?.members.find((m) => String(m.user) === userId);
  if (!conv || !member) throw AppError.notFound('Conversation not found');
  return { conv, member };
}

export const populateConversation = <T>(q: T) =>
  (q as unknown as ReturnType<typeof Conversation.findById>).populate('members.user', 'name email avatarColor title lastSeen') as unknown as T;

/** Shapes a conversation for one viewer: adds unread count and, for DMs, who the other person is. */
export async function serializeFor(conv: InstanceType<typeof Conversation>, userId: string) {
  const json = conv.toJSON() as unknown as Record<string, unknown>;
  const me = conv.members.find((m) => String((m.user as unknown as { _id?: Types.ObjectId })._id ?? m.user) === userId);
  const unread = await Message.countDocuments({
    conversation: conv._id,
    createdAt: { $gt: me?.lastReadAt ?? new Date(0) },
    sender: { $ne: new Types.ObjectId(userId) },
    deletedAt: { $exists: false },
  });
  return { ...json, unread };
}

export const preview = (text: string, attachments: { mime: string }[]) =>
  text ? text.replace(/```[\s\S]*?```/g, '[code]').replace(/\s+/g, ' ').slice(0, 120) : attachments.length ? (attachments[0].mime.startsWith('image/') ? '📷 Photo' : '📎 File') : '';
