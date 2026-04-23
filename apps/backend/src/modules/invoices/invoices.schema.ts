import { z } from 'zod'

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Descrizione obbligatoria'),
  quantity:    z.number().positive('Quantità deve essere positiva'),
  unitPrice:   z.number().positive('Prezzo unitario deve essere positivo'),
})

export const createInvoiceSchema = z.object({
  jobId: z.string().min(1, 'jobId obbligatorio'),
  items: z.array(invoiceItemSchema).min(1, 'Almeno una voce').optional(),
})

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>
export type InvoiceItemDto   = z.infer<typeof invoiceItemSchema>
