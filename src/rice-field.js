import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, OrthographicCamera,
  Scene, Vector3, WebGLRenderer,
} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {canvasRenderer} from './canvas-renderer.js';
import {createRiceFieldModel, maxWaterDepth} from './rice-field-model.js';

const get = id => document.getElementById(id);
const viewport = get('rice-viewport');
const fill = get('rice-fill');
const drain = get('rice-drain');
const defaultState = {waterDepth:0, soilMoisture:42};
let state = {...defaultState};
let viewer;
let irrigation;
let timer;

function renderState() {
  get('rice-water-depth').textContent = state.waterDepth;
  get('rice-soil-moisture').textContent = state.soilMoisture;
  get('rice-irrigation-status').textContent = irrigation === 'fill' ? 'Air masuk ke petak' :
    irrigation === 'drain' ? 'Air keluar dari petak' : 'Pintu air tertutup';
  fill.textContent = irrigation === 'fill' ? 'Tutup pintu air' : 'Alirkan air';
  drain.textContent = irrigation === 'drain' ? 'Tutup pintu air' : 'Kuras air';
  fill.disabled = irrigation === 'drain' || state.waterDepth >= maxWaterDepth;
  drain.disabled = irrigation === 'fill' || state.waterDepth <= 0;
  viewer?.showIrrigation(state.waterDepth,irrigation);
}

function stopIrrigation() {
  clearInterval(timer);
  irrigation = undefined;
  renderState();
}

function changeIrrigation(direction) {
  if (irrigation) {
    stopIrrigation();
    return;
  }
  irrigation = direction;
  renderState();
  timer = setInterval(() => {
    if (direction === 'fill') {
      state.waterDepth++;
      state.soilMoisture = Math.min(100,state.soilMoisture + 6);
    } else {
      state.waterDepth--;
    }
    if (state.waterDepth === 0 || state.waterDepth === maxWaterDepth) stopIrrigation();
    else renderState();
  },1000);
}

fill.addEventListener('click',() => changeIrrigation('fill'));
drain.addEventListener('click',() => changeIrrigation('drain'));

export function openSimulation(saved) {
  state = {...(saved ?? defaultState)};
  if (!viewer) {
    try {
      viewer = makeViewer();
    } catch (error) {
      console.error('Model sawah tidak dapat ditampilkan',error);
      get('rice-scene-status').querySelector('span').textContent = 'Tampilan 3D tidak tersedia';
    }
  }
  viewer?.reset();
  stopIrrigation();
}

export function snapshotSimulation() {
  return {waterDepth:state.waterDepth, soilMoisture:state.soilMoisture};
}

export function pauseSimulation() {
  stopIrrigation();
}

function makeViewer() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2',{alpha:true,antialias:true});
  const renderer = context ? new WebGLRenderer({canvas,context,alpha:true,antialias:true}) : canvasRenderer(canvas);
  if (context) {
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
    renderer.toneMapping = ACESFilmicToneMapping;
  }
  const scene = new Scene();
  const {model,setIrrigation} = createRiceFieldModel();
  scene.add(model,new HemisphereLight(0xfffce1,0xb2936b,2.15));
  const sun = new DirectionalLight(0xffeac2,2.25);
  sun.position.set(5,11,8);
  scene.add(sun);

  const camera = new OrthographicCamera(-14,14,14,-14,.1,120);
  const controls = new OrbitControls(camera,canvas);
  controls.enablePan = false;
  controls.minZoom = 1;
  controls.maxZoom = 3.5;
  controls.minPolarAngle = .16;
  controls.maxPolarAngle = Math.PI * .45;
  let frame;
  function draw() {
    if (frame || !viewport.clientWidth) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (viewport.clientWidth) renderer.render(scene,camera);
    });
  }
  controls.addEventListener('change',draw);

  function resize() {
    const {clientWidth:width,clientHeight:height} = viewport;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(12.6,15 / aspect);
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    draw();
  }

  function reset() {
    camera.position.copy(new Vector3(16,20,26));
    camera.zoom = 1;
    controls.target.set(0,0,0);
    controls.update();
    resize();
  }

  canvas.setAttribute('aria-label','Model 3D petak sawah dengan tanaman padi');
  viewport.prepend(canvas);
  new ResizeObserver(resize).observe(viewport);
  get('rice-reset').disabled = false;
  get('rice-reset').addEventListener('click',reset);
  get('rice-scene-status').querySelector('span').textContent = 'Petak sawah';
  return {
    reset,
    showIrrigation(depth,active) {
      setIrrigation(depth,active);
      draw();
    },
  };
}
