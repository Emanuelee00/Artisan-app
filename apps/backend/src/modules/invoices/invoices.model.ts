import mongoose, { Document, Schema } from 'mongoose'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceItemDoc {
  description: string
  quantity:    number
  unitPrice:   number
  total:       number
}

export interface InvoiceDoc extends Document {
  jobId:         string
  clientId:      string
  artisanId:     string
  clientName:    string
  clientEmail:   string
  artisanName:   string
  artisanEmail:  string
  artisanVatId:  string | null
  number:        string
  status:        'draft' | 'sent' | 'paid'
  items:         InvoiceItemDoc[]
  subtotal:      number
  taxRate:       number
  taxAmount:     number
  total:         number
  pdfUrl:        string | null
  pdfPath:       string | null
  createdAt:     Date
  updatedAt:     Date
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const itemSchema = new Schema<InvoiceItemDoc>(
  {
    description: { type: String, required: true },
    quantity:    { type: Number, required: true },
    unitPrice:   { type: Number, required: true },
    total:       { type: Number, required: true },
  },
  { _id: false }
)

const invoiceSchema = new Schema<InvoiceDoc>(
  {
    jobId:        { type: String, required: true },
    clientId:     { type: String, required: true },
    artisanId:    { type: String, required: true },
    clientName:   { type: String, required: true },
    clientEmail:  { type: String, required: true },
    artisanName:  { type: String, required: true },
    artisanEmail: { type: String, required: true },
    artisanVatId: { type: String, default: null },
    number:       { type: String, required: true, unique: true },
    status:       { type: String, enum: ['draft', 'sent', 'paid'], default: 'draft' },
    items:        { type: [itemSchema], required: true },
    subtotal:     { type: Number, required: true },
    taxRate:      { type: Number, default: 22 },
    taxAmount:    { type: Number, required: true },
    total:        { type: Number, required: true },
    pdfUrl:       { type: String, default: null },
    pdfPath:      { type: String, default: null },
  },
  { timestamps: true }
)

export const InvoiceModel = mongoose.model<InvoiceDoc>('Invoice', invoiceSchema)
