import { Worker } from 'bullmq'
import { logger } from '../../logger'
import { isMock } from '../../../config/env'

// Only start real Worker when Redis is available (not in mock mode)
if (!isMock('REDIS_URL')) {
  const { InvoicesService } = require('../../../modules/invoices/invoices.service')

  new Worker('invoices', async (job) => {
    const { invoiceId } = job.data as { invoiceId: string }
    logger.info(`[Worker] Generazione PDF fattura ${invoiceId}`)
    await InvoicesService.generateAndSavePdf(invoiceId)
    logger.info(`[Worker] PDF fattura ${invoiceId} generato`)
  }, {
    connection: { host: 'localhost', port: 6379 },
  })
}
