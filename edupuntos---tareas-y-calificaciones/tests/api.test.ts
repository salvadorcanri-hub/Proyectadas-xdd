import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { workbookBuffer, readWorkbook } from './workbook-helpers';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { createUser } from '../server/auth';

test('connected apps enforce identity, sync changes, protect photos and persist school data', async t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'edupuntos-api-'));
  const store = new Store(dir); const { app, close } = createApp(store, { secureCookies:false });
  createUser(store, 'teacher-test', 'Only-for-test-123', 'teacher');
  createUser(store, 'student-one', 'Only-for-test-123', 'student', 'est-1');
  createUser(store, 'student-two', 'Only-for-test-123', 'student', 'est-2');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => { close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); store.close(); rmSync(dir, { recursive:true, force:true }); });
  const call = (role: string, endpoint: string, cookie = '', body?: unknown, method?: string) => fetch(`${base}/api/${role}${endpoint}`, {
    method: method || (body ? 'POST' : 'GET'), headers: { cookie, 'Content-Type':'application/json', 'X-EduPuntos-Client':role }, body: body ? JSON.stringify(body) : undefined,
  });
  const login = async (role: string, username: string) => {
    const res = await call(role, '/auth/login', '', { username, password:'Only-for-test-123' }); assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie')!, /HttpOnly/); assert.match(res.headers.get('set-cookie')!, /SameSite=Strict/);
    return res.headers.get('set-cookie')!.split(';')[0];
  };
  assert.equal((await call('teacher','/state')).status,401);
  assert.equal((await call('student','/auth/login','',{ username:'teacher-test', password:'Only-for-test-123' })).status,401);
  const teacher = await login('teacher','teacher-test');
  const student = await login('student','student-one'); const student2 = await login('student','student-two');
  assert.equal((await call('teacher','/state',student)).status,401);
  for (const endpoint of ['/grades','/assignments','/rewards','/excel-import']) assert.equal((await call('student',endpoint,student,{})).status,403);
  assert.equal((await call('student','/excel-export',student)).status,403);
  assert.equal((await fetch(base+'/api/teacher/assignments', { method:'POST', headers:{cookie:teacher,'Content-Type':'application/json'},body:'{}' })).status,403);
  const initial = (await (await call('student','/state',student)).json()).state;
  assert.equal(initial.students.length,1); assert.equal(initial.students[0].id,'est-1');
  assert.ok(initial.grades.every((g: any) => g.studentId==='est-1')); assert.equal(initial.ranking.length,8);
  assert.ok(initial.submissions.every((s: any) => s.studentId==='est-1'));
  const controller = new AbortController();
  const events = await fetch(`${base}/api/student/events`, { headers:{cookie:student}, signal:controller.signal });
  const reader = events.body!.getReader(); let pending = '';
  async function nextEvent() {
    while (!pending.includes('\n\n')) { const value = await reader.read(); assert.equal(value.done,false); pending += new TextDecoder().decode(value.value); }
    const index = pending.indexOf('\n\n'); const value = pending.slice(0,index); pending = pending.slice(index+2);
    return JSON.parse(value.slice(6));
  }
  assert.equal((await nextEvent()).type, 'INIT');
  const created = await call('teacher','/assignments',teacher,{ title:'Prueba conectada',subject:'Matemáticas',dueDate:'2026-12-01',description:'' }); assert.equal(created.status,200);
  const assignment = (await created.json()).state.assignments.at(-1);
  const event = await nextEvent(); assert.equal(event.type,'SYNC'); assert.equal(event.state.assignments.at(-1).id,assignment.id);
  assert.ok(event.state.grades.every((g: any) => g.studentId==='est-1'));
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  assert.equal((await call('student','/submissions',student,{ assignmentId:assignment.id,studentId:'est-2',photoUrl:photo })).status,403);
  assert.equal((await call('student','/submissions',student,{ assignmentId:assignment.id,photoUrl:'data:image/svg+xml;base64,PHN2Zz4=' })).status,400);
  const submitted = await call('student','/submissions',student,{ assignmentId:assignment.id,photoUrl:photo,comment:'Mi tarea' }); assert.equal(submitted.status,200);
  const submission = (await submitted.json()).state.submissions.find((s: any) => s.assignmentId===assignment.id);
  assert.equal((await fetch(base+submission.photoUrl,{headers:{cookie:student}})).status,200);
  assert.equal((await fetch(base+submission.photoUrl,{headers:{cookie:student2}})).status,404);
  assert.equal((await fetch(base+submission.photoUrl)).status,401);
  const graded = await call('teacher','/grades',teacher,{ assignmentId:assignment.id,studentId:'est-1',grade:'AD',feedback:'Excelente' }); assert.equal(graded.status,200);
  const own = (await (await call('student','/state',student)).json()).state;
  assert.equal(own.grades.find((g: any) => g.assignmentId===assignment.id).feedback,'Excelente');
  const before = store.load();
  const book = await workbookBuffer([['CÓDIGO',`Prueba [${assignment.id}]`],['EST-01','A'],['EST-02','INVALID']]);
  assert.equal((await call('teacher','/excel-import',teacher,{fileBase64:book.toString('base64')})).status,400);
  assert.deepEqual(store.load(),before);
  // Export edited in Excel and reimported updates both apps with the same grade.
  const exported = await call('teacher','/excel-export',teacher); assert.equal(exported.status,200);
  const sheet = await readWorkbook(new Uint8Array(await exported.arrayBuffer()));
  const column = store.load().assignments.findIndex(a=>a.id===assignment.id)+2;
  sheet[1][column] = 'B';
  assert.equal((await call('teacher','/excel-import',teacher,{fileBase64:(await workbookBuffer(sheet)).toString('base64')})).status,200);
  assert.equal(store.load().grades.find(g=>g.studentId==='est-1'&&g.assignmentId===assignment.id)!.grade,'B');
  const officialGrades = structuredClone(store.load().grades);
  const reading = { status: 'read', grade: 'AD', confidence: 95 };
  assert.equal((await call('student','/submissions',student,{assignmentId:assignment.id,photoUrl:photo,photoReading:reading})).status,200);
  assert.deepEqual(store.load().grades,officialGrades, 'A photo reading must never overwrite or delete official grades');
  assert.deepEqual(store.load().submissions.find(s=>s.assignmentId===assignment.id)!.photoReading,reading);
  assert.equal((await call('student','/submissions',student,{assignmentId:assignment.id,photoUrl:photo,photoReading:{...reading,confidence:20}})).status,400);
  const invalidGrade = await call('teacher','/grades',teacher,{assignmentId:assignment.id,studentId:'est-1',grade:'X'}); assert.equal(invalidGrade.status,400);
  assert.equal((await call('teacher','/assignments',teacher,{title:'Bad date',subject:'X',dueDate:'2026-02-31'})).status,400);
  await call('student','/auth/logout',student,{});
  assert.equal((await call('student','/state',student)).status,401);
  controller.abort();
  assert.equal((await call('teacher',`/assignments/${assignment.id}`,teacher,{},'DELETE')).status,200);
  assert.ok(!store.load().submissions.some(s=>s.assignmentId===assignment.id));
  assert.equal((await call('teacher','/state',teacher)).status,200);
  store.db.prepare('UPDATE sessions SET expires=0').run();
  assert.equal((await call('student','/state',student2)).status,401);
  for (let i=0;i<10;i++) assert.equal((await call('teacher','/auth/login','',{username:'unknown-user',password:'wrong-password'})).status,401);
  assert.equal((await call('teacher','/auth/login','',{username:'unknown-user',password:'wrong-password'})).status,429);
});
