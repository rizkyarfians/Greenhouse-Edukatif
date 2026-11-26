import test from 'node:test';
import assert from 'node:assert/strict';
import {createCropGeometry} from '../src/crop-models.js';
import {detailedCrops} from '../src/detailed-crops.js';

for (const id of Object.keys(detailedCrops)) {
  test(id + ' has a colored full model and a lighter field model placed on the soil', () => {
    const full = createCropGeometry(id);
    const field = createCropGeometry(id, {detail: false});
    try {
      assert.ok(full.index.count > field.index.count * 3);
      assert.ok(field.index.count / 3 <= 1000);
      for (const model of [full, field]) {
        const {position, normal, color} = model.attributes;
        assert.equal(normal.count, position.count);
        assert.equal(color.count, position.count);
        assert.ok(position.array.every(Number.isFinite));
        assert.ok(normal.array.every(Number.isFinite));
        assert.ok(color.array.every(value => value >= 0 && value <= 1));
        assert.ok(new Set(color.array).size > 12);
        assert.ok(Math.abs(model.boundingBox.min.y) < .01);
        assert.ok(model.boundingBox.max.y > .3);
      }
    } finally {
      full.dispose();
      field.dispose();
    }
  });
}
