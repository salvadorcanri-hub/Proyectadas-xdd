import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { landingPage } from './landing-page.mjs';
import { contentSecurityPolicy } from './security-policy.mjs';
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
writeFileSync(path.join(output, 'index.html'), landingPage);
for (const file of ['appearance.js', 'appearance.css', 'landing.css']) copyFileSync(path.join(root, 'public', file), path.join(output, file));
writeFileSync(path.join(output, '404.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><title>Página no encontrada</title><h1>Página no encontrada</h1><a href="/">Volver a EduPuntos</a></html>');

writeFileSync(path.join(output, '_headers'), `/*
  Content-Security-Policy: ${contentSecurityPolicy(config.VITE_SUPABASE_URL)}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);
