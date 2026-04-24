import { Response, NextFunction } from 'express'
import { ReviewsService } from './reviews.service'
import { validate } from '../../gateway/validation.middleware'
import { createReviewSchema, listReviewsSchema } from './reviews.schema'
import type { AuthRequest } from '../../gateway/auth.middleware'
import type { ListReviewsDto } from './reviews.schema'

export const validateCreate = validate(createReviewSchema)
export const validateList   = validate(listReviewsSchema, 'query')

export const ReviewsController = {

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const review = await ReviewsService.create(req.user!.id, req.body)
      res.status(201).json(review)
    } catch (e) { next(e) }
  },

  async listByArtisan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = (req as AuthRequest & { parsedQuery?: ListReviewsDto }).parsedQuery
        ?? { page: 1, limit: 20 }
      const result = await ReviewsService.listByArtisan(req.params.artisanId, parsed)
      res.json(result)
    } catch (e) { next(e) }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await ReviewsService.getStats(req.params.artisanId)
      res.json(stats)
    } catch (e) { next(e) }
  },

  async listByClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = (req as AuthRequest & { parsedQuery?: ListReviewsDto }).parsedQuery
        ?? { page: 1, limit: 20 }
      const result = await ReviewsService.listByClient(req.user!.id, parsed)
      res.json(result)
    } catch (e) { next(e) }
  },
}
