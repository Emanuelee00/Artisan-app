import { Response, NextFunction } from 'express'
import { ChatService } from './chat.service'
import { AppError } from '../../gateway/errorHandler'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const ChatController = {
  async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50)

      const chat = await ChatService.getChatByJobId(jobId)
      if (!chat) throw new AppError(404, 'Chat non trovata per questo job')

      const userId = req.user!.id
      const role   = req.user!.role
      if (
        role !== 'admin' &&
        chat.clientId !== userId &&
        chat.artisanId !== userId
      ) {
        throw new AppError(403, 'Non sei un partecipante di questa chat')
      }

      const chatId = (chat._id as { toString(): string }).toString()
      const result = await ChatService.getHistory(chatId, page, limit)
      res.json(result)
    } catch (e) { next(e) }
  },

  async getUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.user!.role as 'client' | 'artisan'
      if (role !== 'client' && role !== 'artisan') {
        return res.json({ unread: 0, chats: [] })
      }
      const result = await ChatService.getUnreadCount(req.user!.id, role)
      res.json(result)
    } catch (e) { next(e) }
  },
}
