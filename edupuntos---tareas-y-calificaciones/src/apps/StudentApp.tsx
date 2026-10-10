import { Avatar } from '../components/Avatar';
import React, { useState } from 'react';
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

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    comment?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
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

  const filteredAssignments = state.assignments.filter((asg) => {
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
  });

  if (!currentStudent) return <main className="p-8">No hay un estudiante asociado a esta cuenta. <button onClick={onLogout}>Cerrar sesión</button></main>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Dedicated Student Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Dedicated Student Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
                EduPuntos Alumnos
              </span>
              <span className="text-[10px] text-indigo-600 font-bold tracking-wide block">
                PORTAL DEL ESTUDIANTE
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation strictly for students */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('homeworks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'homeworks'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Mis Deberes</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'ranking'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Ranking & Premios</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'report'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Mi Libreta</span>
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold">{currentStudent?.name}</span>
            <button onClick={onLogout} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">Cerrar sesión</button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Student Profile Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar
              src={currentStudent.avatar}
              alt={currentStudent.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-indigo-200 shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{currentStudent.name}</h1>
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  {currentStudent.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fotografía tus cuadernos, acumula puntos oficiales y gana premios en el Top 3.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-center min-w-[100px]">
              <span className="text-[11px] text-indigo-700 font-semibold uppercase block">Mis Puntos</span>
              <span className="text-2xl font-bold font-mono text-indigo-950 tabular-nums">
                {myScore?.totalPoints || 0}
              </span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center min-w-[100px]">
              <span className="text-[11px] text-amber-800 font-semibold uppercase block">Puesto Aula</span>
              <span className="text-2xl font-bold font-mono text-amber-950 tabular-nums">
                #{myScore?.rank || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: MIS DEBERES (TAREAS Y SUBIDA DE FOTOS) */}
        {activeTab === 'homeworks' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Mis Tareas Asignadas</h2>
                <p className="text-xs text-slate-500">
                  Toma fotos nítidas de tu cuaderno. Las notas se sincronizan directamente con el registro de Excel del profesor.
                </p>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({state.assignments.length})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'pending'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setFilter('submitted')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filter === 'submitted'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  En Revisión
                </button>
                <button
                  onClick={() => setFilter('graded')}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
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
                          <span>Entrega: {asg.dueDate}</span>
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
                      <p className="text-xs text-slate-600 line-clamp-3">{asg.description}</p>

                      {submission && (
                        <div className="pt-2">
                          <div className="text-[11px] font-medium text-slate-500 mb-1">
                            Foto de tu cuaderno entregada:
                          </div>
                          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-36">
                            <img
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

                      {!hasSubmission && (
                        <div className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            No saldrá tu nota hasta que envíes la foto y el profesor la revise.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase text-indigo-700">
                  {uploadModalAsg.subject}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Subir Foto: {uploadModalAsg.title}
                </h3>
              </div>
              <button
                onClick={() => setUploadModalAsg(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <Camera className="w-8 h-8 text-indigo-600 mb-2" />
                <span className="text-xs font-semibold text-slate-800">
                  Tomar Foto con Cámara o Subir Imagen
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>


              {photoPreview && (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 max-h-52">
                  <img src={photoPreview} alt="Preview" referrerPolicy="no-referrer" className="w-full h-44 object-contain" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Comentario al profesor:
                </label>
                <textarea
                  rows={2}
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  placeholder="Ej: Profesor, aquí está la tarea resuelta de la página 45."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                />
              </div>

              {uploadError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadModalAsg(null)}
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
        </div>
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
