import {deviceCatalog, deviceLimit, defaultDripDevices, insideDevicePlan, rectangularPlan} from './device-layout-state.js';
import {refreshDeviceDetails, showDeviceDetails} from './device-details.js';

const sampleReadings = {air: '26 °C · 68 % RH (contoh)', soil: '48 % (contoh)', water: '72 % (contoh)', tank: '72 % (contoh)'};
const get = id => document.getElementById(id);
const node = (tag, cls, text) => {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function openDeviceLayout(project, simulation) {
  const abort = new AbortController();
  const listen = (id, type, handler) => get(id).addEventListener(type, handler, {signal: abort.signal});
  const workspace = get('device-workspace');
  const plan = get('device-plan');
  const surface = simulation.deviceSurface?.();
  const outline = surface?.outline ?? rectangularPlan;
  const paddy = project.type === 'rice' && !project.cropId;
  const paddyPositions = [['valve', .83, .77], ['soil', .38, .43], ['water', .64, .47], ['panel', .84, .89]];
  const preset = () => defaultDripDevices(outline, paddy ? paddyPositions : undefined);
  get('device-preset').textContent = paddy ? 'Pakai preset sawah' : 'Pakai preset drip';
  const greenhouse = project.type === 'greenhouse';
  const isNew = project.updatedAt === undefined;
  let applied = project.devices;
  let draft = applied ?? (greenhouse ? preset() : []);
  let kind, selected;
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  area.setAttribute('viewBox', '0 0 100 100');
  area.setAttribute('preserveAspectRatio', 'none');
  area.setAttribute('aria-hidden', 'true');
  const boundary = document.createElementNS(area.namespaceURI, 'polygon');
  boundary.setAttribute('points', outline.map(([x,y]) => (x*100) + ',' + (y*100)).join(' '));
  area.append(boundary);
  for (const [x, from, to] of surface?.rows ?? []) {
    const row = document.createElementNS(area.namespaceURI, 'line');
    for (const [attr, value] of Object.entries({x1: x, x2: x, y1: from, y2: to})) {
      row.setAttribute(attr, value * 100);
    }
    area.append(row);
  }
  plan.style.aspectRatio = Math.max(.65, Math.min(2.3, surface?.aspect ?? 1.5));
  const tools = Object.entries(deviceCatalog).map(([id, device]) => {
    const button = node('button', 'secondary-button', device.name);
    button.type = 'button';
    button.addEventListener('click', () => {
      kind = id;
      selected = undefined;
      get('device-layout-status').textContent = '';
      drawPlan();
    });
    return {id, button};
  });
  get('device-toolbox').replaceChildren(...tools.map(tool => tool.button));
  get('device-layout-status').textContent = '';

  function coordinatesFor(device) {
    const button = node('button', 'device-plan-marker', deviceCatalog[device.kind].symbol);
    button.type = 'button';
    button.style.left = device.x * 100 + '%';
    button.style.top = device.y * 100 + '%';
    const name = deviceCatalog[device.kind].name;
    button.title = name;
    button.setAttribute('aria-label', name + ' di denah');
    button.setAttribute('aria-pressed', String(selected === device.id));
    button.addEventListener('click', event => {
      if (kind) return;
      event.stopPropagation();
      selected = device.id;
      drawPlan();
      plan.querySelector('[aria-pressed="true"]')?.focus();
    });
    return button;
  }

  function drawPlan() {
    for (const tool of tools) tool.button.setAttribute('aria-pressed', String(kind === tool.id));
    plan.classList.toggle('placing', Boolean(kind));
    plan.replaceChildren(area, ...draft.map(coordinatesFor));
    if (kind) {
      const add = node('button', 'secondary-button device-add-at-center', 'Pasang di posisi awal');
      add.type = 'button';
      add.addEventListener('click', event => {
        event.stopPropagation();
        const [point] = defaultDripDevices(outline, [[kind, .5, .5]]);
        if (point) addDevice(point.x, point.y);
        else get('device-layout-status').textContent = 'Pilih titik langsung di dalam batas denah.';
      });
      get('device-edit-hint').replaceChildren(node('span', '', 'Pilih posisi ' + deviceCatalog[kind].name + ' di denah. '), add);
    } else {
      get('device-edit-hint').textContent = 'Pilih perangkat, lalu klik posisinya di denah.';
    }
    const device = draft.find(entry => entry.id === selected);
    const position = get('device-position');
    position.hidden = !device;
    if (device) {
      get('device-x').value = Math.round(device.x * 100);
      get('device-y').value = Math.round(device.y * 100);
    }
  }

  function addDevice(x, y) {
    if (draft.length >= deviceLimit) {
      get('device-layout-status').textContent = 'Maksimal ' + deviceLimit + ' perangkat dalam satu layout.';
      return;
    }
    selected = crypto.randomUUID();
    draft = [...draft, {id: selected, kind, x, y}];
    kind = undefined;
    drawPlan();
    plan.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    get('device-layout-status').textContent = '';
  }

  function edit(show) {
    get('device-editor').hidden = !show;
    get('edit-layout-devices').setAttribute('aria-expanded', String(show));
    if (!show) return;
    draft = applied ?? (greenhouse ? preset() : []);
    kind = selected = undefined;
    get('device-layout-status').textContent = '';
    drawPlan();
  }

  function deviceDetails(entry, index) {
    const spec = deviceCatalog[entry.kind];
    const controls = simulation.deviceControls?.(entry.kind) ?? [];
    return {
      type: spec.type,
      title: spec.name + (index > 0 ? ' ' + (index + 1) : ''),
      description: spec.description,
      reading: () => {
        if (entry.kind === 'panel') return applied.length + ' perangkat pada layout';
        return simulation.deviceReading?.(entry.kind) ?? sampleReadings[entry.kind] ?? 'Kontrol simulasi tidak tersedia';
      },
      controls,
    };
  }

  function updateMonitoring() {
    const rows = (applied ?? []).map((entry, index, list) => {
      const duplicateIndex = list.slice(0,index).filter(other => entry.kind === other.kind).length;
      const {symbol} = deviceCatalog[entry.kind];
      return {...entry, icon: '<span aria-hidden="true">' + symbol + '</span>', device: deviceDetails(entry, duplicateIndex)};
    });
    get('device-monitoring').replaceChildren(...rows.map(({device}) => {
      const button = node('button', 'secondary-button', device.title);
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => showDeviceDetails(device));
      return button;
    }));
    simulation.deviceLayoutApplied?.(applied ?? []);
    surface?.setDevices(rows.filter(({x,y}) => insideDevicePlan(outline, x,y)));
  }

  listen('device-plan', 'click', event => {
    if (!kind) return;
    const rect = plan.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    if (!insideDevicePlan(outline, x, y) || x < .01 || y < .01 || x > .99 || y > .99) {
      get('device-layout-status').textContent = 'Pilih posisi di dalam batas denah.';
      return;
    }
    addDevice(x, y);
  });
  for (const axis of ['x','y']) {
    listen('device-' + axis, 'change', event => {
      const position = event.target;
      const device = draft.find(entry => entry.id === selected);
      if (!device) return;
      const updated = {...device, [axis]: Number(position.value) / 100};
      if (insideDevicePlan(outline, updated.x, updated.y)) {
        draft = draft.map(entry => entry.id === selected ? updated : entry);
        get('device-layout-status').textContent = '';
      } else {
        get('device-layout-status').textContent = 'Posisi harus di dalam batas denah.';
      }
      drawPlan();
    });
  }
  listen('remove-layout-device', 'click', () => {
    draft = draft.filter(entry => entry.id !== selected);
    selected = undefined;
    drawPlan();
    tools[0].button.focus({preventScroll:true});
  });
  listen('device-preset', 'click', () => {
    draft = preset();
    selected = kind = undefined;
    drawPlan();
    get('device-layout-status').textContent = 'Posisi preset siap diedit atau diterapkan.';
  });
  listen('edit-layout-devices', 'click', () => edit(get('device-editor').hidden));
  listen('cancel-layout-devices', 'click', () => {
    edit(false);
    get('edit-layout-devices').focus({preventScroll:true});
  });
  listen('apply-layout-devices', 'click', () => {
    applied = draft;
    edit(false);
    updateMonitoring();
    get('device-layout-status').textContent = applied.length + ' perangkat diterapkan. Tekan Simpan layout untuk menyimpan.';
    get('edit-layout-devices').focus({preventScroll:true});
    refreshDeviceDetails();
  });

  workspace.hidden = false;
  edit(isNew);
  updateMonitoring();
  return {
    snapshot: () => applied,
    close() {
      abort.abort();
      surface?.setDevices([]);
      workspace.hidden = true;
    },
  };
}
