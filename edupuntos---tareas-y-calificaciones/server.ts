import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { AppState, GradeRecord, GradeType, Submission, Assignment, Student } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// High body limit to allow photo uploads cleanly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Initial seed data with realistic school context
const initialStudents: Student[] = [
  { id: 'est-1', code: 'EST-01', name: 'Camila Mendoza', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-2', code: 'EST-02', name: 'Mateo Quispe', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-3', code: 'EST-03', name: 'Lucía Fernández', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-4', code: 'EST-04', name: 'Joaquín Salazar', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-5', code: 'EST-05', name: 'Valeria Rojas', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-6', code: 'EST-06', name: 'Diego Huamán', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-7', code: 'EST-07', name: 'Sofía Morales', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80' },
  { id: 'est-8', code: 'EST-08', name: 'Sebastián Paredes', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80' },
];

const initialAssignments: Assignment[] = [
  {
    id: 'asg-1',
    title: 'Fracciones y Porcentajes',
    subject: 'Matemáticas',
    dueDate: '2026-10-12',
    description: 'Resolver los ejercicios del 1 al 10 de la página 45 del libro. Tomar foto nítida de todo el procedimiento en el cuaderno.',
    createdAt: '2026-10-01',
  },
  {
    id: 'asg-2',
    title: 'Ensayo: El Medio Ambiente',
    subject: 'Comunicación',
    dueDate: '2026-10-15',
    description: 'Redactar un texto argumentativo de 2 páginas sobre la conservación del agua con introducción, argumentos y conclusión.',
    createdAt: '2026-10-02',
  },
  {
    id: 'asg-3',
    title: 'Informe de Laboratorio: Fotosíntesis',
    subject: 'Ciencia y Tecnología',
    dueDate: '2026-10-18',
    description: 'Dibujar el esquema del cloroplasto y anotar las conclusiones del experimento con las hojas de espinaca.',
    createdAt: '2026-10-03',
  },
];

// Sample homework photo submissions
const initialSubmissions: Submission[] = [
  {
    id: 'sub-1',
    assignmentId: 'asg-1',
    studentId: 'est-1',
    photoUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80',
    submittedAt: '2026-10-04T10:30:00Z',
    comment: 'Profesor, aquí adjunto todos los ejercicios resueltos paso a paso.',
  },
  {
    id: 'sub-2',
    assignmentId: 'asg-1',
    studentId: 'est-2',
    photoUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
    submittedAt: '2026-10-04T14:15:00Z',
    comment: 'Completé los 10 ejercicios con comprobación.',
  },
  {
    id: 'sub-3',
    assignmentId: 'asg-1',
    studentId: 'est-3',
    photoUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80',
    submittedAt: '2026-10-05T09:00:00Z',
    comment: 'Entregado a tiempo con dibujos explicativos.',
  },
  {
    id: 'sub-4',
    assignmentId: 'asg-2',
    studentId: 'est-1',
    photoUrl: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&auto=format&fit=crop&q=80',
    submittedAt: '2026-10-06T11:20:00Z',
    comment: 'Ensayo con bibliografía y citas revisadas.',
  },
  {
    id: 'sub-5',
    assignmentId: 'asg-2',
    studentId: 'est-4',
    photoUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
    submittedAt: '2026-10-06T16:40:00Z',
    comment: 'Terminado profesor, revisé la ortografía.',
  },
];

const initialGrades: GradeRecord[] = [
  { assignmentId: 'asg-1', studentId: 'est-1', grade: 'AD', feedback: '¡Excelente orden y procedimientos correctos!', updatedAt: '2026-10-05T12:00:00Z' },
  { assignmentId: 'asg-1', studentId: 'est-2', grade: 'A', feedback: 'Muy buen trabajo, revisa el ejercicio 7.', updatedAt: '2026-10-05T12:05:00Z' },
  { assignmentId: 'asg-1', studentId: 'est-3', grade: 'A', feedback: 'Completado con claridad.', updatedAt: '2026-10-05T12:10:00Z' },
  { assignmentId: 'asg-2', studentId: 'est-1', grade: 'AD', feedback: 'Gran redacción y estructura lógica.', updatedAt: '2026-10-07T08:00:00Z' },
  { assignmentId: 'asg-2', studentId: 'est-4', grade: 'B', feedback: 'Buen intento, faltó profundizar los argumentos.', updatedAt: '2026-10-07T08:15:00Z' },
];

function loadState(): AppState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }

  const defaultState: AppState = {
    students: initialStudents,
    assignments: initialAssignments,
    submissions: initialSubmissions,
    grades: initialGrades,
    rewards: {
      firstPlace: 'Medalla de Oro Escolar + Vale de Librería Especial + Pase Libre de Tarea',
      secondPlace: 'Medalla de Plata Escolar + Set de Útiles Premium de Dibujo y Estudio',
      thirdPlace: 'Medalla de Bronce Escolar + Diploma de Mérito Académico Honorífico',
    },
  };

  saveState(defaultState);
  return defaultState;
}

