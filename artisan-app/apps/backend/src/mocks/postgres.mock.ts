import type { User, ArtisanProfile } from '@artisan/shared-types'
import type { Job } from '@artisan/shared-types'

// ── Seed data ────────────────────────────────────────────────────────────────

const USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr_admin_001',
    email: 'admin@artisan.dev',
    phone: '+39 000 0000001',
    name: 'Admin Artisan',
    role: 'admin',
    createdAt: new Date('2025-01-01'),
    passwordHash: '$2b$10$mock_hash_admin',
  },
  {
    id: 'usr_client_001',
    email: 'cliente@artisan.dev',
    phone: '+39 333 1234567',
    name: 'Mario Rossi',
    role: 'client',
    createdAt: new Date('2025-02-01'),
    passwordHash: '$2b$10$mock_hash_client',
  },
  {
    id: 'usr_artisan_001',
    email: 'artigiano@artisan.dev',
    phone: '+39 347 9876543',
    name: 'Luigi Bianchi',
    role: 'artisan',
    createdAt: new Date('2025-02-15'),
    passwordHash: '$2b$10$mock_hash_artisan',
  },
]

const ARTISAN_PROFILES: ArtisanProfile[] = [
  {
    userId: 'usr_artisan_001',
    category: 'idraulico',
    bio: 'Idraulico con 10 anni di esperienza, specializzato in impianti civili.',
    hourlyRate: 45,
    isVerified: true,
    rating: 4.8,
    reviewCount: 34,
    lat: 41.9028,
    lng: 12.4964,
    radiusKm: 20,
    stripeAccountId: 'acct_mock_123',
  },
]

const JOBS: (Job & { paymentStatus: string })[] = [
  {
    id: 'job_001',
    clientId: 'usr_client_001',
    artisanId: 'usr_artisan_001',
    title: 'Riparazione perdita sotto lavandino',
    description: 'Perdita dal sifone sotto il lavandino della cucina.',
    category: 'idraulico',
    address: 'Via Roma 10, Roma',
    lat: 41.8999,
    lng: 12.5000,
    scheduledAt: new Date('2025-06-01T10:00:00'),
    status: 'completed',
    estimatedPrice: 90,
    finalPrice: 85,
    createdAt: new Date('2025-05-28'),
    paymentStatus: 'completed',
  },
  {
    id: 'job_002',
    clientId: 'usr_client_001',
    title: 'Installazione nuovo rubinetto',
    description: 'Sostituire il miscelatore del bagno.',
    category: 'idraulico',
    address: 'Via Nazionale 55, Roma',
    lat: 41.9010,
    lng: 12.4950,
    scheduledAt: new Date('2025-07-15T09:00:00'),
    status: 'pending',
    estimatedPrice: 60,
    createdAt: new Date('2025-07-10'),
    paymentStatus: 'pending',
  },
]

// ── In-memory tables ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>

// Crea copie shallow dei seed — evita che INSERT muti gli array costanti
function freshTables(): Record<string, Row[]> {
  return {
    users:            USERS.map((u) => ({ ...u })) as Row[],
    artisan_profiles: ARTISAN_PROFILES.map((p) => ({ ...p })) as Row[],
    jobs:             JOBS.map((j) => ({ ...j })) as Row[],
    payments:         [],
  }
}

const tables: Record<string, Row[]> = freshTables()

// ── Minimal SQL parser ───────────────────────────────────────────────────────
// Supporta: SELECT * FROM t WHERE id=$1  /  INSERT INTO t(...) VALUES(...)  /  UPDATE / DELETE

let rowCounter = 1
function genId(): string {
  return `mock_${Date.now()}_${rowCounter++}`
}

function resolveParams(sql: string, params: unknown[]): string {
  let i = 0
  // Sostituisce $N con il valore corretto
  let out = sql.replace(/\$\d+/g, () => {
    const v = params[i++]
    if (v instanceof Date) return `'${v.toISOString()}'`
    return typeof v === 'string' ? `'${v}'` : String(v ?? 'null')
  })
  // Normalizza NOW()-INTERVAL '...' e NOW() → timestamp fisso parsable
  out = out.replace(/NOW\(\)\s*-\s*INTERVAL\s*'[^']+'/gi, `'${new Date().toISOString()}'`)
  out = out.replace(/NOW\(\)/gi, `'${new Date().toISOString()}'`)
  return out
}

// Estrae la lista di valori da una clausola VALUES gestendo parentesi annidate
function extractValuesList(valuesClause: string): string[] {
  // Rimuove parentesi esterne
  const inner = valuesClause.trim().replace(/^\(/, '').replace(/\)$/, '')
  const items: string[] = []
  let depth = 0
  let current = ''
  for (const ch of inner) {
    if (ch === ',' && depth === 0) {
      items.push(current.trim().replace(/^'|'$/g, ''))
      current = ''
    } else {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      current += ch
    }
  }
  if (current.trim()) items.push(current.trim().replace(/^'|'$/g, ''))
  return items
}

function parseWhere(whereClause: string, row: Row): boolean {
  const conditions = whereClause.split(/\s+AND\s+/i)
  return conditions.every((cond) => {
    const m = cond.trim().match(/^(\w+)\s*=\s*'?([^']*)'?$/)
    if (!m) return true
    return String(row[m[1]]) === m[2]
  })
}

