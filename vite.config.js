import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ base: './', build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), scan: fileURLToPath(new URL('./scan.html', import.meta.url)) } } } });
