export function validateSupabaseConfig(url, key) {
  if (!url || !key) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Netlify antes de compilar. Consulta SUPABASE_NETLIFY.md.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('VITE_SUPABASE_URL debe ser la URL de tu proyecto Supabase.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Usa una URL HTTPS de Supabase, sin rutas, contraseñas ni parámetros.');
  if (key.startsWith('sb_publishable_') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (key.split('.').length === 3 && payload.role === 'anon') return;
  } catch { /* Not an anon JWT. */ }
  throw new Error('Usa solo una clave publishable o anon. Nunca uses service_role, sb_secret ni una contraseña en VITE_*.');
}
