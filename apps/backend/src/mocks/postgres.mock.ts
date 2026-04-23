// ── Seed data (snake_case to match real PostgreSQL column names) ───────────────

type Row = Record<string, unknown>

const USERS: Row[] = [
  {
    id:            'usr_admin_001',
    email:         'admin@artisan.dev',
    phone:         '+39 000 0000001',
    name:          'Admin Artisan',
    role:          'admin',
    password_hash: '$2b$12$mock_hash_admin_placeholder_xx',
    avatar_url:    null,
    fcm_token:     null,
    created_at:    new Date('2025-01-01'),
    updated_at:    new Date('2025-01-01'),
  },
  {
    id:            'usr_client_001',
    email:         'cliente@artisan.dev',
    phone:         '+39 333 1234567',
    name:          'Mario Rossi',
    role:          'client',
    password_hash: '$2b$12$mock_hash_client_placeholder_x',
    avatar_url:    null,
    fcm_token:     null,
    created_at:    new Date('2025-02-01'),
    updated_at:    new Date('2025-02-01'),
  },
  {
    id:            'usr_artisan_001',
    email:         'artigiano@artisan.dev',
    phone:         '+39 347 9876543',
    name:          'Luigi Bianchi',
    role:          'artisan',
    password_hash: '$2b$12$mock_hash_artisan_placeholder',
    avatar_url:    null,
    fcm_token:     null,
    created_at:    new Date('2025-02-15'),
    updated_at:    new Date('2025-02-15'),
  },
]

const ARTISAN_PROFILES: Row[] = [
  {
    user_id:           'usr_artisan_001',
    category:          'idraulico',
    bio:               'Idraulico con 10 anni di esperienza, specializzato in impianti civili.',
    hourly_rate:       45,
    is_verified:       true,
    rating:            4.8,
    review_count:      34,
    lat:               41.9028,
    lng:               12.4964,
    radius_km:         20,
    stripe_account_id: 'acct_mock_usr_artisan_001',
    created_at:        new Date('2025-02-15'),
  },
]

const JOBS: Row[] = [
  {
    id:              'job_001',
    client_id:       'usr_client_001',
    artisan_id:      'usr_artisan_001',
    title:           'Riparazione perdita sotto lavandino',
    description:     'Perdita dal sifone sotto il lavandino della cucina.',
    category:        'idraulico',
    address:         'Via Roma 10, Roma',
    lat:             41.8999,
    lng:             12.5000,
    scheduled_at:    new Date('2025-06-01T10:00:00'),
    status:          'completed',
    estimated_price: 90,
    final_price:     85,
    payment_status:  'completed',
    created_at:      new Date('2025-05-28'),
    updated_at:      new Date('2025-06-01'),
  },
  {
    id:              'job_002',
    client_id:       'usr_client_001',
    artisan_id:      null,
    title:           'Installazione nuovo rubinetto',
    description:     'Sostituire il miscelatore del bagno.',
    category:        'idraulico',
    address:         'Via Nazionale 55, Roma',
    lat:             41.9010,
    lng:             12.4950,
    scheduled_at:    new Date('2025-07-15T09:00:00'),
    status:          'pending',
    estimated_price: 60,
    final_price:     null,
    payment_status:  'pending',
    created_at:      new Date('2025-07-10'),
    updated_at:      new Date('2025-07-10'),
  },
]

// ── In-memory tables ──────────────────────────────────────────────────────────

function freshTables(): Record<string, Row[]> {
  return {
    users:            USERS.map((u) => ({ ...u })),
    artisan_profiles: ARTISAN_PROFILES.map((p) => ({ ...p })),
    jobs:             JOBS.map((j) => ({ ...j })),
    payments:         [],
    invoices:         [],
  }
}

const tables: Record<string, Row[]> = freshTables()

// ── Minimal SQL parser ────────────────────────────────────────────────────────

let rowCounter = 1
function genId(): string {
  return `mock_${Date.now()}_${rowCounter++}`
}

function resolveParams(sql: string, params: unknown[]): string {
  let i = 0
  let out = sql.replace(/\$\d+/g, () => {
    const v = params[i++]
    if (v === null || v === undefined) return 'null'
    if (v instanceof Date) return `'${v.toISOString()}'`
    if (typeof v === 'number') return String(v)
    if (typeof v === 'boolean') return String(v)
    return `'${String(v).replace(/'/g, "''")}'`
  })
  out = out.replace(/NOW\(\)\s*-\s*INTERVAL\s*'[^']+'/gi, `'${new Date().toISOString()}'`)
  out = out.replace(/NOW\(\)/gi, `'${new Date().toISOString()}'`)
  return out
}

function extractValuesList(valuesClause: string): string[] {
  const inner = valuesClause.trim().replace(/^\(/, '').replace(/\)$/, '')
  const items: string[] = []
  let depth  = 0
  let inStr  = false
  let current = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (inStr) {
      if (ch === "'") {
        if (inner[i + 1] === "'") {
          // escaped quote '' inside string
          current += "''"
          i++
        } else {
          inStr = false
          current += ch
        }
      } else {
        current += ch
      }
    } else {
      if (ch === "'") {
        inStr = true
        current += ch
      } else if (ch === ',' && depth === 0) {
        items.push(current.trim())
        current = ''
      } else {
        if (ch === '(') depth++
        else if (ch === ')') depth--
        current += ch
      }
    }
  }
  if (current.trim()) items.push(current.trim())
  return items.map((v) => {
    if (v === 'null' || v === 'NULL') return null as unknown as string
    return v.replace(/^'|'$/g, '').replace(/''/g, "'")
  })
}

