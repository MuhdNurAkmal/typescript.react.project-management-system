-- 014_restore_system_roles.sql
-- Creating a project failed with: null value in column "role_id" of relation "project_members".
-- The trigger that makes the creator a project manager looks the 'pm' role up by name, and the
-- built-in roles were missing from the roles table.
--
-- 1. Put the built-in roles back (safe to run any number of times).
-- 2. Make the trigger recreate the 'pm' role if it is ever missing again, instead of failing.

insert into public.roles (name, description, is_pm, is_system) values
  ('pm', 'Project manager', true, true),
  ('developer', 'Developer', false, true),
  ('intern', 'Intern', false, true),
  ('tester', 'Tester', false, true),
  ('designer', 'Designer', false, true),
  ('viewer', 'Read-only viewer', false, true)
on conflict (name) do update
  set is_pm = excluded.is_pm,
      is_system = true;

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pm_role_id bigint;
begin
  select id into pm_role_id from public.roles where name = 'pm' and is_pm;
  if pm_role_id is null then
    insert into public.roles (name, description, is_pm, is_system)
    values ('pm', 'Project manager', true, true)
    on conflict (name) do update set is_pm = true, is_system = true
    returning id into pm_role_id;
  end if;

  insert into public.project_members (project_id, user_id, role_id)
  values (new.id, new.created_by, pm_role_id);
  return new;
end;
$$;
