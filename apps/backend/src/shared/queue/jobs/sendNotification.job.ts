import { Worker } from 'bullmq'
import { fcm } from '../../../config/firebase.config'
import { logger } from '../../logger'

new Worker('notifications', async (job) => {
  const { token, title, body, data } = job.data

  await fcm.send({ token, notification: { title, body }, data })
  logger.info(`Notifica inviata: ${title}`)
}, { connection: { host: 'localhost', port: 6379 } })
