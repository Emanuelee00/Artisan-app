import { Router } from 'express'
import { JobsController } from './jobs.controller'
import { authenticate, authorize } from '../../gateway/auth.middleware'

const router = Router()

router.use(authenticate)
router.post('/',                                     JobsController.create)
router.patch('/:id/accept',  authorize('artisan'),   JobsController.accept)
router.patch('/:id/complete', authorize('artisan'),  JobsController.complete)

export default router
