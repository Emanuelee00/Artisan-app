import { query } from '../../shared/db/postgres'

export const JobModel = {
  async create(data: {
    clientId: string; title: string; description: string
    category: string; address: string; lat: number; lng: number; scheduledAt: Date
  }) {
    const rows = await query(
      `INSERT INTO jobs (client_id, title, description, category, address, lat, lng, scheduled_at, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW()) RETURNING *`,
      [data.clientId, data.title, data.description, data.category,
       data.address, data.lat, data.lng, data.scheduledAt]
    )
    return rows[0]
  },

  async findById(id: string) {
    const rows = await query('SELECT * FROM jobs WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async updateStatus(id: string, status: string, artisanId?: string) {
    const rows = await query(
      `UPDATE jobs SET status = $1, artisan_id = COALESCE($2, artisan_id), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, artisanId, id]
    )
    return rows[0]
  },

  async findByClient(clientId: string) {
    return query('SELECT * FROM jobs WHERE client_id = $1 ORDER BY created_at DESC', [clientId])
  },
}
