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
