import { Worker } from 'bullmq'
import { stripe } from '../../../config/stripe.config'
import { logger } from '../../logger'

new Worker('payouts', async (job) => {
  const { stripeAccountId, amount, currency } = job.data

  await stripe.transfers.create({
    amount,
    currency,
    destination: stripeAccountId,
  })

  logger.info(`Payout effettuato: ${amount} ${currency} → ${stripeAccountId}`)
}, { connection: { host: 'localhost', port: 6379 } })
