import { fcm } from '../../config/firebase.config'
import { logger } from '../../shared/logger'

export const FirebaseService = {
  async sendPush(token: string, title: string, body: string, data?: Record<string, string>) {
    try {
      await fcm.send({ token, notification: { title, body }, data })
    } catch (err) {
      logger.error('Errore push notification', { err, token })
    }
  },

  async sendMulticast(tokens: string[], title: string, body: string) {
    if (!tokens.length) return
    await fcm.sendEachForMulticast({ tokens, notification: { title, body } })
  },
}
