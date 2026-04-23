import { describe, it, expect, beforeEach } from 'vitest'
import { JobsService } from './jobs.service'
import { computeMatches } from './jobs.matching'
import { resetDb } from '../../shared/db/postgres'
import { resetRedis } from '../../shared/db/redis'
import { PostgresMock } from '../../mocks/postgres.mock'
import { pool } from '../../shared/db/postgres'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'   // from postgres seed
const ARTISAN_ID = 'usr_artisan_001'  // from postgres seed

const baseJob = {
  title:       'Riparazione rubinetto',
  description: 'Il rubinetto perde acqua dal raccordo.',
  category:    'idraulico',
  address:     'Via Roma 1, Roma',
  lat:         41.9028,
  lng:         12.4964,
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb()
  resetRedis()
})

// ── createJob ─────────────────────────────────────────────────────────────────

describe('JobsService.createJob', () => {
  it('crea un job con status pending', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)

    expect(job.status).toBe('pending')
    expect(job.client_id).toBe(CLIENT_ID)
    expect(job.title).toBe(baseJob.title)
    expect(job.artisan_id).toBeNull()
  })

  it('salva lat/lng correttamente', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    expect(Number(job.lat)).toBeCloseTo(41.9028, 2)
    expect(Number(job.lng)).toBeCloseTo(12.4964, 2)
  })
})

// ── getJob ────────────────────────────────────────────────────────────────────

