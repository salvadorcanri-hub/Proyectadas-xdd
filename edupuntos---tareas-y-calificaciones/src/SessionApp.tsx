import { BookOpen, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { AppState, User } from './types';
import { currentUser, login, logout as signOut, fetchState, subscribeToRealtimeUpdates } from './services/api';

type ViewProps = { state: AppState; user: User; onStateUpdate: (state: AppState) => void; onLogout: () => void };
export function SessionApp({ children }: { children: (props: ViewProps) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const user = await currentUser();
      setState(await fetchState()); setUser(user);
    } catch (e) { if ((e as Error & { status?: number }).status !== 401) setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const expire = () => { setUser(null); setState(null); setError('Tu sesión ha terminado. Inicia sesión de nuevo.'); };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  useEffect(() => user ? subscribeToRealtimeUpdates(setState) : undefined, [user]);
  async function logout() {
    try { await signOut(); setUser(null); setState(null); setPassword(''); }
    catch (e) { setError((e as Error).message); }
  }
  if (loading) return <main className="min-h-screen grid place-items-center">Cargando EduPuntos…</main>;
  if (user && state) return <>{error && <p role="alert" className="p-3 bg-red-100 text-red-900">{error}</p>}{children({ state, user, onStateUpdate: setState, onLogout: () => void logout() })}</>;
  return <main className={`login-page ${__APP_ROLE__ === 'teacher' ? 'login-teacher' : 'login-student'}`}>
    <section className="login-story"><div className="brand"><span className="brand-symbol"><BookOpen size={24}/></span><span><strong>edu<span>puntos</span><i>.</i></strong><small>APRENDEMOS JUNTOS</small></span></div><div className="login-story-copy"><span className="eyebrow">{__APP_ROLE__ === 'teacher' ? 'ENSEÑAR TAMBIÉN ES ACOMPAÑAR' : 'TU ESFUERZO TIENE VALOR'}</span><h2>{__APP_ROLE__ === 'teacher' ? 'Más cerca de cada aprendizaje.' : 'Grandes logros. Pequeños pasos.'}</h2><p>{__APP_ROLE__ === 'teacher' ? 'Un espacio para organizar tu aula, reconocer el esfuerzo y ver crecer a tus estudiantes.' : 'Tus tareas, tus avances y nuevos retos. Todo en un espacio hecho para ti.'}</p><div className="login-feature"><CheckCircle2 size={19}/><span>{__APP_ROLE__ === 'teacher' ? 'Tareas y calificaciones en un mismo lugar' : 'Comparte tu trabajo y descubre tu progreso'}</span></div><div className="login-feature"><Sparkles size={19}/><span>{__APP_ROLE__ === 'teacher' ? 'Conectado con el espacio de tus alumnos' : 'Cada nuevo aprendizaje suma'}</span></div></div><small className="login-story-footer">Cada avance cuenta <ArrowUpRight size={15}/></small></section>
    <div className="login-form-wrap">
    <form className="login-form space-y-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await login(username, password); setPassword(''); await refresh(); }
      catch (error) { setError((error as Error).message); } finally { setBusy(false); }
    }}>
      <div><span className="eyebrow">TE DAMOS LA BIENVENIDA</span><h1 className="text-2xl font-bold">EduPuntos {__APP_ROLE__ === 'teacher' ? 'Docentes' : 'Alumnos'}</h1><p className="mt-2 text-sm text-slate-600">Inicia sesión con tu cuenta {__APP_ROLE__ === 'teacher' ? 'docente' : 'de estudiante'}.</p></div>
      <label className="block text-sm font-medium">{__BACKEND__ === 'supabase' ? 'Correo electrónico' : 'Usuario'}<input type={__BACKEND__ === 'supabase' ? 'email' : 'text'} autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      <label className="block text-sm font-medium">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-indigo-700 text-white p-3 font-semibold disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
      <p className="text-xs text-slate-500">Solicita tu cuenta al administrador de la institución.</p>
    </form></div>
  </main>;
}
