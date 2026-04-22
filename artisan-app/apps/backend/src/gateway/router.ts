import { Router } from 'express'
import usersRoutes   from '../modules/users/users.routes'
import jobsRoutes    from '../modules/jobs/jobs.routes'
import paymentsRoutes from '../modules/payments/payments.routes'
import invoicesRoutes from '../modules/invoices/invoices.routes'
import notificationsRoutes from '../modules/notifications/notifications.routes'

const router = Router()

router.use('/users',         usersRoutes)
router.use('/jobs',          jobsRoutes)
router.use('/payments',      paymentsRoutes)
router.use('/invoices',      invoicesRoutes)
router.use('/notifications', notificationsRoutes)

export { router as mainRouter }
