-- 005_roles_table.sql: move member roles out of a text check constraint into a CRUD-able table.
-- project_members.role_id -> roles.id, so each user's role in a project is a foreign key.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_pm boolean not null default false,   -- grants project-manager powers in RLS
  is_system boolean not null default false, -- built-in roles cannot be edited or deleted
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description, is_pm, is_system) values
  ('pm', 'Project manager', true, true),
  ('developer', 'Developer', false, true),
  ('intern', 'Intern', false, true),
  ('tester', 'Tester', false, true),
  ('designer', 'Designer', false, true),
  ('viewer', 'Read-only viewer', false, true);

-- Migrate project_members from the text column to a foreign key
alter table public.project_members add column role_id uuid references public.roles (id) on delete restrict;
update public.project_members pm set role_id = r.id from public.roles r where r.name = pm.role;
alter table public.project_members alter column role_id set not null;
create index on public.project_members (role_id);

-- PM checks now go through the roles table
create or replace function public.is_project_pm(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members m
    join public.roles r on r.id = m.role_id
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.is_active and r.is_pm
  );
$$;

-- Project creator becomes PM
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role_id)
  values (new.id, new.created_by, (select id from public.roles where name = 'pm'));
  return new;
end;
$$;

alter table public.project_members drop column role;

-- Roles CRUD: everyone signed in can read; any PM can create custom roles;
-- only the creator can edit/delete their own custom role. System roles are immutable.
alter table public.roles enable row level security;

create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_insert on public.roles for insert to authenticated
  with check (
    created_by = auth.uid()
    and not is_system
    and not is_pm
    and exists (
      select 1 from public.project_members m
      join public.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.is_active and r.is_pm
    )
  );
create policy roles_update on public.roles for update to authenticated
  using (created_by = auth.uid() and not is_system)
  with check (created_by = auth.uid() and not is_system and not is_pm);
create policy roles_delete on public.roles for delete to authenticated
  using (created_by = auth.uid() and not is_system);
