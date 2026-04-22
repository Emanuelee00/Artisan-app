import { Router } from 'express'
import { InvoicesController } from './invoices.controller'
import { authenticate, authorize } from '../../gateway/auth.middleware'

const router = Router()

router.use(authenticate)
router.post('/',              authorize('artisan'), InvoicesController.create)
router.get('/',               authorize('artisan'), InvoicesController.list)
router.get('/:id/pdf',        InvoicesController.downloadPdf)

export default router
