export const ChatEvents = {
  // Client → Server
  JOIN_CHAT:    'join_chat',
  SEND_MESSAGE: 'send_message',
  MARK_READ:    'mark_read',
  TYPING:       'typing',

  // Server → Client
  NEW_MESSAGE:   'new_message',
  USER_TYPING:   'user_typing',
  MESSAGES_READ: 'messages_read',
  CHAT_JOINED:   'chat_joined',
} as const
