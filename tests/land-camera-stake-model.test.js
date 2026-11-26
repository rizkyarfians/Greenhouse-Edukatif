import test from 'node:test';
import assert from 'node:assert/strict';
import { createStakeModelLayer, stakeDisplayScale } from '../src/land-camera-stake-model.js';

test('leaves larger stakes alone and keeps distant stakes legible', () => {
  assert.equal(stakeDisplayScale(500, 10), 1);
  const height = 500 * 1.15 / 100 * stakeDisplayScale(500, 100);
  assert.ok(Math.abs(height - 52) < 1e-10);
});

test('draws a shaded 3D bamboo model through Canvas without WebGL', t => {
  const colors = new Set();
  const rendered = [];
  const context = {
    setTransform() {}, clearRect() { rendered.length = 0; },
    beginPath() { rendered.push([]); },
    moveTo(x, y) { rendered.at(-1).push([x, y]); },
    lineTo(x, y) { rendered.at(-1).push([x, y]); },
    closePath() {},
    fill() { colors.add(this.fillStyle); },
    stroke() {},
  };
  const canvas = {
    getContext(type) { assert.equal(type, '2d'); return context; },
    remove() {},
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = { createElement: () => canvas };
  globalThis.window = { devicePixelRatio: 1 };
  t.after(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  const layer = createStakeModelLayer({ replaceChildren: child => assert.equal(child, canvas) });
  const marker = { x: 0.5, y: 0.6, depth: 100 };
  const view = { width: 400, height: 800, focal: 520, up: [0, 1, 0] };
  assert.equal(layer.draw([marker], view), true);
  const first = structuredClone(rendered);
  assert.ok(first.length > 20);
  assert.ok(colors.size > 4);
  assert.equal(layer.draw([marker], { ...view, up: [0.6, 0.8, 0] }), true);
  assert.notDeepEqual(rendered, first);
  assert.equal(layer.draw([], view), false);
  assert.equal(canvas.hidden, true);
});
