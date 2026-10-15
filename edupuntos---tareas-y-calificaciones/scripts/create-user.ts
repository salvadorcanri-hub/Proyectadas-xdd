import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store';
import { createUser } from '../server/auth';
import type { User } from '../src/types';
const { values } = parseArgs({ options: { username: { type: 'string' }, role: { type: 'string' }, student: { type: 'string' }, classrooms: { type: 'string' } } });
if (!values.username || !['teacher','student'].includes(values.role || '')) throw new Error('Uso: npm run user:create -- --username docente --role teacher --classrooms sec-1-a,sec-2-b (o --role student --student est-1)');
let password = '';
if (process.stdin.isTTY) {
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write('Contraseña (12–128 caracteres, no se mostrará): ');
  muted = true;
  password = await prompt.question('');
  prompt.close(); process.stdout.write('\n');
} else {
  for await (const chunk of process.stdin) password += chunk.toString();
  password = password.replace(/\r?\n$/, '');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new Store(path.resolve(process.env.DATA_DIR || path.join(root, 'data')));
try { createUser(store, values.username, password, values.role as User['role'], values.student, values.classrooms?.split(',').map(id => id.trim()) || []); console.log('Cuenta creada.'); }
finally { store.close(); }
