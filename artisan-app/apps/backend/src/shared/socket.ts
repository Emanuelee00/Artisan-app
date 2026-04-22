import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { logger } from './logger'

export let io: SocketServer

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true }
  })

  io.on('connection', (socket) => {
    logger.debug(`Socket connesso: ${socket.id}`)

    socket.on('join_chat', (chatId: string) => socket.join(`chat:${chatId}`))
    socket.on('join_job',  (jobId: string)  => socket.join(`job:${jobId}`))

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnesso: ${socket.id}`)
    })
  })

  logger.info('Socket.IO inizializzato')
}
