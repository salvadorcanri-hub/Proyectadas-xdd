import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Medal, Sparkles, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { AppState } from '../types';
import { calculateStudentScores } from '../utils/scoreCalculator';

interface RankingViewProps {
  state: AppState;
  onSelectStudent: (studentId: string) => void;
}

export const RankingView: React.FC<RankingViewProps> = ({ state, onSelectStudent }) => {
  const scores = calculateStudentScores(state);
  const first = scores[0];
  const second = scores[1];
  const third = scores[2];

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  useEffect(() => {
    // Little celebratory burst when ranking loads
    triggerConfetti();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Intro & Rules Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>Año Académico 2026</span>
            <span aria-hidden="true">·</span>
            <span>Tabla de Méritos en Tiempo Real</span>
            <span aria-hidden="true">·</span>
            <span>Sincronizado con Excel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Ranking Oficial y Premios de Excelencia
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Cada tarea fotografiada y evaluada suma puntos en la escala oficial. Solo los 3 mejores estudiantes obtienen los premios al mérito escolar.
          </p>
        </div>

        <button
          onClick={triggerConfetti}
          className="self-start md:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>¡Celebrar Logros!</span>
        </button>
      </div>

      {/* Official Score Scale Banner (Clean, unboxed metadata as per constitution) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Sistema Oficial de Puntajes por Calificación
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
            <div className="text-xs font-bold text-emerald-800">Nota AD</div>
            <div className="text-xl font-bold text-emerald-900 font-mono tabular-nums">10 pts</div>
            <div className="text-[11px] text-emerald-700">Logro Destacado</div>
          </div>
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
            <div className="text-xs font-bold text-blue-800">Nota A</div>
            <div className="text-xl font-bold text-blue-900 font-mono tabular-nums">8 pts</div>
            <div className="text-[11px] text-blue-700">Logro Esperado</div>
          </div>
          <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
            <div className="text-xs font-bold text-amber-800">Nota B</div>
            <div className="text-xl font-bold text-amber-900 font-mono tabular-nums">6 pts</div>
            <div className="text-[11px] text-amber-700">En Proceso</div>
          </div>
          <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-lg">
            <div className="text-xs font-bold text-rose-800">Nota C</div>
            <div className="text-xl font-bold text-rose-900 font-mono tabular-nums">4 pts</div>
            <div className="text-[11px] text-rose-700">En Inicio</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg col-span-2 sm:col-span-1">
            <div className="text-xs font-bold text-slate-600">Sin Presentar</div>
            <div className="text-xl font-bold text-slate-700 font-mono tabular-nums">0 pts</div>
            <div className="text-[11px] text-slate-500">Sin tarea subida</div>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM & REWARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Podio de Ganadores (Top 3 Premiados)</h2>
            <p className="text-xs text-slate-500">
              Premios configurados por el profesor para los 3 puestos de honor actuales.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* 2nd Place (Plata) */}
          {second && (
            <div className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-xs order-2 md:order-1 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Medal className="w-4 h-4 text-slate-400" />
                  <span>2º Lugar · Medalla de Plata</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">#2</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <img
                  src={second.student.avatar}
                  alt={second.student.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-2xs"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{second.student.name}</h3>
                  <p className="text-xs text-slate-500">{second.student.code}</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="text-xs text-slate-500 mb-0.5">Puntos Acumulados</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {second.totalPoints}{' '}
                  <span className="text-xs font-normal text-slate-500">puntos</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {second.assignmentsCompleted} de {second.totalAssignments} tareas entregadas
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Recompensa al Esfuerzo
                </div>
                <p className="text-xs font-medium text-slate-800 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                  {state.rewards.secondPlace}
                </p>
                <button
                  onClick={() => onSelectStudent(second.student.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 py-1.5 transition-colors"
                >
                  <span>Ver tareas de {second.student.name.split(' ')[0]}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 1st Place (Oro) - Focal Anchor */}
          {first && (
            <div className="flex flex-col bg-white border-2 border-amber-300 rounded-xl p-6 shadow-md order-1 md:order-2 relative bg-linear-to-b from-amber-50/40 to-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>1º Lugar · Medalla de Oro</span>
                </div>
                <span className="text-xs font-bold font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  LÍDER
                </span>
              </div>

              <div className="flex items-center gap-3.5 mb-4">
                <img
                  src={first.student.avatar}
                  alt={first.student.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-xs"
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{first.student.name}</h3>
                  <p className="text-xs text-slate-500">{first.student.code}</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-200/70 rounded-lg">
                <div className="text-xs text-amber-800 font-medium mb-0.5">Puntaje Máximo</div>
                <div className="text-3xl font-bold text-amber-950 font-mono tabular-nums">
                  {first.totalPoints}{' '}
                  <span className="text-sm font-normal text-amber-800">puntos</span>
                </div>
                <div className="text-xs text-amber-800 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>{first.assignmentsCompleted} de {first.totalAssignments} tareas entregadas</span>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-amber-200">
                <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wide mb-1">
                  Gran Premio de Excelencia
                </div>
                <p className="text-xs font-semibold text-amber-950 bg-amber-100/70 p-3 rounded-lg border border-amber-200 shadow-2xs">
                  🏆 {state.rewards.firstPlace}
                </p>
                <button
                  onClick={() => onSelectStudent(first.student.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 py-1.5 transition-colors"
                >
                  <span>Ver tareas de {first.student.name.split(' ')[0]}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 3rd Place (Bronce) */}
          {third && (
            <div className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-xs order-3 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <Medal className="w-4 h-4 text-amber-700" />
                  <span>3º Lugar · Medalla de Bronce</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">#3</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <img
                  src={third.student.avatar}
                  alt={third.student.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-200 shadow-2xs"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{third.student.name}</h3>
                  <p className="text-xs text-slate-500">{third.student.code}</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="text-xs text-slate-500 mb-0.5">Puntos Acumulados</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {third.totalPoints}{' '}
                  <span className="text-xs font-normal text-slate-500">puntos</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {third.assignmentsCompleted} de {third.totalAssignments} tareas entregadas
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Recompensa al Mérito
                </div>
                <p className="text-xs font-medium text-slate-800 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                  {state.rewards.thirdPlace}
                </p>
                <button
                  onClick={() => onSelectStudent(third.student.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 py-1.5 transition-colors"
                >
                  <span>Ver tareas de {third.student.name.split(' ')[0]}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tabla General de Estudiantes</h3>
            <p className="text-xs text-slate-500">
              Listado ordenado por puntaje total obtenido en base a las fotos de tareas revisadas.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total matriculados: <span className="font-mono tabular-nums text-slate-800">{scores.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-center w-14">Puesto</th>
                <th className="px-4 py-3">Estudiante</th>
                <th className="px-4 py-3 text-center">Tareas</th>
                <th className="px-4 py-3 text-center">AD (10)</th>
                <th className="px-4 py-3 text-center">A (8)</th>
                <th className="px-4 py-3 text-center">B (6)</th>
                <th className="px-4 py-3 text-center">C (4)</th>
                <th className="px-4 py-3 text-right">Puntaje Total</th>
                <th className="px-4 py-3">Recompensa / Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scores.map((sc) => {
                const isTop1 = sc.rank === 1;
                const isTop2 = sc.rank === 2;
                const isTop3 = sc.rank === 3;
                const isWinner = isTop1 || isTop2 || isTop3;

                return (
                  <tr
                    key={sc.student.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isTop1 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 text-center font-bold font-mono text-slate-700">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs">
                          1
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs">
                          2
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200/70 text-amber-950 text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-400">#{sc.rank}</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={sc.student.avatar}
                          alt={sc.student.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <button
                            onClick={() => onSelectStudent(sc.student.id)}
                            className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-left"
                          >
                            {sc.student.name}
                          </button>
                          <div className="text-xs text-slate-400 font-mono">{sc.student.code}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-slate-600 text-xs">
                      {sc.assignmentsCompleted} / {sc.totalAssignments}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-700 font-semibold text-xs">
                      {sc.gradesCount.AD}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-blue-700 font-semibold text-xs">
                      {sc.gradesCount.A}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-amber-700 font-semibold text-xs">
                      {sc.gradesCount.B}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-rose-700 font-semibold text-xs">
                      {sc.gradesCount.C}
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 font-mono tabular-nums text-base">
                      {sc.totalPoints} <span className="text-xs font-normal text-slate-500">pts</span>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {isTop1 ? (
                        <span className="text-amber-800 font-semibold">
                          🥇 1º Lugar (Gran Premio)
                        </span>
                      ) : isTop2 ? (
                        <span className="text-slate-700 font-semibold">
                          🥈 2º Lugar (Premio Destacado)
                        </span>
                      ) : isTop3 ? (
                        <span className="text-amber-900 font-semibold">
                          🥉 3º Lugar (Premio Mérito)
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          A {Math.max(0, (third?.totalPoints || 0) + 1 - sc.totalPoints)} pts del Top 3
                        </span>
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
  );
};
