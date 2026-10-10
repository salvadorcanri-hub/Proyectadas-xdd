import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { Store } from '../server/store';
import { seedState } from '../server/seed';
import { exportWorkbook, importRows } from '../server/excel';
import { calculateStudentScores } from '../src/utils/scoreCalculator';

function fixture(t: any) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'edupuntos-store-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('first startup initializes SQLite and persists without SSE initialization errors', t => {
  const dir = fixture(t); const store = new Store(dir);
  const state = store.load(); state.rewards.firstPlace = 'Premio guardado'; store.save(state); store.close();
  const reopened = new Store(dir); assert.equal(reopened.load().rewards.firstPlace, 'Premio guardado'); reopened.close();
});
test('legacy migration preserves source, backs it up, and moves embedded photos to files', t => {
  const dir = fixture(t); const state = seedState(); state.submissions[0].photoUrl = photo;
  const original = JSON.stringify(state); writeFileSync(path.join(dir, 'db.json'), original);
  const store = new Store(dir); const migrated = store.load();
  assert.match(migrated.submissions[0].photoUrl, /^\/files\/[a-f0-9]{64}\.png$/);
  assert.ok(readFileSync(path.join(dir, 'uploads', migrated.submissions[0].photoUrl.split('/').pop()!)).length > 0);
  assert.equal(readFileSync(path.join(dir, 'db.json'), 'utf8'), original);
  assert.equal(readFileSync(path.join(dir, 'db.json.backup'), 'utf8'), original);
  assert.deepEqual(migrated.grades, state.grades); store.close();
});
test('invalid migration fails rather than overwriting existing data', t => {
  const dir = fixture(t); writeFileSync(path.join(dir, 'db.json'), '{invalid');
  assert.throws(() => new Store(dir)); assert.equal(readFileSync(path.join(dir, 'db.json'), 'utf8'), '{invalid');
});
test('failed database writes roll back all grade changes', t => {
  const store = new Store(fixture(t)); const original = store.load(); const next = structuredClone(original);
  next.grades[0].grade = 'C'; next.grades.push({ studentId: 'missing', assignmentId: 'asg-1', grade: 'A', updatedAt: '' });
  assert.throws(() => store.save(next)); assert.deepEqual(store.load(), original); store.close();
});
test('submitted but ungraded tasks are awaiting review; Excel uses exactly the same ranking', () => {
  const state = seedState(); state.grades = [
    { studentId:'est-2', assignmentId:'asg-1', grade:'A', updatedAt:'' },
    { studentId:'est-1', assignmentId:'asg-1', grade:'C', updatedAt:'' },
    { studentId:'est-1', assignmentId:'asg-2', grade:'C', updatedAt:'' },
  ];
  const scores = calculateStudentScores(state);
  assert.equal(scores[0].student.id, 'est-1');
  const ungraded = scores.find(s => s.student.id === 'est-3')!;
  assert.equal(ungraded.gradesCount.awaitingReview, 1); assert.equal(ungraded.gradesCount.unsubmitted, 2);
  const book = XLSX.read(exportWorkbook(state), { type:'buffer' });
  const rows: any[] = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
  for (const score of scores) assert.equal(rows.find(r => r['CÓDIGO'] === score.student.code)['PUESTO'], score.rank);
});
test('Excel preserves blanks, allows explicit clearing, rejects unsafe mappings and invalid grades atomically', () => {
  const state = seedState(); const before = structuredClone(state);
  const headers = ['CÓDIGO', 'Fracciones [asg-1]', 'Ensayo [asg-2]'];
  const result = importRows(state, [headers, ['EST-01', '', 'BORRAR'], ['EST-02','10','']]);
  assert.equal(result.grades.find(g => g.studentId==='est-1' && g.assignmentId==='asg-1')!.grade, 'AD');
  assert.equal(result.grades.find(g => g.studentId==='est-1' && g.assignmentId==='asg-2')!.grade, null);
  assert.equal(result.count, 2);
  for (const rows of [
    [headers, ['EST-01','A',''], ['EST-02','TYPO','']],
    [headers, ['UNKNOWN','A','']],
    [headers, ['EST-01','A',''], ['EST-01','C','']],
    [['CÓDIGO','desconocida'],['EST-01','A']],
    [['CÓDIGO','Fracciones [asg-1]','duplicada [asg-1]'],['EST-01','A','B']],
    [headers, ['EST-01','','']],
  ]) assert.throws(() => importRows(state, rows));
  assert.deepEqual(state, before);
});
