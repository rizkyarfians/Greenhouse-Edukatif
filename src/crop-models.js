import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const up = v(0, 1, 0);
const goldAngle = Math.PI * (3 - Math.sqrt(5));
const foliage = [0x538448, 0x729d49, 0x3f723c, 0x638b3f];

function modelBuilder(detail) {
  const parts = [];

  function add(geometry, tint) {
    geometry.deleteAttribute('uv');
    const color = new THREE.Color();
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      (typeof tint === 'function' ? tint(i) : color.setHex(tint)).toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  }

  function stem(from, to, radius, color, tip = radius * .65) {
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(tip, radius, direction.length(), detail ? 8 : 4);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    const mid = from.clone().lerp(to, .5);
    add(geometry.translate(mid.x, mid.y, mid.z), color);
  }

  function oval(center, radii, color, direction = up) {
    const geometry = new THREE.SphereGeometry(1, detail ? 12 : 5, detail ? 8 : 4);
    geometry.scale(...radii).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()));
    add(geometry.translate(center.x, center.y, center.z), color);
  }

  function curve(points, radius, color, steps = 10) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), detail ? steps : 4, radius, detail ? 6 : 3), color);
  }

  function leaf({root, angle, length, width, rise, arch, tint, shape = 'point', sideCup = 0, veins = false}) {
    const steps = detail ? 12 : 5;
    const across = detail ? 8 : 2;
    const forward = v(Math.cos(angle), 0, Math.sin(angle));
    const side = v(-forward.z, 0, forward.x);
    const positions = [], indices = [], tints = [];
    const green = new THREE.Color(tint);
    const vein = new THREE.Color(shape === 'round' ? 0xc9d59a : 0xa9bb72);

    function point(t, s) {
      const wave = Math.sin(Math.PI * t);
      let profile = Math.pow(wave, shape === 'round' ? .48 : .84);
      if (shape === 'lobed') profile *= (1.06 - t * .43) * (1 + .18 * Math.sin(t * 19));
      const edge = Math.abs(s);
      const ripple = Math.sin(t * 30 + s * 4) * width * edge ** 2 * wave * (shape === 'point' ? .025 : .10);
      const lift = rise * t + arch * wave + sideCup * edge ** 2 * wave + ripple;
      return root.clone().addScaledVector(forward, length * t).addScaledVector(side, s * width * Math.max(.012, profile)).addScaledVector(up, lift);
    }

    for (let row = 0; row <= steps; row++) {
      const t = row / steps;
      for (let col = 0; col <= across; col++) {
        const s = col * 2 / across - 1;
        positions.push(...point(t, s));
        const color = green.clone().multiplyScalar(.9 + .16 * (1 - Math.abs(s)) + .055 * Math.sin(row * 1.9 + col));
        if (s === 0) color.lerp(vein, .28);
        tints.push(color);
        if (row && col) {
          const i = row * (across + 1) + col;
          indices.push(i - across - 2, i - across - 1, i, i - across - 2, i, i - 1);
        }
      }
    }

    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    add(surface, i => tints[i]);

    if (detail && veins) {
      for (const t of [.30, .48, .66]) {
        for (const s of [-1, 1]) {
          const points = [point(t - .12, 0), point(t, s * .42), point(t + .14, s * .84)];
          for (const p of points) p.y += .006;
          curve(points, .0018, tint, 4);
        }
      }
    }
  }

  function geometry() {
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    merged.computeBoundingBox();
    return merged;
  }

  return {stem, oval, curve, leaf, geometry};
}

