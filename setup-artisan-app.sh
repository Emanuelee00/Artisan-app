#!/bin/bash
# ============================================================
#  ARTISAN APP — Setup Script
#  Crea tutta la struttura del progetto con file pre-popolati
#  Uso: chmod +x setup-artisan-app.sh && ./setup-artisan-app.sh
# ============================================================

set -e
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${BLUE}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

ROOT="artisan-app"
mkdir -p "$ROOT" && cd "$ROOT"
info "Creazione struttura in $(pwd)"

# ============================================================
# HELPER: crea file con contenuto
# ============================================================
mkfile() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

# ============================================================
# 1. ROOT CONFIG FILES
# ============================================================
info "Root config..."

mkfile "turbo.json" << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build":   { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":     { "cache": false, "persistent": true },
    "lint":    {},
    "test":    { "dependsOn": ["^build"] }
  }
}
EOF

mkfile "package.json" << 'EOF'
{
  "name": "artisan-app",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev":   "turbo run dev",
    "build": "turbo run build",
    "lint":  "turbo run lint",
    "test":  "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
EOF

mkfile ".gitignore" << 'EOF'
node_modules/
dist/
.env
.env.local
.turbo/
*.log
.DS_Store
EOF

mkfile ".env.example" << 'EOF'
# DATABASE
DATABASE_URL=postgresql://user:password@localhost:5432/artisan_db
MONGO_URI=mongodb://localhost:27017/artisan_db
REDIS_URL=redis://localhost:6379

# AUTH
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# STRIPE
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_FEE_PERCENT=15

# FIREBASE
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# TWILIO
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# GOOGLE MAPS
GOOGLE_MAPS_API_KEY=your_key

# STORAGE
S3_BUCKET=artisan-files
S3_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# APP
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8081
EOF

log "Root config creata"

# ============================================================
# 2. SHARED TYPES PACKAGE
# ============================================================
info "Shared types..."

mkfile "packages/shared-types/package.json" << 'EOF'
{
  "name": "@artisan/shared-types",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
EOF

mkfile "packages/shared-types/src/index.ts" << 'EOF'
export * from './user.types'
export * from './job.types'
export * from './payment.types'
export * from './chat.types'
export * from './invoice.types'
EOF

mkfile "packages/shared-types/src/user.types.ts" << 'EOF'
export type UserRole = 'client' | 'artisan' | 'admin'

export interface User {
  id: string
  email: string
  phone: string
  name: string
  role: UserRole
  avatarUrl?: string
  createdAt: Date
}

export interface ArtisanProfile {
  userId: string
  category: string        // es. idraulico, elettricista
  bio: string
  hourlyRate: number
  isVerified: boolean
  rating: number
  reviewCount: number
  lat: number
  lng: number
  radiusKm: number        // area di lavoro
  stripeAccountId?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
EOF

mkfile "packages/shared-types/src/job.types.ts" << 'EOF'
export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Job {
  id: string
  clientId: string
  artisanId?: string
  title: string
  description: string
  category: string
  address: string
  lat: number
  lng: number
  scheduledAt: Date
  status: JobStatus
  estimatedPrice?: number
  finalPrice?: number
  createdAt: Date
}

export interface JobMatch {
  artisanId: string
  distanceKm: number
  rating: number
  hourlyRate: number
}
EOF

mkfile "packages/shared-types/src/payment.types.ts" << 'EOF'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Payment {
  id: string
  jobId: string
  clientId: string
  artisanId: string
  amount: number            // centesimi
  platformFee: number       // centesimi
  artisanPayout: number     // centesimi
  currency: string
  status: PaymentStatus
  stripePaymentIntentId: string
  createdAt: Date
}
EOF

mkfile "packages/shared-types/src/chat.types.ts" << 'EOF'
export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  text?: string
  imageUrl?: string
  type: 'text' | 'image' | 'invoice'
  readAt?: Date
  createdAt: Date
}

export interface Chat {
  id: string
  jobId: string
  clientId: string
  artisanId: string
  lastMessage?: string
  updatedAt: Date
}
EOF

mkfile "packages/shared-types/src/invoice.types.ts" << 'EOF'
export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface Invoice {
  id: string
  jobId: string
  clientId: string
  artisanId: string
  number: string            // es. INV-2024-001
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  pdfUrl?: string
  createdAt: Date
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}
EOF

log "Shared types creati"

# ============================================================
# 3. BACKEND
# ============================================================
info "Backend..."

mkfile "apps/backend/package.json" << 'EOF'
{
  "name": "@artisan/backend",
  "version": "1.0.0",
  "scripts": {
    "dev":   "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test":  "vitest"
  },
  "dependencies": {
    "@artisan/shared-types": "*",
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "zod": "^3.23.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "pg": "^8.11.0",
    "mongoose": "^8.3.0",
    "ioredis": "^5.3.2",
    "socket.io": "^4.7.5",
    "bullmq": "^5.7.0",
    "stripe": "^15.7.0",
    "firebase-admin": "^12.1.0",
    "pdfkit": "^0.14.0",
    "winston": "^3.13.0",
    "express-rate-limit": "^7.2.0",
    "multer": "^1.4.5",
    "@aws-sdk/client-s3": "^3.575.0"
  },
  "devDependencies": {
    "tsx": "^4.10.0",
    "typescript": "^5.4.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.0",
    "vitest": "^1.5.0"
  }
}
EOF

mkfile "apps/backend/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "paths": {
      "@artisan/shared-types": ["../../packages/shared-types/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# ---------- server.ts ----------
mkfile "apps/backend/src/server.ts" << 'EOF'
import { createApp } from './app'
import { env } from './config/env'
import { connectPostgres } from './shared/db/postgres'
import { connectMongo } from './shared/db/mongo'
import { connectRedis } from './shared/db/redis'
import { logger } from './shared/logger'
import { createServer } from 'http'
import { initSocketIO } from './shared/socket'

async function bootstrap() {
  await connectPostgres()
  await connectMongo()
  await connectRedis()

  const app = createApp()
  const httpServer = createServer(app)
  initSocketIO(httpServer)

  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`)
  })
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
EOF

# ---------- app.ts ----------
mkfile "apps/backend/src/app.ts" << 'EOF'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { errorHandler } from './gateway/errorHandler'
import { rateLimiter } from './gateway/rateLimiter'
import { mainRouter } from './gateway/router'

export function createApp() {
  const app = express()

  // Security & parsing
  app.use(helmet())
  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
  app.use(compression())
  app.use(express.json({ limit: '10mb' }))

  // Rate limiting
  app.use('/api', rateLimiter)

  // Routes
  app.use('/api/v1', mainRouter)

  // Health check
  app.get('/health', (_, res) => res.json({ status: 'ok' }))

  // Error handler (deve essere l'ultimo middleware)
  app.use(errorHandler)

  return app
}
EOF

# ---------- config/env.ts ----------
mkfile "apps/backend/src/config/env.ts" << 'EOF'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:                  z.enum(['development', 'production', 'test']).default('development'),
  PORT:                      z.coerce.number().default(3000),
  DATABASE_URL:              z.string(),
  MONGO_URI:                 z.string(),
  REDIS_URL:                 z.string(),
  JWT_SECRET:                z.string(),
  JWT_EXPIRES_IN:            z.string().default('7d'),
  STRIPE_SECRET_KEY:         z.string(),
  STRIPE_WEBHOOK_SECRET:     z.string(),
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().default(15),
  FIREBASE_PROJECT_ID:       z.string(),
  FIREBASE_PRIVATE_KEY:      z.string(),
  FIREBASE_CLIENT_EMAIL:     z.string(),
  FRONTEND_URL:              z.string().default('http://localhost:8081'),
})

export const env = envSchema.parse(process.env)
EOF

mkfile "apps/backend/src/config/stripe.config.ts" << 'EOF'
import Stripe from 'stripe'
import { env } from './env'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
})
EOF

mkfile "apps/backend/src/config/firebase.config.ts" << 'EOF'
import admin from 'firebase-admin'
import { env } from './env'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:    env.FIREBASE_PROJECT_ID,
      privateKey:   env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail:  env.FIREBASE_CLIENT_EMAIL,
    }),
  })
}

export const fcm = admin.messaging()
EOF

# ---------- gateway ----------
mkfile "apps/backend/src/gateway/auth.middleware.ts" << 'EOF'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  user?: { id: string; role: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Token mancante' })

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
    next()
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accesso negato' })
    }
    next()
  }
}
EOF

mkfile "apps/backend/src/gateway/rateLimiter.ts" << 'EOF'
import rateLimit from 'express-rate-limit'

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minuti
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra 15 minuti' },
})
EOF

mkfile "apps/backend/src/gateway/errorHandler.ts" << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../shared/logger'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  logger.error(err.message, { stack: err.stack, path: req.path })
  res.status(500).json({ error: 'Errore interno del server' })
}
EOF

mkfile "apps/backend/src/gateway/validation.middleware.ts" << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Dati non validi',
        details: result.error.flatten().fieldErrors,
      })
    }
    req.body = result.data
    next()
  }
}
EOF

mkfile "apps/backend/src/gateway/router.ts" << 'EOF'
import { Router } from 'express'
import usersRoutes   from '../modules/users/users.routes'
import jobsRoutes    from '../modules/jobs/jobs.routes'
import paymentsRoutes from '../modules/payments/payments.routes'
import invoicesRoutes from '../modules/invoices/invoices.routes'
import notificationsRoutes from '../modules/notifications/notifications.routes'

const router = Router()

router.use('/users',         usersRoutes)
router.use('/jobs',          jobsRoutes)
router.use('/payments',      paymentsRoutes)
router.use('/invoices',      invoicesRoutes)
router.use('/notifications', notificationsRoutes)

export { router as mainRouter }
EOF

# ---------- shared ----------
mkfile "apps/backend/src/shared/logger.ts" << 'EOF'
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extras = Object.keys(meta).length ? JSON.stringify(meta) : ''
      return `[${timestamp}] ${level}: ${message} ${extras}`
    })
  ),
  transports: [new winston.transports.Console()],
})
EOF

mkfile "apps/backend/src/shared/db/postgres.ts" << 'EOF'
import { Pool } from 'pg'
import { env } from '../../config/env'
import { logger } from '../logger'

export const pool = new Pool({ connectionString: env.DATABASE_URL })

export async function connectPostgres() {
  await pool.query('SELECT 1')
  logger.info('PostgreSQL connesso')
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(sql, params)
  return result.rows
}
EOF

mkfile "apps/backend/src/shared/db/mongo.ts" << 'EOF'
import mongoose from 'mongoose'
import { env } from '../../config/env'
import { logger } from '../logger'

export async function connectMongo() {
  await mongoose.connect(env.MONGO_URI)
  logger.info('MongoDB connesso')
}
EOF

mkfile "apps/backend/src/shared/db/redis.ts" << 'EOF'
import Redis from 'ioredis'
import { env } from '../../config/env'
import { logger } from '../logger'

export const redis = new Redis(env.REDIS_URL)

export async function connectRedis() {
  await redis.ping()
  logger.info('Redis connesso')
}
EOF

mkfile "apps/backend/src/shared/socket.ts" << 'EOF'
import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { logger } from './logger'

export let io: SocketServer

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true }
  })

  io.on('connection', (socket) => {
    logger.debug(`Socket connesso: ${socket.id}`)

    socket.on('join_chat', (chatId: string) => socket.join(`chat:${chatId}`))
    socket.on('join_job',  (jobId: string)  => socket.join(`job:${jobId}`))

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnesso: ${socket.id}`)
    })
  })

  logger.info('Socket.IO inizializzato')
}
EOF

