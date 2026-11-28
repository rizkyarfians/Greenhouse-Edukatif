import pump from 'lucide-static/icons/gauge.svg?raw';
import valve from 'lucide-static/icons/sliders-horizontal.svg?raw';
import air from 'lucide-static/icons/thermometer.svg?raw';
import soil from 'lucide-static/icons/sprout.svg?raw';
import water from 'lucide-static/icons/droplet.svg?raw';
import tank from 'lucide-static/icons/cylinder.svg?raw';
import panel from 'lucide-static/icons/panels-top-left.svg?raw';
import pencil from 'lucide-static/icons/pencil.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import presetIcon from 'lucide-static/icons/layout-template.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import {deviceCatalog, deviceLimit, defaultDripDevices, insideDevicePlan} from './device-layout-state.js';
import {showDeviceDetails} from './device-details.js';

const icons = {pump, valve, air, soil, water, tank, panel};
const sampleReadings = {air: '26 °C · 68 % RH (contoh)', soil: '48 % (contoh)', water: '72 % (contoh)', tank: '72 % (contoh)'};
const keyboardSteps = {ArrowDown: [0,.02], ArrowUp: [0,-.02], ArrowRight: [.02,0], ArrowLeft: [-.02,0]};
const get = id => document.getElementById(id);

function labelTool(button, name, icon) {
  button.title = name;
  button.setAttribute('aria-label', name);
  if (icon) {
    button.innerHTML = icon;
    button.firstElementChild.setAttribute('aria-hidden', 'true');
  }
}

