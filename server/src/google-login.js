import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const callbackPath = '/api/auth/google/callback'
const loginAge = 600
const sessionAge = 8 * 60 * 60
const makeToken = () => randomBytes(32).toString('base64url')

export function googleLoginConfig(env = process.env) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REDIRECT_URI: redirectUri, AUTH_SESSION_SECRET: secret } = env
  if (!clientId || !clientSecret || !redirectUri || !secret || secret.length < 32) return null

  const url = new URL(redirectUri)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.pathname !== callbackPath || url.search || url.hash || url.username || url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('GOOGLE_REDIRECT_URI must use /api/auth/google/callback on an HTTPS origin or localhost')
  }
  return { clientId, clientSecret, redirectUri, secret, origin: url.origin, secure: url.protocol === 'https:' }
}

function signedCookies({ secret, secure }) {
  const prefix = secure ? '__Host-' : ''
  const signature = data => createHmac('sha256', secret).update(data).digest('base64url')
  return {
    write(name, value, age) {
      const data = Buffer.from(JSON.stringify({ ...value, exp: Date.now() + age * 1000 })).toString('base64url')
      return `${prefix}${name}=${age ? `${data}.${signature(name + '.' + data)}` : ''}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
    },
    read(headers, name) {
      const key = prefix + name + '='
      const raw = headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(key))
      if (!raw) return null
      const [data, mac, extra] = raw.slice(key.length).split('.')
      if (!data || !mac || extra !== undefined) return null
      const expected = signature(name + '.' + data)
      if (Buffer.byteLength(mac) !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
      try {
        const value = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
        return value.exp > Date.now() ? value : null
      } catch {
        return null
      }
    },
  }
}

async function googleProfile(config, code, verifier, fetcher) {
  const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  })
  if (!tokenResponse.ok) return null
  const { access_token: accessToken } = await tokenResponse.json()
  if (typeof accessToken !== 'string' || !accessToken) return null

  const profileResponse = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  })
  if (!profileResponse.ok) return null
  const { sub, email, email_verified: verified, name } = await profileResponse.json()
  if (typeof sub !== 'string' || !sub || sub.length > 255 || typeof email !== 'string' ||
      !email || email.length > 320 || verified !== true) return null
  return { sub, email, name: typeof name === 'string' ? name.slice(0, 120) : '' }
}

export function registerGoogleLogin(app, config, fetcher = fetch) {
  const oauthCookie = 'automotion_google_flow'
  const sessionCookie = 'automotion_session'
  const cookies = config ? signedCookies(config) : null
  const readUser = request => cookies?.read(request.headers, sessionCookie)?.user ?? null
  const settings = (request, reply, done) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer')
    done()
  }
  const fail = (reply, reason) => reply.redirect(`/?login=${reason}`)

  app.get('/api/auth/session', { onRequest: settings }, (request) => ({
    googleEnabled: !!config,
    user: readUser(request),
  }))

  app.get('/api/auth/google', { onRequest: settings }, (request, reply) => {
    if (!config) return fail(reply, 'unavailable')

    const state = makeToken()
    const verifier = makeToken()
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorize.search = new URLSearchParams({
      client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
      scope: 'openid email profile', state, prompt: 'select_account',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    }).toString()
    reply.header('Set-Cookie', cookies.write(oauthCookie, { state, verifier }, loginAge))
    return reply.redirect(authorize.toString())
  })

  app.get(callbackPath, { onRequest: settings }, async (request, reply) => {
    if (!config) return fail(reply, 'unavailable')
    const flow = cookies.read(request.headers, oauthCookie)
    const clear = cookies.write(oauthCookie, {}, 0)
    reply.header('Set-Cookie', clear)
    const { code, state, error } = request.query
    if (!flow || flow.state !== state) return fail(reply, 'expired')
    if (error === 'access_denied') return fail(reply, 'cancelled')
    if (typeof code !== 'string' || !code) return fail(reply, 'failed')
    try {
      const user = await googleProfile(config, code, flow.verifier, fetcher)
      if (!user) return fail(reply, 'failed')
      reply.header('Set-Cookie', cookies.write(sessionCookie, { user }, sessionAge))
      return reply.redirect('/dashboard.html?account=google')
    } catch {
      return fail(reply, 'failed')
    }
  })

  app.post('/api/auth/logout', { onRequest: settings }, (request, reply) => {
    if (!config || request.headers.origin !== config.origin) return reply.code(403).send()
    return reply.header('Set-Cookie', cookies.write(sessionCookie, {}, 0)).code(204).send()
  })

  return readUser
}
