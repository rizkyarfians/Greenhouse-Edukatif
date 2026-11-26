import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { firebaseTokenVerifier } from '../src/firebase-token.js'

test('accepts only Google ID tokens signed for the configured Firebase project', async () => {
  const {publicKey, privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048})
  const time = Date.now()
  const now = Math.floor(time / 1000)
  let requests = 0
  const verify = firebaseTokenVerifier('example-project', async () => {
    requests++
    return new Response(JSON.stringify({test: publicKey.export({format: 'pem', type: 'spki'})}), {
      headers: {'Cache-Control': 'public, max-age=300'},
    })
  }, () => time)
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  function token(overrides = {}, header = {}) {
    const data = encode({alg: 'RS256', kid: 'test', ...header}) + '.' + encode({
      aud: 'example-project', iss: 'https://securetoken.google.com/example-project',
      sub: 'person', exp: now + 3600, iat: now - 1, auth_time: now - 10,
      firebase: {sign_in_provider: 'google.com'}, ...overrides,
    })
    return data + '.' + sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')
  }
  assert.deepEqual(await Promise.all([verify(token()), verify(token())]),
    ['firebase:example-project:person', 'firebase:example-project:person'])
  assert.equal(requests, 1)
  assert.equal(await verify(token({aud: 'other-project'})), null)
  assert.equal(await verify(token({iss: 'https://wrong.example'})), null)
  assert.equal(await verify(token({exp: now - 1})), null)
  assert.equal(await verify(token({auth_time: now + 1})), null)
  assert.equal(await verify(token({firebase: {sign_in_provider: 'anonymous'}})), null)
  assert.equal(await verify(token({}, {alg: 'HS256'})), null)
  assert.equal(await verify(token({}, {kid: 'unknown'})), null)
  assert.equal(await verify(token().split('.').slice(0, 2).join('.') + '.abc'), null)
})
