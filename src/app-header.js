import sprout from 'lucide-static/icons/sprout.svg?raw';
import dashboard from 'lucide-static/icons/layout-dashboard.svg?raw';
import scan from 'lucide-static/icons/scan-line.svg?raw';
import folder from 'lucide-static/icons/folder.svg?raw';
import {initTheme} from './theme.js';
import {currentSession} from './account-session.js';
import './app-header.css';

const header = document.querySelector('[data-app-header]');
const page = header.dataset.appHeader;
const dashboardPath = page === 'dashboard' ? '' : './dashboard.html';
header.innerHTML = `
  <div class="app-header-row">
    <a class="app-brand" href="${dashboardPath}#home-title"><span aria-hidden="true">${sprout}</span>Automotion</a>
    <nav class="home-nav" aria-label="Navigasi utama">
      <a id="nav-home" href="${dashboardPath}#home-title"><span aria-hidden="true">${dashboard}</span>Beranda</a>
      <a id="nav-scan" href="./scan.html"><span aria-hidden="true">${scan}</span>Scan lahan</a>
      <a id="nav-layout" href="${dashboardPath}#saved-title"><span aria-hidden="true">${folder}</span>Layout</a>
    </nav>
    <div class="account-nav">
      <button class="theme-toggle" type="button" role="switch" aria-label="Mode gelap" aria-checked="false"><span aria-hidden="true"></span></button>
      <span id="account-label" hidden></span>
      <a id="account-login" href="./index.html">Masuk</a>
      <button id="account-logout" type="button" hidden>Keluar</button>
      <span id="account-status" role="status"></span>
    </div>
  </div>`;

const label = document.getElementById('account-label');
const login = document.getElementById('account-login');
const logout = document.getElementById('account-logout');
const status = document.getElementById('account-status');
let account;

initTheme(header.querySelector('.theme-toggle'));

export function setHeaderSection(section) {
  for (const link of header.querySelectorAll('.home-nav a')) {
    if (link.id === 'nav-' + section) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

export function setHeaderAccount(session) {
  account = session;
  const signedIn = Boolean(session && session.mode !== 'guest');
  label.textContent = session?.name ?? '';
  label.title = label.textContent;
  label.hidden = !session;
  login.hidden = signedIn;
  logout.hidden = !signedIn;
}

if (page === 'scan' || page === 'scanner') setHeaderSection('scan');
if (page === 'scanner') {
  const scanLink = header.querySelector('#nav-scan');
  scanLink.href = './scan.html' + location.search;
  scanLink.addEventListener('click', event => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
  });
}
if (page === 'login') {
  login.setAttribute('aria-current', 'page');
  header.querySelector('#nav-scan').addEventListener('click', event => {
    if (account) return;
    event.preventDefault();
    document.getElementById('login-title').focus();
  });
}

export const headerAccount = currentSession().catch(() => null).then(session => {
  setHeaderAccount(session);
  return session;
});

window.addEventListener('pageshow', async event => {
  if (event.persisted && page !== 'dashboard') setHeaderAccount(await currentSession().catch(() => null));
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  status.textContent = '';
  try {
    if (account.mode === 'firebase') {
      await account.firebase.signOut();
    } else {
      const response = await fetch('/api/auth/logout', {method: 'POST'});
      if (!response.ok) throw new Error('Logout failed');
    }
    location.replace('./index.html');
  } catch {
    status.textContent = 'Gagal keluar. Coba lagi.';
    logout.disabled = false;
  }
});
