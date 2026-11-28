import { requireAccount } from './account-auth.js'
import { randomUUID } from 'node:crypto'
import { readProject } from '../../src/simulation-storage.js'
import { landProfile } from '../../src/land-profile.js'

const revisionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const simulation = row => ({ ...row.project, id: row.simulation_id, updatedAt: row.updated_at.getTime() })
const land = row => row ? { profile: { ...row.profile, updatedAt: row.updated_at.toISOString() }, revision: row.revision } : { profile: null, revision: null }

export function registerAccountStorage(app, { pool, verifyFirebase, readGoogleUser, googleOrigin }) {
  app.register(async routes => {
    routes.addHook('onRequest', requireAccount({ verifyFirebase, readGoogleUser, googleOrigin }))

    routes.get('/simulations', async request => {
      const { rows } = await pool.query(`
        SELECT simulation_id, project, updated_at FROM account_simulations
        WHERE owner_key = $1 ORDER BY updated_at DESC
      `, [request.ownerKey])
      return rows.map(simulation)
    })

    routes.put('/simulations/:id', async (request, reply) => {
      const id = request.params.id
      const project = readProject(id, { ...request.body, updatedAt: Date.now() })
      if (!project || project.name.length > 60) return reply.code(400).send({ error: 'invalid-simulation' })
      const { id: _, updatedAt, ...fields } = project
      const onConflict = request.query.copy === '1' ? 'DO NOTHING' :
        'DO UPDATE SET project = EXCLUDED.project, updated_at = clock_timestamp()'
      const { rowCount } = await pool.query(`
        INSERT INTO account_simulations(owner_key, simulation_id, project) VALUES ($1, $2, $3)
        ON CONFLICT (owner_key, simulation_id) ${onConflict}
      `, [request.ownerKey, id, fields])
      return { saved: rowCount === 1 }
    })

    routes.get('/land', async request => {
      const { rows } = await pool.query('SELECT profile, revision, updated_at FROM account_land_profiles WHERE owner_key = $1', [request.ownerKey])
      return land(rows[0])
    })

    routes.put('/land', async (request, reply) => {
      const previous = request.body?.revision
      const profile = landProfile(request.body?.profile)
      if (!profile || (previous !== null && (typeof previous !== 'string' || !revisionPattern.test(previous)))) {
        return reply.code(400).send({ error: 'invalid-land-profile' })
      }

      const args = [request.ownerKey, randomUUID(), profile]
      const { rows } = previous === null
        ? await pool.query(`
          INSERT INTO account_land_profiles(owner_key, revision, profile) VALUES ($1, $2, $3)
          ON CONFLICT (owner_key) DO NOTHING RETURNING profile, revision, updated_at
        `, args)
        : await pool.query(`
          UPDATE account_land_profiles SET revision = $2, profile = $3, updated_at = clock_timestamp()
          WHERE owner_key = $1 AND revision = $4 RETURNING profile, revision, updated_at
        `, [...args, previous])
      if (!rows.length) return reply.code(409).send({ error: 'land-conflict' })
      return land(rows[0])
    })

    routes.delete('/land', async (request, reply) => {
      const revision = request.body?.revision
      if (typeof revision !== 'string' || !revisionPattern.test(revision)) return reply.code(400).send({ error: 'invalid-revision' })
      const { rowCount } = await pool.query('DELETE FROM account_land_profiles WHERE owner_key = $1 AND revision = $2',
        [request.ownerKey, revision])
      if (!rowCount) return reply.code(409).send({ error: 'land-conflict' })
      return reply.code(204).send()
    })
  }, { prefix: '/api/storage' })
}
