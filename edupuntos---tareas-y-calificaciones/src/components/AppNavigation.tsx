import { BookOpen, GraduationCap, LogOut, Sparkles, type LucideIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { connectionSnapshot, subscribeConnection } from '../services/connection';
import { useClassroom } from './ClassroomContext';
import { SettingsButton } from './AppearanceSettings';

type Item = { id: string; label: string; icon: LucideIcon; badge?: number };
export function AppNavigation({ role, items, active, onChange, onLogout, name }: {
  role: 'teacher' | 'student'; items: Item[]; active: string; onChange: (id: string) => void; onLogout: () => void; name?: string;
}) {
  const classroom = useClassroom();
  const connection = useSyncExternalStore(subscribeConnection, connectionSnapshot);
  return <header className={`app-navigation ${role}-navigation`}>
    <a className="brand" href="#main-content" aria-label="EduPuntos: ir al contenido">
      <span className="brand-symbol"><BookOpen size={22} strokeWidth={2.2} /></span>
      <span><strong>edu<span>puntos</span><i>.</i></strong><small>{role === 'teacher' ? 'ESPACIO DOCENTE' : 'MI ESPACIO DE APRENDIZAJE'}</small></span>
    </a>
    {classroom && <div className="classroom-picker"><GraduationCap size={18}/>{role === 'teacher' ? <label>Aula<select aria-label="Aula activa" disabled={connection.pending > 0} value={classroom.selected} onChange={event => classroom.change(event.target.value)}>{classroom.classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <span>{classroom.classrooms.find(c => c.id === classroom.selected)?.name}</span>}</div>}
    <nav aria-label={role === 'teacher' ? 'Navegación docente' : 'Navegación del alumno'}>
      {role === 'teacher' && <p className="nav-caption">PRINCIPAL</p>}
      {items.map(({ id, label, icon: Icon, badge }) => <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => onChange(id)} className={`nav-item ${active === id ? 'is-active' : ''}`}><Icon size={19} /><span>{label}</span>{badge !== undefined && <small>{badge}</small>}</button>)}
      <SettingsButton/>
    </nav>
    {role === 'teacher' && <div className="sidebar-note"><Sparkles size={22} /><strong>Cada avance cuenta.</strong><p>Tu acompañamiento hace la diferencia en el aula.</p></div>}
    <div className="navigation-account"><span className="account-initials">{role === 'teacher' ? 'PR' : name?.split(' ').map(n => n[0]).slice(0,2).join('')}</span><span className="account-name">{name || 'Profesor'}<small>{role === 'teacher' ? 'Cuenta docente' : 'Estudiante'}</small></span><button onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="logout-button"><LogOut size={19} /></button></div>
  </header>;
}