function parseWhere(whereClause: string, row: Row): boolean {
  const conditions = whereClause.split(/\s+AND\s+/i)
  return conditions.every((cond) => {
    const trimmed = cond.trim()
    // col = 'val' or col = val
    const m = trimmed.match(/^([\w.]+)\s*=\s*(?:'([^']*)'|(null|NULL|\S+))$/)
    if (!m) return true
    const col = m[1].trim()
    const val = m[2] !== undefined ? m[2] : (m[3] === 'null' || m[3] === 'NULL' ? null : m[3])
    const rowVal = row[col]
    if (val === null) return rowVal === null || rowVal === undefined
    return String(rowVal) === String(val)
  })
}

function coerceValue(v: string | null, existingValue?: unknown): unknown {
  if (v === null || v === undefined) return null
  if (v === 'false') return false
  if (v === 'true') return true
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v)
  // Pure numeric strings → numbers (int or decimal, optionally negative)
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  // Fallback: coerce if existing column is already a number
  if (existingValue !== undefined && typeof existingValue === 'number' && !isNaN(Number(v))) {
    return Number(v)
  }
  return v
}

export interface MockQueryResult<T = Row> {
  rows: T[]
  rowCount: number
}

export class PostgresMock {
  async query<T = Row>(sql: string, params: unknown[] = []): Promise<MockQueryResult<T>> {
    const resolved = resolveParams(sql.trim(), params)
    const upper = resolved.toUpperCase()

    // ── SELECT ────────────────────────────────────────────────────────────────
    if (upper.startsWith('SELECT')) {
      if (resolved.trim().replace(/\s+/g, ' ').toUpperCase() === 'SELECT 1') {
        return { rows: [{ '?column?': 1 }] as unknown as T[], rowCount: 1 }
      }

      const tableMatch = resolved.match(/FROM\s+([\w"]+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].replace(/"/g, '').toLowerCase()
      const rows: Row[] = tables[table] ? [...tables[table]] : []

      const whereMatch = resolved.match(/WHERE\s+(.+?)(?:\s+ORDER\s|\s+LIMIT\s|$)/i)
      const filtered = whereMatch
        ? rows.filter((r) => parseWhere(whereMatch[1].trim(), r))
        : rows

      const limitMatch = resolved.match(/LIMIT\s+(\d+)/i)
      const result = limitMatch ? filtered.slice(0, parseInt(limitMatch[1], 10)) : filtered

      return { rows: result as unknown as T[], rowCount: result.length }
    }

    // ── INSERT ────────────────────────────────────────────────────────────────
    if (upper.startsWith('INSERT')) {
      const colsMatch = resolved.match(/INTO\s+([\w"]+)\s*\(([^)]+)\)/i)
      if (!colsMatch) return { rows: [], rowCount: 0 }
      const table = colsMatch[1].replace(/"/g, '').toLowerCase()
      const cols = colsMatch[2].split(',').map((c) => c.trim())

      const valuesStart = resolved.toUpperCase().indexOf('VALUES')
      if (valuesStart === -1) return { rows: [], rowCount: 0 }
      const afterValues = resolved.slice(valuesStart + 6).trim()
      let depth = 0
      let end = 0
      for (let ci = 0; ci < afterValues.length; ci++) {
        if (afterValues[ci] === '(') depth++
        else if (afterValues[ci] === ')') { depth--; if (depth === 0) { end = ci; break } }
      }
      const valuesClause = afterValues.slice(0, end + 1)
      const vals = extractValuesList(valuesClause)

      const row: Row = {}
      cols.forEach((c, i) => { row[c] = coerceValue(vals[i] as string | null) })

      if (!row.id) row.id = genId()

      if (!tables[table]) tables[table] = []
      tables[table].push(row)

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

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (upper.startsWith('UPDATE')) {
      const withoutRet = resolved.replace(/RETURNING\s+.+$/i, '').trim()
      const tableMatch = withoutRet.match(/UPDATE\s+([\w"]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].replace(/"/g, '').toLowerCase()
      const setPairs = tableMatch[2].split(',').map((s) => s.trim())
      const tableRows = tables[table] ?? []
      const updated: Row[] = []

      for (const row of tableRows) {
        if (parseWhere(tableMatch[3].trim(), row)) {
          for (const pair of setPairs) {
            const eqIdx = pair.indexOf('=')
            if (eqIdx === -1) continue
            const k = pair.slice(0, eqIdx).trim()
            const rawV = pair.slice(eqIdx + 1).trim()
            if (/^NOW\s*\(/i.test(rawV)) { row[k] = new Date(); continue }
            const v = rawV === 'null' || rawV === 'NULL'
              ? null
              : rawV.replace(/^'|'$/g, '').replace(/''/g, "'")
            row[k] = coerceValue(v, row[k])
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

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (upper.startsWith('DELETE')) {
      const tableMatch = resolved.match(/FROM\s+([\w"]+)\s+WHERE\s+(.+)/i)
      if (!tableMatch) return { rows: [], rowCount: 0 }
      const table = tableMatch[1].replace(/"/g, '').toLowerCase()
      const before = tables[table]?.length ?? 0
      tables[table] = (tables[table] ?? []).filter((r) => !parseWhere(tableMatch[2].trim(), r))
      return { rows: [], rowCount: before - tables[table].length }
    }

    if (resolved.trim().toUpperCase() === 'SELECT 1') {
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
    Object.keys(tables).forEach((k) => delete tables[k])
    Object.assign(tables, fresh)
  }
}
