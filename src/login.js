import './login.css';
import { firebaseConfigured, loadFirebaseAuth } from './firebase-auth.js';

const button = document.getElementById('google-login');
const status = document.getElementById('login-status');
const messages = new Map([
  ['unavailable', 'Login Google belum tersedia. Anda bisa lanjut sebagai tamu.'],
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
status.textContent = message ?? '';

async function prepareGoogleLogin() {
  if (firebaseConfigured) {
    const firebase = await loadFirebaseAuth();
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        await firebase.signIn();
        location.assign('./dashboard.html?account=google');
      } catch (error) {
        status.textContent = messages.get(error.code) ?? messages.get('failed');
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
  if (!message) status.textContent = messages.get('unavailable');
});
