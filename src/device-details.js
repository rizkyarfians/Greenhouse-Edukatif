import {Vector3} from 'three';

const dialog = document.getElementById('device-details');
const title = document.getElementById('device-details-title');
const category = document.getElementById('device-details-type');
const value = document.getElementById('device-details-value');
const description = document.getElementById('device-details-description');
const actions = document.getElementById('device-details-actions');
let selected;
let actionButtons = [];

export function refreshDeviceDetails() {
  if (!dialog.open || !selected) return;
  value.textContent = selected.reading();
  actionButtons.forEach(({button,control}) => {
    button.textContent = control.textContent.trim();
    button.disabled = control.disabled;
  });
}

export function showDeviceDetails(device) {
  selected = device;
  title.textContent = device.title;
  category.textContent = {actuator: 'Aktuator simulasi', sensor: 'Sensor simulasi', equipment: 'Perangkat simulasi'}[device.type];
  description.textContent = device.description;
  actionButtons = (device.controls ?? []).map(control => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-button';
    button.addEventListener('click', () => control.click());
    return {button,control};
  });
  actions.replaceChildren(...actionButtons.map(({button}) => button));
  if (!dialog.open) dialog.showModal();
  refreshDeviceDetails();
}

export function addDeviceMarkers(viewport, devices, {focusSelected = false} = {}) {
  const point = new Vector3();
  const markers = devices.map(({position,icon,device,selected,onSelect,onKeyDown}) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'device-marker';
    marker.dataset.deviceType = device.type;
    marker.title = device.title;
    marker.setAttribute('aria-label', device.title + ' di model 3D');
    if (onSelect) marker.setAttribute('aria-pressed', String(selected));
    else marker.setAttribute('aria-haspopup','dialog');
    marker.innerHTML = icon;
    marker.querySelector('svg')?.setAttribute('aria-hidden','true');
    marker.addEventListener('click', onSelect ?? (() => showDeviceDetails(device)));
    if (onKeyDown) marker.addEventListener('keydown', onKeyDown);
    marker.hidden = true;
    viewport.append(marker);
    return {marker,position,selected};
  });

  function positionMarkers(camera, hide = false) {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const occupied = [];
    camera.updateMatrixWorld();
    for (const {marker,position,selected} of markers) {
      point.copy(position).project(camera);
      const x = (1 + point.x) * width / 2;
      let y = (1 - point.y) * height / 2;
      marker.hidden = hide || x < 18 || x > width - 18 || y < 18 || y > height - 18 ||
        Math.abs(point.z) > 1;
      if (marker.hidden) continue;
      // Give nearby device markers room to stay separately tappable.
      while (occupied.some(([left,top]) => Math.abs(left-x) < 34 && Math.abs(top-y) < 34)) y -= 35;
      if (y < 18) {
        marker.hidden = true;
        continue;
      }
      occupied.push([x,y]);
      marker.style.left = x + 'px';
      marker.style.top = y + 'px';
      if (focusSelected && selected) {
        marker.focus({preventScroll: true});
        focusSelected = false;
      }
    }
  };
  positionMarkers.dispose = () => markers.forEach(({marker}) => marker.remove());
  return positionMarkers;
}
