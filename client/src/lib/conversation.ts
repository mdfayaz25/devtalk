import type { Conversation, Person } from '@/types';

export const otherMember = (c: Conversation, meId?: string): Person | undefined => c.members.find((m) => m.user.id !== meId)?.user;

export const convTitle = (c: Conversation, meId?: string) => (c.type === 'group' ? c.name ?? 'Group' : otherMember(c, meId)?.name ?? 'Unknown');
