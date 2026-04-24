import { Router } from 'express'
import { authenticate, authorize } from '../../gateway/auth.middleware'
import {
  ReviewsController,
  validateCreate,
  validateList,
} from './reviews.controller'

const router = Router()

router.use(authenticate)

// POST /                          → solo clienti, job deve essere completato
router.post('/', authorize('client'), validateCreate, ReviewsController.create)

// GET /artisan/:artisanId          → lista recensioni di un artigiano (paginata)
router.get('/artisan/:artisanId', validateList, ReviewsController.listByArtisan)

// GET /artisan/:artisanId/stats    → avg, count, distribuzione stelle
router.get('/artisan/:artisanId/stats', ReviewsController.getStats)

// GET /my                          → recensioni lasciate dal cliente autenticato
router.get('/my', authorize('client'), validateList, ReviewsController.listByClient)

export default router
