import { markerDirections, rearCameraHeading } from './land-camera-bearing.js';

export function createCameraOverlay({ button, overlay, markers, message, getPoints }) {
  let watch = null;
  let timer = null;
  let session = 0;
  let position = null;
  let orientationReading = null;
  let gpsError = false;
  const nodes = new Map();

  function onOrientation(event) {
    if (!event.absolute) return;
    orientationReading = [event.alpha, event.beta, event.gamma].every(Number.isFinite)
      ? { heading: rearCameraHeading(event) } : { unavailable: true };
  }

  function render() {
    const points = getPoints();
    const now = Date.now();
    let visible = [];
    let label;

    if (!points.length) label = 'Tambahkan patok GPS untuk menampilkan arah.';
    else if (gpsError) label = 'GPS tidak tersedia. Cek izin lokasi HP.';
    else if (!position || now - position.at > 60000) label = 'Menunggu lokasi GPS terbaru…';
    else if (position.accuracy > 20) label = 'GPS kurang akurat. Tunggu sinyal membaik.';
    else if (!orientationReading) label = 'Menunggu kompas. Arahkan HP dan putar perlahan.';
    else if (orientationReading.unavailable) label = 'Arah kompas tidak tersedia di browser ini.';
    else if (orientationReading.heading === null) label = 'Arahkan kamera mendatar ke lahan.';
    else {
      const directions = markerDirections(position, points, orientationReading.heading);
      visible = directions.visible;
      label = directions.nearby ? `Di sekitar Patok ${directions.nearby.number}` :
        visible.length ? 'Arah perkiraan · GPS + kompas' : 'Putar HP untuk mencari arah patok.';
    }

    if (message.textContent !== label) message.textContent = label;
    const visibleNumbers = new Set(visible.map(marker => marker.number));
    for (const [number, node] of nodes) {
      if (visibleNumbers.has(number)) continue;
      node.remove();
      nodes.delete(number);
    }

    for (const { number, distance, angle } of visible) {
      let node = nodes.get(number);
      if (!node) {
        node = document.createElement('span');
        node.className = 'ls-camera-marker';
        markers.append(node);
        nodes.set(number, node);
      }
      const text = `Patok ${number} · ${Math.round(distance)} m`;
      if (node.textContent !== text) node.textContent = text;
      node.style.left = `${50 + angle * 32 / 35}%`;
    }
  }

  function stop() {
    session++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    clearInterval(timer);
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
    watch = timer = position = orientationReading = null;
    gpsError = false;
    nodes.clear();
    markers.replaceChildren();
    overlay.hidden = true;
    button.disabled = false;
    button.textContent = 'Tampilkan arah patok';
  }

  button.addEventListener('click', async () => {
    if (timer !== null) {
      stop();
      return;
    }

    const request = ++session;
    const orientation = window.DeviceOrientationEvent;
    overlay.hidden = false;
    if (!orientation || !navigator.geolocation) {
      message.textContent = 'GPS atau kompas tidak tersedia di browser ini.';
      return;
    }

    button.disabled = true;
    try {
      const permission = typeof orientation.requestPermission === 'function'
        ? await orientation.requestPermission(true) : 'granted';
      if (request !== session) return;
      if (permission !== 'granted') {
        message.textContent = 'Izin kompas belum diberikan.';
        return;
      }

      window.addEventListener('deviceorientationabsolute', onOrientation);
      window.addEventListener('deviceorientation', onOrientation);
      watch = navigator.geolocation.watchPosition(fix => {
        if (request !== session) return;
        const { latitude: lat, longitude: lon, accuracy } = fix.coords;
        position = [lat, lon, accuracy].every(Number.isFinite)
          ? { lat, lon, accuracy, at: fix.timestamp } : null;
        gpsError = false;
      }, () => {
        if (request !== session) return;
        position = null;
        gpsError = true;
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });

      timer = setInterval(render, 150);
      button.textContent = 'Sembunyikan arah patok';
      render();
    } catch {
      if (request !== session) return;
      stop();
      overlay.hidden = false;
      message.textContent = 'Arah patok tidak tersedia. Cek izin sensor dan lokasi.';
    } finally {
      if (request === session) button.disabled = false;
    }
  });

  return { stop };
}