mkfile "apps/backend/src/shared/queue/bullmq.ts" << 'EOF'
import { Queue, Worker } from 'bullmq'
import { redis } from '../db/redis'
import { logger } from '../logger'

const connection = { host: 'localhost', port: 6379 }

// Queues
export const notificationQueue = new Queue('notifications', { connection })
export const invoiceQueue       = new Queue('invoices',      { connection })
export const payoutQueue        = new Queue('payouts',       { connection })

logger.info('BullMQ queues inizializzate')
EOF

mkfile "apps/backend/src/shared/queue/jobs/sendNotification.job.ts" << 'EOF'
import { Worker } from 'bullmq'
import { fcm } from '../../../config/firebase.config'
import { logger } from '../../logger'

new Worker('notifications', async (job) => {
  const { token, title, body, data } = job.data

  await fcm.send({ token, notification: { title, body }, data })
  logger.info(`Notifica inviata: ${title}`)
}, { connection: { host: 'localhost', port: 6379 } })
EOF

mkfile "apps/backend/src/shared/queue/jobs/generateInvoice.job.ts" << 'EOF'
import { Worker } from 'bullmq'
import { logger } from '../../logger'

// Il worker viene importato all'avvio per attivare il processing
new Worker('invoices', async (job) => {
  const { invoiceId } = job.data
  logger.info(`Generazione PDF per fattura ${invoiceId}`)
  // La logica vera è in invoices.service.ts → generatePdf()
}, { connection: { host: 'localhost', port: 6379 } })
EOF

