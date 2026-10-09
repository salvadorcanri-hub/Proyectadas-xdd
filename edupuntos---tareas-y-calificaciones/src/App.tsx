/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState } from './types';
import { fetchState, subscribeToRealtimeUpdates } from './services/api';
import { TeacherApp } from './apps/TeacherApp';
import { StudentApp } from './apps/StudentApp';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PRIMARY DEFAULT: App para Profesores primero, según la indicación del usuario
  const [currentApp, setCurrentApp] = useState<'teacher' | 'student'>('teacher');
  const [activeStudentId, setActiveStudentId] = useState<string>('est-1');

  // Handle URL hash changes (#docente, #estudiante)
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#estudiante' || hash === '#alumno') {
        setCurrentApp('student');
      } else {
        // Por defecto entra directamente a la app de profesores
        setCurrentApp('teacher');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Fetch initial state & subscribe to real-time events
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    fetchState()
      .then((data) => {
        setState(data);
        if (data.students.length > 0) {
          setActiveStudentId(data.students[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load state:', err);
        setError('No se pudo conectar con el servidor centralizado.');
        setLoading(false);
      });

    try {
      unsubscribe = subscribeToRealtimeUpdates((newState) => {
        setState(newState);
      });
    } catch (err) {
      console.warn('Real-time connection error:', err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSwitchToStudent = () => {
    setCurrentApp('student');
    window.location.hash = '#estudiante';
  };

  const handleSwitchToTeacher = () => {
    setCurrentApp('teacher');
    window.location.hash = '#docente';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-sm font-semibold">Iniciando EduPuntos Docente...</p>
        <p className="text-xs text-slate-400 mt-1">Conectando base de datos centralizada escolar</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-white">
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-xl max-w-md">
          <h2 className="text-base font-bold mb-2">Error de Conexión</h2>
          <p className="text-xs text-slate-400 mb-4">{error || 'No se pudo cargar el estado'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // 1. APP PARA PROFESORES (Principal / Primero)
  if (currentApp === 'teacher') {
    return (
      <TeacherApp
        state={state}
        onStateUpdate={setState}
        onOpenStudentApp={handleSwitchToStudent}
      />
    );
  }

  // 2. APP PARA ESTUDIANTES (Secundaria / Posterior)
  return (
    <StudentApp
      state={state}
      activeStudentId={activeStudentId}
      onSelectStudent={setActiveStudentId}
      onStateUpdate={setState}
      onOpenTeacherApp={handleSwitchToTeacher}
    />
  );
}