describe('JobsService.getJob', () => {
  it('ritorna il job per id', async () => {
    const created = await JobsService.createJob(CLIENT_ID, baseJob)
    const found   = await JobsService.getJob(created.id)
    expect(found.id).toBe(created.id)
  })

  it('lancia 404 per id inesistente', async () => {
    await expect(JobsService.getJob('ghost_id')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── getJobs (list + filters) ──────────────────────────────────────────────────

describe('JobsService.getJobs', () => {
  beforeEach(async () => {
    await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.createJob(CLIENT_ID, { ...baseJob, category: 'elettricista' })
  })

  it('ritorna tutti i job senza filtri', async () => {
    const jobs = await JobsService.getJobs(CLIENT_ID, 'client', {})
    // seed ha già 2 job + quelli creati nel beforeEach
    expect(jobs.length).toBeGreaterThanOrEqual(2)
  })

  it('filtra per categoria', async () => {
    const jobs = await JobsService.getJobs(CLIENT_ID, 'client', { category: 'elettricista' })
    expect(jobs.every((j) => j.category === 'elettricista')).toBe(true)
  })

  it('filtra per status', async () => {
    const jobs = await JobsService.getJobs(CLIENT_ID, 'client', { status: 'pending' })
    expect(jobs.every((j) => j.status === 'pending')).toBe(true)
  })

  it('mine=true per client filtra solo i suoi job', async () => {
    const jobs = await JobsService.getJobs(CLIENT_ID, 'client', { mine: true })
    expect(jobs.every((j) => j.client_id === CLIENT_ID)).toBe(true)
  })
})

// ── acceptJob ─────────────────────────────────────────────────────────────────

describe('JobsService.acceptJob', () => {
  it('artigiano accetta il job → status accepted', async () => {
    const job     = await JobsService.createJob(CLIENT_ID, baseJob)
    const updated = await JobsService.acceptJob(job.id, ARTISAN_ID)

    expect(updated.status).toBe('accepted')
    expect(updated.artisan_id).toBe(ARTISAN_ID)
  })

  it('lancia 409 se il job non è pending', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)

    await expect(JobsService.acceptJob(job.id, ARTISAN_ID)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lancia 404 per job inesistente', async () => {
    await expect(JobsService.acceptJob('ghost', ARTISAN_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── startJob ──────────────────────────────────────────────────────────────────

describe('JobsService.startJob', () => {
  it('artigiano avvia il job → status in_progress', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    const updated = await JobsService.startJob(job.id, ARTISAN_ID)

    expect(updated.status).toBe('in_progress')
  })

  it('lancia 409 se non è accepted', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await expect(JobsService.startJob(job.id, ARTISAN_ID)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lancia 403 se artigiano sbagliato', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await expect(JobsService.startJob(job.id, 'altro_artigiano')).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ── completeJob ───────────────────────────────────────────────────────────────

describe('JobsService.completeJob', () => {
  it('completa il job con prezzo finale', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await JobsService.startJob(job.id, ARTISAN_ID)
    const updated = await JobsService.completeJob(job.id, ARTISAN_ID, { finalPrice: 85 })

    expect(updated.status).toBe('completed')
    expect(Number(updated.final_price)).toBe(85)
  })

  it('lancia 409 se non è in_progress', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await expect(
      JobsService.completeJob(job.id, ARTISAN_ID, { finalPrice: 85 })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lancia 403 se artigiano sbagliato', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await JobsService.startJob(job.id, ARTISAN_ID)
    await expect(
      JobsService.completeJob(job.id, 'altro_artigiano', { finalPrice: 85 })
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ── cancelJob ─────────────────────────────────────────────────────────────────

describe('JobsService.cancelJob', () => {
  it('cliente cancella il proprio job', async () => {
    const job     = await JobsService.createJob(CLIENT_ID, baseJob)
    const updated = await JobsService.cancelJob(job.id, CLIENT_ID, 'client')
    expect(updated.status).toBe('cancelled')
  })

  it('artigiano cancella il job assegnato', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    const updated = await JobsService.cancelJob(job.id, ARTISAN_ID, 'artisan')
    expect(updated.status).toBe('cancelled')
  })

  it('lancia 403 se un altro utente tenta di cancellare', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await expect(
      JobsService.cancelJob(job.id, 'altro_utente', 'client')
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('lancia 409 se il job è già completato', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await JobsService.startJob(job.id, ARTISAN_ID)
    await JobsService.completeJob(job.id, ARTISAN_ID, { finalPrice: 85 })
    await expect(
      JobsService.cancelJob(job.id, CLIENT_ID, 'client')
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ── computeMatches (matching algorithm) ──────────────────────────────────────

describe('computeMatches', () => {
  it('ritorna artigiani vicini per categoria', async () => {
    // Seed ha già usr_artisan_001 a (41.9028, 12.4964) categoria idraulico
    const matches = await computeMatches(41.9028, 12.4964, 'idraulico', 20)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].category).toBe('idraulico')
  })

  it('ritorna lista vuota per categoria inesistente', async () => {
    const matches = await computeMatches(41.9028, 12.4964, 'astronauta', 20)
    expect(matches).toHaveLength(0)
  })

  it('esclude artigiani oltre il raggio', async () => {
    // Raggio 0.1 km — troppo piccolo per trovare qualcuno
    const matches = await computeMatches(0, 0, 'idraulico', 0.1)
    expect(matches).toHaveLength(0)
  })

  it('i match hanno tutti i campi obbligatori', async () => {
    const matches = await computeMatches(41.9028, 12.4964, 'idraulico', 20)
    if (matches.length === 0) return   // skip se seed non ha artigiani in range
    const m = matches[0]
    expect(m.artisanId).toBeTruthy()
    expect(m.name).toBeTruthy()
    expect(typeof m.rating).toBe('number')
    expect(typeof m.distanceKm).toBe('number')
    expect(typeof m.estimatedArrivalMin).toBe('number')
    expect(typeof m.score).toBe('number')
  })

  it('il primo risultato ha lo score più alto', async () => {
    // Aggiungo un secondo artigiano a distanza maggiore e rating più basso
    const mock = pool as unknown as PostgresMock
    mock.insertRaw('users', {
      id: 'usr_art_far', email: 'far@artisan.dev', name: 'Artigiano Lontano',
      role: 'artisan', phone: '+39 333 0000002',
      password_hash: 'hash', avatar_url: null, fcm_token: null,
      created_at: new Date(), updated_at: new Date(),
    })
    mock.insertRaw('artisan_profiles', {
      user_id: 'usr_art_far', category: 'idraulico', bio: null,
      hourly_rate: 30, is_verified: false, rating: 2.5, review_count: 3,
      lat: 42.5, lng: 13.5,   // ~80 km dal centro Roma
      radius_km: 200, stripe_account_id: null, created_at: new Date(),
    })

    const matches = await computeMatches(41.9028, 12.4964, 'idraulico', 200)
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Il risultato più vicino con rating alto deve precedere quello lontano con rating basso
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score)
  })

  it('ritorna al massimo TOP_N risultati', async () => {
    const mock = pool as unknown as PostgresMock
    // Aggiungo 6 artigiani extra
    for (let i = 1; i <= 6; i++) {
      mock.insertRaw('users', {
        id: `usr_art_extra_${i}`, email: `art${i}@test.dev`, name: `Artigiano ${i}`,
        role: 'artisan', phone: `+39 333 000000${i}`,
        password_hash: 'hash', avatar_url: null, fcm_token: null,
        created_at: new Date(), updated_at: new Date(),
      })
      mock.insertRaw('artisan_profiles', {
        user_id: `usr_art_extra_${i}`, category: 'idraulico', bio: null,
        hourly_rate: 40, is_verified: true, rating: 4.0, review_count: 10,
        lat: 41.9028 + i * 0.01, lng: 12.4964 + i * 0.01,
        radius_km: 50, stripe_account_id: null, created_at: new Date(),
      })
    }

    const matches = await computeMatches(41.9028, 12.4964, 'idraulico', 100)
    expect(matches.length).toBeLessThanOrEqual(5)
  })

  it('getMatches lancia 409 per job non pending', async () => {
    const job = await JobsService.createJob(CLIENT_ID, baseJob)
    await JobsService.acceptJob(job.id, ARTISAN_ID)
    await expect(JobsService.getMatches(job.id)).rejects.toMatchObject({ statusCode: 409 })
  })
})
