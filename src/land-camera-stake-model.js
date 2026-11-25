import {
  CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';

const stakeHeight = 1.15;
const vertical = new Vector3(0, 1, 0);

export function createStakeModelLayer(container) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  container.replaceChildren(canvas);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xf3fff7, 0x526b5a, 2));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, 2);
  scene.add(key);

  const green = new MeshStandardMaterial({ color: 0x91db3d, roughness: 0.75, flatShading: true });
  const dark = new MeshStandardMaterial({ color: 0x1f5739, roughness: 0.85, flatShading: true });
  const white = new MeshStandardMaterial({ color: 0xf1ffde, roughness: 0.7, flatShading: true });
  const parts = [
    { geometry: new CylinderGeometry(0.22, 0.34, 0.14, 6), material: dark, height: 0.07 },
    { geometry: new CylinderGeometry(0.16, 0.22, 0.92, 6), material: green, height: 0.55 },
    { geometry: new CylinderGeometry(0.22, 0.22, 0.12, 6), material: white, height: 0.85 },
    { geometry: new CylinderGeometry(0.12, 0.24, 0.18, 6), material: green, height: 1.06 },
  ];
  const stakes = Array.from({ length: 5 }, () => {
    const stake = new Group();
    for (const { geometry, material, height } of parts) {
      const mesh = new Mesh(geometry, material);
      mesh.position.y = height;
      stake.add(mesh);
    }
    stake.visible = false;
    scene.add(stake);
    return stake;
  });

  const camera = new PerspectiveCamera(65, 1, 0.1, 30_000);
  const worldUp = new Vector3();
  let width = 0;
  let height = 0;
  let focal = 0;
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', () => { contextLost = true; });

  function draw(markers, view) {
    // Clearing via visibility avoids redrawing a transparent frame when no stakes are visible.
    canvas.hidden = contextLost || !markers.length || !view.width || !view.height;
    if (canvas.hidden) return false;

    if (width !== view.width || height !== view.height) {
      width = view.width;
      height = view.height;
      renderer.setSize(width, height, false);
    }
    const nextFocal = view.focal > 0 && Number.isFinite(view.focal) ? view.focal : height * 0.8;
    if (focal !== nextFocal || camera.aspect !== width / height) {
      focal = nextFocal;
      camera.aspect = width / height;
      camera.fov = 2 * Math.atan(height / (2 * focal)) * 180 / Math.PI;
      camera.updateProjectionMatrix();
    }

    for (const [index, stake] of stakes.entries()) {
      const marker = markers[index];
      stake.visible = !!marker;
      if (!marker) continue;

      const depth = marker.depth ?? focal * stakeHeight / 86;
      const heightInPixels = focal * stakeHeight / depth;
      const scale = Math.min(130, Math.max(46, heightInPixels)) / heightInPixels;
      stake.position.set((marker.x - 0.5) * width * depth / focal,
        (0.5 - marker.y) * height * depth / focal, -depth);
      stake.scale.setScalar(scale);
      worldUp.set(...(marker.depth && view.up ? view.up : [0, 1, 0]));
      stake.quaternion.setFromUnitVectors(vertical, worldUp.normalize());
    }

    renderer.render(scene, camera);
    return true;
  }

  function dispose() {
    for (const { geometry } of parts) geometry.dispose();
    for (const material of [green, dark, white]) material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { draw, dispose };
}
