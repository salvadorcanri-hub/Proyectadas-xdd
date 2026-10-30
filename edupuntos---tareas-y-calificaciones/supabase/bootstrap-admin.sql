-- Run once in SQL Editor AFTER 006 and after creating/confirming this user in Authentication.
-- Passwords belong in Authentication, never in this file.
begin;
do $$
declare account uuid;
begin
 select id into account from auth.users where lower(email)='salvadorcanri@gmail.com' and email_confirmed_at is not null;
 if account is null then raise exception 'Crea y confirma salvadorcanri@gmail.com en Authentication primero.'; end if;
 if exists(select 1 from public.edu_profiles where user_id=account and role<>'teacher') or exists(select 1 from public.edu_student_accounts where user_id=account) then
   raise exception 'Esta cuenta pertenece a un alumno. Revisa su identidad antes de convertirla en administrador.';
 end if;
 insert into public.edu_profiles(user_id,role,student_id) values(account,'teacher',null) on conflict(user_id) do nothing;
 insert into public.edu_admins values(account) on conflict do nothing;
end $$;
commit;
