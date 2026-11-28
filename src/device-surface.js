import {Plane, Raycaster, Vector2, Vector3} from 'three';
import {addDeviceMarkers} from './device-details.js';
import {insideDevicePlan, rectangularPlan} from './device-layout-state.js';

export function createDeviceSurface(viewport, camera, bounds, redraw, footprint) {
  const dx = Math.max(.001, bounds.max.x - bounds.min.x);
  const dz = Math.max(.001, bounds.max.z - bounds.min.z);
  const outline = footprint?.map(([x,z]) => [(x-bounds.min.x)/dx, (z-bounds.min.z)/dz]) ?? rectangularPlan;
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hit = new Vector3();
  let markers;
  return {
    viewport,
    outline,
    editing: false,
    get hasDevices() { return this.editing || Boolean(markers); },
    position() { markers?.(camera); },
    groundPoint(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      pointer.set(
        (clientX - rect.left - viewport.clientLeft) / viewport.clientWidth * 2 - 1,
        1 - (clientY - rect.top - viewport.clientTop) / viewport.clientHeight * 2,
      );
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      const x = (hit.x - bounds.min.x) / dx;
      const y = (hit.z - bounds.min.z) / dz;
      return insideDevicePlan(outline, x, y) ? {x, y} : null;
    },
    setDevices(devices, focusSelected) {
      markers?.dispose();
      markers = devices.length ? addDeviceMarkers(viewport, devices.map(entry => ({
        ...entry, position: new Vector3(bounds.min.x + entry.x * dx, .45, bounds.min.z + entry.y * dz),
      })), {focusSelected}) : undefined;
      redraw();
    },
  };
}
