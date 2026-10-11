-- Apply after 003. DNI and email mappings never appear in classroom data or rankings.
begin;
create or replace function public.edu_registration_available()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.edu_registration_available() from public;
grant execute on function public.edu_registration_available() to anon, authenticated;
create table if not exists public.edu_student_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dni text not null unique check (dni ~ '^[0-9]{8}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  check (length(first_name || ' ' || last_name) <= 200)
);
alter table public.edu_student_accounts enable row level security;
revoke all on public.edu_student_accounts from public, anon, authenticated;

create or replace function public.edu_register_auth_student()
returns trigger language plpgsql security definer set search_path = '' as $$
declare details jsonb; account public.edu_student_accounts; student_key text;
begin
  if TG_OP = 'INSERT' then
    details := new.raw_user_meta_data;
    if details->>'signup_kind' is distinct from 'student' then return new; end if;
    if new.email is null or length(new.email)>254 then raise exception 'Correo inválido.'; end if;
    insert into public.edu_student_accounts(user_id,dni,first_name,last_name)
      values(new.id,trim(details->>'dni'),trim(details->>'first_name'),trim(details->>'last_name'));
  end if;
  -- Auth owns email confirmation. Metadata changes never assign roles or replace a DNI.
  if new.email_confirmed_at is not null then
    select * into account from public.edu_student_accounts where user_id=new.id;
    if found and not exists(select 1 from public.edu_profiles where user_id=new.id) then
      student_key := 'est-' || new.id::text;
      insert into public.edu_students(id,code,name,avatar)
        values(student_key,'EST-' || upper(left(replace(new.id::text,'-',''),12)),account.first_name || ' ' || account.last_name,'');
      insert into public.edu_profiles(user_id,role,student_id) values(new.id,'student',student_key);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.edu_register_auth_student() from public, anon, authenticated;
drop trigger if exists edu_auth_student_registration on auth.users;
create trigger edu_auth_student_registration after insert or update of email_confirmed_at on auth.users
  for each row execute function public.edu_register_auth_student();

-- Limits are shared across Netlify instances. Only the server can resolve a DNI.
create table if not exists public.edu_login_attempts (
  key_hash text primary key, attempts integer not null, expires_at timestamptz not null
);
alter table public.edu_login_attempts enable row level security;
revoke all on public.edu_login_attempts from public, anon, authenticated;
create or replace function public.edu_login_email(p_dni text,p_source_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare counter integer; allowed boolean := true; lookup_email text; attempt_key text; item integer;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed',false,'email',null);
  end if;
  delete from public.edu_login_attempts where expires_at <= now();
  for item in 1..2 loop
    attempt_key := case when item=1 then 'source:' || p_source_hash else 'dni:' || encode(sha256(convert_to(p_dni,'UTF8')),'hex') end;
    insert into public.edu_login_attempts values(attempt_key,1,now()+interval '15 minutes')
      on conflict(key_hash) do update set attempts=public.edu_login_attempts.attempts+1
      returning attempts into counter;
    if counter > (case when item=1 then 60 else 10 end) then allowed := false; end if;
  end loop;
  if allowed then
    select u.email into lookup_email from auth.users u join public.edu_student_accounts a on a.user_id=u.id where a.dni=p_dni;
  end if;
  return jsonb_build_object('allowed',allowed,'email',lookup_email);
end $$;
revoke all on function public.edu_login_email(text,text) from public, anon, authenticated;
grant execute on function public.edu_login_email(text,text) to service_role;
commit;
