import { HomeworkPhoto } from '../components/HomeworkPhoto';
import { AppNavigation } from '../components/AppNavigation';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  Trophy,
  Clock,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Medal,
  Award,
} from 'lucide-react';
import { AppState, Assignment } from '../types';
import { calculateStudentScores, getGradeLabel } from '../utils/scoreCalculator';
import { submitHomework } from '../services/api';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { Modal } from '../components/Modal';

interface StudentAppProps {
  state: AppState;
  activeStudentId: string;
  onStateUpdate: (newState: AppState) => void;
  onLogout: () => void;
}

export const StudentApp: React.FC<StudentAppProps> = ({
  state,
  activeStudentId,
  onStateUpdate,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'homeworks' | 'ranking' | 'report'>('homeworks');
  const currentStudent = state.students.find((s) => s.id === activeStudentId) || state.students[0];
  const scores = calculateStudentScores(state);
  const myScore = scores.find((s) => s.student.id === currentStudent?.id);

  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [uploadModalAsg, setUploadModalAsg] = useState<Assignment | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [studentComment, setStudentComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const photoReader = useRef<FileReader | null>(null);
  useEffect(() => () => { photoReader.current?.abort(); photoReader.current = null; }, [uploadModalAsg?.id]);

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    comment?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    photoReader.current?.abort();
    photoReader.current = null;
    setPhotoPreview('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    photoReader.current = reader;
    reader.onload = () => {
      if (photoReader.current === reader) setPhotoPreview(reader.result as string);
    };
    reader.onerror = () => setUploadError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  };

  const handleSubmitPhoto = async () => {
    if (!uploadModalAsg || !currentStudent) return;
    if (!photoPreview) {
      setUploadError('Debes tomar o elegir una foto de tu cuaderno.');
      return;
    }

    setIsSubmitting(true);
    setUploadError('');

    try {
      const updatedState = await submitHomework(
        uploadModalAsg.id,
        currentStudent.id,
        photoPreview,
        studentComment
      );
      onStateUpdate(updatedState);
      confetti({ particleCount: 60, spread: 70 });
      setUploadModalAsg(null);
      setPhotoPreview('');
      setStudentComment('');
    } catch (err: any) {
      setUploadError(err.message || 'Error al enviar la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignmentPriority = (id: string) => state.grades.some(g => g.assignmentId === id && g.studentId === currentStudent?.id && g.grade) ? 2 : state.submissions.some(s => s.assignmentId === id && s.studentId === currentStudent?.id) ? 1 : 0;
  const filteredAssignments = state.assignments.filter((asg) => {
    if (!currentStudent) return false;
    const submission = state.submissions.find(
      (s) => s.assignmentId === asg.id && s.studentId === currentStudent.id
    );
    const gradeRec = state.grades.find(
      (g) => g.assignmentId === asg.id && g.studentId === currentStudent.id
    );

    const isGraded = Boolean(gradeRec && gradeRec.grade);
    const isSubmitted = Boolean(submission);

    if (filter === 'graded') return isGraded;
    if (filter === 'submitted') return isSubmitted && !isGraded;
    if (filter === 'pending') return !isSubmitted && !isGraded;
    return true;
  }).sort((a, b) => assignmentPriority(a.id) - assignmentPriority(b.id));

  if (!currentStudent) return <main className="p-8">No hay un estudiante asociado a esta cuenta. <button onClick={onLogout}>Cerrar sesión</button></main>;

  return (
    <div className="student-app min-h-screen text-slate-900 flex flex-col">
      <AppNavigation role="student" active={activeTab} onChange={tab => setActiveTab(tab as typeof activeTab)} onLogout={onLogout} name={currentStudent.name} items={[
        {id:'homeworks',label:'Mis Deberes',icon:BookOpen},
        {id:'report',label:'Mi Libreta',icon:Award},
        {id:'ranking',label:'Ranking & Premios',icon:Trophy},
      ]}/>
      <main id="main-content" className="student-main">
        <div className="page-topline"><span>Mi espacio <span>/</span> {{homeworks:'Mis deberes',report:'Mi libreta',ranking:'Ranking y premios'}[activeTab]}</span><span className="term-label"><Sparkles size={14}/> A tu ritmo, cada día</span></div>
        <section className="student-welcome">
          <div className="student-greeting"><span className="eyebrow">QUÉ BUENO TENERTE AQUÍ</span><h1>¡Hola, {currentStudent.name.split(' ')[0]}! <span className="greeting-star">✦</span></h1><p>Cada pequeño esfuerzo te lleva más lejos.<br/>¿Qué vas a aprender hoy?</p><button onClick={() => {setActiveTab('homeworks'); setFilter('pending'); document.getElementById('student-tasks')?.scrollIntoView({behavior:'smooth',block:'start'});}} className="primary-action">Ver mis pendientes <ArrowRight size={17}/></button></div>
          <div className="student-journey" aria-label="Tu avance"><div className="journey-trophy"><Trophy size={38} strokeWidth={1.5}/><span>✦</span></div><div><span>TU ESFUERZO SUMA</span><strong>{myScore?.totalPoints || 0}<small> puntos</small></strong><p>{myScore?.totalPoints ? '¡Sigue construyendo tu camino!' : 'Tu próxima tarea es un buen comienzo.'}</p></div></div>
        </section>
        <section className="student-stats" aria-label="Resumen de mi progreso">
          <div><span className="stat-icon peach"><Clock size={21}/></span><span><strong>{myScore?.gradesCount.unsubmitted || 0}</strong><small>Por entregar</small></span></div>
          <div><span className="stat-icon violet"><Camera size={21}/></span><span><strong>{myScore?.gradesCount.awaitingReview || 0}</strong><small>En revisión</small></span></div>
          <div><span className="stat-icon mint"><CheckCircle2 size={21}/></span><span><strong>{myScore?.assignmentsCompleted || 0}</strong><small>Calificadas</small></span></div>
          <div><span className="stat-icon gold"><Trophy size={21}/></span><span><strong>#{myScore?.rank || '—'}</strong><small>Puesto en el aula</small></span></div>
        </section>
        {/* TAB 1: MIS DEBERES (TAREAS Y SUBIDA DE FOTOS) */}
        {activeTab === 'homeworks' && (
          <div id="student-tasks" className="student-tasks space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Un paso más en tu aprendizaje</h2>
                <p className="text-xs text-slate-500">
                  Elige una tarea, da lo mejor de ti y comparte tu trabajo.
                </p>
              </div>

              {/* Filter tabs */}
              <div className="task-filters flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
                <button
                  aria-pressed={filter === 'all'} onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({state.assignments.length})
                </button>
                <button
                  aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'pending'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  aria-pressed={filter === 'submitted'} onClick={() => setFilter('submitted')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'submitted'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  En Revisión
                </button>
                <button
                  aria-pressed={filter === 'graded'} onClick={() => setFilter('graded')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'graded'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Calificadas
                </button>
              </div>
            </div>

            {/* Assignments Grid */}
            <div className="homework-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {!filteredAssignments.length && <div className="task-empty"><CheckCircle2 size={32}/><h3>{filter === 'pending' ? '¡Todo al día!' : 'Todavía no hay tareas aquí'}</h3><p>{filter === 'pending' ? 'No tienes tareas pendientes. Puedes revisar tu libreta mientras llega un nuevo reto.' : 'Las tareas aparecerán en esta sección cuando cambie su estado.'}</p><button onClick={() => setFilter('all')} className="text-action">Ver todas las tareas <ArrowRight size={16}/></button></div>}
              {filteredAssignments.map((asg) => {
                const submission = state.submissions.find(
                  (s) => s.assignmentId === asg.id && s.studentId === currentStudent.id
                );
                const gradeRec = state.grades.find(
                  (g) => g.assignmentId === asg.id && g.studentId === currentStudent.id
                );
                const gradeInfo = getGradeLabel(gradeRec?.grade);
                const hasGrade = Boolean(gradeRec && gradeRec.grade);
                const hasSubmission = Boolean(submission);

                return (
                  <div
                    key={asg.id}
                    className={`homework-card flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden ${hasGrade ? 'is-graded' : hasSubmission ? 'is-submitted' : 'is-pending'}`}
                  >
                    <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-indigo-700 tracking-wide uppercase">
                          {asg.subject}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
                          {asg.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Entrega: {new Date(`${asg.dueDate}T12:00:00`).toLocaleDateString('es-PE', {day:'numeric',month:'long'})}</span>
                        </p>
                      </div>

                      {hasGrade ? (
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md ${gradeInfo.badgeClass}`}>
                            Nota {gradeInfo.code}
                          </span>
                          <div className="text-[11px] font-mono font-bold text-slate-700 mt-0.5">
                            +{gradeInfo.points} pts
                          </div>
                        </div>
                      ) : hasSubmission ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                          Foto Enviada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          Pendiente
                        </span>
                      )}
                    </div>

                    <div className="p-4 flex-1 space-y-3">
                      {asg.description && <div className="text-xs text-slate-600">
                        <p className="line-clamp-3">{asg.description}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold text-indigo-700">Leer instrucciones completas</summary>
                          <p className="mt-2 whitespace-pre-wrap break-words">{asg.description}</p>
                        </details>
                      </div>}

                      {submission && (
                        <div className="pt-2">
                          <div className="text-[11px] font-medium text-slate-500 mb-1">
                            Foto de tu cuaderno entregada:
                          </div>
                          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-36">
                            <HomeworkPhoto
                              src={submission.photoUrl}
                              alt="Foto enviada"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <button
                              onClick={() =>
                                setLightboxData({
                                  url: submission.photoUrl,
                                  title: asg.title,
                                  comment: submission.comment,
                                })
                              }
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Ampliar Foto</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {hasGrade && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                          <div className="font-semibold text-slate-800">
                            {gradeInfo.label} (+{gradeInfo.points} pts)
                          </div>
                          {gradeRec?.feedback && (
                            <p className="text-slate-600 mt-0.5 text-[11px] italic">
                              "{gradeRec.feedback}"
                            </p>
                          )}
                        </div>
                      )}

                      {!hasSubmission && !hasGrade && (
                        <div className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            Sube una foto clara de tu trabajo para que tu profesor pueda revisarlo.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        onClick={() => {
                          setUploadModalAsg(asg);
                          setPhotoPreview('');
                          setStudentComment(submission?.comment || '');
                          setUploadError('');
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                          hasSubmission
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        <Camera className="w-4 h-4" />
                        <span>{hasSubmission ? 'Cambiar / Reenviar Foto' : 'Tomar / Subir Foto'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: RANKING & PREMIOS TOP 3 */}
        {activeTab === 'ranking' && (
          <div className="space-y-6">
            {/* Top 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {/* 2nd place */}
              {scores[1] && scores[1].totalPoints > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between order-2 md:order-1">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-slate-400" />
                        2º Lugar · Plata
                      </span>
                      <span className="font-mono">#2</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar
                        src={scores[1].student.avatar}
                        alt={scores[1].student.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900">{scores[1].student.name}</h4>
                        <span className="text-xs text-slate-400">{scores[1].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs">
                      <div className="text-slate-500">Puntaje</div>
                      <div className="text-xl font-bold font-mono text-slate-900">{scores[1].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Premio Asignado</div>
                    <p className="text-xs text-slate-700 bg-slate-100 p-2 rounded-lg">{state.rewards.secondPlace}</p>
                  </div>
                </div>
              )}

              {/* 1st place */}
              {scores[0] && scores[0].totalPoints > 0 && (
                <div className="bg-white border-2 border-amber-300 rounded-xl p-6 shadow-md flex flex-col justify-between order-1 md:order-2 bg-linear-to-b from-amber-50/40 to-white">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-bold text-amber-800">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        1º Lugar · Oro
                      </span>
                      <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-800 font-mono">LÍDER</span>
                    </div>
                    <div className="flex items-center gap-3.5 mb-3">
                      <Avatar
                        src={scores[0].student.avatar}
                        alt={scores[0].student.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400"
                      />
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{scores[0].student.name}</h4>
                        <span className="text-xs text-slate-400">{scores[0].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-xs">
                      <div className="text-amber-800">Puntaje Máximo</div>
                      <div className="text-2xl font-bold font-mono text-amber-950">{scores[0].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-200">
                    <div className="text-[11px] font-bold text-amber-900 uppercase mb-1">Gran Premio Oficial</div>
                    <p className="text-xs font-semibold text-amber-950 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                      🏆 {state.rewards.firstPlace}
                    </p>
                  </div>
                </div>
              )}

              {/* 3rd place */}
              {scores[2] && scores[2].totalPoints > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between order-3">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-amber-800">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-amber-700" />
                        3º Lugar · Bronce
                      </span>
                      <span className="font-mono">#3</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar
                        src={scores[2].student.avatar}
                        alt={scores[2].student.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-200"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900">{scores[2].student.name}</h4>
                        <span className="text-xs text-slate-400">{scores[2].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs">
                      <div className="text-slate-500">Puntaje</div>
                      <div className="text-xl font-bold font-mono text-slate-900">{scores[2].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Premio Asignado</div>
                    <p className="text-xs text-slate-700 bg-slate-100 p-2 rounded-lg">{state.rewards.thirdPlace}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Full Leaderboard */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Tabla General de Posiciones</h3>
                <p className="text-xs text-slate-500">Actualizada automáticamente en tiempo real con las notas del profesor.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3 text-center w-14">Puesto</th>
                      <th className="px-4 py-3">Estudiante</th>
                      <th className="px-4 py-3 text-center">AD (10)</th>
                      <th className="px-4 py-3 text-center">A (8)</th>
                      <th className="px-4 py-3 text-center">B (6)</th>
                      <th className="px-4 py-3 text-center">C (4)</th>
                      <th className="px-4 py-3 text-right">Puntos Totales</th>
                      <th className="px-4 py-3">Premio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scores.map((sc) => {
                      const isMe = sc.student.id === currentStudent.id;
                      return (
                        <tr key={sc.student.id} className={isMe ? 'bg-indigo-50/50 font-semibold' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 text-center font-bold font-mono text-slate-700">
                            #{sc.rank}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar src={sc.student.avatar} alt={sc.student.name} className="w-7 h-7 rounded-full object-cover" />
                              <span>{sc.student.name} {isMe ? '(Tú)' : ''}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-emerald-700">{sc.gradesCount.AD}</td>
                          <td className="px-4 py-3 text-center font-mono text-blue-700">{sc.gradesCount.A}</td>
                          <td className="px-4 py-3 text-center font-mono text-amber-700">{sc.gradesCount.B}</td>
                          <td className="px-4 py-3 text-center font-mono text-rose-700">{sc.gradesCount.C}</td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-slate-900">{sc.totalPoints} pts</td>
                          <td className="px-4 py-3 text-[11px]">
                            {sc.totalPoints === 0 ? '-' : sc.rank === 1 ? '🥇 Oro' : sc.rank === 2 ? '🥈 Plata' : sc.rank === 3 ? '🥉 Bronce' : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MI LIBRETA DE NOTAS */}
        {activeTab === 'report' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mi Libreta Escolar de Tareas</h2>
              <p className="text-xs text-slate-500">
                Historial completo de notas oficiales asignadas a tus tareas.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {state.assignments.map((asg) => {
                const gradeRec = state.grades.find(
                  (g) => g.assignmentId === asg.id && g.studentId === currentStudent.id
                );
                const submission = state.submissions.find(
                  (s) => s.assignmentId === asg.id && s.studentId === currentStudent.id
                );
                const gradeInfo = getGradeLabel(gradeRec?.grade);

                return (
                  <div key={asg.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 uppercase">{asg.subject}</span>
                      <h4 className="text-sm font-bold text-slate-900">{asg.title}</h4>
                      {gradeRec?.feedback && (
                        <p className="text-xs text-slate-500 italic mt-0.5">"{gradeRec.feedback}"</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {gradeRec?.grade ? (
                        <>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${gradeInfo.badgeClass}`}>
                            Nota {gradeInfo.code}
                          </span>
                          <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                            +{gradeInfo.points} puntos
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          {submission ? 'En revisión' : 'Sin presentar (0 pts)'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* UPLOAD MODAL */}
      {uploadModalAsg && (
        <Modal labelledBy="upload-title" busy={isSubmitting} onClose={() => setUploadModalAsg(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase text-indigo-700">
                  {uploadModalAsg.subject}
                </span>
                <h3 id="upload-title" className="text-base font-bold text-slate-900">
                  Subir Foto: {uploadModalAsg.title}
                </h3>
              </div>
              <button
                aria-label="Cerrar envío de foto"
                disabled={isSubmitting}
                onClick={() => setUploadModalAsg(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {state.grades.some(g => g.assignmentId === uploadModalAsg.id && g.studentId === currentStudent.id && g.grade) && (
                <p role="status" className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Al confirmar una nueva entrega, se quitarán tu nota y tus puntos de esta tarea hasta que el profesor vuelva a revisarla.
                </p>
              )}
              {uploadModalAsg.description && <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{uploadModalAsg.description}</p>}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <Camera className="w-8 h-8 text-indigo-600 mb-2" />
                <span className="text-xs font-semibold text-slate-800">
                  Tomar Foto con Cámara o Subir Imagen
                </span>
                <input
                  type="file"
                  disabled={isSubmitting}
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>


              {photoPreview && (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 max-h-52">
                  <img src={photoPreview} alt="Preview" referrerPolicy="no-referrer" className="w-full h-44 object-contain" />
                </div>
              )}

              <div>
                <label htmlFor="student-comment" className="block text-xs font-semibold text-slate-700 mb-1">
                  Comentario al profesor:
                </label>
                <textarea
                  id="student-comment"
                  disabled={isSubmitting}
                  maxLength={2000}
                  rows={2}
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  placeholder="Ej: Profesor, aquí está la tarea resuelta de la página 45."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                />
              </div>

              {uploadError && (
                <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadModalAsg(null)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting || !photoPreview}
                onClick={handleSubmitPhoto}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Confirmar Entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightboxData && (
        <PhotoLightbox
          photoUrl={lightboxData.url}
          title={lightboxData.title}
          comment={lightboxData.comment}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
};
