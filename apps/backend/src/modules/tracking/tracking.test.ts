import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../../app'
import { initSocketIO } from '../../shared/socket'
import { resetDb } from '../../shared/db/postgres'
import { resetRedis } from '../../shared/db/redis'
import { TrackingService, GEOFENCE_RADIUS_M } from './tracking.service'
import { haversineKm, estimateEtaMinutes, isWithinRadius } from './geo.utils'

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'mock_jwt_secret_dev_only'

function makeToken(id: string, role: string) {
  return jwt.sign({ id, role }, SECRET)
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout "${event}"`)), timeoutMs)
    socket.once(event, (data: T) => { clearTimeout(t); resolve(data) })
  })
}

function connectSocket(url: string, token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token }, transports: ['websocket'] })
    s.once('connect', () => resolve(s))
    s.once('connect_error', reject)
  })
}

// ── Seed IDs (from postgres.mock.ts) ─────────────────────────────────────────

const CLIENT_ID  = 'usr_client_001'
const ARTISAN_ID = 'usr_artisan_001'
const JOB_ID     = 'job_001'   // lat: 41.8999, lng: 12.5000

const clientToken  = makeToken(CLIENT_ID,  'client')
const artisanToken = makeToken(ARTISAN_ID, 'artisan')

// ── Server setup ──────────────────────────────────────────────────────────────

let httpServer: ReturnType<typeof createServer>
let baseUrl: string
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  app        = createApp()
  httpServer = createServer(app)
  initSocketIO(httpServer)
  await new Promise<void>((res) => httpServer.listen(0, () => res()))
  const port = (httpServer.address() as { port: number }).port
  baseUrl    = `http://localhost:${port}`
})

afterAll(async () => {
  await new Promise<void>((res) => httpServer.close(() => res()))
})

beforeEach(() => {
  resetDb()
  resetRedis()
})

// ── geo.utils unit tests ──────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('punti identici → 0', () => {
    expect(haversineKm(41.9, 12.5, 41.9, 12.5)).toBe(0)
  })

  it('distanza Roma–Milano ≈ 477 km', () => {
    const d = haversineKm(41.9028, 12.4964, 45.4654, 9.1859)
    expect(d).toBeGreaterThan(470)
    expect(d).toBeLessThan(490)
  })

  it('1 grado di latitudine ≈ 111 km', () => {
    const d = haversineKm(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})

describe('estimateEtaMinutes', () => {
  it('0 km → 0 min', () => {
    expect(estimateEtaMinutes(0)).toBe(0)
  })

  it('30 km a 30 km/h → 60 min', () => {
    expect(estimateEtaMinutes(30, 30)).toBe(60)
  })

  it('1 km a 30 km/h → 2 min (arrotondato per eccesso)', () => {
    expect(estimateEtaMinutes(1, 30)).toBe(2)
  })

  it('usa velocità default 30 km/h', () => {
    expect(estimateEtaMinutes(15)).toBe(30)
  })
})

describe('isWithinRadius', () => {
  it('stesso punto → dentro qualsiasi raggio', () => {
    expect(isWithinRadius(41.9, 12.5, 41.9, 12.5, 500)).toBe(true)
  })

  it('punto a ~300m → dentro 500m', () => {
    // ~300m a nord (0.003 gradi lat ≈ 333m)
    expect(isWithinRadius(41.903, 12.5, 41.9, 12.5, 500)).toBe(true)
  })

  it('punto a ~2km → fuori 500m', () => {
    expect(isWithinRadius(41.918, 12.5, 41.9, 12.5, 500)).toBe(false)
  })
})

// ── TrackingService unit tests ────────────────────────────────────────────────

describe('TrackingService.updatePosition', () => {
  it('registra la posizione e ritorna distanceM e eta', async () => {
    const result = await TrackingService.updatePosition(
      ARTISAN_ID, JOB_ID, 41.9010, 12.4960, 5
    )
    expect(result.distanceM).toBeGreaterThanOrEqual(0)
    expect(result.eta).toBeGreaterThanOrEqual(0)
    expect(result.clientId).toBe(CLIENT_ID)
  })

  it('aggiorna la posizione leggibile via getLastPosition', async () => {
    await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.905, 12.498, 0)
    const pos = await TrackingService.getLastPosition(ARTISAN_ID)
    expect(pos).not.toBeNull()
    expect(pos!.lat).toBeCloseTo(41.905, 2)
    expect(pos!.lng).toBeCloseTo(12.498, 2)
  })

  it('ritorna clientId null per job inesistente', async () => {
    const result = await TrackingService.updatePosition(
      ARTISAN_ID, 'job_ghost', 41.9, 12.5, 0
    )
    expect(result.clientId).toBeNull()
    expect(result.distanceM).toBe(0)
  })
})

describe('TrackingService.getRoute — 10 aggiornamenti posizione', () => {
  it('registra 10 punti in ordine cronologico inverso (LIFO)', async () => {
    // Simula artigiano che si avvicina al job_001 (41.8999, 12.5000)
    // Partenza: 41.905 (circa 500m a nord), si avvicina di ~50m ogni step
    for (let i = 0; i < 10; i++) {
      const lat = 41.905 - i * 0.00045   // ~50m/step verso il job
      await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, lat, 12.5, 5)
    }

    const route = await TrackingService.getRoute(JOB_ID)
    expect(route).toHaveLength(10)

    // LPUSH → il più recente è in testa (indice 0)
    const first = route[0]
    const last  = route[9]
    expect(first.ts).toBeGreaterThanOrEqual(last.ts)
    // La distanza al job cresce andando in fondo alla lista
    const distFirst = haversineKm(first.lat, first.lng, 41.8999, 12.5)
    const distLast  = haversineKm(last.lat,  last.lng,  41.8999, 12.5)
    expect(distFirst).toBeLessThan(distLast)
  })

  it('non supera MAX_TRACK punti (capped a 500)', async () => {
    // Invia 510 punti
    for (let i = 0; i < 510; i++) {
      await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.9 + i * 0.0001, 12.5, 0)
    }
    const route = await TrackingService.getRoute(JOB_ID)
    expect(route.length).toBeLessThanOrEqual(500)
  })
})

