import { Worker } from 'bullmq'
import { stripe } from '../../../config/stripe.config'
import { logger } from '../../logger'
import { env } from '../../../config/env'

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || 6379 }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

new Worker('payouts', async (job) => {
  const { stripeAccountId, amount, currency } = job.data

  await stripe.transfers.create({
    amount,
    currency,
    destination: stripeAccountId,
  })

  logger.info(`Payout effettuato: ${amount} ${currency} → ${stripeAccountId}`)
}, { connection: parseRedisUrl(env.REDIS_URL) })
