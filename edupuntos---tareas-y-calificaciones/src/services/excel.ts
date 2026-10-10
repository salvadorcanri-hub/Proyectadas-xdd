import * as XLSX from 'xlsx';
import type { AppState, GradeRecord, GradeType } from '../types';
import { calculateStudentScores } from '../utils/scoreCalculator';

const normalize = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export function createWorkbook(state: AppState): XLSX.WorkBook {
  const scores = calculateStudentScores(state);
  const headers = ['CÓDIGO', 'ESTUDIANTE', ...state.assignments.map(a => `${a.title} [${a.id}]`), 'PUNTOS TOTALES', 'PUESTO', 'RECOMPENSA TOP 3'];
  const rows = state.students.map(student => {
    const score = scores.find(s => s.student.id === student.id)!;
    const rewards = [state.rewards.firstPlace, state.rewards.secondPlace, state.rewards.thirdPlace];
    return [student.code, student.name, ...state.assignments.map(a => state.grades.find(g => g.studentId === student.id && g.assignmentId === a.id)?.grade ?? ''),
      score.totalPoints, score.rank, score.totalPoints > 0 && score.rank <= 3 ? rewards[score.rank - 1] : ''];
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Registro de Notas EduPuntos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['GUÍA DE CALIFICACIONES'], ['AD', 10], ['A', 8], ['B', 6], ['C', 4],
    ['Celda vacía', 'Conserva la nota existente.'], ['BORRAR', 'Elimina explícitamente la nota. No elimina la entrega.'],
    ['Columnas', 'Conserve el CÓDIGO del estudiante y los identificadores [asg-…] de las tareas.'],
    ['Validación', 'Si hay errores, no se aplica ninguna nota.'],
  ]), 'Guía de Puntajes');
  return workbook;
}

// Validate the complete workbook before returning any changes. Blank cells are no-ops.
export function importRows(state: AppState, rows: unknown): { grades: GradeRecord[]; count: number; changes: Pick<GradeRecord, 'studentId' | 'assignmentId' | 'grade'>[] } {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 10001 || !rows.every(Array.isArray)) throw new Error('Excel: se requieren entre 1 y 10000 filas de datos.');
  const headers = rows[0].map(normalize);
  const codeColumns = headers.flatMap((h, i) => ['CODIGO','CODE'].includes(h) ? [i] : []);
  if (codeColumns.length !== 1) throw new Error('Excel: debe existir exactamente una columna CÓDIGO.');
  const codeIndex = codeColumns[0];
  const columns: { index: number; id: string }[] = [];
  headers.forEach((header, index) => {
    if (index === codeIndex || ['ESTUDIANTE','ALUMNO','NOMBRE','PUNTOS TOTALES','PUESTO','RECOMPENSA TOP 3'].includes(header)) return;
    const rawHeader = String(rows[0][index] ?? '').trim();
    const id = /\[(asg-[^\]]+)\]$/i.exec(rawHeader)?.[1];
    const matches = state.assignments.filter(a => id ? a.id.toLowerCase() === id.toLowerCase() : normalize(a.title) === header);
    if (!header || matches.length !== 1) throw new Error(`Excel: columna de tarea desconocida o ambigua «${rawHeader}».`);
    if (columns.some(c => c.id === matches[0].id)) throw new Error(`Excel: tarea duplicada «${rawHeader}».`);
    columns.push({ index, id: matches[0].id });
  });
  if (!columns.length) throw new Error('Excel: no se encontraron columnas de tareas.');
  const grades = structuredClone(state.grades);
  const seen = new Set<string>();
  let count = 0;
  const changes: Pick<GradeRecord, 'studentId' | 'assignmentId' | 'grade'>[] = [];
  const values: Record<string, GradeType> = { AD: 'AD', '10': 'AD', A: 'A', '8': 'A', B: 'B', '6': 'B', C: 'C', '4': 'C', BORRAR: null };
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every(cell => normalize(cell) === '')) continue;
    if (row.length > headers.length && row.slice(headers.length).some(cell => normalize(cell))) throw new Error(`Fila ${index + 1}: hay valores sin encabezado.`);
    const code = normalize(row[codeIndex]);
    const student = state.students.find(s => normalize(s.code) === code);
    if (!student) throw new Error(`Fila ${index + 1}: código de estudiante desconocido.`);
    if (seen.has(student.id)) throw new Error(`Fila ${index + 1}: estudiante duplicado.`);
    seen.add(student.id);
    for (const column of columns) {
      const value = normalize(row[column.index]);
      if (!value) continue;
      if (!Object.hasOwn(values, value)) throw new Error(`Fila ${index + 1}: nota «${value}» inválida. Usa AD, A, B, C, 10, 8, 6, 4 o BORRAR.`);
      const existing = grades.find(g => g.studentId === student.id && g.assignmentId === column.id);
      const record = { assignmentId: column.id, studentId: student.id, grade: values[value], updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, record);
      else grades.push({ ...record, feedback: '' });
      changes.push({ studentId: student.id, assignmentId: column.id, grade: values[value] });
      count++;
    }
  }
  if (!count) throw new Error('Excel: no contiene notas para actualizar. Las celdas vacías conservan las notas.');
  return { grades, count, changes };
}

export function workbookRows(fileBase64: unknown): unknown[][] {
  if (typeof fileBase64 !== 'string' || fileBase64.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileBase64)) throw new Error('Archivo Excel inválido o demasiado grande (máximo 5 MB).');
  const buffer = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
  if (buffer.length > 5 * 1024 * 1024) throw new Error('El archivo Excel supera 5 MB.');
  const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 10002 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('El libro no contiene hojas.');
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}
