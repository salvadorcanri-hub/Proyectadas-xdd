import { useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

/** Keep an unavailable photo legible without substituting someone else's work. */
export function HomeworkPhoto(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (failedSrc === props.src) return <div className="photo-unavailable" role="img" aria-label="No se pudo cargar la foto"><ImageOff size={24}/><span>Foto no disponible</span><small>Vuelve a intentarlo al recargar.</small></div>;
  return <img {...props} onError={() => setFailedSrc(props.src)} />;
}
