-- EduPuntos: one school classroom per Supabase project.
-- Run as administrator in the Supabase SQL Editor. No passwords or keys belong here.
begin;

create table if not exists public.edu_students (
  id text primary key, code text not null unique, name text not null check (length(name) between 1 and 200), avatar text not null default ''
);
create table if not exists public.edu_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  student_id text unique references public.edu_students(id),
  check ((role = 'student') = (student_id is not null))
);
create table if not exists public.edu_assignments (
  id text primary key default ('asg-' || gen_random_uuid()::text),
  title text not null check (length(trim(title)) between 1 and 200),
  subject text not null check (length(trim(subject)) between 1 and 100),
  description text not null default '' check (length(description) <= 5000),
  due_date date not null, created_at timestamptz not null default now()
);
create table if not exists public.edu_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.edu_students(id),
  assignment_id text not null references public.edu_assignments(id) on delete cascade,
  photo_path text not null, submitted_at timestamptz not null default now(),
  comment text not null default '' check (length(comment) <= 2000),
  unique(student_id, assignment_id)
);
create table if not exists public.edu_grades (
  student_id text not null references public.edu_students(id),
  assignment_id text not null references public.edu_assignments(id) on delete cascade,
  grade text check (grade in ('AD','A','B','C')),
  feedback text not null default '' check (length(feedback) <= 2000),
  updated_at timestamptz not null default now(), primary key(student_id, assignment_id)
);
create table if not exists public.edu_rewards (
  id boolean primary key default true check(id),
  first_place text not null check(length(trim(first_place)) between 1 and 500),
  second_place text not null check(length(trim(second_place)) between 1 and 500),
  third_place text not null check(length(trim(third_place)) between 1 and 500)
);
insert into public.edu_rewards values (true, 'Medalla de oro', 'Medalla de plata', 'Medalla de bronce') on conflict do nothing;
create table if not exists public.edu_changes (
  id boolean primary key default true check(id), revision bigint not null default 0
);
insert into public.edu_changes values (true, 0) on conflict do nothing;

-- Only administrators assign profiles. Client-supplied Auth metadata never grants a role.
create or replace function public.edu_require_role(expected text default null)
returns public.edu_profiles language plpgsql stable security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  select * into p from public.edu_profiles where user_id = auth.uid();
  if not found then raise exception 'Tu cuenta no tiene un perfil asignado. Contacta al administrador.' using errcode = '42501'; end if;
  if expected is not null and p.role <> expected then raise exception 'No tienes permiso para esta operación.' using errcode = '42501'; end if;
  return p;
end $$;
create or replace function public.edu_is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.edu_profiles where user_id = auth.uid() and role = 'teacher');
$$;
create or replace function public.edu_current_user()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  p := public.edu_require_role();
  return jsonb_build_object('id', p.user_id, 'username', coalesce((select email from auth.users where id=p.user_id), ''), 'role', p.role, 'studentId', p.student_id);
end $$;

-- RLS protects direct REST access too. Writes are allowed only through checked RPCs.
alter table public.edu_students enable row level security;
alter table public.edu_profiles enable row level security;
alter table public.edu_assignments enable row level security;
alter table public.edu_submissions enable row level security;
alter table public.edu_grades enable row level security;
alter table public.edu_rewards enable row level security;
alter table public.edu_changes enable row level security;
revoke all on public.edu_students, public.edu_profiles, public.edu_assignments, public.edu_submissions, public.edu_grades, public.edu_rewards, public.edu_changes from anon, authenticated;
grant select on public.edu_students, public.edu_profiles, public.edu_assignments, public.edu_submissions, public.edu_grades, public.edu_rewards, public.edu_changes to authenticated;
drop policy if exists edu_profile_read on public.edu_profiles;
create policy edu_profile_read on public.edu_profiles for select to authenticated using (user_id=auth.uid());
drop policy if exists edu_students_read on public.edu_students;
create policy edu_students_read on public.edu_students for select to authenticated using (public.edu_is_teacher() or id=(select student_id from public.edu_profiles where user_id=auth.uid()));
drop policy if exists edu_assignments_read on public.edu_assignments;
create policy edu_assignments_read on public.edu_assignments for select to authenticated using (exists(select 1 from public.edu_profiles where user_id=auth.uid()));
drop policy if exists edu_submissions_read on public.edu_submissions;
create policy edu_submissions_read on public.edu_submissions for select to authenticated using (public.edu_is_teacher() or student_id=(select student_id from public.edu_profiles where user_id=auth.uid()));
drop policy if exists edu_grades_read on public.edu_grades;
create policy edu_grades_read on public.edu_grades for select to authenticated using (public.edu_is_teacher() or student_id=(select student_id from public.edu_profiles where user_id=auth.uid()));
drop policy if exists edu_rewards_read on public.edu_rewards;
create policy edu_rewards_read on public.edu_rewards for select to authenticated using (exists(select 1 from public.edu_profiles where user_id=auth.uid()));
drop policy if exists edu_changes_read on public.edu_changes;
create policy edu_changes_read on public.edu_changes for select to authenticated using (exists(select 1 from public.edu_profiles where user_id=auth.uid()));

