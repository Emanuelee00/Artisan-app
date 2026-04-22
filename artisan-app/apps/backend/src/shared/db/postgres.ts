import { Pool, PoolClient } from 'pg'
import { env, isMock } from '../../config/env'
import { logger } from '../logger'
import { PostgresMock } from '../../mocks/postgres.mock'

const pgMock = new PostgresMock()

interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>
}

const realPool = isMock('DATABASE_URL') ? null : new Pool({ connectionString: env.DATABASE_URL })

export const pool: Queryable = isMock('DATABASE_URL') ? pgMock : realPool!

export async function connectPostgres(): Promise<void> {
  await pool.query('SELECT 1')
  logger.info(`PostgreSQL ${isMock('DATABASE_URL') ? '[MOCK]' : ''} connesso`)
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(sql, params)
  return result.rows
}

export function resetDb(): void {
  if (isMock('DATABASE_URL')) (pgMock as PostgresMock).reset()
}

export async function transaction<T>(
  fn: (q: <R extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  if (isMock('DATABASE_URL')) {
    // In mock mode non ci sono transazioni reali — esegue direttamente
    return fn(query)
  }

  const client: PoolClient = await realPool!.connect()
  try {
    await client.query('BEGIN')
    const clientQuery = async <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): Promise<R[]> => {
      const res = await client.query<R>(sql, params)
      return res.rows
    }
    const result = await fn(clientQuery)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
