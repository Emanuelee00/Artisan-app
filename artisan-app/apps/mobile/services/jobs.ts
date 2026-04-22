import { api } from './api'

export const JobsAPI = {
  create: (data: any) => api.post('/jobs', data).then(r => r.data),
  accept: (id: string) => api.patch(`/jobs/${id}/accept`).then(r => r.data),
  complete: (id: string, finalPrice: number) =>
    api.patch(`/jobs/${id}/complete`, { finalPrice }).then(r => r.data),
}
