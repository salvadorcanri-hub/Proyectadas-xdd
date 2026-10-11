import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { PhotoReading } from '../types';
import { readPhotoGrade, type PhotoRegion } from '../services/photo-reader';

export function PhotoGradeReader({ photo, disabled, onChange }: {
  photo: string; disabled: boolean; onChange: (reading: PhotoReading | null, busy: boolean) => void;
}) {
  const [reading, setReading] = useState<PhotoReading | null>(null);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState(0);
  const [region, setRegion] = useState<PhotoRegion | undefined>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  function selectRegion(next: PhotoRegion) {
    setRegion(next); setReading(null); onChange(null, false);
  }

  async function read(crop?: PhotoRegion) {
    controller.current?.abort();
    const current = ++version.current;
    controller.current = new AbortController();
    setBusy(true); setReading(null); setProgress(0); onChange(null, true);
    const result = await readPhotoGrade(photo, controller.current.signal, setProgress, crop);
    if (version.current !== current) return;
    setReading(result); setBusy(false); onChange(result, false);
  }
  useEffect(() => {
    void read();
    return () => { version.current++; controller.current?.abort(); };
  }, [photo]);
  const position = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  return <section aria-label="Lectura de la nota en la foto" className="space-y-2 text-xs">
    <p>Incluye la nota que tu profesor escribió en el cuaderno. Si no se lee bien, marca su zona sobre la imagen.</p>
    <div className="relative select-none overflow-hidden rounded-lg border border-slate-300" style={{ touchAction: busy || disabled ? 'auto' : 'none' }}
      onPointerDown={event => {
        if (busy || disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId); start.current = position(event); setRegion(undefined);
      }}
      onPointerMove={event => {
        if (!start.current) return;
        const end = position(event), origin = start.current;
        selectRegion({ x: Math.min(origin.x, end.x), y: Math.min(origin.y, end.y), width: Math.abs(end.x - origin.x), height: Math.abs(end.y - origin.y) });
      }}
      onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; setRegion(undefined); }}>
      <img src={photo} alt="Preview" draggable={false} className="block w-full" />
      {region && <div className="absolute border-2 border-indigo-600 bg-indigo-300/20 pointer-events-none" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
    </div>
    <details>
      <summary className="cursor-pointer">Ajustar la zona con teclado</summary>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {(['x', 'y', 'width', 'height'] as const).map((field, index) => {
          const crop = region || { x: 0, y: 0, width: 1, height: 1 };
          const max = field === 'x' || field === 'y' ? 95 : Math.round((1 - crop[field === 'width' ? 'x' : 'y']) * 100);
          return <label key={field}>{['Desde la izquierda', 'Desde arriba', 'Ancho de la zona', 'Alto de la zona'][index]} ({Math.round(crop[field] * 100)}%)
            <input type="range" className="w-full" disabled={busy || disabled} min={field === 'x' || field === 'y' ? 0 : 5} max={max} value={Math.round(crop[field] * 100)} onChange={event => {
              const next = { ...crop, [field]: Number(event.target.value) / 100 };
              next.width = Math.min(next.width, 1 - next.x); next.height = Math.min(next.height, 1 - next.y);
              selectRegion(next);
            }} />
          </label>;
        })}
      </div>
    </details>
    <p role="status">{busy ? `Leyendo la nota… ${progress}%`
      : !reading ? 'Vuelve a leer la foto o la zona marcada antes de guardar.'
      : reading.status === 'read' ? `Nota detectada en la foto: ${reading.grade}`
      : reading.status === 'unavailable' ? 'La lectura no está disponible. Puedes reintentarlo o guardar la foto pendiente de lectura.'
      : 'No se pudo leer la nota con claridad. Marca su zona o elige una foto más nítida. También puedes guardar la foto pendiente de lectura.'}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || disabled || !region || region.width < 0.02 || region.height < 0.02} onClick={() => void read(region)} className="px-3 py-2 rounded-lg border border-indigo-300 disabled:opacity-50">Leer zona marcada</button>
      <button type="button" disabled={busy || disabled} onClick={() => { setRegion(undefined); void read(); }} className="px-3 py-2 rounded-lg border border-slate-300 disabled:opacity-50">Volver a leer foto completa</button>
      {busy && <button type="button" onClick={() => controller.current?.abort()} className="px-3 py-2 rounded-lg border border-slate-300">Detener lectura</button>}
    </div>
  </section>;
}
