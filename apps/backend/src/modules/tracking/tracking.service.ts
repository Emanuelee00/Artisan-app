import { redis, geoAdd, geoPosition } from '../../shared/db/redis'
import { updateArtisanLocation } from '../jobs/jobs.matching'
import { haversineKm, estimateEtaMinutes } from './geo.utils'
import { query } from '../../shared/db/postgres'
import { logger } from '../../shared/logger'

// ── Constants ────────────────────────────────────────────────────────────────

export const GEO_KEY   = 'artisans:geo'
export const MAX_TRACK = 500
export const GEOFENCE_RADIUS_M = 500

export interface TrackPoint {
  lat:      number
  lng:      number
  accuracy: number
  ts:       number
}

export interface PositionResult {
  distanceM: number
  eta:       number
  clientId:  string | null
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getJobMeta(jobId: string): Promise<{ lat: number; lng: number; clientId: string } | null> {
  const rows = await query<{ lat: unknown; lng: unknown; client_id: string }>(
    'SELECT lat, lng, client_id FROM jobs WHERE id = $1',
    [jobId]
  )
  if (!rows[0] || rows[0].lat == null) return null
  return {
    lat:      Number(rows[0].lat),
    lng:      Number(rows[0].lng),
    clientId: rows[0].client_id,
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export const TrackingService = {
  async updatePosition(
    artisanId: string,
    jobId: string,
    lat: number,
    lng: number,
    accuracy = 0
  ): Promise<PositionResult> {
    // 1. Update GEO index + online TTL (300s = 5min)
    await updateArtisanLocation(artisanId, lat, lng)

    // 2. Append to track history, keep max MAX_TRACK points
    const point: TrackPoint = { lat, lng, accuracy, ts: Date.now() }
    const trackKey = `job:track:${jobId}`
    await redis.lpush(trackKey, JSON.stringify(point))
    await (redis as unknown as { ltrim(k: string, s: number, e: number): Promise<unknown> })
      .ltrim(trackKey, 0, MAX_TRACK - 1)

    // 3. Compute distance + ETA to job destination
    const dest = await getJobMeta(jobId)
    if (!dest) return { distanceM: 0, eta: 0, clientId: null }

    const distKm   = haversineKm(lat, lng, dest.lat, dest.lng)
    const distanceM = Math.round(distKm * 1000)
    const eta      = estimateEtaMinutes(distKm)

    logger.debug(`Tracking job=${jobId} artisan=${artisanId} dist=${distanceM}m eta=${eta}min`)

    return { distanceM, eta, clientId: dest.clientId }
  },

  async getRoute(jobId: string): Promise<TrackPoint[]> {
    const raw = await redis.lrange(`job:track:${jobId}`, 0, -1)
    return raw.map((r) => JSON.parse(r) as TrackPoint)
  },

  async getLastPosition(artisanId: string): Promise<{ lat: number; lng: number } | null> {
    return geoPosition(GEO_KEY, artisanId)
  },

  async getDistanceBetween(member1: string, member2: string): Promise<number | null> {
    const raw = await (redis as unknown as {
      geodist(k: string, m1: string, m2: string, u: string): Promise<string | null>
    }).geodist(GEO_KEY, member1, member2, 'm')
    return raw !== null ? parseFloat(raw) : null
  },
}
