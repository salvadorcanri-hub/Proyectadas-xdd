import type { GradeType, PhotoReading, Submission } from '../types';

export const MIN_READING_CONFIDENCE = 85;
export function validatePhotoReading(value: unknown): PhotoReading | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Lectura de foto inválida.');
  const { status, grade, confidence } = value as PhotoReading;
  if (!['read', 'uncertain', 'unavailable'].includes(status) || !Number.isFinite(confidence) || confidence < 0 || confidence > 100
    || (status === 'read' ? !['AD', 'A', 'B', 'C'].includes(grade!) || confidence < MIN_READING_CONFIDENCE : grade !== null)) {
    throw new Error('Lectura de foto inválida.');
  }
  return { status, grade, confidence };
}

export function verificationStatus(submission: Submission | undefined, officialGrade: GradeType | undefined) {
  if (!submission) return 'photo-needed';
  if (!officialGrade) return 'waiting';
  const reading = submission.photoReading;
  if (!reading || reading.status !== 'read' || reading.confidence < MIN_READING_CONFIDENCE || !reading.grade) return 'unreadable';
  return reading.grade === officialGrade ? 'matched' : 'mismatch';
}

// Avoid interpreting exercise answers or arbitrary digits as the teacher's mark.
// A bare mark is accepted only inside a selected crop or an image containing only that mark.
export function gradeFromOcr(lines: { text: string; confidence: number }[], cropped = false): PhotoReading {
  const normalized = lines.map(line => ({ ...line, text: line.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() })).filter(line => line.text);
  const candidates: { grade: GradeType; confidence: number }[] = [];
  for (const line of normalized) {
    const labelled = /^(?:NOTA|CALIFICACION|CALIFICADO|GRADE)\s*[:=\-]?\s*(AD|A|B|C)\s*[.!✓✔]*$/.exec(line.text);
    const isolated = (cropped || normalized.length === 1) && /^(AD|A|B|C)\s*[.!✓✔]*$/.exec(line.text);
    const match = labelled || isolated;
    if (match) candidates.push({ grade: match[1] as GradeType, confidence: line.confidence });
  }
  const grades = new Set(candidates.map(candidate => candidate.grade));
  const confidence = Math.min(100, Math.max(0, ...candidates.map(candidate => candidate.confidence)));
  return grades.size === 1 && confidence >= MIN_READING_CONFIDENCE
    ? { status: 'read', grade: candidates[0].grade, confidence }
    : { status: 'uncertain', grade: null, confidence: 0 };
}
