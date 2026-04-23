import { JobModel } from './jobs.model'
import { computeMatches } from './jobs.matching'
import { AppError } from '../../gateway/errorHandler'
import { io } from '../../shared/socket'
import { PaymentsService } from '../payments/payments.service'
import { InvoicesService } from '../invoices/invoices.service'
import type { CreateJobDto, ListJobsQuery, CompleteJobDto, CancelJobDto } from './jobs.schema'

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeEmit(room: string, event: string, payload: unknown): void {
  // io may be undefined in test environment
  io?.to(room)?.emit(event, payload)
}

// ── Service ──────────────────────────────────────────────────────────────────

export const JobsService = {
  async createJob(clientId: string, dto: CreateJobDto) {
    const job = await JobModel.create({ clientId, ...dto })

    // Notify nearby artisans via WebSocket
    const matches = await computeMatches(dto.lat, dto.lng, dto.category, 20)
    for (const m of matches) {
      safeEmit(`artisan:${m.artisanId}`, 'new_job', { job, match: m })
    }

    return job
  },

  async getJobs(userId: string, role: string, queryParams: ListJobsQuery) {
    const filters: {
      clientId?: string; artisanId?: string; status?: string; category?: string
    } = {}

    if (queryParams.status)   filters.status   = queryParams.status
    if (queryParams.category) filters.category = queryParams.category

    if (queryParams.mine) {
      if (role === 'client')  filters.clientId  = userId
      if (role === 'artisan') filters.artisanId = userId
    }

    return JobModel.findAll(filters)
  },

  async getJob(id: string) {
    const job = await JobModel.findById(id)
    if (!job) throw new AppError(404, 'Job non trovato')
    return job
  },

  async acceptJob(jobId: string, artisanId: string) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.status !== 'pending') throw new AppError(409, `Job non accettabile: stato attuale '${job.status}'`)

    const updated = await JobModel.updateStatus(jobId, 'accepted', { artisanId })
    safeEmit(`job:${jobId}`, 'job_accepted', updated)
    safeEmit(`client:${job.client_id}`, 'job_accepted', updated)
    return updated!
  },

  async startJob(jobId: string, artisanId: string) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.status !== 'accepted') throw new AppError(409, `Job non avviabile: stato attuale '${job.status}'`)
    if (job.artisan_id !== artisanId) throw new AppError(403, 'Non sei l\'artigiano assegnato a questo job')

    const updated = await JobModel.updateStatus(jobId, 'in_progress')
    safeEmit(`job:${jobId}`, 'job_started', updated)
    return updated!
  },

  async completeJob(jobId: string, artisanId: string, dto: CompleteJobDto) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.artisan_id !== artisanId) throw new AppError(403, 'Non sei l\'artigiano assegnato a questo job')
    if (job.status !== 'in_progress') throw new AppError(409, `Job non completabile: stato attuale '${job.status}'`)

    const updated = await JobModel.updateStatus(jobId, 'completed', { finalPrice: dto.finalPrice })
    safeEmit(`job:${jobId}`, 'job_completed', updated)
    safeEmit(`client:${job.client_id}`, 'job_completed', updated)

    // Create payment intent and notify client
    const intent = await PaymentsService.createIntent(job.client_id, { jobId })
    safeEmit(`client:${job.client_id}`, 'payment_required', {
      jobId,
      clientSecret: intent.clientSecret,
      paymentId:    intent.paymentId,
      amount:       intent.amount,
    })

    // Auto-generate invoice in background
    InvoicesService.createFromJob(jobId).catch((err) =>
      console.error(`Invoice creation failed for job ${jobId}:`, err)
    )

    return updated!
  },

  async cancelJob(jobId: string, userId: string, role: string, _dto?: CancelJobDto) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')

    const cancellableStatuses = ['pending', 'accepted', 'in_progress']
    if (!cancellableStatuses.includes(job.status)) {
      throw new AppError(409, `Job non cancellabile: stato attuale '${job.status}'`)
    }

    const isClient  = role === 'client'  && job.client_id  === userId
    const isArtisan = role === 'artisan' && job.artisan_id === userId
    const isAdmin   = role === 'admin'
    if (!isClient && !isArtisan && !isAdmin) {
      throw new AppError(403, 'Non autorizzato a cancellare questo job')
    }

    const updated = await JobModel.updateStatus(jobId, 'cancelled')
    safeEmit(`job:${jobId}`, 'job_cancelled', updated)
    if (job.artisan_id) safeEmit(`artisan:${job.artisan_id}`, 'job_cancelled', updated)
    safeEmit(`client:${job.client_id}`, 'job_cancelled', updated)
    return updated!
  },

  async getMatches(jobId: string) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.status !== 'pending') throw new AppError(409, 'Solo i job in pending possono cercare match')

    return computeMatches(Number(job.lat), Number(job.lng), job.category, 20)
  },
}
