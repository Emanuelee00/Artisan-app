interface Entry {
  value: string
  expiresAt?: number // ms timestamp
}

interface GeoEntry {
  member: string
  lat: number
  lng: number
}

const store = new Map<string, Entry>()
const geoStore = new Map<string, GeoEntry[]>()

function isExpired(e: Entry): boolean {
  return e.expiresAt !== undefined && Date.now() > e.expiresAt
}

function live(key: string): Entry | undefined {
  const e = store.get(key)
  if (!e) return undefined
  if (isExpired(e)) { store.delete(key); return undefined }
  return e
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export class RedisMock {
  // ── string ops ─────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return live(key)?.value ?? null
  }

  async set(key: string, value: string): Promise<'OK'> {
    store.set(key, { value })
    return 'OK'
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    store.set(key, { value, expiresAt: Date.now() + seconds * 1000 })
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0
    for (const k of keys) if (store.delete(k)) count++
    return count
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter((k) => live(k) !== undefined).length
  }

  async expire(key: string, seconds: number): Promise<0 | 1> {
    const e = live(key)
    if (!e) return 0
    store.set(key, { ...e, expiresAt: Date.now() + seconds * 1000 })
    return 1
  }

  async incr(key: string): Promise<number> {
    const e = live(key)
    const n = parseInt(e?.value ?? '0', 10) + 1
    store.set(key, { value: String(n), expiresAt: e?.expiresAt })
    return n
  }

  // ── hash ops ────────────────────────────────────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<number> {
    const e = live(key)
    const obj: Record<string, string> = e ? JSON.parse(e.value) : {}
    const isNew = !(field in obj)
    obj[field] = value
    store.set(key, { value: JSON.stringify(obj) })
    return isNew ? 1 : 0
  }

  async hget(key: string, field: string): Promise<string | null> {
    const e = live(key)
    if (!e) return null
    const obj: Record<string, string> = JSON.parse(e.value)
    return obj[field] ?? null
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const e = live(key)
    if (!e) return null
    return JSON.parse(e.value) as Record<string, string>
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const e = live(key)
    if (!e) return 0
    const obj: Record<string, string> = JSON.parse(e.value)
    let count = 0
    for (const f of fields) if (f in obj) { delete obj[f]; count++ }
    store.set(key, { value: JSON.stringify(obj) })
    return count
  }

  // ── list ops ────────────────────────────────────────────────────────────────

  async lpush(key: string, ...values: string[]): Promise<number> {
    const e = live(key)
    const arr: string[] = e ? JSON.parse(e.value) : []
    arr.unshift(...values.reverse())
    store.set(key, { value: JSON.stringify(arr) })
    return arr.length
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const e = live(key)
    if (!e) return []
    const arr: string[] = JSON.parse(e.value)
    const end = stop === -1 ? arr.length : stop + 1
    return arr.slice(start, end)
  }

  // ── geo ops ─────────────────────────────────────────────────────────────────

  async geoadd(key: string, lng: number, lat: number, member: string): Promise<number> {
    const entries = geoStore.get(key) ?? []
    const existing = entries.findIndex((e) => e.member === member)
    if (existing >= 0) {
      entries[existing] = { member, lat, lng }
      return 0
    }
    entries.push({ member, lat, lng })
    geoStore.set(key, entries)
    return 1
  }

  async georadius(
    key: string,
    lng: number,
    lat: number,
    radius: number,
    unit: 'km' | 'm' | 'mi' | 'ft' = 'km'
  ): Promise<string[]> {
    const entries = geoStore.get(key) ?? []
    const radiusKm =
      unit === 'km' ? radius
      : unit === 'm'  ? radius / 1000
      : unit === 'mi' ? radius * 1.60934
      : radius * 0.0003048

    return entries
      .filter((e) => haversineKm(lat, lng, e.lat, e.lng) <= radiusKm)
      .map((e) => e.member)
  }

  async geopos(key: string, ...members: string[]): Promise<([number, number] | null)[]> {
    const entries = geoStore.get(key) ?? []
    return members.map((m) => {
      const e = entries.find((x) => x.member === m)
      return e ? [e.lng, e.lat] : null
    })
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  async ping(): Promise<'PONG'> {
    return 'PONG'
  }

  async quit(): Promise<'OK'> {
    return 'OK'
  }

  // ioredis compatibility: event emitter no-ops
  on(_event: string, _handler: (...args: unknown[]) => void): this { return this }
  off(_event: string, _handler: (...args: unknown[]) => void): this { return this }

  reset(): void {
    store.clear()
    geoStore.clear()
  }
}
