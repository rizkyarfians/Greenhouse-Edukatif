import './style.css';
import './workspace-theme.css';
import './dashboard-workspace.css';
import './theme.js';
import sprout from 'lucide-static/icons/sprout.svg?raw';
import {detailedCrops} from './detailed-crops.js';
import {dashboardAccount} from './dashboard-account.js';
import {accountSimulationStore, storageError} from './account-storage-api.js';
import {browserSimulationStore, storagePrefix, validLayoutPreview} from './simulation-storage.js';
import dashboardIcon from 'lucide-static/icons/layout-dashboard.svg?raw';
import scanIcon from 'lucide-static/icons/scan-line.svg?raw';
import folderIcon from 'lucide-static/icons/folder.svg?raw';
import boxIcon from 'lucide-static/icons/box.svg?raw';
import mapIcon from 'lucide-static/icons/map.svg?raw';
import chevronLeft from 'lucide-static/icons/chevron-left.svg?raw';
import plusIcon from 'lucide-static/icons/plus.svg?raw';
import saveIcon from 'lucide-static/icons/save.svg?raw';
import greenhouseIcon from 'lucide-static/icons/house.svg?raw';

const get = id => document.getElementById(id);
const home = get('guest-home');
const simulationView = get('simulation-view');
const savedList = get('saved-list');
const homeMessage = get('home-message');
const saveButton = get('save-simulation');
const saveMessage = get('save-message');
const backButton = get('back-home');
const retrySaved = get('retry-saved');
const importLocal = get('import-local');
const importStatus = get('import-status');
const landTypes = {
  greenhouse: {
    label: 'Greenhouse Melon',
    defaultName: 'Kebun Melon',
    scanType: 'greenhouse',
    load: () => import('./simulation.js'),
  },
  rice: {
    label: 'Lahan Terbuka Padi',
    defaultName: 'Sawah Padi',
    scanType: 'open-field',
    load: () => import('./rice-field.js'),
  },
};
const landInputs = [...document.querySelectorAll('input[name=land-type]')];
const projectName = get('project-name');
const cropSelect = get('simulation-crop');
const modelChoices = Object.entries(detailedCrops).map(([id, crop]) => ({...crop, id}));
const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
let activeProject;
let simulation;
let lastSavedState;
let listRequest = 0;
const storeReady = dashboardAccount.then(account => {
  if (!account) return null;
  if (account.mode === 'guest') return browserSimulationStore;
  get('project-storage-label').textContent = 'Tersimpan di akun Google · tersedia di perangkat lain';
  importLocal.hidden = !localProjects().length;
  return accountSimulationStore(account);
});

function localProjects() {
  try {
    return browserSimulationStore.list();
  } catch {
    return [];
  }
}

document.querySelector('.brand-icon').innerHTML = sprout;
document.querySelector('.brand-icon').setAttribute('aria-hidden', 'true');
document.querySelector('[data-land-icon=greenhouse]').innerHTML = greenhouseIcon;
document.querySelector('[data-land-icon=rice]').innerHTML = sprout;

const workspaceIcons = {
  'layout-dashboard': dashboardIcon, 'scan-line': scanIcon, folder: folderIcon,
  box: boxIcon, map: mapIcon, 'chevron-left': chevronLeft, save: saveIcon,
};
for (const icon of document.querySelectorAll('[data-workspace-icon]')) {
  icon.innerHTML = workspaceIcons[icon.dataset.workspaceIcon];
}

