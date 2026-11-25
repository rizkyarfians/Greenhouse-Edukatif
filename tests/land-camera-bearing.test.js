import test from 'node:test';
import assert from 'node:assert/strict';
import { projectStakeMarkers, rearCameraAxes, steadyCameraAxes, steadyCameraFix } from '../src/land-camera-bearing.js';

const north = { absolute: true, alpha: 0, beta: 90, gamma: 0 };
const view = { width: 390, height: 844, videoWidth: 720, videoHeight: 1280, screenAngle: 0 };
const position = { lat: 0, lon: 0, accuracy: 2 };

test('uses absolute device orientation and rejects invalid sensor readings', () => {
  const { forward } = rearCameraAxes(north);
  assert.ok(Math.abs(forward[0]) < 1e-10);
  assert.equal(forward[1], 1);
  assert.equal(rearCameraAxes({ ...north, absolute: false }), null);
  assert.equal(rearCameraAxes({ ...north, beta: null }), null);
});

test('reprojects the same GPS stake as the camera moves, tilts or turns away', () => {
  const points = [{ lat: 0.0002, lon: 0 }];
  const axes = rearCameraAxes(north);
  const [straight] = projectStakeMarkers(position, points, axes, view).visible;
  const [moved] = projectStakeMarkers({ ...position, lon: 0.00002 }, points, axes, view).visible;
  const [tilted] = projectStakeMarkers(position, points, rearCameraAxes({ ...north, beta: 75 }), view).visible;
  assert.equal(straight.x, 0.5);
  assert.ok(straight.y > 0.5);
  assert.ok(moved.x < straight.x);
  assert.ok(tilted.y < straight.y);
  assert.deepEqual(projectStakeMarkers(position, points, rearCameraAxes({ ...north, alpha: 180 }), view).visible, []);
  assert.equal(projectStakeMarkers(position, points, axes, view).visible[0].number, 1);
});

test('shows a nearby stake without implying a projected location inside GPS uncertainty', () => {
  const points = [{ lat: 0, lon: 0.00001, accuracy: 3 }];
  const { visible, nearby } = projectStakeMarkers(position, points, rearCameraAxes(north), view);
  assert.deepEqual(visible, []);
  assert.equal(nearby.number, 1);
});

test('corrects the camera axes when the display rotates to landscape', () => {
  const points = [{ lat: 0.0002, lon: 0 }];
  const axes = rearCameraAxes(north);
  const rotated = { right: axes.up, up: axes.right.map(value => -value), forward: axes.forward };
  const landscape = { width: 844, height: 390, videoWidth: 1280, videoHeight: 720 };
  const [upright] = projectStakeMarkers(position, points, axes, { ...landscape, screenAngle: 0 }).visible;
  const [corrected] = projectStakeMarkers(position, points, rotated, { ...landscape, screenAngle: 90 }).visible;
  assert.ok(Math.abs(corrected.x - upright.x) < 1e-10);
  assert.ok(Math.abs(corrected.y - upright.y) < 1e-10);
});

test('filters small GPS fluctuations but allows walking and recovery from a poor fix', () => {
  const before = { ...position, accuracy: 4, at: 1000 };
  const jitter = { ...before, lon: 0.000006, at: 2000 };
  const walked = { ...jitter, lon: 0.0001 };
  assert.deepEqual(steadyCameraFix(before, jitter), { ...jitter, lon: before.lon });
  assert.equal(steadyCameraFix(before, walked), walked);
  assert.equal(steadyCameraFix({ ...before, accuracy: 30 }, jitter), jitter);
});

test('holds minor compass noise and accepts a deliberate camera turn', () => {
  const before = rearCameraAxes(north);
  const jitter = rearCameraAxes({ ...north, alpha: 359.6 });
  const turn = rearCameraAxes({ ...north, alpha: 355 });
  assert.equal(steadyCameraAxes(before, jitter), before);
  assert.equal(steadyCameraAxes(before, turn), turn);
});

test('guides the user toward a stake outside the camera view', () => {
  const axes = rearCameraAxes(north);
  const eastOfView = projectStakeMarkers(position, [{ lat: 0.0001, lon: 0.001 }], axes, view);
  assert.equal(eastOfView.offscreen.direction, 'right');
  const behind = projectStakeMarkers(position, [{ lat: -0.0002, lon: 0 }], axes, view);
  assert.equal(behind.offscreen.direction, 'behind');
});