mkfile "apps/backend/src/shared/queue/jobs/stripePayout.job.ts" << 'EOF'
import { Worker } from 'bullmq'
import { stripe } from '../../../config/stripe.config'
import { logger } from '../../logger'

new Worker('payouts', async (job) => {
  const { stripeAccountId, amount, currency } = job.data

  await stripe.transfers.create({
    amount,
    currency,
    destination: stripeAccountId,
  })

  logger.info(`Payout effettuato: ${amount} ${currency} → ${stripeAccountId}`)
}, { connection: { host: 'localhost', port: 6379 } })
EOF

# ---------- MODULE: USERS ----------
mkfile "apps/backend/src/modules/users/users.schema.ts" << 'EOF'
import { z } from 'zod'

export const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(2),
  phone:    z.string().min(8),
  role:     z.enum(['client', 'artisan']),
})

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
})

export type RegisterDto = z.infer<typeof registerSchema>
export type LoginDto    = z.infer<typeof loginSchema>
EOF

mkfile "apps/backend/src/modules/users/users.model.ts" << 'EOF'
import { query } from '../../shared/db/postgres'

export const UserModel = {
  async findByEmail(email: string) {
    const rows = await query('SELECT * FROM users WHERE email = $1', [email])
    return rows[0] ?? null
  },

  async findById(id: string) {
    const rows = await query('SELECT * FROM users WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async create(data: {
    email: string; passwordHash: string; name: string; phone: string; role: string
  }) {
    const rows = await query(
      `INSERT INTO users (email, password_hash, name, phone, role, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [data.email, data.passwordHash, data.name, data.phone, data.role]
    )
    return rows[0]
  },
}
EOF

mkfile "apps/backend/src/modules/users/users.service.ts" << 'EOF'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserModel } from './users.model'
import { AppError } from '../../gateway/errorHandler'
import { env } from '../../config/env'
import type { RegisterDto, LoginDto } from './users.schema'

export const UsersService = {
  async register(dto: RegisterDto) {
    const existing = await UserModel.findByEmail(dto.email)
    if (existing) throw new AppError(409, 'Email già registrata')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await UserModel.create({ ...dto, passwordHash })

    return { user: { id: user.id, email: user.email, role: user.role } }
  },

  async login(dto: LoginDto) {
    const user = await UserModel.findByEmail(dto.email)
    if (!user) throw new AppError(401, 'Credenziali non valide')

    const valid = await bcrypt.compare(dto.password, user.password_hash)
    if (!valid) throw new AppError(401, 'Credenziali non valide')

    const payload = { id: user.id, role: user.role }
    const accessToken  = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' })

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } }
  },

  async getProfile(userId: string) {
    const user = await UserModel.findById(userId)
    if (!user) throw new AppError(404, 'Utente non trovato')
    const { password_hash, ...profile } = user
    return profile
  },
}
EOF

mkfile "apps/backend/src/modules/users/users.controller.ts" << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { UsersService } from './users.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const UsersController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.register(req.body)
      res.status(201).json(result)
    } catch (e) { next(e) }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.login(req.body)
      res.json(result)
    } catch (e) { next(e) }
  },

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await UsersService.getProfile(req.user!.id)
      res.json(profile)
    } catch (e) { next(e) }
  },
}
EOF

mkfile "apps/backend/src/modules/users/users.routes.ts" << 'EOF'
import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate } from '../../gateway/auth.middleware'
import { validate } from '../../gateway/validation.middleware'
import { registerSchema, loginSchema } from './users.schema'

const router = Router()

router.post('/register', validate(registerSchema), UsersController.register)
router.post('/login',    validate(loginSchema),    UsersController.login)
router.get('/me',        authenticate,             UsersController.getProfile)

export default router
EOF

# ---------- MODULE: JOBS ----------
mkfile "apps/backend/src/modules/jobs/jobs.model.ts" << 'EOF'
import { query } from '../../shared/db/postgres'

export const JobModel = {
  async create(data: {
    clientId: string; title: string; description: string
    category: string; address: string; lat: number; lng: number; scheduledAt: Date
  }) {
    const rows = await query(
      `INSERT INTO jobs (client_id, title, description, category, address, lat, lng, scheduled_at, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW()) RETURNING *`,
      [data.clientId, data.title, data.description, data.category,
       data.address, data.lat, data.lng, data.scheduledAt]
    )
    return rows[0]
  },

  async findById(id: string) {
    const rows = await query('SELECT * FROM jobs WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async updateStatus(id: string, status: string, artisanId?: string) {
    const rows = await query(
      `UPDATE jobs SET status = $1, artisan_id = COALESCE($2, artisan_id), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, artisanId, id]
    )
    return rows[0]
  },

  async findByClient(clientId: string) {
    return query('SELECT * FROM jobs WHERE client_id = $1 ORDER BY created_at DESC', [clientId])
  },
}
EOF

