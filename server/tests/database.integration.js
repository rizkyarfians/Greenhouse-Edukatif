import assert from 'node:assert/strict'
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto'
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

test('signed-in accounts can restore saved patok and simulations on another client', async t => {
  const pool = createPool()
  await migrate(pool)
  const {publicKey, privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048})
  const projectId = 'integration-test'
  const alice = randomUUID(), bob = randomUUID()
  const app = buildApp({pool, firebaseProjectId: projectId,
    firebaseFetcher: async () => new Response(JSON.stringify({test: publicKey.export({type: 'spki', format: 'pem'})}),
      {headers: {'Cache-Control': 'max-age=60'}})})
  t.after(async () => {
    const owner = 'firebase:' + projectId + ':' + alice
    try {
      await pool.query('DELETE FROM account_land_profiles WHERE owner_key = $1', [owner])
      await pool.query('DELETE FROM account_simulations WHERE owner_key = $1', [owner])
    } finally {
      await app.close()
    }
  })
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  function request(uid, method, path, payload) {
    const now = Math.floor(Date.now() / 1000)
    const signed = encode({alg: 'RS256', kid: 'test'}) + '.' + encode({
      aud: projectId, iss: 'https://securetoken.google.com/' + projectId, sub: uid,
      iat: now - 1, auth_time: now - 1, exp: now + 3600, firebase: {sign_in_provider: 'google.com'},
    })
    const token = signed + '.' + sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')
    return app.inject({method, url: '/api/storage/' + path, headers: {authorization: 'Bearer ' + token}, payload})
  }
  const profile = {version: 1, name: 'Kebun', points: [{lat: -7.98, lon: 112.61, source: 'gps', accuracy: 5}]}
  const initial = await request(alice, 'PUT', 'land', {profile, revision: null})
  assert.equal(initial.statusCode, 200)
  const first = initial.json()
  assert.equal(first.profile.areaM2, null)
  assert.deepEqual((await request(alice, 'GET', 'land')).json(), first)
  assert.equal((await request(bob, 'GET', 'land')).json().profile, null)
  const second = await request(alice, 'PUT', 'land', {profile: {...profile, name: 'Kebun baru'}, revision: first.revision})
  assert.equal(second.statusCode, 200)
  assert.equal((await request(alice, 'PUT', 'land', {profile, revision: first.revision})).statusCode, 409)
  assert.equal((await request(bob, 'DELETE', 'land', {revision: second.json().revision})).statusCode, 409)
  assert.equal((await app.inject('/api/storage/land')).statusCode, 401)

  const simulation = {name: 'Jagung', type: 'rice', cropId: 'maize', state: {}}
  const path = 'simulations/' + randomUUID().replaceAll('-', '')
  assert.deepEqual((await request(alice, 'PUT', path, simulation)).json(), {saved: true})
  assert.deepEqual((await request(alice, 'PUT', path + '?copy=1', {...simulation, name: 'Salinan lama'})).json(), {saved: false})
  assert.equal((await request(alice, 'GET', 'simulations')).json()[0].name, 'Jagung')
  assert.deepEqual((await request(bob, 'GET', 'simulations')).json(), [])
})
