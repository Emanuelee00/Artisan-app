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
