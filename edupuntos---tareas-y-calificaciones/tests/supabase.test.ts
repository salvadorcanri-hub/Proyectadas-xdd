import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { validateSupabaseConfig } from '../scripts/supabase-config.mjs';

const teacher = '10000000-0000-4000-8000-000000000001';
const student = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const outsider = '10000000-0000-4000-8000-000000000004';

test('Supabase SQL: roles, private storage, transactions, ranking and change notifications', async t => {
  // PostgreSQL engine; only the Supabase-owned auth/storage schemas are stubbed.
  // This tests SQL/RLS, not the hosted Auth, Storage HTTP or Realtime services.
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public, storage to anon, authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  const migration = readFileSync(new URL('../supabase/migrations/001_edupuntos.sql', import.meta.url),'utf8');
  await db.exec(migration);
  await db.exec(migration); // Reapplying cannot erase classroom data or loosen policies.
  await db.exec(readFileSync(new URL('../supabase/demo.sql', import.meta.url),'utf8'));
  for (const [id,email] of [[teacher,'teacher@test.invalid'],[student,'one@test.invalid'],[other,'two@test.invalid'],[outsider,'unassigned@test.invalid']]) {
    await db.query('insert into auth.users values($1,$2)',[id,email]);
  }
  await db.query("insert into public.edu_profiles values($1,'teacher',null),($2,'student','est-1'),($3,'student','est-2')",[teacher,student,other]);
  async function as(id: string, role = 'authenticated') {
    await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec(`set role ${role}`);
  }
  async function state() { return (await db.query<{state:any}>('select public.edu_state() as state')).rows[0].state; }
  await t.test('anonymous and unassigned accounts cannot read classroom state or grant themselves a role',async () => {
    await as('', 'anon'); await assert.rejects(db.query('select public.edu_state()'),/permission denied/);
    await as(outsider); await assert.rejects(state(),/perfil asignado/);
    await assert.rejects(db.query("insert into public.edu_profiles values($1,'teacher',null)",[outsider]),/permission denied/);
    assert.equal((await db.query('select * from public.edu_students')).rows.length,0);
  });
  await t.test('a student cannot write grades, assignments, rewards, imports or profiles',async () => {
    await as(student);
    for(const query of [
      "select public.edu_set_grade('asg-1','est-1','AD')",
      "select public.edu_create_assignment('Tarea','Materia','2026-12-01','')",
      "select public.edu_delete_assignment('asg-1')",
      "select public.edu_set_rewards('Uno','Dos','Tres')",
      `select public.edu_import_grades('[{"studentId":"est-1","assignmentId":"asg-1","grade":"AD"}]')`,
    ]) await assert.rejects(db.query(query),/permiso/);
    await assert.rejects(db.query("update public.edu_profiles set role='teacher',student_id=null where user_id=auth.uid()"),/permission denied/);
    await assert.rejects(db.query("insert into public.edu_grades(student_id,assignment_id,grade) values('est-1','asg-1','AD')"),/permission denied/);
    await assert.rejects(db.query("select public.edu_require_role()"),/permission denied/);
    assert.equal((await db.query('select * from public.edu_students')).rows.length,1);
  });
  await t.test('photo uploads are owned, private, immutable and only the owner can submit them',async () => {
    await as(student);
    await db.query("insert into storage.objects(bucket_id,name) values('edupuntos-homework',$1)",[`${student}/photo.png`]);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('edupuntos-homework',$1)",[`${other}/forged.png`]),/row-level security/);
    await db.query("select public.edu_submit('asg-1',$1,'Mi tarea')",[`${student}/photo.png`]);
    assert.equal((await state()).ranking.find((s:any)=>s.student.id==='est-1').gradesCount.awaitingReview,1);
    assert.equal((await state()).ranking.find((s:any)=>s.student.id==='est-1').gradesCount.unsubmitted,2);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id",[`${student}/photo.png`])).rows.length,0);
    assert.equal((await db.query("update storage.objects set name='changed' where name=$1 returning id",[`${student}/photo.png`])).rows.length,0);
    await as(other);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await assert.rejects(db.query("select public.edu_submit('asg-1',$1,'')",[`${student}/photo.png`]),/no te pertenece/);
    assert.equal((await state()).submissions.length,0);
    await as(teacher); assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  });
  await t.test('teacher grading changes the revision and private feedback is visible only to its student',async () => {
    await as(teacher);
    const before = (await db.query<{revision:number}>('select revision from public.edu_changes')).rows[0].revision;
    await db.query("select public.edu_set_grade('asg-1','est-1','AD','Bien hecho')");
    assert.ok((await db.query<{revision:number}>('select revision from public.edu_changes')).rows[0].revision > before);
    const teacherState = await state();
    await as(student); const studentState = await state();
    assert.equal(studentState.students.length,1); assert.equal(studentState.grades[0].feedback,'Bien hecho');
    assert.equal(studentState.ranking[0].totalPoints,10);
    assert.deepEqual(studentState.ranking.map((s:any)=>[s.student.id,s.rank]),teacherState.ranking.map((s:any)=>[s.student.id,s.rank]));
    await as(other); assert.equal((await state()).grades.length,0);
    assert.equal((await db.query('select * from public.edu_grades')).rows.length,0);
  });
  await t.test('Excel imports revalidate on the server and invalid batches roll back',async () => {
    await as(teacher); const before = await state();
    const invalid = [{studentId:'est-1',assignmentId:'asg-1',grade:'C'},{studentId:'est-2',assignmentId:'asg-1',grade:'INVALID'}];
    await assert.rejects(db.query('select public.edu_import_grades($1::jsonb)',[JSON.stringify(invalid)]),/check constraint/);
    assert.deepEqual(await state(),before);
    await assert.rejects(db.query('select public.edu_import_grades($1::jsonb)',[JSON.stringify([invalid[0],invalid[0]])]),/duplicadas/);
    await assert.rejects(db.query("select public.edu_import_grades('[{}]')"),/incompleta/);
    await db.query('select public.edu_import_grades($1::jsonb)',[JSON.stringify([{studentId:'est-1',assignmentId:'asg-1',grade:null},{studentId:'est-2',assignmentId:'asg-1',grade:'A'}])]);
    assert.equal((await state()).ranking[0].student.id,'est-2');
    assert.equal((await state()).grades.find((g:any)=>g.studentId==='est-1').feedback,'Bien hecho');
  });
  await t.test('resubmission clears the old grade; deleting a task removes dependent school records',async () => {
    await as(teacher); await db.query("select public.edu_set_grade('asg-1','est-1','A')");
    await as(student); await db.query("select public.edu_submit('asg-1',$1,'Segunda entrega')",[`${student}/photo.png`]);
    assert.equal((await state()).grades.length,0);
    await as(teacher); await db.query("select public.edu_delete_assignment('asg-1')");
    assert.equal((await state()).submissions.length,0); assert.equal((await state()).grades.length,0);
    assert.equal((await state()).assignments.length,2);
  });
});

test('Netlify accepts public configuration and rejects secret/service-role keys', () => {
  const url = 'https://test-project.supabase.co';
  assert.doesNotThrow(()=>validateSupabaseConfig(url,'sb_publishable_TEST_ONLY'));
  const jwt = (role:string) => `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
  assert.doesNotThrow(()=>validateSupabaseConfig(url,jwt('anon')));
  for(const key of [undefined,'sb_secret_DO_NOT_USE',jwt('service_role'),'password']) assert.throws(()=>validateSupabaseConfig(url,key));
  assert.throws(()=>validateSupabaseConfig('https://user:password@example.com','sb_publishable_TEST_ONLY'));
});
