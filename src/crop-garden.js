import {refreshDeviceDetails} from './device-details.js';
import {allCrops} from './crop-database.js';
import {detailedCrops} from './detailed-crops.js';
import {measure} from './land-geometry.js';
import {loadLand} from './land-storage.js';
import {openBedViewer} from './scan-bed-viewer.js';

export async function loadCropGarden(cropId, landType) {
  const crop = allCrops.find(entry => entry.id === cropId);
  try {
    const profile = await loadLand();
    if (profile?.landType === landType) {
      const measurement = measure(profile.points);
      if (measurement.valid) return {crop, measurement, label: 'Dari patok tersimpan · ' + profile.name};
      return sampleGarden(crop, 'Lengkapi batas patok untuk memakai lahan lu.');
    }
    if (profile) return sampleGarden(crop, 'Jenis lahan tersimpan berbeda dari simulasi ini.');
    return sampleGarden(crop, 'Simpan batas patok untuk memakai lahan lu.');
  } catch {
    return sampleGarden(crop, 'Simpanan patok gagal dimuat.');
  }
}

function sampleGarden(crop, note) {
  const width = crop.spacing[0] * 5.1;
  const depth = crop.spacing[1] * 12;
  const xy = [[0, 0], [width, 0], [width, depth], [0, depth]];
  return {crop, measurement: {xy}, label: 'Kebun contoh · ' + note};
}

export function openCropGarden({crop, measurement, label}, {greenhouse}) {
  const viewport = document.getElementById('crop-viewport');
  const reset = document.getElementById('reset-crop-view');
  const viewer = openBedViewer(viewport, measurement, [crop], {greenhouse, deviceLayout: true});
  const name = detailedCrops[crop.id].name;
  const canvas = viewport.querySelector('canvas');
  canvas.dataset.crop = crop.id;
  canvas.dataset.environment = greenhouse ? 'greenhouse' : 'open-field';
  canvas.setAttribute('aria-label', 'Model 3D ' + (greenhouse ? 'greenhouse ' : 'kebun terbuka ') + name);
  document.getElementById('crop-view-caption').textContent = label;
  document.getElementById('crop-bed-count').textContent = viewer.beds
    ? viewer.beds.toLocaleString('id-ID') + ' bedengan contoh'
    : 'Ruang untuk bedengan contoh belum cukup';
  reset.disabled = false;
  reset.addEventListener('click', viewer.reset);

  const roof = document.getElementById('toggle-crop-roof');
  const drip = document.getElementById('toggle-crop-drip');
  const status = document.getElementById('crop-drip-status');
  let roofVisible = true;
  let running = false;

  function toggleRoof() {
    roofVisible = !roofVisible;
    viewer.setRoof(roofVisible);
    roof.textContent = roofVisible ? 'Sembunyikan atap' : 'Tampilkan atap';
  }

  function toggleDrip() {
    running = !running;
    viewer.setDrip(running);
    drip.textContent = running ? 'Hentikan drip' : 'Jalankan drip';
    status.textContent = running ? 'Simulasi aliran aktif.' : 'Simulasi aliran mati.';
    refreshDeviceDetails();
  }

  if (greenhouse) {
    roof.textContent = 'Sembunyikan atap';
    roof.disabled = false;
    roof.addEventListener('click', toggleRoof);
  }
  drip.textContent = 'Jalankan drip';
  status.textContent = viewer.beds ? 'Simulasi aliran mati.' : 'Butuh bedengan untuk menjalankan irigasi.';
  drip.disabled = !viewer.beds;
  drip.addEventListener('click', toggleDrip);

  return {
    deviceSurface: () => viewer.deviceSurface,
    deviceControls: kind => kind === 'pump' || kind === 'valve' ? [drip] : [],
    deviceReading: kind => kind === 'pump' || kind === 'valve' ? status.textContent : undefined,
    deviceLayoutApplied(devices) {
      const active = devices.some(device => device.kind === 'pump' || device.kind === 'valve');
      if (!greenhouse && !active && running) toggleDrip();
      viewer.setDripVisible(active);
    },
    capturePreview: viewer.capturePreview,
    snapshotSimulation: () => ({}),
    pauseSimulation() {
      reset.removeEventListener('click', viewer.reset);
      roof.removeEventListener('click', toggleRoof);
      drip.removeEventListener('click', toggleDrip);
      viewer.dispose();
    },
  };
}
