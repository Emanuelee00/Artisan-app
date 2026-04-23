import { Response, NextFunction } from 'express'
import { TrackingService } from './tracking.service'
import { AppError } from '../../gateway/errorHandler'
import { query } from '../../shared/db/postgres'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const TrackingController = {
  async getRoute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params
      const route = await TrackingService.getRoute(jobId)
      res.json({ jobId, points: route, count: route.length })
    } catch (e) { next(e) }
  },

  async getPosition(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params

      const rows = await query<{ artisan_id: string | null; client_id: string }>(
        'SELECT artisan_id, client_id FROM jobs WHERE id = $1',
        [jobId]
      )
      if (!rows[0]) throw new AppError(404, 'Job non trovato')

      const { artisan_id, client_id } = rows[0]
      if (!artisan_id) throw new AppError(404, 'Nessun artigiano assegnato a questo job')

      const userId = req.user!.id
      const role   = req.user!.role
      if (role !== 'admin' && client_id !== userId && artisan_id !== userId) {
        throw new AppError(403, 'Non sei un partecipante di questo job')
      }

      const position = await TrackingService.getLastPosition(artisan_id)
      if (!position) throw new AppError(404, 'Posizione artigiano non disponibile')

      res.json({ artisanId: artisan_id, ...position })
    } catch (e) { next(e) }
  },
}
