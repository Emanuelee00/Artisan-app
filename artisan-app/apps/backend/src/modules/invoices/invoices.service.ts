import { InvoiceModel } from './invoices.model'
import { generateInvoicePdf } from './pdf.generator'
import { AppError } from '../../gateway/errorHandler'

export const InvoicesService = {
  async createInvoice(data: any) {
    const count  = await InvoiceModel.countDocuments()
    const number = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const invoice = await InvoiceModel.create({ ...data, number })
    return invoice
  },

  async generateAndSavePdf(invoiceId: string) {
    const invoice = await InvoiceModel.findById(invoiceId)
    if (!invoice) throw new AppError(404, 'Fattura non trovata')

    const pdf = await generateInvoicePdf(invoice.toObject() as any)
    // TODO: upload PDF su S3 e salvare l'URL
    return pdf
  },

  async findByArtisan(artisanId: string) {
    return InvoiceModel.find({ artisanId }).sort({ createdAt: -1 })
  },
}
