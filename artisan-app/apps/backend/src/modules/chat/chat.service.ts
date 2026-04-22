import { MessageModel } from './chat.model'

export const ChatService = {
  async saveMessage(chatId: string, senderId: string, text: string, type = 'text') {
    return MessageModel.create({ chatId, senderId, text, type })
  },

  async getHistory(chatId: string, limit = 50) {
    return MessageModel.find({ chatId }).sort({ createdAt: -1 }).limit(limit)
  },
}
