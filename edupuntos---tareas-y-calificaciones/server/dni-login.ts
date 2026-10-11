import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';

export function createDniLoginHandler(config: { url?: string; publicKey?: string; serverKey?: string; fetch?: typeof fetch }) {
  const reply = (status: number, body: object) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '900' } : {}) } });
  return async (request: Request, ip: string): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
    if (!request.headers.get('content-type')?.startsWith('application/json') || (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)) return reply(403, { error: 'Solicitud no permitida.' });
    if (!config.url || !config.publicKey || !config.serverKey) return reply(503, { error: 'El acceso con DNI todavía no está configurado. Puedes ingresar con tu correo.' });
    let data: { dni?: unknown; password?: unknown };
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: 'Completa DNI y contraseña.' });
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 4096) { await reader.cancel(); return reply(413, { error: 'Solicitud demasiado grande.' }); }
        chunks.push(value);
      }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return reply(400, { error: 'Solicitud inválida.' }); }
    if (!data || typeof data.dni !== 'string' || !/^\d{8}$/.test(data.dni) || typeof data.password !== 'string' || !data.password || data.password.length > 128) return reply(400, { error: 'Completa un DNI de 8 dígitos y tu contraseña.' });
    try {
      // Clients are isolated per request; a user's session never replaces server credentials.
      const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: config.fetch || fetch } };
      const admin = createClient(config.url, config.serverKey, options);
      const source = createHash('sha256').update(ip || 'unknown').digest('hex');
      const lookup = await admin.rpc('edu_login_email', { p_dni: data.dni, p_source_hash: source });
      if (lookup.error) return reply(503, { error: 'No se pudo completar el acceso con DNI. Intenta con tu correo.' });
      if (!lookup.data?.allowed) return reply(429, { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
      const email = lookup.data.email;
      const auth = createClient(config.url, config.publicKey, options);
      const { data: session, error } = await auth.auth.signInWithPassword({ email: email || `${randomUUID()}@unknown.invalid`, password: data.password });
      if (!email || error || !session.session) return reply(401, { error: 'No se pudo iniciar sesión. Revisa tus datos y confirma tu correo si acabas de registrarte.' });
      return reply(200, { access_token: session.session.access_token, refresh_token: session.session.refresh_token });
    } catch { return reply(503, { error: 'No se pudo conectar. Inténtalo de nuevo.' }); }
  };
}
