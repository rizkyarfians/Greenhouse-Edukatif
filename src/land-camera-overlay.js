import { projectStakeMarkers, rearCameraAxes } from './land-camera-bearing.js';

export function createCameraOverlay({ button, overlay, markers, message, savedStake, camera, getPoints }) {
  let watch = null;
  let timer = null;
  let session = 0;
  let position = null;
  let orientationReading = null;
  let gpsError = null;
  let compassPermission = null;
  let openedAt = 0;
  let capture = null;
  let captureTimer = null;
  const nodes = new Map();

  function onOrientation(event) {
    if (!event.absolute) return;
    const axes = rearCameraAxes(event);
    orientationReading = { axes };
    if (axes) button.hidden = true;
  }

  function render() {
    const points = getPoints();
    const now = Date.now();
    let visible = [];
    let nearby = null;
    let label;

    const freshPosition = gpsError !== 1 && position && now - position.at <= 60000;
    if (points.length && freshPosition) {
      const accurate = position.accuracy <= 20;
      const projected = projectStakeMarkers(position, points, accurate ? orientationReading?.axes : null, {
        width: camera.clientWidth,
        height: camera.clientHeight,
        videoWidth: camera.videoWidth,
        videoHeight: camera.videoHeight,
        screenAngle: window.screen.orientation?.angle ?? window.orientation ?? 0,
      });
      visible = projected.visible;
      if (accurate) nearby = projected.nearby;
    }

    if (!points.length) label = 'Tambah patok GPS untuk memunculkan pin.';
    else if (nearby) label = 'Menjauh dari patok, lalu arahkan kamera kembali ke titiknya.';
    else if (gpsError === 1) label = 'Izin GPS ditolak. Izinkan lokasi di Chrome.';
    else if (!freshPosition) label = gpsError ? 'GPS belum dapat posisi. Coba di area terbuka.' : 'Menunggu posisi GPS…';
    else if (position.accuracy > 20) label = `Akurasi GPS ±${Math.round(position.accuracy)} m. Tunggu sampai ≤20 m.`;
    else if (compassPermission === 'denied') label = 'Izin kompas ditolak. Cek izin sensor gerak di Chrome.';
    else if (!button.hidden && !orientationReading?.axes) label = 'Ketuk Izinkan kompas HP untuk menampilkan pin AR.';
    else if (!orientationReading?.axes) label = now - openedAt < 5000
      ? 'Menunggu kompas. Gerakkan HP perlahan.'
      : 'Kompas tidak mengirim arah. Cek izin sensor gerak di Chrome.';
    else if (visible.length) label = 'Pin GPS · posisi perkiraan';
    else label = 'Patok di luar gambar. Arahkan kamera ke lokasi patok.';

    const savedText = points.length ? `◆ Patok ${points.length} terekam` : '';
    savedStake.hidden = !savedText || capture !== null || !!nearby ||
      visible.some(marker => marker.number === points.length);
    if (savedStake.textContent !== savedText) savedStake.textContent = savedText;

    if (message.textContent !== label) message.textContent = label;
    const displayed = visible.filter(marker => marker.number !== capture).map(marker => ({
      ...marker,
      text: `Patok ${marker.number} · ≈${Math.round(marker.distance)} m`,
      state: 'direction',
    }));
    if (nearby && nearby.number !== capture) {
      displayed.push({ number: nearby.number, x: 0.5, text: `Dekat Patok ${nearby.number}`, state: 'nearby' });
    }
    if (capture !== null) {
      displayed.push({ number: capture, x: 0.5, text: `Patok ${capture} tersimpan`, state: 'capture' });
    }

    const keys = new Set(displayed.map(marker => `${marker.state}-${marker.number}`));
    for (const [key, node] of nodes) {
      if (keys.has(key)) continue;
      node.remove();
      nodes.delete(key);
    }

    for (const { number, x, y, text, state } of displayed) {
      const key = `${state}-${number}`;
      let node = nodes.get(key);
      if (!node) {
        node = document.createElement('div');
        node.className = 'ls-camera-marker';
        node.dataset.state = state;
        const pin = document.createElement('span');
        pin.className = 'ls-camera-pin';
        pin.textContent = number;
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
      if (state === 'direction') node.style.top = `${y * 100}%`;
    }
  }

  function clearCapture() {
    clearTimeout(captureTimer);
    captureTimer = capture = null;
    if (!overlay.hidden) render();
  }

  function updatePosition(fix) {
    const { latitude: lat, longitude: lon, accuracy } = fix.coords;
    if (![lat, lon, accuracy, fix.timestamp].every(Number.isFinite) || accuracy < 0) return;
    if (position && fix.timestamp < position.at) return;
    position = { lat, lon, accuracy, at: fix.timestamp };
    gpsError = null;
  }

  function showCapture(number, fix) {
    clearTimeout(captureTimer);
    updatePosition(fix);
    capture = number;
    render();
    captureTimer = setTimeout(clearCapture, 1800);
  }

  function stop() {
    session++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    clearInterval(timer);
    clearTimeout(captureTimer);
    captureTimer = capture = null;
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
    watch = timer = position = orientationReading = null;
    gpsError = compassPermission = null;
    nodes.clear();
    markers.replaceChildren();
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
    timer = setInterval(render, 100);
    render();
  }

  return { stop, startAutomatically, showCapture, clearCapture };
}