mkfile "apps/backend/src/modules/jobs/jobs.matching.ts" << 'EOF'
import { redis } from '../../shared/db/redis'

// Salva posizione artigiano in Redis GEO
export async function updateArtisanLocation(artisanId: string, lat: number, lng: number) {
  await redis.geoadd('artisans:geo', lng, lat, artisanId)
  await redis.setex(`artisan:online:${artisanId}`, 300, '1')  // online per 5 min
}

// Trova artigiani vicini per categoria
export async function findNearbyArtisans(
  lat: number, lng: number, radiusKm: number, category: string
): Promise<string[]> {
  const results = await redis.georadius(
    'artisans:geo', lng, lat, radiusKm, 'km',
    'ASC', 'COUNT', 20
  )
  return results as string[]
}
EOF

mkfile "apps/backend/src/modules/jobs/jobs.service.ts" << 'EOF'
import { JobModel } from './jobs.model'
import { findNearbyArtisans } from './jobs.matching'
import { AppError } from '../../gateway/errorHandler'
import { io } from '../../shared/socket'

export const JobsService = {
  async createJob(clientId: string, dto: any) {
    const job = await JobModel.create({ clientId, ...dto })

    // Notifica artigiani vicini via WebSocket
    const nearbyArtisans = await findNearbyArtisans(dto.lat, dto.lng, 10, dto.category)
    nearbyArtisans.forEach(artisanId => {
      io.to(`artisan:${artisanId}`).emit('new_job', job)
    })

    return job
  },

  async acceptJob(jobId: string, artisanId: string) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.status !== 'pending') throw new AppError(400, 'Job non disponibile')

    const updated = await JobModel.updateStatus(jobId, 'accepted', artisanId)
    io.to(`job:${jobId}`).emit('job_accepted', updated)
    return updated
  },

  async completeJob(jobId: string, artisanId: string, finalPrice: number) {
    const job = await JobModel.findById(jobId)
    if (!job) throw new AppError(404, 'Job non trovato')
    if (job.artisan_id !== artisanId) throw new AppError(403, 'Non autorizzato')

    const updated = await JobModel.updateStatus(jobId, 'completed')
    io.to(`job:${jobId}`).emit('job_completed', updated)
    return updated
  },
}
EOF

mkfile "apps/backend/src/modules/jobs/jobs.controller.ts" << 'EOF'
import { Response, NextFunction } from 'express'
import { JobsService } from './jobs.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const JobsController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.createJob(req.user!.id, req.body)
      res.status(201).json(job)
    } catch (e) { next(e) }
  },

  async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.acceptJob(req.params.id, req.user!.id)
      res.json(job)
    } catch (e) { next(e) }
  },

  async complete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await JobsService.completeJob(req.params.id, req.user!.id, req.body.finalPrice)
      res.json(job)
    } catch (e) { next(e) }
  },
}
EOF

mkfile "apps/backend/src/modules/jobs/jobs.routes.ts" << 'EOF'
import { Router } from 'express'
import { JobsController } from './jobs.controller'
import { authenticate, authorize } from '../../gateway/auth.middleware'

const router = Router()

router.use(authenticate)
router.post('/',                                     JobsController.create)
router.patch('/:id/accept',  authorize('artisan'),   JobsController.accept)
router.patch('/:id/complete', authorize('artisan'),  JobsController.complete)

export default router
EOF

# ---------- MODULE: PAYMENTS ----------
mkfile "apps/backend/src/modules/payments/stripe.service.ts" << 'EOF'
import { stripe } from '../../config/stripe.config'
import { env } from '../../config/env'
import { payoutQueue } from '../../shared/queue/bullmq'

