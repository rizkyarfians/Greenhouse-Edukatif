import { Quaternion, Vector3 } from 'three';

const stakeHeightM = 1.15;
const sides = 10;
const vertical = new Vector3(0, 1, 0);
const light = new Vector3(-0.5, 0.7, 0.8).normalize();

// Bamboo shape in metres. Each raised ring makes a visible node between internodes.
const profile = [
  [0, 0.105],
  [0.24, 0.099], [0.25, 0.113, true], [0.271, 0.113, true], [0.281, 0.098, true],
  [0.51, 0.093], [0.52, 0.107, true], [0.541, 0.107, true], [0.551, 0.092, true],
  [0.77, 0.087], [0.78, 0.101, true], [0.802, 0.101, true], [0.812, 0.086, true],
  [1.01, 0.081], [1.02, 0.094, true], [1.041, 0.094, true], [1.051, 0.08, true],
  [stakeHeightM, 0.078], [stakeHeightM, 0.056], [1.105, 0.056], [1.105, 0],
];
const rings = profile.map(([y, radius]) => Array.from({ length: sides }, (_, i) => {
  const angle = i * Math.PI * 2 / sides;
  return new Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
}));

export function stakeDisplayScale(focal, depth) {
  const naturalHeight = focal * stakeHeightM / depth;
  return Math.max(1, 52 / naturalHeight);
}

export function createStakeModelLayer(container) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  container.replaceChildren(canvas);

  const rotation = new Quaternion();
  const up = new Vector3();
  const normal = new Vector3();
  const across = new Vector3();
  let width = 0;
  let height = 0;

  function draw(markers, view) {
    const focal = view.focal;
    canvas.hidden = !markers.length || !view.width || !view.height || !view.up ||
      !Number.isFinite(focal) || focal <= 0 || !!context.isContextLost?.();
    if (canvas.hidden) return false;

    if (width !== view.width || height !== view.height) {
      width = view.width;
      height = view.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    }
    context.clearRect(0, 0, width, height);
    rotation.setFromUnitVectors(vertical, up.set(...view.up).normalize());

    const faces = [];
    for (const marker of markers) {
      const { depth } = marker;
      const scale = stakeDisplayScale(focal, depth);
      const base = new Vector3((marker.x - 0.5) * width * depth / focal,
        (0.5 - marker.y) * height * depth / focal, -depth);
      const transformed = rings.map(ring => ring.map(vertex =>
        vertex.clone().multiplyScalar(scale).applyQuaternion(rotation).add(base),
      ));

      for (let ring = 0; ring < transformed.length - 1; ring++) {
        for (let side = 0; side < sides; side++) {
          const next = (side + 1) % sides;
          const vertices = [
            transformed[ring][side], transformed[ring + 1][side],
            transformed[ring + 1][next], transformed[ring][next],
          ];
          if (vertices.some(vertex => vertex.z >= -0.1)) continue;

          const [a, b, c] = vertices;
          normal.subVectors(b, a).cross(across.subVectors(c, a)).normalize();
          if (normal.dot(a) >= 0) continue;
          const shade = 0.52 + 0.48 * Math.max(0, normal.dot(light));
          const inner = ring >= profile.length - 3;
          const collar = profile[ring + 1][2];
          const [red, green, blue] = inner ? [74, 74, 33] : collar ? [181, 171, 91] : [136, 168, 58];
          faces.push({
            vertices,
            distance: vertices.reduce((sum, vertex) => sum - vertex.z, 0),
            color: `rgb(${Math.round(red * shade)},${Math.round(green * shade)},${Math.round(blue * shade)})`,
          });
        }
      }
    }

    faces.sort((a, b) => b.distance - a.distance);
    for (const { vertices, color } of faces) {
      context.beginPath();
      for (const [index, vertex] of vertices.entries()) {
        const x = width / 2 + focal * vertex.x / -vertex.z;
        const y = height / 2 - focal * vertex.y / -vertex.z;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = context.strokeStyle = color;
      context.fill();
      context.lineWidth = 0.6;
      context.stroke();
    }

    canvas.hidden = faces.length === 0;
    return !canvas.hidden;
  }

  return { draw, dispose: () => canvas.remove() };
}
