import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from './jwt.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';

let io: Server | null = null;
/** userId -> number of open sockets. A user is online while this is above zero. */
const online = new Map<string, number>();

export const isOnline = (userId: string) => (online.get(userId) ?? 0) > 0;
export const onlineIds = () => [...online.keys()];

async function conversationIdsFor(userId: string) {
  const convs = await Conversation.find({ 'members.user': userId }).select('_id');
  return convs.map((c) => String(c._id));
}

async function broadcastPresence(userId: string, isOn: boolean, lastSeen?: Date) {
  const rooms = (await conversationIdsFor(userId)).map((id) => `conv:${id}`);
  if (rooms.length) io?.to(rooms).emit('presence', { userId, online: isOn, lastSeen });
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true }, maxHttpBufferSize: 1e5 });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      socket.data.userId = verifyToken(token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    const convIds = await conversationIdsFor(userId);
    socket.join(convIds.map((id) => `conv:${id}`));

    const count = (online.get(userId) ?? 0) + 1;
    online.set(userId, count);
    if (count === 1) broadcastPresence(userId, true);
    socket.emit('presence:list', { userIds: onlineIds() });

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!socket.rooms.has(`conv:${conversationId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId, isTyping: Boolean(isTyping) });
    });

    socket.on('disconnect', async () => {
      const left = (online.get(userId) ?? 1) - 1;
      if (left > 0) return online.set(userId, left);
      online.delete(userId);
      const lastSeen = new Date();
      await User.updateOne({ _id: userId }, { lastSeen }).catch(() => undefined);
      broadcastPresence(userId, false, lastSeen);
    });
  });

  return io;
}

export const emitToConversation = (conversationId: string, event: string, payload: unknown) => io?.to(`conv:${conversationId}`).emit(event, payload);
export const emitToUser = (userId: string, event: string, payload: unknown) => io?.to(`user:${userId}`).emit(event, payload);

/** Puts every open socket of these users into the conversation room (used when a chat is created or someone is added). */
export function joinConversation(userIds: string[], conversationId: string) {
  for (const id of userIds) io?.in(`user:${id}`).socketsJoin(`conv:${conversationId}`);
}
export function leaveConversation(userId: string, conversationId: string) {
  io?.in(`user:${userId}`).socketsLeave(`conv:${conversationId}`);
}
