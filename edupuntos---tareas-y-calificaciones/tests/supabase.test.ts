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
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
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
  const photoMigration = readFileSync(new URL('../supabase/migrations/002_photo_authorization.sql', import.meta.url), 'utf8');
  await db.exec(photoMigration);
  await db.exec(photoMigration);
  const comparisonMigration = readFileSync(new URL('../supabase/migrations/003_photo_grade_comparison.sql', import.meta.url), 'utf8');
  await db.exec(comparisonMigration);
  await db.exec(comparisonMigration);
  const registrationMigration = readFileSync(new URL('../supabase/migrations/004_student_registration.sql', import.meta.url), 'utf8');
  await db.exec(registrationMigration); await db.exec(registrationMigration);
  await db.exec(readFileSync(new URL('../supabase/demo.sql', import.meta.url),'utf8'));
  const legacy = (await db.query('select id,name from public.edu_students order by id')).rows;
  const classroomMigration = readFileSync(new URL('../supabase/migrations/005_classrooms.sql', import.meta.url), 'utf8');
  await db.exec(classroomMigration); await db.exec(classroomMigration);
  assert.equal((await db.query('select * from public.edu_classrooms')).rows.length,20);
  assert.deepEqual((await db.query('select id,name from public.edu_students order by id')).rows,legacy);
  assert.equal((await db.query('select * from public.edu_students where classroom_id is null')).rows.length,legacy.length);
  await db.exec(readFileSync(new URL('../supabase/demo.sql', import.meta.url),'utf8'));
  for (const [id,email] of [[teacher,'teacher@test.invalid'],[student,'one@test.invalid'],[other,'two@test.invalid'],[outsider,'unassigned@test.invalid']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  }
  await db.query("insert into public.edu_profiles values($1,'teacher',null),($2,'student','est-1'),($3,'student','est-2')",[teacher,student,other]);
  await db.exec("update public.edu_students set classroom_id='sec-1-a'; update public.edu_assignments set classroom_id='sec-1-a';");
  await db.query("insert into public.edu_teacher_classrooms values($1,'sec-1-a')",[teacher]);
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
  await t.test('reassigned students cannot read or delete homework still belonging to their previous student profile', async () => {
    await db.exec('reset role');
    await db.query("update public.edu_profiles set student_id='est-3' where user_id=$1", [student]);
    await as(student);
    try {
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0, 'Old-profile photos remained readable');
      assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0, 'RLS hid the reference and allowed its photo to be deleted');
      await assert.rejects(db.query("select public.edu_submit('asg-2',$1,'')", [`${student}/photo.png`]), /no te pertenece/);
    } finally {
      await db.exec('reset role');
      await db.query("update public.edu_profiles set student_id='est-1' where user_id=$1", [student]);
    }
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
  await t.test('photo readings are private, validated and never replace official grades', async () => {
    await as(teacher); await db.query("select public.edu_set_grade('asg-1','est-1','B')");
    await as(student);
    const reading = {status:'read',grade:'AD',confidence:95};
    await db.query("select public.edu_submit('asg-1',$1,'',$2::jsonb)",[`${student}/photo.png`,JSON.stringify(reading)]);
    assert.deepEqual((await state()).submissions[0].photoReading,reading);
    assert.equal((await state()).grades[0].grade,'B');
    assert.equal((await state()).ranking.find((s:any)=>s.student.id==='est-1').totalPoints,6);
    for (const invalid of [{...reading,confidence:20},{...reading,grade:'X'}, {}, {status:'uncertain',grade:'A',confidence:95}]) {
      await assert.rejects(db.query("select public.edu_submit('asg-1',$1,'',$2::jsonb)",[`${student}/photo.png`,JSON.stringify(invalid)]),/check constraint/);
    }
    await as(other); assert.equal((await state()).submissions.length,0);
    await as(teacher); assert.deepEqual((await state()).submissions[0].photoReading,reading);
    await as('', 'anon');
    await assert.rejects(db.query("select public.edu_submit('asg-1','x','','{}'::jsonb)"),/permission denied/);
  });
  await t.test('resubmission preserves the official grade; deleting a task removes dependent school records',async () => {
    await as(teacher); await db.query("select public.edu_set_grade('asg-1','est-1','A')");
    await as(student); await db.query("select public.edu_submit('asg-1',$1,'Segunda entrega')",[`${student}/photo.png`]);
    assert.equal((await state()).grades[0].grade,'A');
    assert.equal((await state()).submissions[0].photoReading,null);
    await as(teacher); await db.query("select public.edu_delete_assignment('asg-1')");
    assert.equal((await state()).submissions.length,0); assert.equal((await state()).grades.length,0);
    assert.equal((await state()).assignments.length,2);
  });
  await t.test('student registration confirms email, ignores forged roles and keeps DNI private', async () => {
    await db.exec('reset role');
    const id = '20000000-0000-4000-8000-000000000001';
    const metadata = { signup_kind:'student', classroom_id:'sec-1-a', first_name:'Ana María', last_name:'Prueba', dni:'00123456', role:'teacher', student_id:'est-1' };
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,'ana@example.invalid',metadata]);
    assert.equal((await db.query('select * from public.edu_profiles where user_id=$1',[id])).rows.length,0);
    await as(id); await assert.rejects(state(),/perfil asignado/);
    await assert.rejects(db.query('select * from public.edu_student_accounts'),/permission denied/);
    await assert.rejects(db.query("select public.edu_login_email('00123456',repeat('a',64))"),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),$1,$2)',['duplicate@example.invalid',metadata]),/unique constraint/);
    await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),$1,$2)',['bad@example.invalid',{...metadata,dni:'bad'}]),/check constraint/);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
    await as(id);
    const profile = (await db.query<{profile:any}>('select public.edu_current_user() as profile')).rows[0].profile;
    assert.equal(profile.role,'student'); assert.equal(profile.studentId,`est-${id}`);
    const own = await state(); assert.equal(own.students[0].name,'Ana María Prueba');
    assert.equal(JSON.stringify(own).includes('00123456'),false);
    assert.equal(JSON.stringify(own).includes('ana@example.invalid'),false);
    await assert.rejects(db.query("select public.edu_set_rewards('Uno','Dos','Tres')"),/permiso/);
    await db.exec('reset role');
    await db.query('update auth.users set raw_user_meta_data=$2,email_confirmed_at=now() where id=$1',[id,{...metadata,dni:'87654321',role:'teacher',classroom_id:'sec-5-d'}]);
    assert.equal((await db.query<{dni:string}>('select dni from public.edu_student_accounts where user_id=$1',[id])).rows[0].dni,'00123456');
    assert.equal((await db.query<{classroom_id:string}>('select classroom_id from public.edu_students where id=$1',[`est-${id}`])).rows[0].classroom_id,'sec-1-a');
    await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),$1,$2)',['badclass@example.invalid',{...metadata,dni:'12345678',classroom_id:'sec-6-a'}]),/aula válida/);
    await as(teacher); await assert.rejects(db.query('select * from public.edu_student_accounts'),/permission denied/);
    await as('', 'anon'); await assert.rejects(db.query("select public.edu_login_email('00123456',repeat('a',64))"),/permission denied/);
    await as('', 'service_role');
    for(let i=0;i<10;i++) {
      const result = (await db.query<{result:any}>("select public.edu_login_email('00123456',repeat('a',64)) as result")).rows[0].result;
      assert.deepEqual(result,{allowed:true,email:'ana@example.invalid'});
    }
    assert.deepEqual((await db.query<{result:any}>("select public.edu_login_email('00123456',repeat('b',64)) as result")).rows[0].result,{allowed:false,email:null});
  });
  await t.test('assigned classrooms isolate teachers, student records, photos, rewards and atomic Excel imports', async () => {
    await db.exec('reset role');
    const teacher2='30000000-0000-4000-8000-000000000001', student3='30000000-0000-4000-8000-000000000002';
    await db.query("insert into auth.users(id,email) values($1,'teacher2@test.invalid'),($2,'three@test.invalid')",[teacher2,student3]);
    await db.exec("insert into public.edu_students(id,code,name,avatar,classroom_id) values('pilot-3','PILOT-3','Alumno de 2B','','sec-2-b')");
    await db.query("insert into public.edu_profiles values($1,'teacher',null),($2,'student','pilot-3'),($3,'teacher',null)",[teacher2,student3,outsider]);
    await db.query("insert into public.edu_teacher_classrooms values($1,'sec-2-b')",[teacher2]);
    await as(outsider);
    assert.deepEqual((await db.query<{p:any}>('select public.edu_current_user() p')).rows[0].p.classrooms,[]);
    await assert.rejects(state(),/aula/);
    await as(teacher2);
    await db.exec("select public.edu_create_assignment('Solo 2B','Comunicación','2026-12-01','','sec-2-b')");
    const b = await state(), task=b.assignments[0].id;
    assert.deepEqual(b.students.map((s:any)=>s.id),['pilot-3']);
    assert.equal(b.ranking.length,1);
    assert.equal(b.classroom.id,'sec-2-b');
    await db.exec("select public.edu_set_rewards('Premio 2B','Dos','Tres','sec-2-b')");
    await as(student3);
    await db.query("insert into storage.objects(bucket_id,name) values('edupuntos-homework',$1)",[`${student3}/homework.png`]);
    await db.query("select public.edu_submit($1,$2,'',null,'sec-2-b')",[task,`${student3}/homework.png`]);
    await assert.rejects(db.query("select public.edu_state('sec-1-a')"),/aula/);
    await assert.rejects(db.query("select public.edu_submit('asg-2',$1,'',null,'sec-2-b')",[`${student3}/homework.png`]),/aula/);
    await as(teacher);
    assert.equal((await state()).assignments.some((a:any)=>a.id===task),false);
    assert.equal((await state()).ranking.some((s:any)=>s.student.id==='pilot-3'),false);
    assert.notEqual((await state()).rewards.firstPlace,'Premio 2B');
    await assert.rejects(db.query("select public.edu_state('sec-2-b')"),/aula/);
    await assert.rejects(db.query("select public.edu_delete_assignment($1,'sec-1-a')",[task]),/aula/);
    await assert.rejects(db.query("select public.edu_set_grade('asg-2','pilot-3','AD',null,'sec-1-a')"),/aula/);
    await assert.rejects(db.query("insert into public.edu_teacher_classrooms values($1,'sec-2-b')",[teacher]),/permission denied/);
    await assert.rejects(db.query("update public.edu_students set classroom_id='sec-1-a' where id='pilot-3'"),/permission denied/);
    assert.equal((await db.query("select * from public.edu_students where id='pilot-3'")).rows.length,0);
    assert.equal((await db.query('select * from public.edu_assignments where id=$1',[task])).rows.length,0);
    assert.equal((await db.query("select * from storage.objects where name=$1",[`${student3}/homework.png`])).rows.length,0);
    const before=await state();
    await assert.rejects(db.query("select public.edu_import_grades($1::jsonb,'sec-1-a')",[JSON.stringify([
      {studentId:'est-1',assignmentId:'asg-2',grade:'A'}, {studentId:'pilot-3',assignmentId:task,grade:'AD'},
    ])]),/aula/);
    assert.deepEqual(await state(),before);
    await as(teacher2);
    assert.equal((await db.query("select * from storage.objects where name=$1",[`${student3}/homework.png`])).rows.length,1);
    await db.query("select public.edu_set_grade($1,'pilot-3','AD',null,'sec-2-b')",[task]);
    await as(student3); assert.equal((await state()).grades[0].grade,'AD');
    await as(student); assert.equal((await state()).grades.some((g:any)=>g.studentId==='pilot-3'),false);
    // Permission changes apply to existing sessions, not just the classroom dropdown.
    await db.exec('reset role');
    await db.query("insert into public.edu_teacher_classrooms values($1,'sec-2-b')",[teacher]);
    await as(teacher); await assert.rejects(state(),/aula/); // Multiple classrooms require an explicit choice.
    assert.equal((await db.query<{s:any}>("select public.edu_state('sec-2-b') s")).rows[0].s.students.length,1);
    await db.exec('reset role');
    await db.query("delete from public.edu_teacher_classrooms where user_id=$1 and classroom_id='sec-2-b'",[teacher]);
    await as(teacher); await assert.rejects(db.query("select public.edu_state('sec-2-b')"),/aula/);
  });

  await t.test('pilot administration is repeatable and rolls back if either confirmed teacher is missing', async () => {
    await db.exec('reset role');
    const script=readFileSync(new URL('../supabase/pilot.example.sql',import.meta.url),'utf8');
    await assert.rejects(db.exec(script),/Sustituye/); await db.exec('rollback');
    const id1='40000000-0000-4000-8000-000000000001',id2='40000000-0000-4000-8000-000000000002';
    const sql=script.replaceAll('profesor1@example.invalid','pilot-one@test.invalid').replaceAll('profesor2@example.invalid','pilot-two@test.invalid');
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'pilot-one@test.invalid',now())",[id1]);
    await assert.rejects(db.exec(sql),/Falta una cuenta confirmada/); await db.exec('rollback');
    assert.equal((await db.query('select * from public.edu_profiles where user_id=$1',[id1])).rows.length,0);
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'pilot-two@test.invalid',now())",[id2]);
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual((await db.query('select classroom_id from public.edu_teacher_classrooms where user_id in ($1,$2) order by classroom_id',[id1,id2])).rows.map((r:any)=>r.classroom_id),['sec-1-a','sec-2-b']);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[student]);
    await assert.rejects(db.exec(sql.replaceAll('pilot-one@test.invalid','one@test.invalid')),/ya pertenece a un alumno/); await db.exec('rollback');
    await db.query("insert into public.edu_teacher_classrooms values($1,'sec-3-a')",[id1]);
    await assert.rejects(db.exec(sql),/ya tiene otras aulas/); await db.exec('rollback');
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