describe('TrackingService.getLastPosition', () => {
  it('ritorna null se nessuna posizione registrata', async () => {
    const pos = await TrackingService.getLastPosition('usr_unknown')
    expect(pos).toBeNull()
  })
})

// ── REST API tests ─────────────────────────────────────────────────────────────

describe('GET /api/v1/tracking/:jobId/route', () => {
  it('ritorna il percorso (200)', async () => {
    await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.901, 12.499, 5)
    await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.900, 12.500, 5)

    const res = await request(app)
      .get(`/api/v1/tracking/${JOB_ID}/route`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.jobId).toBe(JOB_ID)
    expect(res.body.points).toHaveLength(2)
    expect(res.body.count).toBe(2)
  })

  it('ritorna array vuoto se nessun punto registrato', async () => {
    const res = await request(app)
      .get(`/api/v1/tracking/${JOB_ID}/route`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.points).toHaveLength(0)
  })

  it('lancia 401 senza token', async () => {
    const res = await request(app).get(`/api/v1/tracking/${JOB_ID}/route`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/tracking/:jobId/position', () => {
  it('ritorna ultima posizione artigiano (200)', async () => {
    await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.9005, 12.4995, 3)

    const res = await request(app)
      .get(`/api/v1/tracking/${JOB_ID}/position`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.artisanId).toBe(ARTISAN_ID)
    expect(res.body.lat).toBeCloseTo(41.9005, 2)
    expect(res.body.lng).toBeCloseTo(12.4995, 2)
  })

  it('lancia 404 se posizione non disponibile', async () => {
    const res = await request(app)
      .get(`/api/v1/tracking/${JOB_ID}/position`)
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(404)
  })

  it('lancia 403 se non sei un partecipante', async () => {
    await TrackingService.updatePosition(ARTISAN_ID, JOB_ID, 41.9, 12.5, 0)
    const otherToken = makeToken('usr_other_999', 'client')

    const res = await request(app)
      .get(`/api/v1/tracking/${JOB_ID}/position`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(403)
  })
})

// ── WebSocket gateway tests ───────────────────────────────────────────────────

describe('WebSocket: update_location → artisan_location', () => {
  it('il client riceve artisan_location con eta e distanceM', async () => {
    const artisanSocket = await connectSocket(baseUrl, artisanToken)
    const clientSocket  = await connectSocket(baseUrl, clientToken)

    // Il client entra nel job room
    clientSocket.emit('join_job', JOB_ID)

    const locationEvent = waitFor<{
      lat: number; lng: number; eta: number; distanceM: number
    }>(clientSocket, 'artisan_location')

    artisanSocket.emit('update_location', {
      jobId: JOB_ID,
      lat:   41.9010,
      lng:   12.4960,
      accuracy: 5,
    })

    const event = await locationEvent
    expect(event.lat).toBeCloseTo(41.9010, 3)
    expect(event.lng).toBeCloseTo(12.4960, 3)
    expect(typeof event.eta).toBe('number')
    expect(typeof event.distanceM).toBe('number')

    artisanSocket.disconnect()
    clientSocket.disconnect()
  })

  it('simula 10 aggiornamenti live e il client li riceve tutti', async () => {
    const artisanSocket = await connectSocket(baseUrl, artisanToken)
    const clientSocket  = await connectSocket(baseUrl, clientToken)

    clientSocket.emit('join_job', JOB_ID)

    const received: { lat: number; distanceM: number }[] = []

    await new Promise<void>((resolve) => {
      clientSocket.on('artisan_location', (data: { lat: number; distanceM: number }) => {
        received.push(data)
        if (received.length === 10) resolve()
      })

      // Artigiano si avvicina al job (41.8999, 12.5000) in 10 step
      for (let i = 0; i < 10; i++) {
        const lat = 41.905 - i * 0.00045
        artisanSocket.emit('update_location', { jobId: JOB_ID, lat, lng: 12.5 })
      }
    })

    expect(received).toHaveLength(10)
    // Distanza deve diminuire man mano che ci si avvicina
    expect(received[0].distanceM).toBeGreaterThan(received[9].distanceM)

    artisanSocket.disconnect()
    clientSocket.disconnect()
  })
})

describe('WebSocket: geofencing artisan_nearby', () => {
  it(`emette artisan_nearby quando artigiano è a < ${GEOFENCE_RADIUS_M}m`, async () => {
    const artisanSocket = await connectSocket(baseUrl, artisanToken)
    const clientSocket  = await connectSocket(baseUrl, clientToken)

    // Il client entra nella propria room per ricevere artisan_nearby
    clientSocket.emit('join_job', JOB_ID)

    // Creiamo uno spy sulla room client tramite WS
    // job_001 destination: lat 41.8999, lng 12.5000
    // A 100m ≈ 0.0009 gradi lat
    const nearbyEvent = waitFor<{ distanceM: number }>(clientSocket, 'artisan_nearby', 4000)

    // Artigiano molto vicino: stessa posizione del job
    artisanSocket.emit('update_location', {
      jobId: JOB_ID,
      lat:   41.8999,
      lng:   12.5000,
      accuracy: 2,
    })

    const nearby = await nearbyEvent
    expect(nearby.distanceM).toBeLessThan(GEOFENCE_RADIUS_M)

    artisanSocket.disconnect()
    clientSocket.disconnect()
  })
})
