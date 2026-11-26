import Fastify, { LogController } from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerGoogleLogin } from './google-login.js'
import { firebaseTokenVerifier } from './firebase-token.js'
import { registerAccountStorage } from './account-storage.js'

export function buildApp({ pool, logger = false, google = null, fetcher, webRoot, firebaseProjectId, firebaseFetcher }) {
  const logController = new LogController({
    disableRequestLogging: request => request.url?.startsWith('/api/auth/') ?? false,
  })
  const app = Fastify({ logger, logController })
  const readGoogleUser = registerGoogleLogin(app, google, fetcher)
  registerAccountStorage(app, { pool, readGoogleUser, googleOrigin: google?.origin,
    verifyFirebase: firebaseTokenVerifier(firebaseProjectId, firebaseFetcher) })
  if (webRoot) app.register(fastifyStatic, {
    root: webRoot,
    cacheControl: false,
    setHeaders: (response, path) => {
      if (path.endsWith('.html')) response.setHeader('Cache-Control', 'no-cache')
    },
  })

  pool.on('error', (error) => {
    app.log.warn({ code: error.code }, 'Idle database connection failed')
  })
  app.addHook('onClose', () => pool.end())

  app.get('/health/live', async () => ({ status: 'ok' }))

  app.get('/health/ready', async (request, reply) => {
    try {
      await pool.query({ text: 'SELECT postgis_version()', query_timeout: 2_000 })
      return { status: 'ready' }
    } catch (error) {
      request.log.warn({ code: error.code }, 'Database readiness check failed')
      return reply.code(503).send({ status: 'unavailable' })
    }
  })

  return app
}
