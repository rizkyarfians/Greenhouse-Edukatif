import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {canvasRenderer} from './canvas-renderer.js';
import {createCropGeometry, createCropMaterial} from './crop-models.js';
import {greenhouseStructure} from './greenhouse-structure.js';
import {previewBeds} from './scan-beds.js';

function footprint(points) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

function roundedBed(width, length, height) {
  const x = width / 2, y = length / 2;
  const bevel = Math.min(x * .23, y * .18, height * .4);
  const a = x - bevel, b = y - bevel;
  const shape = new THREE.Shape();
  const radius = Math.min(a * .45, b * .38);
  shape.moveTo(-a + radius, -b);
  shape.lineTo(a - radius, -b);
  shape.quadraticCurveTo(a, -b, a, -b + radius);
  shape.lineTo(a, b - radius);
  shape.quadraticCurveTo(a, b, a - radius, b);
  shape.lineTo(-a + radius, b);
  shape.quadraticCurveTo(-a, b, -a, b - radius);
  shape.lineTo(-a, -b + radius);
  shape.quadraticCurveTo(-a, -b, -a + radius, -b);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2).translate(0, bevel, 0);
  return geometry;
}

export function openBedViewer(viewport, measurement, crops, {greenhouse = false} = {}) {
  const layout = previewBeds(measurement.xy, Math.max(...crops.map(crop => crop.spacing[0])));
  let renderer, webgl = true;
  try {
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch {
    webgl = false;
    renderer = canvasRenderer(document.createElement('canvas'));
  }

  const scale = 16 / Math.max(layout.width, layout.depth);
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const makeMaterial = color => new THREE.MeshStandardMaterial({color, roughness: .94});
  const soil = makeMaterial(0x8b6546);
  const ground = new THREE.Mesh(
    new THREE.ExtrudeGeometry(footprint(layout.polygon.map(([x,y]) => [x * scale, y * scale])),
      {depth: .22, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, -.22, 0),
    makeMaterial(0xc3a984),
  );
  ground.name = 'Floor_BedFoundation';
  ground.receiveShadow = true;
  group.add(ground);

  const stakeGeo = new THREE.CylinderGeometry(.035, .047, .52, 7);
  const stakeTip = new THREE.CylinderGeometry(.038, .038, .13, 7);
  const wood = makeMaterial(0x67462f), orange = makeMaterial(0xea9a49);
  for (const [x,y] of layout.polygon) {
    const stake = new THREE.Mesh(stakeGeo, wood), tip = new THREE.Mesh(stakeTip, orange);
    stake.position.set(x * scale, .26, -y * scale);
    tip.position.set(stake.position.x, .46, stake.position.z);
    group.add(stake, tip);
  }
  const transforms = new Map();
  const hose = greenhouse && makeMaterial(0x244c56);
  const dripPhases = greenhouse ? Array.from({length: 4}, () => makeMaterial(0x49768c)) : [];
  const dripGeo = greenhouse && new THREE.SphereGeometry(.038, 6, 4);
  let maxPlantHeight = 0;
  let featured = 0;
  for (const bed of layout.beds) {
    const width = bed.width * scale, length = (bed.to - bed.from) * scale;
    const height = Math.min(.34, width * .28);
    const mesh = new THREE.Mesh(roundedBed(width, length, height), soil);
    mesh.position.set(bed.x * scale, 0, -(bed.from + bed.to) * scale / 2);
    mesh.receiveShadow = true;
    group.add(mesh);

    const crop = crops[bed.row % crops.length];
    const count = Math.max(1, Math.min(webgl ? 10 : 4, Math.floor((bed.to - bed.from) / crop.spacing[1])));
    const tubeX = mesh.position.x + width * .21;
    if (greenhouse) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, length * .96, 6), hose);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(tubeX, height + .028, mesh.position.z);
      group.add(pipe);
    }
    for (let i = 0; i < count; i++) {
      const obj = new THREE.Object3D();
      const fraction = (i + .5) / count;
      const growth = count === 1 ? .90 : .30 + .70 * fraction ** .47;
      obj.position.set(bed.x * scale + Math.sin(i * 2.1 + bed.row) * width * .065,
        height, -(bed.from + fraction * (bed.to - bed.from)) * scale);
      obj.rotation.y = crop.id === 'cucumber' ? 0 : i * 2.4 + bed.row * .8;
      obj.scale.setScalar(Math.min(width * .86, (length / count) * .90) * growth);
      obj.updateMatrix();
      if (greenhouse) {
        const emitter = new THREE.Mesh(dripGeo, dripPhases[i % dripPhases.length]);
        emitter.position.set(tubeX, height + .06, obj.position.z);
        group.add(emitter);
      }
      const detail = webgl && i === count - 1 && featured < 10;
      if (detail) featured++;
      const key = crop.id + ':' + detail;
      if (!transforms.has(key)) transforms.set(key, {id: crop.id, detail, matrices: []});
      transforms.get(key).matrices.push(obj.matrix.clone());
    }
  }

  const foliage = createCropMaterial();
  for (const {id, detail, matrices} of transforms.values()) {
    const geometry = createCropGeometry(id, {detail});
    if (greenhouse) {
      for (const matrix of matrices) {
        maxPlantHeight = Math.max(maxPlantHeight, geometry.boundingBox.max.y * matrix.elements[5] + matrix.elements[13]);
      }
    }
    if (webgl) {
      const plants = new THREE.InstancedMesh(geometry, foliage, matrices.length);
      matrices.forEach((matrix, index) => plants.setMatrixAt(index, matrix));
      plants.instanceMatrix.needsUpdate = true;
      plants.castShadow = true;
      group.add(plants);
    } else {
      for (const matrix of matrices) {
        const plant = new THREE.Mesh(geometry, foliage);
        plant.applyMatrix4(matrix);
        group.add(plant);
      }
    }
  }

  const house = greenhouse && greenhouseStructure(layout.polygon.map(([x, y]) => [x * scale, -y * scale]),
    Math.max(2.8, (maxPlantHeight + .45) / .77), webgl);
  if (house) group.add(house.group);

  scene.add(new THREE.HemisphereLight(0xfff5dc, 0x776b55, 2.1));
  const sun = new THREE.DirectionalLight(0xffe5bb, 2.35);
  sun.position.set(-9, 16, 8);
  sun.castShadow = webgl;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left:-13, right:13, top:13, bottom:-13, near:1, far:45});
  sun.shadow.normalBias = .025;
  scene.add(sun);

  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Model 3D bedengan dan batas patok lahan');
  viewport.replaceChildren(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = .7;
  controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI * .48;
  const render = () => renderer.render(scene, camera);
  const bounds = new THREE.Box3().setFromObject(group);
  let fitWidth, fitHeight;

  function reset() {
    camera.position.set(9, 14, 21);
    controls.target.set(0, .15, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    camera.updateMatrixWorld();
    fitWidth = 0;
    fitHeight = 0;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
          fitWidth = Math.max(fitWidth, Math.abs(point.x));
          fitHeight = Math.max(fitHeight, Math.abs(point.y));
        }
      }
    }
    resize();
  }
  function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const half = Math.max(fitHeight, fitWidth / aspect) * 1.09;
    Object.assign(camera, {left:-half * aspect, right:half * aspect, top:half, bottom:-half});
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  reset();
  let animation = 0, lastFrame = -Infinity;
  const showDrip = phase => {
    dripPhases.forEach((material, i) => material.color.setHex(i === phase ? 0x78dafa : 0x49768c));
    render();
  };
  function animate(now) {
    if (now - lastFrame >= 130) {
      showDrip(Math.floor(now / 160) % dripPhases.length);
      lastFrame = now;
    }
    animation = requestAnimationFrame(animate);
  }

  controls.addEventListener('change', render);
  return {
    beds: layout.beds.length,
    reset,
    setRoof(visible) {
      if (!house) return;
      house.roof.visible = visible;
      render();
    },
    setDrip(running) {
      if (!house || !layout.beds.length) return;
      cancelAnimationFrame(animation);
      if (running) animation = requestAnimationFrame(animate);
      else showDrip(-1);
    },
    dispose() {
      cancelAnimationFrame(animation);
      observer.disconnect();
      controls.dispose();
      const geometries = new Set([stakeGeo, stakeTip]);
      const materials = new Set([soil, wood, orange, foliage]);
      group.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
