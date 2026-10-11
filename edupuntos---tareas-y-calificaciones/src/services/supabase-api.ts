import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppState, GradeType, RewardsConfig, User, PhotoReading } from '../types';

let instance: SupabaseClient | undefined;
const bucket = 'edupuntos-homework';
function client() {
  if (!instance) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('La aplicación todavía no está conectada. Contacta al administrador.');
    instance = createClient(url, key, { auth: { storageKey: `edupuntos-${__APP_ROLE__}-auth`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }
  return instance;
}
function failure(error: { message: string; code?: string; status?: number }) {
  const messages: Record<string, string> = {
    '23503': 'La tarea o el estudiante ya no existe. Actualiza la página.',
    '23514': 'Revisa los datos: alguna nota, fecha o texto no es válido.',
    '23502': 'Faltan datos obligatorios.',
    '23505': 'Ya existe un registro con esos datos.',
    'PGRST202': 'La base de datos todavía no está configurada. Contacta al administrador.',
  };
  return Object.assign(new Error(messages[error.code || ''] || error.message), { status: error.status, code: error.code });
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error, status } = await client().rpc(name, args);
  if (error) throw failure({ ...error, status });
  return data as T;
}
export async function currentUser(): Promise<User> {
  const { data: { session }, error } = await client().auth.getSession();
  if (error) throw failure(error);
  if (!session) throw Object.assign(new Error('Inicia sesión para continuar.'), { status: 401 });
  const user = await rpc<User>('edu_current_user');
  if (user.role !== __APP_ROLE__) throw Object.assign(new Error(`Esta cuenta no tiene acceso a la aplicación de ${__APP_ROLE__ === 'teacher' ? 'profesores' : 'alumnos'}.`), { code: '42501' });
  return user;
}
export async function login(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('No se pudo iniciar sesión. Revisa tu correo y contraseña.');
  try { return await currentUser(); }
  catch (error) { await client().auth.signOut({ scope: 'local' }); throw error; }
}
export async function logout() {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw failure(error);
}
const signed = new Map<string, { url: string; until: number }>();
export async function fetchState(): Promise<AppState> {
  await currentUser();
  const state = await rpc<AppState>('edu_state');
  const paths = [...new Set(state.submissions.map(s => s.photoUrl))];
  const needed = paths.filter(p => !signed.has(p) || signed.get(p)!.until < Date.now());
  if (needed.length) {
    const { data, error } = await client().storage.from(bucket).createSignedUrls(needed, 300);
    if (error) throw failure(error);
    for (const photo of data || []) {
      if (photo.error || !photo.signedUrl || !photo.path) throw new Error('No se pudo acceder a una fotografía. Contacta al administrador.');
      signed.set(photo.path, { url: photo.signedUrl, until: Date.now() + 4 * 60 * 1000 });
    }
  }
  for (const path of signed.keys()) if (!paths.includes(path)) signed.delete(path);
  return { ...state, submissions: state.submissions.map(s => ({ ...s, photoUrl: signed.get(s.photoUrl)!.url })) };
}
export async function submitHomework(assignmentId: string, studentId: string, photoUrl: string, comment?: string, photoReading?: PhotoReading | null): Promise<AppState> {
  const user = await currentUser();
  if (user.role !== 'student' || user.studentId !== studentId) throw new Error('No puedes entregar la tarea de otro estudiante.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoUrl);
  if (!match || match[2].length > 6990508) throw new Error('Selecciona una imagen PNG, JPEG o WebP de hasta 5 MB.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.length > 5 * 1024 * 1024) throw new Error('La foto supera 5 MB.');
  const path = `${user.id}/${crypto.randomUUID()}.${match[1]}`;
  const { error } = await client().storage.from(bucket).upload(path, bytes, { contentType: `image/${match[1]}`, upsert: false });
  if (error) throw failure(error);
  try { await rpc('edu_submit', { p_assignment_id: assignmentId, p_photo_path: path, p_comment: comment || '', p_photo_reading: photoReading || null }); }
  catch (error) {
    // Storage RLS prevents deleting a file if an ambiguous network response actually committed it.
    await client().storage.from(bucket).remove([path]);
    throw error;
  }
  return fetchState();
}
export async function updateGrade(assignmentId: string, studentId: string, grade: GradeType, feedback?: string): Promise<AppState> {
  await rpc('edu_set_grade', { p_assignment_id: assignmentId, p_student_id: studentId, p_grade: grade, p_feedback: feedback ?? null });
  return fetchState();
}
export async function createAssignment(title: string, subject: string, dueDate: string, description: string): Promise<AppState> {
  await rpc('edu_create_assignment', { p_title: title, p_subject: subject, p_due_date: dueDate, p_description: description });
  return fetchState();
}
export async function deleteAssignment(id: string): Promise<AppState> {
  await rpc('edu_delete_assignment', { p_id: id }); return fetchState();
}
export async function updateRewardsConfig(rewards: RewardsConfig): Promise<AppState> {
  await rpc('edu_set_rewards', { p_first: rewards.firstPlace, p_second: rewards.secondPlace, p_third: rewards.thirdPlace });
  return fetchState();
}
export async function importExcelBase64(fileBase64: string) {
  const { importRows, workbookRows } = await import('./excel');
  const { changes } = importRows(await fetchState(), await workbookRows(fileBase64));
  const count = await rpc<number>('edu_import_grades', { p_changes: changes });
  return { state: await fetchState(), message: `Se actualizaron ${count} calificaciones.`, updatedCount: count };
}
export async function downloadExcel() {
  const [{ createWorkbook }, state] = await Promise.all([import('./excel'), fetchState()]);
  const url = URL.createObjectURL(await createWorkbook(state));
  const link = document.createElement('a'); link.href = url; link.download = 'EduPuntos_Registro_Notas.xlsx'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function subscribeToRealtimeUpdates(onUpdate: (state: AppState) => void): () => void {
  const supabase = client();
  let stopped = false; let busy = false; let pending = false;
  async function refresh() {
    if (stopped) return;
    if (busy) { pending = true; return; }
    busy = true;
    try { const state = await fetchState(); if (!stopped) onUpdate(state); }
    catch (error) {
      const e = error as Error & { status?: number; code?: string };
      if (!stopped && (e.status === 401 || e.code === '42501')) window.dispatchEvent(new Event('session-expired'));
    } finally { busy = false; if (pending && !stopped) { pending = false; void refresh(); } }
  }
  const channel = supabase.channel(`edupuntos-${__APP_ROLE__}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'edu_changes' }, () => void refresh())
    .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
  // Realtime is immediate when connected; polling also refreshes signed photo URLs and recovers missed events.
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
  const focus = () => void refresh();
  window.addEventListener('focus', focus);
  const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { signed.clear(); window.dispatchEvent(new Event('session-expired')); }
  });
  return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', focus); subscription.unsubscribe(); void supabase.removeChannel(channel); };
}
