import { z } from 'zod'

export const createReviewSchema = z.object({
  jobId:   z.string().min(1, 'jobId obbligatorio'),
  rating:  z.number().int().min(1, 'Minimo 1 stella').max(5, 'Massimo 5 stelle'),
  comment: z.string().min(10, 'Commento minimo 10 caratteri').max(500).optional(),
})

export const listReviewsSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateReviewDto = z.infer<typeof createReviewSchema>
export type ListReviewsDto  = z.infer<typeof listReviewsSchema>
