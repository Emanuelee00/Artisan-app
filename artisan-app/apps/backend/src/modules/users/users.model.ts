import { query } from '../../shared/db/postgres'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string
  phone: string
  role: 'client' | 'artisan' | 'admin'
  avatar_url: string | null
  fcm_token: string | null
  created_at: Date
  updated_at: Date
}

export interface ArtisanProfileRow {
  user_id: string
  category: string
  bio: string | null
  hourly_rate: number | null
  is_verified: boolean
  rating: number
  review_count: number
  lat: number | null
  lng: number | null
  radius_km: number
  stripe_account_id: string | null
  created_at: Date
}

export const UserModel = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = await query<UserRow>('SELECT * FROM users WHERE email = $1', [email])
    return rows[0] ?? null
  },

  async findById(id: string): Promise<UserRow | null> {
    const rows = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async create(data: {
    email: string
    passwordHash: string
    name: string
    phone: string
    role: string
  }): Promise<UserRow> {
    const rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.email, data.passwordHash, data.name, data.phone, data.role]
    )
    return rows[0]
  },

  async update(
    id: string,
    data: { name?: string; phone?: string; avatarUrl?: string; fcmToken?: string }
  ): Promise<UserRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let n = 1

    if (data.name      !== undefined) { sets.push(`name = $${n++}`);       params.push(data.name) }
    if (data.phone     !== undefined) { sets.push(`phone = $${n++}`);      params.push(data.phone) }
    if (data.avatarUrl !== undefined) { sets.push(`avatar_url = $${n++}`); params.push(data.avatarUrl) }
    if (data.fcmToken  !== undefined) { sets.push(`fcm_token = $${n++}`);  params.push(data.fcmToken) }

    if (!sets.length) return UserModel.findById(id)

    sets.push(`updated_at = NOW()`)
    params.push(id)

    const rows = await query<UserRow>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`,
      params
    )
    return rows[0] ?? null
  },

  async createArtisanProfile(data: {
    userId: string
    category: string
    bio?: string
    hourlyRate?: number
    lat?: number
    lng?: number
    radiusKm?: number
    stripeAccountId: string
  }): Promise<ArtisanProfileRow> {
    const rows = await query<ArtisanProfileRow>(
      `INSERT INTO artisan_profiles
         (user_id, category, bio, hourly_rate, lat, lng, radius_km,
          stripe_account_id, is_verified, rating, review_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 0, 0) RETURNING *`,
      [data.userId, data.category, data.bio ?? null, data.hourlyRate ?? null,
       data.lat ?? null, data.lng ?? null, data.radiusKm ?? 20, data.stripeAccountId]
    )
    return rows[0]
  },

  async findArtisanProfile(userId: string): Promise<ArtisanProfileRow | null> {
    const rows = await query<ArtisanProfileRow>(
      'SELECT * FROM artisan_profiles WHERE user_id = $1',
      [userId]
    )
    return rows[0] ?? null
  },

  async updateArtisanProfile(
    userId: string,
    data: { bio?: string; hourlyRate?: number; lat?: number; lng?: number; radiusKm?: number }
  ): Promise<ArtisanProfileRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let n = 1

    if (data.bio        !== undefined) { sets.push(`bio = $${n++}`);          params.push(data.bio) }
    if (data.hourlyRate !== undefined) { sets.push(`hourly_rate = $${n++}`);  params.push(data.hourlyRate) }
    if (data.lat        !== undefined) { sets.push(`lat = $${n++}`);          params.push(data.lat) }
    if (data.lng        !== undefined) { sets.push(`lng = $${n++}`);          params.push(data.lng) }
    if (data.radiusKm   !== undefined) { sets.push(`radius_km = $${n++}`);    params.push(data.radiusKm) }

    if (!sets.length) return UserModel.findArtisanProfile(userId)

    params.push(userId)
    const rows = await query<ArtisanProfileRow>(
      `UPDATE artisan_profiles SET ${sets.join(', ')} WHERE user_id = $${n} RETURNING *`,
      params
    )
    return rows[0] ?? null
  },
}
