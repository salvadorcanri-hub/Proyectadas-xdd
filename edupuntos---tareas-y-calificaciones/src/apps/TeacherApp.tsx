import { HomeworkPhoto } from '../components/HomeworkPhoto';
import { AppNavigation } from '../components/AppNavigation';
import { TeacherOverview } from '../components/TeacherOverview';
import { LayoutDashboard } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  Plus,
  Trash2,
  Eye,
  Camera,
  Award,
  Save,
  Trophy,
  Medal,
} from 'lucide-react';
import { AppState, GradeType, RewardsConfig } from '../types';
import { calculateStudentScores, getGradeLabel } from '../utils/scoreCalculator';
import {
  updateGrade,
  createAssignment,
  deleteAssignment,
  importExcelBase64,
  updateRewardsConfig,
  downloadExcel,
} from '../services/api';
import { PhotoLightbox } from '../components/PhotoLightbox';

interface TeacherAppProps {
  state: AppState;
  onStateUpdate: (newState: AppState) => void;
  onLogout: () => void;
}

export const TeacherApp: React.FC<TeacherAppProps> = ({
  state,
  onStateUpdate,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'excel' | 'matrix' | 'reviews' | 'ranking' | 'assignments' | 'rewards'>('overview');

  // Excel state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelMessage, setExcelMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [excelPreviewRows, setExcelPreviewRows] = useState<any[][] | null>(null);
  const [excelBase64Data, setExcelBase64Data] = useState<string>('');

  // Review state
  const [selectedReviewAsgId, setSelectedReviewAsgId] = useState<string>(
    state.assignments[0]?.id || ''
  );
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    studentName?: string;
    submittedAt?: string;
    comment?: string;
  } | null>(null);

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Matemáticas');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreatingAsg, setIsCreatingAsg] = useState(false);

  // Rewards form state
  const [rewardsForm, setRewardsForm] = useState<RewardsConfig>({ ...state.rewards });
  const [isSavingRewards, setIsSavingRewards] = useState(false);
  const [rewardsSavedMsg, setRewardsSavedMsg] = useState(false);

  useEffect(() => { setRewardsForm({ ...state.rewards }); }, [state.rewards]);

  // Grade update
  const handleSetGrade = async (
    assignmentId: string,
    studentId: string,
    grade: GradeType,
    feedback?: string
  ) => {
    try {
      const fb = feedback !== undefined ? feedback : feedbackInputs[`${assignmentId}_${studentId}`];
      const updatedState = await updateGrade(assignmentId, studentId, grade, fb);
      onStateUpdate(updatedState);
      confetti({ particleCount: 20, spread: 40 });
    } catch (err: any) {
      alert('Error al calificar: ' + err.message);
    }
  };

  // Excel Download handler
  const handleDownloadExcel = async () => {
    try { await downloadExcel(); }
    catch (error) { setExcelMessage({ text: (error as Error).message, type: 'error' }); }
  };

  // Excel File selection & parsing
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelBase64Data(''); setExcelPreviewRows(null);
    if (file.size > 5 * 1024 * 1024) { setExcelMessage({ text: 'El archivo debe pesar como máximo 5 MB.', type: 'error' }); return; }
    setExcelMessage(null);
    setExcelLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 10002 });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        let binary = '';
        for (let i = 0; i < data.byteLength; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);

        setExcelPreviewRows(rows.slice(0, 10));
        setExcelBase64Data(base64);
        setExcelMessage({
          text: `Archivo "${file.name}" cargado (${rows.length - 1} filas detectadas). Pulsa Confirmar y Guardar Notas para aplicar los cambios.`,
          type: 'success',
        });
      } catch (err: any) {
        setExcelMessage({
          text: 'Error al leer el archivo Excel: ' + err.message,
          type: 'error',
        });
      } finally {
        setExcelLoading(false);
      }
    };
    reader.onerror = () => { setExcelLoading(false); setExcelMessage({ text: 'No se pudo leer el archivo.', type: 'error' }); };
    reader.readAsArrayBuffer(file);
  };

  // Confirm Excel sync to Central DB
  const handleConfirmExcelSync = async () => {
    if (!excelBase64Data) return;

    setExcelLoading(true);
    try {
      const res = await importExcelBase64(excelBase64Data);
      onStateUpdate(res.state);
      setExcelMessage({
        text: res.message || `¡Éxito! Se actualizaron ${res.updatedCount} calificaciones en la base central.`,
        type: 'success',
      });
      confetti({ particleCount: 60, spread: 65 });
      setExcelPreviewRows(null);
      setExcelBase64Data('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setExcelMessage({
        text: err.message || 'Error al sincronizar con el servidor.',
        type: 'error',
      });
    } finally {
      setExcelLoading(false);
    }
  };

  // Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSubject.trim()) return;

    setIsCreatingAsg(true);
    try {
      const updatedState = await createAssignment(
        newTitle.trim(),
        newSubject.trim(),
        newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        newDescription.trim()
      );
      onStateUpdate(updatedState);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      alert('¡Nueva tarea creada con éxito!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsCreatingAsg(false);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la tarea "${title}"?`)) return;
    try {
      const updatedState = await deleteAssignment(id);
      onStateUpdate(updatedState);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Save rewards config
  const handleSaveRewards = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRewards(true);
    try {
      const updated = await updateRewardsConfig(rewardsForm);
      onStateUpdate(updated);
      setRewardsSavedMsg(true);
      setTimeout(() => setRewardsSavedMsg(false), 3000);
    } catch (err: any) {
      alert('Error al guardar premios: ' + err.message);
    } finally {
      setIsSavingRewards(false);
    }
  };

  useEffect(() => {
    if (!state.assignments.some(a => a.id === selectedReviewAsgId)) setSelectedReviewAsgId(state.assignments[0]?.id || '');
  }, [state.assignments, selectedReviewAsgId]);
  const scores = calculateStudentScores(state);
  const currentReviewAsg = state.assignments.find((a) => a.id === selectedReviewAsgId) || state.assignments[0];

  return (
    <div className="teacher-app min-h-screen">
      <AppNavigation role="teacher" active={activeTab} onChange={tab => setActiveTab(tab as typeof activeTab)} onLogout={onLogout} items={[
        {id:'overview',label:'Inicio',icon:LayoutDashboard},
        {id:'assignments',label:'Tareas',icon:Plus},
        {id:'reviews',label:'Revisar Fotos',icon:Camera,badge:state.submissions.filter(s => !state.grades.some(g => g.assignmentId === s.assignmentId && g.studentId === s.studentId && g.grade)).length},
        {id:'matrix',label:'Planilla Rápida',icon:CheckCircle2},
        {id:'excel',label:'Conectar Excel',icon:FileSpreadsheet},
        {id:'ranking',label:'Podio & Ranking',icon:Trophy},
        {id:'rewards',label:'Premios Top 3',icon:Award},
      ]}/>
      <main id="main-content" className="teacher-main">
        <div className="page-topline"><span>Mi aula <span>/</span> {{overview:'Inicio',assignments:'Tareas',reviews:'Revisar fotos',matrix:'Planilla rápida',excel:'Conectar Excel',ranking:'Ranking',rewards:'Premios'}[activeTab]}</span><span className="term-label">Espacio docente</span></div>
        {activeTab === 'overview' ? <TeacherOverview state={state} navigate={setActiveTab} review={id => {setSelectedReviewAsgId(id); setActiveTab('reviews');}}/> : <div className="page-heading"><span className="eyebrow">MI ESPACIO DOCENTE</span><h1>{{assignments:'Ideas que se convierten en aprendizaje.',reviews:'Una mirada a su esfuerzo.',matrix:'Cada avance, registrado.',excel:'Tus notas, siempre al día.',ranking:'Celebremos el progreso.',rewards:'Motivos para seguir aprendiendo.'}[activeTab]}</h1><p>{{assignments:'Crea y organiza las actividades de tu aula.',reviews:'Revisa sus entregas y acompaña con comentarios.',matrix:'Califica directamente y consulta el avance del aula.',excel:'Descarga tu plantilla e importa las calificaciones.',ranking:'Reconoce el esfuerzo de tus estudiantes.',rewards:'Configura los reconocimientos para los primeros puestos.'}[activeTab]}</p></div>}
        {/* TAB 1: CONECTAR CON EXCEL */}
        {activeTab === 'excel' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Step 1: Download */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-1">
                    <Download className="w-4 h-4" />
                    <span>Paso 1: Descargar Plantilla</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Descargar Registro Escolar en Excel</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Descarga el archivo <span className="text-slate-900 font-mono">.xlsx</span> generado automáticamente con los nombres y códigos de tus estudiantes y las columnas de cada tarea asignada.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Formato compatible con Excel y Sheets</span>
                  <button
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar .XLSX</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
                    <Upload className="w-4 h-4" />
                    <span>Paso 2: Subir y Sincronizar</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Subir Archivo Excel con las Notas</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Sube tu Excel con las notas anotadas (AD, A, B, C o números 10, 8, 6, 4). Las celdas vacías conservan las notas actuales. Escribe BORRAR para quitar una nota. Si hay errores, no se aplica ningún cambio.
                  </p>
                </div>
                <div className="mt-4">
                  <label className="flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-3.5 cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Seleccionar archivo Excel (.xlsx / .csv)</span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Notification & Confirm */}
            {excelMessage && (
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  excelMessage.type === 'success'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/60 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">{excelMessage.text}</p>
                    {excelPreviewRows && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Filas preparadas. Confirma para sincronizar en tiempo real con todos los estudiantes.
                      </p>
                    )}
                  </div>
                </div>

                {excelBase64Data && (
                  <button
                    onClick={handleConfirmExcelSync}
                    disabled={excelLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-xs shrink-0 disabled:opacity-50"
                  >
                    {excelLoading ? 'Sincronizando...' : 'Confirmar y Guardar Notas'}
                  </button>
                )}
              </div>
            )}

            {/* Scale reminder banner */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Escala Oficial Reconocida en Excel:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 border border-emerald-900/40 rounded-lg">
                  <span className="font-bold text-emerald-700 block">AD (10 puntos)</span>
                  <span className="text-[11px] text-slate-500">Logro Destacado</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-blue-900/40 rounded-lg">
                  <span className="font-bold text-blue-700 block">A (8 puntos)</span>
                  <span className="text-[11px] text-slate-500">Logro Esperado</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-amber-200/40 rounded-lg">
                  <span className="font-bold text-amber-700 block">B (6 puntos)</span>
                  <span className="text-[11px] text-slate-500">En Proceso</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-rose-900/40 rounded-lg">
                  <span className="font-bold text-rose-400 block">C (4 puntos)</span>
                  <span className="text-[11px] text-slate-500">En Inicio</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-500 block">Vacío (0 puntos)</span>
                  <span className="text-[11px] text-slate-500">Sin calificar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLANILLA RÁPIDA (MATRIZ EN VIVO) */}
        {activeTab === 'matrix' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Planilla de Calificaciones en Vivo (Matriz Directa)
                </h3>
                <p className="text-xs text-slate-500">
                  Haz clic en la nota de cualquier estudiante para modificarla al vuelo. Se guarda al instante en la base central.
                </p>
              </div>
              <div className="text-[11px] text-slate-500">
                Puntajes: <span className="text-emerald-700 font-bold">AD = 10 pts</span> ·{' '}
                <span className="text-blue-700 font-bold">A = 8 pts</span> ·{' '}
                <span className="text-amber-700 font-bold">B = 6 pts</span> ·{' '}
                <span className="text-rose-400 font-bold">C = 4 pts</span> ·{' '}
                <span className="text-slate-500">Sin nota = 0 pts</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-16">Código</th>
                    <th className="px-4 py-3 min-w-[180px]">Estudiante</th>
                    {state.assignments.map((asg) => (
                      <th key={asg.id} className="px-3 py-3 text-center min-w-[130px]">
                        <div className="text-slate-700 line-clamp-1">{asg.title}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{asg.subject}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Puntos Totales</th>
                    <th className="px-4 py-3 text-center">Puesto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.students.map((student) => {
                    const stScore = scores.find((s) => s.student.id === student.id);
                    const rank = stScore?.rank;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {student.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={student.avatar}
                              alt={student.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-300"
                            />
                            <span className="font-semibold text-slate-700">{student.name}</span>
                          </div>
                        </td>

                        {/* Grade Dropdowns */}
                        {state.assignments.map((asg) => {
                          const gradeRec = state.grades.find(
                            (g) => g.assignmentId === asg.id && g.studentId === student.id
                          );
                          const submission = state.submissions.find(
                            (s) => s.assignmentId === asg.id && s.studentId === student.id
                          );
                          const currentGrade = gradeRec?.grade;

                          return (
                            <td key={asg.id} className="px-2 py-2 text-center">
                              <div className="inline-flex flex-col items-center">
                                <select
                                  aria-label={`Nota de ${student.name} en ${asg.title}`}
                                  value={currentGrade || ''}
                                  onChange={(e) =>
                                    handleSetGrade(
                                      asg.id,
                                      student.id,
                                      (e.target.value as GradeType) || null
                                    )
                                  }
                                  className={`px-2 py-1 text-xs font-bold rounded-md border focus:outline-hidden cursor-pointer ${
                                    currentGrade === 'AD'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-700'
                                      : currentGrade === 'A'
                                      ? 'bg-blue-50 text-blue-700 border-blue-700'
                                      : currentGrade === 'B'
                                      ? 'bg-amber-50 text-amber-800 border-amber-700'
                                      : currentGrade === 'C'
                                      ? 'bg-rose-50 text-rose-700 border-rose-700'
                                      : 'bg-slate-50 text-slate-500 border-slate-750 hover:border-slate-600'
                                  }`}
                                >
                                  <option value="">(Sin nota - 0 pts)</option>
                                  <option value="AD">AD (10 pts)</option>
                                  <option value="A">A (8 pts)</option>
                                  <option value="B">B (6 pts)</option>
                                  <option value="C">C (4 pts)</option>
                                </select>

                                {submission && (
                                  <button
                                    onClick={() =>
                                      setLightboxData({
                                        url: submission.photoUrl,
                                        title: `${student.name} - ${asg.title}`,
                                        studentName: student.name,
                                        submittedAt: submission.submittedAt,
                                        comment: submission.comment,
                                      })
                                    }
                                    title="Ver foto de la tarea"
                                    className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 mt-0.5"
                                  >
                                    <Camera className="w-2.5 h-2.5" />
                                    <span>Ver foto</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                          {stScore?.totalPoints || 0} pts
                        </td>

                        <td className="px-4 py-3 text-center">
                          {rank === 1 ? (
                            <span className="font-bold text-amber-700">🥇 #1</span>
                          ) : rank === 2 ? (
                            <span className="font-bold text-slate-600">🥈 #2</span>
                          ) : rank === 3 ? (
                            <span className="font-bold text-amber-500">🥉 #3</span>
                          ) : (
                            <span className="text-slate-500 font-mono">#{rank}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REVISIÓN DE FOTOS DE TAREAS */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="teacher-review-select" className="text-xs font-semibold text-slate-600 block">
                  Filtrar por Tarea:
                </label>
                <select
                  id="teacher-review-select"
                  value={selectedReviewAsgId}
                  onChange={(e) => setSelectedReviewAsgId(e.target.value)}
                  className="mt-1 w-full min-w-0 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                >
                  {state.assignments.map((asg) => (
                    <option key={asg.id} value={asg.id}>
                      {asg.title} ({asg.subject}) · Entrega: {asg.dueDate}
                    </option>
                  ))}
                </select>
              </div>

              {currentReviewAsg && (
                <div className="text-xs text-slate-500 max-w-md">
                  <span className="font-semibold text-slate-700">{currentReviewAsg.title}: </span>
                  {currentReviewAsg.description}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {state.students.map((student) => {
                const submission = state.submissions.find(
                  (s) => s.assignmentId === selectedReviewAsgId && s.studentId === student.id
                );
                const gradeRec = state.grades.find(
                  (g) => g.assignmentId === selectedReviewAsgId && g.studentId === student.id
                );
                const currentGrade = gradeRec?.grade;
                const gradeInfo = getGradeLabel(currentGrade);
                const inputKey = `${selectedReviewAsgId}_${student.id}`;

                return (
                  <div
                    key={student.id}
                    className={`bg-white border rounded-xl p-5 flex flex-col justify-between ${
                      submission ? 'border-slate-200' : 'border-slate-850 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={student.avatar}
                            alt={student.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-300"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{student.name}</h4>
                            <span className="text-xs text-slate-500 font-mono">{student.code}</span>
                          </div>
                        </div>

                        {currentGrade ? (
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${gradeInfo.badgeClass}`}>
                            {gradeInfo.code} ({gradeInfo.points} pts)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Sin calificar (0 pts)</span>
                        )}
                      </div>

                      {submission ? (
                        <div className="space-y-3">
                          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-black h-48">
                            <HomeworkPhoto
                              src={submission.photoUrl}
                              alt={`Tarea de ${student.name}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <button
                              onClick={() =>
                                setLightboxData({
                                  url: submission.photoUrl,
                                  title: `${currentReviewAsg?.title} - ${student.name}`,
                                  studentName: student.name,
                                  submittedAt: submission.submittedAt,
                                  comment: submission.comment,
                                })
                              }
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Ampliar y Examinar Foto</span>
                            </button>
                          </div>

                          {submission.comment && (
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">Nota del alumno: </span>
                              {submission.comment}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
                          <Camera className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <span>El alumno aún no ha enviado la foto de esta tarea.</span>
                        </div>
                      )}
                    </div>

                    {/* Grading row */}
                    <div className="mt-4 pt-3 border-t border-slate-850 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Calificar Tarea:
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'AD')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'AD'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          AD <span className="text-[10px] block font-normal">+10</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'A')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'A'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-50/60 hover:bg-blue-100 text-blue-700 border-blue-200'
                          }`}
                        >
                          A <span className="text-[10px] block font-normal">+8</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'B')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'B'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-amber-50/60 hover:bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          B <span className="text-[10px] block font-normal">+6</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'C')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'C'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-rose-50/60 hover:bg-rose-100 text-rose-700 border-rose-200'
                          }`}
                        >
                          C <span className="text-[10px] block font-normal">+4</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, null)}
                          className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors border ${
                            !currentGrade
                              ? 'bg-slate-100 text-slate-900 border-slate-300'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          0 pts
                        </button>
                      </div>

                      <div className="flex gap-1.5 mt-2">
                        <input
                          type="text"
                          placeholder="Retroalimentación al estudiante..."
                          value={feedbackInputs[inputKey] ?? (gradeRec?.feedback || '')}
                          onChange={(e) =>
                            setFeedbackInputs((prev) => ({ ...prev, [inputKey]: e.target.value }))
                          }
                          className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={() =>
                            handleSetGrade(
                              selectedReviewAsgId,
                              student.id,
                              currentGrade || null,
                              feedbackInputs[inputKey]
                            )
                          }
                          title="Guardar comentario"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-lg text-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PODIO & RANKING EN VIVO */}
        {activeTab === 'ranking' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Podio de Honor Actual (Top 3 Recompensado)
              </h3>
              <p className="text-xs text-slate-500">
                Así se calcula el ranking automáticamente cada vez que subes notas desde Excel o calificas fotos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {scores[1] && scores[1].totalPoints > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between order-2 md:order-1">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-slate-500" />
                        2º Lugar · Plata
                      </span>
                      <span className="font-mono">#2</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar src={scores[1].student.avatar} alt={scores[1].student.name} className="w-12 h-12 rounded-full object-cover border border-slate-300" />
                      <div>
                        <h4 className="font-bold text-slate-900">{scores[1].student.name}</h4>
                        <span className="text-xs text-slate-500">{scores[1].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs">
                      <div className="text-slate-500">Puntaje Acumulado</div>
                      <div className="text-xl font-bold font-mono text-slate-900">{scores[1].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Premio Asignado:</div>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">{state.rewards.secondPlace}</p>
                  </div>
                </div>
              )}

              {scores[0] && scores[0].totalPoints > 0 && (
                <div className="bg-white border-2 border-amber-400/80 rounded-xl p-6 flex flex-col justify-between order-1 md:order-2 shadow-lg">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-bold text-amber-700">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-700" />
                        1º Lugar · Oro
                      </span>
                      <span className="bg-amber-400/20 text-amber-800 border border-amber-400/40 px-2 py-0.5 rounded font-mono">LÍDER</span>
                    </div>
                    <div className="flex items-center gap-3.5 mb-3">
                      <Avatar src={scores[0].student.avatar} alt={scores[0].student.name} className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{scores[0].student.name}</h4>
                        <span className="text-xs text-slate-500">{scores[0].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-amber-200/40 rounded-lg text-xs">
                      <div className="text-amber-700">Puntaje Máximo</div>
                      <div className="text-2xl font-bold font-mono text-amber-200">{scores[0].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-[11px] font-bold text-amber-700 uppercase mb-1">Gran Premio Oficial:</div>
                    <p className="text-xs font-semibold text-amber-900 bg-amber-50/40 p-2.5 rounded-lg border border-amber-200/60">🏆 {state.rewards.firstPlace}</p>
                  </div>
                </div>
              )}

              {scores[2] && scores[2].totalPoints > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between order-3">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-amber-500">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-amber-600" />
                        3º Lugar · Bronce
                      </span>
                      <span className="font-mono">#3</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar src={scores[2].student.avatar} alt={scores[2].student.name} className="w-12 h-12 rounded-full object-cover border border-slate-300" />
                      <div>
                        <h4 className="font-bold text-slate-900">{scores[2].student.name}</h4>
                        <span className="text-xs text-slate-500">{scores[2].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs">
                      <div className="text-slate-500">Puntaje Acumulado</div>
                      <div className="text-xl font-bold font-mono text-slate-900">{scores[2].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Premio Asignado:</div>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">{state.rewards.thirdPlace}</p>
                  </div>
                </div>
              )}
            </div>

            {/* General table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-center w-14">Puesto</th>
                    <th className="px-4 py-3">Estudiante</th>
                    <th className="px-4 py-3 text-center">AD (10)</th>
                    <th className="px-4 py-3 text-center">A (8)</th>
                    <th className="px-4 py-3 text-center">B (6)</th>
                    <th className="px-4 py-3 text-center">C (4)</th>
                    <th className="px-4 py-3 text-right">Puntaje Total</th>
                    <th className="px-4 py-3">Estado Recompensa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {scores.map((sc) => (
                    <tr key={sc.student.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-center font-bold font-mono text-slate-500">#{sc.rank}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{sc.student.name}</td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-700">{sc.gradesCount.AD}</td>
                      <td className="px-4 py-3 text-center font-mono text-blue-700">{sc.gradesCount.A}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-700">{sc.gradesCount.B}</td>
                      <td className="px-4 py-3 text-center font-mono text-rose-400">{sc.gradesCount.C}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 text-sm">{sc.totalPoints} pts</td>
                      <td className="px-4 py-3 text-[11px]">
                        {sc.rank === 1 ? '🥇 1º Oro' : sc.rank === 2 ? '🥈 2º Plata' : sc.rank === 3 ? '🥉 3º Bronce' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ASIGNACIONES DE TAREAS */}
        {activeTab === 'assignments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-1">
              <h3 className="text-base font-bold text-slate-900 mb-3">Crear Nueva Asignación</h3>
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Título:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Problemas de Porcentajes"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Materia:
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="Matemáticas">Matemáticas</option>
                    <option value="Comunicación">Comunicación</option>
                    <option value="Ciencia y Tecnología">Ciencia y Tecnología</option>
                    <option value="Ciencias Sociales">Ciencias Sociales</option>
                    <option value="Inglés">Inglés</option>
                    <option value="Arte y Cultura">Arte y Cultura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha de Entrega:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Instrucciones para la foto:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detalles sobre los ejercicios y cómo tomar la foto..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingAsg || !newTitle.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingAsg ? 'Creando...' : 'Publicar Tarea'}</span>
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Tareas Registradas ({state.assignments.length})</h3>
              <div className="space-y-3">
                {state.assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="p-4 border border-slate-850 bg-slate-50/50 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase">{asg.subject}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-500">Entrega: {asg.dueDate}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{asg.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{asg.description}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                      className="p-2 text-rose-400 hover:text-rose-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PREMIOS DEL TOP 3 */}
        {activeTab === 'rewards' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl mx-auto space-y-5">
            <div>
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                Recompensas al Esfuerzo Escolar
              </div>
              <h3 className="text-lg font-bold text-slate-900">Personalizar Premios del Top 3</h3>
              <p className="text-xs text-slate-500 mt-1">
                Estos premios se actualizan automáticamente en el Ranking y en la App del Estudiante.
              </p>
            </div>

            <form onSubmit={handleSaveRewards} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-amber-200/50 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-800">
                  🥇 1º Lugar (Gran Premio de Oro):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.firstPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, firstPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-slate-600">
                  🥈 2º Lugar (Premio Destacado de Plata):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.secondPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, secondPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-amber-200/30 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-700">
                  🥉 3º Lugar (Premio al Esfuerzo de Bronce):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.thirdPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, thirdPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {rewardsSavedMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>¡Premios actualizados y reflejados en tiempo real para todos los estudiantes!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingRewards}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
              >
                {isSavingRewards ? 'Guardando...' : 'Guardar y Publicar Premios'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Lightbox for student homework photos */}
      {lightboxData && (
        <PhotoLightbox
          photoUrl={lightboxData.url}
          title={lightboxData.title}
          studentName={lightboxData.studentName}
          submittedAt={lightboxData.submittedAt}
          comment={lightboxData.comment}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
};
