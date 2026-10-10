import type { AppState, Student, Assignment, Submission, GradeRecord } from '../src/types';
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


export function seedState(): AppState {
 return structuredClone({ students: initialStudents, assignments: initialAssignments, submissions: initialSubmissions, grades: initialGrades, rewards: { firstPlace: 'Medalla de Oro Escolar', secondPlace: 'Medalla de Plata Escolar', thirdPlace: 'Medalla de Bronce Escolar' } });
}
