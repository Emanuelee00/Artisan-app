import { query } from '../../shared/db/postgres'
import type { CreateJobDto } from './jobs.schema'

export type JobStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'

export interface JobRow {
  id:              string
  client_id:       string
  artisan_id:      string | null
  title:           string
  description:     string
  category:        string
  address:         string
  lat:             number
  lng:             number
  status:          JobStatus
  scheduled_at:    Date | null
  estimated_price: number | null
  final_price:     number | null
  created_at:      Date
  updated_at:      Date
}

export interface ArtisanMatchRow {
  user_id:           string
  name:              string
  category:          string
  rating:            number
  review_count:      number
  is_verified:       boolean
  lat:               number | null
  lng:               number | null
  radius_km:         number
  stripe_account_id: string | null
}

export const JobModel = {
  async create(data: CreateJobDto & { clientId: string }): Promise<JobRow> {
    const rows = await query<JobRow>(
      `INSERT INTO jobs
         (client_id, artisan_id, title, description, category, address, lat, lng,
          scheduled_at, estimated_price, status, created_at, updated_at)
       VALUES ($1,null,$2,$3,$4,$5,$6,$7,$8,$9,'pending',NOW(),NOW())
       RETURNING *`,
      [
        data.clientId, data.title, data.description, data.category,
        data.address, data.lat, data.lng,
        data.scheduledAt ? new Date(data.scheduledAt) : null,
        data.estimatedPrice ?? null,
      ]
    )
    return rows[0]
  },

  async findById(id: string): Promise<JobRow | null> {
    const rows = await query<JobRow>('SELECT * FROM jobs WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async findAll(filters: {
    clientId?:  string
    artisanId?: string
    status?:    string
    category?:  string
  }): Promise<JobRow[]> {
    const conds: string[] = []
    const params: unknown[] = []
    let n = 1

    if (filters.clientId)  { conds.push(`client_id = $${n++}`);  params.push(filters.clientId) }
    if (filters.artisanId) { conds.push(`artisan_id = $${n++}`); params.push(filters.artisanId) }
    if (filters.status)    { conds.push(`status = $${n++}`);     params.push(filters.status) }
    if (filters.category)  { conds.push(`category = $${n++}`);   params.push(filters.category) }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    return query<JobRow>(`SELECT * FROM jobs ${where} ORDER BY created_at DESC`, params)
  },

  async updateStatus(
    id: string,
    status: JobStatus,
    extra?: { artisanId?: string; finalPrice?: number }
  ): Promise<JobRow | null> {
    const sets = ['status = $1', 'updated_at = NOW()']
    const params: unknown[] = [status]
    let n = 2

    if (extra?.artisanId !== undefined) {
      sets.push(`artisan_id = $${n++}`)
      params.push(extra.artisanId)
    }
    if (extra?.finalPrice !== undefined) {
      sets.push(`final_price = $${n++}`)
      params.push(extra.finalPrice)
    }

    params.push(id)
    const rows = await query<JobRow>(
      `UPDATE jobs SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`,
      params
    )
    return rows[0] ?? null
  },

  // Returns artisan profiles for matching — split into two queries for mock compatibility
  async findArtisansForMatching(category: string): Promise<ArtisanMatchRow[]> {
    const profiles = await query<Omit<ArtisanMatchRow, 'name'>>(
      `SELECT user_id, category, rating, review_count, is_verified,
              lat, lng, radius_km, stripe_account_id
       FROM artisan_profiles WHERE category = $1`,
      [category]
    )
    if (!profiles.length) return []

    // Fetch names separately to avoid JOIN (mock parser doesn't support it)
    const users = await query<{ id: string; name: string }>(
      `SELECT id, name FROM users WHERE role = $1`,
      ['artisan']
    )
    const nameMap = new Map(users.map((u) => [u.id as string, u.name as string]))

    return profiles
      .filter((p) => p.lat !== null && p.lng !== null)
      .map((p) => ({ ...p, name: nameMap.get(p.user_id) ?? '' }))
  },
}
