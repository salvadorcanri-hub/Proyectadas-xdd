import { AppState, GradeType, RewardsConfig } from '../types';

export const API_BASE = `/api/${__APP_ROLE__}`;
export async function request(endpoint: string, options: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(API_BASE + endpoint, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-EduPuntos-Client': __APP_ROLE__, ...options.headers } });
  } catch {
    throw new Error('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !endpoint.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { status: res.status });
  }
  return data;
}

export async function fetchState(): Promise<AppState> { return (await request('/state')).state; }
export async function submitHomework(assignmentId: string, studentId: string, photoUrl: string, comment?: string): Promise<AppState> {
  return (await request('/submissions', { method: 'POST', body: JSON.stringify({ assignmentId, studentId, photoUrl, comment }) })).state;
}
export async function updateGrade(assignmentId: string, studentId: string, grade: GradeType, feedback?: string): Promise<AppState> {
  return (await request('/grades', { method: 'POST', body: JSON.stringify({ assignmentId, studentId, grade, feedback }) })).state;
}
export async function createAssignment(title: string, subject: string, dueDate: string, description: string): Promise<AppState> {
  return (await request('/assignments', { method: 'POST', body: JSON.stringify({ title, subject, dueDate, description }) })).state;
}
export async function deleteAssignment(id: string): Promise<AppState> {
  return (await request(`/assignments/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' })).state;
}
export async function importExcelBase64(fileBase64: string): Promise<{ state: AppState; message: string; updatedCount: number }> {
  const data = await request('/excel-import', { method: 'POST', body: JSON.stringify({ fileBase64 }) });
  return { state: data.state, message: data.message, updatedCount: data.updatedGradesCount };
}
export async function updateRewardsConfig(rewards: RewardsConfig): Promise<AppState> {
  return (await request('/rewards', { method: 'POST', body: JSON.stringify(rewards) })).state;
}
export function subscribeToRealtimeUpdates(onUpdate: (state: AppState) => void): () => void {
  const events = new EventSource(API_BASE + '/events');
  let stopped = false;
  events.onmessage = event => { const payload = JSON.parse(event.data); if (payload.state) onUpdate(payload.state); };
  events.onerror = () => {
    // EventSource reconnects itself; check whether authentication has expired.
    void request('/state').then(data => { if (!stopped) onUpdate(data.state); }).catch(() => {});
  };
  return () => { stopped = true; events.close(); };
}

export async function currentUser() { return (await request('/auth/me')).user; }
export async function login(username: string, password: string) { return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); }
export async function logout() { await request('/auth/logout', { method: 'POST', body: '{}' }); }
export async function downloadExcel() { window.location.href = `${API_BASE}/excel-export`; }
