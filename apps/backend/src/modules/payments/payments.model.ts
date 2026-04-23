import { query } from '../../shared/db/postgres'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface PaymentRow {
  id:                       string
  job_id:                   string
  client_id:                string
  artisan_id:               string
  amount:                   number  // centesimi
  platform_fee:             number
  artisan_payout:           number
  currency:                 string
  status:                   PaymentStatus
  stripe_payment_intent_id: string | null
  created_at:               Date
}

export const PaymentModel = {
  async create(data: {
    jobId:                  string
    clientId:               string
    artisanId:              string
    amount:                 number
    platformFee:            number
    artisanPayout:          number
    currency:               string
    stripePaymentIntentId?: string
  }): Promise<PaymentRow> {
    const rows = await query<PaymentRow>(
      `INSERT INTO payments
         (job_id, client_id, artisan_id, amount, platform_fee, artisan_payout,
          currency, status, stripe_payment_intent_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,NOW())
       RETURNING *`,
      [
        data.jobId, data.clientId, data.artisanId,
        data.amount, data.platformFee, data.artisanPayout,
        data.currency, data.stripePaymentIntentId ?? null,
      ]
    )
    return rows[0]
  },

  async findById(id: string): Promise<PaymentRow | null> {
    const rows = await query<PaymentRow>('SELECT * FROM payments WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async findByIntentId(intentId: string): Promise<PaymentRow | null> {
    const rows = await query<PaymentRow>(
      'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
      [intentId]
    )
    return rows[0] ?? null
  },

  async findByJobId(jobId: string): Promise<PaymentRow | null> {
    const rows = await query<PaymentRow>(
      'SELECT * FROM payments WHERE job_id = $1',
      [jobId]
    )
    return rows[0] ?? null
  },

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentRow | null> {
    const rows = await query<PaymentRow>(
      `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    )
    return rows[0] ?? null
  },

  async updateStatusByIntentId(intentId: string, status: PaymentStatus): Promise<PaymentRow | null> {
    const rows = await query<PaymentRow>(
      `UPDATE payments SET status = $1 WHERE stripe_payment_intent_id = $2 RETURNING *`,
      [status, intentId]
    )
    return rows[0] ?? null
  },

  async findByUser(userId: string, role: 'client' | 'artisan'): Promise<PaymentRow[]> {
    const col = role === 'client' ? 'client_id' : 'artisan_id'
    return query<PaymentRow>(
      `SELECT * FROM payments WHERE ${col} = $1 ORDER BY created_at DESC`,
      [userId]
    )
  },

  async findAll(): Promise<PaymentRow[]> {
    return query<PaymentRow>('SELECT * FROM payments ORDER BY created_at DESC', [])
  },
}
