import { ReviewModel, type RatingStats } from './reviews.model'
import { query } from '../../shared/db/postgres'
import { AppError } from '../../gateway/errorHandler'
import type { CreateReviewDto, ListReviewsDto } from './reviews.schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function refreshArtisanRating(artisanId: string): Promise<void> {
  const all = await ReviewModel.find({ artisanId }).lean()
  if (!all.length) return

  const avg   = all.reduce((s, r) => s + r.rating, 0) / all.length
  const count = all.length

  await query(
    'UPDATE artisan_profiles SET rating = $1, review_count = $2 WHERE user_id = $3',
    [Math.round(avg * 10) / 10, count, artisanId]
  )
}

// ── Service ───────────────────────────────────────────────────────────────────

export const ReviewsService = {

  // ── Crea una recensione ───────────────────────────────────────────────────

  async create(clientId: string, dto: CreateReviewDto) {
    const jobs = await query<{
      id: string; artisan_id: string | null; client_id: string; status: string
    }>('SELECT id, artisan_id, client_id, status FROM jobs WHERE id = $1', [dto.jobId])

    const job = jobs[0]
    if (!job)                       throw new AppError(404, 'Job non trovato')
    if (job.client_id !== clientId) throw new AppError(403, 'Solo il cliente del lavoro può lasciare una recensione')
    if (job.status !== 'completed') throw new AppError(409, 'Puoi recensire solo lavori completati')
    if (!job.artisan_id)            throw new AppError(409, 'Il lavoro non ha un artigiano assegnato')

    const existing = await ReviewModel.findOne({ jobId: dto.jobId })
    if (existing) throw new AppError(409, 'Hai già recensito questo lavoro')

    const review = await ReviewModel.create({
      jobId:     dto.jobId,
      clientId,
      artisanId: job.artisan_id,
      rating:    dto.rating,
      comment:   dto.comment ?? null,
    })

    await refreshArtisanRating(job.artisan_id)

    return review
  },

  // ── Lista recensioni di un artigiano (paginata) ───────────────────────────

  async listByArtisan(artisanId: string, dto: ListReviewsDto) {
    const skip = (dto.page - 1) * dto.limit

    const [reviews, total] = await Promise.all([
      ReviewModel
        .find({ artisanId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      ReviewModel.countDocuments({ artisanId }),
    ])

    return {
      reviews,
      total,
      page:  dto.page,
      limit: dto.limit,
      pages: Math.ceil(total / dto.limit),
    }
  },

  // ── Statistiche rating di un artigiano ────────────────────────────────────

  async getStats(artisanId: string): Promise<RatingStats> {
    const all = await ReviewModel.find({ artisanId }).lean()

    const empty: RatingStats = {
      artisanId,
      avg:          0,
      count:        0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }

    if (!all.length) return empty

    const avg  = all.reduce((s, r) => s + r.rating, 0) / all.length
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1|2|3|4|5, number>
    for (const r of all) dist[r.rating as 1|2|3|4|5]++

    return {
      artisanId,
      avg:          Math.round(avg * 10) / 10,
      count:        all.length,
      distribution: dist,
    }
  },

  // ── Recensioni lasciate da un cliente ─────────────────────────────────────

  async listByClient(clientId: string, dto: ListReviewsDto) {
    const skip = (dto.page - 1) * dto.limit

    const [reviews, total] = await Promise.all([
      ReviewModel
        .find({ clientId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      ReviewModel.countDocuments({ clientId }),
    ])

    return { reviews, total, page: dto.page, limit: dto.limit, pages: Math.ceil(total / dto.limit) }
  },
}
