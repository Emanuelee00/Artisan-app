// ── In-memory collections ────────────────────────────────────────────────────

type Doc = Record<string, unknown> & { _id: string }

const collections = new Map<string, Doc[]>()

let counter = 1
function nextId(): string {
  return `mock_oid_${Date.now()}_${counter++}`
}

// Seed: un paio di chat e messaggi
const seedChat: Doc = {
  _id: 'chat_001',
  id: 'chat_001',
  jobId: 'job_001',
  clientId: 'usr_client_001',
  artisanId: 'usr_artisan_001',
  lastMessage: 'Arrivo alle 10!',
  updatedAt: new Date('2025-05-30'),
}

const seedMessages: Doc[] = [
  {
    _id: 'msg_001',
    id: 'msg_001',
    chatId: 'chat_001',
    senderId: 'usr_client_001',
    text: 'Buongiorno, quando è disponibile?',
    type: 'text',
    createdAt: new Date('2025-05-29T08:00:00'),
  },
  {
    _id: 'msg_002',
    id: 'msg_002',
    chatId: 'chat_001',
    senderId: 'usr_artisan_001',
    text: 'Arrivo alle 10!',
    type: 'text',
    createdAt: new Date('2025-05-29T08:05:00'),
  },
]

collections.set('chats', [seedChat])
collections.set('messages', seedMessages)

// ── Collection class ─────────────────────────────────────────────────────────

function matchQuery(doc: Doc, query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([k, v]) => {
    if (typeof v === 'object' && v !== null && '$in' in (v as object)) {
      return ((v as { $in: unknown[] }).$in).includes(doc[k])
    }
    if (typeof v === 'object' && v !== null && '$gte' in (v as object)) {
      return (doc[k] as number) >= (v as { $gte: number }).$gte
    }
    return doc[k] === v
  })
}

class MockCollection<T extends Doc = Doc> {
  private name: string
  constructor(name: string) {
    this.name = name
    if (!collections.has(name)) collections.set(name, [])
  }

  private get rows(): T[] { return (collections.get(this.name) ?? []) as T[] }

  async find(query: Partial<T> = {}): Promise<{ toArray: () => Promise<T[]> }> {
    const q = query as Record<string, unknown>
    const result = this.rows.filter((d) => matchQuery(d as Doc, q))
    return { toArray: async () => result }
  }

  async findOne(query: Partial<T>): Promise<T | null> {
    const q = query as Record<string, unknown>
    return this.rows.find((d) => matchQuery(d as Doc, q)) ?? null
  }

  async insertOne(doc: Omit<T, '_id'> & { _id?: string }): Promise<{ insertedId: string }> {
    const _id = (doc as { _id?: string })._id ?? nextId()
    const full = { ...doc, _id } as unknown as T
    this.rows.push(full)
    return { insertedId: _id }
  }

  async insertMany(docs: Array<Omit<T, '_id'> & { _id?: string }>): Promise<{ insertedCount: number }> {
    for (const doc of docs) await this.insertOne(doc)
    return { insertedCount: docs.length }
  }

  async updateOne(
    query: Partial<T>,
    update: { $set?: Partial<T>; $push?: Partial<Record<keyof T, unknown>> }
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const q = query as Record<string, unknown>
    const doc = this.rows.find((d) => matchQuery(d as Doc, q))
    if (!doc) return { matchedCount: 0, modifiedCount: 0 }
    if (update.$set) Object.assign(doc, update.$set)
    return { matchedCount: 1, modifiedCount: 1 }
  }

  async deleteOne(query: Partial<T>): Promise<{ deletedCount: number }> {
    const q = query as Record<string, unknown>
    const idx = this.rows.findIndex((d) => matchQuery(d as Doc, q))
    if (idx === -1) return { deletedCount: 0 }
    this.rows.splice(idx, 1)
    return { deletedCount: 1 }
  }

  async countDocuments(query: Partial<T> = {}): Promise<number> {
    const q = query as Record<string, unknown>
    return this.rows.filter((d) => matchQuery(d as Doc, q)).length
  }
}

// ── MongoMock ────────────────────────────────────────────────────────────────

export class MongoMock {
  collection<T extends Doc = Doc>(name: string): MockCollection<T> {
    return new MockCollection<T>(name)
  }

  // helpers per i test
  getCollection<T extends Doc = Doc>(name: string): T[] {
    return (collections.get(name) ?? []) as T[]
  }

  reset(): void {
    collections.clear()
    collections.set('chats', [{ ...seedChat }])
    collections.set('messages', seedMessages.map((m) => ({ ...m })))
  }
}

// Singleton per usarlo nei service senza reinizializzare
export const mongoMock = new MongoMock()
