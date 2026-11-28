import {Vector3} from 'three';
import {addDeviceMarkers} from './device-details.js';
import {rectangularPlan} from './device-layout-state.js';

export function createDeviceSurface(viewport, camera, bounds, redraw, footprint, rows = []) {
  const dx = Math.max(.001, bounds.max.x - bounds.min.x);
  const dz = Math.max(.001, bounds.max.z - bounds.min.z);
  const outline = footprint?.map(([x,z]) => [(x-bounds.min.x)/dx, (z-bounds.min.z)/dz]) ?? rectangularPlan;
  let markers;
  return {
    outline,
    rows: rows.map(({x, from, to}) => [(x-bounds.min.x)/dx, (from-bounds.min.z)/dz, (to-bounds.min.z)/dz]),
    aspect: dx / dz,
    get hasDevices() { return Boolean(markers); },
    position() { markers?.(camera); },
    setDevices(devices) {
      markers?.dispose();
      markers = devices.length ? addDeviceMarkers(viewport, devices.map(({device, icon, x, y}) => ({
        device, icon, position: new Vector3(bounds.min.x + x * dx, .45, bounds.min.z + y * dz),
      }))) : undefined;
      redraw();
    },
  };
}
