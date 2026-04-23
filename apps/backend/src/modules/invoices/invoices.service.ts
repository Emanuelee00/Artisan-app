import fs from 'fs/promises'
import path from 'path'
import { InvoiceModel, type InvoiceDoc } from './invoices.model'
import { generateInvoicePdf } from './pdf.generator'
import { AppError } from '../../gateway/errorHandler'
import { query } from '../../shared/db/postgres'
import { invoiceQueue } from '../../shared/queue/bullmq'
import { ChatService } from '../chat/chat.service'
import { logger } from '../../shared/logger'
import { isMock, env } from '../../config/env'
import type { CreateInvoiceDto } from './invoices.schema'

// ── Constants ─────────────────────────────────────────────────────────────────

const TAX_RATE    = 22
const MOCK_PDF_DIR = '/tmp/invoices'

// ── Internal helpers ──────────────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await InvoiceModel.countDocuments()
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

interface JobParties {
  clientId:     string; clientName:   string; clientEmail:  string
  artisanId:    string; artisanName:  string; artisanEmail: string
  artisanVatId: string | null
  finalPrice:   number | null
  title:        string
}

async function getJobParties(jobId: string): Promise<JobParties> {
  const rows = await query<{
    client_id: string; artisan_id: string
    final_price: unknown; estimated_price: unknown; title: string
  }>('SELECT client_id, artisan_id, final_price, estimated_price, title FROM jobs WHERE id = $1', [jobId])
  if (!rows[0]) throw new AppError(404, `Job ${jobId} non trovato`)
  const j = rows[0]

  const [clients, artisans] = await Promise.all([
    query<{ id: string; name: string; email: string }>('SELECT id, name, email FROM users WHERE id = $1', [j.client_id]),
    query<{ id: string; name: string; email: string }>('SELECT id, name, email FROM users WHERE id = $1', [j.artisan_id]),
  ])
  if (!clients[0] || !artisans[0]) throw new AppError(404, 'Utenti del job non trovati')

  const fp = j.final_price !== null ? Number(j.final_price) : (j.estimated_price !== null ? Number(j.estimated_price) : null)

  return {
    clientId:     clients[0].id,   clientName:   clients[0].name,   clientEmail:  clients[0].email,
    artisanId:    artisans[0].id,  artisanName:  artisans[0].name,  artisanEmail: artisans[0].email,
    artisanVatId: null,
    finalPrice:   fp,
    title:        j.title,
  }
}

function calcTotals(rawItems: { description: string; quantity: number; unitPrice: number }[]) {
  const items = rawItems.map((i) => ({ ...i, total: Math.round(i.quantity * i.unitPrice * 100) / 100 }))
  const subtotal  = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100
  const taxAmount = Math.round(subtotal * TAX_RATE / 100 * 100) / 100
  return { items, subtotal, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100 }
}

async function savePdfBuffer(invoiceId: string, buffer: Buffer): Promise<{ pdfUrl: string; pdfPath: string }> {
  if (isMock('S3_BUCKET')) {
    await fs.mkdir(MOCK_PDF_DIR, { recursive: true })
    const pdfPath = path.join(MOCK_PDF_DIR, `${invoiceId}.pdf`)
    await fs.writeFile(pdfPath, buffer)
    const pdfUrl = `file://${pdfPath}`
    logger.info(`[PDF MOCK] Salvato ${pdfPath} (${buffer.length} bytes)`)
    return { pdfUrl, pdfPath }
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const s3  = new S3Client({ region: env.S3_REGION })
  const key = `invoices/${invoiceId}.pdf`
  await s3.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET, Key: key, Body: buffer, ContentType: 'application/pdf',
  }))
  return {
    pdfUrl:  `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`,
    pdfPath: key,
  }
}

function logEmailMock(to: string, number: string, total: number): void {
  logger.info(`[EMAIL MOCK] To=${to} Subject="Fattura ${number}"  Totale: €${total.toFixed(2)}`)
}

// ── Service ───────────────────────────────────────────────────────────────────

