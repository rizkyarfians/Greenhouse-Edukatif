const radians = Math.PI / 180;
const normalize = degrees => (degrees % 360 + 360) % 360;

export function rearCameraHeading({ absolute, alpha, beta, gamma }) {
  if (!absolute || ![alpha, beta, gamma].every(Number.isFinite)) return null;

  const a = alpha * radians;
  const b = beta * radians;
  const g = gamma * radians;
  // Project the rear camera's -Z axis onto the east/north plane.
  const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const north = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  if (Math.hypot(east, north) < 0.35) return null;
  return normalize(Math.atan2(east, north) / radians);
}

export function markerDirections(position, points, heading) {
  const markers = [];
  let nearby = null;

  points.forEach((point, index) => {
    const latitude = position.lat * radians;
    const targetLatitude = point.lat * radians;
    const longitudeDelta = (point.lon - position.lon) * radians;
    const east = Math.sin(longitudeDelta) * Math.cos(targetLatitude);
    const north = Math.cos(latitude) * Math.sin(targetLatitude) -
      Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(longitudeDelta);
    const haversine = Math.sin((targetLatitude - latitude) / 2) ** 2 +
      Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    const distance = 2 * 6371008.8 * Math.asin(Math.sqrt(Math.min(1, haversine)));
    const marker = { number: index + 1, distance };

    if (distance <= Math.max(2, position.accuracy + (point.accuracy ?? 0))) {
      if (!nearby || distance < nearby.distance) nearby = marker;
      return;
    }

    const angle = normalize(Math.atan2(east, north) / radians - heading + 180) - 180;
    if (Math.abs(angle) <= 35) markers.push({ ...marker, angle });
  });

  markers.sort((a, b) => a.distance - b.distance);
  const visible = [];
  for (const marker of markers) {
    if (visible.length === 3) break;
    if (visible.every(other => Math.abs(other.angle - marker.angle) >= 29)) visible.push(marker);
  }

  return { visible, nearby };
}
