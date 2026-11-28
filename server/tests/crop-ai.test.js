import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createHmac } from 'node:crypto'
import { buildApp } from '../src/app.js'

const google = {secret: 'secret-only-for-local-crop-test', secure: false, origin: 'http://localhost:3001'}
const pool = () => Object.assign(new EventEmitter(), {end: async () => {}})
const input = {areaM2: 180, indoorTemperature: 26, ph: 6.5, soil: 'loam', water: 'reliable', drain: 'good', usable: 80}
const climate = {temperature: 24, rain: 650, seasonRain: null, forecastMax: 34}
const payload = {landType: 'greenhouse', input, climate}
const mockOutput = value => new Response(JSON.stringify({status: 'completed', output: [
  {type: 'message', role: 'assistant', content: [{type: 'output_text', text: JSON.stringify(value)}]},
]}))

function headers(uid = 'abc') {
  const session = Buffer.from(JSON.stringify({user: {sub: uid}, exp: Date.now() + 60000})).toString('base64url')
  const mac = createHmac('sha256', google.secret).update('automotion_session.' + session).digest('base64url')
  return {origin: google.origin, cookie: 'automotion_session=' + session + '.' + mac}
}
const ask = (app, body = payload, auth = headers()) =>
  app.inject({method: 'POST', url: '/api/ai/crops', headers: auth, payload: body})

test('sends only validated screening data to OpenAI and returns an ordered explanation', async t => {
  let requests = 0
  const app = buildApp({pool: pool(), google, aiConfig: {apiKey: 'fake-key'}, aiFetcher: async (url, options) => {
    requests++
    assert.equal(url, 'https://api.openai.com/v1/responses')
    assert.equal(options.headers.Authorization, 'Bearer fake-key')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'gpt-4.1-mini')
    assert.equal(body.store, false)
    const sent = JSON.parse(body.input)
    assert.equal(sent.climate.temperature, 26)
    assert.equal(sent.climate.rain, null)
    assert.equal(sent.site.coordinates, undefined)
    assert.equal(sent.profile, undefined)
    const ids = body.text.format.schema.properties.crops.items.properties.id.enum
    assert.ok(ids.every(id => sent.assessments.some(row => row.id === id && row.verdict !== 'blocked')))
    return mockOutput({summary:'Ringkasan', crops: [{id:ids[1], note:'Kedua'}, {id:ids[0], note:'Pertama'}], nextSteps:['Cek air.']})
  }})
  t.after(() => app.close())
  assert.equal((await ask(app, payload, {})).statusCode, 401)
  assert.equal((await ask(app, payload, {...headers(), origin:'https://other.example'})).statusCode, 403)
  assert.equal((await ask(app, {...payload, input:{...input, ph:'abc'}})).statusCode, 400)
  assert.equal((await ask(app, {...payload, input:{...input, ph:0}})).statusCode, 422)
  assert.equal(requests, 0)
  const response = await ask(app, {...payload, profile:'secret name', input:{...input, coordinates:[1,2]}})
  assert.equal(requests, 1)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().crops.map(crop => crop.note), ['Pertama', 'Kedua'])
})

test('handles missing API key, invalid provider output and per-account limit', async t => {
  const inactive = buildApp({pool: pool(), google})
  t.after(() => inactive.close())
  assert.equal((await ask(inactive)).json().error, 'ai-unconfigured')
  let requests = 0
  const active = buildApp({pool: pool(), google, aiConfig:{apiKey:'fake-key'}, aiFetcher: async () => {
    requests++
    return mockOutput({summary:'Ringkasan', crops:[{id:'invented', note:'ABC'}], nextSteps:[]})
  }})
  t.after(() => active.close())
  for (let i = 0; i < 3; i++) assert.equal((await ask(active)).statusCode, 502)
  assert.equal((await ask(active)).statusCode, 429)
  assert.equal(requests, 3)
  assert.equal((await ask(active, payload, headers('different-account'))).statusCode, 502)
})
