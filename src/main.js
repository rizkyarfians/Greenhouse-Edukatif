import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { canvasRenderer } from './canvas-renderer.js';
import { irrigationAnimation, rowsByZone } from './irrigation-animation.js';
import sprout from 'lucide-static/icons/sprout.svg?raw';
import box from 'lucide-static/icons/box.svg?raw';
import reset from 'lucide-static/icons/rotate-ccw.svg?raw';
import move from 'lucide-static/icons/move.svg?raw';
import home from 'lucide-static/icons/house.svg?raw';
import activity from 'lucide-static/icons/activity.svg?raw';
import humidity from 'lucide-static/icons/droplets.svg?raw';
import thermometer from 'lucide-static/icons/thermometer.svg?raw';
import soil from 'lucide-static/icons/flower-2.svg?raw';
import drop from 'lucide-static/icons/droplet.svg?raw';
import tank from 'lucide-static/icons/cylinder.svg?raw';
import food from 'lucide-static/icons/flask-conical.svg?raw';

const icons = {sprout, box, reset, move, home, activity, humidity, thermometer, soil, drop, tank, food, pump: activity};
const get = id => document.getElementById(id);
const metrics = [
  {key:'temperature', title:'Suhu udara', value:28, unit:'°C', note:'Seberapa hangat di dalam', tone:'warm', icon:'thermometer'},
  {key:'humidity', title:'Kelembapan udara', value:72, unit:'%', note:'Uap air di udara', tone:'sky', icon:'humidity'},
  {key:'media', title:'Media tanam', value:54, unit:'%', note:'Kelembapan di sekitar akar', tone:'soil', icon:'soil'},
  {key:'water', title:'Tandon air', value:78, unit:'%', note:'Air untuk menyiram', tone:'water', icon:'tank'},
  {key:'nutrient', title:'Tandon nutrisi', value:64, unit:'%', note:'Sisa larutan nutrisi', tone:'food', icon:'food'},
];
get('metrics').innerHTML = metrics.map(({key,title,unit,note,tone,icon}) => `
  <article class="metric ${tone}"><span class="tile-icon" data-icon="${icon}"></span>
    <h3>${title}</h3><p class="metric-value"><span id="${key}-value"></span><small>${unit}</small></p>
    <p class="metric-note">${note}</p>${unit === '%' ? `<div class="bar" aria-hidden="true"><span id="${key}-bar"></span></div>` : ''}
  </article>`).join('');
for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = icons[element.dataset.icon];
  element.setAttribute('aria-hidden', 'true');
}

const readings = Object.fromEntries(metrics.map(({key,value}) => [key,value]));
const zoneMedia = {A: 54, B: 49};
const zoneInputs = [...document.querySelectorAll('input[name=zone]')];
let zone = 'A';
let watering = false;
let tickTimer;
let stopTimer;
let viewer;
let wateringStarted = 0;
let progressTimer;
let completedZone;
const cycleDuration = 7500;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function updateReadings() {
  readings.media = zoneMedia[zone];
  for (const [key, value] of Object.entries(readings)) {
    get(key + '-value').textContent = value;
    get('focus-' + key).textContent = value + (key === 'temperature' ? ' °C' : '%');
    const bar = get(key + '-bar');
    if (bar) bar.style.width = value + '%';
  }
}

function updateFocusStatus() {
  const done = completedZone === zone;
  get('focus-stage').textContent = watering ? 'Sedang menyiram' : done ? 'Penyiraman selesai' : 'Siap disiram';
  get('focus-pump').textContent = watering ? 'Pompa menyala' : 'Pompa mati';
  get('focus-explanation').textContent = watering ? 'Air mengalir di pipa biru lalu menetes ke media.' :
    done ? 'Lihat perubahan kelembapan media di atas.' : 'Pilih Coba siram untuk melihat air menetes ke akar.';
  const progress = get('focus-progress');
  progress.hidden = !watering && !done;
  progress.value = watering ? Math.min(100,(performance.now()-wateringStarted)/cycleDuration*100) : done ? 100 : 0;
}

