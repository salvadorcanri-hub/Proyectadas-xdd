-- Apply after 005. Does not create or promote any account automatically.
begin;
create table if not exists public.edu_admins(user_id uuid primary key references public.edu_profiles(user_id) on delete cascade);
alter table public.edu_admins enable row level security;
revoke all on public.edu_admins from public,anon,authenticated;
create table if not exists public.edu_account_creation_attempts(actor uuid references auth.users(id) on delete cascade, attempted_at timestamptz not null default now());
create index if not exists edu_account_creation_actor_time on public.edu_account_creation_attempts(actor,attempted_at);
alter table public.edu_account_creation_attempts enable row level security;
revoke all on public.edu_account_creation_attempts from public,anon,authenticated;
create or replace function public.edu_authorize_account_creation(p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.edu_admins a join public.edu_profiles p on p.user_id=a.user_id where a.user_id=p_actor and p.role='teacher') then raise exception 'Solo el administrador puede crear cuentas.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(p_actor::text));
 delete from public.edu_account_creation_attempts where attempted_at < now()-interval '15 minutes';
 if (select count(*) from public.edu_account_creation_attempts where actor=p_actor)>=20 then return false; end if;
 insert into public.edu_account_creation_attempts(actor) values(p_actor);
 return true;
end $$;
revoke all on function public.edu_authorize_account_creation(uuid) from public,anon,authenticated;
grant execute on function public.edu_authorize_account_creation(uuid) to service_role;
-- Only Auth administrators can set raw_app_meta_data. Never trust raw_user_meta_data for teacher roles.
create or replace function public.edu_provision_teacher()
returns trigger language plpgsql security definer set search_path='' as $$
declare classroom text;
begin
 if new.raw_app_meta_data->>'edu_role' is distinct from 'teacher' then return new; end if;
 if new.email_confirmed_at is null or new.raw_user_meta_data->>'signup_kind'='student' then raise exception 'Cuenta docente inválida.'; end if;
 if jsonb_typeof(new.raw_app_meta_data->'edu_classrooms') is distinct from 'array' then raise exception 'Faltan aulas docentes.'; end if;
 if jsonb_array_length(new.raw_app_meta_data->'edu_classrooms') not between 1 and 20 then raise exception 'Aulas docentes inválidas.'; end if;
 insert into public.edu_profiles(user_id,role,student_id) values(new.id,'teacher',null);
 for classroom in select jsonb_array_elements_text(new.raw_app_meta_data->'edu_classrooms') loop
   insert into public.edu_teacher_classrooms values(new.id,classroom) on conflict do nothing;
 end loop;
 return new;
end $$;
revoke all on function public.edu_provision_teacher() from public,anon,authenticated;
drop trigger if exists edu_provision_teacher on auth.users;
create trigger edu_provision_teacher after insert on auth.users for each row execute function public.edu_provision_teacher();
create or replace function public.edu_current_user()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.edu_profiles;
begin
 p:=public.edu_require_role();
 return jsonb_build_object('id',p.user_id,'username',coalesce((select email from auth.users where id=p.user_id),''),'role',p.role,'studentId',p.student_id,
 'isAdmin',exists(select 1 from public.edu_admins where user_id=p.user_id),
 'classrooms',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'grade',c.grade,'section',c.section,'name',c.grade::text || '.º de secundaria · ' || c.section) order by c.grade,c.section),'[]'::jsonb) from public.edu_classrooms c where public.edu_can_access_classroom(c.id)));
end $$;
commit;