-- One projection shared by both apps and Excel; private details are only returned to their owner/teacher.
create or replace function public.edu_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.edu_profiles; result jsonb; ranking jsonb;
begin
  p := public.edu_require_role();
  with totals as (
    select s.id, s.name, s.code, s.avatar,
      coalesce(sum(case g.grade when 'AD' then 10 when 'A' then 8 when 'B' then 6 when 'C' then 4 else 0 end),0) as points,
      count(g.grade) as completed, count(a.id) as total,
      count(*) filter(where g.grade='AD') as ad, count(*) filter(where g.grade='A') as a,
      count(*) filter(where g.grade='B') as b, count(*) filter(where g.grade='C') as c,
      count(a.id) filter(where g.grade is null and sub.id is null) as pending,
      count(a.id) filter(where g.grade is null and sub.id is not null) as reviewing
    from public.edu_students s left join public.edu_assignments a on true
    left join public.edu_grades g on g.student_id=s.id and g.assignment_id=a.id
    left join public.edu_submissions sub on sub.student_id=s.id and sub.assignment_id=a.id
    group by s.id
  ), ranked as (
    select *, row_number() over(order by points desc, completed desc, lower(name) collate "C", id collate "C") as rank from totals
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'student', jsonb_build_object('id',id,'name',name,'code',case when p.role='teacher' then code else '' end,'avatar',avatar),
      'totalPoints',points,'assignmentsCompleted',completed,'totalAssignments',total,'rank',rank,
      'gradesCount',jsonb_build_object('AD',ad,'A',a,'B',b,'C',c,'unsubmitted',pending,'awaitingReview',reviewing)
    ) order by rank), '[]'::jsonb) into ranking from ranked;
  result := jsonb_build_object(
    'students', (select coalesce(jsonb_agg(to_jsonb(s) order by code),'[]'::jsonb) from public.edu_students s where p.role='teacher' or s.id=p.student_id),
    'assignments', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'subject',subject,'description',description,'dueDate',due_date,'createdAt',created_at) order by created_at,id),'[]'::jsonb) from public.edu_assignments),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'assignmentId',assignment_id,'photoUrl',photo_path,'submittedAt',submitted_at,'comment',comment) order by submitted_at),'[]'::jsonb) from public.edu_submissions where p.role='teacher' or student_id=p.student_id),
    'grades', (select coalesce(jsonb_agg(jsonb_build_object('studentId',student_id,'assignmentId',assignment_id,'grade',grade,'feedback',feedback,'updatedAt',updated_at)),'[]'::jsonb) from public.edu_grades where p.role='teacher' or student_id=p.student_id),
    'rewards', (select jsonb_build_object('firstPlace',first_place,'secondPlace',second_place,'thirdPlace',third_place) from public.edu_rewards where id),
    'ranking', ranking);
  return result;
end $$;

