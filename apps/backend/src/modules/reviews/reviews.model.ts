import mongoose, { Schema, Document } from 'mongoose'

export interface ReviewDoc extends Document {
  jobId:     string
  clientId:  string
  artisanId: string
  rating:    number
  comment:   string | null
  createdAt: Date
}

const ReviewSchema = new Schema<ReviewDoc>(
  {
    jobId:     { type: String, required: true, unique: true, index: true },
    clientId:  { type: String, required: true, index: true },
    artisanId: { type: String, required: true, index: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const ReviewModel = mongoose.model<ReviewDoc>('Review', ReviewSchema)

export interface RatingStats {
  artisanId:    string
  avg:          number
  count:        number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}
