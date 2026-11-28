import * as THREE from 'three';

const vertical = new THREE.Vector3(0, 1, 0);

export function greenhouseStructure(outline, roofHeight, withCover) {
  const group = new THREE.Group(), roof = new THREE.Group();
  group.add(roof);
  const eave = roofHeight * .77;
  const halfWidth = Math.max(...outline.map(([x]) => Math.abs(x)));
  const depth = Math.max(...outline.map(([,z]) => z)) - Math.min(...outline.map(([,z]) => z));
  const heightAt = x => roofHeight - (roofHeight - eave) * Math.min(1, Math.abs(x) / halfWidth);
  const frame = new THREE.MeshStandardMaterial({color: 0x9cbabc, metalness: .22, roughness: .58});
  const profile = new THREE.CylinderGeometry(.037, .037, 1, 6);

  function beam(parent, [x1, y1, z1], [x2, y2, z2]) {
    const direction = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
    const length = direction.length();
    if (length < 1e-6) return;
    const mesh = new THREE.Mesh(profile, frame);
    mesh.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
    mesh.quaternion.setFromUnitVectors(vertical, direction.normalize());
    mesh.scale.y = length;
    parent.add(mesh);
  }

  function roofBeam(a, b) {
    const split = ridgeCrossing(a, b);
    const points = split ? [a, split, b] : [a, b];
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1], [nextX, nextZ] = points[i];
      beam(roof, [x, heightAt(x), z], [nextX, heightAt(nextX), nextZ]);
    }
  }

  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length];
    const supportCount = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.1);
    const supports = Array.from({length: supportCount}, (_, j) => [
      THREE.MathUtils.lerp(a[0], b[0], j / supportCount),
      THREE.MathUtils.lerp(a[1], b[1], j / supportCount),
    ]);
    for (const [x, z] of supports) beam(group, [x, 0, z], [x, heightAt(x), z]);
    roofBeam(a, b);
  }
  const minZ = Math.min(...outline.map(([,z]) => z));
  const ribs = Math.min(7, Math.ceil(depth / 2.7));
  for (let i = 1; i < ribs; i++) {
    const z = minZ + depth * i / ribs;
    for (const [left, right] of spans(outline, z, 1)) roofBeam([left, z], [right, z]);
  }
  for (const [from, to] of spans(outline, 0, 0)) {
    beam(roof, [0, roofHeight, from], [0, roofHeight, to]);
  }

  if (withCover) {
    const polygon = outline.map(([x,z]) => new THREE.Vector2(x,z));
    const vertices = [];
    for (const triangle of THREE.ShapeUtils.triangulateShape(polygon, [])) {
      const points = triangle.map(index => outline[index]);
      for (const side of [-1, 1]) {
        const clipped = points.flatMap((a, i) => {
          const crossing = ridgeCrossing(a, points[(i + 1) % points.length]);
          return [...(a[0]*side >= 0 ? [a] : []), ...(crossing ? [crossing] : [])];
        });
        for (let i = 1; i < clipped.length - 1; i++) {
          for (const [x,z] of [clipped[0], clipped[i], clipped[i + 1]]) vertices.push(x, heightAt(x), z);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const cover = new THREE.MeshBasicMaterial({
      color: 0xa9e2d9, transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide,
    });
    roof.add(new THREE.Mesh(geometry, cover));
  }
  return {group, roof};
}

function ridgeCrossing(a, b) {
  return a[0] * b[0] < 0 ? [0, THREE.MathUtils.lerp(a[1], b[1], a[0] / (a[0] - b[0]))] : null;
}

function spans(polygon, offset, axis) {
  const intersections = [];
  const other = 1 - axis;
  for (const [i, a] of polygon.entries()) {
    const b = polygon[(i + 1) % polygon.length];
    if ((a[axis] > offset) === (b[axis] > offset)) continue;
    intersections.push(THREE.MathUtils.lerp(a[other], b[other], (offset - a[axis]) / (b[axis] - a[axis])));
  }
  intersections.sort((a,b) => a-b);
  return Array.from({length:intersections.length / 2}, (_,i) => [intersections[i*2], intersections[i*2+1]]);
}
