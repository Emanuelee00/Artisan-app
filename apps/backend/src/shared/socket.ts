import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { logger } from './logger'
import { initChatGateway }     from '../modules/chat/chat.gateway'
import { initTrackingGateway } from '../modules/tracking/tracking.gateway'

export let io: SocketServer

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true }
  })

  io.on('connection', (socket) => {
    logger.debug(`Socket connesso: ${socket.id}`)

    // Auto-join personal room (client:<id> or artisan:<id>) for direct notifications
    const token = socket.handshake.auth?.token as string | undefined
    if (token) {
      try {
        const user = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
        socket.join(`${user.role}:${user.id}`)
      } catch { /* invalid token — skip */ }
    }

    socket.on('join_job', (jobId: string) => socket.join(`job:${jobId}`))

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnesso: ${socket.id}`)
    })
  })

  initChatGateway(io)
  initTrackingGateway(io)

  logger.info('Socket.IO inizializzato')
}
