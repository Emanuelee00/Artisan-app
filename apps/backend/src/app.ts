import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { errorHandler } from './gateway/errorHandler'
import { rateLimiter } from './gateway/rateLimiter'
import { mainRouter } from './gateway/router'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
  app.use(compression())
  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())

  app.use('/api', rateLimiter)
  app.use('/api/v1', mainRouter)

  app.get('/health', (_, res) => res.json({ status: 'ok' }))

  app.use(errorHandler)

  return app
}