export const StripeService = {
  // Crea account Stripe per l'artigiano (onboarding)
  async createConnectAccount(email: string) {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
    })
    return account
  },

  // Link di onboarding per completare il profilo Stripe
  async createOnboardingLink(accountId: string, returnUrl: string) {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })
    return link.url
  },

  // Cliente paga → piattaforma incassa, poi paga artigiano
  async createPaymentIntent(amount: number, currency: string, jobId: string) {
    const platformFee = Math.round(amount * env.STRIPE_PLATFORM_FEE_PERCENT / 100)

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { jobId },
      automatic_payment_methods: { enabled: true },
    })

    return { clientSecret: intent.client_secret, platformFee }
  },

  // Webhook Stripe → payout all'artigiano
  async handleWebhook(payload: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(
      payload, signature, env.STRIPE_WEBHOOK_SECRET
    )

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as any
      // Accoda il payout — non blocca la risposta al webhook
      await payoutQueue.add('payout', {
        jobId: intent.metadata.jobId,
        amount: intent.amount,
        currency: intent.currency,
      })
    }

    return event
  },
}
EOF

mkfile "apps/backend/src/modules/payments/payments.controller.ts" << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { StripeService } from './stripe.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const PaymentsController = {
  async createIntent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, currency, jobId } = req.body
      const result = await StripeService.createPaymentIntent(amount, currency, jobId)
      res.json(result)
    } catch (e) { next(e) }
  },

  async onboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await StripeService.createConnectAccount(req.body.email)
      const url = await StripeService.createOnboardingLink(account.id, req.body.returnUrl)
      res.json({ url, accountId: account.id })
    } catch (e) { next(e) }
  },

  // Riceve eventi da Stripe (raw body necessario)
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['stripe-signature'] as string
      await StripeService.handleWebhook(req.body, sig)
      res.json({ received: true })
    } catch (e) { next(e) }
  },
}
EOF

mkfile "apps/backend/src/modules/payments/payments.routes.ts" << 'EOF'
import { Router } from 'express'
import express from 'express'
import { PaymentsController } from './payments.controller'
import { authenticate } from '../../gateway/auth.middleware'

const router = Router()

// Webhook deve ricevere raw body (non JSON parsato)
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentsController.webhook)

router.use(authenticate)
router.post('/intent',  PaymentsController.createIntent)
router.post('/onboard', PaymentsController.onboard)

export default router
EOF

# ---------- MODULE: TRACKING ----------
mkfile "apps/backend/src/modules/tracking/tracking.service.ts" << 'EOF'
import { redis } from '../../shared/db/redis'
import { updateArtisanLocation } from '../jobs/jobs.matching'
import { io } from '../../shared/socket'

export const TrackingService = {
  async updatePosition(artisanId: string, lat: number, lng: number, jobId?: string) {
    // Salva posizione Redis GEO
    await updateArtisanLocation(artisanId, lat, lng)

    // Broadcast al cliente del job in corso
    if (jobId) {
      io.to(`job:${jobId}`).emit('artisan_location', { artisanId, lat, lng, ts: Date.now() })
    }
  },

  async getArtisanPosition(artisanId: string) {
    const pos = await redis.geopos('artisans:geo', artisanId)
    if (!pos?.[0]) return null
    const [lng, lat] = pos[0]
    return { lat: parseFloat(lat), lng: parseFloat(lng) }
  },
}
EOF

mkfile "apps/backend/src/modules/tracking/tracking.gateway.ts" << 'EOF'
import { io } from '../../shared/socket'
import { TrackingService } from './tracking.service'

// Gestisce gli eventi WebSocket per il tracking GPS
export function initTrackingGateway() {
  io.on('connection', (socket) => {
    // L'artigiano invia la sua posizione ogni N secondi
    socket.on('update_location', async (data: {
      artisanId: string; lat: number; lng: number; jobId?: string
    }) => {
      await TrackingService.updatePosition(data.artisanId, data.lat, data.lng, data.jobId)
    })
  })
}
EOF

mkfile "apps/backend/src/modules/tracking/geo.utils.ts" << 'EOF'
// Calcola distanza in km tra due coordinate (formula Haversine)
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }
EOF

# ---------- MODULE: INVOICES ----------
mkfile "apps/backend/src/modules/invoices/invoices.model.ts" << 'EOF'
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
EOF

mkfile "apps/backend/src/modules/invoices/pdf.generator.ts" << 'EOF'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import type { Invoice } from '@artisan/shared-types'

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(24).text('FATTURA', { align: 'right' })
    doc.fontSize(12).text(`N. ${invoice.number}`, { align: 'right' })
    doc.text(`Data: ${new Date(invoice.createdAt).toLocaleDateString('it-IT')}`, { align: 'right' })
    doc.moveDown(2)

    // Items
    doc.fontSize(14).text('Descrizione servizi', { underline: true })
    doc.moveDown()

    invoice.items.forEach((item) => {
      doc.fontSize(11)
        .text(`${item.description}`, 50, doc.y, { continued: true })
        .text(`${item.quantity} x €${item.unitPrice.toFixed(2)} = €${item.total.toFixed(2)}`, { align: 'right' })
    })

    doc.moveDown()
    doc.fontSize(12).text(`Subtotale: €${invoice.subtotal.toFixed(2)}`, { align: 'right' })
    doc.text(`IVA (${invoice.tax}%): €${(invoice.subtotal * invoice.tax / 100).toFixed(2)}`, { align: 'right' })
    doc.fontSize(14).text(`Totale: €${invoice.total.toFixed(2)}`, { align: 'right' })

    doc.end()
  })
}
EOF

mkfile "apps/backend/src/modules/invoices/invoices.service.ts" << 'EOF'
import { InvoiceModel } from './invoices.model'
import { generateInvoicePdf } from './pdf.generator'
import { AppError } from '../../gateway/errorHandler'

