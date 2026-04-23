import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../../app'
import { initSocketIO } from '../../shared/socket'
import { connectMongo, disconnectMongo } from '../../shared/db/mongo'
import { ChatService } from './chat.service'
import { ChatModel, MessageModel } from './chat.model'
import { ChatEvents } from './chat.events'

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'mock_jwt_secret_dev_only'

function makeToken(id: string, role: string) {
  return jwt.sign({ id, role }, SECRET)
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs)
    socket.once(event, (data: T) => { clearTimeout(timer); resolve(data) })
  })
}

function connectSocket(url: string, token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token }, transports: ['websocket'] })
    s.once('connect', () => resolve(s))
    s.once('connect_error', reject)
  })
}

// ── Seed IDs ─────────────────────────────────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'
const ARTISAN_ID = 'usr_artisan_001'
const JOB_ID     = 'job_001'

const clientToken  = makeToken(CLIENT_ID,  'client')
const artisanToken = makeToken(ARTISAN_ID, 'artisan')

// ── Server setup ──────────────────────────────────────────────────────────────

let httpServer: ReturnType<typeof createServer>
let baseUrl: string
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  await connectMongo()

  app        = createApp()
  httpServer = createServer(app)
  initSocketIO(httpServer)

  await new Promise<void>((res) => httpServer.listen(0, () => res()))
  const port = (httpServer.address() as { port: number }).port
  baseUrl    = `http://localhost:${port}`
})

afterAll(async () => {
  await new Promise<void>((res) => httpServer.close(() => res()))
  await disconnectMongo()
})

beforeEach(async () => {
  await ChatModel.deleteMany({})
  await MessageModel.deleteMany({})
})

// ── ChatService unit tests ────────────────────────────────────────────────────

describe('ChatService.getOrCreateChat', () => {
  it('crea una nuova chat', async () => {
    const chat = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    expect(chat.jobId).toBe(JOB_ID)
    expect(chat.clientId).toBe(CLIENT_ID)
    expect(chat.artisanId).toBe(ARTISAN_ID)
    expect(chat.unreadClient).toBe(0)
    expect(chat.unreadArtisan).toBe(0)
  })

  it('è idempotente: ritorna la stessa chat se esiste già', async () => {
    const first  = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const second = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    expect(second._id.toString()).toBe(first._id.toString())
  })
})

describe('ChatService.sendMessage', () => {
  it('salva un messaggio di testo e incrementa unreadArtisan', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    const msg = await ChatService.sendMessage(chatId, CLIENT_ID, 'client', { text: 'Ciao!' })

    expect(msg.chatId).toBe(chatId)
    expect(msg.senderId).toBe(CLIENT_ID)
    expect(msg.text).toBe('Ciao!')
    expect(msg.type).toBe('text')

    const updated = await ChatModel.findById(chatId)
    expect(updated!.unreadArtisan).toBe(1)
    expect(updated!.lastMessage).toBe('Ciao!')
  })

  it('incrementa unreadClient se manda l\'artigiano', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Arrivo!' })
    const updated = await ChatModel.findById(chatId)
    expect(updated!.unreadClient).toBe(1)
    expect(updated!.unreadArtisan).toBe(0)
  })

  it('salva imageUrl e imposta type=image', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()
    const msg    = await ChatService.sendMessage(chatId, CLIENT_ID, 'client', {
      imageUrl: 'https://example.com/foto.jpg',
    })
    expect(msg.type).toBe('image')
    expect(msg.imageUrl).toBe('https://example.com/foto.jpg')
    expect(msg.text).toBeNull()
  })

  it('lancia 404 per chat inesistente', async () => {
    await expect(
      ChatService.sendMessage('000000000000000000000000', CLIENT_ID, 'client', { text: 'x' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ChatService.getHistory', () => {
  it('ritorna messaggi in ordine decrescente paginati', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    for (let i = 1; i <= 5; i++) {
      await ChatService.sendMessage(chatId, CLIENT_ID, 'client', { text: `Msg ${i}` })
    }

    const result = await ChatService.getHistory(chatId, 1, 3)
    expect(result.messages).toHaveLength(3)
    expect(result.total).toBe(5)
    expect(result.pages).toBe(2)
    // Ordine desc: Msg 5, 4, 3
    expect(result.messages[0].text).toBe('Msg 5')
  })

  it('pagina 2 contiene i messaggi rimanenti', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    for (let i = 1; i <= 5; i++) {
      await ChatService.sendMessage(chatId, CLIENT_ID, 'client', { text: `Msg ${i}` })
    }

    const result = await ChatService.getHistory(chatId, 2, 3)
    expect(result.messages).toHaveLength(2)
  })
})

describe('ChatService.markRead', () => {
  it('azzera unreadClient e imposta readAt sui messaggi', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Test' })
    let snapshot = await ChatModel.findById(chatId)
    expect(snapshot!.unreadClient).toBe(1)

    await ChatService.markRead(chatId, CLIENT_ID, 'client')

    snapshot = await ChatModel.findById(chatId)
    expect(snapshot!.unreadClient).toBe(0)

    const msgs = await MessageModel.find({ chatId })
    expect(msgs.every((m) => m.readAt !== null)).toBe(true)
  })
})

describe('ChatService.getUnreadCount', () => {
  it('ritorna conteggio totale per utente', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Msg 1' })
    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Msg 2' })

    const result = await ChatService.getUnreadCount(CLIENT_ID, 'client')
    expect(result.unread).toBe(2)
    expect(result.chats).toHaveLength(1)
    expect(result.chats[0].unread).toBe(2)
  })
})

