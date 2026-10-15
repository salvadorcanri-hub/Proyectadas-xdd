import type { Classroom } from '../types';

export const CLASSROOMS: Classroom[] = Array.from({ length: 5 }, (_, index) => ['A', 'B', 'C', 'D'].map(section => ({
  id: `sec-${index + 1}-${section.toLowerCase()}`, grade: index + 1, section,
  name: `${index + 1}.º de secundaria · ${section}`,
}))).flat();
export function validateClassroom(id: unknown): string {
  if (typeof id !== 'string' || !CLASSROOMS.some(classroom => classroom.id === id)) throw new Error('Selecciona un grado de 1.º a 5.º y una sección A, B, C o D.');
  return id;
}
