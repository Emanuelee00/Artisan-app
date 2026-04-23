import { z } from 'zod'

export const createJobSchema = z.object({
  title:          z.string().min(5, 'Minimo 5 caratteri').max(255),
  description:    z.string().min(10, 'Minimo 10 caratteri').max(2000),
  category:       z.string().min(2).max(100),
  address:        z.string().min(5).max(500),
  lat:            z.number().min(-90).max(90),
  lng:            z.number().min(-180).max(180),
  scheduledAt:    z.string().datetime({ offset: true }).optional(),
  estimatedPrice: z.number().positive().optional(),
})

export const listJobsSchema = z.object({
  status:   z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled']).optional(),
  category: z.string().optional(),
  mine:     z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
})

export const completeJobSchema = z.object({
  finalPrice: z.number().positive('Il prezzo finale deve essere positivo'),
})

export const cancelJobSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type CreateJobDto   = z.infer<typeof createJobSchema>
export type ListJobsQuery  = z.infer<typeof listJobsSchema>
export type CompleteJobDto = z.infer<typeof completeJobSchema>
export type CancelJobDto   = z.infer<typeof cancelJobSchema>
