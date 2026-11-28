import sun from 'lucide-static/icons/sun.svg?raw';
import moon from 'lucide-static/icons/moon.svg?raw';
import './theme.css';

const key = 'automotion:theme';
const system = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;
const themeColor = document.querySelector('meta[name=theme-color]');
const lightColor = themeColor?.content;
const toggle = document.querySelector('[data-theme-toggle]');
let preference;

function readPreference() {
  try {
    const value = localStorage.getItem(key);
    preference = value === 'dark' || value === 'light' ? value : undefined;
  } catch {
    // Theme changes still work in this document if browser storage is blocked.
  }
}

function applyTheme() {
  const theme = preference ?? (system.matches ? 'dark' : 'light');
  const dark = theme === 'dark';
  root.dataset.theme = theme;
  if (themeColor) themeColor.content = dark ? '#101813' : lightColor;
  toggle.setAttribute('aria-checked', String(dark));
  toggle.title = dark ? 'Pakai mode terang' : 'Pakai mode gelap';
  toggle.querySelector('span').innerHTML = dark ? sun : moon;
}

readPreference();
applyTheme();
toggle.hidden = false;

toggle.addEventListener('click', () => {
  preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(key, preference); } catch { /* Display the selected theme in memory. */ }
  applyTheme();
});

system.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  readPreference();
  applyTheme();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  readPreference();
  applyTheme();
});
