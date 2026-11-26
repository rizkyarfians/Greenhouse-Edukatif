import {detailedCrops} from './detailed-crops.js';

export const storagePrefix = 'greenhouse-edukatif:guest:v1:';
const validId = /^[a-f0-9]{32}$/;
const percentage = value => Number.isFinite(value) && value >= 0 && value <= 100;

export function readProject(id, data) {
  if (typeof id !== 'string' || !validId.test(id) || !data || typeof data !== 'object') return null;
  const {name, type = 'greenhouse', cropId, state, updatedAt} = data;
  if (typeof name !== 'string' || !name.trim() || !Number.isFinite(updatedAt) ||
      !Number.isFinite(new Date(updatedAt).getTime())) return null;
  if (!['greenhouse', 'rice'].includes(type) || !state || typeof state !== 'object' || Array.isArray(state)) return null;
  const result = {id, name, type, updatedAt};
  if (cropId !== undefined) {
    if (typeof cropId !== 'string' || !Object.hasOwn(detailedCrops, cropId) || (type === 'greenhouse' && cropId === 'maize')) return null;
    return {...result, cropId, state: {}};
  }
  if (type === 'rice') {
    const {waterDepth, soilMoisture} = state;
    if (!Number.isInteger(waterDepth) || waterDepth < 0 || waterDepth > 5 || !percentage(soilMoisture)) return null;
    return {...result, state: {waterDepth, soilMoisture}};
  }
  const {zone, completedZone, roofVisible, readings, zoneMedia} = state;
  if (!['A', 'B'].includes(zone) || ![null, 'A', 'B'].includes(completedZone) ||
      typeof roofVisible !== 'boolean' || !readings || !zoneMedia) return null;
  const {temperature, humidity, water, nutrient} = readings;
  const {A, B} = zoneMedia;
  if (!Number.isFinite(temperature) || ![humidity, water, nutrient, A, B].every(percentage)) return null;
  return {...result, state: {zone, completedZone, roofVisible,
    readings: {temperature, humidity, water, nutrient}, zoneMedia: {A, B}}};
}

export const browserSimulationStore = {
  list(storage = localStorage) {
    const projects = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(storagePrefix)) continue;
      try {
        const data = JSON.parse(storage.getItem(key));
        const id = key.slice(storagePrefix.length);
        const project = data?.id === id && readProject(id, data);
        if (project) projects.push(project);
      } catch {
        // Skip damaged records without hiding the rest of the list.
      }
    }
    return projects;
  },
  save(project, storage = localStorage) {
    storage.setItem(storagePrefix + project.id, JSON.stringify(project));
  },
};