export function openDeviceLayout(project, simulation) {
  const surface = simulation.deviceSurface?.();
  if (!surface) return {snapshot: () => project.devices, close() {}};

  const abort = new AbortController();
  const listen = (element, type, handler, capture = false) =>
    element.addEventListener(type, handler, {signal: abort.signal, capture});
  const editor = get('device-editor');
  const feedback = get('device-feedback');
  const help = get('device-edit-help');
  const hint = get('device-edit-hint');
  const monitor = get('device-monitoring');
  const toggle = get('edit-layout-devices');
  const presetButton = get('device-preset');
  const remove = get('remove-layout-device');
  const placeDefault = get('place-device-default');
  const {viewport, outline} = surface;
  const viewportRow = viewport.parentElement;
  const container = editor.parentElement;

  const paddy = project.type === 'rice' && !project.cropId;
  const paddyPositions = [['valve', .83, .77], ['soil', .38, .43], ['water', .64, .47], ['panel', .84, .89]];
  const preset = () => defaultDripDevices(outline, paddy ? paddyPositions : undefined);
  const isNew = project.updatedAt === undefined;
  let devices = project.devices ?? (isNew && project.type === 'greenhouse' ? preset() : undefined);
  let editing = isNew;
  let kind, selected, pointerStart;

  labelTool(presetButton, paddy ? 'Pakai preset sawah' : 'Pakai preset drip', presetIcon);
  labelTool(remove, 'Lepas perangkat', trash);
  const tools = Object.entries(deviceCatalog).map(([id, {name}]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'device-tool';
    labelTool(button, name, icons[id]);
    listen(button, 'click', () => {
      editing = true;
      kind = kind === id ? undefined : id;
      selected = undefined;
      render();
    });
    return {id, button};
  });

  function deviceDetails(entry, index) {
    const spec = deviceCatalog[entry.kind];
    return {
      type: spec.type,
      title: spec.name + (index > 0 ? ' ' + (index + 1) : ''),
      description: spec.description,
      reading: () => {
        if (entry.kind === 'panel') return devices.length + ' perangkat pada layout';
        return simulation.deviceReading?.(entry.kind) ?? sampleReadings[entry.kind] ?? 'Kontrol simulasi tidak tersedia';
      },
      controls: simulation.deviceControls?.(entry.kind) ?? [],
    };
  }

  function render(message, focusSelected = false) {
    const items = devices ?? [];
    const active = items.find(entry => entry.id === selected);
    labelTool(toggle, editing ? 'Selesai mengatur perangkat' : 'Atur perangkat', editing ? check : pencil);
    toggle.setAttribute('aria-pressed', String(editing));
    for (const tool of tools) tool.button.setAttribute('aria-pressed', String(kind === tool.id));
    remove.hidden = !active;
    placeDefault.hidden = !kind;
    help.hidden = !editing;
    hint.textContent = message ?? (kind ? 'Ketuk lahan untuk memasang ' + deviceCatalog[kind].name + '.' :
      active ? 'Ketuk posisi baru untuk memindahkan ' + deviceCatalog[active.kind].name + '.' :
      'Pilih ikon untuk memasang perangkat, atau pilih perangkat di model untuk memindahkannya.');
    viewport.classList.toggle('device-placing', Boolean(kind || active));
    viewport.classList.toggle('device-editing', editing);
    surface.editing = editing;
    const rows = items.map((entry, index) => {
      const duplicateIndex = items.slice(0,index).filter(other => entry.kind === other.kind).length;
      const device = deviceDetails(entry, duplicateIndex);
      return {
        ...entry, device, icon: icons[entry.kind], selected: active?.id === entry.id,
        onSelect: editing ? () => {
          kind = undefined;
          selected = selected === entry.id ? undefined : entry.id;
          render(undefined, true);
        } : undefined,
        onKeyDown: editing ? event => {
          if (!Object.hasOwn(keyboardSteps, event.key)) return;
          event.preventDefault();
          const [dx, dy] = keyboardSteps[event.key];
          selected = entry.id;
          kind = undefined;
          place({x: entry.x + dx, y: entry.y + dy}, true);
        } : undefined,
      };
    });
    monitor.hidden = editing;
    monitor.replaceChildren(...(editing ? [] : rows.map(({device}) => {
      const button = document.createElement('button');
      button.className = 'secondary-button';
      button.type = 'button';
      button.textContent = device.title;
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => showDeviceDetails(device));
      return button;
    })));
    surface.setDevices(rows.filter(({x,y}) => insideDevicePlan(outline, x, y)), focusSelected);
  }

  function update(next, message, focusSelected) {
    devices = next;
    simulation.deviceLayoutApplied?.(devices);
    render(message, focusSelected);
  }

  function place(point, fromKeyboard = false) {
    if (!point || !insideDevicePlan(outline, point.x, point.y)) {
      if (fromKeyboard) render('Pilih posisi di dalam batas lahan.', true);
      else hint.textContent = 'Pilih posisi di dalam batas lahan.';
      return;
    }
    if (kind) {
      if ((devices?.length ?? 0) >= deviceLimit) {
        hint.textContent = 'Maksimal ' + deviceLimit + ' perangkat dalam satu layout.';
        return;
      }
      selected = crypto.randomUUID();
      const entry = {id: selected, kind, ...point};
      kind = undefined;
      update([...(devices ?? []), entry], undefined, fromKeyboard);
    } else if (selected) {
      update(devices.map(entry => entry.id === selected ? {...entry, ...point} : entry), undefined, fromKeyboard);
    }
  }

  listen(viewport, 'pointerdown', event => {
    pointerStart = event.target instanceof HTMLCanvasElement && event.isPrimary && event.button === 0 ?
      {id: event.pointerId, x: event.clientX, y: event.clientY} : undefined;
  }, true);
  listen(viewport, 'pointercancel', () => { pointerStart = undefined; });
  listen(viewport, 'pointerup', event => {
    const start = pointerStart;
    pointerStart = undefined;
    if (!editing || !(kind || selected) || start?.id !== event.pointerId ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    place(surface.groundPoint(event.clientX, event.clientY));
  }, true);

  listen(placeDefault, 'click', () => {
    const [point] = defaultDripDevices(outline, [[kind, .5, .5]]);
    place(point && {x: point.x, y: point.y}, true);
  });
  listen(remove, 'click', () => {
    const remaining = devices.filter(entry => entry.id !== selected);
    selected = undefined;
    update(remaining, 'Perangkat dilepas.');
    toggle.focus({preventScroll: true});
  });
  listen(presetButton, 'click', () => {
    editing = true;
    selected = kind = undefined;
    update(preset(), 'Preset sudah terpasang. Pilih perangkat di model untuk memindahkannya.');
  });
  listen(toggle, 'click', () => {
    editing = !editing;
    kind = selected = undefined;
    render();
  });

  viewport.before(editor);
  viewportRow.after(feedback);
  get('device-toolbox').replaceChildren(...tools.map(tool => tool.button));
  editor.hidden = feedback.hidden = false;
  simulation.deviceLayoutApplied?.(devices ?? []);
  render();

  return {
    snapshot: () => devices,
    close() {
      abort.abort();
      surface.editing = false;
      surface.setDevices([]);
      viewport.classList.remove('device-placing', 'device-editing');
      editor.hidden = feedback.hidden = true;
      container.append(editor, feedback);
    },
  };
}
