-- Apply after 004. Exactly 20 classrooms; existing records remain unassigned.
begin;
create table if not exists public.edu_classrooms (
 id text primary key, grade integer not null check(grade between 1 and 5), section text not null check(section in ('A','B','C','D')),
 unique(grade,section), check(id='sec-' || grade::text || '-' || lower(section))
);
insert into public.edu_classrooms select 'sec-' || g::text || '-' || lower(s),g,s from generate_series(1,5) g cross join unnest(array['A','B','C','D']) s on conflict do nothing;
create table if not exists public.edu_teacher_classrooms (
 user_id uuid not null references auth.users(id) on delete cascade, classroom_id text not null references public.edu_classrooms(id), primary key(user_id,classroom_id)
);
alter table public.edu_students add column if not exists classroom_id text references public.edu_classrooms(id);
alter table public.edu_assignments add column if not exists classroom_id text references public.edu_classrooms(id);
alter table public.edu_student_accounts add column if not exists classroom_id text references public.edu_classrooms(id);
create index if not exists edu_students_classroom on public.edu_students(classroom_id);
create index if not exists edu_assignments_classroom on public.edu_assignments(classroom_id);
create table if not exists public.edu_classroom_rewards (
 classroom_id text primary key references public.edu_classrooms(id),
 first_place text not null check(length(trim(first_place)) between 1 and 500),
 second_place text not null check(length(trim(second_place)) between 1 and 500),
 third_place text not null check(length(trim(third_place)) between 1 and 500)
);
insert into public.edu_classroom_rewards select c.id,r.first_place,r.second_place,r.third_place from public.edu_classrooms c cross join public.edu_rewards r on conflict do nothing;
alter table public.edu_classrooms enable row level security;
alter table public.edu_teacher_classrooms enable row level security;
alter table public.edu_classroom_rewards enable row level security;
revoke all on public.edu_classrooms,public.edu_teacher_classrooms,public.edu_classroom_rewards from public,anon,authenticated;
grant select on public.edu_classrooms,public.edu_teacher_classrooms,public.edu_classroom_rewards to authenticated;

create or replace function public.edu_can_access_classroom(p_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.edu_profiles p where p.user_id=auth.uid() and (
  (p.role='teacher' and exists(select 1 from public.edu_teacher_classrooms t where t.user_id=p.user_id and t.classroom_id=p_id)) or
  (p.role='student' and exists(select 1 from public.edu_students s where s.id=p.student_id and s.classroom_id=p_id))));
$$;
revoke all on function public.edu_can_access_classroom(text) from public,anon;
grant execute on function public.edu_can_access_classroom(text) to authenticated;
create or replace function public.edu_require_classroom(p_id text default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare p public.edu_profiles; chosen text;
begin
 p:=public.edu_require_role(); chosen:=p_id;
 if chosen is null then
  if p.role='student' then select classroom_id into chosen from public.edu_students where id=p.student_id;
  else select min(classroom_id) into chosen from public.edu_teacher_classrooms where user_id=p.user_id having count(*)=1; end if;
 end if;
 if chosen is null or not public.edu_can_access_classroom(chosen) then raise exception 'No tienes permiso para esta aula. Solicita la asignación al administrador.' using errcode='42501'; end if;
 return chosen;
end $$;
revoke all on function public.edu_require_classroom(text) from public,anon,authenticated;
create or replace function public.edu_classrooms_available() returns boolean language sql stable set search_path='' as $$select true$$;
revoke all on function public.edu_classrooms_available() from public;
grant execute on function public.edu_classrooms_available() to anon,authenticated;
create or replace function public.edu_current_user()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.edu_profiles;
begin
 p:=public.edu_require_role();
 return jsonb_build_object('id',p.user_id,'username',coalesce((select email from auth.users where id=p.user_id),''),'role',p.role,'studentId',p.student_id,
 'classrooms',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'grade',c.grade,'section',c.section,'name',c.grade::text || '.º de secundaria · ' || c.section) order by c.grade,c.section),'[]'::jsonb) from public.edu_classrooms c where public.edu_can_access_classroom(c.id)));
