import { Queue } from 'bullmq'
import { isMock } from '../../config/env'
import { logger } from '../logger'

// In mock mode BullMQ non viene inizializzato — i job vengono eseguiti inline
// nei service oppure loggati. In produzione usa ioredis reale via REDIS_URL.

type AnyQueue = Queue | MockQueue

class MockQueue {
  readonly name: string
  private jobs: { name: string; data: unknown }[] = []

  constructor(name: string) { this.name = name }

  async add(jobName: string, data: unknown): Promise<{ id: string }> {
    this.jobs.push({ name: jobName, data })
    logger.info(`[BullMQ MOCK] Queue=${this.name} job=${jobName}`, { data })
    return { id: `mock_job_${Date.now()}` }
  }

  getJobs(): { name: string; data: unknown }[] { return [...this.jobs] }
}

function makeQueue(name: string): AnyQueue {
  if (isMock('REDIS_URL')) return new MockQueue(name)
  const { host, port } = parseRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return new Queue(name, { connection: { host, port } })
}

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || 6379 }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

export const notificationQueue = makeQueue('notifications')
export const invoiceQueue       = makeQueue('invoices')
export const payoutQueue        = makeQueue('payouts')

logger.info(`BullMQ queues inizializzate ${isMock('REDIS_URL') ? '[MOCK]' : ''}`)
