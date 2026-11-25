import pg from 'pg'

export function createPool(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')

  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 2_000,
    statement_timeout: 10_000,
    query_timeout: 12_000,
  })
}
