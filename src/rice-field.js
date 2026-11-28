import {createDeviceSurface} from './device-surface.js';
import {captureLayoutPreview} from './layout-preview.js';
import {
  ACESFilmicToneMapping, Box3, DirectionalLight, HemisphereLight, OrthographicCamera,
  Scene, Vector3, WebGLRenderer,
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {canvasRenderer} from './canvas-renderer.js';
import {createRiceFieldModel, maxWaterDepth} from './rice-field-model.js';
import {addDeviceMarkers, refreshDeviceDetails, showDeviceDetails} from './device-details.js';
import soilIcon from 'lucide-static/icons/flower-2.svg?raw';
import waterIcon from 'lucide-static/icons/droplets.svg?raw';
import gateIcon from 'lucide-static/icons/activity.svg?raw';

const get = id => document.getElementById(id);
const viewport = get('rice-viewport');
const fill = get('rice-fill');
const drain = get('rice-drain');
const defaultState = {waterDepth:0, soilMoisture:42};
let state = {...defaultState};
let viewer;
let viewerLoading;
let irrigation;
let timer;

const soilDevice = {
  type:'sensor', title:'Kelembapan tanah',
  description:'Menunjukkan kadar air tanah di petak sawah pada simulasi.',
  reading:() => state.soilMoisture + ' %',
};
const waterDevice = {
  type:'sensor', title:'Tinggi genangan',
  description:'Menunjukkan kedalaman air di atas permukaan tanah.',
  reading:() => state.waterDepth + ' cm',
};
const gateDevice = {
  type:'actuator', title:'Pintu air',
  description:'Buka saluran untuk mengisi atau menguras petak sawah.',
  reading:() => get('rice-irrigation-status').textContent,
  controls:[fill,drain],
};
get('rice-soil-details').addEventListener('click', () => showDeviceDetails(soilDevice));
get('rice-depth-details').addEventListener('click', () => showDeviceDetails(waterDevice));
get('rice-gate-details').addEventListener('click', () => showDeviceDetails(gateDevice));

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
  refreshDeviceDetails();
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
  stopIrrigation();
  if (viewer) viewer.reset();
  else viewerLoading ??= initializeViewer();
  return viewerLoading;
}

export function deviceSurface() { return viewer?.deviceSurface; }

export function deviceControls(kind) {
  return kind === 'pump' ? [fill] : kind === 'valve' ? [fill, drain] : [];
}

export function deviceReading(kind) {
  return {
    pump: gateDevice.reading(), valve: gateDevice.reading(),
    soil: soilDevice.reading(), water: waterDevice.reading(),
  }[kind];
}

async function initializeViewer() {
  try {
    viewer = await makeViewer();
    viewer.reset();
    renderState();
  } catch (error) {
    console.error('Model sawah tidak dapat ditampilkan',error);
    get('rice-scene-status').querySelector('span').textContent = 'Tampilan 3D tidak tersedia';
  } finally {
    viewerLoading = undefined;
  }
}

export function capturePreview() {
  return viewer?.capturePreview();
}

export function snapshotSimulation() {
  return {waterDepth:state.waterDepth, soilMoisture:state.soilMoisture};
}

export function pauseSimulation() {
  stopIrrigation();
}

async function loadRiceModel() {
  const modelUrl = new URL('lahan-terbuka-padi.glb',document.baseURI);
  const {scene:model} = await new GLTFLoader().loadAsync(modelUrl.href);
  const gate = model.getObjectByName('Pintu_Air');
  const flood = model.getObjectByName('Genangan');
  const soil = model.getObjectByName('Permukaan_Tanah');
  const maxHeight = flood?.userData.tinggi_tampil_m;
  if (!gate || !flood || !soil || !Number.isFinite(maxHeight)) {
    throw new Error('GLB sawah tidak memiliki bagian irigasi yang dibutuhkan.');
  }
  const closedGateHeight = gate.position.y;
  const soilHeight = new Box3().setFromObject(soil).max.y;
  const gatePosition = new Box3().setFromObject(gate).getCenter(new Vector3());
  gatePosition.y += .4;

  return {
    model,
    gatePosition,
    setIrrigation(depth,active) {
      gate.position.y = closedGateHeight + (active ? .32 : 0);
      flood.visible = depth > 0;
      flood.position.y = soilHeight + (maxHeight-soilHeight)*depth/maxWaterDepth;
    },
  };
}

async function makeViewer() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2',{alpha:true,antialias:true});
  const renderer = context ? new WebGLRenderer({canvas,context,alpha:true,antialias:true}) : canvasRenderer(canvas);
  if (context) {
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
    renderer.toneMapping = ACESFilmicToneMapping;
  }
  let riceModel;
  if (context) {
    try {
      riceModel = await loadRiceModel();
    } catch (error) {
      console.warn('GLB sawah gagal dimuat. Memakai model sederhana.',error);
    }
  }
  const {model,setIrrigation} = riceModel ?? createRiceFieldModel();
  const scene = new Scene();
  scene.add(model,new HemisphereLight(0xfff9ea,0xbda688,2.2));
  const sun = new DirectionalLight(0xfff0d7,2.35);
  sun.position.set(5,11,8);
  scene.add(sun);

  const camera = new OrthographicCamera(-14,14,14,-14,.1,120);
  const controls = new OrbitControls(camera,canvas);
  const positionDeviceMarkers = addDeviceMarkers(viewport,[
    {device:soilDevice, icon:soilIcon, position:new Vector3(-3.1,.55,2)},
    {device:waterDevice, icon:waterIcon, position:new Vector3(1.6,.55,-2.2)},
    {device:gateDevice, icon:gateIcon, position:riceModel?.gatePosition ?? new Vector3(6.23,.95,6.12)},
  ]);
  const deviceSurface = createDeviceSurface(viewport, camera, new Box3().setFromObject(model), draw);
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
      if (viewport.clientWidth) {
        renderer.render(scene,camera);
        positionDeviceMarkers(camera, deviceSurface.hasDevices);
        deviceSurface.position();
      }
    });
  }
  controls.addEventListener('change',draw);

  function resize() {
    const {clientWidth:width,clientHeight:height} = viewport;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(11.2,13.2 / aspect);
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    draw();
  }

  function reset() {
    camera.position.copy(new Vector3(23,26,28));
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
  get('rice-scene-status').querySelector('span').textContent = riceModel ? 'Petak sawah' : 'Petak sawah · tampilan sederhana';
  return {
    capturePreview: () => captureLayoutPreview(canvas, () => renderer.render(scene, camera)),
    deviceSurface,
    reset,
    showIrrigation(depth,active) {
      setIrrigation(depth,active);
      draw();
    },
  };
}
