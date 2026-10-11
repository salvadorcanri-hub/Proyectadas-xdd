/** Restrict executable content and connections to the actual project. */
export function contentSecurityPolicy(supabaseUrl) {
  const origin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const socket = origin ? origin.replace(/^https:/, 'wss:') : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://images.unsplash.com ${origin}`.trim(),
    `connect-src 'self' ${origin} ${socket}`.trim(),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
