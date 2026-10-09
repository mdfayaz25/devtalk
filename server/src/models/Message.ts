import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    attachments: [
      {
        _id: false,
        url: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number, required: true },
        mime: { type: String, required: true },
      },
    ],
    reactions: [{ _id: false, emoji: { type: String, required: true }, users: [{ type: Schema.Types.ObjectId, ref: 'User' }] }],
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    editedAt: Date,
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        if (ret.deletedAt) {
          ret.text = '';
          ret.attachments = [];
          ret.reactions = [];
        }
        return ret;
      },
    },
  },
);

messageSchema.index({ conversation: 1, _id: -1 });

export const Message = model('Message', messageSchema);
