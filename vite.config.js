import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const pages = {
  main: 'index.html',
  dashboard: 'dashboard.html',
  scan: 'scan.html',
  climate: 'climate.html',
  recommendation: 'recommendation.html',
  farm: 'farm.html',
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_FIREBASE_');
  const variables = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    appId: 'VITE_FIREBASE_APP_ID',
  };
  const config = Object.fromEntries(
    Object.entries(variables).map(([key, name]) => [key, env[name]?.trim() ?? '']),
  );
  const missing = Object.keys(config).filter(key => !config[key]).map(key => variables[key]);
  const invalidDomain = config.authDomain && !/^[a-z0-9.-]+$/i.test(config.authDomain);
  const configIssue = invalidDomain ? 'auth/invalid-auth-domain' : '';

  if (command === 'build') {
    if (missing.length) {
      console.warn(`[Firebase Auth] Belum aktif di build ini. Cek .env.local di folder repo. Kosong: ${missing.join(', ')}`);
    } else if (configIssue) {
      console.warn('[Firebase Auth] VITE_FIREBASE_AUTH_DOMAIN harus berupa hostname dari firebaseConfig, tanpa https:// atau path.');
    } else {
      console.log('[Firebase Auth] Konfigurasi Web App terbaca dan disertakan di build.');
    }
  }

  return {
    base: './',
    define: {
      __AUTOMOTION_FIREBASE_CONFIG__: JSON.stringify(missing.length || configIssue ? null : config),
      __AUTOMOTION_FIREBASE_CONFIG_ISSUE__: JSON.stringify(configIssue),
    },
    server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
    build: {
      rollupOptions: {
        input: Object.fromEntries(
          Object.entries(pages).map(([name, page]) => [name, fileURLToPath(new URL(page, import.meta.url))]),
        ),
      },
    },
  };
});
