import { Worker } from 'bullmq'
import { logger } from '../../logger'

// Il worker viene importato all'avvio per attivare il processing
new Worker('invoices', async (job) => {
  const { invoiceId } = job.data
  logger.info(`Generazione PDF per fattura ${invoiceId}`)
  // La logica vera è in invoices.service.ts → generatePdf()
}, { connection: { host: 'localhost', port: 6379 } })