function cabbage(b, detail) {
  b.oval(v(0, .23, 0), [.30, .23, .28], 0xb5c987);
  const rings = [
    {count: detail ? 10 : 6, radius: .12, height: .055, length: .55, width: .23, rise: .13, arch: -.025, cup: .10, colors: [0x53804e, 0x679055, 0x80a873]},
    {count: detail ? 8 : 5, radius: .08, height: .075, length: .40, width: .20, rise: .29, arch: -.045, cup: .075, colors: [0x769e65, 0x8eac70, 0xa8ba79]},
    {count: detail ? 7 : 4, radius: .045, height: .16, length: .24, width: .14, rise: .31, arch: -.035, cup: .065, colors: [0x9db773, 0xbbcd8d, 0xd1db9f]},
  ];
  rings.forEach((ring, depth) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = i * 2 * Math.PI / ring.count + depth * .38;
      b.leaf({root: v(Math.cos(angle) * ring.radius, ring.height, Math.sin(angle) * ring.radius),
        angle, length: ring.length * (1 + .13 * Math.sin(i * 2)), width: ring.width,
        rise: ring.rise + .04 * Math.sin(i * 3.3), arch: ring.arch, sideCup: ring.cup,
        tint: ring.colors[i % ring.colors.length], shape: 'round', veins: depth < 2});
    }
  });
}

function maize(b, detail) {
  const p = t => v(.032 * Math.sin(t * 3), 1.94 * t, -.075 * t ** 2);
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    b.stem(p(t), p((i + 1) / 7), .034 - t * .018, 0x81944b);
    if (detail && i) b.oval(p(t), [.041 - t * .02, .028, .041 - t * .02], 0x9fa254);
    if (i) b.leaf({root: p(t), angle: i * goldAngle, length: .80 - t * .37,
      width: .13 - t * .058, rise: .045 + t * .21, arch: .22, sideCup: -.04,
      tint: foliage[i % 4]});
  }
  const ear = v(.25, 1.17, -.02);
  const axis = v(.61, .79, .04);
  b.stem(p(.48), ear, .030, 0x6f8f3c);
  b.oval(ear, [.105, .24, .103], 0xd7a333, axis);
  b.oval(ear.clone().add(v(-.035, -.045, -.047)), [.114, .238, .089], 0x759846, axis);
  b.oval(ear.clone().add(v(.013, -.055, .045)), [.102, .208, .081], 0x779443, axis);
  if (detail) {
    for (let row = 0; row < 7; row++) {
      const t = (row - 2) * .048;
      for (const offset of [-.055, 0, .055]) {
        const center = ear.clone().addScaledVector(axis, t).add(v(.067 + .01 * row / 7, -.050, offset));
        b.oval(center, [.025, .031, .027], row % 2 ? 0xefb943 : 0xffcc5b, axis);
      }
    }
  }
  const tip = p(1);
  b.stem(tip, tip.clone().add(v(.017, .30, .012)), .014, 0xb6a560);
  for (let i = 0; i < (detail ? 9 : 4); i++) {
    const angle = i * goldAngle, height = i * .021;
    const center = tip.clone().add(v(0, height, 0));
    const end = center.clone().add(v(Math.cos(angle) * .19, .16, Math.sin(angle) * .19));
    b.stem(center, end, .008, 0xc6af6e, .002);
    if (detail) b.oval(end, [.010, .037, .010], 0xd0af6f, end.clone().sub(center));
  }
}

function flower(b, center, color, size) {
  for (let i = 0; i < 5; i++) {
    const theta = i * 2 * Math.PI / 5;
    const outward = v(Math.cos(theta), .32, Math.sin(theta));
    b.oval(center.clone().addScaledVector(outward, size * .64), [size * .48, size * .71, size * .38], color, outward);
  }
  b.oval(center.clone().add(v(0, size * .27, 0)), [size * .43, size * .30, size * .43], 0xe7a426);
}

