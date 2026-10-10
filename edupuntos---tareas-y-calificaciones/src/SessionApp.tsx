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
  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
    <form className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg space-y-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await login(username, password); setPassword(''); await refresh(); }
      catch (error) { setError((error as Error).message); } finally { setBusy(false); }
    }}>
      <div><h1 className="text-2xl font-bold">EduPuntos {__APP_ROLE__ === 'teacher' ? 'Docentes' : 'Alumnos'}</h1><p className="mt-2 text-sm text-slate-600">Inicia sesión con tu cuenta {__APP_ROLE__ === 'teacher' ? 'docente' : 'de estudiante'}.</p></div>
      <label className="block text-sm font-medium">{__BACKEND__ === 'supabase' ? 'Correo electrónico' : 'Usuario'}<input type={__BACKEND__ === 'supabase' ? 'email' : 'text'} autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      <label className="block text-sm font-medium">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-3" /></label>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-indigo-700 text-white p-3 font-semibold disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
      <p className="text-xs text-slate-500">Solicita tu cuenta al administrador de la institución.</p>
    </form>
  </main>;
}
