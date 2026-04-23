import { api } from './api'
import type { Payment } from '@artisan/shared-types'

export const PaymentsAPI = {
  list: (): Promise<Payment[]> =>
    api.get('/payments').then((r) => r.data),

  createIntent: (jobId: string): Promise<{ clientSecret: string; paymentId: string; amount: number }> =>
    api.post('/payments/intent', { jobId }).then((r) => r.data),

  onboard: (email: string): Promise<{ accountId: string; mockMode?: boolean }> =>
    api.post('/payments/onboard', { email }).then((r) => r.data),

  payout: (jobId: string) =>
    api.post(`/payments/payout/${jobId}`).then((r) => r.data),
}
