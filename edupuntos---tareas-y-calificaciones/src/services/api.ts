import { AppState, GradeType, RewardsConfig } from '../types';

export async function fetchState(): Promise<AppState> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('Error al cargar datos del servidor');
  const data = await res.json();
  return data.state;
}

export async function submitHomework(
  assignmentId: string,
  studentId: string,
  photoUrl: string,
  comment?: string
): Promise<AppState> {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId, studentId, photoUrl, comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al enviar tarea');
  }
  const data = await res.json();
  return data.state;
}

export async function updateGrade(
  assignmentId: string,
  studentId: string,
  grade: GradeType,
  feedback?: string
): Promise<AppState> {
  const res = await fetch('/api/grades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId, studentId, grade, feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar calificación');
  }
  const data = await res.json();
  return data.state;
}

export async function createAssignment(
  title: string,
  subject: string,
  dueDate: string,
  description: string
): Promise<AppState> {
  const res = await fetch('/api/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subject, dueDate, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al crear tarea');
  }
  const data = await res.json();
  return data.state;
}

export async function deleteAssignment(id: string): Promise<AppState> {
  const res = await fetch(`/api/assignments/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al eliminar tarea');
  }
  const data = await res.json();
  return data.state;
}

export async function importExcelBase64(fileBase64: string): Promise<{ state: AppState; message: string; updatedCount: number }> {
  const res = await fetch('/api/excel-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al procesar el archivo Excel');
  }
  const data = await res.json();
  return {
    state: data.state,
    message: data.message,
    updatedCount: data.updatedGradesCount,
  };
}

export async function updateRewardsConfig(rewards: RewardsConfig): Promise<AppState> {
  const res = await fetch('/api/rewards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rewards),
  });
  if (!res.ok) throw new Error('Error al actualizar premios');
  return fetchState();
}

export async function resetDemoData(): Promise<AppState> {
  const res = await fetch('/api/reset', { method: 'POST' });
  const data = await res.json();
  return data.state;
}

export function subscribeToRealtimeUpdates(onUpdate: (state: AppState) => void): () => void {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.state) {
        onUpdate(payload.state);
      }
    } catch (err) {
      console.error('Error parsing SSE event:', err);
    }
  };

  eventSource.onerror = () => {
    // Attempt recovery or ignore transient disconnects
  };

  return () => {
    eventSource.close();
  };
}
