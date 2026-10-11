-- Run after 001 and 002. Photo readings are advisory client input, never official grades.
begin;
alter table public.edu_submissions add column if not exists photo_reading jsonb;
alter table public.edu_submissions drop constraint if exists edu_photo_reading_valid;
alter table public.edu_submissions add constraint edu_photo_reading_valid check (
  photo_reading is null or coalesce((
    jsonb_typeof(photo_reading)='object'
    and photo_reading ?& array['status','grade','confidence']
    and (photo_reading - 'status' - 'grade' - 'confidence')='{}'::jsonb
    and photo_reading->>'status' in ('read','uncertain','unavailable')
    and jsonb_typeof(photo_reading->'confidence')='number'
    and (photo_reading->>'confidence')::numeric between 0 and 100
    and case when photo_reading->>'status'='read' then
      photo_reading->>'grade' in ('AD','A','B','C') and (photo_reading->>'confidence')::numeric >= 85
    else photo_reading->'grade'='null'::jsonb end
  ), false)
);
comment on column public.edu_submissions.photo_reading is 'Advisory browser OCR of the photographed mark; never writes edu_grades or awards points.';

create or replace function public.edu_submit(p_assignment_id text, p_photo_path text, p_comment text default '', p_photo_reading jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  p := public.edu_require_role('student');
  if not public.edu_photo_access(p_photo_path) or not exists (
    select 1 from storage.objects where bucket_id='edupuntos-homework' and name=p_photo_path
  ) then raise exception 'La imagen no existe o no te pertenece.' using errcode='42501'; end if;
  insert into public.edu_submissions(student_id,assignment_id,photo_path,comment,photo_reading)
    values(p.student_id,p_assignment_id,p_photo_path,coalesce(p_comment,''),p_photo_reading)
    on conflict(student_id,assignment_id) do update set photo_path=excluded.photo_path,comment=excluded.comment,submitted_at=now(),photo_reading=excluded.photo_reading;
  -- The photo is evidence of work already graded at school. Preserve the official record.
end $$;
drop function if exists public.edu_submit(text,text,text);
revoke all on function public.edu_submit(text,text,text,jsonb) from public, anon;
grant execute on function public.edu_submit(text,text,text,jsonb) to authenticated;

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
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'assignmentId',assignment_id,'photoUrl',photo_path,'submittedAt',submitted_at,'comment',comment,'photoReading',photo_reading) order by submitted_at),'[]'::jsonb) from public.edu_submissions where p.role='teacher' or student_id=p.student_id),
    'grades', (select coalesce(jsonb_agg(jsonb_build_object('studentId',student_id,'assignmentId',assignment_id,'grade',grade,'feedback',feedback,'updatedAt',updated_at)),'[]'::jsonb) from public.edu_grades where p.role='teacher' or student_id=p.student_id),
    'rewards', (select jsonb_build_object('firstPlace',first_place,'secondPlace',second_place,'thirdPlace',third_place) from public.edu_rewards where id),
    'ranking', ranking);
  return result;
end $$;

commit;
