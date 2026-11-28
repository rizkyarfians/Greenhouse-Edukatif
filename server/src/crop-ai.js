import { allCrops } from '../../src/crop-database.js'
import { climateForType, cropChoices } from '../../src/land-type.js'
import { rank } from '../../src/recommendation-core.js'
import { requireAccount } from './account-auth.js'

const fieldTypes = ['greenhouse', 'open-field']
const inputOptions = {
  water: ['unknown', 'reliable', 'limited', 'rain'],
  soil: ['unknown', 'loam', 'clay', 'sandy'],
  drain: ['unknown', 'good', 'poor', 'paddy'],
}
const climateBounds = {
  temperature: [-90, 70], rain: [0, 25000], seasonRain: [0, 25000], forecastMax: [-90, 70],
}
const range = (value, min, max) => typeof value === 'number' && value >= min && value <= max
const optional = (value, min, max) => value === null || range(value, min, max)
const instructions = [
  'Jelaskan hasil screening awal tanaman dalam bahasa Indonesia yang singkat dan praktis.',
  'Gunakan data yang diberikan. Pertahankan urutan dan status dari screening.',
  'Sebutkan faktor yang membatasi pilihan dan pengukuran yang perlu dilakukan di lahan.',
  'Nilai null berarti belum tersedia. Hujan historis dan klimatologi bukan prediksi.',
  'Jangan menjanjikan panen, mengarang pengukuran, atau memberi dosis pupuk dan pestisida.',
].join(' ')

function context(body) {
  const {landType, input, climate} = body ?? {}
  if (!fieldTypes.includes(landType) || !input || !climate ||
      !Object.entries(inputOptions).every(([key, options]) => options.includes(input[key])) ||
      !optional(input.ph, 0, 14) || !optional(input.indoorTemperature, 0, 60) ||
      !range(input.usable, 1, 100) || !range(input.areaM2, 1, 400_000_000) ||
      !Object.entries(climateBounds).every(([key, [min, max]]) => optional(climate[key], min, max))) return null

  const {water, soil, drain, ph, indoorTemperature, usable, areaM2} = input
  const site = {water, soil, drain, ph, indoorTemperature: landType === 'greenhouse' ? indoorTemperature : null,
    usable, areaM2: Math.round(areaM2)}
  const {temperature, rain, seasonRain, forecastMax} = climate
  const growingClimate = climateForType({temperature, rain, seasonRain, forecastMax}, landType, site.indoorTemperature)
  const assessed = rank(cropChoices(allCrops, landType), site, growingClimate)
  return {landType, site, climate: growingClimate, assessments: assessed.map(({crop, verdict, score, coverage, blocks, missing, risks}) =>
    ({id: crop.id, name: crop.name, verdict, score, coverage, blocks, missing, risks}))}
}

function outputFormat(ids) {
  return {
    type: 'json_schema', name: 'crop_screening_explanation', strict: true,
    schema: {
      type: 'object', additionalProperties: false, required: ['summary', 'crops', 'nextSteps'],
      properties: {
        summary: {type: 'string'},
        crops: {
          type: 'array', items: {
            type: 'object', additionalProperties: false, required: ['id', 'note'],
            properties: {id: {type: 'string', enum: ids}, note: {type: 'string'}},
          },
        },
        nextSteps: {type: 'array', items: {type: 'string'}},
      },
    },
  }
}

const sentence = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit
function readOutput(response, ids) {
  if (response.status !== 'completed') return null
  const parts = (response.output ?? []).flatMap(item => item.type === 'message' && item.role === 'assistant' ? item.content : [])
  if (parts.some(part => part.type === 'refusal')) return null
  const data = JSON.parse(parts.filter(part => part.type === 'output_text').map(part => part.text).join(''))
  if (!sentence(data?.summary, 850) || !Array.isArray(data.crops) || !Array.isArray(data.nextSteps) ||
      data.crops.length > ids.length || data.nextSteps.length > 4 ||
      !data.crops.every(crop => ids.includes(crop?.id) && sentence(crop.note, 370)) ||
      new Set(data.crops.map(crop => crop.id)).size !== data.crops.length ||
      !data.nextSteps.every(step => sentence(step, 350))) return null
  return {summary: data.summary, crops: ids.flatMap(id => data.crops.filter(crop => crop.id === id)),
    nextSteps: data.nextSteps}
}

export function registerCropAi(app, {accountAuth, config = {}, fetcher = fetch}) {
  const {apiKey, model = 'gpt-4.1-mini'} = config
  const authorize = requireAccount(accountAuth)
  const attempts = []
  const inFlight = new Set()
  app.post('/api/ai/crops', {bodyLimit: 4096, onRequest: authorize}, async (request, reply) => {
    const data = context(request.body)
    if (!data) return reply.code(400).send({error: 'invalid-analysis'})
    if (!apiKey) return reply.code(503).send({error: 'ai-unconfigured'})
    const ids = data.assessments.filter(crop => crop.verdict !== 'blocked').slice(0, 3).map(crop => crop.id)
    if (!ids.length) return reply.code(422).send({error: 'no-candidates'})
    const now = Date.now()
    while (attempts[0]?.time <= now - 60_000) attempts.shift()
    const owner = request.ownerKey
    if (inFlight.has(owner) || attempts.length >= 12 || attempts.filter(entry => entry.owner === owner).length >= 3) {
      return reply.header('Retry-After', 60).code(429).send({error: 'ai-rate-limited'})
    }
    attempts.push({time: now, owner})
    inFlight.add(owner)
    try {
      const response = await fetcher('https://api.openai.com/v1/responses', {
        method: 'POST', signal: AbortSignal.timeout(20_000), redirect: 'error',
        headers: {Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          model, store: false, max_output_tokens: 1000, instructions,
          input: JSON.stringify(data), text: {format: outputFormat(ids)},
        }),
      })
      if (response.status === 429) return reply.code(429).send({error: 'ai-provider-rate-limited'})
      if (!response.ok) {
        request.log.warn({status: response.status}, 'OpenAI request declined')
        return reply.code(502).send({error: 'ai-provider-failed'})
      }
      const explanation = readOutput(await response.json(), ids)
      if (!explanation) return reply.code(502).send({error: 'ai-invalid-response'})
      return explanation
    } catch (error) {
      const timeout = error?.name === 'TimeoutError'
      return reply.code(timeout ? 504 : 502).send({error: timeout ? 'ai-timeout' : 'ai-invalid-response'})
    } finally {
      inFlight.delete(owner)
    }
  })
}
