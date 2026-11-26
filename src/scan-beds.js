// Orient bed rows along the longest edge and keep their full footprint inside the polygon.
export function previewBeds(points, rowSpacing) {
  const edges = points.map(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    return [nextX - x, nextY - y];
  });
  const [dx, dy] = edges.reduce((a, b) => Math.hypot(...a) >= Math.hypot(...b) ? a : b);
  const length = Math.hypot(dx, dy);
  const rotated = points.map(([x, y]) => [(x * dy - y * dx) / length, (x * dx + y * dy) / length]);
  const xs = rotated.map(p => p[0]), ys = rotated.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX, depth = maxY - minY;
  const polygon = rotated.map(([x, y]) => [x - (minX + maxX) / 2, y - (minY + maxY) / 2]);

  // On large scans, space the illustrated beds farther apart to keep the model readable.
  const count = Math.min(12, Math.floor((width + 1e-8) / rowSpacing));
  const beds = [];
  for (let row = 0; row < count; row++) {
    const lane = width / count;
    const x = -width / 2 + lane * (row + .5);
    const bedWidth = lane * .68;
    const left = x - bedWidth / 2, right = x + bedWidth / 2;
    const blocked = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const delta = b[0] - a[0];
      if (Math.abs(delta) < 1e-10) {
        if (a[0] >= left && a[0] <= right) blocked.push([Math.min(a[1], b[1]), Math.max(a[1], b[1])]);
        continue;
      }
      const t0 = (left - a[0]) / delta, t1 = (right - a[0]) / delta;
      const from = Math.max(0, Math.min(t0, t1)), to = Math.min(1, Math.max(t0, t1));
      if (from > to) continue;
      const y0 = a[1] + (b[1] - a[1]) * from, y1 = a[1] + (b[1] - a[1]) * to;
      blocked.push([Math.min(y0, y1), Math.max(y0, y1)]);
    }
    blocked.sort((a, b) => a[0] - b[0]);
    let end = -depth / 2;
    const margin = Math.min(lane * .13, depth * .035);
    for (const [lo, hi] of [...blocked, [depth / 2, depth / 2]]) {
      if (lo - end > margin * 2 + rowSpacing * .35 && inside(polygon, x, (end + lo) / 2)) {
        beds.push({row, x, from: end + margin, to: lo - margin, width: bedWidth});
      }
      end = Math.max(end, hi);
    }
  }
  const maxBeds = 24;
  return {
    polygon, width, depth,
    beds: beds.length <= maxBeds ? beds : Array.from({length: maxBeds}, (_, index) =>
      beds[Math.floor((index + .5) * beds.length / maxBeds)]),
  };
}

function inside(polygon, x, y) {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[(i + 1) % polygon.length];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}
