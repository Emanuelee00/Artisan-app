import { Router } from 'express'
import { authenticate, authorize } from '../../gateway/auth.middleware'
import {
  InvoicesController,
  validateCreateInvoice,
} from './invoices.controller'

const router = Router()

router.use(authenticate)

router.post('/',              authorize('artisan'), validateCreateInvoice, InvoicesController.create)
router.get('/',               InvoicesController.list)
router.get('/:id',            InvoicesController.getOne)
router.get('/:id/pdf',        InvoicesController.downloadPdf)
router.post('/:id/send',      authorize('artisan'), InvoicesController.send)

export default router
