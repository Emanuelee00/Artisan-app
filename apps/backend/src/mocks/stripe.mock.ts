import { logger } from '../shared/logger'

interface MockPaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
  status: 'requires_payment_method' | 'succeeded' | 'canceled'
  metadata: Record<string, string>
  createdAt: Date
}

interface MockAccount {
  id: string
  email: string
  type: string
  createdAt: Date
}

interface MockTransfer {
  id: string
  amount: number
  currency: string
  destination: string
  createdAt: Date
}

const paymentIntents = new Map<string, MockPaymentIntent>()
const accounts = new Map<string, MockAccount>()
const transfers: MockTransfer[] = []

let counter = 1

function nextId(prefix: string): string {
  return `${prefix}_mock_${Date.now()}_${counter++}`
}

export class StripeMock {
  readonly paymentIntents = {
    create: async (params: {
      amount: number
      currency: string
      metadata?: Record<string, string>
      automatic_payment_methods?: unknown
    }): Promise<{ id: string; client_secret: string; amount: number; currency: string }> => {
      const id = nextId('pi')
      const clientSecret = `${id}_secret_mock`
      const intent: MockPaymentIntent = {
        id,
        clientSecret,
        amount: params.amount,
        currency: params.currency,
        status: 'requires_payment_method',
        metadata: params.metadata ?? {},
        createdAt: new Date(),
      }
      paymentIntents.set(id, intent)
      logger.info(`[StripeMock] PaymentIntent creato id=${id} amount=${params.amount} ${params.currency}`)
      return { id, client_secret: clientSecret, amount: params.amount, currency: params.currency }
    },

    retrieve: async (id: string): Promise<MockPaymentIntent & { client_secret: string }> => {
      const intent = paymentIntents.get(id)
      if (!intent) throw new Error(`[StripeMock] PaymentIntent ${id} non trovato`)
      return { ...intent, client_secret: intent.clientSecret }
    },

    confirm: async (id: string): Promise<MockPaymentIntent & { client_secret: string }> => {
      const intent = paymentIntents.get(id)
      if (!intent) throw new Error(`[StripeMock] PaymentIntent ${id} non trovato`)
      intent.status = 'succeeded'
      logger.info(`[StripeMock] PaymentIntent confermato id=${id}`)
      return { ...intent, client_secret: intent.clientSecret }
    },
  }

  readonly accounts = {
    create: async (params: {
      type: string
      email: string
      capabilities?: unknown
    }): Promise<{ id: string; email: string; type: string }> => {
      const id = nextId('acct')
      const account: MockAccount = { id, email: params.email, type: params.type, createdAt: new Date() }
      accounts.set(id, account)
      logger.info(`[StripeMock] Connect account creato id=${id} email=${params.email}`)
      return { id, email: params.email, type: params.type }
    },

    retrieve: async (id: string): Promise<MockAccount> => {
      const account = accounts.get(id)
      if (!account) throw new Error(`[StripeMock] Account ${id} non trovato`)
      return account
    },
  }

  readonly accountLinks = {
    create: async (params: {
      account: string
      refresh_url: string
      return_url: string
      type: string
    }): Promise<{ url: string; expires_at: number }> => {
      const url = `http://localhost:3000/mock-stripe-onboarding?account=${params.account}`
      logger.info(`[StripeMock] AccountLink creato per account=${params.account}`)
      return { url, expires_at: Math.floor(Date.now() / 1000) + 3600 }
    },
  }

  readonly transfers = {
    create: async (params: {
      amount: number
      currency: string
      destination: string
      transfer_group?: string
    }): Promise<{ id: string; amount: number; currency: string; destination: string }> => {
      const id = nextId('tr')
      const transfer: MockTransfer = {
        id,
        amount: params.amount,
        currency: params.currency,
        destination: params.destination,
        createdAt: new Date(),
      }
      transfers.push(transfer)
      logger.info(
        `[StripeMock] Transfer creato id=${id} amount=${params.amount} -> ${params.destination}`
      )
      return { id, amount: params.amount, currency: params.currency, destination: params.destination }
    },
  }

  readonly webhooks = {
    constructEvent: (
      payload: Buffer | string,
      _signature: string,
      _secret: string
    ): { type: string; data: { object: unknown } } => {
      try {
        const body = typeof payload === 'string' ? payload : payload.toString('utf8')
        return JSON.parse(body)
      } catch {
        throw new Error('[StripeMock] Payload webhook non valido')
      }
    },
  }

  // ── helpers per i test ──────────────────────────────────────────────────────

  getPaymentIntents(): MockPaymentIntent[] {
    return Array.from(paymentIntents.values())
  }

  getAccounts(): MockAccount[] {
    return Array.from(accounts.values())
  }

  getTransfers(): MockTransfer[] {
    return [...transfers]
  }

  reset(): void {
    paymentIntents.clear()
    accounts.clear()
    transfers.length = 0
  }
}
