import { Router } from 'express'
import { authenticate } from '../../gateway/auth.middleware'
import { TrackingController } from './tracking.controller'

const router = Router()

router.use(authenticate)

router.get('/:jobId/route',    TrackingController.getRoute)
router.get('/:jobId/position', TrackingController.getPosition)

export default router
