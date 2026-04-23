import { redis, geoAdd, geoRadius } from '../../shared/db/redis'
import { JobModel, type ArtisanMatchRow } from './jobs.model'
import { isMock } from '../../config/env'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArtisanMatch {
  artisanId:           string
  name:                string
  category:            string
  rating:              number
  reviewCount:         number
  isVerified:          boolean
  distanceKm:          number
  estimatedArrivalMin: number
  score:               number
}

// ── Haversine (used when Redis geo is unavailable) ───────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Scoring ──────────────────────────────────────────────────────────────────
//
// score = distScore * 0.4 + ratingScore * 0.4 + responseScore * 0.2
//
// distScore     = 1 / (1 + distKm)       → closer = higher
// ratingScore   = rating / 5             → 0-1 normalized
// responseScore = 1 / (1 + avgRespMin)   → faster = higher (default: online=5m, offline=15m)

function computeScore(distKm: number, rating: number, avgRespMin: number): number {
  const distScore     = 1 / (1 + distKm)
  const ratingScore   = rating / 5
  const responseScore = 1 / (1 + avgRespMin)
  return distScore * 0.4 + ratingScore * 0.4 + responseScore * 0.2
}

function buildMatch(
  row: ArtisanMatchRow,
  distKm: number,
  avgRespMin: number
): ArtisanMatch {
  return {
    artisanId:           row.user_id,
    name:                row.name,
    category:            row.category,
    rating:              Number(row.rating),
    reviewCount:         Number(row.review_count),
    isVerified:          Boolean(row.is_verified),
    distanceKm:          Math.round(distKm * 10) / 10,
    estimatedArrivalMin: Math.ceil((distKm / 30) * 60),   // 30 km/h city average
    score:               Math.round(computeScore(distKm, Number(row.rating), avgRespMin) * 1000) / 1000,
  }
}

// ── Redis-based matching (real mode) ─────────────────────────────────────────

async function matchViaRedis(
  lat: number,
  lng: number,
  category: string,
  radiusKm: number
): Promise<ArtisanMatch[]> {
  const nearbyIds = await geoRadius('artisans:geo', lat, lng, radiusKm)
  if (!nearbyIds.length) return []

  // Load artisan profiles for these IDs from postgres
  const allArtisans = await JobModel.findArtisansForMatching(category)
  const profileMap = new Map(allArtisans.map((a) => [a.user_id, a]))

  const matches: ArtisanMatch[] = []

  for (const artisanId of nearbyIds) {
    const profile = profileMap.get(artisanId)
    if (!profile || !profile.lat || !profile.lng) continue

    const distKm = haversineKm(lat, lng, Number(profile.lat), Number(profile.lng))
    if (distKm > radiusKm) continue

    // Check online status in Redis (set via tracking gateway)
    const isOnline   = await redis.get(`artisan:online:${artisanId}`)
    const avgRespMin = isOnline ? 5 : 15

    matches.push(buildMatch(profile, distKm, avgRespMin))
  }

  return matches
}

// ── Postgres-based matching (mock / fallback) ────────────────────────────────

async function matchViaPostgres(
  lat: number,
  lng: number,
  category: string,
  radiusKm: number
): Promise<ArtisanMatch[]> {
  const artisans = await JobModel.findArtisansForMatching(category)
  const matches: ArtisanMatch[] = []

  for (const profile of artisans) {
    if (profile.lat === null || profile.lng === null) continue

    const distKm = haversineKm(lat, lng, Number(profile.lat), Number(profile.lng))

    // Respect artisan's own service radius too
    const effectiveRadius = Math.min(radiusKm, Number(profile.radius_km))
    if (distKm > effectiveRadius) continue

    matches.push(buildMatch(profile, distKm, 10))
  }

  return matches
}

// ── Public API ───────────────────────────────────────────────────────────────

export const TOP_N = 5

export async function computeMatches(
  lat: number,
  lng: number,
  category: string,
  radiusKm = 20
): Promise<ArtisanMatch[]> {
  let matches: ArtisanMatch[]

  if (isMock('REDIS_URL')) {
    // Mock mode: use only postgres profiles
    matches = await matchViaPostgres(lat, lng, category, radiusKm)
  } else {
    // Real mode: use Redis GEO, fallback to postgres if GEO has no entries
    matches = await matchViaRedis(lat, lng, category, radiusKm)
    if (!matches.length) {
      matches = await matchViaPostgres(lat, lng, category, radiusKm)
    }
  }

  // Sort by score descending, return top N
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
}

// ── Location update (called by tracking gateway) ─────────────────────────────

export async function updateArtisanLocation(
  artisanId: string,
  lat: number,
  lng: number
): Promise<void> {
  await geoAdd('artisans:geo', lat, lng, artisanId)
  await redis.setex(`artisan:online:${artisanId}`, 300, '1')
}
