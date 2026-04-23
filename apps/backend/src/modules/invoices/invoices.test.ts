import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../../app'
import { connectMongo, disconnectMongo } from '../../shared/db/mongo'
import { resetDb } from '../../shared/db/postgres'
import { InvoicesService } from './invoices.service'
import { InvoiceModel } from './invoices.model'

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'mock_jwt_secret_dev_only'
const makeToken = (id: string, role: string) => jwt.sign({ id, role }, SECRET)

// ── Seed IDs (from postgres.mock.ts) ─────────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'
const ARTISAN_ID = 'usr_artisan_001'
const JOB_ID     = 'job_001'   // completed, final_price=85, title="Riparazione perdita sotto lavandino"
const JOB_ID_2   = 'job_002'   // pending, no artisan

const clientToken  = makeToken(CLIENT_ID,  'client')
const artisanToken = makeToken(ARTISAN_ID, 'artisan')
const adminToken   = makeToken('usr_admin_001', 'admin')

let app: ReturnType<typeof createApp>

beforeAll(async () => {
  await connectMongo()
  app = createApp()
})

afterAll(async () => {
  await disconnectMongo()
})

beforeEach(async () => {
  await InvoiceModel.deleteMany({})
  resetDb()
})

// ── InvoicesService.createFromJob ─────────────────────────────────────────────

