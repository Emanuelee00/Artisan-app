import { z } from 'zod'

export const createIntentSchema = z.object({
  jobId:    z.string().min(1, 'jobId obbligatorio'),
  currency: z.string().length(3).default('eur'),
})

export const onboardSchema = z.object({
  email:     z.string().email('Email non valida'),
  returnUrl: z.string().url().optional(),
})

export const mockWebhookSchema = z.object({
  type: z.enum([
    'payment_intent.succeeded',
    'payment_intent.failed',
    'transfer.created',
  ]),
  data: z.object({
    object: z.record(z.unknown()),
  }),
})

export type CreateIntentDto = z.infer<typeof createIntentSchema>
export type OnboardDto      = z.infer<typeof onboardSchema>
export type MockWebhookDto  = z.infer<typeof mockWebhookSchema>
