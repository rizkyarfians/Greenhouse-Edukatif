import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {canvasRenderer} from './canvas-renderer.js';
import {createCropGeometry, createCropMaterial} from './crop-models.js';
import {detailedCrops} from './detailed-crops.js';

export function openCropPreview(cropId) {
  const viewport = document.getElementById('crop-viewport');
  const resetButton = document.getElementById('reset-crop-view');
  const {name, caption} = detailedCrops[cropId];
  document.getElementById('crop-view-title').textContent = name + ' 3D';
  document.getElementById('crop-view-caption').textContent = caption;

  let renderer;
  let detail = true;
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  } catch {
    detail = false;
    renderer = canvasRenderer(document.createElement('canvas'));
  }
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Model tanaman ' + name);
  renderer.domElement.dataset.crop = cropId;
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const plant = createCropGeometry(cropId, {detail});
  const bounds = plant.boundingBox;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * .66;
  const model = new THREE.Group();
  model.add(new THREE.Mesh(plant, createCropMaterial()));
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(radius * .98, radius, .075, 48),
    new THREE.MeshStandardMaterial({color: 0x6e503b, roughness: 1}));
  ground.position.y = -.042;
  model.add(ground);
  if (detail) {
    const soilColors = new Float32Array(ground.geometry.attributes.position.count * 3);
    const soil = new THREE.Color();
    const position = ground.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const variation = Math.sin(position.getX(i) * 47 + position.getZ(i) * 67);
      soil.setHex(0x936e51).multiplyScalar(.92 + .13 * variation).toArray(soilColors, i * 3);
    }
    ground.geometry.setAttribute('color', new THREE.BufferAttribute(soilColors, 3));
    ground.material.vertexColors = true;
    ground.material.color.setHex(0xffffff);
  }
  scene.add(model, new THREE.HemisphereLight(0xfffaee, 0x878b70, 2.05));
  const sun = new THREE.DirectionalLight(0xfff0d5, 2.65);
  sun.position.set(-3, 5, 4);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = .75;
  controls.maxZoom = 3.1;
  controls.maxPolarAngle = Math.PI * .49;
  const render = () => renderer.render(scene, camera);

  function reset() {
    controls.target.set(center.x * .4, size.y * .46, center.z * .4);
    camera.position.copy(controls.target).add(new THREE.Vector3(3.6, cropId === 'cabbage' ? 4.1 : 2.2, 4.7));
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(size.y * .69 + radius * .33, radius * .82, radius * 1.17 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resetButton.addEventListener('click', reset);
  controls.addEventListener('change', render);
  reset();
  resize();

  return {
    snapshotSimulation: () => ({}),
    pauseSimulation() {
      observer.disconnect();
      resetButton.removeEventListener('click', reset);
      controls.dispose();
      model.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
