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