create or replace function public.edu_create_assignment(p_title text, p_subject text, p_due_date date, p_description text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.edu_require_role('teacher');
  insert into public.edu_assignments(title,subject,due_date,description) values(trim(p_title),trim(p_subject),p_due_date,coalesce(p_description,''));
end $$;
create or replace function public.edu_delete_assignment(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.edu_require_role('teacher');
  delete from public.edu_assignments where id=p_id;
  if not found then raise exception 'La tarea no existe.'; end if;
end $$;
create or replace function public.edu_set_grade(p_assignment_id text, p_student_id text, p_grade text, p_feedback text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.edu_require_role('teacher');
  insert into public.edu_grades as g(assignment_id,student_id,grade,feedback) values(p_assignment_id,p_student_id,p_grade,coalesce(p_feedback,''))
    on conflict(student_id,assignment_id) do update set grade=excluded.grade, feedback=coalesce(p_feedback,g.feedback), updated_at=now();
end $$;
create or replace function public.edu_set_rewards(p_first text, p_second text, p_third text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.edu_require_role('teacher');
  update public.edu_rewards set first_place=trim(p_first), second_place=trim(p_second), third_place=trim(p_third) where id;
end $$;

-- The bucket stays private. Use signed URLs to view images, never public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('edupuntos-homework','edupuntos-homework',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists edu_photo_insert on storage.objects;
create policy edu_photo_insert on storage.objects for insert to authenticated with check (
  bucket_id='edupuntos-homework' and split_part(name,'/',1)=auth.uid()::text
  and exists(select 1 from public.edu_profiles where user_id=auth.uid() and role='student')
);
drop policy if exists edu_photo_read on storage.objects;
create policy edu_photo_read on storage.objects for select to authenticated using (
  bucket_id='edupuntos-homework' and (
    (split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.edu_profiles where user_id=auth.uid() and role='student'))
    or (public.edu_is_teacher() and exists(select 1 from public.edu_submissions where photo_path=name))
  )
);
-- Permit students to remove only unused uploads (e.g. when submission validation fails).
drop policy if exists edu_photo_delete on storage.objects;
create policy edu_photo_delete on storage.objects for delete to authenticated using (
  bucket_id='edupuntos-homework' and split_part(name,'/',1)=auth.uid()::text
  and exists(select 1 from public.edu_profiles where user_id=auth.uid() and role='student')
  and not exists(select 1 from public.edu_submissions where photo_path=name)
);
create or replace function public.edu_submit(p_assignment_id text, p_photo_path text, p_comment text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  p := public.edu_require_role('student');
  if split_part(p_photo_path,'/',1) <> auth.uid()::text or not exists (
    select 1 from storage.objects where bucket_id='edupuntos-homework' and name=p_photo_path
  ) then raise exception 'La imagen no existe o no te pertenece.' using errcode='42501'; end if;
  insert into public.edu_submissions(student_id,assignment_id,photo_path,comment) values(p.student_id,p_assignment_id,p_photo_path,coalesce(p_comment,''))
    on conflict(student_id,assignment_id) do update set photo_path=excluded.photo_path,comment=excluded.comment,submitted_at=now();
  delete from public.edu_grades where student_id=p.student_id and assignment_id=p_assignment_id;
end $$;

-- Excel parser runs in the teacher app, but the database revalidates ALL submitted changes.
-- One function call is one transaction: any invalid item rolls back the entire import.
create or replace function public.edu_import_grades(p_changes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; changes integer;
begin
  perform public.edu_require_role('teacher');
  if p_changes is null or jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'Importación inválida.'; end if;
  changes := jsonb_array_length(p_changes);
  if changes not between 1 and 10000 then raise exception 'Importa entre 1 y 10000 calificaciones por archivo.'; end if;
  if (select count(*) from (select distinct value->>'studentId',value->>'assignmentId' from jsonb_array_elements(p_changes)) d) <> changes
    then raise exception 'Hay calificaciones duplicadas.'; end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(item) <> 'object' or not (item ? 'grade') or not (item ? 'studentId') or not (item ? 'assignmentId') then raise exception 'Calificación incompleta.'; end if;
    perform public.edu_set_grade(item->>'assignmentId',item->>'studentId',item->>'grade');
  end loop;
  return changes;
end $$;

-- Realtime emits only a revision counter, not the entire private classroom state.
create or replace function public.edu_notify_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.edu_changes set revision=revision+1 where id;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['edu_students','edu_profiles','edu_assignments','edu_submissions','edu_grades','edu_rewards'] loop
    execute format('drop trigger if exists edu_changed on public.%I',t);
    execute format('create trigger edu_changed after insert or update or delete on public.%I for each statement execute function public.edu_notify_change()',t);
  end loop;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='edu_changes') then
    alter publication supabase_realtime add table public.edu_changes;
  end if;
end $$;

-- PostgreSQL otherwise gives PUBLIC execute on new functions; close that default.
revoke all on function public.edu_require_role(text) from public, anon, authenticated;
revoke all on function public.edu_notify_change() from public, anon, authenticated;
revoke all on function public.edu_is_teacher(), public.edu_current_user(), public.edu_state(), public.edu_create_assignment(text,text,date,text), public.edu_delete_assignment(text), public.edu_set_grade(text,text,text,text), public.edu_set_rewards(text,text,text), public.edu_submit(text,text,text), public.edu_import_grades(jsonb) from public, anon;
grant execute on function public.edu_is_teacher(), public.edu_current_user(), public.edu_state(), public.edu_create_assignment(text,text,date,text), public.edu_delete_assignment(text), public.edu_set_grade(text,text,text,text), public.edu_set_rewards(text,text,text), public.edu_submit(text,text,text), public.edu_import_grades(jsonb) to authenticated;
commit;
