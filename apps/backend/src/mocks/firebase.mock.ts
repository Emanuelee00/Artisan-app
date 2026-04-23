const MAX_NOTIFICATIONS = 50

export interface MockNotification {
  token?: string
  tokens?: string[]
  title: string
  body: string
  data?: Record<string, string>
  sentAt: Date
}

const notificationLog: MockNotification[] = []

function store(n: MockNotification): void {
  notificationLog.unshift(n)
  if (notificationLog.length > MAX_NOTIFICATIONS) notificationLog.length = MAX_NOTIFICATIONS
}

export class FirebaseMock {
  async send(message: {
    token: string
    notification?: { title?: string; body?: string }
    data?: Record<string, string>
  }): Promise<string> {
    const n: MockNotification = {
      token: message.token,
      title: message.notification?.title ?? '',
      body: message.notification?.body ?? '',
      data: message.data,
      sentAt: new Date(),
    }
    store(n)
    console.log(`🔔 [FirebaseMock] Push → token=${message.token} | "${n.title}" — ${n.body}`)
    return `mock_message_id_${Date.now()}`
  }

  async sendEachForMulticast(message: {
    tokens: string[]
    notification?: { title?: string; body?: string }
    data?: Record<string, string>
  }): Promise<{ successCount: number; failureCount: number; responses: { success: boolean }[] }> {
    const n: MockNotification = {
      tokens: message.tokens,
      title: message.notification?.title ?? '',
      body: message.notification?.body ?? '',
      data: message.data,
      sentAt: new Date(),
    }
    store(n)
    console.log(
      `🔔 [FirebaseMock] Multicast → ${message.tokens.length} token(s) | "${n.title}" — ${n.body}`
    )
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({ success: true })),
    }
  }

  // Esposto per i test
  getLastNotifications(limit = 10): MockNotification[] {
    return notificationLog.slice(0, limit)
  }

  reset(): void {
    notificationLog.length = 0
  }
}
