import { ConnectionNotice } from './ConnectionNotice';
import { useEffect, useRef, type ReactNode } from 'react';

/** The native dialog keeps keyboard focus inside and makes the page behind it inert. */
export function Modal({ children, labelledBy, onClose, busy = false }: {
  children: ReactNode; labelledBy: string; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={ref} className="app-dialog" aria-labelledby={labelledBy} aria-busy={busy}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(ref.current!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0);
      const target = event.shiftKey ? controls.at(-1) : controls[0];
      if (!controls.length || document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) {
        event.preventDefault();
        target?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <ConnectionNotice authenticated insideDialog/>
    {children}
  </dialog>;
}