function chili(b, detail) {
  const fork = v(0, .33, 0);
  b.stem(v(0, 0, 0), fork, .029, 0x66814a);
  for (let i = 0; i < (detail ? 8 : 5); i++) {
    const angle = i * goldAngle;
    const outward = v(Math.cos(angle), 0, Math.sin(angle));
    const start = fork.clone().add(v(0, .072 * i, 0));
    const end = start.clone().addScaledVector(outward, .43 - .026 * i).add(v(0, .36, 0));
    b.stem(i ? start.clone().add(v(0, -.075, 0)) : start, end, .017, 0x6c8642, .006);
    b.stem(start, start.clone().add(v(0, .10, 0)), .022, 0x70884d);
    for (let j = 0; j < (detail ? 4 : 2); j++) {
      const t = .36 + j * .19;
      b.leaf({root: start.clone().lerp(end, t), angle: angle + (j % 2 ? 1 : -1) * .91,
        length: .32 - .037 * j, width: .093 - .008 * j, rise: .09, arch: .063,
        sideCup: -.031, tint: foliage[(i+j) % 4], veins: true});
    }
    const fruit = start.clone().lerp(end, .79).addScaledVector(outward, .068);
    const top = fruit.clone().add(v(0, -.081, 0));
    b.stem(start.clone().lerp(end, .72), top, .008, 0x648449);
    const color = [0xb82c27, 0xd5422b, 0x5b8f38, 0xc52e24, 0xe6582e][i % 5];
    b.oval(top.clone().add(v(0, -.081, 0)), [.044, .12, .046], color, v(outward.x * .18, 1, outward.z * .18));
    const bend = top.clone().addScaledVector(outward, .055).add(v(0, -.26, 0));
    b.stem(top.clone().add(v(0, -.145, 0)), bend, .033, color, .006);
    b.oval(top, [.038, .019, .038], 0x568143);
    if (detail && i % 3 === 1) flower(b, end, 0xeeeecf, .036);
  }
}

function cucumber(b, detail) {
  const vine = t => v(.27 * Math.sin(7 * t), .019 + 1.60 * t, .08 * Math.cos(5 * t));
  const pole = v(-.28, 1.67, -.14);
  b.stem(v(pole.x, 0, pole.z), pole, .018, 0xa78c61, .016);
  b.curve(Array.from({length: 12}, (_, i) => vine(i / 11)), .019, 0x679448, 34);
  for (let i = 0; i < (detail ? 10 : 6); i++) {
    const angle = i * goldAngle;
    const side = v(Math.cos(angle), 0, Math.sin(angle));
    const root = vine(.14 + i * (detail ? .087 : .14));
    const tip = root.clone().addScaledVector(side, .21).add(v(0, .10, 0));
    b.stem(root, tip, .011, 0x78984b, .006);
    b.leaf({root: tip, angle, length: .43 - .012 * i, width: .23 - .006 * i,
      rise: .02, arch: .065, sideCup: -.047, tint: foliage[i % 4], shape: 'lobed', veins: true});
    if (i % 3 === 1 || i === 2) {
      const top = root.clone().addScaledVector(side, .19);
      const length = Math.min(.24 + .038 * (i % 5), (top.y - .025) / 2);
      const direction = v(.17 * side.x, -1, .17 * side.z);
      b.stem(root, top, .009, 0x679448);
      const center = top.clone().addScaledVector(direction, length * .93);
      b.oval(center, [.065, length, .065], i % 2 ? 0x4a7836 : 0x5c8839, direction);
      if (detail) {
        for (let k = 0; k < 6; k++) {
          const phase = k * Math.PI / 3;
          const offset = v(Math.cos(phase) * .052, 0, Math.sin(phase) * .052);
          const ridge = [-.80, -.42, .22, .73].map(t => center.clone().addScaledVector(direction, t * length).addScaledVector(offset, 1.23 * Math.sqrt(1 - t * t)));
          b.curve(ridge, .004, 0x80a44c, 6);
        }
      }
    }
    if (detail && i % 2 === 0) {
      flower(b, tip.clone().addScaledVector(side, .08), 0xeac644, .052);
      const tendril = Array.from({length: 13}, (_, j) => tip.clone()
        .addScaledVector(side, j * .015).add(v(Math.sin(j * .75) * .035, j * .011 + Math.cos(j * .75) * .038, Math.cos(j * .75) * .032)));
      b.curve(tendril, .004, 0x8da358, 18);
    }
  }
}

const models = {cabbage, maize, chili, cucumber};

export function createCropGeometry(id, {detail = true} = {}) {
  if (!Object.hasOwn(models, id)) throw new RangeError('Model tanaman tidak tersedia: ' + id);
  const builder = modelBuilder(detail);
  models[id](builder, detail);
  return builder.geometry();
}

export function createCropMaterial() {
  return new THREE.MeshStandardMaterial({vertexColors: true, side: THREE.DoubleSide, roughness: .83});
}
