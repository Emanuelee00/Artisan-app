import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import type { Invoice } from '@artisan/shared-types'

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(24).text('FATTURA', { align: 'right' })
    doc.fontSize(12).text(`N. ${invoice.number}`, { align: 'right' })
    doc.text(`Data: ${new Date(invoice.createdAt).toLocaleDateString('it-IT')}`, { align: 'right' })
    doc.moveDown(2)

    // Items
    doc.fontSize(14).text('Descrizione servizi', { underline: true })
    doc.moveDown()

    invoice.items.forEach((item) => {
      doc.fontSize(11)
        .text(`${item.description}`, 50, doc.y, { continued: true })
        .text(`${item.quantity} x €${item.unitPrice.toFixed(2)} = €${item.total.toFixed(2)}`, { align: 'right' })
    })

    doc.moveDown()
    doc.fontSize(12).text(`Subtotale: €${invoice.subtotal.toFixed(2)}`, { align: 'right' })
    doc.text(`IVA (${invoice.tax}%): €${(invoice.subtotal * invoice.tax / 100).toFixed(2)}`, { align: 'right' })
    doc.fontSize(14).text(`Totale: €${invoice.total.toFixed(2)}`, { align: 'right' })

    doc.end()
  })
}
