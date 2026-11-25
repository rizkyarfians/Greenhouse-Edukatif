import './login.css';

const button = document.getElementById('google-login');
const status = document.getElementById('login-status');
const messages = new Map([
  ['unavailable', 'Login Google belum tersedia. Anda bisa lanjut sebagai tamu.'],
  ['expired', 'Permintaan login kedaluwarsa. Coba masuk lagi.'],
  ['cancelled', 'Login Google dibatalkan.'],
  ['failed', 'Login Google belum berhasil. Coba lagi atau masuk sebagai tamu.'],
]);
const message = messages.get(new URLSearchParams(location.search).get('login'));
status.textContent = message ?? '';

button.addEventListener('click', () => location.assign('/api/auth/google'));
async function checkGoogleLogin() {
  try {
    const response = await fetch('/api/auth/session', { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Authentication unavailable');
    const { googleEnabled } = await response.json();
    button.disabled = !googleEnabled;
    if (!googleEnabled && !message) status.textContent = messages.get('unavailable');
  } catch {
    if (!message) status.textContent = messages.get('unavailable');
  }
}

checkGoogleLogin();
