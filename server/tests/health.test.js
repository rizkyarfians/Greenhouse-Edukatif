import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

function fakePool(query) {
  return Object.assign(new EventEmitter(), { query, end: async () => {} })
}

test('liveness does not depend on the database', async (t) => {
  const query = t.mock.fn()
  const app = buildApp({ pool: fakePool(query) })
  t.after(() => app.close())

  const response = await app.inject('/health/live')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ok' })
  assert.equal(query.mock.callCount(), 0)
})

test('readiness checks PostGIS', async (t) => {
  const query = t.mock.fn(async () => {})
  const app = buildApp({ pool: fakePool(query) })
  t.after(() => app.close())

  const response = await app.inject('/health/ready')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ready' })
  assert.match(query.mock.calls[0].arguments[0].text, /postgis_version/)
})

test('readiness returns 503 without exposing database errors', async (t) => {
  const app = buildApp({
    pool: fakePool(async () => { throw new Error('internal database connection details') }),
  })
  t.after(() => app.close())

  const response = await app.inject('/health/ready')
  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.json(), { status: 'unavailable' })
})
