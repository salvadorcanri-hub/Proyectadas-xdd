import type { CSSProperties } from 'react';
import { ArrowUpRight, BookOpen, Camera, CheckCheck, Plus, Users, ArrowRight, FileSpreadsheet } from 'lucide-react';
import type { AppState } from '../types';
import { Avatar } from './Avatar';
import { calculateStudentScores } from '../utils/scoreCalculator';
import { verificationStatus } from '../utils/photoVerification';

export function TeacherOverview({ state, navigate, review }: { state: AppState; review: (id: string) => void; navigate: (tab: 'assignments' | 'reviews' | 'matrix' | 'ranking' | 'excel') => void }) {
  const pending = state.submissions.filter(s => verificationStatus(s, state.grades.find(g => g.assignmentId === s.assignmentId && g.studentId === s.studentId)?.grade) !== 'matched');
  const graded = state.grades.filter(g => g.grade).length;
  const total = state.students.length * state.assignments.length;
  const progress = total ? Math.round(graded / total * 100) : 0;
  const scores = calculateStudentScores(state);
  return <>
    <section className="teacher-welcome">
      <div><span className="eyebrow">UN NUEVO DÍA PARA ENSEÑAR</span><h1>Tu aula, de un vistazo<span>.</span></h1><p>Menos tiempo organizando. Más tiempo acompañando.</p><button className="primary-action" onClick={() => navigate('assignments')}><Plus size={18} /> Crear una tarea</button></div>
      <div className="welcome-art" aria-hidden="true"><span className="art-orbit"/><div className="art-sheet"><div/><div/><div/><CheckCheck size={32}/></div><span className="art-badge"><BookOpen size={28}/></span><span className="art-star">✦</span></div>
    </section>
    <section className="stat-grid" aria-label="Resumen del aula">
      {[{label:'Estudiantes',value:state.students.length,note:'Un aula, muchas posibilidades',icon:Users,tone:'mint'}, {label:'Tareas publicadas',value:state.assignments.length,note:'Actividades para aprender',icon:BookOpen,tone:'violet'}, {label:'Por revisar',value:pending.length,note:'Entregas que esperan tu mirada',icon:Camera,tone:'peach'}, {label:'Calificaciones',value:graded,note:`De ${total} notas posibles`,icon:CheckCheck,tone:'blue'}].map(({label,value,note,icon:Icon,tone}) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={19}/></span></div><strong>{value.toString().padStart(2,'0')}</strong><p>{note}</p></article>)}
    </section>
    <div className="overview-columns">
      <section className="surface overview-tasks"><div className="section-heading"><div><h2>Actividades del aula</h2><p>El avance de cada tarea, en un solo lugar.</p></div><button className="text-action" onClick={() => navigate('assignments')}>Ver todas <ArrowUpRight size={16}/></button></div>
        <div className="activity-list">{state.assignments.slice(0,4).map((a,i) => { const count=state.submissions.filter(s=>s.assignmentId===a.id).length; return <div className="activity-row" key={a.id}><span className={`activity-icon ${['mint','violet','peach'][i%3]}`}><BookOpen size={21}/></span><div className="activity-info"><h3>{a.title}</h3><p>{a.subject} <span>· {new Date(`${a.dueDate}T12:00:00`).toLocaleDateString('es-PE',{day:'numeric',month:'short'})}</span></p></div><div className="activity-progress"><span>{count}/{state.students.length} entregas</span><progress aria-label={`Entregas de ${a.title}`} max={state.students.length || 1} value={count}/></div><button className="icon-action" aria-label={`Revisar ${a.title}`} onClick={() => review(a.id)}><ArrowUpRight size={18}/></button></div>;})}{!state.assignments.length && <p className="empty-message">Aquí aparecerán tus actividades. Crea la primera para empezar.</p>}</div>
        <button className="overview-footer" onClick={() => navigate('matrix')}>Abrir planilla de calificaciones <ArrowRight size={17}/></button>
      </section>
      <section className="surface progress-panel"><div className="section-heading"><div><h2>Así vamos</h2><p>Progreso de calificación</p></div><span className="small-chip">Aula</span></div><div className="progress-ring" style={{'--progress': `${progress}%`} as CSSProperties}><div><strong>{progress}%</strong><span>calificado</span></div></div><p><strong>{graded} de {total}</strong> actividades con nota</p><button className="text-action" onClick={() => navigate('reviews')}>{pending.length ? 'Revisar entregas pendientes' : 'Ver entregas del aula'} <ArrowRight size={16}/></button></section>
    </div>
    <div className="overview-columns overview-bottom"><section className="surface"><div className="section-heading"><div><h2>Cada esfuerzo suma</h2><p>Estudiantes que van dejando huella.</p></div><button className="text-action" onClick={() => navigate('ranking')}>Ver ranking <ArrowUpRight size={16}/></button></div><div className="leaders">{scores.slice(0,3).map((s,i)=><div key={s.student.id}><span className="leader-position">{String(i+1).padStart(2,'0')}</span><Avatar src={s.student.avatar} alt={s.student.name} className="w-9 h-9 rounded-full"/><span className="leader-name">{s.student.name}<small>{s.assignmentsCompleted} tareas calificadas</small></span><strong>{s.totalPoints}<small>pts</small></strong></div>)}{!scores.length && <p className="empty-message">El progreso de tus estudiantes aparecerá aquí.</p>}</div></section><section className="excel-callout"><span className="stat-icon mint"><FileSpreadsheet size={22}/></span><h2>Tu Excel también tiene lugar.</h2><p>Descarga la plantilla o importa tus notas para tener todo al día.</p><button className="text-action" onClick={() => navigate('excel')}>Ir a Conectar Excel <ArrowRight size={17}/></button></section></div>
  </>;
}
