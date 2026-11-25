import './dashboard-account.css';
import { firebaseConfigured, loadFirebaseAuth } from './firebase-auth.js';

const label = document.getElementById('account-label');
const login = document.getElementById('account-login');
const logout = document.getElementById('account-logout');
const status = document.getElementById('account-status');

const params = new URLSearchParams(location.search);
let isGuest = params.get('guest') === '1';
try {
  if (isGuest) sessionStorage.setItem('automotion.guest', '1');
  else if (params.get('account') === 'google') sessionStorage.removeItem('automotion.guest');
  else isGuest = sessionStorage.getItem('automotion.guest') === '1';
} catch {
  // The dashboard still works if the browser blocks storage.
}

async function showAccount() {
  if (isGuest) return;
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
    }
  } catch {
    // Static previews and offline sessions can use the guest dashboard.
  }
}

showAccount();

logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    if (firebaseConfigured) {
      await (await loadFirebaseAuth()).signOut();
    } else {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
    }
    location.assign('./index.html');
  } catch {
    status.textContent = 'Gagal keluar. Coba lagi.';
    logout.disabled = false;
  }
});
