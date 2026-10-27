import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  // `npm run dev` hot-reloads the UI; run `npm run server` alongside it for the API.
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
