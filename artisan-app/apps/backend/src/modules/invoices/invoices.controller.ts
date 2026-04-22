import { Response, NextFunction } from 'express'
import { InvoicesService } from './invoices.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const InvoicesController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoicesService.createInvoice({ ...req.body, artisanId: req.user!.id })
      res.status(201).json(invoice)
    } catch (e) { next(e) }
  },

  async downloadPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pdf = await InvoicesService.generateAndSavePdf(req.params.id)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=fattura-${req.params.id}.pdf`)
      res.send(pdf)
    } catch (e) { next(e) }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoices = await InvoicesService.findByArtisan(req.user!.id)
      res.json(invoices)
    } catch (e) { next(e) }
  },
}
