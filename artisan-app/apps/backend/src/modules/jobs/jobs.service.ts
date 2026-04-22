import { JobModel } from './jobs.model'
import { findNearbyArtisans } from './jobs.matching'
import { AppError } from '../../gateway/errorHandler'
import { io } from '../../shared/socket'

export const JobsService = {
  async createJob(clientId: string, dto: any) {
    const job = await JobModel.create({ clientId, ...dto })

    // Notifica artigiani vicini via WebSocket
    const nearbyArtisans = await findNearbyArtisans(dto.lat, dto.lng, 10, dto.category)
    nearbyArtisans.forEach(artisanId => {
      io.to(`artisan:${artisanId}`).emit('new_job', job)
    })

    return job
  },

  async acceptJob(jobId: string, artisanId: string) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.status !== 'pending') throw new AppError(400, 'Job non disponibile')

    const updated = await JobModel.updateStatus(jobId, 'accepted', artisanId)
    io.to(`job:${jobId}`).emit('job_accepted', updated)
    return updated
  },

  async completeJob(jobId: string, artisanId: string, finalPrice: number) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.artisan_id !== artisanId) throw new AppError(403, 'Non autorizzato')

    const updated = await JobModel.updateStatus(jobId, 'completed')
    io.to(`job:${jobId}`).emit('job_completed', updated)
    return updated
  },
}
