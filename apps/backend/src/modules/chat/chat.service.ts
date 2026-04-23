import { ChatModel, MessageModel } from './chat.model'
import { AppError } from '../../gateway/errorHandler'

export type SenderRole = 'client' | 'artisan'

export interface SendMessageDto {
  text?:     string
  imageUrl?: string
  type?:     'text' | 'image' | 'system'
}

// ── Service ──────────────────────────────────────────────────────────────────

export const ChatService = {
  async getOrCreateChat(jobId: string, clientId: string, artisanId: string) {
    const existing = await ChatModel.findOne({ jobId })
    if (existing) return existing
    return ChatModel.create({ jobId, clientId, artisanId })
  },

  async getChatByJobId(jobId: string) {
    return ChatModel.findOne({ jobId })
  },

  async getChatById(chatId: string) {
    const chat = await ChatModel.findById(chatId)
    if (!chat) throw new AppError(404, 'Chat non trovata')
    return chat
  },

  async sendMessage(
    chatId: string,
    senderId: string,
    senderRole: SenderRole,
    dto: SendMessageDto
  ) {
    const chat = await ChatModel.findById(chatId)
    if (!chat) throw new AppError(404, 'Chat non trovata')

    const type = dto.type ?? (dto.imageUrl ? 'image' : 'text')
    const msg  = await MessageModel.create({
      chatId,
      senderId,
      text:     dto.text     ?? null,
      imageUrl: dto.imageUrl ?? null,
      type,
    })

    const lastMessage = dto.text ?? (dto.imageUrl ? '📷 Immagine' : '')
    const inc = senderRole === 'client'
      ? { unreadArtisan: 1 }
      : { unreadClient: 1 }

    await ChatModel.findByIdAndUpdate(chatId, {
      $inc: inc,
      $set: { lastMessage },
    })

    return msg
  },

  async getHistory(chatId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const [messages, total] = await Promise.all([
      MessageModel.find({ chatId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MessageModel.countDocuments({ chatId }),
    ])
    return {
      messages,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    }
  },

  async markRead(chatId: string, userId: string, role: SenderRole) {
    const field = role === 'client' ? 'unreadClient' : 'unreadArtisan'
    await ChatModel.findByIdAndUpdate(chatId, { $set: { [field]: 0 } })
    await MessageModel.updateMany(
      { chatId, readAt: null, senderId: { $ne: userId } },
      { $set: { readAt: new Date() } }
    )
  },

  async getUnreadCount(userId: string, role: SenderRole) {
    const userField = role === 'client' ? 'clientId' : 'artisanId'
    const unreadField = role === 'client' ? 'unreadClient' : 'unreadArtisan'

    const chats = await ChatModel.find({ [userField]: userId })
    const unread = chats.reduce((sum, c) => sum + (c[unreadField] ?? 0), 0)
    return {
      unread,
      chats: chats.map((c) => ({
        chatId:  (c._id as { toString(): string }).toString(),
        jobId:   c.jobId,
        unread:  c[unreadField] ?? 0,
      })),
    }
  },
}
