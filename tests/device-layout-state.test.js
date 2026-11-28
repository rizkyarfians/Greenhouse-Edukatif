import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDripDevices, insideDevicePlan, rectangularPlan, validateDevices} from '../src/device-layout-state.js';
import {readProject} from '../src/simulation-storage.js';

test('preset includes pump, tank, sensors and control panel and adapts to the plot', () => {
  const outline = [[0,0],[1,0],[1,.4],[.45,.4],[.45,1],[0,1]];
  const devices = defaultDripDevices(outline);
  assert.deepEqual(devices.map(({kind}) => kind), ['tank','pump','panel','air','soil','water','valve']);
  assert.ok(devices.every(({x,y}) => insideDevicePlan(outline,x,y)));
});

test('stored layouts preserve applied devices but reject invalid coordinates and kinds', () => {
  const id = 'a'.repeat(32);
  const stored = {type:'greenhouse',name:'Cabai',updatedAt:1,cropId:'chili',state:{}};
  const devices = defaultDripDevices(rectangularPlan);
  assert.deepEqual(readProject(id,{...stored,devices}).devices,devices);
  assert.equal(readProject(id,stored).devices,undefined);
  assert.equal(validateDevices([devices[0],devices[0]]),undefined);
  assert.equal(validateDevices([{...devices[0],kind:'__proto__'}]),undefined);
  assert.equal(validateDevices([{...devices[0],x:1.1}]),undefined);
  assert.deepEqual(validateDevices([]),[]);
});
