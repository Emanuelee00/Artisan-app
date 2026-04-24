import { describe, it, expect, beforeEach } from 'vitest'
import { ReviewsService } from './reviews.service'
import { ReviewModel } from './reviews.model'
import { resetDb } from '../../shared/db/postgres'
import { resetRedis } from '../../shared/db/redis'
import { connectMongo } from '../../shared/db/mongo'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'   // from postgres.mock.ts seed
const ARTISAN_ID = 'usr_artisan_001'  // from postgres.mock.ts seed
const JOB_COMPLETED = 'job_001'       // status: 'completed', client_id: CLIENT_ID, artisan_id: ARTISAN_ID
const JOB_PENDING   = 'job_002'       // status: 'pending'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  resetDb()
  resetRedis()
  await connectMongo()
  await ReviewModel.deleteMany({})
})

// ── ReviewsService.create ─────────────────────────────────────────────────────

describe('ReviewsService.create', () => {

  it('crea una recensione per un job completato', async () => {
    const review = await ReviewsService.create(CLIENT_ID, {
      jobId:   JOB_COMPLETED,
      rating:  5,
      comment: 'Lavoro eccellente, puntuale e preciso!',
    })

    expect(review.jobId).toBe(JOB_COMPLETED)
    expect(review.clientId).toBe(CLIENT_ID)
    expect(review.artisanId).toBe(ARTISAN_ID)
    expect(review.rating).toBe(5)
    expect(review.comment).toBe('Lavoro eccellente, puntuale e preciso!')
  })

  it('crea una recensione senza commento', async () => {
    const review = await ReviewsService.create(CLIENT_ID, {
      jobId:  JOB_COMPLETED,
      rating: 4,
    })

    expect(review.rating).toBe(4)
    expect(review.comment).toBeNull()
  })

  it('lancia 404 se il job non esiste', async () => {
    await expect(
      ReviewsService.create(CLIENT_ID, { jobId: 'ghost_job', rating: 5 })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lancia 409 se il job non è completato', async () => {
    await expect(
      ReviewsService.create(CLIENT_ID, { jobId: JOB_PENDING, rating: 3 })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lancia 403 se il cliente non è quello del job', async () => {
    await expect(
      ReviewsService.create('altro_cliente', { jobId: JOB_COMPLETED, rating: 5 })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('lancia 409 per duplicato (stesso job)', async () => {
    await ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 5 })

    await expect(
      ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 3 })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('aggiorna il rating medio dell\'artigiano in postgres', async () => {
    await ReviewsService.create(CLIENT_ID, {
      jobId:  JOB_COMPLETED,
      rating: 4,
    })

    const { query } = await import('../../shared/db/postgres')
    const rows = await query<{ rating: number; review_count: number }>(
      'SELECT rating, review_count FROM artisan_profiles WHERE user_id = $1',
      [ARTISAN_ID]
    )
    expect(Number(rows[0].rating)).toBe(4)
    expect(Number(rows[0].review_count)).toBe(1)
  })
})

// ── ReviewsService.listByArtisan ──────────────────────────────────────────────

describe('ReviewsService.listByArtisan', () => {

  it('ritorna lista vuota se nessuna recensione', async () => {
    const result = await ReviewsService.listByArtisan(ARTISAN_ID, { page: 1, limit: 20 })
    expect(result.reviews).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('ritorna le recensioni dell\'artigiano', async () => {
    await ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 5, comment: 'Ottimo lavoro!' })

    const result = await ReviewsService.listByArtisan(ARTISAN_ID, { page: 1, limit: 20 })
    expect(result.reviews).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.pages).toBe(1)
    expect(result.reviews[0].rating).toBe(5)
  })

  it('rispetta la paginazione', async () => {
    await ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 5 })

    const page1 = await ReviewsService.listByArtisan(ARTISAN_ID, { page: 1, limit: 1 })
    const page2 = await ReviewsService.listByArtisan(ARTISAN_ID, { page: 2, limit: 1 })

    expect(page1.reviews).toHaveLength(1)
    expect(page2.reviews).toHaveLength(0)
    expect(page1.pages).toBe(1)
  })
})

// ── ReviewsService.getStats ───────────────────────────────────────────────────

describe('ReviewsService.getStats', () => {

  it('ritorna zeri se nessuna recensione', async () => {
    const stats = await ReviewsService.getStats(ARTISAN_ID)
    expect(stats.avg).toBe(0)
    expect(stats.count).toBe(0)
    expect(stats.distribution[5]).toBe(0)
  })

  it('calcola media e distribuzione corrette', async () => {
    await ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 4 })

    // Aggiungo manualmente una seconda review per un secondo job fittizio
    await ReviewModel.create({
      jobId: 'job_extra', clientId: CLIENT_ID, artisanId: ARTISAN_ID, rating: 2, comment: null,
    })

    const stats = await ReviewsService.getStats(ARTISAN_ID)
    expect(stats.count).toBe(2)
    expect(stats.avg).toBe(3)          // (4+2)/2
    expect(stats.distribution[4]).toBe(1)
    expect(stats.distribution[2]).toBe(1)
    expect(stats.distribution[5]).toBe(0)
  })
})

// ── ReviewsService.listByClient ───────────────────────────────────────────────

describe('ReviewsService.listByClient', () => {

  it('ritorna le recensioni lasciate dal cliente', async () => {
    await ReviewsService.create(CLIENT_ID, { jobId: JOB_COMPLETED, rating: 5 })

    const result = await ReviewsService.listByClient(CLIENT_ID, { page: 1, limit: 20 })
    expect(result.reviews).toHaveLength(1)
    expect(result.reviews[0].clientId).toBe(CLIENT_ID)
  })

  it('non ritorna recensioni di altri clienti', async () => {
    await ReviewModel.create({
      jobId: 'job_other', clientId: 'altro_id', artisanId: ARTISAN_ID, rating: 3, comment: null,
    })

    const result = await ReviewsService.listByClient(CLIENT_ID, { page: 1, limit: 20 })
    expect(result.reviews).toHaveLength(0)
  })
})