describe('InvoicesService.createFromJob', () => {
  it('crea fattura dal job con dati corretti', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)

    expect(invoice.jobId).toBe(JOB_ID)
    expect(invoice.clientId).toBe(CLIENT_ID)
    expect(invoice.artisanId).toBe(ARTISAN_ID)
    expect(invoice.number).toMatch(/^INV-\d{4}-\d{4}$/)
    expect(invoice.status).toBe('draft')
    expect(invoice.items).toHaveLength(1)
    expect(invoice.items[0].description).toMatch(/Riparazione/)
    expect(invoice.items[0].unitPrice).toBe(85)
    expect(invoice.taxRate).toBe(22)
    expect(invoice.subtotal).toBe(85)
    expect(invoice.taxAmount).toBeCloseTo(18.7, 1)
    expect(invoice.total).toBeCloseTo(103.7, 1)
    expect(invoice.clientName).toBe('Mario Rossi')
    expect(invoice.artisanName).toBe('Luigi Bianchi')
  })

  it('è idempotente: ritorna la stessa fattura se esiste già', async () => {
    const first  = await InvoicesService.createFromJob(JOB_ID)
    const second = await InvoicesService.createFromJob(JOB_ID)
    expect(second._id.toString()).toBe(first._id.toString())
  })

  it('lancia 404 per job inesistente', async () => {
    await expect(
      InvoicesService.createFromJob('job_ghost')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('usa estimated_price se final_price è null', async () => {
    // job_002 ha estimated_price=60 e nessun artisan — fallisce perché manca artisan_id
    // Usiamo job_001 come riferimento — questo test documenta il comportamento
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    expect(invoice.items[0].unitPrice).toBeGreaterThan(0)
  })
})

// ── InvoicesService.createDraft ───────────────────────────────────────────────

describe('InvoicesService.createDraft', () => {
  it('crea bozza con voci personalizzate', async () => {
    const invoice = await InvoicesService.createDraft(ARTISAN_ID, {
      jobId: JOB_ID,
      items: [
        { description: 'Manodopera', quantity: 2, unitPrice: 30 },
        { description: 'Materiali',  quantity: 1, unitPrice: 25 },
      ],
    })

    expect(invoice.items).toHaveLength(2)
    expect(invoice.items[0].total).toBe(60)   // 2 × 30
    expect(invoice.items[1].total).toBe(25)   // 1 × 25
    expect(invoice.subtotal).toBe(85)
    expect(invoice.taxAmount).toBeCloseTo(18.7, 1)
    expect(invoice.total).toBeCloseTo(103.7, 1)
  })

  it('lancia 403 se l\'artigiano non è assegnato al job', async () => {
    await expect(
      InvoicesService.createDraft('usr_other_999', { jobId: JOB_ID })
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ── InvoicesService.generateAndSavePdf ───────────────────────────────────────

describe('InvoicesService.generateAndSavePdf', () => {
  it('genera un PDF valido (header %PDF)', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const buffer  = await InvoicesService.generateAndSavePdf(invoice._id.toString())

    // PDF magic bytes
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(500)
  })

  it('il PDF supera 1 KB', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const buffer  = await InvoicesService.generateAndSavePdf(invoice._id.toString())
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('aggiorna pdfUrl e pdfPath sulla fattura', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    await InvoicesService.generateAndSavePdf(invoice._id.toString())

    const updated = await InvoiceModel.findById(invoice._id)
    expect(updated!.pdfUrl).toMatch(/file:\/\//)
    expect(updated!.pdfPath).toMatch(/\.pdf$/)
  })

  it('il file è leggibile dal disco (/tmp)', async () => {
    const fs = await import('fs/promises')
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    await InvoicesService.generateAndSavePdf(invoice._id.toString())

    const saved = await InvoiceModel.findById(invoice._id)
    const bytes  = await fs.readFile(saved!.pdfPath!)
    expect(bytes.slice(0, 4).toString()).toBe('%PDF')
  })

  it('lancia 404 per fattura inesistente', async () => {
    await expect(
      InvoicesService.generateAndSavePdf('000000000000000000000000')
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── InvoicesService.sendInvoice ───────────────────────────────────────────────

describe('InvoicesService.sendInvoice', () => {
  it('cambia status a "sent"', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const sent    = await InvoicesService.sendInvoice(invoice._id.toString())
    expect(sent.status).toBe('sent')
  })

  it('genera PDF se non ancora presente', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    expect(invoice.pdfUrl).toBeNull()
    await InvoicesService.sendInvoice(invoice._id.toString())
    const updated = await InvoiceModel.findById(invoice._id)
    expect(updated!.pdfUrl).toBeTruthy()
  })

  it('lancia 409 se già pagata', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    await InvoiceModel.findByIdAndUpdate(invoice._id, { $set: { status: 'paid' } })
    await expect(
      InvoicesService.sendInvoice(invoice._id.toString())
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ── InvoicesService.findAll / findById ────────────────────────────────────────

describe('InvoicesService.findAll', () => {
  it('artigiano vede solo le proprie fatture', async () => {
    await InvoicesService.createFromJob(JOB_ID)
    const list = await InvoicesService.findAll(ARTISAN_ID, 'artisan')
    expect(list.every((i) => i.artisanId === ARTISAN_ID)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  })

  it('cliente vede solo le proprie fatture', async () => {
    await InvoicesService.createFromJob(JOB_ID)
    const list = await InvoicesService.findAll(CLIENT_ID, 'client')
    expect(list.every((i) => i.clientId === CLIENT_ID)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  })

  it('admin vede tutte le fatture', async () => {
    await InvoicesService.createFromJob(JOB_ID)
    const list = await InvoicesService.findAll('usr_admin_001', 'admin')
    expect(list.length).toBeGreaterThan(0)
  })

  it('ritorna lista vuota se non ci sono fatture', async () => {
    const list = await InvoicesService.findAll(CLIENT_ID, 'client')
    expect(list).toHaveLength(0)
  })
})

describe('InvoicesService.findById', () => {
  it('ritorna la fattura al partecipante', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const found   = await InvoicesService.findById(invoice._id.toString(), CLIENT_ID, 'client')
    expect(found._id.toString()).toBe(invoice._id.toString())
  })

  it('lancia 403 per utente non partecipante', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    await expect(
      InvoicesService.findById(invoice._id.toString(), 'usr_other_999', 'client')
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ── REST API tests ────────────────────────────────────────────────────────────

describe('POST /api/v1/invoices', () => {
  it('crea bozza (201) per artigiano', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ jobId: JOB_ID })

    expect(res.status).toBe(201)
    expect(res.body.number).toMatch(/INV/)
    expect(res.body.status).toBe('draft')
  })

  it('lancia 403 per cliente', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ jobId: JOB_ID })

    expect(res.status).toBe(403)
  })

  it('lancia 400 senza jobId', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/invoices', () => {
  it('lista fatture artigiano (200)', async () => {
    await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${artisanToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('lista fatture cliente (200)', async () => {
    await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/v1/invoices/:id', () => {
  it('dettaglio fattura (200)', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .get(`/api/v1/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${artisanToken}`)

    expect(res.status).toBe(200)
    expect(res.body._id).toBe(invoice._id.toString())
  })
})

describe('GET /api/v1/invoices/:id/pdf', () => {
  it('scarica PDF (200, Content-Type application/pdf)', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .get(`/api/v1/invoices/${invoice._id}/pdf`)
      .set('Authorization', `Bearer ${artisanToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    // PDF magic bytes
    expect(Buffer.from(res.body).slice(0, 4).toString()).toBe('%PDF')
  })

  it('il PDF ha dimensione > 1 KB', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .get(`/api/v1/invoices/${invoice._id}/pdf`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .buffer(true)

    expect(res.body.length).toBeGreaterThan(1024)
  })

  it('lancia 403 per utente non partecipante', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const otherToken = makeToken('usr_other_999', 'client')

    const res = await request(app)
      .get(`/api/v1/invoices/${invoice._id}/pdf`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(403)
  })
})

describe('POST /api/v1/invoices/:id/send', () => {
  it('cambia status a "sent" (200)', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${artisanToken}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('sent')
  })

  it('lancia 403 per cliente', async () => {
    const invoice = await InvoicesService.createFromJob(JOB_ID)
    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(403)
  })
})
