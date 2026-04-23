import { Response, NextFunction } from 'express'
import { InvoicesService } from './invoices.service'
import { validate } from '../../gateway/validation.middleware'
import { createInvoiceSchema } from './invoices.schema'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const validateCreateInvoice = validate(createInvoiceSchema)

export const InvoicesController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoicesService.createDraft(req.user!.id, req.body)
      res.status(201).json(invoice)
    } catch (e) { next(e) }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoices = await InvoicesService.findAll(req.user!.id, req.user!.role)
      res.json(invoices)
    } catch (e) { next(e) }
  },

  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoicesService.findById(req.params.id, req.user!.id, req.user!.role)
      res.json(invoice)
    } catch (e) { next(e) }
  },

  async downloadPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const buffer = await InvoicesService.getPdfBuffer(req.params.id, req.user!.id, req.user!.role)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=fattura-${req.params.id}.pdf`)
      res.send(buffer)
    } catch (e) { next(e) }
  },

  async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoicesService.sendInvoice(req.params.id)
      res.json(invoice)
    } catch (e) { next(e) }
  },
}
