import { validateRegistration } from './registration';
import { validateClassroom } from './classrooms';
export interface NewAccount { role: 'teacher' | 'student'; email: string; password: string; classroomIds: string[]; firstName?: string; lastName?: string; dni?: string; }
export function validateNewAccount(input: NewAccount): NewAccount {
  if (!input || !['teacher','student'].includes(input.role)) throw new Error('Elige profesor o alumno.');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 80) throw new Error('Escribe un correo válido de hasta 80 caracteres.');
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  if (!Array.isArray(input.classroomIds) || !input.classroomIds.length || input.classroomIds.length > 20) throw new Error('Selecciona al menos un aula.');
  const classroomIds = [...new Set(input.classroomIds.map(validateClassroom))];
  if (input.role === 'student') {
    if (classroomIds.length !== 1) throw new Error('El alumno debe pertenecer a una sola aula.');
    const student = validateRegistration({ firstName: input.firstName!, lastName: input.lastName!, dni: input.dni!, email, password: input.password, classroomId: classroomIds[0] });
    return { role: 'student', email, password: input.password, classroomIds, firstName: student.firstName, lastName: student.lastName, dni: student.dni };
  }
  return { role: 'teacher', email, password: input.password, classroomIds };
}
