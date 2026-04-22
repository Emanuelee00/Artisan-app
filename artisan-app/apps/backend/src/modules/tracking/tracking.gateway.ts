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
