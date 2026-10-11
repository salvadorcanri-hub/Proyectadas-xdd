/** Shared request status. Never stores URLs, credentials or student data. */
export const SLOW_REQUEST_MS = 8000;
export const REQUEST_TIMEOUT_MS = 30000;
export const UPLOAD_TIMEOUT_MS = 60000;
export type ConnectionState = { pending: number; slow: number; stale: boolean; realtimeLost: boolean; lastUpdated: number | null };
let state: ConnectionState = { pending: 0, slow: 0, stale: false, realtimeLost: false, lastUpdated: null };
const listeners = new Set<() => void>();
export const connectionSnapshot = () => state;
export const subscribeConnection = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function update(patch: Partial<ConnectionState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
export function dataUpdated() { update({ stale: false, lastUpdated: Date.now() }); }
export function dataStale() { update({ stale: true }); }
export function realtimeStatus(connected: boolean) { update({ realtimeLost: !connected }); }
export function resetConnection() { update({ stale: false, realtimeLost: false, lastUpdated: null }); }

function requestKind(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://local');
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const read = ['GET', 'HEAD'].includes(method) || /\/rpc\/(edu_current_user|edu_state|edu_registration_available)$/.test(url.pathname)
    || /\/storage\/v1\/object\/sign\//.test(url.pathname) || /\/(token|login|dni-login)$/.test(url.pathname);
  return { write: !read, upload: method === 'POST' && /\/storage\/v1\/object\//.test(url.pathname) && !read };
}

/** No automatic retries: a timed-out write may already have reached the database. */
export async function monitoredFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sin conexión. No se envió esta solicitud. Recupera internet antes de intentarlo.');
  const { write, upload } = requestKind(input, init);
  const controller = new AbortController();
  const suppliedSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
  const signal = suppliedSignal ? AbortSignal.any([suppliedSignal, controller.signal]) : controller.signal;
  let slow = false, timedOut = false;
  update({ pending: state.pending + 1 });
  const slowTimer = setTimeout(() => { slow = true; update({ slow: state.slow + 1 }); }, SLOW_REQUEST_MS);
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error('timeout')); }, upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(input, { ...init, signal });
      // Include downloading the response body in the deadline, not only its headers.
      const body = await response.arrayBuffer();
      return new Response([101, 204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    })()]);
  } catch {
    if (write) dataStale();
    const cause = timedOut ? 'La solicitud tardó demasiado.' : 'Se interrumpió la conexión.';
    throw Object.assign(new Error(write
      ? `${cause} No pudimos confirmar si se guardó el cambio. Actualiza los datos antes de repetirlo.`
      : `${cause} No pudimos cargar la información. Puedes reintentar.`), { code: write ? 'UNCONFIRMED' : 'CONNECTION_FAILED' });
  } finally {
    clearTimeout(timeout!); clearTimeout(slowTimer);
    update({ pending: state.pending - 1, slow: state.slow - (slow ? 1 : 0) });
  }
}

export function connectionErrorMessage(error: { message?: string }): string | undefined {
  const message = error.message || '';
  for (const prefix of ['Sin conexión.', 'La solicitud tardó demasiado.', 'Se interrumpió la conexión.']) {
    const start = message.indexOf(prefix);
    if (start >= 0) return message.slice(start);
  }
}
