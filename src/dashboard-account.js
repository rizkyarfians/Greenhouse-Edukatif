import './dashboard-account.css';
import { firebaseConfigured, loadFirebaseAuth } from './firebase-auth.js';
import { currentSession } from './account-session.js';

const label = document.getElementById('account-label');
const login = document.getElementById('account-login');
const logout = document.getElementById('account-logout');
const status = document.getElementById('account-status');

const content = document.getElementById('dashboard-content');
const loading = document.getElementById('dashboard-loading');

function revealDashboard() {
  loading.hidden = true;
  content.hidden = false;
}

function revealSession(session) {
  label.textContent = session.name;
  login.hidden = session.mode !== 'guest';
  logout.hidden = session.mode === 'guest';
  revealDashboard();
}

export const dashboardAccount = currentSession().catch(() => null).then(session => {
  if (!session) {
    location.replace('./index.html');
    return null;
  }
  revealSession(session);
  session.firebase?.watchUser(user => {
    if (user?.uid === session.uid) return;
    content.hidden = true;
    loading.hidden = false;
    location.reload();
  });
  return session;
});

window.addEventListener('pageshow', async event => {
  if (!event.persisted) return;
  content.hidden = true;
  loading.hidden = false;
  const previous = await dashboardAccount;
  const current = await currentSession().catch(() => null);
  if (!current) {
    location.replace('./index.html');
  } else if (previous?.mode === current.mode && previous?.uid === current.uid &&
             previous?.mode !== 'server') {
    revealSession(current);
  } else {
    location.reload();
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
