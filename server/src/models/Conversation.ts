import { Schema, model } from 'mongoose';

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: { type: String, trim: true, maxlength: 60 },
    topic: { type: String, trim: true, maxlength: 160, default: '' },
    color: { type: String, default: '#34D399' },
    members: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        lastReadAt: { type: Date, default: () => new Date(0) },
      },
    ],
    /** Sorted pair of user ids for direct chats, so each pair has exactly one conversation. */
    directKey: { type: String, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: {
      text: String,
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.directKey;
        return ret;
      },
    },
  },
);

conversationSchema.index({ 'members.user': 1, updatedAt: -1 });

export const Conversation = model('Conversation', conversationSchema);
