import mongoose from 'mongoose'

const invoiceSchema = new mongoose.Schema({
  jobId:      { type: String, required: true },
  clientId:   { type: String, required: true },
  artisanId:  { type: String, required: true },
  number:     { type: String, required: true, unique: true },
  items:      [{ description: String, quantity: Number, unitPrice: Number, total: Number }],
  subtotal:   { type: Number, required: true },
  tax:        { type: Number, default: 0 },
  total:      { type: Number, required: true },
  status:     { type: String, enum: ['draft', 'sent', 'paid'], default: 'draft' },
  pdfUrl:     String,
}, { timestamps: true })

export const InvoiceModel = mongoose.model('Invoice', invoiceSchema)
