import { io } from '../../shared/socket'
import { ChatService } from './chat.service'

export function initChatGateway() {
  io.on('connection', (socket) => {
    socket.on('send_message', async (data: {
      chatId: string; senderId: string; text: string
    }) => {
      const message = await ChatService.saveMessage(data.chatId, data.senderId, data.text)
      // Broadcast a tutti nella stanza chat
      io.to(`chat:${data.chatId}`).emit('new_message', message)
    })

    socket.on('get_history', async (chatId: string, callback: Function) => {
      const messages = await ChatService.getHistory(chatId)
      callback(messages)
    })
  })
}
