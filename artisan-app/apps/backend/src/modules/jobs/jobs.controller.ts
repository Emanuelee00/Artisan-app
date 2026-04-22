import { Response, NextFunction } from 'express'
import { JobsService } from './jobs.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const JobsController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.createJob(req.user!.id, req.body)
      res.status(201).json(job)
    } catch (e) { next(e) }
  },

  async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.acceptJob(req.params.id, req.user!.id)
      res.json(job)
    } catch (e) { next(e) }
  },

  async complete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.completeJob(req.params.id, req.user!.id, req.body.finalPrice)
      res.json(job)
    } catch (e) { next(e) }
  },
}
