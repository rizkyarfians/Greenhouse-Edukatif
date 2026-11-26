import {measure} from './land-geometry.js';
import {landType} from './land-type.js';

export const landStorageKey = 'automotion.land.v1';

export function landProfile(data) {
  if (data?.version !== 1 || typeof data.name !== 'string' || !data.name.trim() ||
      data.name.length > 80 || !Array.isArray(data.points) || data.points.length > 200 ||
      !data.points.every(p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 85 &&
        Number.isFinite(p.lon) && Math.abs(p.lon) <= 180)) return null;
  const points = data.points.map(({lat, lon, accuracy, source, capturedAt}) => ({
    lat, lon, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    source: source === 'gps' ? 'gps' : 'manual',
    capturedAt: typeof capturedAt === 'string' && capturedAt.length <= 40 && Number.isFinite(Date.parse(capturedAt)) ? capturedAt : null,
  }));
  const geometry = measure(points);
  return {version: 1, name: data.name.trim(), landType: landType(data.landType), points,
    areaM2: geometry.valid ? geometry.area : null,
    perimeterM: geometry.valid ? geometry.perimeter : null,
    center: geometry.valid ? geometry.center : null,
    method: 'local-tangent-plane-estimate'};
}
