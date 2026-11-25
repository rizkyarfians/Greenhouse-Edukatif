import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPool } from './database.js'

const directory = new URL('../../database/migrations/', import.meta.url)

export async function migrate(pool) {
  const filenames = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()

  const client = await pool.connect()
  const applied = []
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(749263108)')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations')
    const recorded = new Map(rows.map(({ filename, checksum }) => [filename, checksum]))

    for (const filename of filenames) {
      const sql = await readFile(new URL(filename, directory), 'utf8')
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex')
      if (recorded.has(filename)) {
        if (recorded.get(filename) !== checksum) {
          throw new Error(`Applied migration changed: ${filename}`)
        }
        continue
      }

      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      )
      applied.push(filename)
    }

    await client.query('COMMIT')
    return applied
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const pool = createPool()
  try {
    const applied = await migrate(pool)
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date')
  } finally {
    await pool.end()
  }
}
