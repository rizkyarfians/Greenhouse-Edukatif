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

export function openCropGarden({crop, measurement, label}) {
  const viewport = document.getElementById('crop-viewport');
  const reset = document.getElementById('reset-crop-view');
  const viewer = openBedViewer(viewport, measurement, [crop]);
  const name = detailedCrops[crop.id].name;
  const canvas = viewport.querySelector('canvas');
  canvas.dataset.crop = crop.id;
  canvas.setAttribute('aria-label', 'Model 3D kebun ' + name);
  document.getElementById('crop-view-caption').textContent = label;
  document.getElementById('crop-bed-count').textContent = viewer.beds
    ? viewer.beds.toLocaleString('id-ID') + ' bedengan contoh'
    : 'Ruang untuk bedengan contoh belum cukup';
  reset.disabled = false;
  reset.addEventListener('click', viewer.reset);

  return {
    snapshotSimulation: () => ({}),
    pauseSimulation() {
      reset.removeEventListener('click', viewer.reset);
      viewer.dispose();
    },
  };
}
