/**
 * Seed del database con dati di test.
 *
 * Esegui con:  npx tsx src/shared/db/seed.ts
 * Con mock env: dotenv -e .env.test -- npx tsx src/shared/db/seed.ts
 *
 * Funziona sia con DB reali che in mock mode (tutto in-memory).
 */

import bcrypt from 'bcryptjs'
import { connectPostgres, query } from './postgres'
import { connectMongo, disconnectMongo } from './mongo'
import { connectRedis, geoAdd } from './redis'
import { MessageModel } from '../../modules/chat/chat.model'

// ── Utenti di test ────────────────────────────────────────────────────────────

const USERS = [
  { email: 'admin@test.it',  password: 'password123', name: 'Admin',       phone: '+39 000 0000001', role: 'admin'   },
  { email: 'mario@test.it',  password: 'password123', name: 'Mario Rossi', phone: '+39 333 1234567', role: 'client'  },
  { email: 'luigi@test.it',  password: 'password123', name: 'Luigi Bianchi', phone: '+39 347 9876543', role: 'artisan' },
]

// Milano — lat/lng artigiano
const LUIGI_LAT = 45.4642
const LUIGI_LNG = 9.1900

// ── Helper upsert ─────────────────────────────────────────────────────────────

async function upsertUser(data: typeof USERS[number]): Promise<string> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [data.email]
  )
  if (existing[0]) return existing[0].id

  const hash = await bcrypt.hash(data.password, 10)
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, phone, role, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`,
    [data.email, hash, data.name, data.phone, data.role]
  )
  return rows[0].id
}

// ── Seed principale ───────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('\n--- Artisan App — Seed ---\n')

  await connectPostgres()
  await connectMongo()
  await connectRedis()

  // ── 1. Utenti ─────────────────────────────────────────────────────────────
  console.log('Creazione utenti...')

  const adminId  = await upsertUser(USERS[0])
  const marioId  = await upsertUser(USERS[1])
  const luigiId  = await upsertUser(USERS[2])

  console.log(`  admin  ${adminId}`)
  console.log(`  mario  ${marioId}`)
  console.log(`  luigi  ${luigiId}`)

  // ── 2. Profilo artigiano (luigi) ──────────────────────────────────────────
  console.log('Creazione profilo artigiano...')

  const profileExists = await query('SELECT user_id FROM artisan_profiles WHERE user_id = $1', [luigiId])
  if (!profileExists[0]) {
    await query(
      `INSERT INTO artisan_profiles
         (user_id, category, bio, hourly_rate, is_verified, rating, review_count,
          lat, lng, radius_km, stripe_account_id, created_at)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,NOW())`,
      [luigiId, 'idraulico', 'Idraulico a Milano con 8 anni di esperienza.',
       40, 4.7, 21,
       LUIGI_LAT, LUIGI_LNG, 25, `acct_mock_${luigiId}`]
    )
    await geoAdd('artisans:geo', LUIGI_LAT, LUIGI_LNG, luigiId)
    console.log('  profilo creato, geo index aggiornato')
  } else {
    console.log('  profilo gia presente — skip')
  }

  // ── 3. Job ────────────────────────────────────────────────────────────────
  console.log('Creazione jobs...')

  let job1Id = '', job2Id = '', job3Id = ''

  const existing = await query<{ id: string; title: string }>(
    'SELECT id, title FROM jobs WHERE client_id = $1 ORDER BY created_at',
    [marioId]
  )

  if (existing.length >= 3) {
    job1Id = existing[0].id
    job2Id = existing[1].id
    job3Id = existing[2].id
    console.log(`  gia presenti — job1=${job1Id} job2=${job2Id} job3=${job3Id}`)
  } else {
    // Job 1 — completato (per avere il pagamento)
    const [j1] = await query<{ id: string }>(
      `INSERT INTO jobs
         (client_id, artisan_id, title, description, category, address,
          lat, lng, status, scheduled_at, estimated_price, final_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,8000,7500,NOW()-INTERVAL '5 days',NOW())
       RETURNING id`,
      [marioId, luigiId,
       'Riparazione perdita tubo cucina',
       'Perdita d\'acqua sotto il lavandino della cucina.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-15T10:00:00')]
    )
    job1Id = j1.id
    console.log(`  job1 completed  id=${job1Id}`)

    // Job 2 — aperto: in lavorazione
    const [j2] = await query<{ id: string }>(
      `INSERT INTO jobs
         (client_id, artisan_id, title, description, category, address,
          lat, lng, status, scheduled_at, estimated_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'in_progress',$9,5000,NOW(),NOW())
       RETURNING id`,
      [marioId, luigiId,
       'Installazione nuovo miscelatore bagno',
       'Sostituzione del miscelatore del bagno principale.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-25T09:00:00')]
    )
    job2Id = j2.id
    console.log(`  job2 in_progress  id=${job2Id}`)

    // Job 3 — aperto: in attesa
    const [j3] = await query<{ id: string }>(
      `INSERT INTO jobs
         (client_id, artisan_id, title, description, category, address,
          lat, lng, status, scheduled_at, estimated_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'accepted',$9,3500,NOW(),NOW())
       RETURNING id`,
      [marioId, luigiId,
       'Controllo impianto idraulico',
       'Verifica e manutenzione dell\'impianto idraulico dell\'appartamento.',
       'idraulico', 'Via Torino 10, Milano', 45.4600, 9.1890,
       new Date('2026-04-28T14:00:00')]
    )
    job3Id = j3.id
    console.log(`  job3 accepted  id=${job3Id}`)
  }

  // ── 4. Pagamento completato (per job1) ────────────────────────────────────
  console.log('Creazione pagamento...')

  const existingPayment = await query('SELECT id FROM payments WHERE job_id = $1', [job1Id])
  if (!existingPayment[0] && job1Id) {
    const amount       = 7500
    const platformFee  = Math.round(amount * 15 / 100)  // 1125 centesimi
    const artisanPayout = amount - platformFee            // 6375 centesimi

    await query(
      `INSERT INTO payments
         (job_id, client_id, artisan_id, amount, platform_fee, artisan_payout,
          currency, status, stripe_payment_intent_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'eur','completed',$7,NOW())`,
      [job1Id, marioId, luigiId, amount, platformFee, artisanPayout, 'pi_mock_seed_001']
    )
    console.log(`  pagamento completato EUR ${(amount / 100).toFixed(2)}, fee EUR ${(platformFee / 100).toFixed(2)}`)
  } else {
    console.log('  pagamento gia presente — skip')
  }

  // ── 5. Chat (3 messaggi nel job 1) ────────────────────────────────────────
  console.log('Creazione messaggi chat...')

  const chatId = `chat_${job1Id}`
  const existingMsg = await MessageModel.findOne({ chatId })

  if (!existingMsg && job1Id) {
    await MessageModel.insertMany([
      {
        chatId,
        senderId: marioId,
        text: 'Ciao Luigi, quando riesce a passare per la perdita?',
        type: 'text',
        createdAt: new Date('2026-04-14T08:00:00'),
      },
      {
        chatId,
        senderId: luigiId,
        text: 'Buongiorno! Posso passare domani mattina alle 10, va bene?',
        type: 'text',
        createdAt: new Date('2026-04-14T08:05:00'),
      },
      {
        chatId,
        senderId: marioId,
        text: 'Perfetto, la aspetto. Citofono Rossi.',
        type: 'text',
        createdAt: new Date('2026-04-14T08:07:00'),
      },
    ])
    console.log('  3 messaggi creati')
  } else {
    console.log('  messaggi gia presenti — skip')
  }

  // ── Riepilogo ─────────────────────────────────────────────────────────────
  const line = '─'.repeat(58)
  console.log(`\n${line}`)
  console.log('Seed completato. Credenziali di test:\n')
  console.log(`  [admin  ] admin@test.it   password: password123`)
  console.log(`  [client ] mario@test.it   password: password123`)
  console.log(`  [artisan] luigi@test.it   password: password123`)
  console.log(`\n  Job 1 (completed + pagamento): ${job1Id}`)
  console.log(`  Job 2 (in_progress, aperto):   ${job2Id}`)
  console.log(`  Job 3 (accepted, aperto):      ${job3Id}`)
  console.log(`  Chat job1: chat_${job1Id}`)
  console.log(line + '\n')

  await disconnectMongo()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed fallito:', err)
  process.exit(1)
})
