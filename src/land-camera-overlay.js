import { projectStakeMarkers, rearCameraAxes, steadyCameraAxes, steadyCameraFix } from './land-camera-bearing.js';

const cameraDirections = {
  behind: 'Putar badan menghadap',
  left: 'Geser kamera ke kiri menuju',
  right: 'Geser kamera ke kanan menuju',
  up: 'Angkat kamera ke arah',
  down: 'Turunkan kamera ke arah',
};

export function createCameraOverlay({ button, overlay, markers, models, message, savedStake, camera, getPoints }) {
  let watch = null;
  let timer = null;
  let session = 0;
  let position = null;
  let orientationReading = null;
  let gpsError = null;
  let compassPermission = null;
  let openedAt = 0;
  let modelLayer = null;
  let modelLoading = false;
  const nodes = new Map();

  function onOrientation(event) {
    if (!event.absolute) return;
    const axes = rearCameraAxes(event);
    orientationReading = { axes: steadyCameraAxes(orientationReading?.axes, axes) };
    if (axes) button.hidden = true;
  }

  function render() {
    const points = getPoints();
    const now = Date.now();
    let visible = [];
    let nearby = null;
    let offscreen = null;
    const view = {
      width: camera.clientWidth,
      height: camera.clientHeight,
      videoWidth: camera.videoWidth,
      videoHeight: camera.videoHeight,
      screenAngle: window.screen.orientation?.angle ?? window.orientation ?? 0,
    };
    let modelView = view;
    let label;

    const freshPosition = gpsError !== 1 && position && now - position.at <= 60000;
    if (points.length && freshPosition) {
      const accurate = position.accuracy <= 20;
      const projected = projectStakeMarkers(position, points, accurate ? orientationReading?.axes : null, view);
      modelView = { ...view, focal: projected.focal, up: projected.up };
      visible = projected.visible;
      if (accurate) {
        nearby = projected.nearby;
        offscreen = projected.offscreen;
      }
    }

    if (!points.length) label = 'Tambah patok GPS untuk memunculkan pin.';

    else if (gpsError === 1) label = 'Izin GPS ditolak. Izinkan lokasi di Chrome.';
    else if (!freshPosition) label = gpsError ? 'GPS belum dapat posisi. Coba di area terbuka.' : 'Menunggu posisi GPS…';
    else if (position.accuracy > 20) label = `Akurasi GPS ±${Math.round(position.accuracy)} m. Tunggu sampai ≤20 m.`;
    else if (compassPermission === 'denied') label = 'Izin kompas ditolak. Cek izin sensor gerak di Chrome.';
    else if (!button.hidden && !orientationReading?.axes) label = 'Ketuk Izinkan kompas HP untuk menampilkan pin AR.';
    else if (!orientationReading?.axes) label = now - openedAt < 5000
      ? 'Menunggu kompas. Gerakkan HP perlahan.'
      : 'Kompas tidak mengirim arah. Cek izin sensor gerak di Chrome.';
    else if (visible.length) label = modelLoading ? 'Memuat model patok 3D…' : 'Patok 2D · model bambu tidak dapat digambar.';
    else if (offscreen) label = `${cameraDirections[offscreen.direction]} Patok ${offscreen.number} (≈${Math.round(offscreen.distance)} m).`;
    else if (nearby) label = `Menjauh hingga sekitar ${Math.ceil(nearby.uncertainty) + 2} m dari Patok ${nearby.number}, lalu bidik balik.`;
    else label = 'Patok di luar gambar. Arahkan kamera ke lokasi patok.';

    const savedText = nearby ? `◆ Dekat Patok ${nearby.number}` :
      points.length ? `◆ Patok ${points.length} terekam` : '';
    savedStake.hidden = !savedText || (!nearby && visible.some(marker => marker.number === points.length));
    if (savedStake.textContent !== savedText) savedStake.textContent = savedText;

    const keys = new Set(visible.map(marker => marker.number));
    for (const [key, node] of nodes) {
      if (keys.has(key)) continue;
      node.remove();
      nodes.delete(key);
    }

    for (const { number: key, x, y, distance } of visible) {
      const text = `Patok ${key} · ≈${Math.round(distance)} m`;
      let node = nodes.get(key);
      if (!node) {
        node = document.createElement('div');
        node.className = 'ls-camera-marker';
        node.dataset.state = 'direction';
        const pin = document.createElement('span');
        pin.className = 'ls-camera-pin';
        pin.textContent = key;
        pin.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'ls-camera-pin-label';
        label.textContent = text;
        node.append(pin, label);
        markers.append(node);
        nodes.set(key, node);
      }
      if (node.lastElementChild.textContent !== text) node.lastElementChild.textContent = text;
      node.style.left = `${x * 100}%`;
      node.style.top = `${y * 100}%`;
    }

    const drewModels = modelLayer?.draw(visible, modelView) ?? false;
    overlay.classList.toggle('has-stake-models', drewModels);
    if (drewModels) label = 'Patok bambu 3D · posisi perkiraan GPS';
    if (message.textContent !== label) message.textContent = label;
  }

  function updatePosition(fix) {
    const { latitude: lat, longitude: lon, accuracy } = fix.coords;
    if (![lat, lon, accuracy, fix.timestamp].every(Number.isFinite) || accuracy < 0) return;
    if (position && fix.timestamp < position.at) return;
    position = steadyCameraFix(position, { lat, lon, accuracy, at: fix.timestamp });
    gpsError = null;
  }

  function usePositionFix(fix) {
    updatePosition(fix);
    render();
  }

  function stop() {
    session++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    clearInterval(timer);
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
    watch = timer = position = orientationReading = null;
    gpsError = compassPermission = null;
    nodes.clear();
    markers.replaceChildren();
    modelLayer?.dispose();
    modelLayer = null;
    modelLoading = false;
    overlay.classList.remove('has-stake-models');
    savedStake.hidden = true;
    overlay.hidden = true;
    button.hidden = true;
    button.disabled = false;
  }

  button.addEventListener('click', async () => {
    const request = session;
    button.disabled = true;
    try {
      const permission = await window.DeviceOrientationEvent.requestPermission(true);
      if (request !== session) return;
      compassPermission = permission;
      button.hidden = permission === 'granted';
    } catch {
      if (request === session) compassPermission = 'denied';
    } finally {
      if (request === session) {
        button.disabled = false;
        render();
      }
    }
  });

  function startAutomatically() {
    if (timer !== null) return;
    const request = ++session;
    openedAt = Date.now();
    overlay.hidden = false;
    button.hidden = typeof window.DeviceOrientationEvent?.requestPermission !== 'function';
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(fix => {
        if (request === session) updatePosition(fix);
      }, error => {
        if (request === session) gpsError = error.code;
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    }
    modelLoading = true;
    import('./land-camera-stake-model.js').then(({ createStakeModelLayer }) => {
      if (request !== session) return;
      modelLayer = createStakeModelLayer(models);
    }).catch(() => {
      // Numbered markers remain usable when the renderer cannot load.
    }).finally(() => {
      if (request !== session) return;
      modelLoading = false;
      render();
    });
    timer = setInterval(render, 50);
    render();
  }

  return { stop, startAutomatically, usePositionFix };
}
