/**
 * Esegui con: npx tsx src/shared/db/migrate.ts
 *
 * Legge tutti i file *.sql in migrations/ in ordine numerico,
 * esegue ogni statement separato da ';', poi aggiorna la tabella
 * schema_migrations per non rieseguire migrazioni già applicate.
 */

import path from 'path'
import fs from 'fs'
import { Pool } from 'pg'
import { env, isMock } from '../../config/env'

async function run(): Promise<void> {
  if (isMock('DATABASE_URL')) {
    console.log('⚠️  DATABASE_URL=mock — migrate richiede un DB reale. Skippato.')
    process.exit(0)
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL })

  // Tabella di tracking migrazioni
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version  VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort() // ordine lessicografico → 001_, 002_, 003_

  let applied = 0

  for (const file of files) {
    const version = file.replace('.sql', '')

    const { rows } = await pool.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    )
    if (rows.length > 0) {
      console.log(`  ✓ ${file} già applicata`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    // Divide per ';' e filtra righe di commento e statement vuoti
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const stmt of statements) {
        await client.query(stmt)
      }
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      )
      await client.query('COMMIT')
      console.log(`  ✅ ${file} applicata (${statements.length} statement)`)
      applied++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  ❌ ${file} FALLITA — rollback eseguito`)
      console.error(err)
      process.exit(1)
    } finally {
      client.release()
    }
  }

  await pool.end()
  console.log(`\nMigrations completate: ${applied} nuove su ${files.length} totali.`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
