import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { createPool } from '../src/database.js'
import { migrate } from '../src/migrate.js'

test('migrations are repeatable and the API is ready against PostGIS', async (t) => {
  const pool = createPool()
  const app = buildApp({ pool })
  t.after(() => app.close())

  await migrate(pool)
  assert.deepEqual(await migrate(pool), [])

  const { rows } = await pool.query('SELECT filename FROM schema_migrations WHERE filename = $1', [
    '001_enable_postgis.sql',
  ])
  assert.equal(rows.length, 1)

  const response = await app.inject('/health/ready')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ready' })
})
