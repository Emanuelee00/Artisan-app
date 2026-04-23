// ── Users ─────────────────────────────────────────────────────────────────────

export type UserRole = 'client' | 'artisan' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  phone: string
  role: UserRole
  avatarUrl?: string | null
  createdAt: Date
}

export interface ArtisanProfile {
  userId: string
  category: string
  bio?: string | null
  hourlyRate?: number | null
  isVerified: boolean
  rating: number
  reviewCount: number
  lat?: number | null
  lng?: number | null
  radiusKm: number
  stripeAccountId?: string | null
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'

export interface Job {
  id: string
  clientId: string
  artisanId?: string | null
  title: string
  description: string
  category: string
  address: string
  lat: number
  lng: number
  scheduledAt?: Date | null
  status: JobStatus
  estimatedPrice?: number | null
  finalPrice?: number | null
  createdAt: Date
}

// ── Payments ──────────────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface Payment {
  id: string
  jobId: string
  clientId: string
  artisanId: string
  amount: number
  currency: string
  status: PaymentStatus
  stripePaymentIntentId?: string | null
  stripeTransferId?: string | null
  platformFee: number
  createdAt: Date
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'location'

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  text?: string | null
  type: MessageType
  imageUrl?: string | null
  lat?: number | null
  lng?: number | null
  createdAt: Date
}

export interface Chat {
  id: string
  jobId: string
  clientId: string
  artisanId: string
  lastMessage?: string | null
  updatedAt: Date
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  number: string
  jobId: string
  clientId: string
  artisanId: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  pdfUrl?: string | null
  createdAt: Date
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'job_accepted'
  | 'job_completed'
  | 'payment_received'
  | 'new_message'
  | 'artisan_nearby'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
  read: boolean
  createdAt: Date
}