const homeLinks = [...document.querySelectorAll('.home-nav a[href^="#"]')];
function updateHomeNavigation() {
  const active = location.hash === '#saved-title' ? '#saved-title' : '#home-title';
  for (const link of homeLinks) {
    if (link.hash === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', updateHomeNavigation);
updateHomeNavigation();

function selectedLandType() {
  return landInputs.find(input => input.checked).value;
}

async function renderSavedProjects() {
  const request = ++listRequest;
  retrySaved.hidden = true;
  savedList.replaceChildren();
  homeMessage.textContent = 'Memuat layout…';
  try {
    const store = await storeReady;
    if (!store || request !== listRequest) return;
    if (store === browserSimulationStore) {
      get('project-storage-label').textContent = 'Tersimpan di browser ini';
    }
    const projects = await store.list();
    if (request !== listRequest) return;
    showSavedProjects(projects);
  } catch (error) {
    if (request !== listRequest) return;
    homeMessage.textContent = storageError(error, 'memuat layout');
    retrySaved.hidden = false;
  }
}

function showSavedProjects(projects) {
  homeMessage.textContent = '';
  for (const project of projects.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const row = document.createElement('li');
    const open = document.createElement('button');
    open.className = 'saved-project';
    open.type = 'button';
    open.setAttribute('aria-label', 'Buka ' + project.name);

    const cover = document.createElement('img');
    const captured = validLayoutPreview(project.preview);
    cover.className = 'saved-cover';
    cover.src = captured ? project.preview :
      project.type === 'greenhouse' ? './greenhouse-preview.png' : './lahan-terbuka-preview.webp';
    cover.alt = '';
    cover.loading = 'lazy';

    const info = document.createElement('span');
    info.className = 'saved-project-info';
    const name = document.createElement('strong');
    name.textContent = project.name;
    const date = document.createElement('time');
    date.dateTime = new Date(project.updatedAt).toISOString();
    date.textContent = 'Disimpan ' + dateFormat.format(project.updatedAt);
    info.append(name, date);

    open.append(cover, info);
    open.addEventListener('click', () => openProject(project));
    row.append(open);
    savedList.append(row);
  }

  for (let slot = 0; slot < Math.max(1, 6 - projects.length); slot++) {
    const row = document.createElement('li');
    const add = document.createElement('button');
    add.className = 'new-layout';
    add.type = 'button';
    add.setAttribute('aria-label', 'Buat layout baru');
    add.title = 'Buat layout baru';
    add.innerHTML = plusIcon;
    add.firstElementChild.setAttribute('aria-hidden', 'true');
    add.addEventListener('click', () => {
      history.replaceState(history.state, '', '#plot-title');
      updateHomeNavigation();
      const title = get('plot-title');
      title.focus({preventScroll: true});
      title.scrollIntoView({block: 'start'});
    });
    row.append(add);
    savedList.append(row);
  }
}

async function openProject(project) {
  activeProject = project;
  saveButton.disabled = true;
  saveMessage.textContent = '';
  simulation = undefined;
  const landType = landTypes[project.type];
  get('simulation-title').textContent = project.name;
  get('greenhouse-dashboard').hidden = Boolean(project.cropId) || project.type !== 'greenhouse';
  get('rice-dashboard').hidden = Boolean(project.cropId) || project.type !== 'rice';
  get('crop-dashboard').hidden = !project.cropId;
  home.hidden = true;
  simulationView.hidden = false;
  get('simulation-title').focus();
  window.scrollTo(0, 0);
  try {
    if (project.cropId) {
      const greenhouse = project.type === 'greenhouse';
      get('crop-view-title').textContent = (greenhouse ? 'Greenhouse ' : 'Kebun ') + detailedCrops[project.cropId].name + ' 3D';
      get('crop-greenhouse-controls').hidden = !greenhouse;
      get('toggle-crop-roof').disabled = true;
      get('toggle-crop-drip').disabled = true;
      get('crop-drip-status').textContent = '';
      get('crop-view-caption').textContent = 'Memuat kebun…';
      get('crop-bed-count').textContent = '';
      get('reset-crop-view').disabled = true;
      const params = new URLSearchParams({type: landType.scanType, crop: project.cropId});
      get('view-crop-scan').href = './scan.html?' + params;
      const module = await import('./crop-garden.js');
      if (activeProject !== project) return;
      const garden = await module.loadCropGarden(project.cropId, landType.scanType);
      if (activeProject !== project) return;
      simulation = module.openCropGarden(garden, {greenhouse});
    } else {
      const module = await landType.load();
      if (activeProject !== project) return;
      simulation = module;
      simulation.openSimulation(project.state);
    }
    lastSavedState = JSON.stringify(simulation.snapshotSimulation());
    saveButton.disabled = false;
  } catch (error) {
    if (activeProject !== project) return;
    console.error('Simulasi gagal dimuat', error);
    saveMessage.textContent = 'Simulasi gagal dimuat. Kembali ke beranda untuk mencoba lagi.';
  }
}

function defaultName(type, cropId) {
  return cropId ? 'Kebun ' + detailedCrops[cropId].name : landTypes[type].defaultName;
}

function updateLandActions() {
  const type = selectedLandType();
  const previous = cropSelect.value;
  cropSelect.replaceChildren(new Option(type === 'greenhouse' ? 'Melon' : 'Padi', ''),
    ...modelChoices.map(crop => new Option(crop.name, crop.id)));
  cropSelect.value = Object.hasOwn(detailedCrops, previous) ? previous : '';
  projectName.placeholder = defaultName(type, cropSelect.value);
  updateScanLinks(type);
}

function updateScanLinks(type) {
  const params = new URLSearchParams({type: landTypes[type].scanType});
  if (cropSelect.value) params.set('crop', cropSelect.value);
  const scanPath = './scan.html?' + params;
  get('scan-selected-land').href = scanPath;
  get('nav-scan').href = scanPath;
}

for (const input of landInputs) input.addEventListener('change', updateLandActions);
window.addEventListener('pageshow', updateLandActions);
cropSelect.addEventListener('change', () => {
  const type = selectedLandType();
  projectName.placeholder = defaultName(type, cropSelect.value);
  updateScanLinks(type);
});
updateLandActions();

get('start-simulation').addEventListener('submit', event => {
  event.preventDefault();
  const type = selectedLandType();
  const cropId = cropSelect.value || undefined;
  const name = projectName.value.trim() || defaultName(type, cropId);
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), part =>
    part.toString(16).padStart(8, '0')).join('');
  projectName.value = '';
  openProject({id, name, type, cropId});
});

saveButton.addEventListener('click', async () => {
  const state = simulation.snapshotSimulation();
  const project = {...activeProject, state, updatedAt: Date.now()};
  const preview = simulation.capturePreview();
  if (validLayoutPreview(preview)) project.preview = preview;
  saveButton.disabled = true;
  backButton.disabled = true;
  saveMessage.textContent = 'Menyimpan…';
  try {
    const store = await storeReady;
    if (!store) return;
    try {
      await store.save(project);
    } catch (error) {
      if (store !== browserSimulationStore || error?.name !== 'QuotaExceededError' || !project.preview) throw error;
      delete project.preview;
      await store.save(project);
    }
    activeProject = project;
    lastSavedState = JSON.stringify(state);
    saveMessage.textContent = store === browserSimulationStore ? 'Tersimpan di browser ini.' : 'Tersimpan ke akun Google.';
  } catch (error) {
    saveMessage.textContent = storageError(error, 'menyimpan layout');
  } finally {
    saveButton.disabled = false;
    backButton.disabled = false;
  }
});

backButton.addEventListener('click', () => {
  if (!saveButton.disabled && JSON.stringify(simulation.snapshotSimulation()) !== lastSavedState &&
      !window.confirm('Ada perubahan yang belum disimpan. Kembali ke beranda?')) return;
  simulation?.pauseSimulation();
  activeProject = undefined;
  simulationView.hidden = true;
  home.hidden = false;
  renderSavedProjects();
  get('home-title').focus();
  window.scrollTo(0, 0);
});

retrySaved.addEventListener('click', renderSavedProjects);

importLocal.addEventListener('click', async () => {
  const local = localProjects();
  if (!local.length || !window.confirm('Salin ' + local.length + ' layout dari browser ini ke akun Google yang aktif?')) return;
  importLocal.disabled = true;
  importStatus.textContent = 'Menyalin simpanan browser…';
  try {
    const store = await storeReady;
    let copied = 0, failed = 0;
    for (const project of local) {
      try {
        if (await store.copyIfMissing(project)) copied++;
      } catch {
        failed++;
      }
    }
    const skipped = local.length - copied - failed;
    importStatus.textContent = copied + ' disalin · ' + skipped + ' sudah ada' +
      (failed ? ' · ' + failed + ' gagal. Coba lagi.' : '.');
    await renderSavedProjects();
  } catch (error) {
    importStatus.textContent = storageError(error, 'menyalin simpanan');
  } finally {
    importLocal.disabled = false;
  }
});

window.addEventListener('storage', async event => {
  if (event.key && !event.key.startsWith(storagePrefix)) return;
  const account = await dashboardAccount;
  if (account && account.mode !== 'guest') {
    importLocal.hidden = !localProjects().length;
  } else if (account && !home.hidden) {
    renderSavedProjects();
  }
});
window.addEventListener('pageshow', event => {
  if (event.persisted && !home.hidden) renderSavedProjects();
});
renderSavedProjects();
