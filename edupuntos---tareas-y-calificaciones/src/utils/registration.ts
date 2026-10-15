import { validateClassroom } from './classrooms';

export interface StudentRegistration {
  classroomId: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  password: string;
}

export function validateRegistration(value: StudentRegistration): StudentRegistration {
  if (!value || typeof value !== 'object') throw new Error('Completa los datos de tu cuenta.');
  const clean = (input: unknown) => typeof input === 'string' ? input.trim() : '';
  const firstName = clean(value.firstName), lastName = clean(value.lastName);
  const dni = clean(value.dni), email = clean(value.email).toLowerCase();
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) throw new Error('Escribe tus nombres y apellidos, hasta 100 caracteres en cada campo.');
  if (firstName.length + lastName.length > 199) throw new Error('Los nombres y apellidos juntos deben tener menos de 200 caracteres.');
  if (!/^\d{8}$/.test(dni)) throw new Error('El DNI debe tener 8 dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Escribe un correo electrónico válido.');
  if (typeof value.password !== 'string' || value.password.length < 12 || value.password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  return { classroomId: validateClassroom(value.classroomId), firstName, lastName, dni, email, password: value.password };
}
