import { api } from './api'

export const PaymentsAPI = {
  createIntent: (amount: number, currency: string, jobId: string) =>
    api.post('/payments/intent', { amount, currency, jobId }).then(r => r.data),

  onboard: (email: string, returnUrl: string) =>
    api.post('/payments/onboard', { email, returnUrl }).then(r => r.data),
}
