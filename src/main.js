import './style.css';
import './workspace-theme.css';
import './dashboard-workspace.css';
import sprout from 'lucide-static/icons/sprout.svg?raw';
import {detailedCrops} from './detailed-crops.js';
import {cropChoices} from './land-type.js';
import {dashboardAccount} from './dashboard-account.js';
import {accountSimulationStore, storageError} from './account-storage-api.js';
import {browserSimulationStore, storagePrefix} from './simulation-storage.js';
import dashboardIcon from 'lucide-static/icons/layout-dashboard.svg?raw';
import scanIcon from 'lucide-static/icons/scan-line.svg?raw';
import folderIcon from 'lucide-static/icons/folder.svg?raw';
import boxIcon from 'lucide-static/icons/box.svg?raw';
import mapIcon from 'lucide-static/icons/map.svg?raw';
import chevronLeft from 'lucide-static/icons/chevron-left.svg?raw';
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
const availableCrops = type => cropChoices(modelChoices, landTypes[type].scanType);
const supportsCrop = (type, id) => availableCrops(type).some(crop => crop.id === id);
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
  get('project-storage-label').textContent = 'Simpanan akun Google · tersedia di perangkat lain';
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
  homeMessage.textContent = 'Memuat simpanan…';
  try {
    const store = await storeReady;
    if (!store || request !== listRequest) return;
    if (store === browserSimulationStore) {
      get('project-storage-label').textContent = 'Simpanan di browser ini';
    }
    const projects = await store.list();
    if (request !== listRequest) return;
    showSavedProjects(projects);
  } catch (error) {
    if (request !== listRequest) return;
    homeMessage.textContent = storageError(error, 'memuat simpanan');
    retrySaved.hidden = false;
  }
}

function showSavedProjects(projects) {
  homeMessage.textContent = projects.length ? '' : 'Belum ada simulasi tersimpan.';
  for (const project of projects.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const row = document.createElement('li');
    row.className = 'saved-project panel';
    const info = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = project.name;
    const summary = document.createElement('p');
    const plot = project.type === 'greenhouse' ? `Zona ${project.state.zone}` : `Genangan ${project.state.waterDepth} cm`;
    const label = project.cropId
      ? `${project.type === 'greenhouse' ? 'Greenhouse' : 'Lahan terbuka'} · ${detailedCrops[project.cropId].name}`
      : `${landTypes[project.type].label} · ${plot}`;
    summary.textContent = `${label} · Disimpan ${dateFormat.format(project.updatedAt)}`;
    info.append(name, summary);
    const open = document.createElement('button');
    open.className = 'secondary-button';
    open.type = 'button';
    open.textContent = 'Buka';
    open.setAttribute('aria-label', 'Buka ' + project.name);
    open.addEventListener('click', () => openProject(project));
    row.append(info, open);
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
    const module = await (project.cropId ? import('./crop-preview.js') : landType.load());
    if (activeProject !== project) return;
    if (project.cropId) {
      simulation = module.openCropPreview(project.cropId);
    } else {
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
    ...availableCrops(type).map(crop => new Option(crop.name, crop.id)));
  cropSelect.value = supportsCrop(type, previous) ? previous : '';
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
  saveButton.disabled = true;
  backButton.disabled = true;
  saveMessage.textContent = 'Menyimpan…';
  try {
    const store = await storeReady;
    if (!store) return;
    await store.save(project);
    activeProject = project;
    lastSavedState = JSON.stringify(state);
    saveMessage.textContent = store === browserSimulationStore ? 'Tersimpan di browser ini.' : 'Tersimpan ke akun Google.';
  } catch (error) {
    saveMessage.textContent = storageError(error, 'menyimpan simulasi');
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
  if (!local.length || !window.confirm('Salin ' + local.length + ' simulasi dari browser ini ke akun Google yang aktif?')) return;
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
