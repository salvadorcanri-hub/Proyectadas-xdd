import { createHash, randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Store } from './store';
import type { User } from '../src/types';
import { validateRegistration, type StudentRegistration } from '../src/utils/registration';

export const SESSION_MS = 8 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummySalt = randomBytes(16).toString('hex');

export function createUser(store: Store, username: string, password: string, role: User['role'], studentId?: string) {
  if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username)) throw new Error('Usuario: usa entre 3 y 80 letras, números, punto, guion o @.');
  if (password.length < 12 || password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  if (!['teacher','student'].includes(role)) throw new Error('Rol inválido.');
  if (role === 'student' && !store.load().students.some(s => s.id === studentId)) throw new Error('El estudiante no existe.');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const id = randomUUID();
  store.db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(id, username, hash, role, role === 'student' ? studentId! : null);
  return id;
}

export async function authenticate(store: Store, username: string, password: string, role: User['role']): Promise<User | null> {
  const row = store.db.prepare('SELECT u.* FROM users u LEFT JOIN student_accounts a ON a.user_id=u.id WHERE (u.username=? OR a.dni=?) AND u.role=?').get(username, username, role);
  const [salt, expected] = row ? (row.password_hash as string).split(':') : [dummySalt, '00'.repeat(64)];
  const actual = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result)));
  if (!row || !timingSafeEqual(Buffer.from(expected, 'hex'), actual)) return null;
  return { id: row.id as string, username: row.username as string, role, studentId: row.student_id as string | null };
}

export async function registerStudent(store: Store, input: StudentRegistration): Promise<User> {
  const data = validateRegistration(input);
  const salt = randomBytes(16).toString('hex');
  const hash = await new Promise<Buffer>((resolve, reject) => scrypt(data.password, salt, 64, (error, result) => error ? reject(error) : resolve(result)));
  const id = randomUUID(), studentId = `est-${id}`;
  store.db.exec('BEGIN IMMEDIATE');
  try {
    if (store.db.prepare('SELECT 1 FROM users WHERE username=? OR username=?').get(data.email, data.dni) || store.db.prepare('SELECT 1 FROM student_accounts WHERE dni=?').get(data.dni)) {
      throw new Error('No se pudo crear la cuenta con esos datos. Si ya tienes una cuenta, inicia sesión.');
    }
    const student = { id: studentId, code: `EST-${id.replaceAll('-', '').slice(0,12).toUpperCase()}`, name: `${data.firstName} ${data.lastName}`, avatar: '' };
    store.db.prepare('INSERT INTO students VALUES (?,?,?)').run(studentId, student.code, JSON.stringify(student));
    store.db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(id, data.email, `${salt}:${hash.toString('hex')}`, 'student', studentId);
    store.db.prepare('INSERT INTO student_accounts VALUES (?,?,?,?)').run(id, data.dni, data.firstName, data.lastName);
    store.db.exec('COMMIT');
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  return { id, username: data.email, role: 'student', studentId };
}

export function createSession(store: Store, user: User) {
  const token = randomBytes(32).toString('hex');
  store.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  store.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), user.id, Date.now() + SESSION_MS);
  return token;
}

export function sessionUser(store: Store, token: string, role: User['role']): User | null {
  const row = store.db.prepare(`SELECT u.id, u.username, u.role, u.student_id FROM sessions s JOIN users u ON s.user_id=u.id
    WHERE s.token_hash=? AND s.expires>? AND u.role=?`).get(tokenHash(token), Date.now(), role);
  return row ? { id: row.id as string, username: row.username as string, role, studentId: row.student_id as string | null } : null;
}
