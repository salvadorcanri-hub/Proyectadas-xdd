import { useState } from 'react';
export function Avatar({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
  return <span role="img" aria-label={alt || 'Estudiante'} className={`${className} inline-flex shrink-0 items-center justify-center bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold`}>
    {(alt || 'Estudiante').split(/\s+/).slice(0, 2).map(word => word[0]).join('')}
  </span>;
}
