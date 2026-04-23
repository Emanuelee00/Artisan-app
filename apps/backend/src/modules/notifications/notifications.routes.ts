import { Router } from 'express'
import { authenticate } from '../../gateway/auth.middleware'

const router = Router()

// Placeholder — le notifiche sono principalmente push/event driven
router.get('/test', authenticate, (req, res) => {
  res.json({ message: 'Notifications module attivo' })
})

export default router
