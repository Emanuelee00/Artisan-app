import Redis from 'ioredis'
import { env, isMock } from '../../config/env'
import { logger } from '../logger'
import { RedisMock } from '../../mocks/redis.mock'

export const redis = isMock('REDIS_URL')
  ? (new RedisMock() as unknown as Redis)
  : new Redis(env.REDIS_URL, { lazyConnect: true })

export async function connectRedis(): Promise<void> {
  await redis.ping()
  logger.info(`Redis ${isMock('REDIS_URL') ? '[MOCK]' : ''} connesso`)
}

// ── Typed wrappers ────────────────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key)
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds) await redis.setex(key, ttlSeconds, value)
  else await redis.set(key, value)
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length) await redis.del(...keys)
}

export async function geoAdd(
  key: string,
  lat: number,
  lng: number,
  member: string
): Promise<void> {
  // ioredis geoadd ordine: key, lng, lat, member
  await redis.geoadd(key, lng, lat, member)
}

export async function geoRadius(
  key: string,
  lat: number,
  lng: number,
  radiusKm: number
): Promise<string[]> {
  const result = await redis.georadius(key, lng, lat, radiusKm, 'km')
  return result as string[]
}

export function resetRedis(): void {
  if (isMock('REDIS_URL')) (redis as unknown as import('../../mocks/redis.mock').RedisMock).reset()
}

export async function geoPosition(
  key: string,
  member: string
): Promise<{ lat: number; lng: number } | null> {
  const result = await redis.geopos(key, member)
  if (!result || !result[0]) return null
  const [lngStr, latStr] = result[0] as [string, string]
  return { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
}
