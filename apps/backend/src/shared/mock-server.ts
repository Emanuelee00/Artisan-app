/**
 * Mock Debug Server — router montato su /mock in dev/test mode.
 *
 * Endpoint:
 *   GET  /mock/state         → tutto lo stato in memoria
 *   POST /mock/seed          → popola il DB mock con utenti/job/chat di test
 *   POST /mock/reset         → resetta tutto allo stato iniziale + riseed
 *   POST /mock/stripe-event  → simula un webhook Stripe
 *
 * Viene montato automaticamente in app.ts quando NODE_ENV !== 'production'.
 */

import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { query, resetDb } from './db/postgres'
import { resetRedis, geoAdd } from './db/redis'
import { isMock } from '../config/env'
import { stripe } from '../config/stripe.config'
import { fcm } from '../config/firebase.config'
import { PaymentsService } from '../modules/payments/payments.service'
import { MessageModel } from '../modules/chat/chat.model'
import type { StripeMock } from '../mocks/stripe.mock'
import type { FirebaseMock } from '../mocks/firebase.mock'

export const mockRouter = Router()

// ── Seed inline (gira nel processo del server, scrive nella sua memoria) ──────

async function runSeed(): Promise<Record<string, string>> {
  // Round 4 = ~10ms per hash (accettabile per un endpoint di debug)
  const ROUNDS = 4
  const ids: Record<string, string> = {}

  // Utenti
  for (const u of [
    { email: 'admin@test.it',  password: 'password123', name: 'Admin',        phone: '+39 000 0000001', role: 'admin'   },
    { email: 'mario@test.it',  password: 'password123', name: 'Mario Rossi',  phone: '+39 333 1234567', role: 'client'  },
    { email: 'luigi@test.it',  password: 'password123', name: 'Luigi Bianchi',phone: '+39 347 9876543', role: 'artisan' },
  ]) {
    const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [u.email])
    if (existing[0]) {
      ids[u.role === 'admin' ? 'adminId' : u.role === 'client' ? 'marioId' : 'luigiId'] = existing[0].id
      continue
    }
    const hash = await bcrypt.hash(u.password, ROUNDS)
    const [row] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, phone, role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`,
      [u.email, hash, u.name, u.phone, u.role]
    )
    const key = u.role === 'admin' ? 'adminId' : u.role === 'client' ? 'marioId' : 'luigiId'
    ids[key] = row.id
  }

  const { marioId, luigiId } = ids

  // Profilo artigiano (luigi, Milano)
  const profileExists = await query('SELECT user_id FROM artisan_profiles WHERE user_id = $1', [luigiId])
  if (!profileExists[0]) {
    await query(
      `INSERT INTO artisan_profiles
         (user_id, category, bio, hourly_rate, is_verified, rating, review_count,
          lat, lng, radius_km, stripe_account_id, created_at)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,NOW())`,
      [luigiId, 'idraulico', 'Idraulico a Milano con 8 anni di esperienza.',
       40, 4.7, 21, 45.4642, 9.1900, 25, `acct_mock_${luigiId}`]
    )
    await geoAdd('artisans:geo', 45.4642, 9.1900, luigiId)
  }

  // Job 1 — completato
  const existingJobs = await query<{ id: string }>('SELECT id FROM jobs WHERE client_id = $1 ORDER BY created_at', [marioId])
  let job1Id: string, job2Id: string, job3Id: string

  if (existingJobs.length >= 3) {
    job1Id = existingJobs[0].id
    job2Id = existingJobs[1].id
    job3Id = existingJobs[2].id
  } else {
    const [j1] = await query<{ id: string }>(
      `INSERT INTO jobs (client_id, artisan_id, title, description, category, address,
         lat, lng, status, scheduled_at, estimated_price, final_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,8000,7500,NOW()-INTERVAL '5 days',NOW())
       RETURNING id`,
      [marioId, luigiId, 'Riparazione perdita tubo cucina',
       'Perdita d\'acqua sotto il lavandino della cucina.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-15T10:00:00')]
    )
    job1Id = j1.id

    const [j2] = await query<{ id: string }>(
      `INSERT INTO jobs (client_id, artisan_id, title, description, category, address,
         lat, lng, status, scheduled_at, estimated_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'in_progress',$9,5000,NOW(),NOW())
       RETURNING id`,
      [marioId, luigiId, 'Installazione nuovo miscelatore bagno',
       'Sostituzione del miscelatore del bagno principale.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-25T09:00:00')]
    )
    job2Id = j2.id

    const [j3] = await query<{ id: string }>(
      `INSERT INTO jobs (client_id, artisan_id, title, description, category, address,
         lat, lng, status, scheduled_at, estimated_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'accepted',$9,3500,NOW(),NOW())
       RETURNING id`,
      [marioId, luigiId, 'Controllo impianto idraulico',
       'Verifica e manutenzione dell\'impianto idraulico.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-28T14:00:00')]
    )
    job3Id = j3.id
  }

  ids.job1Id = job1Id
  ids.job2Id = job2Id
  ids.job3Id = job3Id

  // Pagamento per job1
  const existingPayment = await query('SELECT id FROM payments WHERE job_id = $1', [job1Id])
  if (!existingPayment[0]) {
    const amount = 7500
    const platformFee = Math.round(amount * 15 / 100)
    const artisanPayout = amount - platformFee
    await query(
      `INSERT INTO payments
         (job_id, client_id, artisan_id, amount, platform_fee, artisan_payout,
          currency, status, stripe_payment_intent_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'eur','completed',$7,NOW())`,
      [job1Id, marioId, luigiId, amount, platformFee, artisanPayout, 'pi_mock_seed_001']
    )
  }

  // 3 messaggi chat nel job1
  const chatId = `chat_${job1Id}`
  const existingMsg = await MessageModel.findOne({ chatId })
  if (!existingMsg) {
    await MessageModel.insertMany([
      { chatId, senderId: marioId, text: 'Ciao Luigi, quando riesce a passare per la perdita?', type: 'text', createdAt: new Date('2026-04-14T08:00:00') },
      { chatId, senderId: luigiId, text: 'Buongiorno! Posso passare domani alle 10, va bene?',  type: 'text', createdAt: new Date('2026-04-14T08:05:00') },
      { chatId, senderId: marioId, text: 'Perfetto, la aspetto. Citofono Rossi.',                type: 'text', createdAt: new Date('2026-04-14T08:07:00') },
    ])
  }

  return ids
}

// ── GET /mock/state ───────────────────────────────────────────────────────────

mockRouter.get('/state', async (_req: Request, res: Response) => {
  const [users, jobs, payments, invoices] = await Promise.all([
    query<{ id: string; email: string; name: string; role: string }>(
      'SELECT id, email, name, role FROM users'
    ),
    query('SELECT id, title, status, client_id, artisan_id, estimated_price, final_price FROM jobs'),
    query('SELECT id, job_id, amount, status, currency FROM payments'),
    query('SELECT id, job_id, status FROM invoices'),
  ])

  const stripeState = isMock('STRIPE_SECRET_KEY')
    ? {
        paymentIntents: (stripe as unknown as StripeMock).getPaymentIntents(),
        accounts:       (stripe as unknown as StripeMock).getAccounts(),
        transfers:      (stripe as unknown as StripeMock).getTransfers(),
      }
    : { note: 'Stripe reale attivo — stato non disponibile' }

  const firebaseState = isMock('FIREBASE_PROJECT_ID')
    ? { lastNotifications: (fcm as unknown as FirebaseMock).getLastNotifications() }
    : { note: 'Firebase reale attivo — stato non disponibile' }

  res.json({
    mode: {
      postgres: isMock('DATABASE_URL')        ? 'mock' : 'real',
      mongo:    isMock('MONGO_URI')           ? 'mock' : 'real',
      redis:    isMock('REDIS_URL')           ? 'mock' : 'real',
      stripe:   isMock('STRIPE_SECRET_KEY')   ? 'mock' : 'real',
      firebase: isMock('FIREBASE_PROJECT_ID') ? 'mock' : 'real',
    },
    postgres:  { users, jobs, payments, invoices },
    stripe:    stripeState,
    firebase:  firebaseState,
  })
})

// ── POST /mock/seed ───────────────────────────────────────────────────────────

mockRouter.post('/seed', async (_req: Request, res: Response) => {
  const ids = await runSeed()
  res.json({
    ok: true,
    message: 'Seed completato.',
    credentials: [
      { role: 'admin',   email: 'admin@test.it', password: 'password123' },
      { role: 'client',  email: 'mario@test.it', password: 'password123' },
      { role: 'artisan', email: 'luigi@test.it', password: 'password123' },
    ],
    ids,
  })
})

// ── POST /mock/reset ──────────────────────────────────────────────────────────

mockRouter.post('/reset', async (_req: Request, res: Response) => {
  resetDb()
  resetRedis()
  if (isMock('FIREBASE_PROJECT_ID')) (fcm as unknown as FirebaseMock).reset()
  if (isMock('STRIPE_SECRET_KEY'))   (stripe as unknown as StripeMock).reset()

  // Re-seed automaticamente dopo il reset
  const ids = await runSeed()

  res.json({
    ok: true,
    message: 'Reset + seed completati.',
    credentials: [
      { role: 'admin',   email: 'admin@test.it', password: 'password123' },
      { role: 'client',  email: 'mario@test.it', password: 'password123' },
      { role: 'artisan', email: 'luigi@test.it', password: 'password123' },
    ],
    ids,
  })
})

// ── POST /mock/stripe-event ───────────────────────────────────────────────────

mockRouter.post('/stripe-event', async (req: Request, res: Response) => {
  const { type, object } = req.body as {
    type:   string
    object: Record<string, unknown>
  }

  if (!type || !object) {
    res.status(400).json({ error: 'Body richiesto: { type, object }' })
    return
  }

  await PaymentsService.handleWebhookEvent(type, object)
  res.json({ ok: true, processed: type })
})
