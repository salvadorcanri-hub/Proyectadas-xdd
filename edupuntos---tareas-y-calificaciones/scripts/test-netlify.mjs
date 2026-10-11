import { spawnSync } from 'node:child_process';
// Deliberately fake public config. Browser tests intercept every Supabase request.
const env = { ...process.env, VITE_SUPABASE_URL: 'https://test-project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST_ONLY', SUPABASE_SECRET_KEY: 'sb_secret_SERVER_ONLY_BUNDLE_TEST' };
for (const args of [['scripts/build-netlify.mjs'], ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.netlify.config.ts']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.status !== 0) { process.exitCode = result.status || 1; break; }
}
