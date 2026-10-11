import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { connectionSnapshot, subscribeConnection } from '../services/connection';

export function ConnectionNotice({ authenticated = false, insideDialog = false }: { authenticated?: boolean; insideDialog?: boolean }) {
  const state = useSyncExternalStore(subscribeConnection, connectionSnapshot);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const changed = () => setOffline(!navigator.onLine);
    window.addEventListener('online', changed); window.addEventListener('offline', changed);
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); };
  }, []);
  const outdated = authenticated && state.stale;
  const realtimeLost = authenticated && state.realtimeLost;
  const visible = offline || !!state.slow || outdated || realtimeLost;
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (insideDialog) return;
    const measure = () => document.documentElement.style.setProperty('--connection-banner-height', `${ref.current?.getBoundingClientRect().height || 0}px`);
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--connection-banner-height'); };
  }, [insideDialog, visible]);
  if (!visible) return null;
  return <aside ref={ref} className="connection-notice" aria-label="Estado de conexión">
    <div role="status" aria-live="polite">
      {offline ? 'Sin conexión. Los datos podrían no estar actualizados. No cierres esta página si tienes un formulario pendiente.'
        : state.slow ? 'Está tardando más de lo habitual. Espera un momento; no repitas la operación.'
        : outdated ? 'No pudimos actualizar los datos. Las notas y entregas visibles podrían estar desactualizadas.'
        : 'Se perdió la conexión en tiempo real. Seguimos intentando actualizar los datos cada minuto.'}
      {authenticated && state.lastUpdated && <small>Última actualización: {new Date(state.lastUpdated).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.</small>}
    </div>
    {!offline && (outdated || realtimeLost) && <button type="button" disabled={state.pending > 0} onClick={() => window.dispatchEvent(new Event('edupuntos-refresh'))}>{state.pending ? 'Actualizando…' : 'Actualizar datos'}</button>}
  </aside>;
}
