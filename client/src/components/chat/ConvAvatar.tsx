import { Hash } from 'lucide-react';
import type { Conversation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { otherMember } from '@/lib/conversation';
import { Avatar } from '../ui/Avatar';

export function ConvAvatar({ conv, size = 40 }: { conv: Conversation; size?: number }) {
  const { user } = useAuth();
  const { online } = useChat();
  if (conv.type === 'group') {
    return (
      <span className="grid shrink-0 place-items-center rounded-[30%] font-bold" style={{ width: size, height: size, background: `${conv.color ?? '#34D399'}22`, color: conv.color ?? '#34D399', boxShadow: `inset 0 0 0 1px ${conv.color ?? '#34D399'}33` }}>
        <Hash style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={2.4} />
      </span>
    );
  }
  const other = otherMember(conv, user?.id);
  return <Avatar name={other?.name ?? '?'} color={other?.avatarColor} size={size} online={other ? online.has(other.id) : undefined} />;
}
