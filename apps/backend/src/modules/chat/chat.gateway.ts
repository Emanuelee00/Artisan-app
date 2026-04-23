import jwt from 'jsonwebtoken'
import { Server as SocketServer, Socket } from 'socket.io'
import { env } from '../../config/env'
import { ChatService } from './chat.service'
import { ChatEvents } from './chat.events'
import { logger } from '../../shared/logger'

interface AuthSocket extends Socket {
  userId?: string
  userRole?: string
}

function extractUser(token: string): { id: string; role: string } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
  } catch {
    return null
  }
}

// ── Gateway ──────────────────────────────────────────────────────────────────

export function initChatGateway(io: SocketServer) {
  io.on('connection', (socket: AuthSocket) => {
    // Authenticate via handshake token
    const token = socket.handshake.auth?.token as string | undefined
    if (token) {
      const user = extractUser(token)
      if (user) {
        socket.userId   = user.id
        socket.userRole = user.role
      }
    }

    // ── join_chat { jobId } ───────────────────────────────────────────────────
    socket.on(ChatEvents.JOIN_CHAT, async (data: { jobId: string; clientId?: string; artisanId?: string }) => {
      try {
        const jobId     = data.jobId
        const clientId  = data.clientId  ?? ''
        const artisanId = data.artisanId ?? ''

        const chat = clientId && artisanId
          ? await ChatService.getOrCreateChat(jobId, clientId, artisanId)
          : await ChatService.getChatByJobId(jobId)

        if (!chat) {
          socket.emit('error', { message: 'Chat non trovata' })
          return
        }

        const chatId = (chat._id as { toString(): string }).toString()
        socket.join(`chat:${chatId}`)

        socket.emit(ChatEvents.CHAT_JOINED, {
          chatId,
          jobId:     chat.jobId,
          clientId:  chat.clientId,
          artisanId: chat.artisanId,
        })
      } catch (err) {
        logger.error('join_chat error', err)
        socket.emit('error', { message: 'Errore join chat' })
      }
    })

    // ── send_message { jobId, text, imageUrl?, type? } ─────────────────────
    socket.on(ChatEvents.SEND_MESSAGE, async (data: {
      jobId:     string
      text?:     string
      imageUrl?: string
      type?:     'text' | 'image' | 'system'
    }) => {
      try {
        if (!socket.userId) { socket.emit('error', { message: 'Non autenticato' }); return }

        const chat = await ChatService.getChatByJobId(data.jobId)
        if (!chat) { socket.emit('error', { message: 'Chat non trovata' }); return }

        const chatId = (chat._id as { toString(): string }).toString()
        const role   = socket.userRole === 'artisan' ? 'artisan' : 'client'

        const msg = await ChatService.sendMessage(chatId, socket.userId, role, {
          text:     data.text,
          imageUrl: data.imageUrl,
          type:     data.type,
        })

        io.to(`chat:${chatId}`).emit(ChatEvents.NEW_MESSAGE, { message: msg })
      } catch (err) {
        logger.error('send_message error', err)
        socket.emit('error', { message: 'Errore invio messaggio' })
      }
    })

    // ── mark_read { chatId } ───────────────────────────────────────────────
    socket.on(ChatEvents.MARK_READ, async (data: { chatId: string }) => {
      try {
        if (!socket.userId) { socket.emit('error', { message: 'Non autenticato' }); return }

        const role = socket.userRole === 'artisan' ? 'artisan' : 'client'
        await ChatService.markRead(data.chatId, socket.userId, role)

        io.to(`chat:${data.chatId}`).emit(ChatEvents.MESSAGES_READ, {
          chatId: data.chatId,
          userId: socket.userId,
        })
      } catch (err) {
        logger.error('mark_read error', err)
      }
    })

    // ── typing { chatId } ─────────────────────────────────────────────────
    socket.on(ChatEvents.TYPING, (data: { chatId: string }) => {
      if (!socket.userId) return
      socket.to(`chat:${data.chatId}`).emit(ChatEvents.USER_TYPING, {
        userId: socket.userId,
        chatId: data.chatId,
      })
    })
  })
}
