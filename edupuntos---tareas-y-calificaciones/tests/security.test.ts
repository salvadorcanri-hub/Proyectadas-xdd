import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { createUser } from '../server/auth';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { readWorkbookBytes } from '../src/services/excel-file';
import { workbookBuffer } from './workbook-helpers';

async function fixture(t: any) {
  const dir = mkdtempSync(path.join(tmpdir(), 'edupuntos-security-'));
  const store = new Store(dir);
  createUser(store, 'teacher-security', 'Security-test-only-123', 'teacher', undefined, ['sec-1-a']);
  const studentId = createUser(store, 'student-security', 'Security-test-only-123', 'student', 'est-1');
  const { app, close } = createApp(store, { secureCookies: false });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => { close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); store.close(); rmSync(dir, { recursive: true, force: true }); });
  const call = (role: string, endpoint: string, cookie = '', body?: unknown) => fetch(`${base}/api/${role}${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { cookie, 'Content-Type': 'application/json', 'X-EduPuntos-Client': role }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const login = async (role: string) => {
    const res = await call(role, '/auth/login', '', { username: `${role}-security`, password: 'Security-test-only-123' });
    assert.equal(res.status, 200); return res.headers.get('set-cookie')!.split(';')[0];
  };
  return { store, studentId, base, call, login, dir };
}

test('an open event stream never retains the previous student identity after account reassignment', { timeout: 10000 }, async t => {
  const { store, studentId, base, call, login } = await fixture(t);
  const student = await login('student'), teacher = await login('teacher');
  const controller = new AbortController(); t.after(() => controller.abort());
  const response = await fetch(base + '/api/student/events', { headers: { cookie: student }, signal: controller.signal });
  const reader = response.body!.getReader();
  await reader.read();
  store.db.prepare('UPDATE users SET student_id=? WHERE id=?').run('est-2', studentId);
  const result = await call('teacher', '/grades', teacher, { assignmentId: 'asg-1', studentId: 'est-1', grade: 'B', feedback: 'PRIVATE-OLD-STUDENT' });
  assert.equal(result.status, 200);
  const next = await reader.read();
  // Disconnecting is safest: a fresh login is needed after reassignment.
  assert.equal(next.done, true, 'The old stream still received private state after reassignment');
});

test('anonymous upload requests are rejected before parsing a large JSON body', async t => {
  const { call } = await fixture(t);
  const response = await call('student', '/submissions', '', { photoUrl: 'x'.repeat(9 * 1024 * 1024) });
  assert.equal(response.status, 401);
});

test('replacing a homework photo removes only the unreferenced previous upload', async t => {
  const { call, login, dir } = await fixture(t);
  const cookie = await login('student');
  const images = [
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  ];
  const submit = async (assignmentId: string, image: string) => assert.equal((await call('student', '/submissions', cookie, { assignmentId, photoUrl: 'data:image/png;base64,' + image })).status, 200);
  await submit('asg-1', images[0]);
  await submit('asg-2', images[0]);
  await submit('asg-1', images[1]);
  assert.equal(readdirSync(path.join(dir, 'uploads')).length, 2, 'A shared photo must survive until its last reference is replaced');
  await submit('asg-2', images[1]);
  assert.equal(readdirSync(path.join(dir, 'uploads')).length, 1);
});

test('spreadsheet input rejects oversized expansion, entity tricks and sparse huge dimensions', async () => {
  const valid = await workbookBuffer([['CÓDIGO', 'Tarea [asg-1]'], ['EST-01', 'AD']]);
  assert.deepEqual(await readWorkbookBytes(valid), [['CÓDIGO', 'Tarea [asg-1]'], ['EST-01', 'AD']]);
  const files = unzipSync(valid);
  const sheet = Object.keys(files).find(name => /^xl\/worksheets\/.+\.xml$/.test(name))!;
  for (const xml of [
    '<worksheet><sheetData><row r="999999999"><c r="A999999999"><v>1</v></c></row></sheetData></worksheet>',
    '<worksheet><sheetData><row r="&#57;&#57;&#57;&#57;&#57;"><c r="A1"><v>1</v></c></row></sheetData></worksheet>',
    '<!DOCTYPE worksheet [<!ENTITY attack SYSTEM "file:///etc/passwd">]><worksheet/>',
    '<worksheet><sheetData><row r="1"><c r="ZZZ1"><v>1</v></c></row></sheetData></worksheet>',
  ]) await assert.rejects(readWorkbookBytes(zipSync({ ...files, [sheet]: strToU8(xml) })), /inválido|grande/);
  const bomb = zipSync({ ...files, 'xl/large.xml': new Uint8Array(9 * 1024 * 1024).fill(65) }, { level: 9 });
  assert.ok(bomb.length < 100000);
  await assert.rejects(readWorkbookBytes(bomb), /inválido|grande/);
  await assert.rejects(readWorkbookBytes(new TextEncoder().encode('CÓDIGO,Tarea\n' + 'a,'.repeat(300))), /inválido|grande/);
});

test('session revocation, stream limits and HTTP hardening apply to authenticated users', { timeout: 10000 }, async t => {
  const { store, studentId, base, call, login } = await fixture(t);
  const cookie = await login('student');
  const state = await call('student', '/state', cookie);
  assert.equal(state.headers.get('cache-control'), 'no-store');
  assert.equal(state.headers.get('x-frame-options'), 'DENY');
  assert.match(state.headers.get('content-security-policy')!, /script-src 'self' 'wasm-unsafe-eval';/);
  assert.doesNotMatch(state.headers.get('content-security-policy')!, /script-src[^;]*'unsafe-(?:inline|eval)'/);
  assert.match(state.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(state.headers.get('referrer-policy'), 'no-referrer');
  const controllers: AbortController[] = [];
  t.after(() => controllers.forEach(c => c.abort()));
  for (let i = 0; i < 5; i++) {
    const controller = new AbortController(); controllers.push(controller);
    const response = await fetch(base + '/api/student/events', { headers: { cookie }, signal: controller.signal });
    assert.equal(response.status, 200);
    await response.body!.getReader().read();
  }
  assert.equal((await fetch(base + '/api/student/events', { headers: { cookie } })).status, 429);
  store.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run('replaced-by-admin', studentId);
  assert.equal((await call('student', '/state', cookie)).status, 401);
});

test('workbook exports keep spreadsheet-looking user text literal and CSV remains bounded', async () => {
  const payload = '=HYPERLINK("https://attacker.invalid","abrir")';
  const book = await workbookBuffer([['CÓDIGO', payload], ['EST-01', 'A']]);
  const files = unzipSync(book);
  for (const [name, bytes] of Object.entries(files)) if (name.endsWith('.xml')) assert.doesNotMatch(new TextDecoder().decode(bytes), /<f[\s>]/);
  assert.equal((await readWorkbookBytes(book))[0][1], payload);
  assert.deepEqual(await readWorkbookBytes(strToU8('CÓDIGO;"Tarea, ejemplo"\r\nEST-01;AD\r\n')), [['CÓDIGO', 'Tarea, ejemplo'], ['EST-01', 'AD']]);
});
