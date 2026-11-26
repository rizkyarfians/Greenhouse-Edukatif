import { createPublicKey, verify } from 'node:crypto'

const certificatesUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

function decode(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function firebaseTokenVerifier(projectId, fetcher = fetch, now = Date.now) {
  if (!projectId) return null
  let cached, loading

  async function certificates() {
    if (cached && now() < cached.expires) return cached.keys
    loading ??= (async () => {
      const response = await fetcher(certificatesUrl, { signal: AbortSignal.timeout(5_000), redirect: 'error' })
      if (!response.ok) throw new Error('Firebase public keys unavailable')
      const keys = await response.json()
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Invalid Firebase public keys')
      const maxAge = Number(response.headers.get('cache-control')?.match(/\bmax-age=(\d+)\b/)?.[1] ?? 0)
      cached = { keys, expires: now() + maxAge * 1000 }
      return keys
    })().finally(() => { loading = undefined })
    return loading
  }

  return async token => {
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || token.length > 12_000) return null
    const [header, payload, signature] = token.split('.')
    const jwt = decode(header), claims = decode(payload)
    const seconds = Math.floor(now() / 1000)
    if (jwt?.alg !== 'RS256' || typeof jwt.kid !== 'string' || !claims ||
        claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !Number.isInteger(claims.exp) || claims.exp <= seconds ||
        !Number.isInteger(claims.iat) || claims.iat <= 0 || claims.iat > seconds ||
        !Number.isInteger(claims.auth_time) || claims.auth_time <= 0 || claims.auth_time > seconds ||
        claims.firebase?.sign_in_provider !== 'google.com') return null

    const keys = await certificates()
    if (!Object.hasOwn(keys, jwt.kid) || typeof keys[jwt.kid] !== 'string') return null
    const key = createPublicKey(keys[jwt.kid])
    if (!verify('RSA-SHA256', Buffer.from(header + '.' + payload), key, Buffer.from(signature, 'base64url'))) return null
    return 'firebase:' + projectId + ':' + claims.sub
  }
}
