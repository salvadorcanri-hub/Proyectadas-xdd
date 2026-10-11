import { useState } from 'react';
import { register } from '../services/api';
import { validateRegistration } from '../utils/registration';

export function RegistrationForm({ onBack, onRegistered }: {
  onBack: () => void; onRegistered: (email: string, confirmationRequired: boolean) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(''), [lastName, setLastName] = useState('');
  const [dni, setDni] = useState(''), [email, setEmail] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inputClass = 'mt-1 w-full border rounded-lg p-3';
  return <form className="login-form space-y-4" onSubmit={async event => {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      const data = validateRegistration({ firstName, lastName, dni, email, password });
      const result = await register(data);
      setPassword(''); setConfirmation('');
      await onRegistered(data.email, result.confirmationRequired);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }}>
    <div><span className="eyebrow">TU ESPACIO DE APRENDIZAJE</span><h1>Crea tu cuenta de alumno</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-200">Podrás ingresar con tu DNI o tu correo electrónico.</p></div>
    <label className="block text-sm font-medium">Nombres<input autoComplete="given-name" required maxLength={100} value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass}/></label>
    <label className="block text-sm font-medium">Apellidos<input autoComplete="family-name" required maxLength={100} value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass}/></label>
    <label className="block text-sm font-medium">DNI<input inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" title="8 dígitos" minLength={8} maxLength={8} required value={dni} onChange={e => setDni(e.target.value)} className={inputClass} aria-describedby="dni-privacy"/></label>
    <p id="dni-privacy" className="text-xs text-slate-500 dark:text-slate-400">Tu DNI se usa para iniciar sesión y no se muestra a otros alumnos.</p>
    <label className="block text-sm font-medium">Correo electrónico<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} className={inputClass}/></label>
    <label className="block text-sm font-medium">Contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} aria-describedby="password-length"/></label>
    <p id="password-length" className="text-xs text-slate-500 dark:text-slate-400">Usa entre 12 y 128 caracteres.</p>
    <label className="block text-sm font-medium">Repite la contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass}/></label>
    {error && <p role="alert" className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
    <button type="submit" disabled={busy} className="w-full rounded-lg text-white p-3 font-semibold disabled:opacity-50">{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    <button type="button" disabled={busy} className="auth-text-button" onClick={onBack}>Ya tengo cuenta. Iniciar sesión</button>
  </form>;
}
