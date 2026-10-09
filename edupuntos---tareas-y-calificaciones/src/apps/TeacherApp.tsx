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
  ExternalLink,
  RefreshCw,
  Trophy,
  Medal,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { AppState, Assignment, GradeType, RewardsConfig } from '../types';
import { calculateStudentScores, getGradeLabel } from '../utils/scoreCalculator';
import {
  updateGrade,
  createAssignment,
  deleteAssignment,
  importExcelBase64,
  updateRewardsConfig,
  resetDemoData,
} from '../services/api';
import { PhotoLightbox } from '../components/PhotoLightbox';

interface TeacherAppProps {
  state: AppState;
  onStateUpdate: (newState: AppState) => void;
  onOpenStudentApp: () => void;
}

export const TeacherApp: React.FC<TeacherAppProps> = ({
  state,
  onStateUpdate,
  onOpenStudentApp,
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'matrix' | 'reviews' | 'ranking' | 'assignments' | 'rewards'>('excel');

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

  // Demo reset
  const [isResetting, setIsResetting] = useState(false);

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

        let binary = '';
        for (let i = 0; i < data.byteLength; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);

        setExcelPreviewRows(rows.slice(0, 10));
        setExcelBase64Data(base64);
        setExcelMessage({
          text: `Archivo "${file.name}" cargado (${rows.length - 1} filas detectadas). Haz clic en Sincronizar para aplicar a los estudiantes.`,
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

  const handleReset = async () => {
    if (!window.confirm('¿Restablecer datos escolares de demostración?')) return;
    setIsResetting(true);
    try {
      const reset = await resetDemoData();
      onStateUpdate(reset);
    } finally {
      setIsResetting(false);
    }
  };

  const scores = calculateStudentScores(state);
  const currentReviewAsg = state.assignments.find((a) => a.id === selectedReviewAsgId) || state.assignments[0];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Dedicated Teacher Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Dedicated Teacher Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap block">
                EduPuntos Docente
              </span>
              <span className="text-[10px] text-emerald-400 font-mono tracking-wide block">
                SISTEMA PARA PROFESORES & EXCEL
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('excel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'excel'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Conectar Excel</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'matrix'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Planilla Rápida</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'reviews'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Revisar Fotos ({state.submissions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'ranking'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Podio & Ranking</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'assignments'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tareas</span>
            </button>

            <button
              onClick={() => setActiveTab('rewards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'rewards'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Premios Top 3</span>
            </button>
          </nav>

          {/* Zone 3: Switch to Student App & Reset */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              disabled={isResetting}
              title="Restablecer datos de prueba"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            </button>

            {/* Direct Switch to Student App */}
            <button
              onClick={onOpenStudentApp}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shadow-xs"
              title="Ver cómo lo ve el estudiante"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Abrir App Estudiantes</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome & Quick Summary Banner */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wide">
              <span>Panel de Calificaciones para Docentes</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">Base Centralizada en Tiempo Real</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Registro Escolar y Control de Tareas
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Actualiza las notas desde tus hojas de Excel, califica en la planilla rápida o revisa las fotos enviadas por los estudiantes. Todo se refleja automáticamente en el ranking escolar.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Alumnos</span>
              <span className="text-lg font-bold font-mono text-white">{state.students.length}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Tareas</span>
              <span className="text-lg font-bold font-mono text-white">{state.assignments.length}</span>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-800 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-emerald-400 block uppercase">Fotos</span>
              <span className="text-lg font-bold font-mono text-emerald-300">{state.submissions.length}</span>
            </div>
          </div>
        </div>

        {/* TAB 1: CONECTAR CON EXCEL */}
        {activeTab === 'excel' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Step 1: Download */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                    <Download className="w-4 h-4" />
                    <span>Paso 1: Descargar Plantilla</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Descargar Registro Escolar en Excel</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Descarga el archivo <span className="text-white font-mono">.xlsx</span> generado automáticamente con los nombres y códigos de tus estudiantes y las columnas de cada tarea asignada.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
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
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                    <Upload className="w-4 h-4" />
                    <span>Paso 2: Subir y Sincronizar</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Subir Archivo Excel con las Notas</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Sube tu Excel con las notas anotadas (AD, A, B, C o números 10, 8, 6, 4). Los alumnos sin nota o sin presentar quedarán en 0 puntos y no se les mostrará nota.
                  </p>
                </div>
                <div className="mt-4">
                  <label className="flex items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-lg p-3.5 cursor-pointer bg-slate-900/60 hover:bg-slate-900 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
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
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-800 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">{excelMessage.text}</p>
                    {excelPreviewRows && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
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
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Escala Oficial Reconocida en Excel:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-2.5 bg-slate-900 border border-emerald-900/40 rounded-lg">
                  <span className="font-bold text-emerald-400 block">AD (10 puntos)</span>
                  <span className="text-[11px] text-slate-400">Logro Destacado</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-blue-900/40 rounded-lg">
                  <span className="font-bold text-blue-400 block">A (8 puntos)</span>
                  <span className="text-[11px] text-slate-400">Logro Esperado</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-amber-900/40 rounded-lg">
                  <span className="font-bold text-amber-400 block">B (6 puntos)</span>
                  <span className="text-[11px] text-slate-400">En Proceso</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-rose-900/40 rounded-lg">
                  <span className="font-bold text-rose-400 block">C (4 puntos)</span>
                  <span className="text-[11px] text-slate-400">En Inicio</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="font-bold text-slate-400 block">Vacío (0 puntos)</span>
                  <span className="text-[11px] text-slate-500">Sin nota / Sin presentar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLANILLA RÁPIDA (MATRIZ EN VIVO) */}
        {activeTab === 'matrix' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">
                  Planilla de Calificaciones en Vivo (Matriz Directa)
                </h3>
                <p className="text-xs text-slate-400">
                  Haz clic en la nota de cualquier estudiante para modificarla al vuelo. Se guarda al instante en la base central.
                </p>
              </div>
              <div className="text-[11px] text-slate-400">
                Puntajes: <span className="text-emerald-400 font-bold">AD = 10 pts</span> ·{' '}
                <span className="text-blue-400 font-bold">A = 8 pts</span> ·{' '}
                <span className="text-amber-400 font-bold">B = 6 pts</span> ·{' '}
                <span className="text-rose-400 font-bold">C = 4 pts</span> ·{' '}
                <span className="text-slate-500">Sin nota = 0 pts</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-16">Código</th>
                    <th className="px-4 py-3 min-w-[180px]">Estudiante</th>
                    {state.assignments.map((asg) => (
                      <th key={asg.id} className="px-3 py-3 text-center min-w-[130px]">
                        <div className="text-slate-200 line-clamp-1">{asg.title}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{asg.subject}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Puntos Totales</th>
                    <th className="px-4 py-3 text-center">Puesto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {state.students.map((student) => {
                    const stScore = scores.find((s) => s.student.id === student.id);
                    const rank = stScore?.rank;

                    return (
                      <tr key={student.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {student.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={student.avatar}
                              alt={student.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-700"
                            />
                            <span className="font-semibold text-slate-200">{student.name}</span>
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
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                      : currentGrade === 'A'
                                      ? 'bg-blue-950 text-blue-300 border-blue-700'
                                      : currentGrade === 'B'
                                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                                      : currentGrade === 'C'
                                      ? 'bg-rose-950 text-rose-300 border-rose-700'
                                      : 'bg-slate-900 text-slate-500 border-slate-750 hover:border-slate-600'
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
                                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                  >
                                    <Camera className="w-2.5 h-2.5" />
                                    <span>Ver foto</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-4 py-3 text-right font-mono font-bold text-white text-sm tabular-nums">
                          {stScore?.totalPoints || 0} pts
                        </td>

                        <td className="px-4 py-3 text-center">
                          {rank === 1 ? (
                            <span className="font-bold text-amber-400">🥇 #1</span>
                          ) : rank === 2 ? (
                            <span className="font-bold text-slate-300">🥈 #2</span>
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label htmlFor="teacher-review-select" className="text-xs font-semibold text-slate-300 block">
                  Filtrar por Tarea:
                </label>
                <select
                  id="teacher-review-select"
                  value={selectedReviewAsgId}
                  onChange={(e) => setSelectedReviewAsgId(e.target.value)}
                  className="mt-1 text-xs font-semibold text-white bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                >
                  {state.assignments.map((asg) => (
                    <option key={asg.id} value={asg.id}>
                      {asg.title} ({asg.subject}) · Entrega: {asg.dueDate}
                    </option>
                  ))}
                </select>
              </div>

              {currentReviewAsg && (
                <div className="text-xs text-slate-400 max-w-md">
                  <span className="font-semibold text-slate-200">{currentReviewAsg.title}: </span>
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
                    className={`bg-slate-950 border rounded-xl p-5 flex flex-col justify-between ${
                      submission ? 'border-slate-800' : 'border-slate-850 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar}
                            alt={student.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-white">{student.name}</h4>
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
                          <div className="relative group rounded-lg overflow-hidden border border-slate-800 bg-black h-48">
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
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Ampliar y Examinar Foto</span>
                            </button>
                          </div>

                          {submission.comment && (
                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
                              <span className="font-semibold text-slate-200">Nota del alumno: </span>
                              {submission.comment}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                          <Camera className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <span>El alumno aún no ha enviado la foto de esta tarea.</span>
                        </div>
                      )}
                    </div>

                    {/* Grading row */}
                    <div className="mt-4 pt-3 border-t border-slate-850 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                        Calificar Tarea:
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'AD')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'AD'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          AD <span className="text-[10px] block font-normal">+10</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'A')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'A'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-950/60 hover:bg-blue-900 text-blue-300 border-blue-800'
                          }`}
                        >
                          A <span className="text-[10px] block font-normal">+8</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'B')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'B'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800'
                          }`}
                        >
                          B <span className="text-[10px] block font-normal">+6</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, 'C')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors border ${
                            currentGrade === 'C'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800'
                          }`}
                        >
                          C <span className="text-[10px] block font-normal">+4</span>
                        </button>
                        <button
                          onClick={() => handleSetGrade(selectedReviewAsgId, student.id, null)}
                          className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors border ${
                            !currentGrade
                              ? 'bg-slate-800 text-white border-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
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
                          className="flex-1 text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
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
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <h3 className="text-base font-bold text-white mb-1">
                Podio de Honor Actual (Top 3 Recompensado)
              </h3>
              <p className="text-xs text-slate-400">
                Así se calcula el ranking automáticamente cada vez que subes notas desde Excel o calificas fotos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {scores[1] && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between order-2 md:order-1">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-slate-400" />
                        2º Lugar · Plata
                      </span>
                      <span className="font-mono">#2</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <img src={scores[1].student.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                      <div>
                        <h4 className="font-bold text-white">{scores[1].student.name}</h4>
                        <span className="text-xs text-slate-500">{scores[1].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg text-xs">
                      <div className="text-slate-400">Puntaje Acumulado</div>
                      <div className="text-xl font-bold font-mono text-white">{scores[1].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Premio Asignado:</div>
                    <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">{state.rewards.secondPlace}</p>
                  </div>
                </div>
              )}

              {scores[0] && (
                <div className="bg-slate-950 border-2 border-amber-400/80 rounded-xl p-6 flex flex-col justify-between order-1 md:order-2 shadow-lg">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-bold text-amber-400">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        1º Lugar · Oro
                      </span>
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded font-mono">LÍDER</span>
                    </div>
                    <div className="flex items-center gap-3.5 mb-3">
                      <img src={scores[0].student.avatar} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />
                      <div>
                        <h4 className="text-base font-bold text-white">{scores[0].student.name}</h4>
                        <span className="text-xs text-slate-400">{scores[0].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-amber-900/40 rounded-lg text-xs">
                      <div className="text-amber-400">Puntaje Máximo</div>
                      <div className="text-2xl font-bold font-mono text-amber-200">{scores[0].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <div className="text-[11px] font-bold text-amber-400 uppercase mb-1">Gran Premio Oficial:</div>
                    <p className="text-xs font-semibold text-amber-100 bg-amber-950/40 p-2.5 rounded-lg border border-amber-900/60">🏆 {state.rewards.firstPlace}</p>
                  </div>
                </div>
              )}

              {scores[2] && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between order-3">
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-amber-500">
                      <span className="flex items-center gap-1">
                        <Medal className="w-4 h-4 text-amber-600" />
                        3º Lugar · Bronce
                      </span>
                      <span className="font-mono">#3</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <img src={scores[2].student.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                      <div>
                        <h4 className="font-bold text-white">{scores[2].student.name}</h4>
                        <span className="text-xs text-slate-500">{scores[2].student.code}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg text-xs">
                      <div className="text-slate-400">Puntaje Acumulado</div>
                      <div className="text-xl font-bold font-mono text-white">{scores[2].totalPoints} pts</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Premio Asignado:</div>
                    <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">{state.rewards.thirdPlace}</p>
                  </div>
                </div>
              )}
            </div>

            {/* General table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
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
                <tbody className="divide-y divide-slate-850">
                  {scores.map((sc) => (
                    <tr key={sc.student.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3 text-center font-bold font-mono text-slate-400">#{sc.rank}</td>
                      <td className="px-4 py-3 font-semibold text-slate-200">{sc.student.name}</td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-400">{sc.gradesCount.AD}</td>
                      <td className="px-4 py-3 text-center font-mono text-blue-400">{sc.gradesCount.A}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-400">{sc.gradesCount.B}</td>
                      <td className="px-4 py-3 text-center font-mono text-rose-400">{sc.gradesCount.C}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-white text-sm">{sc.totalPoints} pts</td>
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 lg:col-span-1">
              <h3 className="text-base font-bold text-white mb-3">Crear Nueva Asignación</h3>
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Título:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Problemas de Porcentajes"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Materia:
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha de Entrega:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Instrucciones para la foto:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detalles sobre los ejercicios y cómo tomar la foto..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
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

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
              <h3 className="text-base font-bold text-white">Tareas Registradas ({state.assignments.length})</h3>
              <div className="space-y-3">
                {state.assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="p-4 border border-slate-850 bg-slate-900/50 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase">{asg.subject}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-400">Entrega: {asg.dueDate}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-0.5">{asg.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{asg.description}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg transition-colors"
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
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-2xl mx-auto space-y-5">
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Recompensas al Esfuerzo Escolar
              </div>
              <h3 className="text-lg font-bold text-white">Personalizar Premios del Top 3</h3>
              <p className="text-xs text-slate-400 mt-1">
                Estos premios se actualizan automáticamente en el Ranking y en la App del Estudiante.
              </p>
            </div>

            <form onSubmit={handleSaveRewards} className="space-y-4">
              <div className="p-4 bg-slate-900 border border-amber-900/50 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-300">
                  🥇 1º Lugar (Gran Premio de Oro):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.firstPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, firstPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  🥈 2º Lugar (Premio Destacado de Plata):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.secondPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, secondPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="p-4 bg-slate-900 border border-amber-900/30 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-400">
                  🥉 3º Lugar (Premio al Esfuerzo de Bronce):
                </label>
                <input
                  type="text"
                  required
                  value={rewardsForm.thirdPlace}
                  onChange={(e) => setRewardsForm({ ...rewardsForm, thirdPlace: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {rewardsSavedMsg && (
                <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
