export const deviceCatalog = {
  pump: {name: 'Pompa', type: 'actuator', description: 'Menjalankan irigasi simulasi.'},
  valve: {name: 'Katup irigasi', type: 'actuator', description: 'Membuka atau menutup aliran irigasi simulasi.'},
  air: {name: 'Sensor suhu & kelembapan udara', type: 'sensor', description: 'Menampilkan suhu dan kelembapan udara simulasi.'},
  soil: {name: 'Sensor kelembapan tanah', type: 'sensor', description: 'Menampilkan kelembapan media atau tanah simulasi.'},
  water: {name: 'Sensor air', type: 'sensor', description: 'Menampilkan level tandon atau tinggi genangan untuk sawah.'},
  tank: {name: 'Tandon air', type: 'equipment', description: 'Menampilkan cadangan air untuk irigasi.'},
  panel: {name: 'Panel box', type: 'equipment', description: 'Titik penempatan panel kontrol dan pengkabelan lahan.'},
};

export const deviceLimit = 24;

export function validateDevices(devices) {
  if (!Array.isArray(devices) || devices.length > deviceLimit) return undefined;
  const ids = new Set();
  const clean = [];
  for (const device of devices) {
    if (!device || typeof device.id !== 'string' || !/^[\w-]{1,40}$/.test(device.id) ||
        (typeof device.kind !== 'string' || !Object.hasOwn(deviceCatalog, device.kind)) || ids.has(device.id) ||
        ![device.x, device.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return undefined;
    ids.add(device.id);
    clean.push({id: device.id, kind: device.kind, x: device.x, y: device.y});
  }
  return clean;
}

export const rectangularPlan = [[0,0],[1,0],[1,1],[0,1]];
const preset = [
  ['tank', .16, .82], ['pump', .38, .84], ['panel', .82, .85],
  ['air', .73, .30], ['soil', .39, .43], ['water', .15, .66], ['valve', .58, .65],
];

export function insideDevicePlan(polygon, x, y) {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[(i + 1) % polygon.length];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

export function defaultDripDevices(polygon, desired = preset) {
  const used = [];
  return desired.map(([kind, x, y]) => {
    if (!insideDevicePlan(polygon, x, y)) {
      let best = Infinity;
      const requestedX = x, requestedY = y;
      for (let row = 1; row < 40; row++) {
        for (let col = 1; col < 40; col++) {
          const px = col / 40, py = row / 40;
          const score = (px - requestedX) ** 2 + (py - requestedY) ** 2;
          if (score >= best || !insideDevicePlan(polygon, px, py) ||
              used.some(point => Math.hypot(px-point.x, py-point.y) < .08)) continue;
          [x, y, best] = [px, py, score];
        }
      }
    }
    const device = {id: kind + '-default', kind, x, y};
    used.push(device);
    return device;
  }).filter(device => insideDevicePlan(polygon, device.x, device.y));
}