function updatePump() {
  get('pump-state').textContent = watering ? 'Menyala' : 'Mati';
  get('pump-state').classList.toggle('active', watering);
  get('pump-description').textContent = watering ? 'Air menetes ke akar di Zona ' + zone : 'Menunggu penyiraman';
  const empty = !readings.water || !readings.nutrient;
  get('water-label').textContent = watering ? 'Berhenti siram' : empty ? 'Isi ulang simulasi' : 'Coba siram';
  if (!watering && empty) get('pump-description').textContent = 'Tandon kosong';
  zoneInputs.forEach(input => input.disabled = watering);
  viewer?.setWatering(watering ? zone : null);
  updateFocusStatus();
}

function stopWatering(completed = false) {
  completedZone = completed ? zone : null;
  clearInterval(progressTimer);
  clearInterval(tickTimer);
  clearTimeout(stopTimer);
  watering = false;
  updatePump();
}

get('water').addEventListener('click', () => {
  if (watering) return stopWatering();
  if (!readings.water || !readings.nutrient) {
    readings.water = 78;
    readings.nutrient = 64;
    updateReadings();
    updatePump();
    return;
  }
  watering = true;
  completedZone = null;
  wateringStarted = performance.now();
  updatePump();
  progressTimer = setInterval(updateFocusStatus,150);
  tickTimer = setInterval(() => {
    if (!readings.water || !readings.nutrient) return stopWatering();
    readings.water--;
    readings.nutrient--;
    zoneMedia[zone] = Math.min(100, zoneMedia[zone] + 2);
    updateReadings();
    if (!readings.water || !readings.nutrient) stopWatering();
  }, 1400);
  stopTimer = setTimeout(() => stopWatering(true), cycleDuration);
});
function selectZone(nextZone) {
  if (watering) return;
  zone = nextZone;
  zoneInputs.forEach(input => input.checked = input.value === zone);
  get('selected-zone').textContent = 'Zona ' + zone + ' dipilih';
  viewer?.setZone(zone);
  updateReadings();
  updateFocusStatus();
}

zoneInputs.forEach(input => {
  input.addEventListener('change', () => {
    if (input.checked) selectZone(input.value);
  });
  input.addEventListener('click', () => {
    if (input.value === zone) selectZone(input.value);
  });
});
updateReadings();
updatePump();

