import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  Camera,
  Award,
  BookOpen,
  Save,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AppState, Assignment, GradeType, RewardsConfig } from '../types';
import { calculateStudentScores, getGradeLabel } from '../utils/scoreCalculator';
import {
  updateGrade,
  createAssignment,
  deleteAssignment,
  importExcelBase64,
  updateRewardsConfig,
} from '../services/api';
import { PhotoLightbox } from './PhotoLightbox';

interface TeacherPortalProps {
  state: AppState;
  onStateUpdate: (newState: AppState) => void;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({ state, onStateUpdate }) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'reviews' | 'assignments' | 'rewards'>('excel');

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

  // Handle grade change directly
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
      confetti({ particleCount: 25, spread: 45 });
    } catch (err: any) {
      alert('Error al calificar: ' + err.message);
    }
  };

  // Excel Download handler
  const handleDownloadExcel = () => {
    window.location.href = '/api/excel-export';
  };

  // Excel File selection & parsing
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelMessage(null);
    setExcelLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Convert array buffer to base64
        let binary = '';
        for (let i = 0; i < data.byteLength; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);

        setExcelPreviewRows(rows.slice(0, 10)); // preview first 10 rows
        setExcelBase64Data(base64);
        setExcelMessage({
          text: `Archivo "${file.name}" cargado (${rows.length - 1} filas detectadas). Haz clic en Sincronizar para aplicar.`,
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
        text: res.message || `¡Éxito! Se actualizaron ${res.updatedCount} calificaciones en tiempo real.`,
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

  // Create Assignment handler
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

  // Delete Assignment handler
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

  const scores = calculateStudentScores(state);
  const currentReviewAsg = state.assignments.find((a) => a.id === selectedReviewAsgId) || state.assignments[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Teacher Portal Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Gestión Docente Centralizada</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Panel del Profesor y Sincronización Excel
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Conecta tus archivos Excel o califica fotos directamente para actualizar el ranking en tiempo real.
          </p>
        </div>

        {/* Quick summary numbers */}
        <div className="flex items-center gap-4 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">Alumnos:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">{state.students.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">Tareas:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">{state.assignments.length}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
            <span className="text-indigo-700 block">Fotos Subidas:</span>
            <span className="font-bold text-indigo-900 font-mono text-sm">{state.submissions.length}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Interactive segmented buttons) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'excel'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Conectar con Excel & Matriz en Vivo</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'reviews'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4 text-indigo-600" />
          <span>Revisión de Fotos de Tareas ({state.submissions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'assignments'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plus className="w-4 h-4 text-slate-700" />
          <span>Asignaciones de Tareas</span>
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'rewards'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4 text-amber-600" />
          <span>Premios Top 3</span>
        </button>
      </div>

      {/* TAB 1: CONECTAR CON EXCEL & MATRIZ EN VIVO */}
      {activeTab === 'excel' && (
        <div className="space-y-6">
          {/* Dual Action: Download Excel & Upload Excel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Download Excel Sheet */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs mb-1">
                  <Download className="w-4 h-4" />
                  <span>Paso 1: Descargar Plantilla Oficial</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Descargar Registro en Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Descarga el archivo Excel oficial con todos tus alumnos y columnas de tareas. Puedes abrirlo en Microsoft Excel o Google Sheets, colocar las notas (AD, A, B, C) y volver a subirlo.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Incluye guía de puntajes y fórmulas</span>
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Excel</span>
                </button>
              </div>
            </div>

            {/* Upload Excel Sheet */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs mb-1">
                  <Upload className="w-4 h-4" />
                  <span>Paso 2: Subir Anotaciones de Excel</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Sincronizar Notas desde Archivo Excel
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Arrastra o selecciona el archivo Excel modificado con tus notas. La app detectará automáticamente las notas (AD, A, B, C) y las reflejará al instante a los estudiantes.
                </p>
              </div>

              <div className="mt-4">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-3 cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Seleccionar archivo .xlsx / .xls</span>
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

          {/* Excel Status / Preview Banner */}
          {excelMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                excelMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {excelMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-semibold">{excelMessage.text}</p>
                  {excelPreviewRows && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Vista previa lista. Pulsa "Confirmar y Sincronizar" para guardar en la base de datos central.
                    </p>
                  )}
                </div>
              </div>

              {excelBase64Data && (
                <button
                  onClick={handleConfirmExcelSync}
                  disabled={excelLoading}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {excelLoading ? 'Procesando...' : 'Confirmar y Sincronizar'}
                </button>
              )}
            </div>
          )}

          {/* SPREADSHEET MATRIX (PLANILLA RÁPIDA EN VIVO) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Planilla Rápida de Notas (Matriz en Tiempo Real)
                </h3>
                <p className="text-xs text-slate-500">
                  Haz clic directamente sobre la celda de cualquier alumno para asignarle o cambiar su nota con 1 toque.
                </p>
              </div>
              <div className="text-[11px] text-slate-500">
                Escala oficial: <span className="font-bold text-emerald-700">AD=10</span> ·{' '}
                <span className="font-bold text-blue-700">A=8</span> ·{' '}
                <span className="font-bold text-amber-700">B=6</span> ·{' '}
                <span className="font-bold text-rose-700">C=4</span> ·{' '}
                <span className="text-slate-400">Vacío=0</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-16">Código</th>
                    <th className="px-4 py-3 min-w-[180px]">Estudiante</th>
                    {state.assignments.map((asg) => (
                      <th key={asg.id} className="px-3 py-3 text-center min-w-[130px]">
                        <div className="line-clamp-1">{asg.title}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{asg.subject}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Puntos</th>
                    <th className="px-4 py-3 text-center">Puesto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.students.map((student) => {
                    const stScore = scores.find((s) => s.student.id === student.id);
                    const rank = stScore?.rank;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                          {student.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={student.avatar}
                              alt={student.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                            <span className="font-semibold text-slate-800">{student.name}</span>
                          </div>
                        </td>

                        {/* Assignment Grade Cells */}
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
                                {/* Interactive Dropdown or Segmented Quick Buttons */}
                                <select
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
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : currentGrade === 'A'
                                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                                      : currentGrade === 'B'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : currentGrade === 'C'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <option value="">(Sin nota - 0 pts)</option>
                                  <option value="AD">AD (10 pts)</option>
                                  <option value="A">A (8 pts)</option>
                                  <option value="B">B (6 pts)</option>
                                  <option value="C">C (4 pts)</option>
                                </select>

                                {/* Photo submission indicator */}
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
                                    title="Ver foto enviada por el alumno"
                                    className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 mt-0.5"
                                  >
                                    <Camera className="w-2.5 h-2.5" />
                                    <span>Ver foto</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Points */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                          {stScore?.totalPoints || 0} pts
                        </td>

                        {/* Rank */}
                        <td className="px-4 py-3 text-center">
                          {rank === 1 ? (
                            <span className="font-bold text-amber-800">🥇 #1</span>
                          ) : rank === 2 ? (
                            <span className="font-bold text-slate-700">🥈 #2</span>
                          ) : rank === 3 ? (
                            <span className="font-bold text-amber-900">🥉 #3</span>
                          ) : (
                            <span className="text-slate-400 font-mono">#{rank}</span>
                          )}
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

      {/* TAB 2: REVISIÓN DE FOTOS DE TAREAS */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Assignment Selector Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="review-asg-filter" className="text-xs font-semibold text-slate-700 block">
                Selecciona la tarea a revisar:
              </label>
              <select
                id="review-asg-filter"
                value={selectedReviewAsgId}
                onChange={(e) => setSelectedReviewAsgId(e.target.value)}
                className="mt-1 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
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

          {/* Submissions Cards */}
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
                  className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between ${
                    submission ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/40 opacity-75'
                  }`}
                >
                  <div>
                    {/* Header: Student Info & Current Grade */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{student.name}</h4>
                          <span className="text-xs text-slate-400 font-mono">{student.code}</span>
                        </div>
                      </div>

                      {/* Current Grade Pill */}
                      {currentGrade ? (
                        <div className="text-right">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${gradeInfo.badgeClass}`}>
                            {gradeInfo.code} ({gradeInfo.points} pts)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin calificar (0 pts)</span>
                      )}
                    </div>

                    {/* Submission Content */}
                    {submission ? (
                      <div className="space-y-3">
                        {/* Photo Thumbnail */}
                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-44">
                          <img
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
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Ampliar y Examinar Foto</span>
                          </button>
                        </div>

                        {/* Student Comment */}
                        {submission.comment && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">Nota del alumno: </span>
                            {submission.comment}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                        <Camera className="w-8 h-8 mx-auto mb-1 opacity-40" />
                        <span>El alumno aún no ha subido la foto de esta tarea.</span>
                        <div className="text-[11px] text-slate-400 mt-1">Puntaje actual: 0 puntos</div>
                      </div>
                    )}
                  </div>

                  {/* Grading Controls */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                      Asignar Calificación Rápida:
                    </div>

                    {/* Grade Buttons */}
                    <div className="grid grid-cols-5 gap-1.5">
                      <button
                        onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'AD')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                          currentGrade === 'AD'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        AD <span className="text-[10px] block font-normal">+10</span>
                      </button>

                      <button
                        onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'A')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                          currentGrade === 'A'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        A <span className="text-[10px] block font-normal">+8</span>
                      </button>

                      <button
                        onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'B')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                          currentGrade === 'B'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        B <span className="text-[10px] block font-normal">+6</span>
                      </button>

                      <button
                        onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'C')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                          currentGrade === 'C'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                        }`}
                      >
                        C <span className="text-[10px] block font-normal">+4</span>
                      </button>

                      <button
                        onClick={() => handleSetGrade(selectedReviewAsgId, student.id, null)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors border ${
                          !currentGrade
                            ? 'bg-slate-700 text-white border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        Limpiar <span className="text-[10px] block opacity-75">0 pts</span>
                      </button>
                    </div>

                    {/* Feedback comment input */}
                    <div className="flex gap-1.5 mt-2">
                      <input
                        type="text"
                        placeholder="Retroalimentación (ej. ¡Muy ordenado!)..."
                        value={feedbackInputs[inputKey] ?? (gradeRec?.feedback || '')}
                        onChange={(e) =>
                          setFeedbackInputs((prev) => ({ ...prev, [inputKey]: e.target.value }))
                        }
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                      />
                      <button
                        onClick={() =>
                          handleSetGrade(
                            selectedReviewAsgId,
                            student.id,
                            currentGrade || 'AD',
                            feedbackInputs[inputKey]
                          )
                        }
                        title="Guardar comentario"
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
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

      {/* TAB 3: ASIGNACIONES DE TAREAS */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Assignment Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs lg:col-span-1">
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs mb-1">
              <Plus className="w-4 h-4" />
              <span>Nueva Asignación</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Crear Tarea Escolar</h3>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título de la Tarea:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ecuaciones de Primer Grado"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Materia / Asignatura:
                </label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-600 bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha Límite de Entrega:
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instrucciones para la foto del cuaderno:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Resolver ejercicios 1 al 8. Tomar foto legible a la luz del día mostrando procedimientos completos."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingAsg || !newTitle.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingAsg ? 'Creando...' : 'Publicar Asignación'}</span>
              </button>
            </form>
          </div>

          {/* Existing Assignments List */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Tareas Vigentes en el Aula ({state.assignments.length})
            </h3>

            <div className="space-y-3">
              {state.assignments.map((asg) => {
                const subCount = state.submissions.filter((s) => s.assignmentId === asg.id).length;
                const gradedCount = state.grades.filter(
                  (g) => g.assignmentId === asg.id && g.grade
                ).length;

                return (
                  <div
                    key={asg.id}
                    className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-indigo-700 uppercase">
                          {asg.subject}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Entrega: {asg.dueDate}</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{asg.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2">{asg.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right text-xs">
                        <div className="font-semibold text-slate-800">
                          {subCount} de {state.students.length} entregas
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {gradedCount} calificadas
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURAR PREMIOS DEL TOP 3 */}
      {activeTab === 'rewards' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs max-w-2xl mx-auto space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Incentivos y Recompensas</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Configurar Premios del Top 3</h3>
            <p className="text-xs text-slate-600 mt-1">
              Personaliza los premios que ganarán los 3 estudiantes con mayor puntaje en el ranking. Los cambios se reflejarán inmediatamente en las vistas de los alumnos y en la exportación de Excel.
            </p>
          </div>

          <form onSubmit={handleSaveRewards} className="space-y-4">
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-amber-950">
                🥇 1º Lugar (Gran Premio de Oro):
              </label>
              <input
                type="text"
                required
                value={rewardsForm.firstPlace}
                onChange={(e) => setRewardsForm({ ...rewardsForm, firstPlace: e.target.value })}
                className="w-full text-xs p-2.5 border border-amber-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                🥈 2º Lugar (Premio Destacado de Plata):
              </label>
              <input
                type="text"
                required
                value={rewardsForm.secondPlace}
                onChange={(e) => setRewardsForm({ ...rewardsForm, secondPlace: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-amber-900">
                🥉 3º Lugar (Premio al Esfuerzo de Bronce):
              </label>
              <input
                type="text"
                required
                value={rewardsForm.thirdPlace}
                onChange={(e) => setRewardsForm({ ...rewardsForm, thirdPlace: e.target.value })}
                className="w-full text-xs p-2.5 border border-amber-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {rewardsSavedMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>¡Premios guardados y actualizados en el ranking escolar!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingRewards}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingRewards ? 'Guardando...' : 'Guardar y Actualizar Premios'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Lightbox for inspecting student homework photos */}
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
