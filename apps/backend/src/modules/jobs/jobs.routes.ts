import { Router } from 'express'
import { authenticate, authorize } from '../../gateway/auth.middleware'
import {
  JobsController,
  validateCreate,
  validateList,
  validateComplete,
  validateCancel,
} from './jobs.controller'

const router = Router()

router.use(authenticate)

// ── Public to authenticated users ────────────────────────────────────────────
router.get('/',         validateList,     JobsController.list)
router.get('/:id',                        JobsController.detail)
router.get('/:id/matches',                JobsController.matches)

// ── Client only ───────────────────────────────────────────────────────────────
router.post('/', authorize('client'), validateCreate, JobsController.create)

// ── Artisan only ──────────────────────────────────────────────────────────────
router.patch('/:id/accept',   authorize('artisan'), JobsController.accept)
router.patch('/:id/start',    authorize('artisan'), JobsController.start)
router.patch('/:id/complete', authorize('artisan'), validateComplete, JobsController.complete)

// ── Client or Artisan ────────────────────────────────────────────────────────
router.patch('/:id/cancel', validateCancel, JobsController.cancel)

export default router
