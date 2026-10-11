import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import { ocrAssets } from './scripts/ocr-assets.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({ mode }) => {
  if (mode !== 'teacher' && mode !== 'student') throw new Error('Usa npm run dev:teacher o npm run dev:student.');
  return {
    root: path.join(root, 'apps', mode),
    publicDir: path.join(root, 'public'),
    base: (process.env.HOSTED_WEB === '1' || process.env.EDUPUNTOS_BACKEND === 'supabase') ? (mode === 'teacher' ? '/docentes/' : '/alumnos/') : '/',
    plugins: [react(), tailwindcss(), ...(mode === 'student' ? [ocrAssets()] : [])],
    define: { __APP_ROLE__: JSON.stringify(mode), __BACKEND__: JSON.stringify(process.env.EDUPUNTOS_BACKEND === 'supabase' ? 'supabase' : 'local') },
    envDir: root,
    cacheDir: path.join(root, 'node_modules', '.vite', mode),
    optimizeDeps: { include: mode === 'student' ? ['tesseract.js'] : [] },
    resolve: { alias: { '#backend': path.join(root, 'src/services', process.env.EDUPUNTOS_BACKEND === 'supabase' ? 'supabase-api.ts' : 'local-api.ts') } },
    build: { outDir: path.join(root, 'dist', ...(process.env.EDUPUNTOS_BACKEND === 'supabase' ? ['netlify'] : process.env.HOSTED_WEB === '1' ? ['hosted'] : []), mode), emptyOutDir: true },
    server: {
      host: '127.0.0.1', port: Number(mode === 'teacher' ? process.env.TEACHER_PORT || 3001 : process.env.STUDENT_PORT || 3002), strictPort: true,
      fs: { allow: [root], deny: ['**/.git/**', '**/data/**', '**/*.sqlite*', '**/.env*', '**/*.{crt,pem}'] },
      proxy: { '/api': { target: process.env.API_TARGET || 'http://127.0.0.1:3000' } },
    },
  };
});
