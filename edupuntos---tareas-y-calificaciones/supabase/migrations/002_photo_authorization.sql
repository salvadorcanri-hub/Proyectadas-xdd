-- Check references with the full table view: student RLS can hide a reference
-- after an administrator reassigns an account, but the photo must stay protected.
begin;
create or replace function public.edu_photo_access(p_path text, p_delete boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  select * into p from public.edu_profiles where user_id=auth.uid();
  if not found then return false; end if;
  if p.role='teacher' then
    return not p_delete and exists(select 1 from public.edu_submissions where photo_path=p_path);
  end if;
  if split_part(p_path,'/',1) is distinct from auth.uid()::text then return false; end if;
  if p_delete then
    return not exists(select 1 from public.edu_submissions where photo_path=p_path);
  end if;
  return not exists(select 1 from public.edu_submissions where photo_path=p_path and student_id<>p.student_id);
end $$;
revoke all on function public.edu_photo_access(text,boolean) from public, anon;
grant execute on function public.edu_photo_access(text,boolean) to authenticated;

drop policy if exists edu_photo_read on storage.objects;
create policy edu_photo_read on storage.objects for select to authenticated using (
  bucket_id='edupuntos-homework' and public.edu_photo_access(name)
);
drop policy if exists edu_photo_delete on storage.objects;
create policy edu_photo_delete on storage.objects for delete to authenticated using (
  bucket_id='edupuntos-homework' and public.edu_photo_access(name,true)
);

create or replace function public.edu_submit(p_assignment_id text, p_photo_path text, p_comment text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.edu_profiles;
begin
  p := public.edu_require_role('student');
  if not public.edu_photo_access(p_photo_path) or not exists (
    select 1 from storage.objects where bucket_id='edupuntos-homework' and name=p_photo_path
  ) then raise exception 'La imagen no existe o no te pertenece.' using errcode='42501'; end if;
  insert into public.edu_submissions(student_id,assignment_id,photo_path,comment) values(p.student_id,p_assignment_id,p_photo_path,coalesce(p_comment,''))
    on conflict(student_id,assignment_id) do update set photo_path=excluded.photo_path,comment=excluded.comment,submitted_at=now();
  delete from public.edu_grades where student_id=p.student_id and assignment_id=p_assignment_id;
end $$;
revoke all on function public.edu_submit(text,text,text) from public, anon;
grant execute on function public.edu_submit(text,text,text) to authenticated;
commit;