async function makeViewer() {
  const holder = get('viewport');
  const scene = new THREE.Scene();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2',{alpha:true,antialias:true});
  const renderer = context ? new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true}) : canvasRenderer(canvas);
  if (context) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }
  let frame;
  function invalidate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      renderer.render(scene,camera);
      positionZoneLabels();
    });
  }
  const camera = new THREE.OrthographicCamera(-10,10,10,-10,.1,200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change',invalidate);
  let cameraFrame;
  let switchTimer;
  let inCloseup = false;
  let focusedZone;
  let fruitLabelAnchor;
  let previousZoom = camera.zoom;
  controls.addEventListener('change', () => {
    const zoomedOut = camera.zoom < previousZoom;
    previousZoom = camera.zoom;
    // Once the view is wider than a plant, leave the aisle and reframe the building.
    if (inCloseup && !cameraFrame && zoomedOut && (camera.top-camera.bottom)/camera.zoom >= 2.5) {
      goHome();
    }
  });
  controls.minZoom = .68;
  controls.maxZoom = 64;
  controls.zoomSpeed = 1.6;
  controls.maxPolarAngle = Math.PI * .49;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  scene.add(new THREE.HemisphereLight(0xf9ffe9,0xa0a88b,2.45));
  const sun = new THREE.DirectionalLight(0xffefd4,2.7);
  sun.position.set(8,16,8);
  scene.add(sun);

  let model;
  try {
    ({scene:model} = await new GLTFLoader().loadAsync(new URL('greenhouse.glb', document.baseURI).href));
  } catch (error) {
    controls.dispose();
    renderer.dispose();
    throw error;
  }
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const homeDirection = new THREE.Vector3(19,20,25);
  const homePosition = center.clone().add(homeDirection);
  const homeRight = new THREE.Vector3().crossVectors(camera.up,homeDirection).normalize();
  const homeUp = new THREE.Vector3().crossVectors(homeDirection,homeRight).normalize();
  const size = bounds.getSize(new THREE.Vector3());
  const extent = axis => (Math.abs(axis.x)*size.x + Math.abs(axis.y)*size.y + Math.abs(axis.z)*size.z)/2;
  const homeWidth = extent(homeRight);
  const homeHeight = extent(homeUp);
  let overviewZoom = 1;
  const roof = model.getObjectByName('Roof');
  const structuralGroups = [];
  const frameMaterials = [];
  model.traverse(object => {
    if (object.name === 'Frame' || /^Row_[AB]\d{2}_Trellis$/.test(object.name)) structuralGroups.push(object);
  });
  for (const group of structuralGroups) {
    group.traverse(object => {
      if (!object.isMesh) return;
      object.material = object.material.clone();
      frameMaterials.push(object.material);
    });
  }
  let frameOpacity = 1;
  function setFrameOpacity(opacity) {
    frameOpacity = opacity;
    structuralGroups.forEach(group => group.visible = opacity > .025);
    for (const material of frameMaterials) {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.depthWrite = opacity === 1;
    }
  }
  const walls = model.getObjectByName('WallScreens');
  roof.visible = false;
  walls.visible = false;
  const stageMap = {};
  for (const name of ['Pump','Supply_Header','Manifold_A','Manifold_B','Valve_A','Valve_B','Flow_A','Flow_B']) {
    const group = model.getObjectByName(name);
    stageMap[name] = group ? [group] : [];
  }
  for (const z of ['A','B']) {
    stageMap[z] = [];
    model.traverse(obj => {
      if (obj.name.match(new RegExp('^Row_' + z + '\\d{2}_DripLine$'))) stageMap[z].push(obj);
    });
  }
  const areas = {};
  const zoneWidth = 3.26;
  const zoneLength = 18.35;
  const glowMaterials = [
    {color:0x91f6a0, opacity:.17},
    {color:0x5bf58a, opacity:.94},
    {color:0x87ff9c, opacity:.34},
  ].map(options => new THREE.MeshBasicMaterial({
    ...options, transparent:true, depthWrite:false, toneMapped:false,
  }));
  const edgeWidth = .10;
  const haloWidth = .14;
  for (const [letter, rows] of Object.entries(rowsByZone)) {
    const area = new THREE.Group();
    area.rotation.x = -Math.PI / 2;
    area.position.set((rows[0] + rows.at(-1)) / 2,.037,-10);
    area.visible = letter === zone;
    function strip(width,length,x,y,material) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,length),material);
      mesh.name = 'ZoneHighlight_' + letter;
      mesh.position.set(x,y,0);
      area.add(mesh);
    }
    const innerWidth = zoneWidth - 2*edgeWidth;
    const innerLength = zoneLength - 2*edgeWidth;
    strip(innerWidth,innerLength,0,0,glowMaterials[0]);
    for (const side of [-1,1]) {
      strip(edgeWidth,zoneLength,side*(zoneWidth-edgeWidth)/2,0,glowMaterials[1]);
      strip(innerWidth,edgeWidth,0,side*(zoneLength-edgeWidth)/2,glowMaterials[1]);
      strip(haloWidth,zoneLength+2*haloWidth,side*(zoneWidth+haloWidth)/2,0,glowMaterials[2]);
      strip(zoneWidth,haloWidth,0,side*(zoneLength+haloWidth)/2,glowMaterials[2]);
    }
    model.add(area);
    areas[letter] = area;
  }
  const zoneLabels = Object.entries(areas).map(([letter,area]) => {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'zone-label';
    label.textContent = 'Zone ' + letter;
    label.addEventListener('click', () => selectZone(letter));
    holder.append(label);
    return {letter,label,position:area.position.clone().setY(2.9)};
  });
  const labelPoint = new THREE.Vector3();
  function positionZoneLabels() {
    camera.updateMatrixWorld();
    for (const {letter,label,position} of zoneLabels) {
      labelPoint.copy(inCloseup && fruitLabelAnchor ? fruitLabelAnchor : position).project(camera);
      label.hidden = Boolean(cameraFrame) || (inCloseup && letter !== focusedZone) ||
        Math.abs(labelPoint.x) > .92 || Math.abs(labelPoint.y) > .9 || Math.abs(labelPoint.z) > 1;
      label.disabled = watering;
      label.setAttribute('aria-pressed', String(letter === zone));
      label.style.left = (labelPoint.x+1)*50 + '%';
      label.style.top = (1-labelPoint.y)*50 + '%';
    }
  }
  const animateWater = irrigationAnimation(holder,camera);
  animateWater(null);
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0,1,0),-.037);
  const hit = new THREE.Vector3();
  let pointerStart;
  const canvasElement = renderer.domElement;
  canvasElement.addEventListener('pointerdown', event => {
    pointerStart = event.isPrimary && event.button === 0 ? [event.clientX,event.clientY] : null;
  });
  canvasElement.addEventListener('pointercancel', () => pointerStart = null);
  canvasElement.addEventListener('pointerup', event => {
    const start = pointerStart;
    pointerStart = null;
    if (cameraFrame || switchTimer || !event.isPrimary || !start || Math.hypot(event.clientX-start[0],event.clientY-start[1]) > 5 || watering || roof.visible) return;
    const rect = canvasElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer,camera);
    if (!raycaster.ray.intersectPlane(floor,hit) || hit.z < -19.2 || hit.z > -.8) return;
    for (const [letter, area] of Object.entries(areas)) {
      if (Math.abs(hit.x-area.position.x) <= 1.63) selectZone(letter);
    }
  });
  const originals = new Map();
  const flowing = new THREE.MeshStandardMaterial({ color:0x12b9e8, emissive:0x0694d3, emissiveIntensity:.85 });

  function resize() {
    const width = holder.clientWidth;
    const height = holder.clientHeight;
    const ratio = width / height;
    const halfHeight = Math.max(9.8, 10.3 / ratio);
    camera.left = -halfHeight * ratio;
    camera.right = halfHeight * ratio;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    const oldOverviewZoom = overviewZoom;
    overviewZoom = .89 * Math.min(camera.right/homeWidth,camera.top/homeHeight);
    if (!inCloseup && camera.zoom === oldOverviewZoom) camera.zoom = overviewZoom;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    invalidate();
  }

  function cancelCameraSequence() {
    cancelAnimationFrame(cameraFrame);
    clearTimeout(switchTimer);
    cameraFrame = undefined;
    switchTimer = undefined;
  }

  function goHome() {
    cancelCameraSequence();
    inCloseup = false;
    focusedZone = undefined;
    controls.enabled = true;
    setFrameOpacity(1);
    get('zone-card').hidden = true;
    camera.position.copy(homePosition);
    controls.target.copy(center);
    camera.zoom = overviewZoom;
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }

  function flyCamera(target,offset,targetZoom,endOpacity,duration,onComplete) {
    const startTarget = controls.target.clone();
    const startZoom = camera.zoom;
    const startOpacity = frameOpacity;
    const startOrbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(startTarget));
    const endOrbit = new THREE.Spherical().setFromVector3(offset);
    const turn = THREE.MathUtils.euclideanModulo(endOrbit.theta-startOrbit.theta+Math.PI,2*Math.PI)-Math.PI;
    const orbit = new THREE.Spherical();
    const viewOffset = new THREE.Vector3();
    const started = performance.now();
    controls.enabled = false;
    function moveCamera(now) {
      const t = reduceMotion.matches ? 1 : Math.min(1,(now-started)/duration);
      const ease = t*t*(3-2*t);
      controls.target.lerpVectors(startTarget,target,ease);
      orbit.set(
        THREE.MathUtils.lerp(startOrbit.radius,endOrbit.radius,ease),
        THREE.MathUtils.lerp(startOrbit.phi,endOrbit.phi,ease),
        startOrbit.theta + turn*ease,
      );
      camera.position.copy(controls.target).add(viewOffset.setFromSpherical(orbit));
      camera.zoom = startZoom * (targetZoom/startZoom)**ease;
      camera.updateProjectionMatrix();
      setFrameOpacity(THREE.MathUtils.lerp(startOpacity,endOpacity,ease));
      controls.update();
      if (t < 1) cameraFrame = requestAnimationFrame(moveCamera);
      else {
        cameraFrame = undefined;
        onComplete();
      }
      invalidate();
    }
    cameraFrame = requestAnimationFrame(moveCamera);
  }

  function focusZone(selected) {
    inCloseup = true;
    if (roof.visible) get('roof').click();
    get('zone-card-title').textContent = 'Zona ' + selected;
    get('zone-card').hidden = false;
    const innerRowX = selected === 'A' ? 3.25 : 4.75;
    const aisleSide = selected === 'A' ? 1 : -1;
    const plant = selected === 'A' ? 3 : 4;
    const plantZ = -1.225 - .45 * plant;
    const fruitMesh = model.getObjectByName(selected === 'A' ? 'Row_A04_Melon' : 'Row_B01_Melon');
    const fruitBounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    if (fruitMesh) {
      const positions = fruitMesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(fruitMesh.matrixWorld);
        if (Math.abs(vertex.z - plantZ) < .19) fruitBounds.expandByPoint(vertex);
      }
    }
    const fruit = fruitBounds.isEmpty() ? new THREE.Vector3(innerRowX + aisleSide * .14, 1.08, plantZ) :
      fruitBounds.getCenter(new THREE.Vector3());
    const mobile = holder.clientWidth < 550;
    const offset = new THREE.Vector3(aisleSide * .64, .10, .24);
    const right = new THREE.Vector3().crossVectors(camera.up, offset).normalize();
    const up = new THREE.Vector3().crossVectors(offset, right).normalize();
    const focus = fruit.clone().addScaledVector(up, -.10);
    if (!mobile) focus.addScaledVector(right, .14);
    fruitLabelAnchor = fruit.clone().add(new THREE.Vector3(0,.22,0));
    const viewHeight = mobile ? .99 : .87;
    const aspect = holder.clientWidth / holder.clientHeight;
    const targetZoom = 2 * Math.max(9.8, 10.3 / aspect) / viewHeight;
    flyCamera(focus,offset,targetZoom,0,760,() => {
      controls.enabled = true;
    });
  }

  function selectCameraZone(selected) {
    const isSwitch = focusedZone && focusedZone !== selected;
    const isWaiting = Boolean(switchTimer);
    cancelCameraSequence();
    focusedZone = selected;
    if (!isSwitch && !isWaiting) {
      focusZone(selected);
      return;
    }
    inCloseup = false;
    get('zone-card').hidden = true;
    flyCamera(center,homeDirection,overviewZoom,1,650,() => {
      switchTimer = setTimeout(() => {
        switchTimer = undefined;
        focusZone(selected);
      },1700);
    });
  }

  holder.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Model 3D greenhouse melon');
  holder.querySelector('.fallback').hidden = true;
  resize();
  goHome();
  new ResizeObserver(resize).observe(holder);


  return {
    goHome,
    setZone(selected) {
      for (const [letter,area] of Object.entries(areas)) area.visible = letter === selected;
      selectCameraZone(selected);
      invalidate();
    },
    toggleRoof() {
      if (!roof.visible && (inCloseup || switchTimer || cameraFrame)) goHome();
      roof.visible = !roof.visible;
      walls.visible = roof.visible;
      invalidate();
      return roof.visible;
    },
    setWatering(activeZone) {
      animateWater(activeZone);
      for (const [mesh,material] of originals) mesh.material = material;
      originals.clear();
      invalidate();
      if (!activeZone) return;
      for (const name of ['Pump','Supply_Header','Valve_'+activeZone,'Flow_'+activeZone,'Manifold_'+activeZone,activeZone]) {
        for (const group of stageMap[name]) group.traverse(obj => {
          if (!obj.isMesh) return;
          originals.set(obj, obj.material);
          obj.material = flowing;
        });
      }
    },
  };
}

makeViewer().then(result => {
  viewer = result;
  get('scene-badge').querySelector('span').textContent = 'Tampilan potong';
  get('reset').disabled = false;
  get('roof').disabled = false;
  get('roof').setAttribute('aria-pressed','false');
  get('reset').addEventListener('click', viewer.goHome);
  get('close-focus').addEventListener('click', () => {
    viewer.goHome();
    get('reset').focus();
  });
  get('roof').addEventListener('click', () => {
    const visible = viewer.toggleRoof();
    get('roof').setAttribute('aria-pressed', String(visible));
    get('roof-text').textContent = visible ? 'Buka atap' : 'Tampilkan atap';
    get('scene-badge').querySelector('span').textContent = visible ? 'Bangunan lengkap' : 'Tampilan potong';
  });
  updatePump();
}).catch(error => {
  console.error('Model greenhouse tidak dapat dimuat',error);
  get('scene-badge').querySelector('span').textContent = 'Pratinjau gambar';
  get('viewer-help').textContent = 'Tampilan 3D tidak tersedia di perangkat ini.';
});
