import { Worker } from 'bullmq'
import { fcm } from '../../../config/firebase.config'
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

new Worker('notifications', async (job) => {
  const { token, title, body, data } = job.data

  await fcm.send({ token, notification: { title, body }, data })
  logger.info(`Notifica inviata: ${title}`)
}, { connection: parseRedisUrl(env.REDIS_URL) })
