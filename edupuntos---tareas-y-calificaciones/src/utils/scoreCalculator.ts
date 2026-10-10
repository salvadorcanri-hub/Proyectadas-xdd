import { AppState, GRADE_POINTS, StudentScore } from '../types';

export function calculateStudentScores(state: AppState): StudentScore[] {
  if (state.ranking) return state.ranking;
  const { students, assignments, grades } = state;

  const scores: StudentScore[] = students.map((student) => {
    let totalPoints = 0;
    let completedCount = 0;
    const gradesCount = {
      AD: 0,
      A: 0,
      B: 0,
      C: 0,
      unsubmitted: 0,
      awaitingReview: 0,
    };

    assignments.forEach((asg) => {
      const record = grades.find(
        (g) => g.studentId === student.id && g.assignmentId === asg.id
      );

      if (record && record.grade) {
        const pts = GRADE_POINTS[record.grade] || 0;
        totalPoints += pts;
        gradesCount[record.grade]++;
        completedCount++;
      } else if (state.submissions.some(s => s.studentId === student.id && s.assignmentId === asg.id)) {
        gradesCount.awaitingReview++;
      } else {
        gradesCount.unsubmitted++;
      }
    });

    return {
      student,
      totalPoints,
      assignmentsCompleted: completedCount,
      totalAssignments: assignments.length,
      gradesCount,
      rank: 0,
    };
  });

  // Sort descending by totalPoints, then by assignments completed, then alphabetically
  scores.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.assignmentsCompleted !== a.assignmentsCompleted) {
      return b.assignmentsCompleted - a.assignmentsCompleted;
    }
    return a.student.name.localeCompare(b.student.name, 'es') || a.student.id.localeCompare(b.student.id, 'es');
  });

  // Assign ranks
  scores.forEach((s, idx) => {
    s.rank = idx + 1;
  });

  return scores;
}

export function getGradeLabel(grade: 'AD' | 'A' | 'B' | 'C' | null | undefined): {
  code: string;
  points: number;
  label: string;
  badgeClass: string;
  bgLight: string;
} {
  switch (grade) {
    case 'AD':
      return {
        code: 'AD',
        points: 10,
        label: 'Logro Destacado',
        badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        bgLight: 'bg-emerald-50',
      };
    case 'A':
      return {
        code: 'A',
        points: 8,
        label: 'Logro Esperado',
        badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200',
        bgLight: 'bg-blue-50',
      };
    case 'B':
      return {
        code: 'B',
        points: 6,
        label: 'En Proceso',
        badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
        bgLight: 'bg-amber-50',
      };
    case 'C':
      return {
        code: 'C',
        points: 4,
        label: 'En Inicio',
        badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
        bgLight: 'bg-rose-50',
      };
    default:
      return {
        code: '-',
        points: 0,
        label: 'Sin Calificar',
        badgeClass: 'text-slate-400 bg-slate-50 border border-slate-200',
        bgLight: 'bg-slate-50',
      };
  }
}
