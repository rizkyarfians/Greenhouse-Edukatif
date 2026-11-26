import {allCrops} from './crop-database.js';
import {cropChoices} from './land-type.js';
import {detailedCrops} from './detailed-crops.js';

export function setupBedPreview(requestedCrop) {
  const get = id => document.getElementById(id);
  const panel = get('scan-beds'), jump = get('jump-to-beds'), select = get('bed-crop');
  const viewport = get('bed-viewport'), status = get('bed-status'), reset = get('reset-bed-camera');
  const modeled = allCrops.filter(crop => Object.hasOwn(detailedCrops, crop.id));
  let measurement, choices, type, viewer, request = 0, activeKey;

  async function draw() {
    if (!panel.open || !measurement) return;
    const key = JSON.stringify([select.value, type, measurement.valid ? measurement.xy : measurement.error]);
    if (key === activeKey) return;
    activeKey = key;
    const id = ++request;
    viewer?.dispose();
    viewer = undefined;
    viewport.hidden = true;
    reset.disabled = true;
    if (!measurement.valid) {
      status.textContent = 'Tambahkan patok sampai batas lahan membentuk polygon yang valid.';
      return;
    }
    status.textContent = 'Memuat bedengan 3D…';
    try {
      const {openBedViewer} = await import('./scan-bed-viewer.js');
      if (id !== request) return;
      const crops = select.value === 'mixed' ? choices : choices.filter(crop => crop.id === select.value);
      viewport.hidden = false;
      viewer = openBedViewer(viewport, measurement, crops);
      reset.disabled = false;
      status.textContent = viewer.beds ? viewer.beds + ' bedengan ditampilkan' +
        (select.value === 'mixed' ? ' · ' + choices.map(crop => detailedCrops[crop.id].name).join(', ') : '') + '.' :
        'Lahan terlalu sempit untuk bedengan contoh tanaman ini.';
    } catch {
      viewport.hidden = true;
      status.textContent = 'Pratinjau 3D gagal dimuat. Tutup lalu buka lagi untuk mencoba ulang.';
    }
  }

  jump.addEventListener('click', () => {
    panel.open = true;
    panel.querySelector('summary').focus({preventScroll: true});
    panel.scrollIntoView({block: 'start'});
  });
  panel.addEventListener('toggle', () => {
    if (panel.open) draw();
    else {
      request++;
      activeKey = undefined;
      viewer?.dispose();
      viewer = undefined;
    }
  });
  select.addEventListener('change', draw);
  reset.addEventListener('click', () => viewer?.reset());

  return (nextMeasurement, nextType) => {
    measurement = nextMeasurement;
    jump.disabled = !measurement.valid;
    if (nextType !== type) {
      const previous = select.value || requestedCrop;
      type = nextType;
      choices = cropChoices(modeled, type);
      select.replaceChildren(...choices.map(crop => new Option(detailedCrops[crop.id].name, crop.id)),
        new Option('Campuran', 'mixed'));
      select.value = previous === 'mixed' || choices.some(crop => crop.id === previous) ? previous : 'mixed';
    }
    draw();
  };
}