export interface MockQueryResult<T = Row> {
  rows: T[]
  rowCount: number
}

export class PostgresMock {
  async query<T = Row>(sql: string, params: unknown[] = []): Promise<MockQueryResult<T>> {
    const resolved = resolveParams(sql.trim(), params)
    const upper = resolved.toUpperCase()

    // ── SELECT ──────────────────────────────────────────────────────────────
    if (upper.startsWith('SELECT')) {
      const tableMatch = resolved.match(/FROM\s+(\w+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].toLowerCase()
      const rows: Row[] = tables[table] ? [...tables[table]] : []

      const whereMatch = resolved.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i)
      const filtered = whereMatch
        ? rows.filter((r) => parseWhere(whereMatch[1], r))
        : rows

      const limitMatch = resolved.match(/LIMIT\s+(\d+)/i)
      const result = limitMatch ? filtered.slice(0, parseInt(limitMatch[1], 10)) : filtered

      return { rows: result as unknown as T[], rowCount: result.length }
    }

    // ── INSERT ──────────────────────────────────────────────────────────────
    if (upper.startsWith('INSERT')) {
      // Estrae tabella e colonne
      const colsMatch = resolved.match(/INTO\s+(\w+)\s*\(([^)]+)\)/i)
      if (!colsMatch) return { rows: [], rowCount: 0 }
      const table = colsMatch[1].toLowerCase()
      const cols = colsMatch[2].split(',').map((c) => c.trim())

      // Estrae il blocco VALUES(...) gestendo parentesi annidate
      const valuesStart = resolved.toUpperCase().indexOf('VALUES')
      if (valuesStart === -1) return { rows: [], rowCount: 0 }
      const afterValues = resolved.slice(valuesStart + 6).trim()
      let depth = 0; let end = 0
      for (let ci = 0; ci < afterValues.length; ci++) {
        if (afterValues[ci] === '(') depth++
        else if (afterValues[ci] === ')') { depth--; if (depth === 0) { end = ci; break } }
      }
      const valuesClause = afterValues.slice(0, end + 1)
      const vals = extractValuesList(valuesClause)

      const row: Row = {}
      cols.forEach((c, i) => { row[c] = vals[i] ?? null })

      // Genera id se non presente
      if (!row.id) row.id = genId()

      if (!tables[table]) tables[table] = []
      tables[table].push(row)

      // RETURNING: torna solo le colonne richieste
      const returningMatch = resolved.match(/RETURNING\s+(.+)$/i)
      if (returningMatch) {
        const retCols = returningMatch[1].split(',').map((c) => c.trim())
        if (retCols[0] === '*') return { rows: [row] as unknown as T[], rowCount: 1 }
        const partial: Row = {}
        retCols.forEach((c) => { partial[c] = row[c] })
        return { rows: [partial] as unknown as T[], rowCount: 1 }
      }

      return { rows: [row] as unknown as T[], rowCount: 1 }
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (upper.startsWith('UPDATE')) {
      // Estrae WHERE escludendo eventuale RETURNING alla fine
      const withoutRet = resolved.replace(/RETURNING\s+.+$/i, '').trim()
      const tableMatch = withoutRet.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].toLowerCase()
      const setPairs = tableMatch[2].split(',').map((s) => s.trim())
      const tableRows = tables[table] ?? []
      const updated: Row[] = []
      for (const row of tableRows) {
        if (parseWhere(tableMatch[3].trim(), row)) {
          for (const pair of setPairs) {
            const eqIdx = pair.indexOf('=')
            if (eqIdx === -1) continue
            const k = pair.slice(0, eqIdx).trim()
            const v = pair.slice(eqIdx + 1).trim().replace(/^'|'$/g, '')
            // Ignora NOW() — lascia il valore esistente
            if (v.toUpperCase().startsWith('NOW')) continue
            row[k] = v
          }
          updated.push(row)
        }
      }

      const returningMatch = resolved.match(/RETURNING\s+(.+)$/i)
      if (returningMatch && updated.length) {
        const retCols = returningMatch[1].split(',').map((c) => c.trim())
        const result = updated.map((row) => {
          if (retCols[0] === '*') return row
          const partial: Row = {}
          retCols.forEach((c) => { partial[c] = row[c] })
          return partial
        })
        return { rows: result as unknown as T[], rowCount: updated.length }
      }

      return { rows: updated as unknown as T[], rowCount: updated.length }
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (upper.startsWith('DELETE')) {
      const tableMatch = resolved.match(/FROM\s+(\w+)\s+WHERE\s+(.+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].toLowerCase()
      const before = tables[table]?.length ?? 0
      tables[table] = (tables[table] ?? []).filter((r) => !parseWhere(tableMatch[2], r))
      return { rows: [], rowCount: before - tables[table].length }
    }

    // SELECT 1 health check
    if (resolved.trim() === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }] as unknown as T[], rowCount: 1 }
    }

    return { rows: [], rowCount: 0 }
  }

  // ── helpers per i test ────────────────────────────────────────────────────

  getTable<T = Row>(name: string): T[] {
    return (tables[name] ?? []) as unknown as T[]
  }

  insertRaw(table: string, row: Row): void {
    if (!tables[table]) tables[table] = []
    tables[table].push(row)
  }

  reset(): void {
    const fresh = freshTables()
    Object.assign(tables, fresh)
  }
}
