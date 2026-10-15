import { BookOpen, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { AppState, User } from './types';
import { ClassroomContext } from './components/ClassroomContext';
import { ConnectionNotice } from './components/ConnectionNotice';
import { resetConnection } from './services/connection';
import { RegistrationForm } from './components/RegistrationForm';
import { selectClassroom, selectedClassroom, currentUser, login, logout as signOut, fetchState, subscribeToRealtimeUpdates } from './services/api';

type ViewProps = { state: AppState; user: User; onStateUpdate: (state: AppState) => void; onLogout: () => void };
export function SessionApp({ children }: { children: (props: ViewProps) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'dni'>('email');
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    setLoading(true); setError(''); setLoadFailed(false);
    try {
      const user = await currentUser();
      const chosen = user.classrooms?.find(c => c.id === selectedClassroom()) || user.classrooms?.[0];
      selectClassroom(chosen?.id || null); setClassroomId(chosen?.id || null);
      setState(chosen ? await fetchState(chosen.id) : null); setUser(user);
    } catch (e) { if ((e as Error & { status?: number }).status !== 401) { setError((e as Error).message); setLoadFailed(true); } }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const expire = () => { resetConnection(); selectClassroom(null); setClassroomId(null); setUser(null); setState(null); setError('Tu sesión ha terminado. Inicia sesión de nuevo.'); };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  const applyState = (next: AppState) => { if (next.classroom?.id === selectedClassroom()) setState(next); };
  useEffect(() => user && classroomId ? subscribeToRealtimeUpdates(applyState) : undefined, [user, classroomId]);
  async function changeClassroom(id: string) {
    if (id === classroomId || !user?.classrooms?.some(c => c.id === id)) return;
    if (!window.confirm('Al cambiar de aula se cerrarán los formularios abiertos y se descartarán los cambios sin guardar. ¿Continuar?')) return;
    const previous = classroomId; setLoading(true); setError(''); selectClassroom(id);
    try { const next = await fetchState(id); setState(next); setClassroomId(id); }
    catch (e) { selectClassroom(previous); setError((e as Error).message); }
    finally { setLoading(false); }
  }
  async function logout() {
    try { await signOut(); resetConnection(); selectClassroom(null); setClassroomId(null); setUser(null); setState(null); setPassword(''); }
    catch (e) { setError((e as Error).message); }
  }
  const connection = <ConnectionNotice authenticated={!!user}/>;
  if (loading) return <>{connection}<main className="min-h-screen grid place-items-center">Cargando EduPuntos…</main></>;
  if (user && !user.classrooms?.length) return <>{connection}<main className="pending-classroom"><h1>Aula pendiente de asignación</h1><p>{user.role === 'teacher' ? 'El administrador debe asignarte las aulas que impartes.' : 'Tu cuenta está creada. El administrador debe asignarte tu grado y sección.'}</p><p>Los datos anteriores se conservan. Hay 20 aulas de secundaria: de 1.º a 5.º, secciones A, B, C y D.</p>{error && <p role="alert">{error}</p>}<button onClick={() => void refresh()}>Comprobar asignación</button><button onClick={() => void logout()}>Cerrar sesión</button></main></>;
  if (user && state) return <>{connection}{error && <p role="alert" className="p-3 bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200">{error}</p>}<ClassroomContext.Provider key={classroomId} value={{ classrooms: user.classrooms || [], selected: classroomId!, change: id => void changeClassroom(id) }}>{children({ state, user, onStateUpdate: applyState, onLogout: () => void logout() })}</ClassroomContext.Provider></>;
  return <>{connection}<main className={`login-page ${__APP_ROLE__ === 'teacher' ? 'login-teacher' : 'login-student'}`}>
    <section className="login-story"><div className="brand"><span className="brand-symbol"><BookOpen size={24}/></span><span><strong>edu<span>puntos</span><i>.</i></strong><small>APRENDEMOS JUNTOS</small></span></div><div className="login-story-copy"><span className="eyebrow">{__APP_ROLE__ === 'teacher' ? 'ENSEÑAR TAMBIÉN ES ACOMPAÑAR' : 'TU ESFUERZO TIENE VALOR'}</span><h2>{__APP_ROLE__ === 'teacher' ? 'Más cerca de cada aprendizaje.' : 'Grandes logros. Pequeños pasos.'}</h2><p>{__APP_ROLE__ === 'teacher' ? 'Un espacio para organizar tu aula, reconocer el esfuerzo y ver crecer a tus estudiantes.' : 'Tus tareas, tus avances y nuevos retos. Todo en un espacio hecho para ti.'}</p><div className="login-feature"><CheckCircle2 size={19}/><span>{__APP_ROLE__ === 'teacher' ? 'Tareas y calificaciones en un mismo lugar' : 'Comparte tu trabajo y descubre tu progreso'}</span></div><div className="login-feature"><Sparkles size={19}/><span>{__APP_ROLE__ === 'teacher' ? 'Conectado con el espacio de tus alumnos' : 'Cada nuevo aprendizaje suma'}</span></div></div><small className="login-story-footer">Cada avance cuenta <ArrowUpRight size={15}/></small></section>
    <div className="login-form-wrap"><div className="login-content">
    {registering && __APP_ROLE__ === 'student' ? <RegistrationForm onBack={() => { setRegistering(false); setError(''); }} onRegistered={async (email, confirmationRequired) => {
      setUsername(email); setPassword(''); setLoginMode('email'); setRegistering(false); setError('');
      if (confirmationRequired) setNotice('Revisa tu correo y abre el enlace de confirmación de Supabase. Después vuelve aquí e inicia sesión con tu correo o DNI. Si ya tenías cuenta, puedes ingresar con tu contraseña.');
      else { setNotice(''); await refresh(); }
    }}/> : <form className="login-form space-y-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(''); setLoadFailed(false);
      try { await login(username, password); setPassword(''); setNotice(''); await refresh(); }
      catch (error) { setError((error as Error).message); } finally { setBusy(false); }
    }}>
      <div><span className="eyebrow">TE DAMOS LA BIENVENIDA</span><h1 className="text-2xl font-bold">EduPuntos {__APP_ROLE__ === 'teacher' ? 'Docentes' : 'Alumnos'}</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-200">Inicia sesión con tu cuenta {__APP_ROLE__ === 'teacher' ? 'docente' : 'de estudiante'}.</p></div>
      {notice && <p role="status" className="auth-notice">{notice}</p>}
      {__APP_ROLE__ === 'student' && <div className="auth-methods" role="group" aria-label="Ingresar con">
        <button type="button" aria-pressed={loginMode === 'email'} onClick={() => { setLoginMode('email'); setUsername(''); setError(''); }}>Correo electrónico</button>
        <button type="button" aria-pressed={loginMode === 'dni'} onClick={() => { setLoginMode('dni'); setUsername(''); setError(''); }}>DNI</button>
      </div>}
      <label className="block text-sm font-medium">{loginMode === 'dni' ? 'DNI' : __BACKEND__ === 'supabase' ? 'Correo electrónico' : 'Usuario'}<input type={loginMode === 'email' && __BACKEND__ === 'supabase' ? 'email' : 'text'} inputMode={loginMode === 'dni' ? 'numeric' : undefined} pattern={loginMode === 'dni' ? '[0-9]{8}' : undefined} maxLength={loginMode === 'dni' ? 8 : 254} autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      <label className="block text-sm font-medium">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      {error && <div><p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>{loadFailed && <button type="button" className="auth-text-button" disabled={busy} onClick={() => void refresh()}>Reintentar carga</button>}</div>}
      <button disabled={busy} className="w-full rounded-lg bg-indigo-700 text-white p-3 font-semibold disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
      {__APP_ROLE__ === 'student' ? <button type="button" disabled={busy} className="auth-text-button" onClick={() => { setRegistering(true); setPassword(''); setError(''); setNotice(''); }}>Crear cuenta de alumno</button> : <p className="text-xs text-slate-500 dark:text-slate-400">Solicita tu cuenta docente al administrador de la institución.</p>}
    </form>}</div></div>
  </main></>;
}
