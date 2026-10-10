import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { validateSupabaseConfig } from './supabase-config.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = { ...loadEnv('production', root, 'VITE_'), ...process.env };
validateSupabaseConfig(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY);
const output = path.join(root, 'dist', 'netlify');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const [role, route] of [['teacher', 'docentes'], ['student', 'alumnos']]) {
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', role], {
    cwd: root, stdio: 'inherit', env: { ...config, EDUPUNTOS_BACKEND: 'supabase' },
  });
  if (result.status !== 0) { process.exitCode = result.status || 1; process.exit(); }
  renameSync(path.join(output, role), path.join(output, route));
}
writeFileSync(path.join(output, 'index.html'), `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EduPuntos</title>
<style>body{font-family:system-ui;margin:0;background:#f1f5f9;color:#0f172a;min-height:100vh;display:grid;place-items:center}main{max-width:600px;padding:32px}h1{font-size:40px}p{line-height:1.6;color:#475569}nav{display:grid;gap:16px;margin-top:32px}a{padding:24px;background:white;border:1px solid #cbd5e1;border-radius:16px;color:#4338ca;text-decoration:none;font-size:20px;font-weight:600}a:focus,a:hover{outline:2px solid #4338ca}small{display:block;font-size:14px;font-weight:400;color:#475569;margin-top:8px}</style></head>
<body><main><h1>EduPuntos</h1><p>Elige tu aplicación e inicia sesión con tu cuenta.</p><nav aria-label="Aplicaciones"><a href="/docentes/">Profesores<small>Tareas, calificaciones y registro de Excel</small></a><a href="/alumnos/">Alumnos<small>Entregas, notas y progreso escolar</small></a></nav></main></body></html>`);
writeFileSync(path.join(output, '404.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><title>Página no encontrada</title><h1>Página no encontrada</h1><a href="/">Volver a EduPuntos</a></html>');
