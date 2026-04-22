import { Router } from 'express'
import express from 'express'
import { PaymentsController } from './payments.controller'
import { authenticate } from '../../gateway/auth.middleware'

const router = Router()

// Webhook deve ricevere raw body (non JSON parsato)
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentsController.webhook)

router.use(authenticate)
router.post('/intent',  PaymentsController.createIntent)
router.post('/onboard', PaymentsController.onboard)

export default router
