-- AFTER creating these two users in Supabase Authentication > Users > Add user.
-- Replace both email addresses with the emails you actually created.
-- Do not put passwords in SQL or GitHub. The demo student est-1 must exist.
do $$
declare teacher_user uuid; student_user uuid;
begin
  select id into teacher_user from auth.users where lower(email)=lower('profesor@tucorreo.com');
  select id into student_user from auth.users where lower(email)=lower('alumno@tucorreo.com');
  if teacher_user is null or student_user is null then
    raise exception 'Primero crea ambas cuentas en Authentication > Users y sustituye los correos en este SQL.';
  end if;
  if teacher_user = student_user then raise exception 'Profesor y alumno deben tener cuentas diferentes.'; end if;
  insert into public.edu_profiles(user_id,role,student_id) values(teacher_user,'teacher',null)
    on conflict(user_id) do update set role=excluded.role,student_id=excluded.student_id;
  insert into public.edu_profiles(user_id,role,student_id) values(student_user,'student','est-1')
    on conflict(user_id) do update set role=excluded.role,student_id=excluded.student_id;
end $$;
