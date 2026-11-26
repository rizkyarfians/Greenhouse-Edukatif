import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBeds} from '../src/scan-beds.js';

function contains(polygon, x, y) {
  return polygon.reduce((hit, a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return (a[1] > y) !== (b[1] > y) &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0] ? !hit : hit;
  }, false);
}

test('lays out separate beds following the long edge of a rotated scan', () => {
  const rect = [[0, 0], [5, 0], [5, 14], [0, 14]];
  const rotated = rect.map(([x,y]) => [(x-y)/Math.SQRT2, (x+y)/Math.SQRT2]);
  const {beds, depth} = previewBeds(rotated, .8);
  assert.equal(beds.length, 6);
  assert.ok(Math.abs(depth - 14) < 1e-9);
  assert.ok(beds.every(bed => bed.to - bed.from > 13));
  assert.ok(beds[1].x - beds[0].x > beds[0].width);
});

test('keeps the full bed footprint clear of concave gaps and diagonal boundaries', () => {
  const input = [[0,0],[11,0],[11,8],[6,8],[6,3],[4,3],[4,8],[2,10]];
  for (const outline of [input, [...input].reverse()]) {
    const {beds, polygon} = previewBeds(outline, .7);
    assert.ok(beds.length > 5);
    for (const bed of beds) {
      for (const side of [-.5, 0, .5]) {
        for (let i = 0; i <= 24; i++) {
          assert.ok(contains(polygon, bed.x + side * bed.width, bed.from + i * (bed.to - bed.from) / 24));
        }
      }
    }
  }
});

test('caps the number of beds shown and leaves very narrow land clear', () => {
  assert.equal(previewBeds([[0,0],[500,0],[500,800],[0,800]], .8).beds.length, 12);
  assert.equal(previewBeds([[0,0],[.2,0],[.2,8],[0,8]], .8).beds.length, 0);
});
