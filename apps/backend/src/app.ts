import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import path from 'path'
import { errorHandler } from './gateway/errorHandler'
import { rateLimiter } from './gateway/rateLimiter'
import { mainRouter } from './gateway/router'
import { env } from './config/env'

export function createApp() {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: false }))

  // In dev/test: CORS aperto per poter chiamare le API da file:// o da telefono
  const corsOrigin = env.NODE_ENV === 'production' ? env.FRONTEND_URL : '*'
  app.use(cors({ origin: corsOrigin, credentials: corsOrigin !== '*' }))

  app.use(compression())
  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())

  app.use('/api', rateLimiter)
  app.use('/api/v1', mainRouter)

  app.get('/health', (_, res) => res.json({ status: 'ok', env: env.NODE_ENV }))

  // Mock debug endpoints — solo in development/test
  if (env.NODE_ENV !== 'production') {
    const { mockRouter } = require('./shared/mock-server')
    app.use('/mock', mockRouter)

    // Serve test-app.html direttamente da http://localhost:3000/
    const htmlPath = path.resolve(process.cwd(), '../../test-app.html')
    app.get('/', (_, res) => res.sendFile(htmlPath))
  }

  app.use(errorHandler)

  return app
}
