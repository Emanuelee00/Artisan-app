import { api } from './api'
import type { Job } from '@artisan/shared-types'

export interface CreateJobDto {
  title:           string
  description:     string
  category:        string
  address:         string
  lat:             number
  lng:             number
  scheduledAt?:    string
  estimatedPrice?: number
  photoUrl?:       string
}

export const JobsAPI = {
  list: (params?: { status?: string; category?: string; mine?: boolean }): Promise<Job[]> =>
    api.get('/jobs', { params }).then((r) => r.data),

  get: (id: string): Promise<Job> =>
    api.get(`/jobs/${id}`).then((r) => r.data),

  create: (data: CreateJobDto): Promise<Job> =>
    api.post('/jobs', data).then((r) => r.data),

  matches: (id: string) =>
    api.get(`/jobs/${id}/matches`).then((r) => r.data),

  accept: (id: string): Promise<Job> =>
    api.patch(`/jobs/${id}/accept`).then((r) => r.data),

  start: (id: string): Promise<Job> =>
    api.patch(`/jobs/${id}/start`).then((r) => r.data),

  complete: (id: string, finalPrice: number): Promise<Job> =>
    api.patch(`/jobs/${id}/complete`, { finalPrice }).then((r) => r.data),

  cancel: (id: string): Promise<Job> =>
    api.patch(`/jobs/${id}/cancel`).then((r) => r.data),
}
