import jwt from 'jsonwebtoken'
import { Server as SocketServer, Socket } from 'socket.io'
import { env } from '../../config/env'
import { TrackingService, GEOFENCE_RADIUS_M } from './tracking.service'
import { isWithinRadius } from './geo.utils'
import { logger } from '../../shared/logger'

interface AuthSocket extends Socket {
  userId?:   string
  userRole?: string
}

function extractUser(token: string): { id: string; role: string } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
  } catch {
    return null
  }
}

// ── Gateway ──────────────────────────────────────────────────────────────────

export function initTrackingGateway(io: SocketServer) {
  io.on('connection', (socket: AuthSocket) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (token) {
      const user = extractUser(token)
      if (user) { socket.userId = user.id; socket.userRole = user.role }
    }

    // ── update_location { jobId, lat, lng, accuracy? } ─────────────────────
    socket.on('update_location', async (data: {
      jobId:     string
      lat:       number
      lng:       number
      accuracy?: number
    }) => {
      try {
        const artisanId = socket.userId
        if (!artisanId) { socket.emit('error', { message: 'Non autenticato' }); return }

        const result = await TrackingService.updatePosition(
          artisanId,
          data.jobId,
          data.lat,
          data.lng,
          data.accuracy ?? 0
        )

        // Broadcast posizione a tutti i client connessi al job
        io.to(`job:${data.jobId}`).emit('artisan_location', {
          lat:       data.lat,
          lng:       data.lng,
          eta:       result.eta,
          distanceM: result.distanceM,
        })

        // Geofencing: notifica cliente quando artigiano è a < 500m (incluso 0)
        if (result.clientId && result.distanceM < GEOFENCE_RADIUS_M) {
          io.to(`client:${result.clientId}`).emit('artisan_nearby', {
            jobId:     data.jobId,
            distanceM: result.distanceM,
            eta:       result.eta,
          })
        }
      } catch (err) {
        logger.error('update_location error', err)
        socket.emit('error', { message: 'Errore aggiornamento posizione' })
      }
    })
  })
}
