import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { buildApp } from '../src/app.js'
import { googleLoginConfig } from '../src/google-login.js'

const config = googleLoginConfig({
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'https://automotion.example/api/auth/google/callback',
  AUTH_SESSION_SECRET: 'test-session-secret-longer-than-32-characters',
})
const pool = () => Object.assign(new EventEmitter(), { end: async () => {} })
const cookiePair = header => header.split(';')[0]

test('Google is optional and guest access does not require a backend session', async t => {
  const app = buildApp({ pool: pool() })
  t.after(() => app.close())
  const status = await app.inject('/api/auth/session')
  assert.deepEqual(status.json(), { googleEnabled: false, user: null })
  const start = await app.inject('/api/auth/google')
  assert.equal(start.headers.location, '/?login=unavailable')
})

test('validates OAuth state and creates a session with verified Google identity', async t => {
  const requests = []
  const user = { sub: 'google-sub', email: 'trial@example.test', name: 'Trial' }
  const fetcher = async (url, options) => {
    requests.push(url)
    if (url.endsWith('/token')) {
      assert.equal(options.body.get('code'), 'google-code')
      assert.equal(options.body.get('redirect_uri'), config.redirectUri)
      assert.match(options.body.get('code_verifier'), /^[A-Za-z0-9_-]{43}$/)
      return Response.json({ access_token: 'google-token' })
    }
    assert.equal(options.headers.Authorization, 'Bearer google-token')
    return Response.json({ ...user, email_verified: true })
  }
  const app = buildApp({ pool: pool(), google: config, fetcher })
  t.after(() => app.close())

  const start = await app.inject('/api/auth/google')
  const google = new URL(start.headers.location)
  const state = google.searchParams.get('state')
  const authCookie = start.headers['set-cookie']
  assert.equal(google.origin, 'https://accounts.google.com')
  assert.equal(google.searchParams.get('scope'), 'openid email profile')
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256')
  assert.match(authCookie, /HttpOnly; SameSite=Lax; Secure/)

  const headers = { cookie: cookiePair(authCookie) }
  const invalid = await app.inject({ url: '/api/auth/google/callback?state=wrong&code=google-code', headers })
  assert.equal(invalid.headers.location, '/?login=expired')
  assert.equal(requests.length, 0)

  const result = await app.inject({ url: `/api/auth/google/callback?state=${state}&code=google-code`, headers })
  assert.equal(result.headers.location, '/dashboard.html?account=google')
  assert.equal(requests.length, 2)
  const session = cookiePair(result.headers['set-cookie'][1])
  assert.match(session, /^__Host-automotion_session=/)
  const account = await app.inject({ url: '/api/auth/session', headers: { cookie: session } })
  assert.deepEqual(account.json(), { googleEnabled: true, user })
  const tampered = await app.inject({ url: '/api/auth/session', headers: { cookie: session + 'A' } })
  assert.equal(tampered.json().user, null)

  const rejected = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: 'https://another.example' } })
  assert.equal(rejected.statusCode, 403)
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: config.origin } })
  assert.equal(logout.statusCode, 204)
  assert.match(logout.headers['set-cookie'], /Max-Age=0/)
})