function saveState(state: AppState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    notifyClients(state);
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

let appState: AppState = loadState();

// SSE Client Connections for real-time synchronization
let sseClients: Response[] = [];

function notifyClients(state: AppState) {
  const payload = `data: ${JSON.stringify({ type: 'SYNC', state })}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// Real-time SSE endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial data immediately
  res.write(`data: ${JSON.stringify({ type: 'INIT', state: appState })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

// Get current state
app.get('/api/state', (req: Request, res: Response) => {
  res.json({ success: true, state: appState });
});

// Reset demo data
app.post('/api/reset', (req: Request, res: Response) => {
  appState = {
    students: initialStudents,
    assignments: initialAssignments,
    submissions: initialSubmissions,
    grades: initialGrades,
    rewards: {
      firstPlace: 'Medalla de Oro Escolar + Vale de Librería Especial + Pase Libre de Tarea',
      secondPlace: 'Medalla de Plata Escolar + Set de Útiles Premium de Dibujo y Estudio',
      thirdPlace: 'Medalla de Bronce Escolar + Diploma de Mérito Académico Honorífico',
    },
  };
  saveState(appState);
  res.json({ success: true, state: appState });
});

// Student uploads a homework photo
app.post('/api/submissions', (req: Request, res: Response) => {
  const { assignmentId, studentId, photoUrl, comment } = req.body;
  if (!assignmentId || !studentId || !photoUrl) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Remove existing submission if re-submitting or update it
  const existingIdx = appState.submissions.findIndex(
    (s) => s.assignmentId === assignmentId && s.studentId === studentId
  );

  const newSub: Submission = {
    id: existingIdx >= 0 ? appState.submissions[existingIdx].id : `sub-${Date.now()}`,
    assignmentId,
    studentId,
    photoUrl,
    submittedAt: new Date().toISOString(),
    comment: comment || '',
  };

  if (existingIdx >= 0) {
    appState.submissions[existingIdx] = newSub;
  } else {
    appState.submissions.push(newSub);
  }

  saveState(appState);
  res.json({ success: true, submission: newSub, state: appState });
});

// Teacher sets a grade
app.post('/api/grades', (req: Request, res: Response) => {
  const { assignmentId, studentId, grade, feedback } = req.body;
  if (!assignmentId || !studentId) {
    return res.status(400).json({ error: 'Faltan parámetros de calificación' });
  }

  const validGrades: GradeType[] = ['AD', 'A', 'B', 'C', null];
  if (!validGrades.includes(grade)) {
    return res.status(400).json({ error: 'Nota no válida. Debe ser AD, A, B, C o null' });
  }

  const existingIdx = appState.grades.findIndex(
    (g) => g.assignmentId === assignmentId && g.studentId === studentId
  );

  const updatedRecord: GradeRecord = {
    assignmentId,
    studentId,
    grade,
    feedback: feedback || '',
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    appState.grades[existingIdx] = updatedRecord;
  } else {
    appState.grades.push(updatedRecord);
  }

  saveState(appState);
  res.json({ success: true, record: updatedRecord, state: appState });
});

// Teacher creates new assignment
app.post('/api/assignments', (req: Request, res: Response) => {
  const { title, subject, dueDate, description } = req.body;
  if (!title || !subject) {
    return res.status(400).json({ error: 'Título y materia son obligatorios' });
  }

  const newAssignment: Assignment = {
    id: `asg-${Date.now()}`,
    title,
    subject,
    dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    description: description || '',
    createdAt: new Date().toISOString().split('T')[0],
  };

  appState.assignments.push(newAssignment);
  saveState(appState);
  res.json({ success: true, assignment: newAssignment, state: appState });
});

// Teacher deletes an assignment
app.delete('/api/assignments/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  appState.assignments = appState.assignments.filter((a) => a.id !== id);
  appState.submissions = appState.submissions.filter((s) => s.assignmentId !== id);
  appState.grades = appState.grades.filter((g) => g.assignmentId !== id);

  saveState(appState);
  res.json({ success: true, state: appState });
});

// Teacher updates rewards configuration
app.post('/api/rewards', (req: Request, res: Response) => {
  const { firstPlace, secondPlace, thirdPlace } = req.body;
  if (firstPlace && secondPlace && thirdPlace) {
    appState.rewards = { firstPlace, secondPlace, thirdPlace };
    saveState(appState);
    return res.json({ success: true, rewards: appState.rewards });
  }
  res.status(400).json({ error: 'Datos incompletos para premios' });
});

// EXCEL EXPORT: generates a ready-to-use .xlsx file for the teacher with current students & assignments
app.get('/api/excel-export', (req: Request, res: Response) => {
  try {
    const wb = XLSX.utils.book_new();

    // Headers
    const headers = ['CÓDIGO', 'ESTUDIANTE'];
    appState.assignments.forEach((asg) => {
      headers.push(`${asg.title} [${asg.id}]`);
    });
    headers.push('PUNTOS TOTALES');
    headers.push('RECOMPENSA TOP 3');

    // Rows
    const rows: (string | number)[][] = [];

    // Calculate points per student for the export
    const pointsMap: Record<string, number> = {};
    appState.students.forEach((st) => {
      let pts = 0;
      appState.assignments.forEach((asg) => {
        const gradeRec = appState.grades.find(
          (g) => g.studentId === st.id && g.assignmentId === asg.id
        );
        if (gradeRec?.grade === 'AD') pts += 10;
        else if (gradeRec?.grade === 'A') pts += 8;
        else if (gradeRec?.grade === 'B') pts += 6;
        else if (gradeRec?.grade === 'C') pts += 4;
      });
      pointsMap[st.id] = pts;
    });

    // Sort to determine ranks
    const sorted = [...appState.students].sort((a, b) => pointsMap[b.id] - pointsMap[a.id]);
    const rankMap: Record<string, number> = {};
    sorted.forEach((st, idx) => {
      rankMap[st.id] = idx + 1;
    });

    appState.students.forEach((student) => {
      const row: (string | number)[] = [student.code, student.name];

      appState.assignments.forEach((asg) => {
        const gradeRec = appState.grades.find(
          (g) => g.studentId === student.id && g.assignmentId === asg.id
        );
        row.push(gradeRec?.grade ? gradeRec.grade : '');
      });

      const totalPts = pointsMap[student.id] || 0;
      const rank = rankMap[student.id];
      let prize = '';
      if (rank === 1 && totalPts > 0) prize = '1º LUGAR ORO: ' + appState.rewards.firstPlace;
      else if (rank === 2 && totalPts > 0) prize = '2º LUGAR PLATA: ' + appState.rewards.secondPlace;
      else if (rank === 3 && totalPts > 0) prize = '3º LUGAR BRONCE: ' + appState.rewards.thirdPlace;

      row.push(totalPts);
      row.push(prize);
      rows.push(row);
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach((r) => {
        const val = String(r[i] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.max(maxLen + 3, 12) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Registro de Notas EduPuntos');

    // Also add a Guide Sheet explaining the score scale
    const guideData = [
      ['GUÍA DE CALIFICACIONES OFICIALES Y EQUIVALENCIA DE PUNTOS'],
      [''],
      ['Calificación', 'Significado', 'Puntos Otorgados'],
      ['AD', 'Logro Destacado', 10],
      ['A', 'Logro Esperado', 8],
      ['B', 'En Proceso', 6],
      ['C', 'En Inicio', 4],
      ['(Vacío o Sin Presentar)', 'No presentó la tarea', 0],
      [''],
      ['INSTRUCCIONES PARA EL DOCENTE:'],
      ['1. Ingrese únicamente las notas AD, A, B o C en las columnas de las tareas.'],
      ['2. Si el estudiante no entregó la tarea o no tiene nota, deje la celda en blanco.'],
      ['3. Guarde este archivo y súbalo en la sección "Conectar Excel" de la app.'],
      ['4. La base de datos centralizada se actualizará en tiempo real y el Top 3 recibirá sus premios.'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Guía de Puntajes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="EduPuntos_Registro_Notas.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    console.error('Error generating Excel file:', err);
    res.status(500).json({ error: 'Error al exportar archivo Excel: ' + err.message });
  }
});

// EXCEL IMPORT: processes an uploaded Excel spreadsheet (base64 or JSON rows)
// and updates the centralized database in real time!
app.post('/api/excel-import', (req: Request, res: Response) => {
  try {
    const { fileBase64, rowsData } = req.body;
    let parsedRows: any[][] = [];

    if (fileBase64) {
      // Decode base64
      const buffer = Buffer.from(fileBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      parsedRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    } else if (rowsData && Array.isArray(rowsData)) {
      parsedRows = rowsData;
    } else {
      return res.status(400).json({ error: 'Debe enviar el archivo Excel en base64 o las filas procesadas' });
    }

    if (parsedRows.length < 2) {
      return res.status(400).json({ error: 'El archivo Excel no contiene filas de datos válidas' });
    }

    const headerRow = parsedRows[0].map((h: any) => String(h || '').trim());
    
    // Find student identifier column (Código or Nombre)
    let codeColIdx = headerRow.findIndex((h) => h.toUpperCase().includes('CÓDIGO') || h.toUpperCase().includes('CODIGO') || h.toUpperCase().includes('CODE'));
    let nameColIdx = headerRow.findIndex((h) => h.toUpperCase().includes('ESTUDIANTE') || h.toUpperCase().includes('ALUMNO') || h.toUpperCase().includes('NOMBRE'));

    if (codeColIdx === -1 && nameColIdx === -1) {
      // default: col 0 is code, col 1 is name
      codeColIdx = 0;
      nameColIdx = 1;
    }

    // Match assignment columns
    // Header can look like: "Fracciones [asg-1]" or "Fracciones y Porcentajes"
    const assignmentColMap: { colIdx: number; assignmentId: string }[] = [];

    headerRow.forEach((headText, idx) => {
      if (idx === codeColIdx || idx === nameColIdx) return;
      if (headText.toUpperCase().includes('PUNTOS') || headText.toUpperCase().includes('RECOMPENSA') || headText.toUpperCase().includes('TOTAL')) return;

      // Check if bracket contains ID: [asg-xxx]
      const idMatch = headText.match(/\[(asg-[^\]]+)\]/i);
      if (idMatch) {
        const found = appState.assignments.find((a) => a.id.toLowerCase() === idMatch[1].toLowerCase());
        if (found) {
          assignmentColMap.push({ colIdx: idx, assignmentId: found.id });
          return;
        }
      }

      // Fuzzy check by title
      const foundByTitle = appState.assignments.find((a) => 
        headText.toLowerCase().includes(a.title.toLowerCase()) || 
        a.title.toLowerCase().includes(headText.toLowerCase())
      );
      if (foundByTitle) {
        assignmentColMap.push({ colIdx: idx, assignmentId: foundByTitle.id });
      }
    });

    // If no assignment column matched by name, assign columns to existing assignments in sequence
    if (assignmentColMap.length === 0) {
      let currentAsgIdx = 0;
      headerRow.forEach((headText, idx) => {
        if (idx === codeColIdx || idx === nameColIdx) return;
        if (headText.toUpperCase().includes('PUNTOS') || headText.toUpperCase().includes('TOTAL') || headText.toUpperCase().includes('RECOMPENSA')) return;
        if (currentAsgIdx < appState.assignments.length) {
          assignmentColMap.push({ colIdx: idx, assignmentId: appState.assignments[currentAsgIdx].id });
          currentAsgIdx++;
        }
      });
    }

    let updatedGradesCount = 0;
    const nowIso = new Date().toISOString();

    // Iterate data rows
    for (let r = 1; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      if (!row || row.length === 0) continue;

      const codeVal = codeColIdx !== -1 ? String(row[codeColIdx] || '').trim() : '';
      const nameVal = nameColIdx !== -1 ? String(row[nameColIdx] || '').trim() : '';

      // Match student
      const matchedStudent = appState.students.find((st) => {
        if (codeVal && st.code.toUpperCase() === codeVal.toUpperCase()) return true;
        if (nameVal && st.name.toLowerCase() === nameVal.toLowerCase()) return true;
        if (nameVal && st.name.toLowerCase().includes(nameVal.toLowerCase())) return true;
        return false;
      });

      if (!matchedStudent) continue;

      // Extract grades for each matched assignment column
      assignmentColMap.forEach(({ colIdx, assignmentId }) => {
        const rawGrade = String(row[colIdx] || '').trim().toUpperCase();
        let normalizedGrade: GradeType = null;

        if (rawGrade === 'AD' || rawGrade === '10') {
          normalizedGrade = 'AD';
        } else if (rawGrade === 'A' || rawGrade === '8') {
          normalizedGrade = 'A';
        } else if (rawGrade === 'B' || rawGrade === '6') {
          normalizedGrade = 'B';
        } else if (rawGrade === 'C' || rawGrade === '4') {
          normalizedGrade = 'C';
        } else if (rawGrade === '' || rawGrade === '0' || rawGrade === '-' || rawGrade === 'NO' || rawGrade === 'SIN PRESENTAR') {
          normalizedGrade = null;
        }

        // Update in grades list
        const existingIdx = appState.grades.findIndex(
          (g) => g.assignmentId === assignmentId && g.studentId === matchedStudent.id
        );

        if (existingIdx >= 0) {
          appState.grades[existingIdx].grade = normalizedGrade;
          appState.grades[existingIdx].updatedAt = nowIso;
        } else {
          appState.grades.push({
            assignmentId,
            studentId: matchedStudent.id,
            grade: normalizedGrade,
            feedback: 'Actualizado vía sincronización de Excel',
            updatedAt: nowIso,
          });
        }
        updatedGradesCount++;
      });
    }

    saveState(appState);

    res.json({
      success: true,
      updatedGradesCount,
      matchedAssignments: assignmentColMap.length,
      state: appState,
      message: `¡Excel sincronizado con éxito! Se procesaron notas para ${assignmentColMap.length} tareas.`,
    });
  } catch (err: any) {
    console.error('Error importing Excel:', err);
    res.status(500).json({ error: 'Error al procesar el archivo Excel: ' + err.message });
  }
});

// Start server with Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[EduPuntos Server] Corriendo en http://localhost:${PORT}`);
  });
}

startServer();
