import mongoose, { Document, Schema } from 'mongoose'

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatDoc extends Document {
  jobId:         string
  clientId:      string
  artisanId:     string
  lastMessage:   string | null
  unreadClient:  number
  unreadArtisan: number
  createdAt:     Date
  updatedAt:     Date
}

const chatSchema = new Schema<ChatDoc>(
  {
    jobId:         { type: String, required: true, unique: true, index: true },
    clientId:      { type: String, required: true },
    artisanId:     { type: String, required: true },
    lastMessage:   { type: String, default: null },
    unreadClient:  { type: Number, default: 0 },
    unreadArtisan: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// ── Message ───────────────────────────────────────────────────────────────────

export interface MessageDoc extends Document {
  chatId:    string
  senderId:  string
  text:      string | null
  imageUrl:  string | null
  type:      'text' | 'image' | 'system'
  readAt:    Date | null
  createdAt: Date
}

const messageSchema = new Schema<MessageDoc>(
  {
    chatId:   { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    text:     { type: String, default: null },
    imageUrl: { type: String, default: null },
    type:     { type: String, enum: ['text', 'image', 'system'], default: 'text' },
    readAt:   { type: Date, default: null },
  },
  { timestamps: true }
)

export const ChatModel    = mongoose.model<ChatDoc>('Chat', chatSchema)
export const MessageModel = mongoose.model<MessageDoc>('Message', messageSchema)
