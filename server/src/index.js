import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { googleLoginConfig } from './google-login.js'
import { buildApp } from './app.js'
import { createPool } from './database.js'

const port = Number(process.env.API_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer from 1 to 65535')
}

const dist = fileURLToPath(new URL('../../dist/', import.meta.url))
const app = buildApp({
  pool: createPool(),
  logger: true,
  google: googleLoginConfig(),
  firebaseProjectId: (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)?.trim(),
  aiConfig: { apiKey: process.env.OPENAI_API_KEY?.trim(), model: process.env.OPENAI_MODEL?.trim() || undefined },
  webRoot: existsSync(dist) ? dist : undefined,
})

async function shutdown() {
  try {
    await app.close()
  } catch (error) {
    app.log.error({ code: error.code }, 'API shutdown failed')
    process.exitCode = 1
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

try {
  await app.listen({ host: process.env.API_HOST || '127.0.0.1', port })
} catch (error) {
  app.log.error({ code: error.code }, 'API failed to listen')
  process.exitCode = 1
  await shutdown()
}
