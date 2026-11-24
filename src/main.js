import './style.css';
import sprout from 'lucide-static/icons/sprout.svg?raw';

const get = id => document.getElementById(id);
const home = get('guest-home');
const simulationView = get('simulation-view');
const savedList = get('saved-list');
const homeMessage = get('home-message');
const saveButton = get('save-simulation');
const saveMessage = get('save-message');
const storagePrefix = 'greenhouse-edukatif:guest:v1:';
const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
let activeProject;
let simulation;
let lastSavedState;

document.querySelector('.brand-icon').innerHTML = sprout;
document.querySelector('.brand-icon').setAttribute('aria-hidden', 'true');

function parseProject(json, key) {
  try {
    const project = JSON.parse(json);
    const {id, name, updatedAt, state} = project;
    if (!/^[a-f0-9]{32}$/.test(id) || key !== storagePrefix + id ||
        typeof name !== 'string' || !name.trim() ||
        typeof updatedAt !== 'number' || !Number.isFinite(new Date(updatedAt).getTime())) return null;
    if (!['A', 'B'].includes(state.zone) || ![null, 'A', 'B'].includes(state.completedZone) ||
        typeof state.roofVisible !== 'boolean') return null;
    const {temperature, humidity, water, nutrient} = state.readings;
    const percentages = [humidity, water, nutrient, state.zoneMedia.A, state.zoneMedia.B];
    if (!Number.isFinite(temperature) ||
        !percentages.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return null;
    return project;
  } catch {
    return null;
  }
}

function renderSavedProjects() {
  savedList.replaceChildren();
  const projects = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(storagePrefix)) continue;
      const project = parseProject(localStorage.getItem(key), key);
      if (project) projects.push(project);
    }
  } catch {
    homeMessage.textContent = 'Simpanan tidak bisa dibuka. Penyimpanan browser tidak tersedia.';
    return;
  }

  homeMessage.textContent = projects.length ? '' : 'Belum ada simulasi tersimpan.';
  for (const project of projects.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const row = document.createElement('li');
    row.className = 'saved-project panel';
    const info = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = project.name;
    const summary = document.createElement('p');
    summary.textContent = `Zona ${project.state.zone} · Disimpan ${dateFormat.format(project.updatedAt)}`;
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
  get('simulation-title').textContent = project.name;
  home.hidden = true;
  simulationView.hidden = false;
  get('simulation-title').focus();
  window.scrollTo(0, 0);
  try {
    simulation ??= await import('./simulation.js');
    if (activeProject !== project) return;
    simulation.openSimulation(project.state);
    lastSavedState = JSON.stringify(simulation.snapshotSimulation());
    saveButton.disabled = false;
  } catch (error) {
    if (activeProject !== project) return;
    console.error('Simulasi gagal dimuat', error);
    saveMessage.textContent = 'Simulasi gagal dimuat. Kembali ke beranda untuk mencoba lagi.';
  }
}

get('start-simulation').addEventListener('submit', event => {
  event.preventDefault();
  const name = get('project-name').value.trim() || 'Kebun Melon';
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), part =>
    part.toString(16).padStart(8, '0')).join('');
  get('project-name').value = '';
  openProject({id, name});
});

saveButton.addEventListener('click', () => {
  const state = simulation.snapshotSimulation();
  const project = {...activeProject, state, updatedAt: Date.now()};
  try {
    localStorage.setItem(storagePrefix + project.id, JSON.stringify(project));
    activeProject = project;
    lastSavedState = JSON.stringify(state);
    saveMessage.textContent = 'Tersimpan di browser ini.';
  } catch {
    saveMessage.textContent = 'Gagal menyimpan. Periksa pengaturan atau ruang penyimpanan browser, lalu coba lagi.';
  }
});

get('back-home').addEventListener('click', () => {
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

window.addEventListener('storage', event => {
  if (!home.hidden && (!event.key || event.key.startsWith(storagePrefix))) renderSavedProjects();
});
renderSavedProjects();
