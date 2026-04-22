import { Request, Response, NextFunction } from 'express'
import { StripeService } from './stripe.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const PaymentsController = {
  async createIntent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, currency, jobId } = req.body
      const result = await StripeService.createPaymentIntent(amount, currency, jobId)
      res.json(result)
    } catch (e) { next(e) }
  },

  async onboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await StripeService.createConnectAccount(req.body.email)
      const url = await StripeService.createOnboardingLink(account.id, req.body.returnUrl)
      res.json({ url, accountId: account.id })
    } catch (e) { next(e) }
  },

  // Riceve eventi da Stripe (raw body necessario)
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['stripe-signature'] as string
      await StripeService.handleWebhook(req.body, sig)
      res.json({ received: true })
    } catch (e) { next(e) }
  },
}
