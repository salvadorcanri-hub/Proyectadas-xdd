import React from 'react';
import { BookOpen, FileSpreadsheet, ArrowRight, ExternalLink, Sparkles, CheckCircle2, ShieldCheck, Camera } from 'lucide-react';
import { AppState } from '../types';

interface AppLauncherProps {
  state: AppState;
  onOpenApp: (app: 'student' | 'teacher') => void;
}

export const AppLauncher: React.FC<AppLauncherProps> = ({ state, onOpenApp }) => {
  const currentUrl = window.location.origin + window.location.pathname;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-bold text-base shadow-md">
            EP
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white block">EduPuntos Suite</span>
            <span className="text-xs text-slate-400 block">Dos Aplicaciones Conectadas en Tiempo Real</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-full font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          <span>Base de Datos Centralizada Activa</span>
        </div>
      </header>

      {/* Main Content: 2 Distinct Apps Showcase */}
      <main className="max-w-6xl mx-auto w-full my-auto py-10 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Selecciona la Aplicación a Utilizar
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Cada usuario cuenta con su propia aplicación independiente y segura. La información fluye automáticamente entre ambas mediante sincronización centralizada.
          </p>
        </div>

        {/* The Two Distinct Apps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* APP 1: ESTUDIANTES */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-indigo-500 transition-all shadow-xl group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 border border-indigo-800 px-2.5 py-1 rounded-full uppercase">
                  App para Celular & PC
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  EduPuntos Estudiantes
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Aplicación exclusiva para el alumnado. Diseñada para incentivar la entrega de deberes escolares mediante fotos de los cuadernos, consulta de notas oficiales y seguimiento del Top 3 de premios.
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Subida de fotos de cuadernos con cámara de celular o archivo</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Notas oficiales directas del profesor (AD: 10, A: 8, B: 6, C: 4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Ranking del aula en vivo con podio y premios escolares</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => onOpenApp('student')}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg"
              >
                <span>Abrir App del Estudiante</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={`${currentUrl}#estudiante`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto p-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-850 flex items-center justify-center text-xs gap-1.5 transition-colors"
                title="Abrir en nueva pestaña para probar dos dispositivos"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="sm:hidden">Abrir en otra pestaña</span>
              </a>
            </div>
          </div>

          {/* APP 2: PROFESORES */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-xl group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                  App del Docente
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  EduPuntos Docente & Excel
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Sistema de gestión exclusivo para profesores. Conecta tus anotaciones de Microsoft Excel o Google Sheets con la base central, califica fotos de tareas y administra asignaciones.
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sincronización directa con hojas de cálculo Excel (.xlsx / .csv)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Planilla rápida en vivo y revisión de fotos con zoom</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Configuración de los 3 premios escolares para el Top 3</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => onOpenApp('teacher')}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg"
              >
                <span>Abrir App del Docente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={`${currentUrl}#docente`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto p-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-850 flex items-center justify-center text-xs gap-1.5 transition-colors"
                title="Abrir en nueva pestaña para probar dos dispositivos"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="sm:hidden">Abrir en otra pestaña</span>
              </a>
            </div>
          </div>
        </div>

        {/* Live sync description banner */}
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-center text-center text-xs text-slate-400">
          <span>
            💡 <strong>Sincronización en Tiempo Real:</strong> Puedes abrir la App del Docente en una ventana y la App del Estudiante en otra (o en tu teléfono). Cualquier nota que el profesor suba en Excel o califique se reflejará al instante en el móvil del estudiante.
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full py-4 border-t border-slate-800 text-center text-xs text-slate-500">
        EduPuntos Suite · Dos aplicaciones conectadas por una base de datos centralizada
      </footer>
    </div>
  );
};