end $$;
drop policy if exists edu_classroom_read on public.edu_classrooms;
create policy edu_classroom_read on public.edu_classrooms for select to authenticated using(public.edu_can_access_classroom(id));
drop policy if exists edu_teacher_classroom_read on public.edu_teacher_classrooms;
create policy edu_teacher_classroom_read on public.edu_teacher_classrooms for select to authenticated using(user_id=auth.uid());
drop policy if exists edu_classroom_rewards_read on public.edu_classroom_rewards;
create policy edu_classroom_rewards_read on public.edu_classroom_rewards for select to authenticated using(public.edu_can_access_classroom(classroom_id));
drop policy if exists edu_students_read on public.edu_students;
create policy edu_students_read on public.edu_students for select to authenticated using(public.edu_can_access_classroom(classroom_id) and (public.edu_is_teacher() or id=(select student_id from public.edu_profiles where user_id=auth.uid())));
drop policy if exists edu_assignments_read on public.edu_assignments;
create policy edu_assignments_read on public.edu_assignments for select to authenticated using(public.edu_can_access_classroom(classroom_id));
drop policy if exists edu_submissions_read on public.edu_submissions;
create policy edu_submissions_read on public.edu_submissions for select to authenticated using(
 (public.edu_is_teacher() or student_id=(select student_id from public.edu_profiles where user_id=auth.uid())) and
 exists(select 1 from public.edu_assignments a join public.edu_students s on s.classroom_id=a.classroom_id where a.id=assignment_id and s.id=student_id and public.edu_can_access_classroom(a.classroom_id)));
drop policy if exists edu_grades_read on public.edu_grades;
create policy edu_grades_read on public.edu_grades for select to authenticated using(
 (public.edu_is_teacher() or student_id=(select student_id from public.edu_profiles where user_id=auth.uid())) and
 exists(select 1 from public.edu_assignments a join public.edu_students s on s.classroom_id=a.classroom_id where a.id=assignment_id and s.id=student_id and public.edu_can_access_classroom(a.classroom_id)));
revoke select on public.edu_rewards from authenticated;

drop function if exists public.edu_state();
create or replace function public.edu_state(p_classroom_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.edu_profiles; result jsonb; ranking jsonb; classroom text;
begin
  p := public.edu_require_role(); classroom:=public.edu_require_classroom(p_classroom_id);
  with totals as (
    select s.id, s.name, s.code, s.avatar,
      coalesce(sum(case g.grade when 'AD' then 10 when 'A' then 8 when 'B' then 6 when 'C' then 4 else 0 end),0) as points,
      count(g.grade) as completed, count(a.id) as total,
      count(*) filter(where g.grade='AD') as ad, count(*) filter(where g.grade='A') as a,
      count(*) filter(where g.grade='B') as b, count(*) filter(where g.grade='C') as c,
      count(a.id) filter(where g.grade is null and sub.id is null) as pending,
      count(a.id) filter(where g.grade is null and sub.id is not null) as reviewing
    from public.edu_students s left join public.edu_assignments a on a.classroom_id=classroom
    left join public.edu_grades g on g.student_id=s.id and g.assignment_id=a.id
    left join public.edu_submissions sub on sub.student_id=s.id and sub.assignment_id=a.id
    where s.classroom_id=classroom
    group by s.id
  ), ranked as (
    select *, row_number() over(order by points desc, completed desc, lower(name) collate "C", id collate "C") as rank from totals
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'student', jsonb_build_object('id',id,'name',name,'code',case when p.role='teacher' then code else '' end,'avatar',avatar),
      'totalPoints',points,'assignmentsCompleted',completed,'totalAssignments',total,'rank',rank,
      'gradesCount',jsonb_build_object('AD',ad,'A',a,'B',b,'C',c,'unsubmitted',pending,'awaitingReview',reviewing)
    ) order by rank), '[]'::jsonb) into ranking from ranked;
  result := jsonb_build_object(
    'classroom',(select jsonb_build_object('id',id,'grade',grade,'section',section,'name',grade::text || '.º de secundaria · ' || section) from public.edu_classrooms where id=classroom),
    'students', (select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('classroomId',s.classroom_id) order by code),'[]'::jsonb) from public.edu_students s where s.classroom_id=classroom and (p.role='teacher' or s.id=p.student_id)),
    'assignments', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'subject',subject,'description',description,'dueDate',due_date,'createdAt',created_at) order by created_at,id),'[]'::jsonb) from public.edu_assignments where classroom_id=classroom),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'assignmentId',assignment_id,'photoUrl',photo_path,'submittedAt',submitted_at,'comment',comment,'photoReading',photo_reading) order by submitted_at),'[]'::jsonb) from public.edu_submissions where (p.role='teacher' or student_id=p.student_id) and assignment_id in (select id from public.edu_assignments where classroom_id=classroom) and student_id in (select id from public.edu_students where classroom_id=classroom)),
    'grades', (select coalesce(jsonb_agg(jsonb_build_object('studentId',student_id,'assignmentId',assignment_id,'grade',grade,'feedback',feedback,'updatedAt',updated_at)),'[]'::jsonb) from public.edu_grades where (p.role='teacher' or student_id=p.student_id) and assignment_id in (select id from public.edu_assignments where classroom_id=classroom) and student_id in (select id from public.edu_students where classroom_id=classroom)),
    'rewards', (select jsonb_build_object('firstPlace',first_place,'secondPlace',second_place,'thirdPlace',third_place) from public.edu_classroom_rewards where classroom_id=classroom),
    'ranking', ranking);
  return result;