// ── REST API tests ────────────────────────────────────────────────────────────

describe('GET /api/v1/chat/:jobId/messages', () => {
  it('ritorna storico paginato (200)', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()
    await ChatService.sendMessage(chatId, CLIENT_ID, 'client', { text: 'Prima domanda' })

    const res = await request(app)
      .get(`/api/v1/chat/${JOB_ID}/messages?page=1&limit=10`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(1)
    expect(res.body.total).toBe(1)
    expect(res.body.pages).toBe(1)
  })

  it('lancia 404 se il job non ha una chat', async () => {
    const res = await request(app)
      .get('/api/v1/chat/job_999/messages')
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(404)
  })

  it('lancia 403 se non sei un partecipante', async () => {
    await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const otherToken = makeToken('usr_other_999', 'client')

    const res = await request(app)
      .get(`/api/v1/chat/${JOB_ID}/messages`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(403)
  })

  it('lancia 401 senza token', async () => {
    const res = await request(app).get(`/api/v1/chat/${JOB_ID}/messages`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/chat/unread', () => {
  it('ritorna 0 se non ci sono messaggi non letti', async () => {
    const res = await request(app)
      .get('/api/v1/chat/unread')
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.unread).toBe(0)
  })

  it('ritorna il conteggio corretto', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()
    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Risposta' })

    const res = await request(app)
      .get('/api/v1/chat/unread')
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.unread).toBe(1)
  })
})

// ── WebSocket gateway tests ───────────────────────────────────────────────────

describe('WebSocket: join_chat + send_message → new_message', () => {
  it('il client riceve new_message dopo send_message', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()

    const clientSocket  = await connectSocket(baseUrl, clientToken)
    const artisanSocket = await connectSocket(baseUrl, artisanToken)

    // Entrambi si uniscono alla stanza
    const clientJoined  = waitFor<{ chatId: string }>(clientSocket,  ChatEvents.CHAT_JOINED)
    const artisanJoined = waitFor<{ chatId: string }>(artisanSocket, ChatEvents.CHAT_JOINED)

    clientSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })
    artisanSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })

    await clientJoined
    await artisanJoined

    // L'artigiano si mette in ascolto di new_message
    const receivedByArtisan = waitFor<{ message: { text: string } }>(artisanSocket, ChatEvents.NEW_MESSAGE)

    // Il client invia un messaggio
    clientSocket.emit(ChatEvents.SEND_MESSAGE, { jobId: JOB_ID, text: 'Quando arrivi?' })

    const received = await receivedByArtisan
    expect(received.message.text).toBe('Quando arrivi?')

    clientSocket.disconnect()
    artisanSocket.disconnect()
  })

  it('il mittente riceve il proprio messaggio (stessa stanza)', async () => {
    await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)

    const clientSocket = await connectSocket(baseUrl, clientToken)
    await waitFor(clientSocket, ChatEvents.CHAT_JOINED, 2000).catch(() => null)
    clientSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })
    await waitFor(clientSocket, ChatEvents.CHAT_JOINED)

    const receivedBySelf = waitFor<{ message: { text: string } }>(clientSocket, ChatEvents.NEW_MESSAGE)
    clientSocket.emit(ChatEvents.SEND_MESSAGE, { jobId: JOB_ID, text: 'Self test' })

    const received = await receivedBySelf
    expect(received.message.text).toBe('Self test')

    clientSocket.disconnect()
  })
})

describe('WebSocket: mark_read → messages_read', () => {
  it('emette messages_read a tutti nella stanza', async () => {
    const chat   = await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chatId = chat._id.toString()
    await ChatService.sendMessage(chatId, ARTISAN_ID, 'artisan', { text: 'Messaggio' })

    const clientSocket  = await connectSocket(baseUrl, clientToken)
    const artisanSocket = await connectSocket(baseUrl, artisanToken)

    clientSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })
    artisanSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })

    await waitFor(clientSocket,  ChatEvents.CHAT_JOINED)
    await waitFor(artisanSocket, ChatEvents.CHAT_JOINED)

    const artisanGetsRead = waitFor<{ chatId: string; userId: string }>(artisanSocket, ChatEvents.MESSAGES_READ)
    clientSocket.emit(ChatEvents.MARK_READ, { chatId })

    const readEvent = await artisanGetsRead
    expect(readEvent.chatId).toBe(chatId)
    expect(readEvent.userId).toBe(CLIENT_ID)

    clientSocket.disconnect()
    artisanSocket.disconnect()
  })
})

describe('WebSocket: typing → user_typing', () => {
  it('propaga user_typing all\'altro utente', async () => {
    await ChatService.getOrCreateChat(JOB_ID, CLIENT_ID, ARTISAN_ID)
    const chat   = await ChatService.getChatByJobId(JOB_ID)
    const chatId = chat!._id.toString()

    const clientSocket  = await connectSocket(baseUrl, clientToken)
    const artisanSocket = await connectSocket(baseUrl, artisanToken)

    clientSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })
    artisanSocket.emit(ChatEvents.JOIN_CHAT, { jobId: JOB_ID })

    await waitFor(clientSocket,  ChatEvents.CHAT_JOINED)
    await waitFor(artisanSocket, ChatEvents.CHAT_JOINED)

    const artisanSeesTyping = waitFor<{ userId: string }>(artisanSocket, ChatEvents.USER_TYPING)
    clientSocket.emit(ChatEvents.TYPING, { chatId })

    const typing = await artisanSeesTyping
    expect(typing.userId).toBe(CLIENT_ID)

    clientSocket.disconnect()
    artisanSocket.disconnect()
  })
})
