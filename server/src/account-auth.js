export function requireAccount({ verifyFirebase, readGoogleUser, googleOrigin }) {
  return async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store')
    const auth = request.headers.authorization
    if (auth) {
      if (!verifyFirebase) return reply.code(503).send({ error: 'firebase-auth-unconfigured' })
      if (!auth.startsWith('Bearer ')) return reply.code(401).send({ error: 'unauthenticated' })
      try {
        request.ownerKey = await verifyFirebase(auth.slice(7))
      } catch {
        return reply.code(503).send({ error: 'firebase-verification-unavailable' })
      }
    } else {
      const user = readGoogleUser(request)
      if (user) {
        if (request.method !== 'GET' && request.headers.origin !== googleOrigin) {
          return reply.code(403).send({ error: 'invalid-origin' })
        }
        request.ownerKey = 'google:' + user.sub
      }
    }
    if (!request.ownerKey) return reply.code(401).send({ error: 'unauthenticated' })
  }
}
