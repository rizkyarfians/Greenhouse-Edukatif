import test from 'node:test';
import assert from 'node:assert/strict';
import { markerDirections, rearCameraHeading } from '../src/land-camera-bearing.js';

test('uses the rear camera axis and rejects relative or vertical readings', () => {
  const facingNorth = { absolute: true, alpha: 0, beta: 90, gamma: 0 };
  assert.equal(rearCameraHeading(facingNorth), 0);
  assert.equal(rearCameraHeading({ ...facingNorth, alpha: 270 }), 90);
  assert.equal(rearCameraHeading({ ...facingNorth, absolute: false }), null);
  assert.equal(rearCameraHeading({ ...facingNorth, beta: 0 }), null);
  assert.equal(rearCameraHeading({ ...facingNorth, beta: null }), null);
});

test('shows forward markers and handles uncertainty without placing a pin', () => {
  const points = [{ lat: 0.001, lon: 0 }, { lat: -0.001, lon: 0 }, { lat: 0, lon: 0 }];
  const position = { lat: 0, lon: 0, accuracy: 5 };
  const { visible, nearby } = markerDirections(position, points, 355);
  assert.deepEqual(visible.map(({ number, angle }) => [number, angle]), [[1, 5]]);
  assert.equal(nearby.number, 3);
});
