export type GradeType = 'AD' | 'A' | 'B' | 'C' | null;

export const GRADE_POINTS: Record<'AD' | 'A' | 'B' | 'C', number> = {
  AD: 10,
  A: 8,
  B: 6,
  C: 4,
};

export const GRADE_DESCRIPTIONS: Record<'AD' | 'A' | 'B' | 'C', string> = {
  AD: 'Logro Destacado (10 pts)',
  A: 'Logro Esperado (8 pts)',
  B: 'En Proceso (6 pts)',
  C: 'En Inicio (4 pts)',
};

export interface Classroom { id: string; grade: number; section: string; name: string; }

export interface Student {
  classroomId?: string | null;
  id: string;
  code: string;
  name: string;
  avatar: string;
}

export interface Assignment {
  classroomId?: string | null;
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  description: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  photoUrl: string;
  submittedAt: string;
  comment?: string;
  photoReading?: PhotoReading | null;
}

// A reading of the teacher's handwritten mark, never a grade assigned to the work.
export interface PhotoReading {
  status: 'read' | 'uncertain' | 'unavailable';
  grade: GradeType;
  confidence: number;
}

export interface GradeRecord {
  assignmentId: string;
  studentId: string;
  grade: GradeType;
  feedback?: string;
  updatedAt: string;
}

export interface RewardsConfig {
  firstPlace: string;
  secondPlace: string;
  thirdPlace: string;
}

export interface StudentScore {
  student: Student;
  totalPoints: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  gradesCount: {
    AD: number;
    A: number;
    B: number;
    C: number;
    unsubmitted: number;
    awaitingReview: number;
  };
  rank: number;
}

export interface AppState {
  classroom?: Classroom;
  students: Student[];
  assignments: Assignment[];
  submissions: Submission[];
  grades: GradeRecord[];
  rewards: RewardsConfig;
  ranking?: StudentScore[];
}

export interface User {
  classrooms?: Classroom[];
  id: string;
  username: string;
  role: 'teacher' | 'student';
  studentId: string | null;
}
