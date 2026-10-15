-- Administrador: aplicar DESPUÉS de 005_classrooms.sql.
-- Crear los dos profesores en Authentication > Users > Add user primero.
-- Sustituir SOLO los dos correos; no escribir contraseñas aquí.
-- No ejecutar con cuentas de alumnos. Repetir este archivo no duplica asignaciones.
begin;
do $$
declare item record; account uuid; existing_role text;
begin
 for item in select * from (values
   ('profesor1@example.invalid','sec-1-a'),
   ('profesor2@example.invalid','sec-2-b')
 ) as pilot(email,classroom) loop
   if item.email like '%@example.invalid' then
     raise exception 'Sustituye los dos correos de ejemplo por los profesores creados en Authentication.';
   end if;
   select id into account from auth.users where lower(email)=lower(item.email) and email_confirmed_at is not null;
   if account is null then raise exception 'Falta una cuenta confirmada para %.',item.email; end if;
   select role into existing_role from public.edu_profiles where user_id=account;
   if existing_role is not null and existing_role <> 'teacher' then
     raise exception 'La cuenta % ya pertenece a un alumno. Usa otra cuenta docente.',item.email;
   end if;
   if exists(select 1 from public.edu_student_accounts where user_id=account) then
     raise exception 'La cuenta % fue registrada como alumno. Usa otra cuenta docente.',item.email;
   end if;
   if exists(select 1 from public.edu_teacher_classrooms where user_id=account and classroom_id<>item.classroom) then
     raise exception 'La cuenta % ya tiene otras aulas. Revísala antes de usarla en este piloto.',item.email;
   end if;
   insert into public.edu_profiles(user_id,role,student_id) values(account,'teacher',null) on conflict(user_id) do nothing;
   insert into public.edu_teacher_classrooms(user_id,classroom_id) values(account,item.classroom) on conflict do nothing;
 end loop;
end $$;
commit;

-- Verificar en el panel administrativo; no compartir esta lista públicamente.
select u.email,c.grade,c.section
from public.edu_teacher_classrooms t join auth.users u on u.id=t.user_id
join public.edu_classrooms c on c.id=t.classroom_id
order by u.email,c.grade,c.section;
