import './workspace-theme.css';
import './login.css';
import sprout from 'lucide-static/icons/sprout.svg?raw';

document.getElementById('login-brand-icon').innerHTML = sprout;
import { firebaseConfigured, firebaseConfigIssue, loadFirebaseAuth } from './firebase-auth.js';

const button = document.getElementById('google-login');
const status = document.getElementById('login-status');
const messages = new Map([
  ['unavailable', 'Login Google belum aktif pada versi ini. Anda bisa lanjut sebagai tamu.'],
  ['auth/invalid-auth-domain', 'Format authDomain Firebase keliru. Gunakan hostname dari konfigurasi Web App Firebase.'],
  ['auth/invalid-api-key', 'Firebase menolak API key. Cek konfigurasi Web App pada project yang sama.'],
  ['auth/configuration-not-found', 'Firebase Authentication belum tersedia di project ini. Cek pengaturan Authentication di Firebase Console.'],
  ['auth/operation-not-supported-in-this-environment', 'Buka halaman lewat HTTPS di Chrome, Safari, atau Firefox.'],
  ['expired', 'Permintaan login kedaluwarsa. Coba masuk lagi.'],
  ['cancelled', 'Login Google dibatalkan.'],
  ['failed', 'Login Google belum berhasil. Coba lagi atau masuk sebagai tamu.'],
  ['auth/unauthorized-domain', 'Alamat web ini belum diizinkan di Firebase Authentication.'],
  ['auth/operation-not-allowed', 'Provider Google belum diaktifkan di Firebase Authentication.'],
  ['auth/popup-blocked', 'Pop-up login diblokir. Izinkan pop-up dari situs ini dan coba lagi.'],
  ['auth/popup-closed-by-user', 'Login Google dibatalkan.'],
  ['auth/network-request-failed', 'Koneksi ke Google gagal. Periksa internet dan coba lagi.'],
]);
const message = messages.get(new URLSearchParams(location.search).get('login'));
function firebaseError(error, fallback = 'failed') {
  const code = typeof error?.code === 'string' && /^auth\/[a-z-]{1,70}$/.test(error.code) ? error.code : '';
  const guidance = messages.get(code) ?? messages.get(fallback);
  return code ? `${guidance} (${code})` : guidance;
}
status.textContent = message ?? '';

document.getElementById('guest-entry').addEventListener('click', event => {
  try {
    sessionStorage.setItem('automotion.guest', '1');
  } catch {
    event.preventDefault();
    status.textContent = 'Izinkan penyimpanan situs untuk melanjutkan sebagai tamu.';
  }
});

async function prepareGoogleLogin() {
  if (firebaseConfigured) {
    status.textContent = 'Menyiapkan login Google…';
    let firebase;
    try {
      firebase = await loadFirebaseAuth();
    } catch (error) {
      status.textContent = firebaseError(error, 'unavailable');
      return;
    }
    status.textContent = message ?? '';
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        await firebase.signIn();
        location.assign('./dashboard.html?account=google');
      } catch (error) {
        status.textContent = firebaseError(error);
        button.disabled = false;
      }
    });
    button.disabled = false;
    return;
  }

  const response = await fetch('/api/auth/session', { signal: AbortSignal.timeout(4000) });
  if (!response.ok || !(await response.json()).googleEnabled) throw new Error('Authentication unavailable');
  button.addEventListener('click', () => location.assign('/api/auth/google'));
  button.disabled = false;
}

prepareGoogleLogin().catch(() => {
  if (!message) status.textContent = messages.get(firebaseConfigIssue || 'unavailable');
});
