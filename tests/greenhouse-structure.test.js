import test from 'node:test';
import assert from 'node:assert/strict';
import {greenhouseStructure} from '../src/greenhouse-structure.js';

test('a gabled roof is clipped to a concave footprint and its frame remains in fallback', () => {
  const outline = [[-3,-5],[3,-5],[3,5],[1,5],[1,0],[-1,0],[-1,5],[-3,5]];
  const {group, roof} = greenhouseStructure(outline, 3, true);
  assert.ok(group.children.length > outline.length);
  const cover = roof.children.find(mesh => mesh.material.transparent);
  const position = cover.geometry.getAttribute('position');
  let area = 0, ridge = 0;
  for (let i = 0; i < position.count; i += 3) {
    const xs = [i,i+1,i+2].map(j => position.getX(j));
    const zs = [i,i+1,i+2].map(j => position.getZ(j));
    const centerX = xs.reduce((a,b) => a+b, 0) / 3;
    const centerZ = zs.reduce((a,b) => a+b, 0) / 3;
    assert.ok(Math.abs(centerX) >= 1 || centerZ <= 0);
    area += Math.abs((xs[1]-xs[0])*(zs[2]-zs[0])-(xs[2]-xs[0])*(zs[1]-zs[0]))/2;
    ridge = Math.max(ridge, position.getY(i), position.getY(i+1), position.getY(i+2));
  }
  assert.equal(area, 50);
  assert.equal(ridge, 3);
  const fallback = greenhouseStructure(outline, 3, false);
  assert.equal(fallback.roof.children.length, roof.children.length - 1);
});
