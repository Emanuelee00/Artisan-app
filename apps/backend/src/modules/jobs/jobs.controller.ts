import { Response, NextFunction } from 'express'
import { JobsService } from './jobs.service'
import { validate } from '../../gateway/validation.middleware'
import {
  createJobSchema,
  listJobsSchema,
  completeJobSchema,
  cancelJobSchema,
} from './jobs.schema'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const validateCreate   = validate(createJobSchema)
export const validateList     = validate(listJobsSchema,   'query')
export const validateComplete = validate(completeJobSchema)
export const validateCancel   = validate(cancelJobSchema)

export const JobsController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.createJob(req.user!.id, req.body)
      res.status(201).json(job)
    } catch (e) { next(e) }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = (req as AuthRequest & { parsedQuery?: unknown }).parsedQuery ?? req.query
      const jobs = await JobsService.getJobs(req.user!.id, req.user!.role, parsed as Record<string, unknown>)
      res.json(jobs)
    } catch (e) { next(e) }
  },

  async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.getJob(req.params.id)
      res.json(job)
    } catch (e) { next(e) }
  },

  async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.acceptJob(req.params.id, req.user!.id)
      res.json(job)
    } catch (e) { next(e) }
  },

  async start(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.startJob(req.params.id, req.user!.id)
      res.json(job)
    } catch (e) { next(e) }
  },

  async complete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.completeJob(req.params.id, req.user!.id, req.body)
      res.json(job)
    } catch (e) { next(e) }
  },

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.cancelJob(req.params.id, req.user!.id, req.user!.role, req.body)
      res.json(job)
    } catch (e) { next(e) }
  },

  async matches(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const results = await JobsService.getMatches(req.params.id)
      res.json(results)
    } catch (e) { next(e) }
  },
}
