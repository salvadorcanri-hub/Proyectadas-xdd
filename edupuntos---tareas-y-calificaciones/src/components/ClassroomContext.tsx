import { createContext, useContext } from 'react';
import type { Classroom } from '../types';
export const ClassroomContext = createContext<{ classrooms: Classroom[]; selected: string; change: (id: string) => void } | null>(null);
export const useClassroom = () => useContext(ClassroomContext);
