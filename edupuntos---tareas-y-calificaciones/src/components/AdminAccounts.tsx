import { useState } from 'react';
import { createAccount } from '../services/api';
import { CLASSROOMS } from '../utils/classrooms';
import { validateNewAccount, type NewAccount } from '../utils/admin-account';
export function AdminAccounts({onBack,onLogout,canReturn}:{onBack:()=>void;onLogout:()=>void;canReturn:boolean}) {
 const [role,setRole]=useState<'teacher'|'student'>('teacher');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 return <main className="max-w-2xl mx-auto p-6 space-y-5"><h1 className="text-2xl font-bold">Administración de cuentas</h1><p>Crea profesores con sus aulas asignadas o alumnos con un aula. Las cuentas quedan habilitadas sin esperar un correo de confirmación.</p>
 {canReturn && <button disabled={busy} onClick={onBack} className="auth-text-button">Volver a profesores</button>}
 <form className="login-form space-y-5" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const fields=new FormData(form);setError('');setMessage('');
 try {if(fields.get('password')!==fields.get('repeat')) throw new Error('Las contraseñas no coinciden.');
 const data=validateNewAccount({role,email:String(fields.get('email')),password:String(fields.get('password')),classroomIds:fields.getAll('classroom').map(String),firstName:String(fields.get('firstName')||''),lastName:String(fields.get('lastName')||''),dni:String(fields.get('dni')||'')} as NewAccount);
 setBusy(true);const result=await createAccount(data);form.reset();setMessage(result.message);
 }catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
 <fieldset disabled={busy} className="space-y-4">
 <label className="block">Tipo de cuenta<select className="block w-full border rounded p-2" value={role} onChange={e=>{setRole(e.target.value as typeof role);setError('');setMessage('');}}><option value="teacher">Profesor</option><option value="student">Alumno</option></select></label>
 <label className="block">Correo de la nueva cuenta<input className="block w-full border rounded p-2" name="email" type="email" required maxLength={80} autoComplete="off"/></label>
 {role==='student' && <><label className="block">Nombres<input className="block w-full border rounded p-2" name="firstName" required maxLength={100}/></label><label className="block">Apellidos<input className="block w-full border rounded p-2" name="lastName" required maxLength={100}/></label><label className="block">DNI<input className="block w-full border rounded p-2" name="dni" required pattern="[0-9]{8}" maxLength={8} inputMode="numeric"/></label></>}
 <label className="block">Contraseña inicial<input className="block w-full border rounded p-2" name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label>
 <label className="block">Repetir contraseña<input className="block w-full border rounded p-2" name="repeat" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label>
 <fieldset key={role}><legend>{role==='teacher'?'Aulas asignadas':'Aula del alumno'}</legend><div className="grid grid-cols-2 gap-2">{CLASSROOMS.map(c=><label key={c.id} className="flex gap-2 items-center"><input type={role==='teacher'?'checkbox':'radio'} name="classroom" value={c.id}/>{c.name}</label>)}</div></fieldset>
 <button className="w-full rounded-lg bg-indigo-700 text-white p-3" type="submit">{busy?'Creando cuenta…':'Crear cuenta'}</button></fieldset>
 {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
 </form><button disabled={busy} onClick={onLogout} className="auth-text-button">Cerrar sesión</button></main>;
}
