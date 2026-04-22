import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const tokens = useAuthStore.getState().tokens
    socket = io(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000', {
      auth: { token: tokens?.accessToken },
    })
  }
  return socket
}

export function joinChat(chatId: string) {
  getSocket().emit('join_chat', chatId)
}

export function sendMessage(chatId: string, senderId: string, text: string) {
  getSocket().emit('send_message', { chatId, senderId, text })
}

export function onNewMessage(callback: (msg: any) => void) {
  getSocket().on('new_message', callback)
  return () => getSocket().off('new_message', callback)
}