end $$;

drop function if exists public.edu_create_assignment(text,text,date,text);
create or replace function public.edu_create_assignment(p_title text,p_subject text,p_due_date date,p_description text default '',p_classroom_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare classroom text;
begin
 perform public.edu_require_role('teacher'); classroom:=public.edu_require_classroom(p_classroom_id);
 insert into public.edu_assignments(title,subject,due_date,description,classroom_id) values(trim(p_title),trim(p_subject),p_due_date,coalesce(p_description,''),classroom);
end $$;
drop function if exists public.edu_delete_assignment(text);
create or replace function public.edu_delete_assignment(p_id text,p_classroom_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare classroom text;
begin
 perform public.edu_require_role('teacher'); classroom:=public.edu_require_classroom(p_classroom_id);
 delete from public.edu_assignments where id=p_id and classroom_id=classroom;
 if not found then raise exception 'La tarea no existe en esta aula.' using errcode='42501'; end if;
end $$;
drop function if exists public.edu_set_grade(text,text,text,text);
create or replace function public.edu_set_grade(p_assignment_id text,p_student_id text,p_grade text,p_feedback text default null,p_classroom_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare classroom text;
begin
 perform public.edu_require_role('teacher'); classroom:=public.edu_require_classroom(p_classroom_id);
 if not exists(select 1 from public.edu_assignments a join public.edu_students s on s.classroom_id=a.classroom_id where a.id=p_assignment_id and s.id=p_student_id and a.classroom_id=classroom) then raise exception 'Tarea o alumno fuera del aula permitida.' using errcode='42501'; end if;
 insert into public.edu_grades as g(assignment_id,student_id,grade,feedback) values(p_assignment_id,p_student_id,p_grade,coalesce(p_feedback,'')) on conflict(student_id,assignment_id) do update set grade=excluded.grade,feedback=coalesce(p_feedback,g.feedback),updated_at=now();
end $$;
drop function if exists public.edu_set_rewards(text,text,text);
create or replace function public.edu_set_rewards(p_first text,p_second text,p_third text,p_classroom_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare classroom text;
begin
 perform public.edu_require_role('teacher'); classroom:=public.edu_require_classroom(p_classroom_id);
 update public.edu_classroom_rewards set first_place=trim(p_first),second_place=trim(p_second),third_place=trim(p_third) where classroom_id=classroom;
end $$;
drop function if exists public.edu_import_grades(jsonb);
create or replace function public.edu_import_grades(p_changes jsonb,p_classroom_id text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; changes integer; classroom text;
begin
  perform public.edu_require_role('teacher'); classroom:=public.edu_require_classroom(p_classroom_id);
  if p_changes is null or jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'Importación inválida.'; end if;
  changes := jsonb_array_length(p_changes);
  if changes not between 1 and 10000 then raise exception 'Importa entre 1 y 10000 calificaciones por archivo.'; end if;
  if (select count(*) from (select distinct value->>'studentId',value->>'assignmentId' from jsonb_array_elements(p_changes)) d) <> changes
    then raise exception 'Hay calificaciones duplicadas.'; end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(item) <> 'object' or not (item ? 'grade') or not (item ? 'studentId') or not (item ? 'assignmentId') then raise exception 'Calificación incompleta.'; end if;
    perform public.edu_set_grade(item->>'assignmentId',item->>'studentId',item->>'grade',null,classroom);
  end loop;
  return changes;
end $$;
drop function if exists public.edu_submit(text,text,text,jsonb);
create or replace function public.edu_submit(p_assignment_id text, p_photo_path text, p_comment text default '', p_photo_reading jsonb default null,p_classroom_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.edu_profiles; classroom text;
begin
  p := public.edu_require_role('student'); classroom:=public.edu_require_classroom(p_classroom_id);
  if not exists(select 1 from public.edu_assignments where id=p_assignment_id and classroom_id=classroom) then raise exception 'No tienes permiso para entregar en esta aula.' using errcode='42501'; end if;
  if not public.edu_photo_access(p_photo_path) or not exists (
    select 1 from storage.objects where bucket_id='edupuntos-homework' and name=p_photo_path
  ) then raise exception 'La imagen no existe o no te pertenece.' using errcode='42501'; end if;
  insert into public.edu_submissions(student_id,assignment_id,photo_path,comment,photo_reading)
    values(p.student_id,p_assignment_id,p_photo_path,coalesce(p_comment,''),p_photo_reading)
    on conflict(student_id,assignment_id) do update set photo_path=excluded.photo_path,comment=excluded.comment,submitted_at=now(),photo_reading=excluded.photo_reading;
  -- The photo is evidence of work already graded at school. Preserve the official record.
end $$;

create or replace function public.edu_photo_access(p_path text,p_delete boolean default false)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.edu_profiles;
begin
 select * into p from public.edu_profiles where user_id=auth.uid();
 if not found then return false; end if;
 if p.role='teacher' then return not p_delete and exists(select 1 from public.edu_submissions sub join public.edu_assignments a on a.id=sub.assignment_id join public.edu_students s on s.id=sub.student_id and s.classroom_id=a.classroom_id where sub.photo_path=p_path and public.edu_can_access_classroom(a.classroom_id)); end if;
 if split_part(p_path,'/',1) is distinct from auth.uid()::text then return false; end if;
 if p_delete then return not exists(select 1 from public.edu_submissions where photo_path=p_path); end if;
 return not exists(select 1 from public.edu_submissions sub join public.edu_assignments a on a.id=sub.assignment_id where sub.photo_path=p_path and (sub.student_id<>p.student_id or not public.edu_can_access_classroom(a.classroom_id)));
end $$;
drop policy if exists edu_photo_insert on storage.objects;
create policy edu_photo_insert on storage.objects for insert to authenticated with check(bucket_id='edupuntos-homework' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.edu_profiles p join public.edu_students s on s.id=p.student_id where p.user_id=auth.uid() and p.role='student' and s.classroom_id is not null));
create or replace function public.edu_register_auth_student()
returns trigger language plpgsql security definer set search_path = '' as $$
declare details jsonb; account public.edu_student_accounts; student_key text;
begin
  if TG_OP = 'INSERT' then
    details := new.raw_user_meta_data;
    if details->>'signup_kind' is distinct from 'student' then return new; end if;
    if new.email is null or length(new.email)>254 then raise exception 'Correo inválido.'; end if;
    if not exists(select 1 from public.edu_classrooms where id=details->>'classroom_id') then raise exception 'Selecciona un aula válida.'; end if;
    insert into public.edu_student_accounts(user_id,dni,first_name,last_name,classroom_id)
      values(new.id,trim(details->>'dni'),trim(details->>'first_name'),trim(details->>'last_name'),details->>'classroom_id');
  end if;
  -- Auth owns email confirmation. Metadata changes never assign roles or replace a DNI.
  if new.email_confirmed_at is not null then
    select * into account from public.edu_student_accounts where user_id=new.id;
    if found and not exists(select 1 from public.edu_profiles where user_id=new.id) then
      student_key := 'est-' || new.id::text;
      insert into public.edu_students(id,code,name,avatar,classroom_id)
        values(student_key,'EST-' || upper(left(replace(new.id::text,'-',''),12)),account.first_name || ' ' || account.last_name,'',account.classroom_id);
      insert into public.edu_profiles(user_id,role,student_id) values(new.id,'student',student_key);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.edu_state(text) from public,anon;
grant execute on function public.edu_state(text) to authenticated;
revoke all on function public.edu_create_assignment(text,text,date,text,text) from public,anon;
grant execute on function public.edu_create_assignment(text,text,date,text,text) to authenticated;
revoke all on function public.edu_delete_assignment(text,text) from public,anon;
grant execute on function public.edu_delete_assignment(text,text) to authenticated;
revoke all on function public.edu_set_grade(text,text,text,text,text) from public,anon;
grant execute on function public.edu_set_grade(text,text,text,text,text) to authenticated;
revoke all on function public.edu_set_rewards(text,text,text,text) from public,anon;
grant execute on function public.edu_set_rewards(text,text,text,text) to authenticated;
revoke all on function public.edu_import_grades(jsonb,text) from public,anon;
grant execute on function public.edu_import_grades(jsonb,text) to authenticated;
revoke all on function public.edu_submit(text,text,text,jsonb,text) from public,anon;
grant execute on function public.edu_submit(text,text,text,jsonb,text) to authenticated;

drop trigger if exists edu_classroom_rewards_changed on public.edu_classroom_rewards;
create trigger edu_classroom_rewards_changed after insert or update or delete on public.edu_classroom_rewards for each statement execute function public.edu_notify_change();
drop trigger if exists edu_teacher_classrooms_changed on public.edu_teacher_classrooms;
create trigger edu_teacher_classrooms_changed after insert or update or delete on public.edu_teacher_classrooms for each statement execute function public.edu_notify_change();
commit;
