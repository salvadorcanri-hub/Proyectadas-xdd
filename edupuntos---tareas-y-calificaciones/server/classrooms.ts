import type { AppState, User } from '../src/types';
import type { Store } from './store';
import { CLASSROOMS, validateClassroom } from '../src/utils/classrooms';

export function userClassrooms(store: Store, user: User) {
  const ids = user.role === 'teacher'
    ? store.db.prepare('SELECT classroom_id FROM teacher_classrooms WHERE user_id=?').all(user.id).map(row => row.classroom_id)
    : [store.load().students.find(student => student.id === user.studentId)?.classroomId];
  return CLASSROOMS.filter(classroom => ids.includes(classroom.id));
}
export function requireClassroom(store: Store, user: User, requested?: unknown): string {
  const allowed = userClassrooms(store, user);
  const id = requested || (allowed.length === 1 ? allowed[0].id : null);
  if (!id || !allowed.some(classroom => classroom.id === id)) throw Object.assign(new Error('No tienes acceso a esta aula. Solicita la asignación al administrador.'), { status: 403 });
  return id as string;
}
export function classroomState(store: Store, state: AppState, classroomId: string): AppState {
  const students = state.students.filter(student => student.classroomId === classroomId);
  const assignments = state.assignments.filter(assignment => assignment.classroomId === classroomId);
  const studentIds = new Set(students.map(student => student.id)), assignmentIds = new Set(assignments.map(assignment => assignment.id));
  const rewards = store.db.prepare('SELECT value FROM settings WHERE key=?').get(`rewards:${classroomId}`);
  return { students, assignments, classroom: CLASSROOMS.find(classroom => classroom.id === classroomId),
    submissions: state.submissions.filter(item => studentIds.has(item.studentId) && assignmentIds.has(item.assignmentId)),
    grades: state.grades.filter(item => studentIds.has(item.studentId) && assignmentIds.has(item.assignmentId)),
    rewards: rewards ? JSON.parse(rewards.value as string) : state.rewards };
}
export function grantTeacherClassroom(store: Store, userId: string, classroomId: string) {
  validateClassroom(classroomId);
  if (!store.db.prepare("SELECT 1 FROM users WHERE id=? AND role='teacher'").get(userId)) throw new Error('No existe la cuenta docente.');
  store.db.prepare('INSERT OR IGNORE INTO teacher_classrooms VALUES (?,?)').run(userId, classroomId);
}
