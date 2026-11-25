import test from 'node:test';
import assert from 'node:assert/strict';
import { stakeDisplayScale } from '../src/land-camera-stake-model.js';

test('leaves larger stakes alone and keeps distant stakes legible', () => {
  assert.equal(stakeDisplayScale(500, 10), 1);
  const height = 500 * 1.15 / 100 * stakeDisplayScale(500, 100);
  assert.ok(Math.abs(height - 52) < 1e-10);
});
