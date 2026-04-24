import { Router } from 'express'
import usersRoutes         from '../modules/users/users.routes'
import jobsRoutes          from '../modules/jobs/jobs.routes'
import paymentsRoutes      from '../modules/payments/payments.routes'
import invoicesRoutes      from '../modules/invoices/invoices.routes'
import notificationsRoutes from '../modules/notifications/notifications.routes'
import chatRoutes          from '../modules/chat/chat.routes'
import trackingRoutes      from '../modules/tracking/tracking.routes'
import reviewsRoutes       from '../modules/reviews/reviews.routes'

const router = Router()

router.use('/users',         usersRoutes)
router.use('/jobs',          jobsRoutes)
router.use('/payments',      paymentsRoutes)
router.use('/invoices',      invoicesRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/chat',          chatRoutes)
router.use('/tracking',      trackingRoutes)
router.use('/reviews',       reviewsRoutes)

export { router as mainRouter }
