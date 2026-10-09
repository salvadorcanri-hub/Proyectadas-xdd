import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trophy,
  ExternalLink,
  ChevronDown,
  UserCheck,
  FileText,
} from 'lucide-react';
import { AppState, Assignment, Student } from '../types';
import { calculateStudentScores, getGradeLabel } from '../utils/scoreCalculator';
import { submitHomework } from '../services/api';
import { PhotoLightbox } from './PhotoLightbox';

interface StudentPortalProps {
  state: AppState;
  activeStudentId: string;
  onSelectStudent: (studentId: string) => void;
  onStateUpdate: (newState: AppState) => void;
}

// Sample classroom notebook photos for easy desktop testing
const SAMPLE_HOMEWORK_PHOTOS = [
  {
    name: 'Ejercicios de Cuaderno (Matemáticas)',
    url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Apuntes y Esquema (Ciencias)',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Texto y Ensayo Manuscrito',
    url: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=900&auto=format&fit=crop&q=80',
  },
];

export const StudentPortal: React.FC<StudentPortalProps> = ({
  state,
  activeStudentId,
  onSelectStudent,
  onStateUpdate,
}) => {
  const currentStudent = state.students.find((s) => s.id === activeStudentId) || state.students[0];
  const scores = calculateStudentScores(state);
  const myScore = scores.find((s) => s.student.id === currentStudent?.id);

  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [uploadModalAsg, setUploadModalAsg] = useState<Assignment | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [studentComment, setStudentComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  // Lightbox
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    comment?: string;
  } | null>(null);

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecciona un archivo de imagen (JPG, PNG, WEBP).');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSamplePhoto = (url: string) => {
    setPhotoPreview(url);
    setUploadError('');
  };

  const handleSubmitPhoto = async () => {
    if (!uploadModalAsg || !currentStudent) return;
    if (!photoPreview) {
      setUploadError('Debes tomar o seleccionar una foto de tu tarea.');
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
      confetti({ particleCount: 50, spread: 60 });
      setUploadModalAsg(null);
      setPhotoPreview('');
      setStudentComment('');
    } catch (err: any) {
      setUploadError(err.message || 'Error al enviar la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter assignments
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
    if (filter === 'pending') return !isSubmitted;
    return true;
  });

  const isTop3 = myScore && myScore.rank <= 3;
  const rank1 = scores[0];
  const rank3 = scores[2];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Student Profile Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <img
            src={currentStudent.avatar}
            alt={currentStudent.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shadow-2xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{currentStudent.name}</h1>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {currentStudent.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Portal del Estudiante · Envía fotos de tus deberes y suma puntos
            </p>
          </div>
        </div>

        {/* Change Student Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <label htmlFor="student-picker" className="sr-only">
              Seleccionar Estudiante
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Cambiar de alumno:</span>
              <select
                id="student-picker"
                value={currentStudent.id}
                onChange={(e) => onSelectStudent(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                {state.students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats & Reward Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Points */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Puntaje Total Acumulado</div>
          <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {myScore?.totalPoints || 0}{' '}
            <span className="text-xs font-normal text-slate-500">puntos</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Escala: AD=10 · A=8 · B=6 · C=4 · Sin nota=0
          </div>
        </div>

        {/* Current Rank */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Posición en el Aula</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              #{myScore?.rank || '-'}
            </span>
            <span className="text-xs text-slate-500">de {state.students.length} estudiantes</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {myScore?.assignmentsCompleted || 0} de {state.assignments.length} tareas revisadas
          </div>
        </div>

        {/* Top 3 Prize Status */}
        <div
          className={`border rounded-xl p-4 shadow-xs flex flex-col justify-between ${
            isTop3
              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Trophy className={`w-3.5 h-3.5 ${isTop3 ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{isTop3 ? '¡En Podio de Premios!' : 'Objetivo: Top 3'}</span>
            </div>
            <p className="text-xs mt-1.5 line-clamp-2">
              {myScore?.rank === 1
                ? `1º Lugar: ${state.rewards.firstPlace}`
                : myScore?.rank === 2
                ? `2º Lugar: ${state.rewards.secondPlace}`
                : myScore?.rank === 3
                ? `3º Lugar: ${state.rewards.thirdPlace}`
                : `A ${Math.max(0, (rank3?.totalPoints || 0) + 1 - (myScore?.totalPoints || 0))} pts del 3º lugar para ganar premios.`}
            </p>
          </div>
          <div className="text-[11px] font-semibold mt-2 opacity-80">
            {isTop3 ? 'Mantén tus tareas al día para asegurar tu premio' : '¡Sube fotos de tus tareas para subir al podio!'}
          </div>
        </div>
      </div>

      {/* Homework List Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Mis Tareas Asignadas</h2>
            <p className="text-xs text-slate-500">
              Sube una foto clara de tu cuaderno o trabajo. Una vez que el profesor actualice sus notas en Excel, verás tu calificación reflejada aquí.
            </p>
          </div>

          {/* Interactive filter tabs (functional buttons with active state) */}
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

        {/* Assignment Cards */}
        {filteredAssignments.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-600">No hay tareas en esta categoría.</p>
          </div>
        ) : (
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
                  {/* Card Header */}
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

                    {/* Status Badge */}
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
                        Enviada
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 space-y-3">
                    <p className="text-xs text-slate-600 line-clamp-3">{asg.description}</p>

                    {/* Submitted Photo Thumbnail if exists */}
                    {submission && (
                      <div className="pt-2">
                        <div className="text-[11px] font-medium text-slate-500 mb-1">
                          Foto enviada por ti:
                        </div>
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-36">
                          <img
                            src={submission.photoUrl}
                            alt="Foto de la tarea enviada"
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

                    {/* Teacher Feedback if graded */}
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

                    {/* Notice if unsubmitted */}
                    {!hasSubmission && (
                      <div className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Sin presentar (0 pts). Toma una foto de tu cuaderno y súbela para que el profesor te califique.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={() => {
                        setUploadModalAsg(asg);
                        setPhotoPreview(submission?.photoUrl || '');
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
                      <span>{hasSubmission ? 'Cambiar / Reenviar Foto' : 'Subir Foto de mi Tarea'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              <p className="text-xs text-slate-600">
                Toma una foto legible de tu cuaderno o tarea resuelta. Puedes usar la cámara de tu celular o seleccionar una imagen guardada.
              </p>

              {/* Upload Drop Zone / Camera Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Tomar foto o subir archivo:
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <Camera className="w-8 h-8 text-indigo-600 mb-2" />
                  <span className="text-xs font-semibold text-slate-800">
                    Abrir Cámara o Elegir Foto
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Formatos JPG, PNG, WEBP (Hasta 20MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Quick sample photo selector for instant desktop testing */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  ¿Probando en PC sin cámara? Selecciona una foto de prueba:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_HOMEWORK_PHOTOS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSamplePhoto(sample.url)}
                      className="text-left p-1.5 border border-slate-200 hover:border-indigo-400 rounded-lg bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors"
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-12 object-cover rounded mb-1"
                      />
                      <span className="line-clamp-1">{sample.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Preview */}
              {photoPreview && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700">Vista previa de la foto:</div>
                  <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-900 max-h-56">
                    <img
                      src={photoPreview}
                      alt="Preview tarea"
                      referrerPolicy="no-referrer"
                      className="w-full h-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Student Comment */}
              <div className="space-y-1">
                <label htmlFor="student-note" className="block text-xs font-semibold text-slate-700">
                  Comentario para el profesor (opcional):
                </label>
                <textarea
                  id="student-note"
                  rows={2}
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  placeholder="Ej: Profesor, aquí están los ejercicios de la página 45 con las comprobaciones."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
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
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting || !photoPreview}
                onClick={handleSubmitPhoto}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Enviando...' : 'Confirmar y Enviar Tarea'}</span>
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
