-- 021_merge_duplicate_roles.sql: merge the duplicate roles and stop the code depending on role NAMES.
-- Cause: the original roles were renamed in the Supabase table editor (pm -> Project Manager, developer -> Programmer ...),
-- so migration 014, which looks roles up by name, added a fresh lowercase set next to them.
-- This keeps the renamed ones, moves every member of a duplicate onto them, and deletes the duplicates.
-- Run after 020. Safe to run twice.

with pairs(dup_name, keep_name) as (
  values ('pm', 'Project Manager'), ('developer', 'Programmer'), ('intern', 'Intern'),
         ('tester', 'Tester'), ('designer', 'Designer'), ('viewer', 'Viewer')
),
ids as (
  select d.id as dup_id, k.id as keep_id
  from pairs p
  join public.roles d on d.name = p.dup_name
  join public.roles k on k.name = p.keep_name
)
update public.project_members m set role_id = ids.keep_id from ids where m.role_id = ids.dup_id;

delete from public.roles d
using (values ('pm', 'Project Manager'), ('developer', 'Programmer'), ('intern', 'Intern'),
              ('tester', 'Tester'), ('designer', 'Designer'), ('viewer', 'Viewer')) as p(dup_name, keep_name)
where d.name = p.dup_name
  and exists (select 1 from public.roles k where k.name = p.keep_name)
  and not exists (select 1 from public.project_members m where m.role_id = d.id);

-- The creator of a project becomes its PM: pick the PM role by its is_pm flag, never by name.
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pm_role_id bigint;
begin
  select id into pm_role_id from public.roles where is_pm order by is_system desc, id limit 1;
  if pm_role_id is null then
    insert into public.roles (name, description, is_pm, is_system)
    values ('Project Manager', 'Project manager', true, true)
    returning id into pm_role_id;
  end if;

  insert into public.project_members (project_id, user_id, role_id)
  values (new.id, new.created_by, pm_role_id);
  return new;
end;
$$;
