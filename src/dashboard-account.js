import './dashboard-account.css';
import { firebaseConfigured, loadFirebaseAuth } from './firebase-auth.js';

const label = document.getElementById('account-label');
const login = document.getElementById('account-login');
const logout = document.getElementById('account-logout');
const status = document.getElementById('account-status');

const content = document.getElementById('dashboard-content');
const loading = document.getElementById('dashboard-loading');

function hasGuestSession() {
  try {
    if (new URLSearchParams(location.search).get('account') === 'google') {
      sessionStorage.removeItem('automotion.guest');
    }
    return sessionStorage.getItem('automotion.guest') === '1';
  } catch {
    return false;
  }
}

function revealDashboard() {
  loading.hidden = true;
  content.hidden = false;
}

async function openDashboard() {
  if (hasGuestSession()) {
    label.textContent = 'Mode tamu';
    login.hidden = false;
    logout.hidden = true;
    revealDashboard();
    return;
  }
  try {
    let displayName;
    if (firebaseConfigured) {
      const user = await (await loadFirebaseAuth()).currentUser();
      if (user) displayName = user.displayName || user.email || 'Akun Google';
    } else {
      const response = await fetch('/api/auth/session', { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const { user } = await response.json();
        if (user) displayName = user.name || user.email || 'Akun Google';
      }
    }
    if (displayName) {
      label.textContent = displayName;
      login.hidden = true;
      logout.hidden = false;
      revealDashboard();
      return;
    }
  } catch {
    // Send the user through the sign-in page, which also offers guest access.
  }
  location.replace('./index.html');
}

openDashboard();
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    content.hidden = true;
    loading.hidden = false;
    openDashboard();
  }
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    if (firebaseConfigured) {
      await (await loadFirebaseAuth()).signOut();
    } else {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
    }
    location.replace('./index.html');
  } catch {
    status.textContent = 'Gagal keluar. Coba lagi.';
    logout.disabled = false;
  }
});