export const InvoicesService = {
  async createFromJob(jobId: string): Promise<InvoiceDoc> {
    const existing = await InvoiceModel.findOne({ jobId })
    if (existing) return existing

    const parties = await getJobParties(jobId)
    const raw  = [{ description: parties.title, quantity: 1, unitPrice: parties.finalPrice ?? 0 }]
    const { items, subtotal, taxAmount, total } = calcTotals(raw)

    const invoice = await InvoiceModel.create({
      jobId,
      clientId:     parties.clientId,    clientName:   parties.clientName,   clientEmail:  parties.clientEmail,
      artisanId:    parties.artisanId,   artisanName:  parties.artisanName,  artisanEmail: parties.artisanEmail,
      artisanVatId: parties.artisanVatId,
      number: await nextInvoiceNumber(),
      items, subtotal, taxRate: TAX_RATE, taxAmount, total,
    })

    await invoiceQueue.add('generateInvoice', { invoiceId: invoice._id.toString() })
    return invoice
  },

  async createDraft(artisanId: string, dto: CreateInvoiceDto): Promise<InvoiceDoc> {
    const parties = await getJobParties(dto.jobId)
    if (parties.artisanId !== artisanId) throw new AppError(403, 'Non sei l\'artigiano di questo job')

    const raw = dto.items ?? [{ description: parties.title, quantity: 1, unitPrice: parties.finalPrice ?? 0 }]
    const { items, subtotal, taxAmount, total } = calcTotals(raw)

    return InvoiceModel.create({
      jobId:        dto.jobId,
      clientId:     parties.clientId,    clientName:   parties.clientName,   clientEmail:  parties.clientEmail,
      artisanId,                          artisanName:  parties.artisanName,  artisanEmail: parties.artisanEmail,
      artisanVatId: parties.artisanVatId,
      number: await nextInvoiceNumber(),
      items, subtotal, taxRate: TAX_RATE, taxAmount, total,
    })
  },

  async generateAndSavePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await InvoiceModel.findById(invoiceId)
    if (!invoice) throw new AppError(404, 'Fattura non trovata')

    const buffer = await generateInvoicePdf(invoice)
    const { pdfUrl, pdfPath } = await savePdfBuffer(invoiceId, buffer)
    await InvoiceModel.findByIdAndUpdate(invoiceId, { $set: { pdfUrl, pdfPath } })
    return buffer
  },

  async sendInvoice(invoiceId: string): Promise<InvoiceDoc> {
    const invoice = await InvoiceModel.findById(invoiceId)
    if (!invoice) throw new AppError(404, 'Fattura non trovata')
    if (invoice.status === 'paid') throw new AppError(409, 'Fattura già pagata')

    if (!invoice.pdfUrl) await InvoicesService.generateAndSavePdf(invoiceId)

    const chat = await ChatService.getChatByJobId(invoice.jobId)
    if (chat) {
      const chatId = (chat._id as { toString(): string }).toString()
      await ChatService.sendMessage(chatId, invoice.artisanId, 'artisan', {
        text: `📄 Fattura ${invoice.number} — €${invoice.total.toFixed(2)}`,
        type: 'system',
      })
    }

    logEmailMock(invoice.clientEmail, invoice.number, invoice.total)

    return (await InvoiceModel.findByIdAndUpdate(invoiceId, { $set: { status: 'sent' } }, { new: true }))!
  },

  async findAll(userId: string, role: string): Promise<InvoiceDoc[]> {
    if (role === 'admin')   return InvoiceModel.find().sort({ createdAt: -1 })
    if (role === 'artisan') return InvoiceModel.find({ artisanId: userId }).sort({ createdAt: -1 })
    return InvoiceModel.find({ clientId: userId }).sort({ createdAt: -1 })
  },

  async findById(invoiceId: string, userId: string, role: string): Promise<InvoiceDoc> {
    const invoice = await InvoiceModel.findById(invoiceId)
    if (!invoice) throw new AppError(404, 'Fattura non trovata')
    if (role !== 'admin' && invoice.clientId !== userId && invoice.artisanId !== userId) {
      throw new AppError(403, 'Non autorizzato')
    }
    return invoice
  },

  async getPdfBuffer(invoiceId: string, userId: string, role: string): Promise<Buffer> {
    const invoice = await InvoicesService.findById(invoiceId, userId, role)

    if (invoice.pdfPath && isMock('S3_BUCKET')) {
      try { return await fs.readFile(invoice.pdfPath) } catch { /* fallthrough */ }
    }
    return InvoicesService.generateAndSavePdf(invoiceId)
  },
}
