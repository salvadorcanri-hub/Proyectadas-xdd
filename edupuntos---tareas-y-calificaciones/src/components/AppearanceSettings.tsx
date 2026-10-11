import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Modal } from './Modal';

export function AppearanceSettings() {
  return <section className="appearance-settings" aria-label="Apariencia">
    <h2>Apariencia</h2>
    <label>Tema de la aplicación
      <select data-theme-select defaultValue={document.documentElement.dataset.themePreference || 'system'}>
        <option value="system">Sistema (automático)</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
    <p>«Sistema» sigue la apariencia de tu dispositivo. Tu elección se guarda en este navegador y se aplica a los espacios de profesores y alumnos de esta web.</p>
  </section>;
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="nav-item" aria-haspopup="dialog" onClick={() => setOpen(true)}><Settings size={19}/><span>Configuración</span></button>
    {open && <Modal labelledBy="settings-title" onClose={() => setOpen(false)}>
      <div className="settings-panel">
        <div className="settings-heading"><h1 id="settings-title">Configuración</h1><button type="button" className="settings-close" aria-label="Cerrar configuración" onClick={() => setOpen(false)}><X size={21}/></button></div>
        <AppearanceSettings/>
      </div>
    </Modal>}
  </>;
}
