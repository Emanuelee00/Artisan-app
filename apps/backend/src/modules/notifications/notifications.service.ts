import { FirebaseService } from './firebase.service'
import { notificationQueue } from '../../shared/queue/bullmq'

export const NotificationsService = {
  // Invio immediato
  async sendNow(token: string, title: string, body: string) {
    await FirebaseService.sendPush(token, title, body)
  },

  // Invio in coda (asincrono, non blocca)
  async enqueue(token: string, title: string, body: string, data?: any) {
    await notificationQueue.add('send', { token, title, body, data })
  },
}
