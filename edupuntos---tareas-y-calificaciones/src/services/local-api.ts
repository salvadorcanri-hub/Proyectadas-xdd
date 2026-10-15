import { selectedClassroom } from './classroom-selection';
import { monitoredFetch, dataUpdated, dataStale, realtimeStatus } from './connection';
import { AppState, GradeType, RewardsConfig, PhotoReading } from '../types';
import { validateRegistration, type StudentRegistration } from '../utils/registration';

export const API_BASE = `/api/${__APP_ROLE__}`;
export async function request(endpoint: string, options: RequestInit = {}, classroomId = selectedClassroom()) {
  const res = await monitoredFetch(API_BASE + endpoint, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-EduPuntos-Client': __APP_ROLE__, ...(classroomId ? { 'X-EduPuntos-Classroom': classroomId } : {}), ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !endpoint.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { status: res.status });
  }
  return data;
}

export async function fetchState(classroomId = selectedClassroom()): Promise<AppState> { const result = (await request('/state', {}, classroomId)).state; dataUpdated(); return result; }
export async function submitHomework(assignmentId: string, studentId: string, photoUrl: string, comment?: string, photoReading?: PhotoReading | null): Promise<AppState> {
  const classroomId = selectedClassroom();
  try { return (await request('/submissions', { method: 'POST', body: JSON.stringify({ assignmentId, studentId, photoUrl, comment, photoReading }) }, classroomId)).state; }
  catch (error) {
    if ((error as { code?: string }).code !== 'UNCONFIRMED') throw error;
    try {
      const saved = await fetchState(classroomId);
      const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(photoUrl);
      if (match) {
        const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
        const expectedPath = `${API_BASE}/files/${hash}.${match[1]}`;
        if (saved.submissions.some(s => s.assignmentId === assignmentId && s.studentId === studentId && s.photoUrl === expectedPath && s.comment === (comment || '').trim()
          && (s.photoReading?.status ?? null) === (photoReading?.status ?? null) && (s.photoReading?.grade ?? null) === (photoReading?.grade ?? null) && (s.photoReading?.confidence ?? null) === (photoReading?.confidence ?? null))) return saved;
      }
    } catch { /* No automatic write retry after an ambiguous response. */ }
    dataStale();
    throw new Error('No pudimos confirmar el envío. Puede haberse guardado. Actualiza los datos y revisa tu entrega antes de volver a enviarla.');
  }
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
  const classroomId = selectedClassroom();
  const events = new EventSource(API_BASE + '/events' + (classroomId ? `?classroom=${encodeURIComponent(classroomId)}` : ''));
  let stopped = false;
  let refreshing = false;
  const refresh = async () => {
    if (stopped || refreshing) return;
    refreshing = true;
    try { const state = await fetchState(classroomId); if (!stopped) onUpdate(state); }
    catch { if (!stopped) dataStale(); }
    finally { refreshing = false; }
  };
  events.onopen = () => { if (!stopped) realtimeStatus(true); };
  events.onmessage = event => {
    if (stopped) return;
    try { const payload = JSON.parse(event.data); if (payload.state) { dataUpdated(); onUpdate(payload.state); } }
    catch { dataStale(); }
  };
  events.onerror = () => { if (!stopped) { realtimeStatus(false); void refresh(); } };
  const retry = () => { void refresh(); };
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') retry(); }, 60000);
  window.addEventListener('online', retry); window.addEventListener('edupuntos-refresh', retry);
  return () => { stopped = true; events.close(); clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('edupuntos-refresh', retry); };
}

export async function currentUser() { return (await request('/auth/me')).user; }
export async function login(username: string, password: string) { return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); }
export async function register(input: StudentRegistration): Promise<{ confirmationRequired: boolean }> { return request('/auth/register', { method: 'POST', body: JSON.stringify(validateRegistration(input)) }); }
export async function logout() { await request('/auth/logout', { method: 'POST', body: '{}' }); }
export async function downloadExcel() { window.location.href = `${API_BASE}/excel-export?classroom=${encodeURIComponent(selectedClassroom() || '')}`; }
