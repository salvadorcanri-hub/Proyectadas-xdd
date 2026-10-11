import { landingPage } from '../scripts/landing-page.mjs';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Store } from './store';
import { authenticate, createSession, sessionUser, tokenHash, SESSION_MS } from './auth';
import { exportWorkbook, importRows, workbookRows } from './excel';
import { storePhoto, removeUnusedPhotos } from './photos';
import { securityHeaders } from './security';
import { calculateStudentScores } from '../src/utils/scoreCalculator';
import type { AppState, User } from '../src/types';
import { validatePhotoReading } from '../src/utils/photoVerification';

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const text = (value: unknown, name: string, max: number, optional = false) => {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) throw new HttpError(400, `${name}: valor inválido (máximo ${max} caracteres).`);
  return value.trim();
};

export function createApp(store: Store, options: { secureCookies?: boolean; webRoot?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  const clients = new Set<{ res: Response; user: User; token: string }>();
  const attempts = new Map<string, { count: number; until: number }>();
  const cookieName = (role: string) => `edupuntos_${role}`;
  const cookieOptions = (role: string) => ({ httpOnly: true, sameSite: 'strict' as const, secure: options.secureCookies ?? process.env.NODE_ENV === 'production', path: `/api/${role}`, maxAge: SESSION_MS });
  const cookieToken = (req: Request, role: string) => (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName(role)}=`))?.split('=')[1] || '';
  const project = (user: User): AppState => {
    const state = store.load();
    const role = user.role;
    const personal = role === 'teacher' ? state : {
      ...state,
      students: state.students.filter(s => s.id === user.studentId),
      submissions: state.submissions.filter(s => s.studentId === user.studentId),
      grades: state.grades.filter(g => g.studentId === user.studentId),
      // Only the shared ranking is public within the classroom; submissions and feedback are private.
      ranking: calculateStudentScores(state).map(score => ({ ...score, student: { ...score.student, code: '' } })),
    };
    return { ...personal, submissions: personal.submissions.map(s => ({ ...s, photoUrl: s.photoUrl.startsWith('/files/') ? `/api/${role}${s.photoUrl}` : s.photoUrl })) };
  };
  const notify = () => {
    for (const client of clients) {
      const current = sessionUser(store, client.token, client.user.role);
      if (!current || current.studentId !== client.user.studentId) { client.res.end(); clients.delete(client); continue; }
      if (!client.res.write(`data: ${JSON.stringify({ type: 'SYNC', state: project(current) })}\n\n`)) { client.res.end(); clients.delete(client); }
    }
  };
  const commit = (state: AppState) => { store.save(state); notify(); };

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/api/health', (_req, res) => res.json({ success: true }));
  app.use('/api/:portal', (req, res, next) => {
    if (!['teacher','student'].includes(req.params.portal)) return res.status(404).json({ error: 'Aplicación desconocida.' });
    res.locals.role = req.params.portal;
    if (!['GET','HEAD'].includes(req.method) && (req.get('X-EduPuntos-Client') !== req.params.portal || !req.is('application/json'))) {
      return res.status(403).json({ error: 'Solicitud no permitida.' });
    }
    next();
  });
  app.post('/api/:portal/auth/login', express.json({ limit: '4kb' }), async (req, res, next) => {
    try {
      const username = text(req.body?.username, 'Usuario', 80);
      text(req.body?.password, 'Contraseña', 128);
      const password = req.body.password as string;
      const role = res.locals.role as User['role'];
      const now = Date.now();
      for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
      // Limit globally per account as well as per source; proxy headers are deliberately not trusted.
      const keys = [`user:${role}:${username.toLowerCase()}`, `ip:${req.ip}`];
      if (keys.some(key => (attempts.get(key)?.count || 0) >= (key.startsWith('ip:') ? 50 : 10))) {
        res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
      }
      for (const key of keys) { const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }; attempt.count++; attempts.set(key, attempt); }
      const user = await authenticate(store, username, password, role);
      if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos para esta aplicación.' });
      attempts.delete(keys[0]);
      const previous = cookieToken(req, role);
      if (previous) store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(previous));
      const token = createSession(store, user);
      res.cookie(cookieName(role), token, cookieOptions(role));
      res.json({ user });
    } catch (error) { next(error); }
  });
  app.use('/api/:portal', (req, res, next) => {
    const user = sessionUser(store, cookieToken(req, res.locals.role), res.locals.role);
    if (!user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    res.locals.user = user;
    next();
  });
  // Authenticate before accepting large photo/workbook bodies.
  app.use('/api', express.json({ limit: '8mb' }));
  app.get('/api/:portal/auth/me', (_req, res) => res.json({ user: res.locals.user }));
  app.post('/api/:portal/auth/logout', (req, res) => {
    const token = cookieToken(req, res.locals.role);
    store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
    for (const client of clients) if (client.token === token) { client.res.end(); clients.delete(client); }
    res.clearCookie(cookieName(res.locals.role), { ...cookieOptions(res.locals.role), maxAge: undefined });
    res.json({ success: true });
  });
  app.get('/api/:portal/state', (_req, res) => res.json({ success: true, state: project(res.locals.user) }));
  app.get('/api/:portal/events', (req, res) => {
    if (clients.size >= 256 || [...clients].filter(c => c.user.id === res.locals.user.id).length >= 5) return res.status(429).json({ error: 'Demasiadas conexiones abiertas. Cierra otras pestañas.' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const client = { res, user: res.locals.user as User, token: cookieToken(req, res.locals.role) };
    clients.add(client);
    res.write(`data: ${JSON.stringify({ type: 'INIT', state: project(client.user) })}\n\n`);
    const heartbeat = setInterval(() => {
      const current = sessionUser(store, client.token, client.user.role);
      if (!current || current.studentId !== client.user.studentId) res.end();
      else res.write(': heartbeat\n\n');
    }, 15000);
    res.on('close', () => { clearInterval(heartbeat); clients.delete(client); });
  });
  app.get('/api/:portal/files/:name', (req, res) => {
    const name = req.params.name;
    const user = res.locals.user as User;
    const allowed = store.load().submissions.some(s => s.photoUrl === `/files/${name}` && (user.role === 'teacher' || s.studentId === user.studentId));
    if (!/^[a-f0-9]{64}\.(png|jpeg|webp)$/.test(name) || !allowed) return res.status(404).json({ error: 'Imagen no disponible.' });
    res.sendFile(path.resolve(store.dataDir, 'uploads', name));
  });
  const teacher = (_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.user.role !== 'teacher') return res.status(403).json({ error: 'Solo el docente puede realizar esta acción.' });
    next();
  };
  app.post('/api/:portal/submissions', (req, res) => {
    const user = res.locals.user as User;
    if (user.role !== 'student') throw new HttpError(403, 'Solo el estudiante puede entregar su tarea.');
    if (req.body.studentId !== undefined && req.body.studentId !== user.studentId) throw new HttpError(403, 'No puedes entregar tareas de otro estudiante.');
    const state = store.load();
    const assignmentId = text(req.body.assignmentId, 'Tarea', 100);
    if (!state.assignments.some(a => a.id === assignmentId)) throw new HttpError(404, 'La tarea no existe.');
    const comment = text(req.body.comment, 'Comentario', 2000, true);
    let photoReading;
    try { photoReading = validatePhotoReading(req.body.photoReading); }
    catch { throw new HttpError(400, 'Lectura de foto inválida.'); }
    let photoUrl: string;
    try { photoUrl = storePhoto(store.dataDir, req.body.photoUrl); } catch (e) { throw new HttpError(400, (e as Error).message); }
    const existing = state.submissions.find(s => s.assignmentId === assignmentId && s.studentId === user.studentId);
    const submission = { id: existing?.id || randomUUID(), assignmentId, studentId: user.studentId!, photoUrl, submittedAt: new Date().toISOString(), comment, photoReading };
    const previousPhoto = existing?.photoUrl;
    if (existing) Object.assign(existing, submission); else state.submissions.push(submission);
    // The teacher already graded this work at school. A photo never changes the official record.
    commit(state);
    removeUnusedPhotos(store.dataDir, previousPhoto ? [previousPhoto] : [], state.submissions);
    res.json({ success: true, state: project(user) });
  });
  app.post('/api/:portal/grades', teacher, (req, res) => {
    const state = store.load();
    const { assignmentId, studentId, grade } = req.body;
    if (!state.assignments.some(a => a.id === assignmentId) || !state.students.some(s => s.id === studentId)) throw new HttpError(404, 'Tarea o estudiante inexistente.');
    if (!['AD','A','B','C',null].includes(grade)) throw new HttpError(400, 'Nota inválida.');
    const existing = state.grades.find(g => g.studentId === studentId && g.assignmentId === assignmentId);
    const feedback = req.body.feedback === undefined ? existing?.feedback || '' : text(req.body.feedback, 'Comentario', 2000, true);
    const record = { assignmentId, studentId, grade, feedback, updatedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, record); else state.grades.push(record);
    commit(state); res.json({ success: true, state: project(res.locals.user) });
  });
  app.post('/api/:portal/assignments', teacher, (req, res) => {
    const state = store.load();
    const title = text(req.body.title, 'Título', 200);
    const subject = text(req.body.subject, 'Materia', 100);
    const description = text(req.body.description, 'Descripción', 5000, true);
    const dueDate = text(req.body.dueDate, 'Fecha de entrega', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0,10) !== dueDate) throw new HttpError(400, 'Fecha de entrega inválida.');
    state.assignments.push({ id: `asg-${randomUUID()}`, title, subject, dueDate, description, createdAt: new Date().toISOString().slice(0,10) });
    commit(state); res.json({ success: true, state: project(res.locals.user) });
  });
  app.delete('/api/:portal/assignments/:id', teacher, (req, res) => {
    const state = store.load(); const id = req.params.id;
    if (!state.assignments.some(a => a.id === id)) throw new HttpError(404, 'La tarea no existe.');
    const removedPhotos = state.submissions.filter(s => s.assignmentId === id).map(s => s.photoUrl);
    state.assignments = state.assignments.filter(a => a.id !== id);
    state.submissions = state.submissions.filter(s => s.assignmentId !== id);
    state.grades = state.grades.filter(g => g.assignmentId !== id);
    commit(state);
    removeUnusedPhotos(store.dataDir, removedPhotos, state.submissions);
    res.json({ success: true, state: project(res.locals.user) });
  });
  app.post('/api/:portal/rewards', teacher, (req, res) => {
    const state = store.load();
    state.rewards = { firstPlace: text(req.body.firstPlace, 'Primer premio', 500), secondPlace: text(req.body.secondPlace, 'Segundo premio', 500), thirdPlace: text(req.body.thirdPlace, 'Tercer premio', 500) };
    commit(state); res.json({ success: true, state: project(res.locals.user) });
  });
  app.get('/api/:portal/excel-export', teacher, async (req, res, next) => {
    try {
      const file = await exportWorkbook(store.load());
      if (!sessionUser(store, cookieToken(req, 'teacher'), 'teacher')) return res.status(401).json({ error: 'Inicia sesión de nuevo.' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="EduPuntos_Registro_Notas.xlsx"');
      res.send(file);
    } catch (error) { next(error); }
  });
  app.post('/api/:portal/excel-import', teacher, async (req, res, next) => {
    try {
      let rows: unknown[][];
      try { rows = await workbookRows(req.body.fileBase64); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      if (!sessionUser(store, cookieToken(req, 'teacher'), 'teacher')) return res.status(401).json({ error: 'Inicia sesión de nuevo.' });
      const state = store.load();
      let result: ReturnType<typeof importRows>;
      try { result = importRows(state, rows); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      state.grades = result.grades; commit(state);
      res.json({ success: true, updatedGradesCount: result.count, state: project(res.locals.user), message: `Se actualizaron ${result.count} calificaciones.` });
    } catch (error) { next(error); }
  });
  if (options.webRoot) {
    for (const [route, role] of [['docentes', 'teacher'], ['alumnos', 'student']]) {
      const directory = path.resolve(options.webRoot, role);
      if (!existsSync(path.join(directory, 'index.html'))) throw new Error('Falta la compilación web. Ejecuta npm run build:hosted.');
      app.get(new RegExp(`^/${route}$`), (_req, res) => res.redirect(302, `/${route}/`));
      app.use(`/${route}`, express.static(directory));
      // Asset failures remain 404; do not return HTML in place of missing JavaScript.
      app.get(`/${route}/*`, (req, res, next) => {
        if (path.extname(req.path)) return next();
        res.sendFile(path.join(directory, 'index.html'));
      });
    }
    for (const file of ['appearance.js', 'appearance.css', 'landing.css']) {
      app.get(`/${file}`, (_req, res) => res.sendFile(path.resolve(options.webRoot!, 'teacher', file)));
    }
    app.get('/', (_req, res) => res.type('html').send(landingPage));
  }
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = error.status || 500;
    if (status >= 500) console.error('Error del servidor:', error);
    res.status(status).json({ error: status >= 500 ? 'No se pudo guardar o procesar la operación. Intenta de nuevo.' : error.type === 'entity.too.large' ? 'El archivo supera el tamaño permitido.' : error.message });
  });
  return { app, close: () => { for (const client of clients) client.res.end(); clients.clear(); } };
}
