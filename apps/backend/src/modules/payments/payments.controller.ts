import { Request, Response, NextFunction } from 'express'
import { PaymentsService } from './payments.service'
import { validate } from '../../gateway/validation.middleware'
import {
  createIntentSchema,
  onboardSchema,
  mockWebhookSchema,
} from './payments.schema'
import type { AuthRequest } from '../../gateway/auth.middleware'
import { isMock } from '../../config/env'
import { AppError } from '../../gateway/errorHandler'

export const validateIntent      = validate(createIntentSchema)
export const validateOnboard     = validate(onboardSchema)
export const validateMockWebhook = validate(mockWebhookSchema)

export const PaymentsController = {
  async onboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'artisan') {
        throw new AppError(403, 'Solo gli artigiani possono fare onboarding')
      }
      const result = await PaymentsService.onboardArtisan(req.user!.id, req.body)
      res.status(201).json(result)
    } catch (e) { next(e) }
  },

  async createIntent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'client') {
        throw new AppError(403, 'Solo i clienti possono creare un payment intent')
      }
      const result = await PaymentsService.createIntent(req.user!.id, req.body)
      res.status(201).json(result)
    } catch (e) { next(e) }
  },

  // Real Stripe webhook — raw body required (see routes)
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['stripe-signature'] as string
      if (!sig && !isMock('STRIPE_SECRET_KEY')) {
        throw new AppError(400, 'stripe-signature header mancante')
      }
      const type = await PaymentsService.processRealWebhook(
        req.body as Buffer,
        sig ?? 'mock_sig'
      )
      res.json({ received: true, type })
    } catch (e) { next(e) }
  },

  // Mock-only endpoint — simulates Stripe events without real API keys
  async mockWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!isMock('STRIPE_SECRET_KEY')) {
        throw new AppError(403, 'Endpoint disponibile solo in mock mode')
      }
      const { type, data } = req.body as { type: string; data: { object: Record<string, unknown> } }
      await PaymentsService.handleWebhookEvent(type, data.object)
      res.json({ received: true, type })
    } catch (e) { next(e) }
  },

  async payout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await PaymentsService.triggerPayout(req.params.jobId)
      res.json(result)
    } catch (e) { next(e) }
  },

  async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payments = await PaymentsService.getHistory(req.user!.id, req.user!.role)
      res.json(payments)
    } catch (e) { next(e) }
  },
}
