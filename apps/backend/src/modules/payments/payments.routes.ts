import { Router } from 'express'
import express from 'express'
import { authenticate, authorize } from '../../gateway/auth.middleware'
import {
  PaymentsController,
  validateIntent,
  validateOnboard,
  validateMockWebhook,
} from './payments.controller'

const router = Router()

// ── Stripe real webhook (raw body, no auth) ───────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentsController.webhook
)

// ── Mock webhook (dev/test only, no auth required) ───────────────────────────
router.post('/mock-webhook', validateMockWebhook, PaymentsController.mockWebhook)

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate)

router.post('/onboard',          validateOnboard, PaymentsController.onboard)
router.post('/intent',           validateIntent,  PaymentsController.createIntent)
router.post('/payout/:jobId',    authorize('artisan', 'admin'), PaymentsController.payout)
router.get('/',                  PaymentsController.history)

export default router
