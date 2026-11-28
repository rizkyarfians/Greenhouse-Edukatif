import test from 'node:test';
import assert from 'node:assert/strict';
import {detailedCrops} from '../src/detailed-crops.js';
import {browserSimulationStore, readProject, storagePrefix} from '../src/simulation-storage.js';

const id = '0123456789abcdef0123456789abcdef';
const greenhouse = {
  id, name: 'Melon', updatedAt: 1,
  state: {
    zone: 'A', completedZone: null, roofVisible: true,
    readings: {temperature: 28, humidity: 70, water: 30, nutrient: 20},
    zoneMedia: {A: 61, B: 71},
  },
};

test('reads legacy greenhouse, rice, and the selected crop with a canonical state', () => {
  assert.deepEqual(readProject(id, greenhouse), {...greenhouse, type: 'greenhouse'});
  const rice = {...greenhouse, type: 'rice', state: {waterDepth: 2, soilMoisture: 5, unused: true}};
  assert.deepEqual(readProject(id, rice), {...rice, state: {waterDepth: 2, soilMoisture: 5}});
  assert.deepEqual(readProject(id, {...rice, cropId: 'maize', state: {unused: true}}),
    {...rice, cropId: 'maize', state: {}});
});

test('restores all modeled crops for both environments', () => {
  for (const type of ['greenhouse', 'rice']) {
    for (const cropId of Object.keys(detailedCrops)) {
      const project = {...greenhouse, type, cropId, state: {}};
      assert.deepEqual(readProject(id, project), project);
    }
  }
});

test('rejects invalid records and prototype keys', () => {
  for (const value of [
    {...greenhouse, state: {}},
    {...greenhouse, state: []},
    {...greenhouse, cropId: ['chili']},
    {...greenhouse, cropId: '__proto__'},
    {...greenhouse, type: 'constructor'},
    {...greenhouse, updatedAt: Infinity},
  ]) assert.equal(readProject(id, value), null);
  assert.equal(readProject('not-a-project-id', greenhouse), null);
});

test('guest records survive reopening and malformed or foreign records are skipped', () => {
  const records = new Map([
    [storagePrefix + 'a'.repeat(32), '{'],
    [storagePrefix + 'b'.repeat(32), JSON.stringify(greenhouse)],
    ['automotion.land.v1', '{}'],
  ]);
  const storage = {
    get length() { return records.size; },
    key: i => [...records.keys()][i],
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  browserSimulationStore.save(greenhouse, storage);
  assert.deepEqual(browserSimulationStore.list(storage), [{...greenhouse, type: 'greenhouse'}]);
  assert.equal(records.get('automotion.land.v1'), '{}');
});

test('retains bounded raster previews and discards unsupported image URLs', () => {
  const preview = 'data:image/webp;base64,UklGRg==';
  assert.equal(readProject(id, {...greenhouse, preview}).preview, preview);
  for (const preview of [
    'https://example.com/track.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/webp;base64,' + 'A'.repeat(36_000),
  ]) assert.equal(readProject(id, {...greenhouse, preview}).preview, undefined);
});
