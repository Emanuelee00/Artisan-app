import PDFDocument from 'pdfkit'
import type { InvoiceDoc } from './invoices.model'

// ── Layout constants ─────────────────────────────────────────────────────────

const COL_LEFT  = 50
const COL_RIGHT = 550
const PAGE_W    = 595
const GRAY      = '#666666'
const DARK      = '#1a1a1a'
const ACCENT    = '#2563eb'

function hrLine(doc: PDFKit.PDFDocument, y?: number): void {
  const lineY = y ?? doc.y
  doc.moveTo(COL_LEFT, lineY).lineTo(COL_RIGHT, lineY).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
  doc.strokeColor(DARK).lineWidth(1)
}

function rightText(doc: PDFKit.PDFDocument, text: string, y: number, opts?: PDFKit.Mixins.TextOptions): void {
  doc.text(text, COL_LEFT, y, { ...opts, width: COL_RIGHT - COL_LEFT, align: 'right' })
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateInvoicePdf(invoice: InvoiceDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data',  (c) => chunks.push(c))
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const date = new Date(invoice.createdAt).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 80).fill(ACCENT)
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
       .text('Artisan App', COL_LEFT, 22)
    doc.fontSize(10).font('Helvetica')
       .text('Marketplace per artigiani', COL_LEFT, 48)

    // Invoice label top-right
    doc.fontSize(18).font('Helvetica-Bold')
       .text('FATTURA', COL_LEFT, 22, { width: COL_RIGHT - COL_LEFT, align: 'right' })
    doc.fontSize(10).font('Helvetica')
       .text(`N. ${invoice.number}`, COL_LEFT, 48, { width: COL_RIGHT - COL_LEFT, align: 'right' })

    doc.fillColor(DARK)
    doc.y = 100

    // ── Invoice meta ─────────────────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text(`Data emissione: ${date}`, COL_LEFT, doc.y)
    doc.fillColor(DARK)
    doc.moveDown(1.5)

    // ── Party columns ────────────────────────────────────────────────────────
    const partyY = doc.y

    // Left: Artigiano
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY)
       .text('FORNITORE', COL_LEFT, partyY)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
       .text(invoice.artisanName, COL_LEFT, partyY + 14)
    doc.fontSize(9).font('Helvetica').fillColor(GRAY)
       .text(invoice.artisanEmail, COL_LEFT, partyY + 28)
    if (invoice.artisanVatId) {
      doc.text(`P.IVA: ${invoice.artisanVatId}`, COL_LEFT, partyY + 40)
    }

    // Right: Cliente
    const midX = PAGE_W / 2 + 20
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY)
       .text('CLIENTE', midX, partyY)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
       .text(invoice.clientName, midX, partyY + 14)
    doc.fontSize(9).font('Helvetica').fillColor(GRAY)
       .text(invoice.clientEmail, midX, partyY + 28)

    doc.fillColor(DARK)
    doc.y = partyY + 70

    hrLine(doc)
    doc.moveDown(1)

    // ── Items table header ────────────────────────────────────────────────────
    const colDesc  = COL_LEFT
    const colQty   = 330
    const colUnit  = 400
    const colTotal = 480

    const tHeaderY = doc.y
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY)
    doc.text('DESCRIZIONE',   colDesc,  tHeaderY)
    doc.text('QTÀ',           colQty,   tHeaderY, { width: 50, align: 'right' })
    doc.text('PREZZO UNIT.',  colUnit,  tHeaderY, { width: 60, align: 'right' })
    doc.text('TOTALE',        colTotal, tHeaderY, { width: 65, align: 'right' })

    doc.y = tHeaderY + 14
    hrLine(doc)
    doc.moveDown(0.5)

    // ── Items rows ────────────────────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
    for (const item of invoice.items) {
      const rowY = doc.y
      doc.text(item.description, colDesc, rowY, { width: 270 })
      doc.text(String(item.quantity),            colQty,   rowY, { width: 50,  align: 'right' })
      doc.text(`€${item.unitPrice.toFixed(2)}`,  colUnit,  rowY, { width: 60,  align: 'right' })
      doc.text(`€${item.total.toFixed(2)}`,      colTotal, rowY, { width: 65,  align: 'right' })
      doc.moveDown(0.3)
    }

    doc.moveDown(0.5)
    hrLine(doc)
    doc.moveDown(1)

    // ── Totals block ──────────────────────────────────────────────────────────
    const totX = 370
    const totW = COL_RIGHT - totX

    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text('Subtotale:', totX, doc.y, { width: totW, align: 'left', continued: true })
    doc.fillColor(DARK)
       .text(`€${invoice.subtotal.toFixed(2)}`, { align: 'right' })

    doc.fillColor(GRAY)
       .text(`IVA (${invoice.taxRate}%):`, totX, doc.y, { width: totW, align: 'left', continued: true })
    doc.fillColor(DARK)
       .text(`€${invoice.taxAmount.toFixed(2)}`, { align: 'right' })

    doc.moveDown(0.3)
    hrLine(doc)
    doc.moveDown(0.3)

    // Total highlighted
    doc.fontSize(13).font('Helvetica-Bold').fillColor(ACCENT)
       .text('TOTALE:', totX, doc.y, { width: totW, align: 'left', continued: true })
    doc.fillColor(ACCENT)
       .text(`€${invoice.total.toFixed(2)}`, { align: 'right' })

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
    const footerY = doc.page.height - 40
    hrLine(doc, footerY - 10)
    doc.text('Generato da Artisan App — artisan.dev', COL_LEFT, footerY, {
      width: COL_RIGHT - COL_LEFT,
      align: 'center',
    })

    doc.end()
  })
}
