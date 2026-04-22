import mongoose from 'mongoose'
import { env, isMock } from '../../config/env'
import { logger } from '../logger'

let _memServer: import('mongodb-memory-server').MongoMemoryServer | null = null

export async function connectMongo(): Promise<void> {
  if (isMock('MONGO_URI')) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    _memServer = await MongoMemoryServer.create()
    const uri = _memServer.getUri()
    await mongoose.connect(uri)
    logger.info('MongoDB [MOCK] connesso (mongodb-memory-server)')
    return
  }
  await mongoose.connect(env.MONGO_URI)
  logger.info('MongoDB connesso')
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect()
  if (_memServer) {
    await _memServer.stop()
    _memServer = null
  }
}

export { mongoose }
