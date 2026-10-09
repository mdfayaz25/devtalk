export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatarColor: string;
  title?: string;
  lastSeen?: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
  title?: string;
  lastSeen?: string;
  online?: boolean;
}

export interface Member {
  user: Person;
  role: 'admin' | 'member';
  lastReadAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  topic?: string;
  color?: string;
  members: Member[];
  createdBy: string;
  lastMessage?: { text: string; sender: string; createdAt: string };
  unread: number;
  updatedAt: string;
}

export interface Attachment {
  url: string;
  name: string;
  size: number;
  mime: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender: Person;
  text: string;
  attachments: Attachment[];
  reactions: { emoji: string; users: string[] }[];
  replyTo?: { id: string; text: string; sender: { id: string; name: string }; deletedAt?: string; attachments: Attachment[] } | null;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  pending?: boolean;
}