export const InvoicesService = {
  async createInvoice(data: any) {
    const count  = await InvoiceModel.countDocuments()
    const number = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const invoice = await InvoiceModel.create({ ...data, number })
    return invoice
  },

  async generateAndSavePdf(invoiceId: string) {
    const invoice = await InvoiceModel.findById(invoiceId)
    if (!invoice) throw new AppError(404, 'Fattura non trovata')

    const pdf = await generateInvoicePdf(invoice.toObject() as any)
    // TODO: upload PDF su S3 e salvare l'URL
    return pdf
  },

  async findByArtisan(artisanId: string) {
    return InvoiceModel.find({ artisanId }).sort({ createdAt: -1 })
  },
}
EOF

mkfile "apps/backend/src/modules/invoices/invoices.controller.ts" << 'EOF'
import { Response, NextFunction } from 'express'
import { InvoicesService } from './invoices.service'
import type { AuthRequest } from '../../gateway/auth.middleware'

export const InvoicesController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoicesService.createInvoice({ ...req.body, artisanId: req.user!.id })
      res.status(201).json(invoice)
    } catch (e) { next(e) }
  },

  async downloadPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pdf = await InvoicesService.generateAndSavePdf(req.params.id)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=fattura-${req.params.id}.pdf`)
      res.send(pdf)
    } catch (e) { next(e) }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoices = await InvoicesService.findByArtisan(req.user!.id)
      res.json(invoices)
    } catch (e) { next(e) }
  },
}
EOF

mkfile "apps/backend/src/modules/invoices/invoices.routes.ts" << 'EOF'
import { Router } from 'express'
import { InvoicesController } from './invoices.controller'
import { authenticate, authorize } from '../../gateway/auth.middleware'

const router = Router()

router.use(authenticate)
router.post('/',              authorize('artisan'), InvoicesController.create)
router.get('/',               authorize('artisan'), InvoicesController.list)
router.get('/:id/pdf',        InvoicesController.downloadPdf)

export default router
EOF

# ---------- MODULE: NOTIFICATIONS ----------
mkfile "apps/backend/src/modules/notifications/firebase.service.ts" << 'EOF'
import { fcm } from '../../config/firebase.config'
import { logger } from '../../shared/logger'

export const FirebaseService = {
  async sendPush(token: string, title: string, body: string, data?: Record<string, string>) {
    try {
      await fcm.send({ token, notification: { title, body }, data })
    } catch (err) {
      logger.error('Errore push notification', { err, token })
    }
  },

  async sendMulticast(tokens: string[], title: string, body: string) {
    if (!tokens.length) return
    await fcm.sendEachForMulticast({ tokens, notification: { title, body } })
  },
}
EOF

mkfile "apps/backend/src/modules/notifications/notifications.service.ts" << 'EOF'
import { FirebaseService } from './firebase.service'
import { notificationQueue } from '../../shared/queue/bullmq'

export const NotificationsService = {
  // Invio immediato
  async sendNow(token: string, title: string, body: string) {
    await FirebaseService.sendPush(token, title, body)
  },

  // Invio in coda (asincrono, non blocca)
  async enqueue(token: string, title: string, body: string, data?: any) {
    await notificationQueue.add('send', { token, title, body, data })
  },
}
EOF

mkfile "apps/backend/src/modules/notifications/notifications.events.ts" << 'EOF'
// Costanti degli eventi notifica — usare sempre queste invece di stringhe raw
export const NotificationEvents = {
  JOB_ACCEPTED:   'job_accepted',
  JOB_COMPLETED:  'job_completed',
  PAYMENT_DONE:   'payment_done',
  NEW_MESSAGE:    'new_message',
  ARTISAN_NEARBY: 'artisan_nearby',
} as const
EOF

mkfile "apps/backend/src/modules/notifications/notifications.routes.ts" << 'EOF'
import { Router } from 'express'
import { authenticate } from '../../gateway/auth.middleware'

const router = Router()

// Placeholder — le notifiche sono principalmente push/event driven
router.get('/test', authenticate, (req, res) => {
  res.json({ message: 'Notifications module attivo' })
})

export default router
EOF

# ---------- CHAT (WebSocket only) ----------
mkfile "apps/backend/src/modules/chat/chat.model.ts" << 'EOF'
import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  senderId:  { type: String, required: true },
  text:      String,
  imageUrl:  String,
  type:      { type: String, enum: ['text', 'image', 'invoice'], default: 'text' },
  readAt:    Date,
}, { timestamps: true })

export const MessageModel = mongoose.model('Message', messageSchema)
EOF

mkfile "apps/backend/src/modules/chat/chat.service.ts" << 'EOF'
import { MessageModel } from './chat.model'

export const ChatService = {
  async saveMessage(chatId: string, senderId: string, text: string, type = 'text') {
    return MessageModel.create({ chatId, senderId, text, type })
  },

  async getHistory(chatId: string, limit = 50) {
    return MessageModel.find({ chatId }).sort({ createdAt: -1 }).limit(limit)
  },
}
EOF

mkfile "apps/backend/src/modules/chat/chat.gateway.ts" << 'EOF'
import { io } from '../../shared/socket'
import { ChatService } from './chat.service'

export function initChatGateway() {
  io.on('connection', (socket) => {
    socket.on('send_message', async (data: {
      chatId: string; senderId: string; text: string
    }) => {
      const message = await ChatService.saveMessage(data.chatId, data.senderId, data.text)
      // Broadcast a tutti nella stanza chat
      io.to(`chat:${data.chatId}`).emit('new_message', message)
    })

    socket.on('get_history', async (chatId: string, callback: Function) => {
      const messages = await ChatService.getHistory(chatId)
      callback(messages)
    })
  })
}
EOF

mkfile "apps/backend/src/modules/chat/chat.events.ts" << 'EOF'
export const ChatEvents = {
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE:  'new_message',
  GET_HISTORY:  'get_history',
  JOIN_CHAT:    'join_chat',
} as const
EOF

log "Backend completo"

# ============================================================
# 4. DATABASE MIGRATIONS
# ============================================================
info "Database migrations..."

mkfile "apps/backend/src/shared/db/migrations/001_users.sql" << 'EOF'
-- Tabella utenti principale
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('client','artisan','admin')),
  avatar_url    TEXT,
  fcm_token     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Profili artigiani (estende users)
CREATE TABLE IF NOT EXISTS artisan_profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category          VARCHAR(100) NOT NULL,
  bio               TEXT,
  hourly_rate       DECIMAL(10,2),
  is_verified       BOOLEAN DEFAULT FALSE,
  rating            DECIMAL(3,2) DEFAULT 0,
  review_count      INT DEFAULT 0,
  lat               DECIMAL(10,8),
  lng               DECIMAL(11,8),
  radius_km         INT DEFAULT 20,
  stripe_account_id VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_artisan_category ON artisan_profiles(category);
EOF

mkfile "apps/backend/src/shared/db/migrations/002_jobs.sql" << 'EOF'
-- Lavori / richieste
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id),
  artisan_id      UUID REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100) NOT NULL,
  address         TEXT NOT NULL,
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  status          VARCHAR(30) DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
  scheduled_at    TIMESTAMPTZ,
  estimated_price DECIMAL(10,2),
  final_price     DECIMAL(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_client   ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_artisan  ON jobs(artisan_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
EOF

mkfile "apps/backend/src/shared/db/migrations/003_payments.sql" << 'EOF'
-- Pagamenti
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                   UUID NOT NULL REFERENCES jobs(id),
  client_id                UUID NOT NULL REFERENCES users(id),
  artisan_id               UUID NOT NULL REFERENCES users(id),
  amount                   INT NOT NULL,          -- centesimi
  platform_fee             INT NOT NULL,
  artisan_payout           INT NOT NULL,
  currency                 VARCHAR(3) DEFAULT 'eur',
  status                   VARCHAR(20) DEFAULT 'pending'
                             CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_job     ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_artisan ON payments(artisan_id);
EOF

log "Migrations create"

# ============================================================
# 5. INFRASTRUTTURA
# ============================================================
info "Infrastruttura Docker & CI/CD..."

mkfile "apps/backend/Dockerfile" << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
EOF

mkfile "infra/docker-compose.yml" << 'EOF'
version: '3.9'

services:
  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile
    ports: ['3000:3000']
    env_file: ../.env
    depends_on: [postgres, mongo, redis]
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: artisan_db
      POSTGRES_USER: artisan
      POSTGRES_PASSWORD: password
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ['5432:5432']

  mongo:
    image: mongo:7
    volumes: [mongo_data:/data/db]
    ports: ['27017:27017']

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis_data:/data]
    ports: ['6379:6379']

volumes:
  postgres_data:
  mongo_data:
  redis_data:
EOF

mkfile "infra/nginx/default.conf" << 'EOF'
upstream backend {
  server backend:3000;
}

server {
  listen 80;
  server_name _;

  # Backend API
  location /api/ {
    proxy_pass         http://backend;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  # WebSocket
  location /socket.io/ {
    proxy_pass         http://backend;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
  }
}
EOF

mkfile "infra/ci-cd/github-actions.yml" << 'EOF'
name: CI/CD — Artisan App

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build & push Docker image
        run: |
          docker build -t artisan-backend ./apps/backend
          # docker push ... (configura il tuo registry)
      - name: Deploy
        run: echo "Aggiungi qui il tuo step di deploy (Railway, AWS ECS, ecc.)"
EOF

mkfile "infra/scripts/migrate.sh" << 'EOF'
#!/bin/bash
# Esegue tutte le migrations SQL in ordine
set -e
DB_URL="${DATABASE_URL:-postgresql://artisan:password@localhost:5432/artisan_db}"

echo "Esecuzione migrations..."
for file in apps/backend/src/shared/db/migrations/*.sql; do
  echo "  → $file"
  psql "$DB_URL" -f "$file"
done
echo "Migrations completate."
EOF
chmod +x infra/scripts/migrate.sh

mkfile "infra/scripts/deploy.sh" << 'EOF'
#!/bin/bash
set -e
echo "Deploy Artisan App..."
docker compose -f infra/docker-compose.yml pull
docker compose -f infra/docker-compose.yml up -d --build
echo "Deploy completato!"
EOF
chmod +x infra/scripts/deploy.sh

log "Infrastruttura creata"

# ============================================================
# 6. MOBILE APP (React Native + Expo) — struttura
# ============================================================
info "Mobile app..."

mkfile "apps/mobile/package.json" << 'EOF'
{
  "name": "@artisan/mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "dev":     "expo start",
    "android": "expo run:android",
    "ios":     "expo run:ios",
    "build":   "eas build"
  },
  "dependencies": {
    "@artisan/shared-types": "*",
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-location": "~17.0.0",
    "expo-notifications": "~0.28.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-maps": "1.14.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.35.0",
    "socket.io-client": "^4.7.5",
    "@stripe/stripe-react-native": "0.37.0",
    "axios": "^1.7.0",
    "react-native-safe-area-context": "4.10.1",
    "react-native-screens": "3.31.1"
  }
}
EOF

mkfile "apps/mobile/app/_layout.tsx" << 'EOF'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from '@stripe/stripe-react-native'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PK!}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)"  options={{ headerShown: false }} />
        </Stack>
      </StripeProvider>
    </QueryClientProvider>
  )
}
EOF

mkfile "apps/mobile/app/(auth)/login.tsx" << 'EOF'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/auth.store'

export default function LoginScreen() {
  const router  = useRouter()
  const { login } = useAuthStore()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Artisan App</Text>
      {/* TODO: aggiungere form completo */}
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(app)/home')}>
        <Text style={styles.btnText}>Accedi</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 28, fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  btn:       { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: '600', fontSize: 16 },
})
EOF

mkfile "apps/mobile/app/(app)/home.tsx" << 'EOF'
import { View, Text, StyleSheet } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trova un artigiano</Text>
      {/* TODO: mappa + lista artigiani vicini */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title:     { fontSize: 22, fontWeight: '700', marginBottom: 16 },
})
EOF

mkfile "apps/mobile/store/auth.store.ts" << 'EOF'
import { create } from 'zustand'
import type { User, AuthTokens } from '@artisan/shared-types'

interface AuthState {
  user:   User | null
  tokens: AuthTokens | null
  login:  (user: User, tokens: AuthTokens) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:   null,
  tokens: null,
  login:  (user, tokens) => set({ user, tokens }),
  logout: () => set({ user: null, tokens: null }),
}))
EOF

mkfile "apps/mobile/services/api.ts" << 'EOF'
import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export const api = axios.create({ baseURL: BASE_URL })

// Aggiunge il token JWT a ogni richiesta
api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})
EOF

mkfile "apps/mobile/services/jobs.ts" << 'EOF'
import { api } from './api'

export const JobsAPI = {
  create: (data: any) => api.post('/jobs', data).then(r => r.data),
  accept: (id: string) => api.patch(`/jobs/${id}/accept`).then(r => r.data),
  complete: (id: string, finalPrice: number) =>
    api.patch(`/jobs/${id}/complete`, { finalPrice }).then(r => r.data),
}
EOF

mkfile "apps/mobile/services/payments.ts" << 'EOF'
import { api } from './api'

export const PaymentsAPI = {
  createIntent: (amount: number, currency: string, jobId: string) =>
    api.post('/payments/intent', { amount, currency, jobId }).then(r => r.data),

  onboard: (email: string, returnUrl: string) =>
    api.post('/payments/onboard', { email, returnUrl }).then(r => r.data),
}
EOF

mkfile "apps/mobile/services/chat.ts" << 'EOF'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const tokens = useAuthStore.getState().tokens
    socket = io(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000', {
      auth: { token: tokens?.accessToken },
    })
  }
  return socket
}

export function joinChat(chatId: string) {
  getSocket().emit('join_chat', chatId)
}

export function sendMessage(chatId: string, senderId: string, text: string) {
  getSocket().emit('send_message', { chatId, senderId, text })
}

export function onNewMessage(callback: (msg: any) => void) {
  getSocket().on('new_message', callback)
  return () => getSocket().off('new_message', callback)
}
EOF

# Crea directory placeholder per gli altri screen
for screen in jobs chat tracking payments invoices profile; do
  mkfile "apps/mobile/app/(app)/${screen}.tsx" << EOF
import { View, Text } from 'react-native'

export default function ${screen^}Screen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Modulo ${screen} — da implementare</Text>
    </View>
  )
}
EOF
done

log "Mobile app creata"

# ============================================================
# 7. ADMIN PANEL (Next.js) — struttura base
# ============================================================
info "Admin panel..."

mkfile "apps/admin/package.json" << 'EOF'
{
  "name": "@artisan/admin",
  "version": "1.0.0",
  "scripts": {
    "dev":   "next dev -p 4000",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@artisan/shared-types": "*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "recharts": "^2.12.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0"
  }
}
EOF

mkfile "apps/admin/app/layout.tsx" << 'EOF'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
EOF

mkfile "apps/admin/app/dashboard/page.tsx" << 'EOF'
export default function DashboardPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Dashboard Artisan App</h1>
      {/* TODO: aggiungere KPI, grafici, tabelle */}
    </main>
  )
}
EOF

for section in users jobs payments invoices analytics; do
  mkdir -p "apps/admin/app/${section}"
  mkfile "apps/admin/app/${section}/page.tsx" << EOF
export default function ${section^}Page() {
  return <main style={{ padding: 32 }}><h1>${section^}</h1></main>
}
EOF
done

log "Admin panel creato"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  ARTISAN APP — Setup completato!      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📁 Struttura creata in: $(pwd)${NC}"
echo ""
echo -e "${YELLOW}▶ PROSSIMI PASSI:${NC}"
echo "  1. cp .env.example .env          # configura le variabili"
echo "  2. npm install                   # installa le dipendenze (root)"
echo "  3. docker compose -f infra/docker-compose.yml up -d"
echo "  4. bash infra/scripts/migrate.sh # crea le tabelle DB"
echo "  5. cd apps/backend && npm run dev"
echo "  6. cd apps/mobile  && npm run dev"
echo ""
echo -e "${YELLOW}📦 Stack:${NC}"
echo "  Mobile:  React Native + Expo"
echo "  Backend: Node.js + Express + TypeScript"
echo "  DB:      PostgreSQL + MongoDB + Redis"
echo "  Pay:     Stripe Connect"
echo "  RT:      Socket.IO + BullMQ"
echo "  Deploy:  Docker + GitHub Actions"
echo ""
warn "Ricorda: aggiungi le API keys nel file .env prima di avviare!"
EOF