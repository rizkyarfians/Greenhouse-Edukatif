import Fastify from 'fastify'

export function buildApp({ pool, logger = false }) {
  const app = Fastify({ logger })

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
