import { Router } from 'express'
import { authenticate } from '../../gateway/auth.middleware'
import { ChatController } from './chat.controller'

const router = Router()

router.use(authenticate)

router.get('/unread',              ChatController.getUnread)
router.get('/:jobId/messages',     ChatController.getHistory)

export default router
