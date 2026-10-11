import type { GradeType, Submission } from '../types';
import { verificationStatus } from '../utils/photoVerification';

export function GradeVerification({ submission, officialGrade, teacher = false }: {
  submission?: Submission; officialGrade?: GradeType; teacher?: boolean;
}) {
  const status = verificationStatus(submission, officialGrade);
  const content = {
    'photo-needed': ['Falta la foto de la tarea', 'Sube la tarea que tu profesor ya corrigió, con su nota visible.'],
    waiting: ['Espera la próxima actualización', teacher ? 'Todavía no hay nota en el registro. Importa el Excel actualizado para comprobar esta foto.' : 'Tu foto está guardada. El profesor todavía no ha registrado esta nota. La compararemos cuando actualice Excel.'],
    unreadable: ['No se pudo leer la nota de la foto', teacher ? 'La lectura no es concluyente. Revisa la foto con el estudiante.' : 'Sube una foto más clara o marca la zona de la nota para volver a leerla.'],
    matched: ['Coincide con Excel', 'La nota leída en la foto coincide con la nota del registro del profesor.'],
    mismatch: ['Las notas son diferentes', teacher ? 'Comprueba la nota escrita en el cuaderno y corrige Excel si corresponde.' : 'La nota leída en la foto es distinta a la del registro. Pide a tu profesor que revise la diferencia.'],
  }[status];
  const tone = status === 'matched' ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : status === 'mismatch' ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200' : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200';
  return <section aria-label="Comprobación de la nota" data-verification={status} className={`grade-verification rounded-lg border p-3 text-xs ${tone}`}>
    <strong className="block">{content[0]}</strong>
    <p className="mt-1">{content[1]}</p>
    {submission && <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
      <span>Nota leída en foto: <b>{submission.photoReading?.status === 'read' ? submission.photoReading.grade : 'Sin lectura clara'}</b></span>
      <span>Nota del registro: <b>{officialGrade || 'Pendiente'}</b></span>
    </div>}
    {submission?.photoReading?.status === 'read' && <p className="mt-1 text-[11px]">Lectura automática; el profesor puede comprobarla en la foto.</p>}
  </section>;
}
