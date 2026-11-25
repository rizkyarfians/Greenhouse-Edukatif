const radians = Math.PI / 180;
const earthRadiusM = 6371008.8;

// Columns of the intrinsic Z-X-Y rotation, with the rear camera looking along -Z.
export function rearCameraAxes({ absolute, alpha, beta, gamma }) {
  if (!absolute || ![alpha, beta, gamma].every(Number.isFinite)) return null;

  const cosA = Math.cos(alpha * radians);
  const sinA = Math.sin(alpha * radians);
  const cosB = Math.cos(beta * radians);
  const sinB = Math.sin(beta * radians);
  const cosG = Math.cos(gamma * radians);
  const sinG = Math.sin(gamma * radians);

  return {
    right: [cosA * cosG - sinA * sinB * sinG, sinA * cosG + cosA * sinB * sinG, -cosB * sinG],
    up: [-sinA * cosB, cosA * cosB, sinB],
    forward: [-cosA * sinG - sinA * sinB * cosG, -sinA * sinG + cosA * sinB * cosG, -cosB * cosG],
  };
}

function groundOffset(origin, target) {
  const latitude = origin.lat * radians;
  const targetLatitude = target.lat * radians;
  const longitudeDelta = (target.lon - origin.lon) * radians;
  const east = Math.sin(longitudeDelta) * Math.cos(targetLatitude);
  const north = Math.cos(latitude) * Math.sin(targetLatitude) -
    Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(longitudeDelta);
  const haversine = Math.sin((targetLatitude - latitude) / 2) ** 2 +
    Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distance = 2 * earthRadiusM * Math.asin(Math.sqrt(Math.min(1, haversine)));
  const bearing = Math.atan2(east, north);

  // 2D GPS points are projected onto level ground 1.5 m below the camera.
  return { distance, vector: [distance * Math.sin(bearing), distance * Math.cos(bearing), -1.5] };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function projectStakeMarkers(position, points, axes, view) {
  const candidates = [];
  let nearby = null;
  const angle = view.screenAngle * radians;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const videoScale = Math.max(view.width / view.videoWidth, view.height / view.videoHeight);
  // Assume a 65 degree field of view along the long sensor axis.
  const focal = Math.max(view.videoWidth, view.videoHeight) * videoScale / (2 * Math.tan(32.5 * radians));

  points.forEach((point, index) => {
    const { distance, vector } = groundOffset(position, point);
    const marker = { number: index + 1, distance };

    if (distance <= Math.max(2, position.accuracy + (point.accuracy ?? 0))) {
      if (!nearby || distance < nearby.distance) nearby = marker;
      return;
    }

    if (!axes || !Number.isFinite(focal)) return;
    const depth = dot(vector, axes.forward);
    if (depth <= 0) return;

    const right = dot(vector, axes.right);
    const up = dot(vector, axes.up);
    const x = 0.5 + focal * (cos * right - sin * up) / depth / view.width;
    const y = 0.5 - focal * (sin * right + cos * up) / depth / view.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) candidates.push({ ...marker, x, y });
  });

  candidates.sort((a, b) => a.distance - b.distance);
  const visible = [];
  for (const marker of candidates) {
    if (visible.length === 3) break;
    if (visible.every(other => Math.hypot(
      (other.x - marker.x) * view.width,
      (other.y - marker.y) * view.height,
    ) >= 64)) visible.push(marker);
  }

  return { visible, nearby };
}
