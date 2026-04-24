import { Worker } from 'bullmq'
import { logger } from '../../logger'
import { env, isMock } from '../../../config/env'

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || 6379 }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

// Only start real Worker when Redis is available (not in mock mode)
if (!isMock('REDIS_URL')) {
  const { InvoicesService } = require('../../../modules/invoices/invoices.service')

  new Worker('invoices', async (job) => {
    const { invoiceId } = job.data as { invoiceId: string }
    logger.info(`[Worker] Generazione PDF fattura ${invoiceId}`)
    await InvoicesService.generateAndSavePdf(invoiceId)
    logger.info(`[Worker] PDF fattura ${invoiceId} generato`)
  }, {
    connection: parseRedisUrl(env.REDIS_URL),
  })
}
