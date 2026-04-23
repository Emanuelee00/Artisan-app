/**
 * Esegui con: npx tsx src/shared/db/seed.ts
 *
 * Funziona sia con DB reali che in modalità mock (mongodb-memory-server).
 * Stampa le credenziali di test a fine esecuzione.
 */

import bcrypt from 'bcryptjs'
import { connectPostgres, query, transaction } from './postgres'
import { connectMongo, disconnectMongo } from './mongo'
import { connectRedis, geoAdd, cacheDel } from './redis'
import { MessageModel } from '../../modules/chat/chat.model'
import mongoose from 'mongoose'

// ── Costanti ──────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10

const CREDENTIALS = [
  { email: 'admin@artisan.dev',     password: 'Admin1234!',    role: 'admin'   },
  { email: 'cliente@artisan.dev',   password: 'Cliente123!',   role: 'client'  },
  { email: 'mario@artisan.dev',     password: 'Mario1234!',    role: 'client'  },
  { email: 'luigi@artisan.dev',     password: 'Luigi1234!',    role: 'artisan' },
  { email: 'sara@artisan.dev',      password: 'Sara12345!',    role: 'artisan' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertUser(data: {
  email: string
  password: string
  name: string
  phone: string
  role: string
}): Promise<string> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [data.email]
  )
  if (existing[0]) return existing[0].id

  const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, phone, role, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`,
    [data.email, hash, data.name, data.phone, data.role]
  )
  return rows[0].id
}

// ── Seed principale ───────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('\n🌱 Artisan App — Seed database\n')

  await connectPostgres()
  await connectMongo()
  await connectRedis()

  // ── Utenti ────────────────────────────────────────────────────────────────
  console.log('👤 Creazione utenti...')

  const adminId  = await upsertUser({ email: 'admin@artisan.dev',   password: 'Admin1234!',  name: 'Admin Artisan',  phone: '+39 000 0000001', role: 'admin'   })
  const clientId = await upsertUser({ email: 'cliente@artisan.dev', password: 'Cliente123!', name: 'Mario Rossi',    phone: '+39 333 1234567', role: 'client'  })
  const client2Id = await upsertUser({ email: 'mario@artisan.dev',  password: 'Mario1234!',  name: 'Mario Verdi',    phone: '+39 333 9876543', role: 'client'  })
  const artisan1Id = await upsertUser({ email: 'luigi@artisan.dev', password: 'Luigi1234!',  name: 'Luigi Bianchi',  phone: '+39 347 1111111', role: 'artisan' })
  const artisan2Id = await upsertUser({ email: 'sara@artisan.dev',  password: 'Sara12345!',  name: 'Sara Conti',     phone: '+39 347 2222222', role: 'artisan' })

  console.log(`   ✓ 5 utenti (admin, 2 clienti, 2 artigiani)`)

  // ── Profili artigiani ─────────────────────────────────────────────────────
  console.log('🔨 Creazione profili artigiani...')

  const profiles = [
    {
      userId: artisan1Id,
      category: 'idraulico',
      bio: 'Idraulico con 10 anni di esperienza su impianti civili e industriali.',
      hourlyRate: 45,
      lat: 41.9028, lng: 12.4964,
      radiusKm: 20,
      stripeAccountId: 'acct_mock_luigi',
    },
    {
      userId: artisan2Id,
      category: 'elettricista',
      bio: 'Elettricista certificata CEI, specializzata in domotica e impianti fotovoltaici.',
      hourlyRate: 55,
      lat: 41.8919, lng: 12.5113,
      radiusKm: 15,
      stripeAccountId: 'acct_mock_sara',
    },
  ]

  for (const p of profiles) {
    const exists = await query('SELECT user_id FROM artisan_profiles WHERE user_id = $1', [p.userId])
    if (!exists[0]) {
      await query(
        `INSERT INTO artisan_profiles
           (user_id, category, bio, hourly_rate, is_verified, rating, review_count,
            lat, lng, radius_km, stripe_account_id, created_at)
         VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,NOW())`,
        [p.userId, p.category, p.bio, p.hourlyRate,
         p.userId === artisan1Id ? 4.8 : 4.6,
         p.userId === artisan1Id ? 34  : 12,
         p.lat, p.lng, p.radiusKm, p.stripeAccountId]
      )
    }
    // Aggiorna Redis geo index
    await cacheDel('artisans:geo')
    await geoAdd('artisans:geo', p.lat, p.lng, p.userId)
  }

  console.log('   ✓ 2 profili artigiani + geo index Redis')

  // ── Jobs ──────────────────────────────────────────────────────────────────
  console.log('📋 Creazione jobs...')

  let job1Id = '', job2Id = '', job3Id = ''

  const existingJobs = await query<{ id: string; title: string }>(
    `SELECT id, title FROM jobs WHERE client_id = $1`, [clientId]
  )

  if (existingJobs.length === 0) {
    await transaction(async (q) => {
      const [j1] = await q<{ id: string }>(
        `INSERT INTO jobs (client_id, artisan_id, title, description, category, address,
                           lat, lng, status, scheduled_at, estimated_price, final_price,
                           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,9000,8500,NOW()-INTERVAL '10 days',NOW())
         RETURNING id`,
        [clientId, artisan1Id,
         'Riparazione perdita sotto lavandino',
         'Perdita dal sifone sotto il lavandino della cucina.',
         'idraulico', 'Via Roma 10, Roma', 41.8999, 12.5000,
         new Date('2025-06-01T10:00:00')]
      )
      job1Id = j1.id

      const [j2] = await q<{ id: string }>(
        `INSERT INTO jobs (client_id, title, description, category, address,
                           lat, lng, status, scheduled_at, estimated_price,
                           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,6000,NOW(),NOW())
         RETURNING id`,
        [client2Id,
         'Installazione nuovo rubinetto',
         'Sostituire il miscelatore del bagno principale.',
         'idraulico', 'Via Nazionale 55, Roma', 41.9010, 12.4950,
         new Date('2025-07-15T09:00:00')]
      )
      job2Id = j2.id

      const [j3] = await q<{ id: string }>(
        `INSERT INTO jobs (client_id, artisan_id, title, description, category, address,
                           lat, lng, status, scheduled_at, estimated_price,
                           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'in_progress',$9,11000,NOW()-INTERVAL '1 day',NOW())
         RETURNING id`,
        [clientId, artisan2Id,
         'Impianto elettrico garage',
         'Installazione quadro elettrico e 4 prese nel garage.',
         'elettricista', 'Via Tiburtina 200, Roma', 41.9200, 12.5400,
         new Date('2025-07-20T08:00:00')]
      )
      job3Id = j3.id
    })
    console.log('   ✓ 3 jobs (completed, pending, in_progress)')
  } else {
    job1Id = existingJobs[0]?.id ?? ''
    job2Id = existingJobs[1]?.id ?? ''
    job3Id = existingJobs[2]?.id ?? ''
    console.log('   ↩ Jobs già presenti — skip')
  }

  // ── Pagamento ─────────────────────────────────────────────────────────────
  console.log('💳 Creazione pagamento...')

  if (job1Id!) {
    const existingPayment = await query(
      'SELECT id FROM payments WHERE job_id = $1', [job1Id]
    )
    if (!existingPayment[0]) {
      const platformFee = Math.round(8500 * 15 / 100)   // 1275 centesimi
      const artisanPayout = 8500 - platformFee           // 7225 centesimi
      await query(
        `INSERT INTO payments
           (job_id, client_id, artisan_id, amount, platform_fee, artisan_payout,
            currency, status, stripe_payment_intent_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'eur','completed',$7,NOW())`,
        [job1Id, clientId, artisan1Id, 8500, platformFee, artisanPayout,
         'pi_mock_seed_001']
      )
      console.log(`   ✓ 1 pagamento completato (€85.00, fee €${(platformFee/100).toFixed(2)})`)
    } else {
      console.log('   ↩ Pagamento già presente — skip')
    }
  }

  // ── Chat messages (MongoDB) ───────────────────────────────────────────────
  console.log('💬 Creazione messaggi chat...')

  const chatId = `chat_${job1Id ?? 'job_001'}`
  const existingMsg = await MessageModel.findOne({ chatId })

  if (!existingMsg) {
    await MessageModel.insertMany([
      {
        chatId,
        senderId: clientId,
        text: 'Buongiorno, ha disponibilità per mercoledì mattina?',
        type: 'text',
        createdAt: new Date('2025-05-29T08:00:00'),
      },
      {
        chatId,
        senderId: artisan1Id,
        text: 'Buongiorno! Sì, sono disponibile dalle 9. Mi conferma l\'indirizzo?',
        type: 'text',
        createdAt: new Date('2025-05-29T08:03:00'),
      },
      {
        chatId,
        senderId: clientId,
        text: 'Via Roma 10, terzo piano, citofono Rossi.',
        type: 'text',
        createdAt: new Date('2025-05-29T08:06:00'),
      },
      {
        chatId,
        senderId: artisan1Id,
        text: 'Perfetto, arrivo alle 9:30. A domani!',
        type: 'text',
        createdAt: new Date('2025-05-29T08:10:00'),
      },
    ])
    console.log('   ✓ 4 messaggi chat')
  } else {
    console.log('   ↩ Messaggi già presenti — skip')
  }

  // ── Riepilogo credenziali ─────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('🔑 CREDENZIALI DI TEST\n')
  for (const c of CREDENTIALS) {
    const label = c.role.padEnd(8)
    console.log(`  [${label}] ${c.email.padEnd(28)} password: ${c.password}`)
  }
  console.log('─'.repeat(60))
  console.log('\n✅ Seed completato.\n')

  await disconnectMongo()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed fallito:', err)
  process.exit(1)
})
